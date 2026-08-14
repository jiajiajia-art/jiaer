/**
 * 玩家定位：立场/秘密 AI 生成入口
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

test('SystemsPanel_立场与秘密有AI生成按钮', () => {
  const src = readFileSync(join(dir, '../src/components/Galgame/panels/SystemsPanel.tsx'), 'utf8');
  assert.match(src, /requestPositionAi\('traits'\)/);
  assert.match(src, /requestPositionAi\('secret'\)/);
  assert.match(src, /generatePlayerPositioningField/);
  assert.match(src, /NPC_PROFILE_FIELD_GENERATION_COST/);
});

test('API_有player-positioning-field', () => {
  const src = readFileSync(join(dir, '../src/api/galgame/playerCharacterCards.ts'), 'utf8');
  assert.match(src, /player-positioning-field/);
  assert.match(src, /generatePlayerPositioningField/);
});
