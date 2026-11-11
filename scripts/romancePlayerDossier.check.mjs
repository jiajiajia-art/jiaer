/**
 * 玩家端人物档案：头像旁事实行、属性单列进度条、警戒提醒、空态文案；
 * 列表不展示「满值」/最大值；无雷达/英文/均值/档位词。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const lib = await import(pathToFileURL(join(romance, 'lib/playerDossier.ts')).href);
const sim = readFileSync(join(romance, 'components/SimTab.tsx'), 'utf8');

test('dossierFactLine_年龄性别生日星座用间隔点拼接_缺项跳过', () => {
  assert.equal(
    lib.dossierFactLine({
      age: '24',
      gender: '女',
      extra: [
        { label: '生日', value: '2月13日' },
        { label: '星座', value: '水瓶座' },
      ],
    }),
    '24岁 · 女 · 2月13日 · 水瓶座',
  );
  assert.equal(lib.dossierFactLine({ age: '22岁', gender: '', extra: [] }), '22岁');
  assert.equal(lib.dossierFactLine({ age: '', gender: '', extra: [] }), '');
});

test('dossierAttrCapLabel_已下线_列表不展示满值', () => {
  assert.equal(typeof lib.dossierAttrCapLabel, 'undefined');
  assert.doesNotMatch(sim, /dossierAttrCapLabel/);
  assert.doesNotMatch(sim, /capMeta/);
  assert.doesNotMatch(sim, /meta=\{capMeta/);
  // 功能注释：禁止 JSX/模板把「满值 N」渲染给玩家（注释写「不展示满值」允许）
  assert.doesNotMatch(sim, />\s*满值\s*\{/);
  assert.doesNotMatch(sim, /`满值 \$\{/);
  assert.doesNotMatch(sim, /['"]满值 /);
});

test('dossierAttrWarn_压力类超线才提醒', () => {
  assert.equal(lib.dossierAttrWarn({ label: '演技', max: 999 }, 900), null);
  assert.equal(lib.dossierAttrWarn({ label: '压力', max: 100 }, 20), null);
  assert.match(lib.dossierAttrWarn({ label: '压力', max: 100 }, 80) ?? '', /警戒线/);
  assert.match(lib.dossierAttrWarn({ label: '心绪', color: 'danger', max: 100 }, 90) ?? '', /警戒线/);
  assert.match(lib.dossierAttrWarn({ label: '压力' }, 75) ?? '', /75/);
});

test('dossierAttrPct_夹到0到1', () => {
  assert.equal(lib.dossierAttrPct(50, 100), 0.5);
  assert.equal(lib.dossierAttrPct(0, 100), 0);
  assert.equal(lib.dossierAttrPct(200, 100), 1);
});

test('SimTab_属性单列_名左值右_深色字与深色条_无两列挤', () => {
  assert.match(sim, /dossierFactLine/);
  assert.match(sim, /行囊空空 · 沿途拾取的物件会收纳在此/);
  assert.match(sim, /暂无履历 · 人生刚刚开始/);
  // 功能注释：通栏约 6px 条；深色底轨 + 深色填充（禁止粉底同淡粉 coral/20）
  assert.match(sim, /h-1\.5/);
  assert.match(sim, /bg-ink\/20/);
  assert.match(sim, /bg-ink\/70/);
  assert.match(sim, /border-b border-ink\/25/);
  assert.match(sim, /w-full/);
  assert.doesNotMatch(sim, /bg-coral\/20/);
  assert.doesNotMatch(sim, /grid-cols-2 gap-x-4 gap-y-2\.5/);
  assert.doesNotMatch(sim, /h-1 w-16/); // 旧 4px×64px 短条
  assert.doesNotMatch(sim, /bg-line\/50/); // 旧灰底条
  assert.doesNotMatch(sim, /function Radar|APTITUDE|CHRONICLE|BELONGINGS|均值/);
  assert.doesNotMatch(sim, /tierLabel|最强|满格/);
  assert.match(sim, /attrDefs/);
  assert.doesNotMatch(sim, /STAT_ORDER\.map/);
  // 功能注释：属性名与数值都用 text-ink；列表禁止把当前值写成 text-coral（可爱皮肤下糊成浅粉）
  assert.match(sim, /font-semibold text-ink/);
  assert.match(sim, /tabular-nums \$\{warn \? "text-danger" : "text-ink"\}/);
  assert.doesNotMatch(sim, /warn \? "text-danger" : "text-coral"/);
});
