/**
 * 游戏回合解析：状态块容错 / 对话识别 / 新人物登记 / 支线交回主线
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseStepJson } from '../Romance/src/lib/stepParse.ts';

const ok = (s) => { const r = parseStepJson(s); assert.ok(r.obj, `应能解析：${s.slice(0, 40)}（${r.reason}）`); return r.obj; };

test('状态块_字符串里JSON转义换行与制表符', () => {
  assert.equal(
    ok('正文\n```json\n{"narration":"第一行\\n第二行\\ta","options":["a"]}\n```').narration,
    '第一行\n第二行\ta',
  );
});
test('状态块_正文里有花括号时用代码块包住状态', () => {
  assert.deepEqual(
    ok('他看着{user}笑了。\n```json\n{"options":["走","留"]}\n```').options,
    ['走', '留'],
  );
});
test('状态块_全角标点作JSON语法须判失败', () => {
  assert.equal(parseStepJson('```json\n{“options”：[“a”，“b”]}\n```').reason, 'invalid');
});
test('状态块_字符串内容里的全角标点和中文引号原样保留', () => {
  assert.equal(ok('```json\n{"narration":"你好，世界：他说“走”了","options":[]}\n```').narration, '你好，世界：他说“走”了');
});
test('状态块_截断仍判失败不硬补', () => {
  assert.equal(parseStepJson('```json\n{"narration":"x","options":["a"').reason, 'truncated');
});

const ai = readFileSync(new URL('../Romance/src/lib/ai.ts', import.meta.url), 'utf8');
const ctx = readFileSync(new URL('../Romance/src/store/GameContext.tsx', import.meta.url), 'utf8');
test('对话_兼容 名字：台词 与动作括注，单字旁白不当说话人', () => {
  assert.match(ai, /NON_SPEAKER = /);
  assert.match(ai, /NARRATED_SPEECH = /);
  assert.match(ai, /name.length >= 2/);
});
test('新人物_仅从结构化状态登记，照抄已有 id 不并入旧角色', () => {
  assert.doesNotMatch(ai, /withSpeakerNewcomers|namesActingInNarration/);
  assert.match(ai, /looksLikeOtherPerson\(npc, ncName, nc\)/);
  assert.match(ctx, /effectiveStep = isOoc \? \{ options: working.options \} : step!/);
});
test('支线_结束后结果交回主线；进不去支线不消耗', () => {
  assert.match(ctx, /function withSideOutcome/);
  assert.match(ctx, /if \(!g\.branch && isConfigured\(cfg\)\) persist\(mark\(g, "played"\)\)/);
});
test('转场_同场人物随主角换场景', () => {
  assert.match(ctx, /const sceneMoved = /);
});
