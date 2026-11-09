/**
 * 固定事件 AI 帮写：建议约 2–5 条；只读本作品材料；材料无演艺圈时禁止相关词。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

function complete(i, extra = {}) {
  return {
    id: `fx_${i}`,
    name: `事件${i}`,
    prompt: `第 ${i} 幕：主角在场景里遭遇冲突，推动剧情向前发展，并留下可结算的数值后果。`,
    effects: [{ kind: 'metric', key: 'insight', delta: 2 }],
    trigger: { kind: 'auto' },
    ...extra,
  };
}

test('sanitizeAiFixedEvents_丢掉空壳并保留完整条', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/aiFixedEvents.ts')).href);
  assert.ok(mod.AI_FIXED_EVENTS_COUNT >= 2 && mod.AI_FIXED_EVENTS_COUNT <= 5);
  const list = mod.sanitizeAiFixedEvents(
    [
      { id: 'a', name: '空壳', prompt: '', effects: [] },
      complete(1, { choices: [{ id: 'c', label: '选' }] }),
      { id: 'alias', name: '别名提示词', 提示词: '雾港码头有人送来封旧信，信封潮湿却字迹未糊，你必须当面拆开应对来客。', effects: [{ kind: 'metric', key: 'stress', delta: 3 }] },
      complete(2),
      complete(3),
    ],
    new Set(),
  );
  assert.ok(list.length >= 1);
  assert.ok(list.length <= mod.AI_FIXED_EVENTS_SUGGEST_MAX + 3);
  for (const ev of list) {
    assert.ok(ev.prompt.length >= 20);
    assert.ok(ev.effects?.length >= 1);
  }
  assert.ok(list.some((e) => e.name === '别名提示词'));
});

test('mergeAiFixedEventsIntoLibrary_空壳居多时整表替换', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/aiFixedEvents.ts')).href);
  const shells = Array.from({ length: 10 }, (_, i) => ({
    id: `shell_${i}`,
    name: `空${i}`,
    prompt: '',
    once: true,
  }));
  const gen = [1, 2, 3].map((i) => complete(i));
  const next = mod.mergeAiFixedEventsIntoLibrary(shells, gen);
  assert.equal(next.length, 3);
  assert.ok(next.every((e) => e.prompt.length >= 20));
  assert.ok(!next.some((e) => e.id.startsWith('shell_')));
});

test('mergeAiFixedEventsIntoLibrary_已有完整事件时追加', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/aiFixedEvents.ts')).href);
  const existing = [complete(9)];
  const next = mod.mergeAiFixedEventsIntoLibrary(existing, [complete(1)]);
  assert.equal(next.length, 2);
  assert.equal(next[0].id, 'fx_9');
});

test('AiEventWriter_契约_只读本作品且写入走 merge', () => {
  const src = read('components/AiEventWriter.tsx');
  assert.match(src, /AI_FIXED_EVENTS_COUNT/);
  assert.match(src, /sanitizeAiFixedEvents/);
  assert.match(src, /mergeAiFixedEventsIntoLibrary/);
  assert.match(src, /buildAiFixedEventsSystemPrompt/);
  assert.doesNotMatch(src, /LIVE_PEOPLE|LIVE_LOCATIONS/);
  assert.doesNotMatch(src, /onAdd=\{/);
  assert.match(src, /list\.length < 1/);
});

test('FixedEventsPanel_传入 worldContext 且 onApply 整表写入', () => {
  const panel = read('components/FixedEventsPanel.tsx');
  assert.match(panel, /worldContext/);
  assert.match(panel, /onApply=\{\(list\) => \{ save\(list\)/);
  const mod = read('components/ModEditorPanel.tsx');
  assert.match(mod, /worldContext=\{\{/);
  assert.match(mod, /readScriptTone\(c\.prompt\)/);
});

test('systemPrompt_建议条数且材料无演艺圈时禁止相关词', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/aiFixedEvents.ts')).href);
  const prompt = mod.buildAiFixedEventsSystemPrompt(
    {
      title: '雾港',
      setting: '海边旅店继承',
      scriptTone: '克制人情',
      worldBook: [{ id: 'wb1', title: '潮汐', keywords: '潮汐', content: '潮汐影响客流' }],
      rooms: [{ id: 'dock', name: '码头' }],
      npcs: [{ id: 'n1', name: '林夏' }],
      stats: [{ key: 'insight', label: '洞察' }],
    },
    [],
  );
  assert.match(prompt, /2–5|2-5/);
  assert.match(prompt, /雾港/);
  assert.match(prompt, /码头/);
  assert.match(prompt, /潮汐/);
  assert.match(prompt, /洞察/);
  assert.match(prompt, /禁止出现/);
  assert.match(prompt, /通告|片场|名气/);
  assert.doesNotMatch(prompt, /恰好 5/);
});
