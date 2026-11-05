/**
 * 固定事件 AI 帮写：恰好 5 条完整叙事；空壳入库时整表替换；禁止选项。
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
    effects: [{ kind: 'metric', key: 'fame', delta: 2 }],
    trigger: { kind: 'auto' },
    ...extra,
  };
}

test('sanitizeAiFixedEvents_收成最多5条完整且剥选项', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/aiFixedEvents.ts')).href);
  assert.equal(mod.AI_FIXED_EVENTS_COUNT, 5);
  const list = mod.sanitizeAiFixedEvents(
    [
      { id: 'a', name: '空壳', prompt: '', effects: [] },
      complete(1, { choices: [{ id: 'c', label: '选' }], desc: undefined }),
      { id: 'alias', name: '别名提示词', 提示词: '雾港码头有人送来封旧信，信封潮湿却字迹未糊，你必须当面拆开应对来客。', effects: [{ kind: 'metric', key: 'stress', delta: 3 }] },
      complete(2),
      complete(3),
      complete(4),
      complete(5),
      complete(6),
    ],
    new Set(),
  );
  assert.equal(list.length, 5);
  for (const ev of list) {
    assert.ok(ev.prompt.length >= 20);
    assert.ok(ev.effects?.length >= 1);
    assert.equal(ev.trigger?.kind, 'auto');
    assert.equal(ev.choices, undefined);
  }
  assert.ok(list.some((e) => e.name === '别名提示词'));
});

test('mergeAiFixedEventsIntoLibrary_空壳居多时整表替换为5条', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/aiFixedEvents.ts')).href);
  const shells = Array.from({ length: 10 }, (_, i) => ({
    id: `shell_${i}`,
    name: `空${i}`,
    prompt: '',
    once: true,
  }));
  const gen = [1, 2, 3, 4, 5].map((i) => complete(i));
  const next = mod.mergeAiFixedEventsIntoLibrary(shells, gen);
  assert.equal(next.length, 5);
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

test('AiEventWriter_契约_一次生成5条完整且写入走 merge', () => {
  const src = read('components/AiEventWriter.tsx');
  assert.match(src, /AI_FIXED_EVENTS_COUNT/);
  assert.match(src, /sanitizeAiFixedEvents/);
  assert.match(src, /mergeAiFixedEventsIntoLibrary/);
  assert.match(src, /buildAiFixedEventsSystemPrompt/);
  assert.match(src, /生成 \$\{AI_FIXED_EVENTS_COUNT\} 条完整事件|生成.*5.*完整/);
  assert.doesNotMatch(src, /onAdd=\{/);
  assert.match(src, /list\.length < AI_FIXED_EVENTS_COUNT/);
});

test('FixedEventsPanel_传入 worldContext 且 onApply 整表写入', () => {
  const panel = read('components/FixedEventsPanel.tsx');
  assert.match(panel, /worldContext/);
  assert.match(panel, /onApply=\{\(list\) => \{ save\(list\)/);
  const mod = read('components/ModEditorPanel.tsx');
  assert.match(mod, /worldContext=\{\{/);
  assert.match(mod, /readScriptTone\(c\.prompt\)/);
});

test('systemPrompt_要求恰好5条且禁止choices', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/aiFixedEvents.ts')).href);
  const prompt = mod.buildAiFixedEventsSystemPrompt(
    { title: '雾港', setting: '海边旅店', rooms: [{ id: 'dock', name: '码头' }] },
    [],
  );
  assert.match(prompt, /恰好 5/);
  assert.match(prompt, /禁止 choices/);
  assert.match(prompt, /雾港/);
  assert.match(prompt, /码头/);
});
