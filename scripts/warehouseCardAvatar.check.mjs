import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('warehouseCardAvatar_前后端约束一致500KB宽800', async () => {
  const mod = await import(join(root, 'src/lib/warehouse/warehouseCardAvatar.ts'));
  assert.equal(mod.WAREHOUSE_CARD_AVATAR_MAX_BYTES, 500 * 1024);
  assert.equal(mod.WAREHOUSE_CARD_AVATAR_MAX_WIDTH, 800);
  assert.equal(mod.WAREHOUSE_CARD_AVATAR_FORMAT, 'webp');
  assert.match(mod.warehouseCardAvatarConstraintHint(), /500KB/);
  assert.match(mod.warehouseCardAvatarConstraintHint(), /800/);
});

test('warehouseCardAvatar_编辑表单有生图入口', () => {
  const api = readFileSync(join(root, 'src/api/galgame/playerCharacterCards.ts'), 'utf8');
  const persona = readFileSync(join(root, 'src/page/warehouse/WarehousePersonaCards.tsx'), 'utf8');
  const npc = readFileSync(join(root, 'src/page/warehouse/WarehouseCharacterCards.tsx'), 'utf8');
  const field = readFileSync(join(root, 'src/page/warehouse/WarehouseCardAvatarField.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/page/warehouse/WarehousePanel.module.css'), 'utf8');
  assert.match(api, /player-character-cards\/avatar/);
  assert.match(api, /generateAvatar/);
  assert.match(api, /avatarStyle\?:/);
  assert.match(api, /uploadAvatar/);
  assert.match(persona, /WarehouseAvatarGenerateConfirm/);
  assert.match(npc, /WarehouseAvatarGenerateConfirm/);
  assert.match(persona, /avatarStyle:\s*opts\?\.avatarStyleId/);
  assert.match(npc, /avatarStyle:\s*opts\?\.avatarStyleId/);
  assert.match(persona, /promptSupplement:\s*opts\?\.promptSupplement/);
  assert.match(api, /avatar\/upload/);
  assert.match(persona, /WarehouseCardAvatarField/);
  assert.match(persona, /startWarehouseCardAvatarBackgroundGen/);
  assert.match(persona, /onAvatarUrl/);
  assert.match(npc, /WarehouseCardAvatarField/);
  assert.match(npc, /cardKind:\s*'npc'/);
  assert.match(npc, /onAvatarUrl/);
  assert.match(field, /AI 生成图像|重新生成图像|后台生成中/);
  assert.match(field, /上传图片/);
  assert.match(field, /compressImageFileToWebpUnderMaxBytes/);
  assert.match(field, /PLAYER_UPLOAD_AVATAR_MAX_BYTES/);
  assert.match(field, /avatarIdentityRow|avatarAside/);
  assert.match(field, /children/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /object-position:\s*bottom center/);
  assert.match(css, /\.avatarIdentityRow\s*\{/);
  assert.match(css, /\.avatarPreviewHasImage/);
  assert.match(css, /\.formBody[\s\S]*?min-height:\s*0/);
  assert.match(css, /\.formBody[\s\S]*?overflow-y:\s*scroll/);
  assert.match(css, /\.formBody[\s\S]*?scrollbar-gutter:\s*stable/);
  assert.match(css, /\.formCard[\s\S]*?grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.avatarUploadBtn\b/);
  // 颜色改走主题变量；只在本规则块内匹配（[^}]*），避免跨到后面其它规则误判
  assert.match(css, /\.avatarUploadBtn\s*\{[^}]*background:\s*var\(--color-surface/);
  assert.match(css, /\.avatarUploadBtn\s*\{[^}]*color:\s*var\(--color-text\)/);
  assert.doesNotMatch(css, /\.avatarUploadBtn\s*\{[^}]*border:\s*1px dashed/);
  assert.match(css, /\.fieldAiBtn\s*\{[^}]*linear-gradient\(180deg,\s*var\(--color-primary\)/);
  assert.match(css, /\.fieldAiBtn\s*\{[^}]*color:\s*var\(--color-on-primary\)/);
  assert.match(field, /MdOutlineFileUpload/);
  assert.match(npc, /MdAutoAwesome/);
  assert.match(persona, /MdAutoAwesome/);
  assert.match(css, /\.avatarPreviewFallback[\s\S]*?place-items:\s*center/);
  assert.match(field, /TrimmedTransparentImg/);
  assert.match(field, /variant="full"/);
  assert.match(persona, /WarehouseCardAvatarField[\s\S]*?wh-persona-name/);
  assert.match(persona, /formPreviewPortraitFallback/);
  assert.match(npc, /WarehouseCardAvatarField[\s\S]*?wh-npc-name/);
  assert.match(npc, /formPreviewPortraitFallback/);
  assert.match(field, /avatarPreviewHasImage/);
  assert.match(field, /scrollIntoView/);
  assert.doesNotMatch(field, /warehouseCardAvatarConstraintHint|avatarPlate/);
});

test('warehouseCardAvatar_上传常量1MB', async () => {
  const mod = await import(join(root, 'src/lib/warehouse/warehouseCardAvatar.ts'));
  assert.equal(mod.WAREHOUSE_CARD_UPLOAD_AVATAR_MAX_BYTES, 1024 * 1024);
  assert.match(mod.warehouseCardUploadHint(), /1MB|质量 100|等比/);
});
