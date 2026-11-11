import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('resolveWarehouseNavItem_最长路径优先匹配公共世界书', async () => {
  const mod = await import(join(root, 'src/page/warehouse/warehouseNav.ts'));
  const item = mod.resolveWarehouseNavItem('/warehouse/public/worldbooks');
  assert.equal(item?.id, 'public-worldbooks');
  assert.equal(item?.group, 'public');
});

test('resolveWarehouseNavItem_不把公共卡库误当成公共世界书前缀', async () => {
  const mod = await import(join(root, 'src/page/warehouse/warehouseNav.ts'));
  assert.equal(mod.resolveWarehouseNavItem('/warehouse/public/cards')?.id, 'public-cards');
  assert.equal(mod.resolveWarehouseNavItem('/warehouse/persona')?.id, 'persona');
  assert.equal(mod.resolveWarehouseNavItem('/other'), undefined);
});

test('WarehouseHub_手机用目录条与底栏sheet而非堆叠侧栏', () => {
  const hub = readFileSync(join(root, 'src/page/warehouse/WarehouseHub.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/page/warehouse/WarehouseHub.module.css'), 'utf8');
  const panelCss = readFileSync(join(root, 'src/page/warehouse/WarehousePanel.module.css'), 'utf8');
  const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8');
  assert.match(hub, /mobileChrome/);
  assert.match(hub, /sheetOpen/);
  assert.match(hub, /resolveWarehouseNavItem/);
  assert.match(css, /\.sidebar\s*\{\s*display:\s*none;/);
  assert.match(css, /mobileRail/);
  assert.match(css, /sheetPanel/);
  assert.doesNotMatch(css, /@media \(max-width: 980px\)[\s\S]*\.sidebar\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.mobileChrome::after/);
  assert.match(css, /background:\s*var\(--wh-stage\)/);
  assert.doesNotMatch(css, /rgba\(244,\s*242,\s*245,\s*0\.92\)/);
  assert.match(panelCss, /\.header\s*\{\s*display:\s*none;/);
  assert.match(indexCss, /--app-mobile-navbar-height:\s*60px/);
  assert.match(indexCss, /--app-desktop-navbar-height:\s*var\(--app-mobile-navbar-height\)/);
});
