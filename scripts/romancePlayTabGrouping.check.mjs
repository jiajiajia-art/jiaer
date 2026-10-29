/**
 * 模组编辑器：未保存顶栏叫「创建世界」；玩法开关与对应字段只出现在「⑤ 玩法 Mod」。
 * 不改保存格式，也不改开关写入规则。
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

test('功能开关留在玩法页_外观字段不夹在地点与头像之间', () => {
  assert.match(sectionOpen('功能开关'), /g="play"/);
  assert.doesNotMatch(sectionOpen('功能开关'), /g="base"/);
  for (const title of ['底栏页签', '手机应用配置', '开局封面', '皮肤美化']) {
    assert.match(sectionOpen(title), /g="look"/);
    assert.doesNotMatch(sectionOpen(title), /g="base"/);
    assert.doesNotMatch(sectionOpen(title), /g="play"/);
  }
  const loc = panel.indexOf('title="地点"');
  const avatar = panel.indexOf('title="头像库与匹配优先级"');
  const feat = panel.indexOf('title="功能开关"');
  const travel = panel.indexOf('title="出行与交通"');
  const cover = panel.indexOf('title="开局封面"');
  assert.ok(loc >= 0 && loc < avatar && avatar < feat, '地点、头像在功能开关之前');
  assert.ok(feat < travel && travel < cover, '玩法字段在美化封面之前');
  const baseBetween = panel.slice(loc, avatar);
  assert.doesNotMatch(baseBetween, /title="功能开关"|title="底栏页签"|title="手机应用配置"|title="开局封面"|title="皮肤美化"/);
  assert.match(panel, /title="时间与推进"[\s\S]{0,2500}ModTravelEditor part="pace"/);
  assert.match(panel, /除「怀孕」外默认开启，只有关闭的项会写入模组/);
});

test('玩法字段仍在玩法页_时间推进的行动点留在基础', () => {
  for (const title of ['出行与交通', '座驾', '通告库', '经纪合约', '影视项目', '行业生态', '舆情人设', '娱乐周报', '每周吃什么', '孕育']) {
    assert.match(sectionOpen(title), /g="play"/);
  }
  assert.match(sectionOpen('时间与推进'), /g="base"/);
  assert.match(sectionOpen('地点'), /g="base"/);
  assert.match(sectionOpen('开局封面'), /g="look"/);
  assert.match(sectionOpen('皮肤美化'), /g="look"/);
  assert.match(sectionOpen('开场剧情'), /g="look"/);
  assert.match(sectionOpen('剧情美化'), /g="look"/);
  assert.match(sectionOpen('底栏页签'), /g="look"/);
  assert.match(sectionOpen('手机应用配置'), /g="look"/);
  assert.doesNotMatch(panel, /title="主题外观"/);
  assert.doesNotMatch(panel, /title="皮肤与动画"/);
  assert.match(sectionOpen('头像库与匹配优先级'), /g="role"/);
  const baseCount = panel.slice(panel.indexOf('base: n('), panel.indexOf('role: n('));
  assert.match(baseCount, /apPerTurn/);
  assert.doesNotMatch(baseCount, /c\.features|phoneAppsCfg|navTabs/);
  const playCount = panel.slice(panel.indexOf('play: n('), panel.indexOf('look: n('));
  assert.match(playCount, /c\.features/);
  assert.doesNotMatch(playCount, /phoneAppsCfg/);
  assert.doesNotMatch(playCount, /navTabs/);
  const lookCount = panel.slice(panel.indexOf('look: n('), panel.indexOf('};', panel.indexOf('look: n(')));
  assert.match(lookCount, /c\.cover/);
  assert.match(lookCount, /phoneAppsCfg/);
  assert.match(lookCount, /navTabs/);
  assert.match(lookCount, /c\.opening/);
  assert.match(lookCount, /c\.theme/);
});

test('怀孕只留功能开关一处写入_公式不变', () => {
  assert.doesNotMatch(panel, /开启孕育/);
  assert.doesNotMatch(panel, /f\.pregnancy\s*=/);
  assert.doesNotMatch(panel, /delete f\.pregnancy/);
  assert.match(panel, /const optIn = k === "pregnancy"/);
  assert.match(panel, /if \(optIn\) \{ if \(on\) delete f\[k\]; else f\[k\] = true; \} else if \(on\) f\[k\] = false; else delete f\[k\];/);
  assert.match(panel, /ModPregnancyEditor/);
});

test('向导清单与编辑器同一归类_不改变生成内容id', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  for (const id of ['features', 'travel', 'gigs', 'pregnancy', 'meals']) {
    const step = mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === id);
    assert.equal(step?.group, '⑤ 玩法 Mod', id);
  }
  for (const id of ['navTabs', 'phoneAppsCfg', 'cover', 'opening', 'theme', 'lookRules']) {
    const step = mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === id);
    assert.equal(step?.group, '⑥ 美化', id);
  }
  assert.equal(mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === 'avatars')?.group, '② 角色');
  assert.equal(mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === 'travelTime')?.group, '① 基础');
  assert.equal(mod.WORLD_GEN_EDITOR_STEPS.find((s) => s.id === 'rooms')?.group, '① 基础');
  const worldSteps = mod.defaultEditorStepsFromContent(['world']);
  assert.ok(worldSteps.includes('features'));
  assert.ok(worldSteps.includes('travelTime'));
});

test('线上编辑器_创建世界标题且玩法开关只在玩法页', { timeout: 90_000 }, async () => {
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
    assert.equal(await page.getByText('功能开关', { exact: true }).count(), 0);
    assert.equal(await page.getByText('底栏页签', { exact: true }).count(), 0);
    assert.equal(await page.getByText('行业主页签（人气榜 / 机遇）', { exact: true }).count(), 0);
    await tab(/⑤ 玩法 Mod/).click();
    await page.getByText('功能开关', { exact: true }).waitFor();
    for (const label of ['行业主页签（人气榜 / 机遇）', '周报小报', '通告 / 作品 / 项目', '形象 · 舆情危机', '手机页签', '怀孕', '交通系统（出行方式 / 车费）', '座驾']) {
      assert.equal(await page.getByText(label, { exact: true }).count(), 1, label);
    }
    assert.match(await page.locator('body').innerText(), /除「怀孕」外默认开启/);
    assert.equal(await page.getByText('开启孕育', { exact: true }).count(), 0);
    assert.equal(await page.getByText('时间与推进', { exact: true }).count(), 0);
    await tab(/⑥ 美化/).click();
    for (const label of ['开局封面', '手机应用配置', '皮肤美化', '音乐', '开场剧情', '剧情美化', '底栏页签']) {
      await page.getByText(label, { exact: true }).first().waitFor();
    }
    assert.equal(await page.getByText('主题外观', { exact: true }).count(), 0);
    assert.equal(await page.getByText('皮肤与动画', { exact: true }).count(), 0);
    assert.equal(await page.getByText('内置音乐', { exact: true }).count(), 0);
    assert.equal(await page.getByText('引用音频库', { exact: true }).count(), 0);
    assert.equal(await page.getByText('功能开关', { exact: true }).count(), 0);
    assert.equal(await page.getByText('手机页签', { exact: true }).count(), 0);
    assert.equal(await page.getByText('时间与推进', { exact: true }).count(), 0);
    await tab(/④ 剧情/).click();
    assert.equal(await page.getByText('开场剧情', { exact: true }).count(), 0);
    assert.equal(await page.getByText('剧情美化', { exact: true }).count(), 0);
    await tab(/② 角色/).click();
    await page.getByText('头像库与匹配优先级', { exact: true }).waitFor();
    // 「全部」页签与跨组搜索契约见 romanceModEditorIa（静态）；线上部署前不再点「全部」
  } finally {
    await browser.close();
  }
});
