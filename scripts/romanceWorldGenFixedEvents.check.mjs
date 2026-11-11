/**
 * 生成世界 · 固定事件：建议约 2–5 条完整叙事；半成品丢掉。
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

function completeEvent(i, extra = {}) {
  return {
    id: `fx_${i}`,
    name: `事件${i}`,
    prompt: `第 ${i} 幕：主角在场景里遭遇冲突，推动剧情向前发展，并留下可结算的数值后果。`,
    effects: [{ kind: 'metric', key: 'insight', delta: 2 }],
    trigger: { kind: 'auto' },
    ...extra,
  };
}

test('worldGenFixedEvents_建议条数且清洗半成品', async () => {
  const fe = await import(pathToFileURL(join(romance, 'lib/worldGenFixedEvents.ts')).href);
  const progress = await import(pathToFileURL(join(romance, 'lib/worldGenProgressDetail.ts')).href);

  assert.ok(fe.WORLD_GEN_FIXED_EVENTS_COUNT >= 2 && fe.WORLD_GEN_FIXED_EVENTS_COUNT <= 5);
  assert.ok(progress.worldGenLeanLimits(11).fixedEvents >= 2);
  assert.match(
    progress.worldGenLeanPromptBlock(progress.worldGenLeanLimits(11), 'skeleton'),
    /固定事件建议约 2–5/,
  );

  const cleaned = fe.normalizeWorldGenFixedEventsPatch({
    fixedEvents: [
      { id: 'a', name: '夜巡', prompt: '', choices: [{ id: 'c1', label: '' }], effects: [] },
      completeEvent(1, { choices: [{ id: 'c1', label: '选A' }] }),
      completeEvent(2),
      { id: 'half', name: '猎手', prompt: '太短' },
      completeEvent(3),
      completeEvent(4),
      completeEvent(5),
      completeEvent(6),
    ],
    events: [completeEvent(9, { name: '库里的半成品', prompt: '', effects: [] })],
  });
  assert.equal(cleaned.events, undefined, '不得再灌 events[] 事件库');
  assert.ok(cleaned.fixedEvents.length >= 1);
  assert.ok(cleaned.fixedEvents.length <= fe.WORLD_GEN_FIXED_EVENTS_SUGGEST_MAX + 3);
  for (const ev of cleaned.fixedEvents) {
    assert.ok(String(ev.prompt).length >= 20);
    assert.ok(Array.isArray(ev.effects) && ev.effects.length >= 1);
  }
  assert.equal(fe.softValidateWorldGenFixedEvents(cleaned), null);
  assert.match(fe.softValidateWorldGenFixedEvents({ fixedEvents: [] }) || '', /至少 1/);
});

test('worldGenGenerate_sanitize与softValidate_固定事件', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);

  const patch = gen.sanitizeWorldGenBatchPatch(['fixedEvents'], {
    fixedEvents: [
      completeEvent(1, { choices: [{ id: 'c1', label: '选' }] }),
      completeEvent(2),
      completeEvent(3),
      { id: 'junk', name: '空', prompt: '', choices: [{ id: 'x', label: '' }] },
    ],
    events: [{ id: 'lib', name: '库', prompt: '', choices: [{ id: 'y' }] }],
  });
  assert.equal(patch.events, undefined);
  assert.ok(patch.fixedEvents.length >= 1);
  assert.equal(gen.softValidateBatchPatch(['fixedEvents'], patch), null);
  assert.match(
    gen.softValidateBatchPatch(['fixedEvents'], { fixedEvents: [] }) || '',
    /至少 1|固定事件/,
  );
});
