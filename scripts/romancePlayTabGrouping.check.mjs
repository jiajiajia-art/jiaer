/**
 * 模组编辑器：玩法并入①基础；无独立「⑤ 玩法 Mod」页；无「功能开关」整块。
 * 添加玩法 = 启用；移除 = 停用。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const manager = readFileSync(join(romance, 'components/ModManagerPanel.tsx'), 'utf8');
const catalog = readFileSync(join(romance, 'mods/playModCatalog.ts'), 'utf8');

function sectionOpen(title) {
  const marker = `title="${title}"`;
  const at = panel.indexOf(marker);
  assert.ok(at >= 0, `缺少 Section：${title}`);
  return panel.slice(Math.max(0, at - 80), at);
}

test('未保存顶栏为创建世界_已保存仍为编辑名称', () => {
  assert.match(panel, /persisted \? `编辑「\$\{m\.name \|\| initial\.name\}」` : "创建世界"/);
  assert.doesNotMatch(panel, /新建模组/);
  assert.match(manager, /新建玩法 Mod/);
});

test('玩法并入基础_删除功能开关与独立玩法页', () => {
  assert.doesNotMatch(panel, /title="功能开关"/);
  assert.doesNotMatch(panel, /label: "⑤ 玩法 Mod"/);
  assert.doesNotMatch(panel, /k: "play"/);
  assert.match(panel, /k: "look", label: "⑤ 美化"/);
  assert.match(sectionOpen('已添加的玩法'), /g="base"/);
  for (const title of ['底栏页签', '手机应用配置', '皮肤美化']) {
    assert.match(sectionOpen(title), /g="look"/);
    assert.doesNotMatch(sectionOpen(title), /g="base"/);
  }
  assert.doesNotMatch(panel, /title="开局封面"/);
  const avatar = panel.indexOf('title="头像"');
  const create = panel.indexOf('title="建角"');
  const loc = panel.indexOf('title="地点"');
  const playList = panel.indexOf('title="已添加的玩法"');
  const pathSec = panel.indexOf('title="人物线路"');
  assert.ok(avatar >= 0 && avatar < create && create < pathSec && pathSec < loc && loc < playList, '头像→建角→人物线路→地点→已添加的玩法');
  const baseBetween = panel.slice(avatar, loc);
  assert.doesNotMatch(baseBetween, /title="已添加的玩法"|title="底栏页签"|title="手机应用配置"|title="开局封面"|title="皮肤美化"/);
  const basic = panel.slice(panel.indexOf('title="基本信息"'), panel.indexOf('title="时间与推进"'));
  assert.match(basic, /作品封面/);
  assert.match(basic, /ModCoverEditor/);
  assert.match(panel, /title="时间与推进"[\s\S]{0,2500}ModTravelEditor part="pace"/);
  assert.doesNotMatch(panel, /除「怀孕」外默认开启/);
  assert.doesNotMatch(panel, /行业主页签（人气榜 \/ 机遇）/);
});

test('玩法配置区块在基础页_时间推进的行动点留在基础', () => {
  for (const title of ['出行与交通', '座驾', '通告库', '经纪合约', '影视项目', '行业生态', '舆情人设', '娱乐周报', '每周吃什么', '孕育']) {
    assert.match(sectionOpen(title), /g="base"/);
  }
  assert.match(sectionOpen('时间与推进'), /g="base"/);
  assert.match(sectionOpen('地点'), /g="base"/);
  assert.doesNotMatch(panel, /title="开局封面"/);
  assert.match(sectionOpen('皮肤美化'), /g="look"/);
  assert.match(sectionOpen('开场剧情'), /g="look"/);
  assert.match(sectionOpen('剧情美化'), /g="look"/);
  assert.match(sectionOpen('底栏页签'), /g="look"/);
  assert.match(sectionOpen('手机应用配置'), /g="look"/);
  const baseCount = panel.slice(panel.indexOf('base: n('), panel.indexOf('role: n('));
  assert.match(baseCount, /apPerTurn/);
  assert.match(baseCount, /playModInstalls/);
  assert.doesNotMatch(baseCount, /phoneAppsCfg|navTabs/);
  assert.doesNotMatch(panel, /play: n\(/);
});

test('添加玩法即启用_无卡片启用开关与功能开关写入', () => {
  assert.match(catalog, /syncFeaturesFromPlayModInstalls/);
  assert.match(catalog, /PLAY_MOD_FEATURE_BY_SLUG/);
  assert.match(panel, /syncFeaturesFromPlayModInstalls/);
  assert.doesNotMatch(panel, /title=\{enabled \? "点击关闭此玩法"/);
  assert.doesNotMatch(panel, /aria-pressed=\{enabled\}/);
  assert.doesNotMatch(panel, /const optIn = k === "pregnancy"/);
  assert.doesNotMatch(panel, /开启孕育/);
  assert.match(panel, /ModPregnancyEditor/);
  assert.doesNotMatch(panel, /启用内置交通/);
  assert.doesNotMatch(panel, /features:\s*\{\s*\.\.\.c\.features,\s*transport:/);
});

test('向导清单与编辑器同一归类_功能开关下线', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  assert.ok(!mod.WORLD_GEN_EDITOR_STEPS.some((s) => s.id === 'features'));
  for (const id of ['travel', 'gigs', 'pregnancy', 'meals', 'playModInstalls']) {
    const step = mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === id);
    assert.equal(step?.group, '① 基础', id);
  }
  // 功能注释：开局封面 / 手机应用 / 皮肤美化不进 AI 勾选；其余美化细项仍归⑤
  for (const id of ['cover', 'phoneAppsCfg', 'theme']) {
    assert.ok(!mod.WORLD_GEN_EDITOR_STEPS.some((s) => s.id === id), id);
  }
  for (const id of ['navTabs', 'lookRules', 'bgm', 'audioRefs', 'opening']) {
    const step = mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === id);
    assert.equal(step?.group, '⑤ 美化', id);
  }
  assert.ok(mod.WORLD_GEN_EDITOR_STEPS.some((s) => s.id === 'opening'));
  assert.equal(mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === 'avatars')?.group, '① 基础');
  assert.equal(mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === 'creation')?.group, '① 基础');
  assert.equal(mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === 'travelTime')?.group, '① 基础');
  assert.equal(mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === 'rooms')?.group, '① 基础');
  const worldSteps = mod.defaultEditorStepsFromContent(['world']);
  assert.ok(!worldSteps.includes('features'));
  assert.ok(worldSteps.includes('travelTime'));
  assert.deepEqual(mod.defaultWorldGenFeatureFlags().transport, false);
});

test('syncFeaturesFromPlayModInstalls_添加座驾孕育即开_移除即关', async () => {
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const on = cat.syncFeaturesFromPlayModInstalls([
    cat.makeInstallFromCatalog(cat.catalogBySlug('pack-pregnancy')),
    cat.makeInstallFromCatalog(cat.catalogBySlug('pack-transport')),
    cat.makeInstallFromCatalog(cat.catalogBySlug('pack-cars')),
  ], { phone: true, career: true });
  assert.equal(on.pregnancy, true);
  assert.equal(on.transport, true);
  assert.equal(on.cars, true);
  assert.equal(on.career, false);
  assert.equal(on.phone, true);
  const off = cat.syncFeaturesFromPlayModInstalls([], on);
  assert.equal(off.pregnancy, false);
  assert.equal(off.transport, false);
  assert.equal(off.cars, false);
});

test('线上编辑器_创建世界五页签且基础含玩法无功能开关', { timeout: 90_000 }, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const session = {
    step: 2,
    s1: { title: '雾港来信', setting: '海边旅店', aiPolish: true, engineId: 'balanced', contentIds: ['world'], editorStepIds: ['rooms'], scopeVersion: 2 },
    draft: { title: '雾港来信', setting: '海边旅店', aiPolish: true, engineId: 'balanced', contentIds: ['world'], editorStepIds: ['rooms'], scopeVersion: 2 },
    mod: { id: 'ai-steps', name: '雾港来信', version: '0.1.0', kind: 'world', dependencies: [], content: { rooms: { inn: { name: '旅店', desc: '海边' } }, startRoom: 'inn' } },
    scrollY: 0,
    editorGroup: 'base',
    updatedAt: Date.now(),
  };
  try {
    await page.addInitScript((raw) => {
      sessionStorage.removeItem('star:wgTrimRecover');
      sessionStorage.removeItem('star:wgPersistBlock');
      localStorage.removeItem('star2005.draft.mod.new');
      localStorage.setItem('star:worldGenSession.v2', raw);
    }, JSON.stringify(session));
    await page.goto('http://39.106.250.199/funloom/romance/?createWorld=1', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByText('创建世界', { exact: true }).waitFor({ timeout: 20_000 });
    assert.equal(await page.getByText('新建模组', { exact: true }).count(), 0);
    const tab = (name) => page.getByRole('button', { name }).first();
    await tab(/① 基础/).click();
    await page.getByText('时间与推进', { exact: true }).waitFor();
    await page.getByText('已添加的玩法', { exact: true }).waitFor();
    // 功能注释：作品封面 UI 以源码静态用例为准；线上未部署本改动时不因旧「开局封面」阻断整页签回归
    const coverDeployed = (await page.getByText('作品封面', { exact: true }).count()) > 0;
    if (coverDeployed) {
      await page.getByText('作品封面', { exact: true }).first().waitFor();
      assert.equal(await page.getByText('开局封面', { exact: true }).count(), 0);
    }
    assert.equal(await page.getByText('功能开关', { exact: true }).count(), 0);
    assert.equal(await page.getByText('行业主页签（人气榜 / 机遇）', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /⑤ 玩法 Mod/ }).count(), 0);
    assert.equal(await page.getByText('底栏页签', { exact: true }).count(), 0);
    await tab(/⑤ 美化/).click();
    for (const label of ['手机应用配置', '皮肤美化', '音乐', '开场剧情', '剧情美化', '底栏页签']) {
      await page.getByText(label, { exact: true }).first().waitFor();
    }
    if (coverDeployed) {
      assert.equal(await page.getByText('开局封面', { exact: true }).count(), 0);
    }
    assert.equal(await page.getByText('功能开关', { exact: true }).count(), 0);
    assert.equal(await page.getByText('时间与推进', { exact: true }).count(), 0);
    await tab(/④ 剧情/).click();
    await page.waitForTimeout(400);
    // 功能注释：点④必须停在剧情（世界书/固定事件/剧情线），禁止跳回①基础；开场剧情已在⑤美化
    const pressed = (await page.locator('button[aria-pressed="true"]').allInnerTexts()).join(' ');
    assert.match(pressed, /④ 剧情/);
    assert.doesNotMatch(pressed, /① 基础/);
    await page.getByText('世界书', { exact: true }).first().waitFor({ timeout: 8_000 });
    await page.getByText('固定事件', { exact: true }).first().waitFor({ timeout: 5_000 });
    await page.getByText('剧情线', { exact: true }).first().waitFor({ timeout: 5_000 });
    assert.equal(await page.getByText('开场剧情', { exact: true }).count(), 0);
    assert.equal(await page.getByText('基本信息', { exact: true }).count(), 0);
    assert.equal(await page.getByText('养成模块', { exact: true }).count(), 0);
    await tab(/① 基础/).click();
    await page.getByText('头像', { exact: true }).waitFor();
    await page.getByText('建角', { exact: true }).waitFor();
    const body = await page.locator('body').innerText();
    // 功能注释：源码静态用例已断言「建角→人物线路→地点」；线上未部署时仍保证头像→建角→地点
    assert.ok(body.indexOf('头像') < body.indexOf('建角') && body.indexOf('建角') < body.indexOf('地点'), '基础页顺序：头像→建角→地点');
  } finally {
    await browser.close();
  }
});
