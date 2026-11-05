import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('avatarLibrary_标签与匹配文案与后端对齐', async () => {
  const mod = await import(join(root, 'src/lib/galgame/avatarLibrary.ts'));
  assert.deepEqual(
    mod.AVATAR_AGE_GROUPS.map((x) => x.id),
    ['child', 'adult', 'elder'],
  );
  assert.deepEqual(
    mod.AVATAR_BACKGROUNDS.map((x) => x.id),
    ['ancient', 'modern', 'fantasy'],
  );
  assert.deepEqual(
    mod.AVATAR_ASSET_GENDERS.map((x) => x.id),
    ['male', 'female', 'universal'],
  );
  assert.equal(mod.avatarAgeLabel('adult'), '成人');
  assert.equal(mod.avatarBackgroundLabel('ancient'), '古代');
  assert.equal(mod.avatarGenderLabel('universal'), '通用');
  assert.match(mod.describeAvatarMatchPriority(), /手动锁定.*剧本.*系统/);
  assert.equal(
    mod.tagOptionsToSeg(
      [{ id: 'teen', dimension: 'age_group', label: '少年', status: 'active' }],
      'age_group',
      mod.AVATAR_AGE_GROUPS,
    )[0].id,
    'teen',
  );
});

test('avatarLibrary_正方形准备与底色', async () => {
  const mod = await import(join(root, 'src/lib/galgame/squareAvatarPrep.ts'));
  assert.equal(mod.SQUARE_AVATAR_FILL, '#1c1c1e');
  assert.equal(mod.SQUARE_AVATAR_MIN_SIDE, 256);
  assert.equal(mod.SQUARE_AVATAR_TARGET_SIDE, 512);
  assert.equal(mod.isApproxSquare(512, 512), true);
  assert.equal(mod.isApproxSquare(512, 400), false);
  assert.ok(mod.assertMinSide(200, 200));
  assert.equal(mod.assertMinSide(300, 300), null);
  assert.equal(mod.isAnimatedGifFile(new File([], 'a.gif', { type: 'image/gif' })), true);
  assert.equal(mod.isAllowedAvatarUploadFile(new File([], 'a.png', { type: 'image/png' })), true);
  const file = new File([], 'x.jpg', { type: 'image/jpeg' });
  assert.equal(mod.classifyAvatarBatchImage(512, 512, file).status, 'pass');
  assert.equal(mod.classifyAvatarBatchImage(800, 450, file).status, 'need_crop');
  assert.equal(mod.classifyAvatarBatchImage(200, 200, file).status, 'invalid');
  assert.equal(mod.classifyAvatarBatchImage(200, 400, file).status, 'invalid');
});

test('avatarLibrary_API与导航管理运营页已挂载', () => {
  const api = readFileSync(join(root, 'src/api/galgame/avatarLibrary.ts'), 'utf8');
  const nav = readFileSync(join(root, 'src/page/warehouse/warehouseNav.ts'), 'utf8');
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  const page = readFileSync(join(root, 'src/page/warehouse/WarehouseAvatarLibrary.tsx'), 'utf8');
  const admin = readFileSync(join(root, 'src/page/AdminPanel.tsx'), 'utf8');
  const operator = readFileSync(join(root, 'src/page/operator/OperatorPanel.tsx'), 'utf8');
  const adminMgr = readFileSync(join(root, 'src/components/admin/AdminPublicAvatarManager.tsx'), 'utf8');
  const cropGate = readFileSync(join(root, 'src/components/Avatar/SquareAvatarCropGate.tsx'), 'utf8');
  const frame = readFileSync(join(root, 'src/components/Avatar/AvatarFrame.tsx'), 'utf8');
  const cropModal = readFileSync(join(root, 'src/components/CommonModal/ImageCropModal.tsx'), 'utf8');
  const hook = readFileSync(join(root, 'src/hooks/useAvatarTagOptions.ts'), 'utf8');

  assert.match(api, /\/api\/avatar-library\/match/);
  assert.match(api, /\/api\/avatar-library\/tag-options/);
  assert.match(api, /\/api\/avatar-library\/albums/);
  assert.match(api, /\/api\/avatar-library\/match-prefs/);
  assert.match(api, /excludeUrls/);
  assert.match(api, /delist/);
  assert.match(api, /kind/);
  assert.match(api, /crop/);
  assert.match(api, /albumId/);
  assert.match(hook, /listTagOptions/);
  assert.match(hook, /invalidateAvatarTagOptionsCache|cache/);
  assert.match(nav, /path:\s*'\/warehouse\/avatars'/);
  assert.match(nav, /头像库/);
  assert.match(app, /WarehouseAvatarLibrary/);
  assert.match(app, /path="avatars"/);
  assert.match(app, /\/admin\/avatars/);
  assert.match(app, /\/operator\/avatars/);
  assert.match(page, /SquareAvatarCropGate/);
  assert.match(page, /AvatarFrame/);
  assert.match(page, /保留已绑定/);
  assert.match(page, /SegOptions|segRowCompact|avatarLibChip|role="radiogroup"/);
  assert.match(page, /avatarLibScopeTrack/);
  assert.match(page, /AVATAR_ASSET_GENDERS|universal/);
  // 匹配优先级已迁到剧本编辑器①基础；仓库页不得再提供全局「匹配设置」
  assert.doesNotMatch(page, /匹配设置|匹配优先级已保存|prefsOpen|allowUniversalFallback/);
  assert.match(page, /avatarAlbumCard|打开头像库/);
  assert.match(page, /上移相册顺序|下移相册顺序/);
  assert.match(api, /sourceOrder|allowUniversalFallback/);
  // 上传元数据须进弹窗，禁止与列表筛选并排常驻；弹窗对齐暗色确认层语言
  assert.match(page, /上传头像/);
  assert.match(page, /uploadOpen|avatarLibModal/);
  assert.match(page, /avatarLibModalPrimary|avatarLibModalCloseIcon/);
  assert.doesNotMatch(page, /上传·性别/);
  assert.doesNotMatch(page, /window\.prompt|window\.confirm|alert\(/);
  const warehouseCss = readFileSync(join(root, 'src/page/warehouse/WarehousePanel.module.css'), 'utf8');
  assert.match(warehouseCss, /--avm-coral/);
  assert.match(warehouseCss, /backdrop-filter:\s*blur\(47px\)/);
  assert.match(warehouseCss, /avatarLibModalPrimary/);
  assert.match(warehouseCss, /avatarAlbumCard/);
  assert.doesNotMatch(page, /<select[\s>]/);
  assert.doesNotMatch(page, /className=\{scope === s \? panel\.segActive : panel\.seg\}/);
  assert.match(adminMgr, /SegOptions|segRow/);
  assert.match(adminMgr, /AdminTagOptionsEditor|标签选项/);
  assert.match(adminMgr, /AVATAR_ASSET_GENDERS/);
  assert.doesNotMatch(adminMgr, /window\.prompt|window\.confirm|alert\(/);
  assert.doesNotMatch(adminMgr, /<select[\s>]/);
  // 管理端公共头像须用暖色浅底卡片分区，禁止整页暗色胶囊栈
  const adminMgrCss = readFileSync(join(root, 'src/components/admin/AdminPublicAvatarManager.module.css'), 'utf8');
  assert.match(adminMgrCss, /--av-surface/);
  assert.match(adminMgrCss, /\.panel\s*\{/);
  assert.match(adminMgrCss, /\.uploadForm\s*\{/);
  assert.match(adminMgrCss, /\.titleInput\s*\{/);
  assert.match(adminMgrCss, /height:\s*40px/);
  assert.match(adminMgrCss, /\.tagEditor|\.tagRow/);
  assert.doesNotMatch(adminMgrCss, /\.root\s*\{[^}]*color:\s*#fff/);
  assert.doesNotMatch(adminMgrCss, /\.segRow\s*\{[^}]*background:\s*#121212/);
  assert.match(adminMgr, /uploadForm|titleInput/);
  assert.doesNotMatch(adminMgr, /styles\.grow/);
  // 功能注释：侧栏文案在 AdminShell 导航配置，面板只挂载管理组件
  const shellNav = readFileSync(join(root, 'src/components/admin-shell/adminNavigation.tsx'), 'utf8');
  assert.match(shellNav, /label: '公共头像'/);
  assert.match(admin, /AdminPublicAvatarManager/);
  assert.match(operator, /AdminPublicAvatarManager/);
  assert.match(adminMgr, /uploadKind/);
  assert.match(adminMgr, /user-uploads/);
  assert.match(adminMgr, /delist/);
  assert.match(cropGate, /exportCropMetaOnly/);
  assert.match(cropGate, /#1c1c1e|SQUARE_AVATAR_FILL/);
  assert.match(cropGate, /useImperativeHandle|SquareAvatarCropGateHandle/);
  assert.match(cropGate, /openFile/);
  // 管理端批量：看板分类 + 需裁切强制不可关闭
  assert.match(adminMgr, /cropGateRef|batchBoard|classifyAvatarBatchImage/);
  assert.match(adminMgr, /批量上传看板/);
  assert.match(adminMgr, /forceCrop|allowClose:\s*!forceCrop/);
  assert.match(adminMgr, /batchSaveBtn|>保存</);
  // 裁切成功后看板须改「正常」并替换成片预览，禁止仍显示需裁切+旧图
  assert.match(adminMgr, /label:\s*'正常'/);
  assert.match(adminMgr, /badgeText|phase === 'done' \? '正常'/);
  // portal 看板须自带色板，禁止白字叠白底
  assert.match(adminMgrCss, /--bb-ink/);
  assert.match(adminMgrCss, /\.batchOverlay\s*\{/);
  assert.match(adminMgrCss, /batchCardShade|batchCardCta/);
  assert.match(adminMgr, /batchGhostBtn|batchCardInfo/);
  assert.doesNotMatch(adminMgr, /openBatchHead|请继续点「上传」逐张处理/);
  assert.doesNotMatch(adminMgr, /disabled=\{uploading \|\| batchQueue\.length > 0\}/);
  assert.match(cropGate, /buttonDisabled/);
  assert.match(cropGate, /forceCrop|allowClose/);
  assert.match(cropGate, /previewBlob/);
  assert.match(cropGate, /绝不看 disabled/);
  assert.doesNotMatch(cropGate, /if \(!file \|\| disabled\) return/);
  assert.match(adminMgr, /previewBlob|boardPreviewUrl|1:1 成片|1:1 预览/);
  assert.match(cropModal, /allowClose/);
  assert.match(cropModal, /非 1:1 须完成裁切/);
  assert.match(frame, /rounded/);
  assert.match(frame, /circle/);
  assert.match(cropModal, /exportCropMetaOnly/);
  assert.match(cropModal, /onCropMetaComplete/);
});

test('avatarLibrary_人设卡与角色卡自动匹配与锁定', () => {
  const persona = readFileSync(join(root, 'src/page/warehouse/WarehousePersonaCards.tsx'), 'utf8');
  const npc = readFileSync(join(root, 'src/page/warehouse/WarehouseCharacterCards.tsx'), 'utf8');
  const types = readFileSync(join(root, 'src/lib/galgame/playerCharacterCard.ts'), 'utf8');

  for (const src of [persona, npc]) {
    assert.match(src, /tryAutoMatchAvatar/);
    assert.match(src, /avatarLibraryApi\.match/);
    assert.match(src, /avatarLocked:\s*true/);
    assert.match(src, /ageGroup:\s*draft\.ageGroup/);
    assert.match(src, /backgroundType:\s*draft\.backgroundType/);
    assert.match(src, /useAvatarTagOptions/);
    assert.match(src, /ageOptions|backgroundOptions/);
    assert.match(src, /已手动选定头像/);
    assert.doesNotMatch(src, /onAvatarUrl=\{\(url\) => setDraft\(\(d\) => \(\{ \.\.\.d, avatarUrl: url \}\)\)\}/);
  }
  assert.match(types, /avatarLocked\?:/);
  assert.match(types, /ageGroup\?:/);
  assert.match(types, /backgroundType\?:/);
  // 人设 AI 生成只改文案，不得清头像锁
  assert.match(persona, /persona:\s*/);
  assert.doesNotMatch(persona, /generatePersona[\s\S]{0,400}avatarLocked:\s*false/);
  assert.doesNotMatch(npc, /generatePersona[\s\S]{0,400}avatarLocked:\s*false/);
});
