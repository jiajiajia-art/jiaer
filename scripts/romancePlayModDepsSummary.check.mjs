/**
 * 玩法依赖摘要与移除时共享依赖 / 自动依赖清理契约
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = await import(join(root, 'Romance/src/lib/playModDepsSummary.ts'));

test('summarizePlayModDeps_应列出已装玩法的 dependsOn 及是否已装', () => {
  const edges = lib.summarizePlayModDeps([
    {
      modId: 'pm-pack-cars',
      slug: 'pack-cars',
      versionPinned: '1.0.0',
      enabled: true,
      editorPanels: ['cars'],
      dependsOn: ['pack-transport'],
    },
  ]);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].slug, 'pack-cars');
  assert.equal(edges[0].needs.length, 1);
  assert.equal(edges[0].needs[0].slug, 'pack-transport');
  assert.equal(edges[0].needs[0].installed, false);

  const withDep = lib.summarizePlayModDeps([
    {
      modId: 'pm-pack-transport',
      slug: 'pack-transport',
      versionPinned: '1.0.0',
      enabled: true,
      editorPanels: ['travel'],
    },
    {
      modId: 'pm-pack-cars',
      slug: 'pack-cars',
      versionPinned: '1.0.0',
      enabled: true,
      editorPanels: ['cars'],
      dependsOn: ['pack-transport'],
    },
  ]);
  assert.equal(withDep[0].needs[0].installed, true);
});

test('playModsDependingOn_应找出仍依赖目标的其它玩法', () => {
  const installs = [
    { modId: 'a', slug: 'pack-transport', versionPinned: '1.0.0', enabled: true, editorPanels: ['travel'] },
    {
      modId: 'b',
      slug: 'pack-cars',
      versionPinned: '1.0.0',
      enabled: true,
      editorPanels: ['cars'],
      dependsOn: ['pack-transport'],
    },
  ];
  const blockers = lib.playModsDependingOn('pack-transport', installs);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].slug, 'pack-cars');
  assert.deepEqual(lib.playModsDependingOn('pack-cars', installs), []);
});

test('orphanedAutoPlayDeps_仅候选 autoInstalled 且无人再依赖的项', () => {
  const remaining = [
    {
      modId: 'a',
      slug: 'pack-transport',
      versionPinned: '1.0.0',
      enabled: true,
      editorPanels: ['travel'],
      autoInstalled: true,
    },
    {
      modId: 'm',
      slug: 'pack-meals',
      versionPinned: '1.0.0',
      enabled: true,
      editorPanels: ['meals'],
      // 无 autoInstalled：手动装入，不得进入孤儿候选
    },
  ];
  const orphans = lib.orphanedAutoPlayDeps(remaining);
  assert.equal(orphans.length, 1);
  assert.equal(orphans[0].slug, 'pack-transport');

  const stillNeeded = [
    ...remaining,
    {
      modId: 'b',
      slug: 'pack-cars',
      versionPinned: '1.0.0',
      enabled: true,
      editorPanels: ['cars'],
      dependsOn: ['pack-transport'],
    },
  ];
  assert.equal(lib.orphanedAutoPlayDeps(stillNeeded).length, 0);
});
