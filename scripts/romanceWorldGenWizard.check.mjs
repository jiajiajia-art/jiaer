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
  assert.match(tsx, /creatorDraftApi\.createRomance\(\)/);
  assert.match(tsx, /\/romance\/\?createWorld=1&draftId=/);
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
  assert.match(wiz, /runWorldGenModules/);
  assert.match(wiz, /取消生成/);
  assert.doesNotMatch(wiz, /单独重试|单条重试|重试失败项/);
  assert.doesNotMatch(wiz, /retryFailedWorldGenModules|retryOneWorldGenModule/);
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
  // 功能注释：完成绿 / 失败红胶囊；文案「已完成」
  assert.match(css, /\.world-gen-mod-status\.is-done[^}]*#3dd68c|\.world-gen-mod-status\.is-done[\s\S]{0,120}#3dd68c/);
  assert.match(css, /\.world-gen-mod-status\.is-failed[^}]*#e23d55|\.world-gen-mod-status\.is-failed[\s\S]{0,120}#e23d55/);
  assert.match(wiz, /status === "done"\) return "已完成"/);
  // 功能注释：进度页底部仅「进入编辑器」「返回」，去掉重试与旧括号文案
  assert.match(wiz, /进入编辑器/);
  assert.doesNotMatch(wiz, /进入编辑器（保留已完成）|进入空编辑器|返回修改设定/);
  assert.match(wiz, />\s*返回\s*</);
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
    editorStepIds: ['prompt', 'npcs'],
  };
  assert.equal(mod.validateWorldGenStep1(ok1), null);
  // 功能注释：开场剧情已移出基础默认；旧勾选 opening 视为扩展玩法不可在此生成
  assert.equal(mod.validateWorldGenStep1({ ...ok1, editorStepIds: ['prompt', 'opening'] }), '扩展玩法请到编辑器「添加玩法」，不可在此生成');
  // 必须勾选至少一个编辑器模组
  assert.equal(mod.validateWorldGenStep1({ ...ok1, editorStepIds: [] }), '请至少勾选一个模组供 AI 生成');
  assert.equal(mod.validateWorldGenStep1({ ...ok1, title: 'x'.repeat(21) }), '作品名称最多 20 字');
  assert.deepEqual(mod.defaultWorldGenStep1().editorStepIds, [...mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS]);
  assert.ok(mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.length < mod.ALL_WORLD_GEN_EDITOR_STEP_IDS.length);
  // 旧版「全选含扩展」须收束为基础默认
  const legacyFull = mod.normalizeWorldGenStep1({
    ...ok1,
    editorStepIds: [...mod.ALL_WORLD_GEN_EDITOR_STEP_IDS],
    scopeVersion: 1,
  });
  assert.deepEqual(legacyFull.editorStepIds, [...mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS]);
  assert.equal(legacyFull.scopeVersion, mod.WORLD_GEN_SCOPE_VERSION);
  // 扩展玩法不得在生成世界勾选：即便旧会话带 scopeVersion 也一律剥掉
  const stripExt = mod.normalizeWorldGenStep1({
    ...ok1,
    editorStepIds: [...mod.ALL_WORLD_GEN_EDITOR_STEP_IDS],
    scopeVersion: mod.WORLD_GEN_SCOPE_VERSION,
  });
  assert.deepEqual(stripExt.editorStepIds, [...mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS]);
  assert.equal(mod.validateWorldGenStep1({ ...ok1, editorStepIds: ['prompt', 'pregnancy'] }), '扩展玩法请到编辑器「添加玩法」，不可在此生成');
  assert.ok(mod.isWorldGenCoreStep('npcs'));
  assert.ok(mod.isWorldGenCoreStep('rooms'));
  assert.equal(mod.isWorldGenCoreStep('gigs'), false);
  assert.equal(mod.isWorldGenCoreStep('pregnancy'), false);
  assert.equal(mod.isWorldGenCoreStep('phoneAppsCfg'), false);
  assert.equal(mod.isWorldGenCoreStep('hub:mods'), false);
  assert.equal(mod.isWorldGenCoreStep('opening'), false);
  assert.equal(mod.ALL_WORLD_GEN_CONTENT_IDS.length, 6);
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
  assert.ok(steps.includes('tuning'));
  assert.ok(!steps.includes('hub:engine'));
  // 已取消「开局设定」聚合：时间在 travelTime，资金在 startResources
  assert.ok(!steps.includes('startSetup'));
  assert.ok(steps.includes('travelTime'));
  assert.ok(steps.includes('startResources'));
  assert.ok(!steps.includes('features'), '功能开关已下线，不得再进 AI 勾选');
  assert.ok(!steps.includes('opening'), 'opening 属开场内容类别，不由 world 内容映射带出');

  const openSteps = mod.defaultEditorStepsFromContent(['opening']);
  // 功能注释：开场映射仍可带出 opening id，但不进基础默认 / 生成世界勾选
  assert.ok(openSteps.includes('opening'));
  assert.ok(!mod.isWorldGenCoreStep('opening'));
  // 开局封面 / 皮肤美化 / 手机应用配置不进 AI 勾选；音乐等仍可映射
  for (const id of ['cover', 'theme', 'phoneAppsCfg']) assert.ok(!openSteps.includes(id), id);
  assert.ok(openSteps.includes('bgm'));
  assert.ok(openSteps.includes('lookRules'));
  for (const id of ['hub:beauty', 'hub:audio', 'hub:nav', 'hub:cg']) assert.ok(!openSteps.includes(id), id);
  // 取消「⑥ 开场」「④ 世界」后：地点仍在①基础
  const openMeta = mod.WORLD_GEN_EDITOR_STEPS.filter((s) => openSteps.includes(s.id));
  assert.ok(openMeta.every((s) => s.group !== '⑥ 开场'));
  assert.ok(openMeta.every((s) => s.group !== '④ 世界'));
  assert.ok(mod.WORLD_GEN_EDITOR_STEPS.some((s) => s.id === 'rooms' && s.group === '① 基础'));

  const charSteps = mod.defaultEditorStepsFromContent(['characters']);
  assert.ok(charSteps.includes('npcs'));
  assert.ok(!charSteps.includes('hub:person'));
  assert.ok(charSteps.includes('hub:paths'));
  assert.ok(charSteps.includes('relations'));
  assert.ok(charSteps.includes('contacts'));

  // 功能注释：内容映射可含 tuning 等扩展项；生成世界校验只允许基础世界 id
  const coreSteps = steps.filter((id) => mod.isWorldGenCoreStep(id));
  assert.ok(coreSteps.length > 0);
  assert.ok(!coreSteps.includes('tuning'));
  const draft = { ...ok1, editorStepIds: coreSteps, contentIds: mod.contentIdsFromEditorSteps(coreSteps) };
  assert.equal(mod.validateWorldGenDraft(draft), null);
  assert.equal(mod.validateWorldGenDraft({ ...draft, editorStepIds: [] }), '请至少勾选一个模组供 AI 生成');

  const built = mod.draftModFromWorldGen(draft);
  assert.equal(built.kind, 'world');
  assert.equal(built.name, '雾港来信');
  // 功能注释：短设定可原样作简介；长设定禁止 slice(0,200) 原文照搬；剧本基调留给 AI
  assert.equal(built.description, '玩家继承海边旅店。');
  assert.equal(built.content.prompt.worldIntro, undefined);
  assert.equal(built.content.prompt.scriptTone, undefined);
  const longSetting = `${'王朝背景：大衍立国二百余年，外戚干政，后宫争宠。'.repeat(8)}禁止把整段设定贴进简介。`;
  const longBuilt = mod.draftModFromWorldGen({ ...draft, setting: longSetting });
  assert.ok(longBuilt.description.length <= 120, '长设定简介须压到约 100 字');
  assert.notEqual(longBuilt.description, longSetting.slice(0, 200));
  assert.ok(!longBuilt.description.includes('禁止把整段设定贴进简介'));
  assert.deepEqual(built.content.cover, { title: '雾港来信' });
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
});

test('worldGenWizard_Hub菜单文案共享_AI勾选只列独有字段的菜单', async () => {
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
  // AI 勾选只列产出独有字段的 Hub 菜单；其余与模组细项重复写同一批字段，不再单列凑数
  const hubSteps = mod.WORLD_GEN_EDITOR_STEPS.filter((s) => s.source === 'hub').map((s) => s.id);
  assert.deepEqual(hubSteps, ['hub:rules', 'hub:book', 'hub:paths']);
});

test('worldGenWizard_第2步须覆盖ModEditorPanel全部可生成Section', async () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const titles = [...panel.matchAll(/<Section\s+g="[^"]+"\s+title="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(titles.length >= 30, `ModEditorPanel Section 过少: ${titles.length}`);
  // 功能注释：创作者页已去掉「功能扩展与皮肤」等开发者 Section；玩法用卡片标题覆盖
  // 开局封面 / 手机应用 / 皮肤美化只给作者在编辑器手改；开场剧情已重回 AI 勾选（生成开场白）
  // 功能注释：经济与收官由「引擎规则与经济」一步覆盖；总养成开关本身不进 AI 清单（子项仍由各步骤生成）
  const skip = new Set(['基本信息', '功能扩展与皮肤', '养成模块', '总养成开关', '开局封面', '手机应用配置', '皮肤美化', '势力', '经济与收官', '日程分类', '玩法数值绑定']);
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
    剧情线: ['主线与目标', '结局与时限'],
    引擎规则: ['引擎规则与经济', '引擎规则（数值）', '底层规则', '引擎规则'],
    已添加的玩法: ['已添加的玩法', '玩法 mod'],
    建角: ['建角'],
    开局资金: ['开局资金', '开局资源'],
    固定账单: ['账单与周期收入', '固定账单'],
    周期收入: ['账单与周期收入', '周期收入'],
    头衔: ['头衔'],
    培训课程: ['培训课程'],
    '打工 · 周末活动': ['打工 · 周末活动'],
    玩法规则: ['玩法规则'],
  };
  const names = new Set(mod.WORLD_GEN_EDITOR_STEPS.map((s) => s.name));
  const covered = (t) => names.has(t) || (alias[t] ?? []).some((a) => names.has(a));
  const missing = titles.filter((t) => !skip.has(t) && !covered(t));
  assert.deepEqual(missing, [], `向导第2步缺少模组编辑器 Section: ${missing.join('、')}`);
});

test('worldGenWizard_主线支线结局合并剧情线后为36项基础11项', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const ids = mod.ALL_WORLD_GEN_EDITOR_STEP_IDS;
  assert.equal(new Set(ids).size, ids.length, '勾选 id 不得重复');
  assert.equal(ids.length, 36);
  assert.equal(mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.length, 11);
  assert.equal(mod.EXTENDED_WORLD_GEN_EDITOR_STEP_IDS.length, 25);
  // 基础默认必须等于分栏里渲染的基础栏
  const tier = mod.groupWorldGenEditorStepsByTier();
  const coreRendered = tier.core.flatMap((g) => g.steps.map((s) => s.id));
  const extRendered = tier.extended.flatMap((g) => g.steps.map((s) => s.id));
  assert.deepEqual([...coreRendered].sort(), [...mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS].sort());
  assert.equal(coreRendered.length + extRendered.length, ids.length);
  // 基础默认 = 基础世界：地点 / 人物 / 世界书 / 建角 / 开局事件等（开场剧情默认不生成）
  for (const id of ['rooms', 'npcs', 'hub:book', 'creation', 'hub:paths', 'fixedEvents', 'prompt', 'travelTime']) {
    assert.ok(mod.isWorldGenCoreStep(id), id);
  }
  assert.equal(mod.isWorldGenCoreStep('opening'), false);
  // 玩法组件、孕育、通告、座驾等扩展默认不勾；开局封面等已移出清单
  for (const id of ['playModInstalls', 'pregnancy', 'gigs', 'cars', 'relations', 'contacts', 'opening']) {
    assert.equal(mod.isWorldGenCoreStep(id), false, id);
  }
  // CG、美化默认项与重复 Hub 菜单不得出现在 AI 勾选里
  for (const id of ['creationPools', 'cover', 'phoneAppsCfg', 'theme', 'hub:cg', 'hub:person', 'hub:map', 'hub:fixed', 'hub:faction', 'hub:beauty', 'hub:nav', 'hub:audio', 'hub:mods', 'hub:engine', 'hub:timeline', 'hub:end']) {
    assert.ok(!ids.includes(id), id);
  }
  assert.ok(ids.includes('opening'), '开场剧情仍保留在编辑器步骤表，但不进默认生成');
  assert.ok(!mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.includes('opening'));
  assert.deepEqual([...mod.WORLD_GEN_NO_AI_BEAUTIFY_STEP_IDS], ['cover', 'phoneAppsCfg', 'theme']);
  assert.ok(!mod.WORLD_GEN_EDITOR_STEPS.some((s) => /开场页外观|粘贴 HTML/.test(s.desc)));
});

test('worldGenWizard_旧草稿下架id映射到现行模组_作者勾选不重选', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);
  const base = { title: 'x', setting: 'y', aiPolish: true, engineId: 'balanced', contentIds: [] };
  const n = mod.normalizeWorldGenStep1({
    ...base,
    editorStepIds: ['hub:person', 'npcs', 'hub:map', 'opening', 'hub:cg', 'hub:faction', 'gigs'],
    scopeVersion: 2,
  });
  // 功能注释：hub 映射保留；opening 默认丢弃；gigs 属扩展玩法须剥掉
  assert.deepEqual(n.editorStepIds, ['rooms', 'npcs', 'hub:paths']);
  // 只勾开场剧情时回落基础默认（opening 已退休）
  const onlyOpening = mod.normalizeWorldGenStep1({ ...base, editorStepIds: ['opening'], scopeVersion: 2 });
  assert.deepEqual(onlyOpening.editorStepIds, [...mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS]);
  // 旧草稿勾过的开局封面 / 手机应用 / 皮肤美化须丢弃；hub:beauty→lookRules 属扩展也剥掉
  const oldBeautify = mod.normalizeWorldGenStep1({
    ...base,
    editorStepIds: ['cover', 'phoneAppsCfg', 'theme', 'hub:beauty', 'npcs'],
    scopeVersion: 2,
  });
  assert.deepEqual(oldBeautify.editorStepIds, ['npcs']);
  // 旧「全选」收束为基础默认
  const legacy = mod.normalizeWorldGenStep1({
    ...base,
    editorStepIds: [...mod.ALL_WORLD_GEN_EDITOR_STEP_IDS, 'opening', 'hub:person', 'hub:cg'],
    scopeVersion: 1,
  });
  assert.deepEqual(legacy.editorStepIds, [...mod.DEFAULT_WORLD_GEN_EDITOR_STEP_IDS]);
});

test('WorldGenWizard_右上角计数按渲染列表算_不用旧常量凑数', () => {
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  // 功能注释：扩展玩法已移出勾选区，计数只剩基础已选/总数，不再展示「基础默认」括号
  assert.match(wiz, /已选 \{selectedCount\}\/\{allCount\}/);
  assert.doesNotMatch(wiz, /基础默认 \{coreCount\}/);
  assert.match(wiz, /tieredModules\.core\.flatMap/);
  assert.doesNotMatch(wiz, /const coreCount = DEFAULT_WORLD_GEN_EDITOR_STEP_IDS\.length/);
  assert.doesNotMatch(wiz, /const allCount = ALL_WORLD_GEN_EDITOR_STEP_IDS\.length/);
  assert.doesNotMatch(wiz, /const selectedCount = selected\.size/);
});

test('WorldGenWizard_作品名称与故事设定须标必填红星_禁止生成不加', () => {
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  const css = readFileSync(join(romance, 'index.css'), 'utf8');
  // 功能注释：仅核心必填两项带 *；与 validateWorldGenStep1 空值文案对齐
  assert.match(
    wiz,
    /作品名称\s*<span className="world-gen-req"[^>]*>\s*\*\s*<\/span>/,
  );
  assert.match(
    wiz,
    /故事设定\s*<span className="world-gen-req"[^>]*>\s*\*\s*<\/span>/,
  );
  assert.match(wiz, /aria-required="true"/);
  assert.match(css, /\.world-gen-req\s*\{[^}]*color:\s*var\(--wg-rose\)/);
  // 禁止生成是可选项，标签旁不得挂必填星
  assert.match(wiz, /<span>禁止生成<\/span>/);
  assert.doesNotMatch(wiz, /禁止生成[\s\S]{0,80}world-gen-req/);
});
