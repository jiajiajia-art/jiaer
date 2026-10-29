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

test('ModAttrsEditor_去掉能力分档八维预填_空态还没有属性', () => {
  assert.doesNotMatch(attrsEd, /能力分档/);
  assert.doesNotMatch(attrsEd, /RAW_STAT_ORDER/);
  assert.doesNotMatch(attrsEd, /onStats|StatsSlot/);
  assert.match(attrsEd, /还没有属性/);
});

test('ModEditorPanel_建角合成一块_人物线路在其下', () => {
  assert.match(panel, /title="建角"/);
  assert.doesNotMatch(panel, /title="角色属性"/);
  assert.doesNotMatch(panel, /title="建角字段"/);
  const jian = panel.indexOf('title="建角"');
  const path = panel.indexOf('title="人物线路"');
  assert.ok(jian > 0 && path > jian, '人物线路须在建角下方');
});

test('CharacterCreate_开局不预填DEFAULT_ATTRS_选项型字段走openingSelectFieldOn', () => {
  assert.match(create, /openingSelectFieldOn/);
  assert.match(create, /showIdentity/);
  assert.match(create, /showKlass/);
  assert.match(create, /showBackground/);
  assert.doesNotMatch(create, /DEFAULT_ATTRS/);
  assert.match(create, /attrs: \[\]/);
  assert.match(create, /creatorAttrs\.length > 0/);
  assert.match(create, /title="属性"/);
});

test('worldGenWizard_建角一步取代stats与creationFields', () => {
  assert.match(wizard, /id: "creation"/);
  assert.match(wizard, /name: "建角"/);
  assert.doesNotMatch(wizard, /id: "stats"/);
  assert.doesNotMatch(wizard, /id: "creationFields"/);
  assert.match(wizard, /id === "stats" \|\| id === "creationFields"/);
});
