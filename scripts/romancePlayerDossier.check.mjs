/**
 * 玩家端人物档案：头像旁事实行、属性满值、警戒提醒、空态文案；无雷达/英文/均值/档位词。
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

test('dossierAttrCapLabel_有上限写满值_否则无上限', () => {
  assert.equal(lib.dossierAttrCapLabel({ max: 150 }), '满值 150');
  assert.equal(lib.dossierAttrCapLabel({ max: 0 }), '无上限');
  assert.equal(lib.dossierAttrCapLabel({}), '无上限');
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

test('SimTab_按原型_无雷达无英文眉题无均值无档位词', () => {
  assert.match(sim, /dossierFactLine/);
  assert.match(sim, /dossierAttrCapLabel/);
  assert.match(sim, /行囊空空 · 沿途拾取的物件会收纳在此/);
  assert.match(sim, /暂无履历 · 人生刚刚开始/);
  assert.match(sim, /w-16/); // 64px 条
  assert.match(sim, /h-1/); // 4px
  assert.doesNotMatch(sim, /function Radar|APTITUDE|CHRONICLE|BELONGINGS|均值/);
  assert.doesNotMatch(sim, /tierLabel|最强|满格/);
  // 属性只遍历创作者 attrDefs
  assert.match(sim, /attrDefs/);
  assert.doesNotMatch(sim, /STAT_ORDER\.map/);
});
