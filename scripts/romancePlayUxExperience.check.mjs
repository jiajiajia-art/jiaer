/**
 * Romance 局内游玩体验（docs/局内游玩页体验-需求.md §3.1–3.16）：
 * 顶栏仅世界页 + 局势合并、菜单无编辑器、暗色一键、行动灵感无死文案、事件选项标色、
 * 剧情志去羁绊 / 星途、地点详情取图、地点说明去缩进、结局页跟主题可滚动、新地点自建点。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

const homeTab = read('components/HomeTab.tsx');
const shell = read('components/GameShell.tsx');
const topbar = read('components/TopbarView.tsx');
const quest = read('components/StoryQuestPanel.tsx');
const entity = read('components/EntityText.tsx');
const ending = read('components/Ending.tsx');
const app = read('App.tsx');
const css = read('index.css');
const ctx = read('store/GameContext.tsx');

const ideasMod = () => import(pathToFileURL(join(romance, 'lib/actionIdeas.ts')).href);
const locMod = () => import(pathToFileURL(join(romance, 'lib/newLocation.ts')).href);

/** 截取 GameShell 里「SETTINGS」分隔标签到下一个大块结束之间的菜单源码 */
const settingsMenuSrc = () => {
  const i = shell.indexOf('>SETTINGS<');
  assert.ok(i > 0, '找不到 SETTINGS 分隔');
  return shell.slice(i, shell.indexOf('{/* 内容区', i));
};

/* ───────── 3.6.1 行动灵感 ───────── */
test('actionIdeas_模块导出buildActionIdeas且源码无林宜', () => {
  const src = read('lib/actionIdeas.ts');
  assert.match(src, /export function buildActionIdeas/);
  assert.doesNotMatch(src, /林宜|经纪人|娱乐圈/);
});

test('HomeTab_无写死IDEAS且无林宜_改用buildActionIdeas', () => {
  assert.doesNotMatch(homeTab, /林宜/);
  assert.doesNotMatch(homeTab, /const IDEAS\s*=/);
  assert.doesNotMatch(homeTab, /IDEAS\.map/);
  assert.match(homeTab, /buildActionIdeas\(/);
});

test('buildActionIdeas_跟随地点与在场人物_且数量2到3条', async () => {
  const { buildActionIdeas } = await ideasMod();
  const ideas = buildActionIdeas({ locationName: '前台大厅', presentNames: ['周老板'], mainQuestLabel: '查清失踪案' });
  assert.ok(ideas.length >= 2 && ideas.length <= 3);
  assert.ok(ideas.some((t) => t.includes('周老板')), '应点名在场人物');
  assert.ok(ideas.some((t) => t.includes('前台大厅')), '应带上当前地点');
  for (const t of ideas) assert.doesNotMatch(t, /林宜|经纪人|娱乐圈|日程本/);
});

test('buildActionIdeas_无人无主线占位地名_仍给中性兜底且不嵌占位地名', async () => {
  const { buildActionIdeas } = await ideasMod();
  const ideas = buildActionIdeas({ locationName: '新地点', presentNames: [], mainQuestLabel: '' });
  assert.ok(ideas.length >= 2);
  for (const t of ideas) {
    assert.doesNotMatch(t, /新地点/);
    assert.doesNotMatch(t, /林宜|经纪人/);
  }
  assert.deepEqual(buildActionIdeas({}).length >= 2, true);
});

/* ───────── 3.6 事件选项标色 ───────── */
test('eventOptionIndexes_无进行中事件不标色_有事件至少标一条', async () => {
  const { eventOptionIndexes } = await ideasMod();
  const opts = [
    { label: '去赴宴', value: '去赴宴' },
    { label: '回房休息', value: '回房休息' },
  ];
  assert.equal(eventOptionIndexes(opts, []).size, 0, '无事件时不得乱标');
  assert.equal(eventOptionIndexes([], [{ name: '宴会' }]).size, 0);
  const hit = eventOptionIndexes(opts, [{ name: '赴宴邀约', keywords: ['赴宴'] }]);
  assert.deepEqual([...hit], [0], '应只标命中事件关键词的选项');
  const fallback = eventOptionIndexes(opts, [{ name: '深夜异响', keywords: [] }]);
  assert.ok(fallback.size >= 1, '事件存在但没命中文案时保底标一条');
});

test('HomeTab_事件项带事件标签与coral样式', () => {
  assert.match(homeTab, /eventOptionIndexes\(/);
  assert.match(homeTab, /option-btn-event/);
  assert.match(homeTab, />事件</);
});

/* ───────── 3.1 / 3.10 顶栏 ───────── */
test('GameShell_状态顶栏仅在home世界页显示', () => {
  assert.match(shell, /\{tab === "home" && \(\s*<TopbarView/);
  assert.doesNotMatch(shell, /!\["npc", "actions", "phone"\]\.includes\(tab\)/);
});

test('GameShell_局势并入TopbarView_不再单独飘条', () => {
  assert.doesNotMatch(shell, /<p className="topbar-note/);
  assert.match(shell, /note: game\.world\.note/);
  assert.match(topbar, /data\.note/);
  assert.match(topbar, /topbar-note/);
});

/* ───────── 3.4 菜单无编辑器 ───────── */
test('GameShell_SETTINGS区无编辑器MenuRow_保留AI配置与游戏设置', () => {
  const src = settingsMenuSrc();
  assert.doesNotMatch(src, /label="编辑器"/);
  assert.doesNotMatch(src, /romaji="EDITOR"/);
  assert.doesNotMatch(src, /setEditorOpen\(true\)/);
  assert.match(src, /label="AI 配置"/);
  assert.match(src, /label="游戏设置"/);
});

/* ───────── 3.7 暗色一键 ───────── */
test('SettingsPanel_暗色是单行按钮直接toggleDarkMode_不再包SettingBranch', () => {
  assert.doesNotMatch(shell, /<SettingBranch[^>]*title="暗色模式"/);
  const m = /<button[^>]*data-dark-toggle="1"[^>]*>/s.exec(shell);
  assert.ok(m, '应有 data-dark-toggle 单行按钮');
  assert.match(m[0], /onClick=\{toggleDarkMode\}/);
  assert.match(m[0], /aria-pressed=\{isDark\}/);
});

/* ───────── 3.8 / 3.9 剧情志 ───────── */
test('StoryQuestPanel_无羁绊页签_三栏_无星途硬编码', () => {
  assert.doesNotMatch(quest, /羁绊/);
  assert.doesNotMatch(quest, /星途/);
  assert.doesNotMatch(quest, /"bond"/);
  assert.doesNotMatch(quest, /ROMANCE_ARCS|arcView/);
  assert.match(quest, /grid-cols-3/);
  assert.doesNotMatch(quest, /grid-cols-4/);
  assert.match(quest, /\["main", "主线"[^\]]*\], \["side", "支线"[^\]]*\], \["journal", "回顾"/);
});

test('StoryQuestPanel_主线标题取homeMainQuest_不按周数硬算章节', () => {
  assert.match(quest, /homeMainQuest\(/);
  assert.match(quest, /getWorldStorylines/);
  assert.doesNotMatch(quest, /Math\.ceil\(s\.week \/ 4\)/);
  assert.doesNotMatch(quest, /第\{cnNum/);
});

test('StoryQuestPanel_名气口碑作品三格只在事业玩法时显示', () => {
  assert.match(quest, /feature\("career"\)/);
  assert.match(quest, /stats\.length > 0/);
});

test('StoryQuestPanel_有主线时不说尚未配置', () => {
  const idx = quest.indexOf('创作者尚未配置主线目标');
  assert.ok(idx > 0);
  const before = quest.slice(Math.max(0, idx - 500), idx);
  assert.match(before, /some\(\(l\) => l\.enabled !== false && l\.nodes\?\.length\)/);
});

/* ───────── 3.11 / 3.12 地点 ───────── */
test('LocDetail_取图与LocationHero同源_spotBackground优先于roomBgOf再回落舆图', () => {
  assert.match(entity, /spotBackground\(game, id\)/);
  assert.match(entity, /roomBgOf\(id\)/);
  assert.match(entity, /spotBackground\(game, id\) \|\| roomBgOf\(id\) \|\| map\.photos\?\.\[id\] \|\| map\.defaultPhoto/);
});

test('HomeTab_地点说明无首行缩进_隐藏新地点占位_与旁白同一story-prose', () => {
  assert.doesNotMatch(homeTab, /text-indent:2em/);
  assert.match(homeTab, /!\/新地点\/\.test\(rawDescText\)/);
  const i = homeTab.indexOf('{descText && (');
  const seg = homeTab.slice(i, i + 900);
  assert.match(seg, /story-prose/);
  assert.match(seg, /story-narration-panel/);
});

/* ───────── 3.15 结局页 ───────── */
test('Ending_纪念照允许复用主视觉_且根节点可纵向滚动', () => {
  assert.match(ending, /d\.photoImgs\.find\(usable\)/);
  assert.match(ending, /\?\?\s*heroSrc/);
  assert.match(ending, /end-page relative h-full min-h-0 overflow-y-auto/);
  assert.doesNotMatch(ending, /end-page relative min-h-dvh/);
});

test('Ending_index_css_end-page跟随主题变量_不再锁死固定浅色', () => {
  const i = css.indexOf('.end-page {');
  assert.ok(i > 0);
  const rule = css.slice(i, css.indexOf('}', i));
  assert.match(rule, /--e-ink: var\(--ink\)/);
  assert.match(rule, /--e-pink: var\(--coral\)/);
  assert.doesNotMatch(rule, /color-scheme:\s*light/);
  assert.doesNotMatch(css, /固定浅色，不随全局皮肤/);
  assert.match(css, /\.end-btn-pink \{[^}]*var\(--coral\)/);
});

test('App_作者预览stage对ending放开纵向滚动', () => {
  assert.match(app, /screen === "ending" \? "overflow-y-auto overflow-x-hidden" : "overflow-hidden"/);
});

/* ───────── 3.2 / 3.3 暗色 + 字体 ───────── */
test('index_css_叙事字色走story-ink变量_暗色浅字且旁白底变深', () => {
  assert.match(css, /--story-ink: #1a1a1a/);
  const darkAt = css.indexOf('html[data-romance].dark {');
  assert.ok(darkAt > 0);
  const darkBlock = css.slice(darkAt, css.indexOf('}', darkAt));
  assert.match(darkBlock, /--story-ink: #efe7d8/);
  assert.match(darkBlock, /--story-panel-bg: 24, 20, 17/);
  assert.match(css, /\.story-narration-panel \{[^}]*color: var\(--story-ink\)[^}]*rgba\(var\(--story-panel-bg\)/s);
  assert.match(css, /\.novel-read-card \.story-prose \{[^}]*color: var\(--story-ink\)/s);
  assert.doesNotMatch(css, /\.story-action \{\s*color: #1a1a1a/);
});

test('index_css_叙事相关元素统一游戏字体变量且心事不用斜体', () => {
  assert.match(css, /\.story-thought[^{]*\{[^}]*font-family: var\(--font-serif\)/s);
  const story = read('components/StoryTab.tsx');
  assert.doesNotMatch(story, /className="italic"/);
  assert.match(story, /story-thought/);
});

test('HomeTab_在场人物名标不用白底浅字', () => {
  assert.doesNotMatch(homeTab, /bg-white\/80 text-ink/);
});

/* ───────── 3.5 抵达剧情 ───────── */
test('GameContext_simMove抵达后追加地点描写_不只剩系统句', () => {
  const i = ctx.indexOf('const simMove = useCallback');
  const seg = ctx.slice(i, i + 5000);
  assert.match(seg, /descFlavor/);
  assert.match(seg, /spotDesc\(g, roomId\)/);
  assert.match(seg, /roomDesc\(roomId\)/);
  assert.match(seg, /\[head, \.\.\.\(intro \? \["" \+ intro\] : descFlavor \? \[descFlavor\] : \[\]\)/);
});

/* ───────── 3.14 新地点 ───────── */
test('isFormalPlaceName_正式地名通过_占位词与句子被拒', async () => {
  const { isFormalPlaceName } = await locMod();
  assert.equal(isFormalPlaceName('旧货铺'), true);
  assert.equal(isFormalPlaceName('厨房'), true);
  for (const bad of ['某处', '外面', '这里', '新地点', '', ' ', '他走进了一间昏暗的屋子，门吱呀一声', '12345', '路上']) {
    assert.equal(isFormalPlaceName(bad), false, `不应建点：${bad}`);
  }
});

test('addAutoSpot_建自建点连回转场前房间_同名只建一次_不覆盖已有改动', async () => {
  const { addAutoSpot, customSpotIdFor } = await locMod();
  const first = addAutoSpot({}, { name: '旧货铺', link: 'lobby' });
  assert.equal(first.created, true);
  const spot = first.edits[first.id];
  assert.equal(spot.custom, true);
  assert.equal(spot.name, '旧货铺');
  assert.equal(spot.link, 'lobby');
  assert.match(spot.desc, /旧货铺/);
  assert.doesNotMatch(spot.desc, /新地点/);
  assert.equal(first.id, customSpotIdFor('旧货铺'));
  // 玩家已改过的点：再次转到同名地点不得覆盖
  const edited = { ...first.edits, [first.id]: { ...spot, background: 'https://img/a.png', x: 3 } };
  const again = addAutoSpot(edited, { name: '旧货铺', link: 'other' });
  assert.equal(again.created, false);
  assert.equal(again.edits[again.id].background, 'https://img/a.png');
  assert.equal(again.edits[again.id].x, 3);
  assert.equal(again.edits[again.id].link, 'lobby');
});

test('pickSimilarSceneAsset_名称全等优先_互含次之_低分放弃_不配错图', async () => {
  const { pickSimilarSceneAsset } = await locMod();
  const assets = [
    { name: '海边灯塔', description: '海风与礁石', imageUrl: 'u/lighthouse.png', tags: ['海'] },
    { name: '旧货铺', description: '堆满杂物', imageUrl: 'u/shop.png' },
    { name: '古董旧货铺子', description: '', imageUrl: 'u/shop2.png' },
  ];
  assert.equal(pickSimilarSceneAsset('旧货铺', assets)?.imageUrl, 'u/shop.png');
  assert.equal(pickSimilarSceneAsset('古董旧货', assets)?.imageUrl, 'u/shop2.png');
  assert.equal(pickSimilarSceneAsset('火星基地', assets), undefined, '完全不相关应放弃');
  assert.equal(pickSimilarSceneAsset('旧货铺', []), undefined);
});

test('GameContext_转场对不上房间时走addAutoSpot并异步补素材图', () => {
  assert.match(ctx, /isFormalPlaceName\(next\.world\.location\)/);
  assert.match(ctx, /addAutoSpot\(next\.mapEdits/);
  assert.match(ctx, /findSceneImageForNewSpot\(/);
  assert.match(ctx, /spot\.background\?\.trim\(\)/, '只补空图，不覆盖已有背景');
});
