/**
 * 游戏回合解析：状态块容错 / 对话识别 / 新人物登记 / 支线交回主线
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseStepJson } from '../Romance/src/lib/stepParse.ts';

const ok = (s) => { const r = parseStepJson(s); assert.ok(r.obj, `应能解析：${s.slice(0, 40)}（${r.reason}）`); return r.obj; };

test('状态块_字符串里裸换行与制表符', () => {
  assert.equal(ok('正文\n```json\n{"narration":"第一行\n第二行\ta","options":["a"]}\n```').narration, '第一行\n第二行\ta');
});
test('状态块_正文里有花括号也能找到真正的状态块', () => {
  assert.deepEqual(ok('他看着{user}笑了。\n{"options":["走","留"]}').options, ['走', '留']);
});
test('状态块_全角冒号逗号与中文引号当语法符号', () => {
  assert.deepEqual(ok('```json\n{“options”：[“a”，“b”]}\n```').options, ['a', 'b']);
});
test('状态块_字符串内容里的全角标点和中文引号原样保留', () => {
  assert.equal(ok('```json\n{"narration":"你好，世界：他说“走”了","options":[]}\n```').narration, '你好，世界：他说“走”了');
});
test('状态块_截断仍判失败不硬补', () => {
  assert.equal(parseStepJson('```json\n{"narration":"x","options":["a"').reason, 'truncated');
});

const ai = readFileSync(new URL('../Romance/src/lib/ai.ts', import.meta.url), 'utf8');
const ctx = readFileSync(new URL('../Romance/src/store/GameContext.tsx', import.meta.url), 'utf8');
test('对话_兼容 名字：“台词” 与动作括注，系统标签不当说话人', () => {
  assert.match(ai, /NON_SPEAKER = /);
  assert.match(ai, /NARRATED_SPEECH = /);
});
test('新人物_开口说话未登记的补登场；照抄已有 id 不并入旧角色', () => {
  assert.match(ai, /export function withSpeakerNewcomers/);
  assert.match(ai, /looksLikeOtherPerson\(npc, ncName, nc\)/);
  assert.match(ctx, /withSpeakerNewcomers\(working, step!, segments\)/);
});
test('支线_结束后结果交回主线；进不去支线不消耗', () => {
  assert.match(ctx, /function withSideOutcome/);
  assert.match(ctx, /if \(!g\.branch && isConfigured\(cfg\)\) persist\(mark\(g, "played"\)\)/);
});
test('转场_同场人物随主角换场景', () => {
  assert.match(ctx, /const sceneMoved = /);
});
