/**
 * 仓库分段选中态：实心酒红白字 + 勾选图标，禁止浅灰粉字弱选中
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('WarehousePanel_segActive应为实心酒红白字并带勾选图标', () => {
  const css = read('src/page/warehouse/WarehousePanel.module.css');
  const npc = read('src/page/warehouse/WarehouseCharacterCards.tsx');
  const persona = read('src/page/warehouse/WarehousePersonaCards.tsx');
  assert.match(css, /\.segActive\s*\{[\s\S]*?background:\s*var\(--wh-coral\)/);
  assert.match(css, /\.segActive\s*\{[\s\S]*?color:\s*(?:#ffffff|var\(--|color-mix\()/i);
  assert.match(css, /\.segActiveIcon\s*\{/);
  assert.doesNotMatch(css, /\.segActive\s*\{[\s\S]*?color:\s*#ffb3bf/);
  assert.doesNotMatch(css, /\.segActive\s*\{[\s\S]*?background:\s*#2c2c2e/);
  assert.match(npc, /MdCheck/);
  assert.match(npc, /segActiveIcon/);
  assert.match(persona, /MdCheck/);
  assert.match(persona, /segActiveIcon/);
});
