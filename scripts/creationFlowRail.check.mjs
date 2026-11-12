/**
 * 创作流程顶栏进度轨：按 activePanel 高亮当前步
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('CreationFlowRail_按面板映射六步并高亮当前', () => {
  const src = readFileSync(
    join(root, 'src/components/GameSettingEditor/CreationFlowRail.tsx'),
    'utf8',
  );
  assert.match(src, /flowStepUpload/);
  assert.match(src, /flowStepDatabase/);
  assert.match(src, /isWorldBookActive/);
  assert.match(src, /aria-current/);
});

test('GameSettingsEditor_使用CreationFlowRail替代纯文案step1Tip', () => {
  const src = readFileSync(join(root, 'src/page/GameSettingsEditor.tsx'), 'utf8');
  assert.match(src, /CreationFlowRail/);
  assert.doesNotMatch(src, /createGame\.step1Tip/);
});

test('GameSettingsEditor_创作壳应对齐funloom暗色', () => {
  const editorCss = readFileSync(join(root, 'src/page/GameSettingsEditor.module.css'), 'utf8');
  const sidebarCss = readFileSync(join(root, 'src/components/GameSettingEditor/Sidebar.module.css'), 'utf8');
  const railCss = readFileSync(join(root, 'src/components/GameSettingEditor/CreationFlowRail.module.css'), 'utf8');
  const worldCss = readFileSync(join(root, 'src/components/GameSettingEditor/WorldPanel/WorldPanel.module.css'), 'utf8');
  const docsCss = readFileSync(join(root, 'src/components/GameSettingEditor/DocumentUpload/DocumentsPanel.module.css'), 'utf8');
  assert.match(editorCss, /--editor-bg:\s*(?:#000000|var\(--|color-mix\()/);
  assert.match(editorCss, /--primary-dark:\s*(?:#8E2135|var\(--|color-mix\()/);
  assert.doesNotMatch(editorCss, /background:\s*#FAFBFC/);
  // 功能注释：顶栏改 CSS Grid，窄屏 titles→rail→actions，row-gap 8px 贴紧
  assert.match(editorCss, /\.topBar\s*\{[\s\S]*?display:\s*grid/);
  assert.match(editorCss, /\.topBar\s*\{[\s\S]*?row-gap:\s*8px/);
  assert.match(editorCss, /\.topBarRail\s*\{[\s\S]*?grid-area:\s*rail/);
  assert.match(editorCss, /@media \(max-width: 720px\)[\s\S]*?grid-template-areas:[\s\S]*?"rail"[\s\S]*?"actions"/);
  assert.match(editorCss, /@media \(max-width: 720px\)[\s\S]*?\.main\s*\{[\s\S]*?gap:\s*10px/);
  /* 功能注释：主栏竖向叠卡 16/12，禁止落地页式 40+28 空洞 */
  assert.match(editorCss, /\.main\s*\{[\s\S]*?padding:\s*16px 48px 32px/);
  assert.match(editorCss, /\.main\s*\{[\s\S]*?gap:\s*12px/);
  assert.doesNotMatch(editorCss, /\.main\s*\{[\s\S]*?padding:\s*40px 56px/);
  const editorTsxForTop = readFileSync(join(root, 'src/page/GameSettingsEditor.tsx'), 'utf8');
  assert.match(editorTsxForTop, /styles\.topBarRail/);
  assert.match(editorTsxForTop, /styles\.topBarTitles/);
  assert.doesNotMatch(editorTsxForTop, /styles\.topBarLead/);
  assert.match(editorTsxForTop, /CreationCircleNav/);
  assert.match(editorTsxForTop, /txtCreatePageTitle/);
  assert.match(editorTsxForTop, /styles\.editorNavbar/);
  assert.match(editorTsxForTop, /<Navbar\s*\/>/);
  assert.match(editorCss, /\.editorNavbar\s*\{[\s\S]*?display:\s*none/);
  assert.match(editorCss, /@media \(max-width:\s*768px\)[\s\S]*?\.editorNavbar\s*\{[\s\S]*?display:\s*block/);
  assert.match(editorCss, /\.appShell\s*\{[\s\S]*?margin-top:\s*0/);
  assert.match(editorCss, /@media \(max-width:\s*768px\)[\s\S]*?\.appShell\s*\{[\s\S]*?margin-top:\s*var\(--app-desktop-navbar-height\)/);
  const circleNavCss = readFileSync(join(root, 'src/components/GameSettingEditor/CreationCircleNav.module.css'), 'utf8');
  assert.match(circleNavCss, /\.iconWrap\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(circleNavCss, /--circle-nav-idle-bg:\s*(?:#1a1a1a|var\(--|color-mix\()/i);
  assert.match(circleNavCss, /--circle-nav-accent:\s*(?:#d8315b|var\(--|color-mix\()/i);
  assert.match(circleNavCss, /\.iconWrap\s*\{[\s\S]*?box-shadow:\s*var\(--circle-nav-rim\)/);
  assert.match(circleNavCss, /\.itemActive \.iconWrap\s*\{[\s\S]*?background:\s*var\(--circle-nav-accent\)/);
  assert.doesNotMatch(circleNavCss, /\.iconWrap\s*\{[\s\S]*?border-radius:\s*50%/);
  assert.doesNotMatch(circleNavCss, /\.iconWrap\s*\{[\s\S]*?color:\s*#9A9A9E/);
  assert.match(docsCss, /\.createMethodBlock/);
  assert.match(docsCss, /\.createMethodSelect/);
  assert.match(docsCss, /\.createMethodTrigger/);
  assert.match(docsCss, /\.createMethodMenu/);
  assert.match(docsCss, /\.createMethodOptionSelected\s*\{[\s\S]*?(?:#ffb3bf|rgba\(168,\s*40,\s*60|var\(--|color-mix\()/);
  assert.doesNotMatch(docsCss, /\.createMethodSelectInput/);
  assert.match(docsCss, /data-create-method='idea'[\s\S]*?\.documentMethodPanel/);
  assert.match(docsCss, /data-create-method='document'[\s\S]*?\.ideaMethodPanel/);
  const docsTsx = readFileSync(join(root, 'src/components/GameSettingEditor/DocumentUpload/DocumentsPanel.tsx'), 'utf8');
  assert.match(docsTsx, /createMethod/);
  assert.match(docsTsx, /aiGenerateFromIdea/);
  assert.match(docsTsx, /createMethodMenu/);
  assert.match(docsTsx, /IoChevronDown/);
  assert.doesNotMatch(docsTsx, /<select[\s\S]*createMethod/);
  assert.doesNotMatch(docsTsx, /generateFromIdeaCard\} \$\{styles\.hideOnMobile\}/);
  assert.match(sidebarCss, /\.sidebar\s*\{[\s\S]*?background:\s*(?:#0A0A0A|#000000|var\(--|color-mix\()/);
  assert.doesNotMatch(sidebarCss, /background:\s*#ffffff/);
  assert.match(railCss, /\.active\s+\.index\s*\{[\s\S]*?background:\s*(?:#8E2135|var\(--|color-mix\()/);
  assert.match(worldCss, /\.formContainer\s*\{[\s\S]*?background:\s*(?:#1A1A1A|var\(--|color-mix\()/);
  assert.match(worldCss, /\.detailBlock\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(worldCss, /\.themeTagChip\s*\{[\s\S]*?background:\s*(?:#1C1C1E|var\(--|color-mix\()/);
  assert.match(worldCss, /\.themeTagChip\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(worldCss, /\.themeTagChip\s*\{[\s\S]*?border-radius:\s*14px/);
  assert.doesNotMatch(worldCss, /\.themeTagChip\s*\{[^}]*border-radius:\s*999px/);
  assert.match(worldCss, /\.themeTagChipActive\s*\{[\s\S]*?background:\s*(?:#8E2135|var\(--|color-mix\()/);
  assert.match(worldCss, /\.themeTagsWrap\s*\{[\s\S]*?repeat\(6,/);
  assert.match(worldCss, /@media \(max-width:\s*720px\)[\s\S]*?\.themeTagsWrap\s*\{[\s\S]*?repeat\(3,/);
  const worldFormTsx = readFileSync(join(root, 'src/components/GameSettingEditor/WorldPanel/WorldSettingForm.tsx'), 'utf8');
  assert.match(worldFormTsx, /fieldHeader[\s\S]*createGame\.gameTags/);
  assert.match(worldFormTsx, /fieldHeader[\s\S]*createGame\.playerIdentity/);
  const zhWorld = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');
  const enWorld = readFileSync(join(root, 'src/i18n/locales/en.json'), 'utf8');
  /* 功能注释：说明里不要再写「拆成两栏」，手机已是单列 */
  assert.doesNotMatch(zhWorld, /"worldBackgroundDescription":\s*"拆成两栏/);
  assert.doesNotMatch(enWorld, /"worldBackgroundDescription":\s*"Split into two fields/);
  assert.match(zhWorld, /"worldBackgroundDescription":\s*"世界观管「世界怎么运转」/);
  assert.doesNotMatch(worldCss, /\.detailBlock\s*\{[^}]*background:\s*#1C1C1E/);
  /* 功能注释：手机每个分区独立成卡，外框变透明以免套娃 */
  assert.match(worldCss, /@media \(max-width:\s*720px\)[\s\S]*?\.formContainer\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(worldCss, /@media \(max-width:\s*720px\)[\s\S]*?\.detailBlock[\s\S]*?background:\s*(?:#1A1A1A|var\(--|color-mix\()/);
  assert.match(worldCss, /@media \(max-width:\s*720px\)[\s\S]*?\.storylineSection[\s\S]*?background:\s*(?:#1A1A1A|var\(--|color-mix\()/);
  assert.match(worldCss, /@media \(max-width:\s*720px\)[\s\S]*?\.formBody\s*\{[\s\S]*?gap:\s*12px/);
  const worldTsx = readFileSync(join(root, 'src/components/GameSettingEditor/WorldPanel/WorldPanel.tsx'), 'utf8');
  assert.doesNotMatch(worldTsx, /styles\.cardHead/);
  assert.match(docsCss, /\.card\s*\{[\s\S]*?background:\s*(?:#1A1A1A|var\(--|color-mix\()/);
  // AI 一句话：两枚 CTA 左右并排，禁止再纵向堆叠
  assert.match(docsCss, /\.generateFromIdeaActions\s*\{[\s\S]*?flex-direction:\s*row/);
  assert.doesNotMatch(docsCss, /\.generateFromIdeaActions\s*\{[^}]*flex-direction:\s*column/);
  /* 功能注释：手机端 ✨ 作右上角背景水印，避免图标挤左上跑偏 */
  assert.match(
    docsCss,
    /@media \(max-width:\s*768px\)[\s\S]*?\.ideaMethodPanel \.generateFromIdeaIcon\s*\{[\s\S]*?position:\s*absolute/,
  );
  assert.match(
    docsCss,
    /@media \(max-width:\s*768px\)[\s\S]*?\.ideaMethodPanel \.generateFromIdeaIcon\s*\{[\s\S]*?right:\s*12px/,
  );
  // 创建空游戏 / AI 弹窗对齐暗色壳，禁止白底
  const emptyModalCss = readFileSync(join(root, 'src/components/GameSettingEditor/DocumentUpload/CreateEmptyGameModal.module.css'), 'utf8');
  assert.match(emptyModalCss, /\.modal\s*\{[\s\S]*?background:\s*(?:#1A1A1A|var\(--|color-mix\()/);
  assert.match(emptyModalCss, /\.input\s*\{[\s\S]*?background:\s*(?:#1C1C1E|var\(--|color-mix\()/);
  assert.match(emptyModalCss, /\.submitButton\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(emptyModalCss, /\.submitButton\s*\{[\s\S]*?background-color:\s*(?:#8E2135|var\(--|color-mix\()/);
  assert.doesNotMatch(emptyModalCss, /\.modal\s*\{[^}]*background:\s*white/);
  assert.match(emptyModalCss, /\.modalOverlay\s*\{[\s\S]*?align-items:\s*center/);
  assert.doesNotMatch(emptyModalCss, /align-self:\s*flex-end/);
  const charsCss = readFileSync(join(root, 'src/components/GameSettingEditor/CharactersPanel/CharactersPanel.module.css'), 'utf8');
  const scenesCss = readFileSync(join(root, 'src/components/GameSettingEditor/ScenesPanel/ScenesPanel.module.css'), 'utf8');
  assert.match(charsCss, /#1A1A1A|#1C1C1E/);
  assert.match(charsCss, /\.portraitLarge\s*\{[\s\S]*?height:\s*480px/);
  assert.match(charsCss, /\.portraitLarge\s*\{[\s\S]*?background-color:\s*(?:#c8c8c8|var\(--|color-mix\()/);
  assert.match(charsCss, /\.detailActionRow\s*\{[\s\S]*?margin-bottom:\s*0/);
  const charsTsx = readFileSync(join(root, 'src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx'), 'utf8');
  /* 功能注释：「立绘大小预览」已恢复，并可退出预览 */
  assert.match(charsTsx, /isPreviewMode \? t\('createGame\.exitPreview'\) : t\('createGame\.portraitSizePreview'\)/);
  assert.match(charsTsx, /confirmEdit/);
  assert.match(charsCss, /\.portraitImageActions\s*\{[\s\S]*?margin-top:\s*6px/);
  assert.doesNotMatch(charsCss, /\.portraitLarge\s*\{[^}]*height:\s*320px/);
  // 操作条：积分胶囊与一键生成 CTA、新增角色均用 999px 胶囊圆角
  assert.match(charsCss, /\.ghost\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(charsCss, /\.ghostSmall\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(scenesCss, /\.ghost\s*\{[\s\S]*?border-radius:\s*999px/);
  const actionBarCss = readFileSync(join(root, 'src/components/GameSettingEditor/GenerationActionBar.module.css'), 'utf8');
  assert.match(actionBarCss, /\.pointsPill\s*\{[\s\S]*?border-radius:\s*999px/);
  // 世界观：输出字数居中 + 故事线/文风设置行手风琴；底部步进胶囊
  assert.match(worldCss, /\.sectionTitleCentered/);
  assert.match(worldCss, /\.accordionTrigger\s*\{[\s\S]*?justify-content:\s*space-between/);
  assert.match(worldCss, /\.outputLengthGrid input\s*\{[\s\S]*?border-radius:\s*8px/);
  const storylinesTsx = readFileSync(join(root, 'src/components/GameSettingEditor/WorldPanel/StorylinesSection.tsx'), 'utf8');
  assert.match(storylinesTsx, /accordionTrigger/);
  assert.doesNotMatch(storylinesTsx, /storylineHeader/);
  const stepFooterCss = readFileSync(join(root, 'src/components/GameSettingEditor/CreationStepFooter.module.css'), 'utf8');
  assert.match(stepFooterCss, /\.prev,\s*\n\s*\.next\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(stepFooterCss, /\.next\s*\{[\s\S]*?background:\s*(?:#8E2135|var\(--|color-mix\()/);
  const editorTsx = readFileSync(join(root, 'src/page/GameSettingsEditor.tsx'), 'utf8');
  assert.match(editorTsx, /CreationStepFooter/);
  const charsSidebarCss = readFileSync(join(root, 'src/components/GameSettingEditor/CharactersPanel/CharactersSidebar.module.css'), 'utf8');
  assert.match(charsSidebarCss, /\.sidebarHeader\s*\{[\s\S]*?margin-bottom:\s*7px/);
  assert.match(scenesCss, /(?:#1A1A1A|#1C1C1E|var\(--|color-mix\()/);
  assert.doesNotMatch(charsCss, /\.card\s*\{[^}]*background:\s*#fff(?:fff)?\b/);
});
