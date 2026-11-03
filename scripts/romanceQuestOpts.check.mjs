/**
 * 主线缺 nodes 时 questOpts / sanitize 不得再 reading 'map'（创建世界编辑器崩溃）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('buildQuestOpts_缺nodes或nodes非数组不抛TypeError', async () => {
  const { buildQuestOpts } = await import(pathToFileURL(join(romance, 'lib/questOpts.ts')).href);
  assert.deepEqual(
    buildQuestOpts([{ id: 'sl', name: '主线' }]),
    [{ id: 'sl', label: '主线·主线' }],
  );
  assert.deepEqual(
    buildQuestOpts([{ id: 'sl2', name: '雾港', nodes: undefined }]),
    [{ id: 'sl2', label: '主线·雾港' }],
  );
  assert.deepEqual(
    buildQuestOpts([{ id: 'sl3', name: '脏', nodes: null }]),
    [{ id: 'sl3', label: '主线·脏' }],
  );
  const withNodes = buildQuestOpts([
    { id: 'sl4', name: '卷王', nodes: [{ id: 'n1', name: '开学', optional: false }, { id: 'n2', name: '加餐', optional: true }] },
  ]);
  assert.equal(withNodes.length, 3);
  assert.equal(withNodes[1].label.includes('开学'), true);
  assert.equal(withNodes[2].label.includes('可选'), true);
  assert.doesNotThrow(() => buildQuestOpts(undefined));
  assert.doesNotThrow(() => buildQuestOpts([]));
});

test('sanitizeModStrings_主线缺nodes须补成空数组_单条对象收成数组', async () => {
  const { sanitizeModStrings } = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const clean = sanitizeModStrings({
    id: 'w1',
    name: '卷王',
    version: '1.0.0',
    kind: 'world',
    content: {
      storylines: [
        { id: 'r1', name: '无节点' },
        { id: 'r2', name: '单支', nodes: { id: 'n1', name: '第一幕' } },
      ],
    },
  });
  assert.deepEqual(clean.content.storylines[0].nodes, []);
  assert.equal(Array.isArray(clean.content.storylines[1].nodes), true);
  assert.equal(clean.content.storylines[1].nodes.length, 1);
  assert.equal(clean.content.storylines[1].nodes[0].id, 'n1');
});

test('FixedEventsPanel_须走buildQuestOpts且禁止直接l.nodes.map', () => {
  const src = readFileSync(join(romance, 'components/FixedEventsPanel.tsx'), 'utf8');
  assert.match(src, /buildQuestOpts\(lines\)/);
  assert.doesNotMatch(src, /\.\.\.l\.nodes\.map/);
  assert.doesNotMatch(src, /\.\.\.t\.nodes\.map/);
});
