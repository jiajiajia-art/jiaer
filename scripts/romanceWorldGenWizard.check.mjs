/**
 * 创作游戏 · 生成世界向导：入口 + 第 1（设定）/ 2（编辑器）契约
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('CreateType_应在AI文游后插入创作游戏入口并指向romance向导', () => {
  const tsx = readFileSync(join(root, 'src/page/CreateType.tsx'), 'utf8');
  const zh = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');
  const css = readFileSync(join(root, 'src/components/CreateGame/CreateGameModals.module.css'), 'utf8');
  assert.match(zh, /"romanceMode":\s*"创作游戏"/);
  assert.match(tsx, /createGame\.romanceMode/);
  assert.match(tsx, /navigate\('\/romance\/\?createWorld=1'\)/);
  // 顺序：txt → romance → avg
  const iTxt = tsx.indexOf("createGame.txtMode");
  const iRom = tsx.indexOf("createGame.romanceMode");
  const iAvg = tsx.indexOf("createGame.avgBeta");
  assert.ok(iTxt >= 0 && iRom > iTxt && iAvg > iRom, '创作游戏须插在 AI文游 与 酒馆卡 之间');
  assert.match(css, /\.createTypeOptionThumbRomance/);
  assert.match(tsx, /createTypeOptionThumbRomance/);
});

test('Romance_App_应识别createWorld查询并挂载WorldGenWizard', () => {
  const app = readFileSync(join(romance, 'App.tsx'), 'utf8');
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  const css = readFileSync(join(romance, 'index.css'), 'utf8');
  assert.match(app, /shouldOpenWorldGenWizard/);
  assert.match(app, /shouldResumeWorldGenSession/);
  assert.match(app, /ensureWorldGenQuery/);
  assert.match(app, /WorldGenWizard/);
  // 平台表单对齐 funloom 暗色酒红创作壳，不跟局内可爱/宣纸浅色
  assert.match(app, /romance-platform/);
  assert.match(app, /data-platform-ui/);
  assert.match(app, /platformOnly/);
  assert.doesNotMatch(app, /platformOnly[\s\S]*classList\.add\("skin-cute"/);
  assert.doesNotMatch(app, /platformOnly[\s\S]*classList\.add\("accent-plum"/);
  assert.doesNotMatch(app, /platformOnly[\s\S]*classList\.add\("accent-jade"/);
  assert.match(css, /\.romance-platform\s*\{/);
  assert.match(css, /\.romance-platform\s*\{[^}]*--fl-surface:\s*#0A0A0A/);
  assert.match(css, /\.romance-platform\s*\{[^}]*--fl-wine:\s*#A8283C/);
  assert.match(css, /\.romance-platform\s*\{[^}]*--paper:\s*var\(--fl-surface\)/);
  assert.match(css, /\.romance-platform\s*\{[^}]*--jade:\s*var\(--fl-wine\)/);
  assert.match(css, /\.romance-platform\s*\{[^}]*--sheet-solid:\s*var\(--fl-sheet\)/);
  assert.doesNotMatch(css, /\.romance-platform\s*\{[^}]*--paper:\s*#f3e9d6/);
  assert.match(wiz, /生成世界/);
  // 向导不再包含游玩偏好选择页（建角页 / 局内设置已有）
  assert.doesNotMatch(wiz, /PlayPrefsPicker/);
  assert.doesNotMatch(wiz, /下一步：开局游玩偏好/);
  assert.doesNotMatch(wiz, /第 [23]\/3 步/);
  assert.doesNotMatch(wiz, /<h1[^>]*>开局游玩偏好</);
  // 第 2 步内嵌完整模组编辑器（①～⑧ + Section）；顶部指引条已删除，改由编辑器顶栏保存/预览
  assert.match(wiz, /ModEditorPanel/);
  assert.doesNotMatch(wiz, /创作游戏 · 第 2\/2 步 · 完整编辑器/);
  assert.match(wiz, /onBackToWizard/);
  assert.match(wiz, /进入完整编辑器/);
  // 校验失败用居中弹窗，禁止底栏旁难见的内联提示条
  assert.match(wiz, /errModal/);
  assert.match(wiz, /<Modal title="还差一步"/);
  assert.doesNotMatch(wiz, /border-coral\/40 bg-coral\/10/);
  // 禁止再渲染旧六项内容勾选；改为「本次需要 AI 生成的模组」+ 真实 AI 管线
  assert.doesNotMatch(wiz, /已选 \{contentCount\}/);
  assert.doesNotMatch(wiz, /WORLD_GEN_CONTENTS\.map/);
  assert.doesNotMatch(wiz, /配置编辑器模块/);
  assert.match(wiz, /本次需要 AI 生成的模组/);
  assert.match(wiz, /runWorldGenModules|单独重试|取消生成/);
  assert.doesNotMatch(wiz, /startNew/);
  assert.doesNotMatch(wiz, /OPEN_EDITOR_HUB_KEY/);
  // 禁止假进度：不得用本地模板灌数冒充生成；setInterval 仅允许刷新预计耗时秒数
  assert.doesNotMatch(wiz, /假进度|mockProgress|fakeProgress/);
  assert.match(wiz, /estimateWorldGenEtaSeconds|预计耗时/);
  assert.match(wiz, /worldGenEtaDisplaySeconds|worldGenEtaDeadlineMs|syncEtaDeadline|worldGenEtaNeedsRecalibrate/);
  assert.match(wiz, /formatWorldGenEtaParts/);
  assert.match(wiz, /world-gen-eta-unit/);
  assert.match(wiz, /etaParts\.minutes > 0/);
  assert.match(wiz, />秒</);
  assert.match(wiz, /scrollIntoView|pickWorldGenScrollTargetId/);
  assert.match(css, /\.world-gen-mod-row\.is-running/);
  assert.match(wiz, /setInterval\(\(\) => setEtaTick/);
  // 功能注释：进度/设定页须挂 world-gen 平台风格壳，避免退回灰白通用卡片
  assert.match(wiz, /world-gen-shell/);
  assert.match(wiz, /world-gen-eta|world-gen-progress-card/);
  assert.match(wiz, /world-gen-cta/);
  // 功能注释：第 2 步完整编辑器也须暗色平台壳；且不得改局内其它入口
  assert.match(wiz, /world-gen-editor/);
  assert.doesNotMatch(wiz, /step === 2[\s\S]{0,400}paper-grain/);
  assert.match(css, /\.world-gen-shell/);
  assert.match(css, /\.world-gen-eta/);
  assert.match(css, /\.world-gen-editor/);
  assert.match(css, /\.romance-host:has\(\[data-platform-ui="1"\]\)/);
  // 功能注释：平台壳须同步 --color-jade 酒红；禁止再退回宣纸墨绿浅底
  assert.match(css, /\.romance-platform\s*\{[^}]*--color-jade:\s*var\(--fl-wine\)/);
  assert.match(css, /\.world-gen-shell\s*\{[^}]*--wg-bg:\s*var\(--fl-bg/);
  assert.doesNotMatch(css, /\.world-gen-shell\s*\{[^}]*--wg-bg:\s*#f3e9d6/);
  assert.match(css, /\.world-gen-editor span\[class\*="rounded-full"\]\[class\*="bg-jade"\]/);
  // 功能注释：手机 100% 设备宽 + PC 最大 1200；禁止再整页横滑锁死最小 1200
  assert.match(wiz, /fluid/);
  assert.match(wiz, /overflow-x-hidden/);
  assert.match(css, /\.world-gen-editor \.mod-editor-root/);
  assert.match(css, /max-width:\s*1200px/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*max-width:\s*100%/);
  assert.match(css, /safe-area-inset/);
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(panel, /fluid\s*\?/);
  assert.match(panel, /min-w-0 max-w-\[1200px\]/);
});

test('ModEditorPanel_不应再含开局游玩偏好Section', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /title="开局游玩偏好"/);
  assert.doesNotMatch(panel, /PlayPrefsPicker/);
});

test('worldGenWizard_校验与内容映射编辑器模块', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  assert.equal(mod.validateWorldGenStep1(mod.defaultWorldGenStep1()), '请填写作品名称');
  const ok1 = {
    title: '雾港来信',
    setting: '玩家继承海边旅店。',
    aiPolish: true,
    engineId: 'balanced',
    contentIds: ['world', 'opening'],
    editorStepIds: ['prompt', 'opening'],
  };
  assert.equal(mod.validateWorldGenStep1(ok1), null);
  // 必须勾选至少一个编辑器模组
  assert.equal(mod.validateWorldGenStep1({ ...ok1, editorStepIds: [] }), '请至少勾选一个模组供 AI 生成');
  assert.equal(mod.validateWorldGenStep1({ ...ok1, title: 'x'.repeat(21) }), '作品名称最多 20 字');
  assert.deepEqual(mod.defaultWorldGenStep1().editorStepIds, [...mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS]);
  assert.ok(mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.length >= 15);
  assert.ok(mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.length < mod.ALL_WORLD_GEN_EDITOR_STEP_IDS.length);
  // 旧版「全选 59」须收束为基础默认
  const legacyFull = mod.normalizeWorldGenStep1({
    ...ok1,
    editorStepIds: [...mod.ALL_WORLD_GEN_EDITOR_STEP_IDS],
    scopeVersion: 1,
  });
  assert.deepEqual(legacyFull.editorStepIds, [...mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS]);
  assert.equal(legacyFull.scopeVersion, mod.WORLD_GEN_SCOPE_VERSION);
  // 新版本主动含扩展全选须保留
  const keepExt = mod.normalizeWorldGenStep1({
    ...ok1,
    editorStepIds: [...mod.ALL_WORLD_GEN_EDITOR_STEP_IDS],
    scopeVersion: mod.WORLD_GEN_SCOPE_VERSION,
  });
  assert.equal(keepExt.editorStepIds.length, mod.ALL_WORLD_GEN_EDITOR_STEP_IDS.length);
  assert.ok(mod.isWorldGenCoreStep('npcs'));
  assert.ok(mod.isWorldGenCoreStep('rooms'));
  assert.equal(mod.isWorldGenCoreStep('gigs'), false);
  assert.equal(mod.isWorldGenCoreStep('pregnancy'), false);
  assert.equal(mod.isWorldGenCoreStep('phoneAppsCfg'), false);
  assert.equal(mod.isWorldGenCoreStep('hub:mods'), false);
  assert.equal(mod.ALL_WORLD_GEN_CONTENT_IDS.length, 6);
  assert.ok(mod.ALL_WORLD_GEN_EDITOR_STEP_IDS.length >= 50);
  const feats = mod.defaultWorldGenFeatureFlags();
  assert.equal(feats.industryTab, false);
  assert.equal(feats.career, false);
  assert.equal(feats.pregnancy, false);
  const draft0 = mod.draftModFromWorldGen({ ...ok1, editorStepIds: [...mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS] });
  assert.equal(draft0.content.features.industryTab, false);
  assert.equal(draft0.content.playModInstalls, undefined);

  const steps = mod.defaultEditorStepsFromContent(['world']);
  assert.ok(steps.includes('prompt'));
  assert.ok(steps.includes('hub:book'));
  assert.ok(steps.includes('hub:rules'));
  assert.ok(steps.includes('hub:engine'));
  // 已取消「开局设定」聚合：时间在 travelTime，资金在 startResources
  assert.ok(!steps.includes('startSetup'));
  assert.ok(steps.includes('travelTime'));
  assert.ok(steps.includes('startResources'));
  assert.ok(steps.includes('features'));
  assert.ok(!steps.includes('opening'));

  const openSteps = mod.defaultEditorStepsFromContent(['opening']);
  assert.ok(openSteps.includes('opening'));
  assert.ok(openSteps.includes('cover'));
  assert.ok(openSteps.includes('theme'));
  assert.ok(openSteps.includes('hub:beauty'));
  assert.ok(openSteps.includes('hub:audio'));
  assert.ok(openSteps.includes('hub:nav'));
  // 取消「⑥ 开场」「④ 世界」后：开场剧情在⑥美化，地点仍在①基础
  const openMeta = mod.WORLD_GEN_EDITOR_STEPS.filter((s) => openSteps.includes(s.id));
  assert.ok(openMeta.every((s) => s.group !== '⑥ 开场'));
  assert.ok(openMeta.every((s) => s.group !== '④ 世界'));
  assert.ok(openMeta.some((s) => s.id === 'opening' && s.group === '⑥ 美化'));
  assert.ok(mod.WORLD_GEN_EDITOR_STEPS.some((s) => s.id === 'rooms' && s.group === '① 基础'));

  const charSteps = mod.defaultEditorStepsFromContent(['characters']);
  assert.ok(charSteps.includes('npcs'));
  assert.ok(charSteps.includes('hub:person'));
  assert.ok(charSteps.includes('hub:paths'));
  assert.ok(charSteps.includes('relations'));
  assert.ok(charSteps.includes('contacts'));

  const draft = { ...ok1, editorStepIds: steps, contentIds: mod.contentIdsFromEditorSteps(steps) };
  assert.equal(mod.validateWorldGenDraft(draft), null);
  assert.equal(mod.validateWorldGenDraft({ ...draft, editorStepIds: [] }), '请至少勾选一个模组供 AI 生成');

  const built = mod.draftModFromWorldGen(draft);
  assert.equal(built.kind, 'world');
  assert.equal(built.name, '雾港来信');
  assert.match(built.content.prompt.worldIntro, /海边旅店/);
  assert.equal(built.content.play, undefined);

  // 第 2 步游玩偏好：非缺省值写入 content.play；游戏模式+跟随世界观不占键
  assert.equal(mod.playSlotFromPrefs({ mode: 'game' }), undefined);
  assert.deepEqual(mod.playSlotFromPrefs({ mode: 'novel', pov: '1' }), { mode: 'novel', pov: '1' });
  const withPlay = mod.draftModFromWorldGen({
    ...draft,
    playPrefs: { mode: 'novel', pov: '2' },
  });
  assert.deepEqual(withPlay.content.play, { mode: 'novel', pov: '2' });
  assert.ok(!mod.WORLD_GEN_EDITOR_STEPS.some((s) => s.id === 'playPrefs'), '游玩偏好已移出编辑器模块清单');

  assert.equal(mod.shouldOpenWorldGenWizard('?createWorld=1'), true);
  assert.equal(mod.shouldOpenWorldGenWizard('?foo=1'), false);
  assert.equal(mod.shouldOpenWorldGenWizard('createWorld=true'), true);

  const grouped = mod.groupWorldGenEditorSteps();
  assert.equal(grouped.length, mod.WORLD_GEN_EDITOR_GROUP_ORDER.length);
  assert.ok(mod.WORLD_GEN_EDITOR_STEPS.length >= 50, '须覆盖 EditorHub + 模组细项');
});

test('worldGenWizard_第2步须覆盖游戏编辑器EditorHub全部菜单', async () => {
  const hub = await import(pathToFileURL(join(romance, 'lib/editorHubMenus.ts')).href);
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const shell = readFileSync(join(romance, 'components/GameShell.tsx'), 'utf8');
  // GameShell 须从共享菜单取文案，禁止再手写 15 个 label
  assert.match(shell, /EDITOR_HUB_MENUS/);
  assert.match(shell, /hub\("person"\)\.label/);
  assert.match(shell, /hub\("audio"\)\.label/);
  assert.match(shell, /hub\("timeline"\)\.label/);
  assert.match(shell, /hub\("mods"\)\.label/);
  for (const m of hub.EDITOR_HUB_MENUS) {
    assert.match(shell, new RegExp(`hub\\("${m.id}"\\)\\.label`));
  }
  assert.equal(hub.EDITOR_HUB_MENUS.length, 15, 'EditorHub 应为 15 个胶囊菜单');
  const names = new Set(mod.WORLD_GEN_EDITOR_STEPS.map((s) => s.name));
  const missing = hub.EDITOR_HUB_LABELS.filter((l) => !names.has(l));
  assert.deepEqual(missing, [], `向导第2步缺少游戏编辑器菜单: ${missing.join('、')}`);
  const hubSteps = mod.WORLD_GEN_EDITOR_STEPS.filter((s) => s.source === 'hub');
  assert.equal(hubSteps.length, 15);
});

test('worldGenWizard_第2步须覆盖ModEditorPanel全部可生成Section', async () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const titles = [...panel.matchAll(/<Section\s+g="[^"]+"\s+title="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(titles.length >= 30, `ModEditorPanel Section 过少: ${titles.length}`);
  // 功能注释：创作者页已去掉「功能扩展与皮肤」等开发者 Section；玩法用卡片标题覆盖
  const skip = new Set(['基本信息', '数值体检', '功能扩展与皮肤']);
  /** Hub 菜单或改名后的模组细项可满足的 Section 标题 */
  const alias = {
    人物: ['人物设定', '人物（模组库）'],
    地点: ['地点场景', '地点（模组库）'],
    世界书: ['世界书'],
    世界规则: ['世界规则'],
    固定事件: ['剧情桥段', '固定事件（模组库）'],
    'CG 图鉴': ['CG 图鉴'],
    阵营派系: ['阵营派系'],
    人物线路: ['人物线路'],
    结局与时限: ['结局', '结局与时限'],
    引擎规则: ['引擎规则（数值）', '底层规则', '引擎规则'],
    已添加的玩法: ['已添加的玩法', '玩法 mod'],
  };
  const names = new Set(mod.WORLD_GEN_EDITOR_STEPS.map((s) => s.name));
  const covered = (t) => names.has(t) || (alias[t] ?? []).some((a) => names.has(a));
  const missing = titles.filter((t) => !skip.has(t) && !covered(t));
  assert.deepEqual(missing, [], `向导第2步缺少模组编辑器 Section: ${missing.join('、')}`);
});
