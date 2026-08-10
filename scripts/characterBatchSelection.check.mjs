/**
 * characterBatchSelection FE helper
 */
import test from 'node:test';
import assert from 'node:assert/strict';

async function load() {
  return import('../src/lib/galgame/characterBatchSelection.ts');
}

test('resolveCharacterBatchSelection_空选中为全量', async () => {
  const { resolveCharacterBatchSelection } = await load();
  const s = resolveCharacterBatchSelection([]);
  assert.equal(s.hasSelection, false);
  assert.equal(s.generatePlayer, true);
  assert.equal(s.generateNPCs, true);
  assert.deepEqual(s.npcIds, []);
});

test('resolveCharacterBatchSelection_仅NPC', async () => {
  const { resolveCharacterBatchSelection } = await load();
  const s = resolveCharacterBatchSelection(['n1', 'n2']);
  assert.equal(s.hasSelection, true);
  assert.equal(s.generatePlayer, false);
  assert.equal(s.generateNPCs, true);
  assert.deepEqual(s.npcIds, ['n1', 'n2']);
});

test('resolveCharacterBatchSelection_含主角', async () => {
  const { resolveCharacterBatchSelection } = await load();
  const s = resolveCharacterBatchSelection(['player', 'n1']);
  assert.equal(s.hasSelection, true);
  assert.equal(s.generatePlayer, true);
  assert.deepEqual(s.npcIds, ['n1']);
});
