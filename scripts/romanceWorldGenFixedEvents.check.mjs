/**
 * 生成世界 · 固定事件：恰好 5 条完整叙事、无选项、有提示词与属性变化。
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
    effects: [{ kind: 'metric', key: 'fame', delta: 2 }],
    trigger: { kind: 'auto' },
    ...extra,
  };
}

test('worldGenFixedEvents_配额恰好5且清洗剥选项补触发', async () => {
  const fe = await import(pathToFileURL(join(romance, 'lib/worldGenFixedEvents.ts')).href);
  const progress = await import(pathToFileURL(join(romance, 'lib/worldGenProgressDetail.ts')).href);
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);

  assert.equal(fe.WORLD_GEN_FIXED_EVENTS_COUNT, 5);
  assert.equal(progress.worldGenLeanLimits(11).fixedEvents, 5);
  assert.equal(progress.worldGenLeanLimits(3).fixedEvents, 5);
  assert.match(
    progress.worldGenLeanPromptBlock(progress.worldGenLeanLimits(11), 'skeleton'),
    /固定事件恰好 5 条|禁止 choices/,
  );
  // 功能注释：半成品（无提示词 / 无后果 / 带空选项）必须丢掉；合法条强制 auto 且无 choices
  const cleaned = fe.normalizeWorldGenFixedEventsPatch({
    fixedEvents: [
      { id: 'a', name: '夜巡', prompt: '', choices: [{ id: 'c1', label: '' }], effects: [] },
      completeEvent(1, { choices: [{ id: 'c1', label: '' }], trigger: { kind: 'choice', event: 'x', choice: 'c1' } }),
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
  assert.equal(cleaned.fixedEvents.length, 5);
  for (const ev of cleaned.fixedEvents) {
    assert.ok(String(ev.prompt).length >= 20);
    assert.ok(Array.isArray(ev.effects) && ev.effects.length >= 1);
    assert.equal(ev.trigger.kind, 'auto');
    assert.equal(ev.choices, undefined);
  }
  assert.equal(fe.softValidateWorldGenFixedEvents(cleaned), null);

  assert.match(
    fe.softValidateWorldGenFixedEvents({ fixedEvents: [completeEvent(1)] }) || '',
    /正好 5/,
  );
  assert.match(
    fe.softValidateWorldGenFixedEvents({
      fixedEvents: [1, 2, 3, 4, 5].map((i) => completeEvent(i, { choices: [{ id: 'c', label: '选' }] })),
    }) || '',
    /不得带选项/,
  );
});

test('worldGenGenerate_sanitize与softValidate_固定事件完整契约', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const fe = await import(pathToFileURL(join(romance, 'lib/worldGenFixedEvents.ts')).href);
  const { readFileSync } = await import('node:fs');

  const patch = gen.sanitizeWorldGenBatchPatch(['fixedEvents'], {
    fixedEvents: [
      completeEvent(1, { choices: [{ id: 'c1', label: '' }] }),
      completeEvent(2),
      completeEvent(3),
      completeEvent(4),
      completeEvent(5),
      { id: 'junk', name: '空', prompt: '', choices: [{ id: 'x', label: '' }] },
    ],
    events: [{ id: 'lib', name: '库', prompt: '', choices: [{ id: 'y' }] }],
  });
  assert.equal(patch.events, undefined);
  assert.equal(patch.fixedEvents.length, 5);
  assert.equal(gen.softValidateBatchPatch(['fixedEvents'], patch), null);

  assert.match(
    gen.softValidateBatchPatch(['fixedEvents'], {
      fixedEvents: [completeEvent(1), completeEvent(2)],
    }) || '',
    /正好 5/,
  );
  assert.match(
    gen.softValidateBatchPatch(['fixedEvents'], {
      fixedEvents: [1, 2, 3, 4, 5].map((i) => ({
        id: `fx_${i}`,
        name: `事件${i}`,
        prompt: '',
        effects: [{ kind: 'metric', key: 'fame', delta: 1 }],
      })),
    }) || '',
    /提示词|正好 5/,
  );

  const hint = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  assert.match(hint, /fixedEvents: `fixedEvents\[\]：必须正好 \$\{WORLD_GEN_FIXED_EVENTS_COUNT\}/);
  assert.match(hint, /禁止 choices/);
  assert.match(hint, /本批 fixedEvents 必须正好 \$\{WORLD_GEN_FIXED_EVENTS_COUNT\}/);

  const writer = readFileSync(join(romance, 'components/AiEventWriter.tsx'), 'utf8');
  assert.match(writer, /sanitizeAiFixedEvents/);
  assert.match(writer, /AI_FIXED_EVENTS_COUNT/);
  assert.match(writer, /mergeAiFixedEventsIntoLibrary/);

  // 功能注释：提示词写在 desc 等别名时也能收成完整事件
  assert.equal(
    fe.normalizeWorldGenFixedEvent(
      {
        id: 'fx_alias',
        name: '别名',
        desc: '码头来客送来潮湿旧信，你必须当面拆开并决定是否回信。',
        effects: [{ kind: 'metric', key: 'fame', delta: 1 }],
      },
      0,
    )?.prompt?.length >= 20,
    true,
  );
});
