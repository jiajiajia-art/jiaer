/**
 * 前端：公开进入门禁 + Romance 平台本体门禁 + 题材单选
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('resolvePublicListingState_与平台门禁', async () => {
  const mod = await import(pathToFileURL(join(root, 'src/utils/gameListingAccess.ts')).href);
  assert.equal(mod.resolvePublicListingState({ is_public: 1 }).canEnter, true);
  assert.equal(mod.resolvePublicListingState({ is_public: 0, moderation_status: 'pending_review' }).message, '审核中');
  assert.equal(mod.resolvePublicListingState({ is_public: 0, moderation_status: 'rejected' }).message, '未通过');
  assert.equal(mod.shouldGateRomancePlatformShell({ search: '' }), true);
  assert.equal(mod.shouldGateRomancePlatformShell({ search: '?createWorld=1' }), false);
  assert.equal(mod.shouldGateRomancePlatformShell({ search: '?platformTest=1' }), false);
  assert.equal(mod.shouldGateRomancePlatformShell({ search: '', isStaff: true }), false);
  assert.equal(mod.shouldGateRomancePlatformShell({ search: '', isAuthorPreview: true }), false);
});

test('Romance_App_玩家访问平台本体应出门禁', () => {
  const app = readFileSync(join(romance, 'App.tsx'), 'utf8');
  const gate = readFileSync(join(romance, 'components/PlatformShellGate.tsx'), 'utf8');
  const lib = readFileSync(join(romance, 'lib/platformShellGate.ts'), 'utf8');
  assert.match(app, /PlatformShellGate/);
  assert.match(app, /shouldGateRomancePlatformShell/);
  assert.match(gate, /全部作品/);
  assert.match(gate, /data-romance-platform-gate/);
  assert.match(lib, /platformTest/);
  assert.match(lib, /createWorld/);
});

test('GameDetail_非在架应只显示说明', () => {
  const src = readFileSync(join(root, 'src/page/GameDetail.tsx'), 'utf8');
  assert.match(src, /resolvePublicListingState/);
  assert.match(src, /listingState\.canEnter/);
  assert.match(src, /data-listing-gate/);
  assert.match(src, /全部作品/);
});

test('WorldPanel_题材单选与停用展示', () => {
  const panel = readFileSync(join(root, 'src/components/GameSettingEditor/WorldPanel/WorldPanel.tsx'), 'utf8');
  const form = readFileSync(join(root, 'src/components/GameSettingEditor/WorldPanel/WorldSettingForm.tsx'), 'utf8');
  const edit = readFileSync(join(root, 'src/utils/novelEdit.ts'), 'utf8');
  assert.match(edit, /THEME_TAG_MAX = 1/);
  assert.match(edit, /validateEnabledThemeTagSelection/);
  assert.match(panel, /disabledSelectedThemeTagIds/);
  assert.match(panel, /themeTagDisabled/);
  assert.match(form, /已停用/);
});

test('AdminPanel_题材停用启用', () => {
  const src = readFileSync(join(root, 'src/page/AdminPanel.tsx'), 'utf8');
  assert.match(src, /handleEnableThemeTag/);
  assert.match(src, /重新启用/);
  assert.match(src, /不会自动下架/);
});
