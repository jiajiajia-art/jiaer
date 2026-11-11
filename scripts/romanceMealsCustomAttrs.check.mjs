/** 玩法包通用化：不带娱乐圈八维 / 名气 / 压力 / 造型；编辑器与运行时都认作品建角属性 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');

test('packs_数据只在娱乐圈原版世界回填', () => {
  const src = read('Romance/src/mods/entPacks.ts');
  assert.match(src, /const entOnly = /);
  assert.doesNotMatch(src, /get \w+\(\) \{ return (ent\(\)\.\w+|RAW_MEALS|ENT_BILLS); \}/, '所有数据 getter 须经 entOnly');
});

test('packs_编辑器只用建角属性_无压力造型名气', () => {
  const src = read('Romance/src/components/ModPackEditors.tsx');
  assert.match(src, /export function packAttrKeys/);
  assert.doesNotMatch(src, /label="每周压力"|label="每周造型|label="名气门槛"|label="完成名气"/);
  assert.match(src, /value=\{m\.cgain\} keys=\{attrKeys\}/);
  assert.match(src, /keys=\{attrKeys\} onChange=\{\(v\) => set\(i, \{ statReq:/);
  assert.doesNotMatch(src, /FIXED_METRICS|statKeys\(/);
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  assert.match(panel, /statLabels=\{packAttrKeys\(c\.customAttrs\)\}/);
  assert.match(panel, /customAttrs=\{c\.customAttrs\} onChange/);
  assert.match(panel, /showBills=\{false\} attrsOnly/);
  assert.match(panel, /noBuiltin: true/);
});

test('packs_运行时通告与伙食走statRead/statAdd', () => {
  const logic = read('Romance/src/game/logic.ts');
  assert.match(logic, /export function statAdd/);
  assert.match(logic, /if \(g\.fameReq > 0 && s\.fame <= g\.fameReq\) return false/);
  assert.doesNotMatch(logic, /for \(const k of STAT_ORDER\) if \(g\.grow\[k\]\)/);
  assert.match(logic, /numEntries\(meal\.cgain\)\) statAdd/);
  assert.match(read('Romance/src/game/data.ts'), /export function attrLabelOf/);
});

test('packs_大地图行动与商店只用建角属性', () => {
  const src = read('Romance/src/components/MapEditorPanel.tsx');
  assert.match(src, /const worldBonusKeys = /);
  assert.doesNotMatch(src, /STAT_ORDER\.map\(\(k\) => \[k, STAT_LABELS\[k\]\]\)/);
  assert.doesNotMatch(src, /fame: "名气"/);
});

test('packs_合约项目行业舆情可用通用模板开始', async () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  for (const n of ['contractsStarter', 'projectsStarter', 'industryStarter', 'imageCrisisStarter']) {
    assert.match(panel, new RegExp(`starter=\\{${n}\\.starter\\} templates=\\{${n}\\.templates\\}`));
  }
  assert.match(read('Romance/src/components/DataForm.tsx'), /用通用模板开始/);
  const src = read('Romance/src/lib/packStarters.ts');
  assert.match(src, /const ENT_NUM_KEY = \/fame\|black\|tineng\|yanji\|geyi\|controversy\/i/);
});

test('metricBind_名气口碑黑粉体能与建角属性双向同步', async () => {
  const { pathToFileURL } = await import('node:url');
  const core = await import(pathToFileURL(join(root, 'Romance/src/game/metricBindCore.ts')).href);
  const pop = { id: 'pop', label: '人气', min: 0, max: 100, init: 10 };
  const sta = { id: 'hp', label: '精力', min: 0, max: 50, init: 30 };
  const binds = [{ role: 'fame', def: pop }, { role: 'stamina', def: sta }];
  const mk = (fame, tineng, cattrs) => ({ id: 'g1', sim: { fame, reputation: 0, blackFans: 0, stats: { tineng }, cattrs } });

  // 开局：以建角属性为准（无 cattrs 时取 init）
  const s0 = core.syncBoundMetricsWith(binds, null, mk(0, 0, {}));
  assert.equal(s0.sim.fame, 10);
  assert.equal(s0.sim.stats.tineng, 30);
  assert.equal(s0.sim.cattrs.pop, 10);

  // 建角属性变化（事件 +5）→ 写进引擎名气
  const s1 = core.syncBoundMetricsWith(binds, s0, { ...s0, sim: { ...s0.sim, cattrs: { ...s0.sim.cattrs, pop: 15 } } });
  assert.equal(s1.sim.fame, 15);

  // 引擎结算（上映名气 +200）→ 写回属性并截断到上限 100
  const s2 = core.syncBoundMetricsWith(binds, s1, { ...s1, sim: { ...s1.sim, fame: 215 } });
  assert.equal(s2.sim.cattrs.pop, 100);
  assert.equal(s2.sim.fame, 100);

  // 无绑定：原样返回（娱乐圈原版世界）
  const raw = mk(500, 80, {});
  assert.equal(core.syncBoundMetricsWith([], null, raw), raw);
});

test('metricBind_持久化入口与编辑器面板已接入', () => {
  assert.match(read('Romance/src/store/GameContext.tsx'), /s0 = syncBoundMetrics\(prevSame, s0\)/);
  assert.match(read('Romance/src/components/ModEditorPanel.tsx'), /title="玩法数值绑定"/);
  const proj = read('Romance/src/game/projects.ts');
  assert.match(proj, /statAdd\(grown, tpl\.mainStat, gMain\)/);
  assert.match(proj, /x\.metric === "c:" \+ tpl\.mainStat/);
});
