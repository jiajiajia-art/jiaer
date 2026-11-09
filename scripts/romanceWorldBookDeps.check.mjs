/**
 * 世界书：地点/人物可选；详细设定·节日并入同一份；有依赖时触发 OR（地点 / 人物 / 关键词）。
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

test('worldBookDeps_无依赖也可保存_有依赖仍可读', () => {
  const bare = { id: 'wb1', title: '雾港', keywords: ['雾'], content: '海边', enabled: true };
  // 功能注释：地点/人物已可选，保存校验恒为空
  assert.deepEqual(worldBookMissingDepsErrors([bare]), []);
  assert.equal(worldBookHasDeps(bare), false);
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
  // 功能注释：注释可提 LIVE_* 禁令；生产代码不得 import / 回退调用
  assert.doesNotMatch(panel, /import \{[^}]*LIVE_LOCATIONS/);
  assert.doesNotMatch(panel, /=\s*LIVE_LOCATIONS|LIVE_LOCATIONS\.map/);
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
  // 功能注释：地点/人物可选，禁止再写「必须挂…否则不能保存」
  assert.doesNotMatch(rules, /必须挂至少一个地点或人物，否则不能保存/);
  assert.match(rules, /所属地点 · 可选/);
  assert.match(rules, /所属人物 · 可选/);
  assert.doesNotMatch(rules, entNames);
  assert.doesNotMatch(rules, /LIVE_LOCATIONS/);
  const panel = read('components/WorldBookPanel.tsx');
  assert.match(panel, /getWorld\(\)\.content\.rooms/);
  assert.doesNotMatch(panel, /未挂地点或人物，不能保存/);
  assert.doesNotMatch(panel, /必须挂本作品地点或人物/);
  // 功能注释：注释可提 LIVE_* 禁令；生产代码不得 import / 回退调用
  assert.doesNotMatch(panel, /import \{[^}]*LIVE_LOCATIONS/);
  assert.doesNotMatch(panel, /=\s*LIVE_LOCATIONS|LIVE_LOCATIONS\.map/);
  assert.doesNotMatch(panel, entNames);
  const modWb = read('components/ModWorldBookEditor.tsx');
  assert.doesNotMatch(modWb, /未挂依赖 · 不能保存/);
  assert.doesNotMatch(modWb, /必须挂本作品地点或人物/);
  assert.doesNotMatch(modWb, entNames);
  const audit = read('game/refAudit.ts');
  assert.doesNotMatch(audit, /未挂本作品的地点或人物，保存模组前须补挂/);
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
