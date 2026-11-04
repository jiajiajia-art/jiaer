/**
 * 剧情线：AI 只生成一条主线且节点须有说明/条件；主线 UI 去掉奖励与激活事件；
 * 支线默认折叠，生成世界不写支线。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('StorylinesEditor_主线节点去掉奖励与激活事件', () => {
  const ed = read('components/StorylinesEditor.tsx');
  assert.match(ed, /目标说明/);
  assert.match(ed, /完成条件/);
  assert.doesNotMatch(ed, />完成奖励</);
  assert.doesNotMatch(ed, /label="完成后激活事件"/);
  assert.doesNotMatch(ed, /label="失败分支事件"/);
  assert.doesNotMatch(ed, /EffectRow/);
  assert.doesNotMatch(ed, /name: "新节点"/);
  assert.match(ed, /主线节点不配奖励/);
});

test('SidelinesEditor_默认折叠且空态提示不手写生成', () => {
  const ed = read('components/SidelinesEditor.tsx');
  assert.match(ed, /默认折起/);
  assert.match(ed, /aria-expanded=\{open\}/);
  assert.match(ed, /IconChevronDown|IconChevronUp/);
  assert.match(ed, /生成世界不会自动写支线|点「新建支线」添加/);
  assert.match(ed, /SIDELINES_EMPTY_TEXT/);
});

test('worldGenStorylines_只留一条主线并剥支线与奖励', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenStorylines.ts')).href);
  const patch = mod.normalizeWorldGenStorylinesPatch({
    storylines: [
      {
        id: 'a',
        name: '新主线',
        nodes: [
          { id: 'n1', name: '新节点', desc: '年底前拿下第一个主角', conds: [{ kind: 'metric', key: 'fame', op: 'gte', value: 10 }], rewards: [{ kind: 'metric' }], unlockIds: ['e1'] },
          { id: 'n2', name: '新节点', conds: [] },
        ],
      },
      { id: 'b', name: '第二条', nodes: [{ id: 'n3', name: '忽略', desc: 'x', conds: [{ kind: 'metric' }] }] },
    ],
    sidelines: [{ id: 's1', name: '不该出现' }],
  });
  assert.equal(patch.sidelines, undefined);
  assert.equal(Array.isArray(patch.storylines), true);
  assert.equal(patch.storylines.length, 1);
  assert.equal(patch.storylines[0].name, '主线');
  assert.ok(patch.storylines[0].nodes.length >= 1);
  for (const n of patch.storylines[0].nodes) {
    assert.notEqual(n.name, '新节点');
    assert.ok(String(n.name || '').trim());
    assert.ok(Array.isArray(n.conds) && n.conds.length >= 1);
    assert.equal(n.rewards, undefined);
    assert.equal(n.unlockIds, undefined);
  }
});

test('worldGen_提示与瘦身配额禁止支线', () => {
  const gen = read('lib/worldGenGenerate.ts');
  assert.match(gen, /normalizeWorldGenStorylinesPatch/);
  assert.match(gen, /禁止写 sidelines/);
  assert.doesNotMatch(gen, /storylines\[\]、sidelines\[\]、endings\[\]/);
  const lean = read('lib/worldGenProgressDetail.ts');
  assert.match(lean, /sidelines: 0/);
  assert.match(lean, /须为 0，勿写 sidelines/);
});
