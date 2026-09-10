/**
 * 仓库对齐首页 Funloom 墨黑酒红，禁止浅色纸质 Studio Catalog
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('WarehouseHub_应对齐首页墨黑酒红色板', () => {
  const css = read('src/page/warehouse/WarehouseHub.module.css');
  assert.match(css, /--wh-stage:\s*#000000/);
  assert.match(css, /--wh-paper:\s*#1a1a1a/i);
  assert.match(css, /--wh-coral:\s*#a8283c/i);
  assert.match(css, /--wh-coral-deep:\s*#8e2135/i);
  assert.match(css, /\.railChip\s*\{[\s\S]*?background:\s*var\(--wh-chip\)/);
  assert.match(css, /\.railChipActive\s*\{[\s\S]*?background:\s*var\(--wh-coral\)/);
  assert.match(css, /\.mobileUploadCta\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*?\.content\s*\{[\s\S]*?background:\s*transparent/);
  assert.doesNotMatch(css, /--wh-stage:\s*#f4f2f5/);
  assert.doesNotMatch(css, /--wh-coral:\s*#e03d4b/);
  assert.doesNotMatch(css, /\.railChip\s*\{[\s\S]*?background:\s*#f0eef1/);
});

test('WarehousePanel_角色卡应对齐首页暗色表面与双列网格', () => {
  const css = read('src/page/warehouse/WarehousePanel.module.css');
  const npc = read('src/page/warehouse/WarehouseCharacterCards.tsx');
  assert.match(npc, /我的角色卡/);
  assert.match(css, /--wh-coral:\s*#a8283c/i);
  assert.match(css, /--wh-paper:\s*#1a1a1a/i);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*?\.toolbar\s*\{[\s\S]*?background:\s*var\(--wh-paper\)/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*?\.grid\s*\{[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*?\.preview\s*\{\s*display:\s*none/);
  assert.match(css, /\.cardActive\s*\{[\s\S]*?border-color:\s*var\(--wh-coral\)/);
  assert.match(css, /\.cardActions \.actionPrimary\s*\{[\s\S]*?background:\s*var\(--wh-coral\)/);
  assert.match(css, /\.formOverlay\s*\{[\s\S]*?place-items:\s*center/);
  assert.match(
    css,
    /@media \(max-width:\s*980px\)[\s\S]*?\.formOverlay\s*\{[\s\S]*?place-items:\s*center/,
  );
  assert.doesNotMatch(
    css,
    /@media \(max-width:\s*980px\)[\s\S]*?\.formOverlay\s*\{[\s\S]*?align-items:\s*flex-start/,
  );
  assert.doesNotMatch(css, /--wh-ink:\s*#17141a/);
  assert.doesNotMatch(css, /--wh-soft:\s*#fff0f2/);
});
