import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('warehouseCardAvatarJobKey_按 kind 与 cardId 分桶', () => {
  const src = readFileSync(
    join(root, 'src/lib/warehouse/warehouseCardAvatarBackgroundJob.ts'),
    'utf8',
  );
  assert.match(src, /export function warehouseCardAvatarJobKey/);
  assert.match(src, /\$\{kind\}:\$\{id\}/);
  assert.match(src, /\|\| 'new'/);
  assert.match(src, /isWarehouseCardAvatarGenBusy/);
});

test('warehouseCardAvatar_生图后台且不锁其它按钮', () => {
  const job = readFileSync(
    join(root, 'src/lib/warehouse/warehouseCardAvatarBackgroundJob.ts'),
    'utf8',
  );
  const field = readFileSync(join(root, 'src/page/warehouse/WarehouseCardAvatarField.tsx'), 'utf8');
  const persona = readFileSync(join(root, 'src/page/warehouse/WarehousePersonaCards.tsx'), 'utf8');
  const npc = readFileSync(join(root, 'src/page/warehouse/WarehouseCharacterCards.tsx'), 'utf8');
  assert.match(job, /startWarehouseCardAvatarBackgroundGen/);
  assert.match(job, /WAREHOUSE_CARD_AVATAR_GEN_CLIENT_TIMEOUT_MS/);
  assert.match(job, /生图超时，请稍后重试/);
  assert.match(field, /后台生成中/);
  assert.match(persona, /startWarehouseCardAvatarBackgroundGen/);
  assert.match(persona, /可继续编辑或保存/);
  assert.match(npc, /startWarehouseCardAvatarBackgroundGen/);
  // 保存/取消不应再被 generatingAvatar 锁死
  assert.doesNotMatch(
    persona,
    /disabled=\{saving \|\| generatingAvatar \|\| generatingPersona\}/,
  );
  assert.doesNotMatch(
    npc,
    /disabled=\{saving \|\| generatingAvatar \|\| generatingPersona\}/,
  );
});
