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

test('Navbar_手机用户菜单含仓库入口在个人中心下', () => {
  const src = readFileSync(join(root, 'src/components/Layout/Navbar.tsx'), 'utf8');
  assert.match(src, /nav\.profile[\s\S]*!isDesktopLayout[\s\S]*nav\.warehouse[\s\S]*nav\.favorites/);
});
