/**
 * 角色档案 / 玩家档案导入须按 cardKind 分割（人设卡 ≠ 角色卡）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('CharactersPanel_导入角色档案只拉kind=npc', () => {
  const src = readFileSync(
    join(root, 'src/components/Galgame/panels/CharactersPanel.tsx'),
    'utf8',
  );
  assert.match(src, /playerCharacterCardsApi\.list\(\s*token\s*,\s*\{\s*kind:\s*'npc'\s*\}\s*\)/);
  assert.match(src, /cardKind === 'player'/);
  assert.doesNotMatch(
    src,
    /playerCharacterCardsApi\.list\(\s*token\s*\)\s*;/,
  );
  assert.match(src, /可直接保存/);
  assert.doesNotMatch(src, /请生成头像后保存/);
});

test('CharactersPanel_卡库导入列表须有立绘预览', () => {
  const src = readFileSync(
    join(root, 'src/components/Galgame/panels/CharactersPanel.tsx'),
    'utf8',
  );
  const css = readFileSync(
    join(root, 'src/components/Galgame/panels/PlayPanelShell.module.css'),
    'utf8',
  );
  assert.match(src, /card\.avatarUrl/);
  assert.match(src, /importPortrait/);
  assert.match(src, /TrimmedTransparentImg/);
  assert.match(src, /variant="bust"/);
  assert.match(src, /importPortraitSeal/);
  assert.match(src, /importGenderSeal/);
  assert.match(src, /importName/);
  assert.match(src, /importSearchWrap/);
  assert.doesNotMatch(src, /\$\{shell\.card\} \$\{shell\.importCard\}/);
  assert.match(css, /\.importPortrait\s*\{/);
  assert.match(css, /grid-template-columns:\s*6\.8rem/);
  assert.match(css, /--import-display/);
  assert.match(css, /\.importGenderSeal\s*\{/);
  assert.doesNotMatch(css, /\.importPortrait::after/);
  const imgBlock = css.match(/\.importPortraitImg\s*\{[^}]+\}/)?.[0] || '';
  assert.match(imgBlock, /object-fit:\s*contain/);
  assert.doesNotMatch(imgBlock, /object-fit:\s*cover/);
});

test('PlayerArchiveSection_导入人设只拉kind=player', () => {
  const src = readFileSync(
    join(root, 'src/components/Galgame/panels/PlayerArchiveSection.tsx'),
    'utf8',
  );
  assert.match(src, /playerCharacterCardsApi\.list\(\s*authUser\.token\s*,\s*\{\s*kind:\s*'player'\s*\}\s*\)/);
  assert.match(src, /cardKind === 'npc'/);
  assert.doesNotMatch(
    src,
    /playerCharacterCardsApi\.list\(\s*authUser\.token\s*,\s*''\s*\)/,
  );
});

test('CharacterProfileForm_无头像也可保存', () => {
  const src = readFileSync(
    join(root, 'src/components/Galgame/panels/CharacterProfileForm.tsx'),
    'utf8',
  );
  assert.doesNotMatch(src, /if\s*\(\s*!values\.avatarUrl\.trim\(\)\s*\)\s*\{\s*toast\.error\('请先生成角色头像'/);
  assert.match(src, /头像可稍后/);
});

test('CharacterProfileForm_头像确认含风格选择与外貌补充_无英文只读底稿', () => {
  const src = readFileSync(
    join(root, 'src/components/Galgame/panels/CharacterProfileForm.tsx'),
    'utf8',
  );
  assert.match(src, /画风与提示词/);
  assert.match(src, /风格选择/);
  assert.match(src, /外貌补充（可选）/);
  assert.match(src, /AVATAR_STYLE_OPTIONS/);
  assert.match(src, /avatarStyle/);
  assert.doesNotMatch(src, /当前提示词/);
  assert.doesNotMatch(src, /补充描述/);
  assert.doesNotMatch(src, /promptCueReadonly/);
  assert.doesNotMatch(src, /buildSessionNpcAvatarPrompt/);
});

test('Navbar_手机用户菜单含仓库入口在个人中心下', () => {
  const src = readFileSync(join(root, 'src/components/Layout/Navbar.tsx'), 'utf8');
  assert.match(src, /nav\.profile[\s\S]*!isDesktopLayout[\s\S]*nav\.warehouse[\s\S]*nav\.favorites/);
});

test('Navbar_小程序web-view点击头像也要弹出用户菜单', () => {
  const src = readFileSync(join(root, 'src/components/Layout/Navbar.tsx'), 'utf8');
  assert.match(src, /小程序 web-view 也要下拉菜单/);
  assert.match(src, /setShowUserMenu\(\(prev\) => !prev\)/);
  assert.doesNotMatch(
    src,
    /onClick=\{\(\) => \{\s*if \(isWebViewEnv\(\)\) return;/,
    '头像点击不得在 miniprogram 里直接 return',
  );
  assert.doesNotMatch(
    src,
    /showUserMenu && !isWebViewEnv\(\)/,
    '用户菜单不得因 miniprogram 被隐藏',
  );
  assert.match(src, /touchstart/);
});
