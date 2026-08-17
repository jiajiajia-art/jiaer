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
  assert.match(persona, /WarehouseCardAvatarField/);
  assert.match(persona, /startWarehouseCardAvatarBackgroundGen/);
  assert.match(npc, /WarehouseCardAvatarField/);
  assert.match(npc, /cardKind:\s*'npc'/);
  assert.match(field, /AI 生成图像|重新生成图像|后台生成中/);
  assert.match(field, /avatarIdentityRow|avatarAside/);
  assert.match(field, /children/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /object-position:\s*bottom center/);
  assert.match(css, /\.avatarIdentityRow\s*\{/);
  assert.match(css, /\.avatarPreviewFallback[\s\S]*?place-items:\s*center/);
  assert.match(field, /TrimmedTransparentImg/);
  assert.match(field, /variant="bust"/);
  assert.match(persona, /WarehouseCardAvatarField[\s\S]*?wh-persona-name/);
  assert.match(persona, /formPreviewPortraitFallback/);
  assert.match(npc, /WarehouseCardAvatarField[\s\S]*?wh-npc-name/);
  assert.match(npc, /formPreviewPortraitFallback/);
  assert.doesNotMatch(field, /warehouseCardAvatarConstraintHint|avatarPlate/);
});
