/**
 * 建角合成 + 开局页：只显示创作者配过的属性/字段；不预填八维；没属性则无属性区。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const lib = await import(pathToFileURL(join(romance, 'lib/creationOpening.ts')).href);
const attrsEd = readFileSync(join(romance, 'components/ModAttrsEditor.tsx'), 'utf8');
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const create = readFileSync(join(romance, 'components/CharacterCreate.tsx'), 'utf8');
const wizard = readFileSync(join(romance, 'lib/worldGenWizard.ts'), 'utf8');

test('openingSelectFieldOn_无选项且未锁定则不出现', () => {
  assert.equal(lib.openingSelectFieldOn(undefined, 0), false);
  assert.equal(lib.openingSelectFieldOn({ hidden: true }, 3), false);
  assert.equal(lib.openingSelectFieldOn({}, 2), true);
  assert.equal(lib.openingSelectFieldOn({ locked: true, value: '草根' }, 0), true);
  assert.equal(lib.openingSelectFieldOn({ locked: true, value: '  ' }, 0), false);
});

test('playerAttrsFromCreatorDefs_只按创作者列表_不预填八维', () => {
  assert.deepEqual(lib.playerAttrsFromCreatorDefs(undefined), []);
  assert.deepEqual(lib.playerAttrsFromCreatorDefs([]), []);
  const out = lib.playerAttrsFromCreatorDefs([
    { id: 'ling', label: '灵根', init: 12, max: 100 },
    { id: 'qi', label: '气势', initMode: 'dice', dice: 6, min: 1, max: 6 },
  ], () => 0);
  assert.equal(out.length, 2);
  assert.equal(out[0].key, 'ling');
  assert.equal(out[0].label, '灵根');
  assert.equal(out[0].value, 12);
  assert.equal(out[1].key, 'qi');
  assert.equal(out[1].value, 1); // rand=0 → 掷出 1
  assert.doesNotMatch(JSON.stringify(out), /演技|歌艺|yanji|geyi/);
});

test('ModAttrsEditor_去掉能力分档八维预填_表单由统一建角字段复用', () => {
  assert.doesNotMatch(attrsEd, /能力分档/);
  assert.doesNotMatch(attrsEd, /RAW_STAT_ORDER/);
  assert.doesNotMatch(attrsEd, /onStats|StatsSlot/);
  assert.match(attrsEd, /AttrDefForm/);
  assert.match(attrsEd, /建角页隐藏/);
});

test('ModEditorPanel_建角合成一块_在地点之上且人物线路在其后', () => {
  assert.match(panel, /title="建角"/);
  assert.doesNotMatch(panel, /title="角色属性"/);
  // Section 标题仍是「建角」；列表内文案「建角字段」允许出现在子编辑器
  assert.doesNotMatch(panel, /title="建角字段"/);
  const jian = panel.indexOf('title="建角"');
  const loc = panel.indexOf('title="地点"');
  const path = panel.indexOf('title="人物线路"');
  assert.ok(jian > 0 && loc > jian, '建角须在地点之上');
  assert.ok(path > loc, '人物线路仍在地点之后（②角色）');
  const createSec = panel.slice(jian, loc);
  assert.match(createSec, /ModCreationFieldsEditor/);
  assert.doesNotMatch(createSec, /ModAttrsEditor/);
});

test('CharacterCreate_开局不预填DEFAULT_ATTRS_只渲染系统四项与自定义字段', () => {
  // 功能注释：旧娱乐圈选项型内置已下线，不再走 openingSelectFieldOn / showIdentity 等
  assert.doesNotMatch(create, /openingSelectFieldOn|showIdentity|showKlass|showBackground/);
  assert.doesNotMatch(create, /DEFAULT_ATTRS/);
  assert.match(create, /attrs: \[\]/);
  assert.match(create, /creatorAttrs\.length > 0/);
  assert.match(create, /title="属性"/);
  assert.match(create, /systemFieldsComplete/);
  assert.match(create, /stepCustom/);
  assert.doesNotMatch(create, /stepTalent|stepFamily/);
});

test('worldGenWizard_建角一步取代stats与creationFields', () => {
  assert.match(wizard, /id: "creation"/);
  assert.match(wizard, /name: "建角"/);
  assert.doesNotMatch(wizard, /id: "stats"/);
  assert.doesNotMatch(wizard, /id: "creationFields"/);
  assert.match(wizard, /stats: \["creation"\]/);
  assert.match(wizard, /creationFields: \["creation"\]/);
});
