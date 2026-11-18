/**
 * 功能注释：AI 线路悬浮球 logo 必须是真实静态图。
 * Retina 若 srcSet 指向不存在的 @2x，Nginx SPA 会 200 回 HTML，开场页右侧出现破图。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fab = readFileSync(join(root, 'src/components/AiRoute/AiRouteFab.tsx'), 'utf8');

test('AiRouteFab_logo只用已有1x_禁止虚构@2x', () => {
  assert.match(fab, /data\/assets\/funloom_icon\.png/);
  assert.doesNotMatch(fab, /funloom_icon@2x/);
  assert.doesNotMatch(fab, /srcSet/);
  assert.equal(existsSync(join(root, 'public/data/assets/funloom_icon.png')), true);
});

test('AiRouteFab_球芯须固定白渐变_不跟暗色surface', () => {
  const css = readFileSync(join(root, 'src/components/AiRoute/AiRouteFab.module.css'), 'utf8');
  assert.match(css, /linear-gradient\(165deg,\s*#ffffff/);
  assert.match(css, /radial-gradient\(120% 100% at 30% 18%,\s*#ffffff/);
  assert.doesNotMatch(css, /\.core\s*\{[^}]*var\(--color-surface/);
  assert.doesNotMatch(css, /--ar-soft:\s*color-mix\([^)]*var\(--color-surface/);
});

test('RomanceHost_开场页也会挂AiRouteFab', () => {
  const host = readFileSync(join(root, 'src/page/RomanceHost.tsx'), 'utf8');
  assert.match(host, /AiRouteFab/);
  assert.match(host, /s === 'game' \|\| s === 'opening'/);
});
