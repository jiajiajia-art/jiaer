import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('warehouseCardPersona_FE入口与扣分对齐局内人设字段', () => {
  const api = readFileSync(join(root, 'src/api/galgame/playerCharacterCards.ts'), 'utf8');
  const persona = readFileSync(join(root, 'src/page/warehouse/WarehousePersonaCards.tsx'), 'utf8');
  const npc = readFileSync(join(root, 'src/page/warehouse/WarehouseCharacterCards.tsx'), 'utf8');
  const constants = readFileSync(join(root, 'src/utils/constants.ts'), 'utf8');
  assert.match(api, /player-character-cards\/persona/);
  assert.match(api, /generatePersona/);
  assert.match(constants, /NPC_PROFILE_FIELD_GENERATION_COST\s*=\s*1/);
  assert.match(persona, /NPC_PROFILE_FIELD_GENERATION_COST/);
  assert.match(persona, /generatePersona/);
  assert.match(persona, /fieldAiBtn/);
  assert.match(persona, /确认生成人设/);
  assert.match(npc, /generatePersona/);
  assert.match(npc, /cardKind:\s*'npc'/);
  assert.doesNotMatch(persona, /CHARACTER_GENERATION_COST\} 积分生成「人设/);
});
