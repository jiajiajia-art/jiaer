/**
 * 回归：人物线路解锁条件 / 开局数值必须挂依赖（属性、人物、地点、事件）；
 * 未选中的不生效；简介/处境可留纯文本。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

const pools = {
  stats: [{ id: 'acting', label: '演技' }],
  metrics: [{ id: 'fame', label: '名气' }, { id: 'c:qi', label: '气运' }],
  people: [{ id: 'lin', label: '林晓' }],
  rooms: [{ id: 'inn', label: '旅店' }],
  events: [{ id: 'ev1', label: '开场风波' }],
};

test('pathDeps_解锁条件清洗与提示文案', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/pathDeps.ts')).href);
  assert.deepEqual(mod.PATH_LOCK_COND_KINDS, ['stat', 'metric', 'rel', 'location', 'event']);

  const cleaned = mod.sanitizePathLockConds(
    [
      { kind: 'metric', key: 'fame', op: 'gte', value: 50 },
      { kind: 'rel', key: 'ghost', op: 'gte', value: 10 },
      { kind: 'location', key: 'inn' },
      { kind: 'flag', key: 'x', op: 'gte', value: 1 },
      { kind: 'event', key: 'ev1' },
      null,
    ],
    pools,
  );
  assert.deepEqual(cleaned, [
    { kind: 'metric', key: 'fame', op: 'gte', value: 50 },
    { kind: 'location', key: 'inn' },
    { kind: 'event', key: 'ev1' },
  ]);
  assert.match(mod.formatPathLockHint(cleaned, pools), /名气/);
  assert.match(mod.formatPathLockHint(cleaned, pools), /旅店/);
  assert.match(mod.formatPathLockHint(cleaned, pools), /开场风波/);
  assert.equal(mod.formatPathLockHint([], pools), '');
});

test('pathDeps_开局数值只保留已有配置', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/pathDeps.ts')).href);
  const hasAttr = mod.makeAttrNameLookup([
    { id: 'acting', label: '演技' },
    { id: 'fame', label: '名气' },
  ]);
  const hasPerson = mod.makePersonLookup([{ id: 'lin', label: '林晓' }]);
  const filtered = mod.filterRouteFxToKnown(
    {
      attr: [{ name: '演技', val: 20 }, { name: '野属性', val: 9 }],
      favor: [{ target: '林晓', val: 5 }, { target: '路人甲', val: 3 }],
      reputation: [{ name: '名气', val: 8 }, { name: '', val: 1 }],
      note: '备忘',
    },
    { hasAttrName: hasAttr, hasPerson },
  );
  assert.deepEqual(filtered.attr, [{ name: '演技', val: 20 }]);
  assert.deepEqual(filtered.favor, [{ target: '林晓', val: 5 }]);
  assert.deepEqual(filtered.reputation, [{ name: '名气', val: 8 }]);
  assert.equal(filtered.note, '备忘');
  assert.equal(
    mod.filterRouteFxToKnown({ attr: [{ name: '野属性', val: 1 }] }, { hasAttrName: hasAttr, hasPerson }),
    undefined,
  );
});

test('pathDeps_编辑器禁止解锁与数值纯手打', () => {
  const paths = readFileSync(join(romance, 'components/ModPathsEditor.tsx'), 'utf8');
  assert.match(paths, /PathLockCondsEditor/);
  assert.match(paths, /DepNumRows/);
  assert.match(paths, /sanitizePathLockConds/);
  assert.match(paths, /formatPathLockHint/);
  assert.doesNotMatch(paths, /placeholder="如：达成任意一周目结局后解锁"/);
  assert.doesNotMatch(paths, /placeholder="如：通关任意一周目结局后解锁"/);
  assert.doesNotMatch(paths, /从属性池选或新建/);
  assert.doesNotMatch(paths, /从角色库选或手填/);
  assert.match(paths, /选择属性…/);
  assert.match(paths, /选择人物…/);
  assert.match(paths, /lockConds/);
  // 简介 / 处境仍可自由文本
  assert.match(paths, /线路简介（卡片上显示，仅给玩家看）/);
  assert.match(paths, /展开详情：开局处境/);
  // 开局地点 / 人物 / 事件须是 select 依赖
  assert.match(paths, /开局地点/);
  assert.match(paths, /预设主角/);
  assert.match(paths, /EventPick/);
});

test('pathDeps_开局结算禁止自动新建属性', () => {
  const ctx = readFileSync(join(romance, 'store/GameContext.tsx'), 'utf8');
  assert.match(ctx, /禁止再 routeAttrId 自动开洞/);
  assert.doesNotMatch(ctx, /d = \{ id: routeAttrId\(name\)/);
  assert.match(ctx, /if \(!d\) continue/);
});

test('pathDeps_CreationPath含lockConds', () => {
  const data = readFileSync(join(romance, 'game/data.ts'), 'utf8');
  assert.match(data, /lockConds\?:/);
});
