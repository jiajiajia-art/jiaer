/**
 * 世界书：必须挂地点/人物；详细设定·节日并入同一份；触发 OR（地点 / 人物 / 关键词）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  foldLoreFestivalsIntoWorldBook,
  withWorldBookDeps,
  worldBookBindRooms,
  worldBookDepHit,
  worldBookHasDeps,
  worldBookMissingDepsErrors,
} from '../Romance/src/lib/worldBookDeps.ts';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');
const entNames = /天光小区|启星事务所|浮光影视基地/;

test('worldBookDeps_无依赖不得保存_有依赖通过', () => {
  const bare = { id: 'wb1', title: '雾港', keywords: ['雾'], content: '海边', enabled: true };
  assert.deepEqual(worldBookMissingDepsErrors([bare]), ['世界书「雾港」未挂地点或人物，不能保存']);
  const ok = withWorldBookDeps(bare, ['inn'], []);
  assert.equal(worldBookHasDeps(ok), true);
  assert.deepEqual(worldBookMissingDepsErrors([ok]), []);
  assert.deepEqual(worldBookBindRooms(ok), ['inn']);
});

test('worldBookDeps_详细设定并入世界书后清掉lore', () => {
  const folded = foldLoreFestivalsIntoWorldBook({
    worldBook: [{ id: 'wb0', title: '既有', keywords: [], content: 'x', enabled: true, bindRooms: ['inn'] }],
    lore: [{
      id: 'r1', name: '雾港', brief: '港', detail: '大雾码头', rooms: ['inn'],
      chars: [{ id: 'c1', name: '阿宁', brief: '掌柜', detail: '管账', npcId: 'a' }],
    }],
    festivals: [{ id: 'f1', name: '灯会', date: '01-15', detail: '放花灯' }],
  });
  assert.equal(folded.lore, undefined);
  assert.equal(folded.festivals, undefined);
  assert.ok(folded.worldBook.some((e) => e.id === 'wb_lore_r1' && e.bindRooms?.includes('inn')));
  assert.ok(folded.worldBook.some((e) => e.id === 'wb_lore_c1' && e.bindNpcs?.includes('a')));
  const fest = folded.worldBook.find((e) => e.id === 'wb_fest_f1');
  assert.ok(fest);
  assert.equal(fest.enabled, false);
});

test('worldBookDepHit_地点人物OR_子地点路径也算命中', () => {
  const e = withWorldBookDeps(
    { id: 'r', title: '客栈', keywords: [], content: '规矩', enabled: true },
    ['inn'],
    ['ning'],
  );
  assert.equal(worldBookDepHit(e, { room: 'inn' }), true);
  assert.equal(worldBookDepHit(e, { room: 'attic', roomPath: ['world', 'inn', 'attic'] }), true);
  assert.equal(worldBookDepHit(e, { room: 'dock', roomPath: ['world', 'dock'], npcIds: [] }), false);
  assert.equal(worldBookDepHit(e, { room: 'dock', npcIds: ['ning'] }), true);
  assert.equal(worldBookDepHit(e, { npcIds: ['other'] }), false);
  assert.equal(worldBookDepHit({ id: 'b', title: '裸', keywords: [], content: 'x', enabled: true }, { room: 'inn' }), false);
});
test('worldbookPick_有依赖时用地点人物关键词OR触发', () => {
  const src = read('game/worldbookPick.ts');
  const deps = read('lib/worldBookDeps.ts');
  assert.match(src, /worldBookDepsMatch/);
  assert.match(src, /worldBookDepHit/);
  assert.match(src, /worldBookHasDeps/);
  assert.match(src, /depHit && !kwHit/);
  assert.match(deps, /rooms\.includes\(opts\.room\)/);
  assert.doesNotMatch(src, /live = book\.filter\(\(e\) => e\.enabled && asTrimmedString\(e\.content\) && inScope/);
});

test('ModEditorPanel_只留世界书栏目_禁止娱乐圈地点回退', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.doesNotMatch(panel, /title="详细设定"/);
  assert.doesNotMatch(panel, /title="节日"/);
  assert.doesNotMatch(panel, /ModLoreEditor|ModFestivalEditor/);
  assert.match(panel, /title="世界书"/);
  assert.doesNotMatch(panel, /LIVE_LOCATIONS/);
  assert.doesNotMatch(panel, entNames);
  assert.match(panel, /foldLoreFestivalsIntoWorldBook/);
  assert.match(panel, /worldBookMissingDepsErrors/);
  // 功能注释：旧三栏编辑器文件必须删掉，避免又被接回
  assert.equal(existsSync(join(romance, 'components/ModLoreEditor.tsx')), false);
  assert.equal(existsSync(join(romance, 'components/ModFestivalEditor.tsx')), false);
  // 功能注释：依赖合并模块必须存在，否则部署后 ModEditorPanel 会 import 失败、界面回退到旧包
  assert.equal(existsSync(join(romance, 'lib/worldBookDeps.ts')), true);
});

test('WorldBookDepsPicker_空地点提示先去地点添加_不写死娱乐圈名', () => {
  const rules = read('components/WorldBookRules.tsx');
  assert.match(rules, /还没有地点。请先去「地点」添加/);
  assert.match(rules, /还没有人物。请先去「人物」添加/);
  assert.match(rules, /必须挂至少一个地点或人物，否则不能保存/);
  assert.doesNotMatch(rules, entNames);
  assert.doesNotMatch(rules, /LIVE_LOCATIONS/);
  const panel = read('components/WorldBookPanel.tsx');
  assert.match(panel, /getWorld\(\)\.content\.rooms/);
  assert.match(panel, /未挂地点或人物，不能保存/);
  assert.doesNotMatch(panel, /LIVE_LOCATIONS/);
  assert.doesNotMatch(panel, entNames);
  const modWb = read('components/ModWorldBookEditor.tsx');
  assert.match(modWb, /worldBookHasDeps/);
  assert.match(modWb, /requireDeps/);
  assert.doesNotMatch(modWb, entNames);
});

test('ai_不再单独注入loreBlock与festivalBlock', () => {
  const ai = read('lib/ai.ts');
  assert.doesNotMatch(ai, /loreBlock\(/);
  assert.doesNotMatch(ai, /festivalBlock\(/);
  assert.match(ai, /worldBookBlock\(/);
});

test('editorHubMenus_只有世界书没有详细设定节日', () => {
  const menus = read('lib/editorHubMenus.ts');
  assert.match(menus, /label: "世界书"/);
  assert.doesNotMatch(menus, /详细设定|节日/);
});
