/**
 * 仓库空状态酒红块内应有语义图标，禁止纯色占位
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('WarehouseEmptyIcon_插件空态应使用扩展图标', () => {
  const icon = read('src/page/warehouse/WarehouseEmptyIcon.tsx');
  const lib = read('src/page/warehouse/WarehouseResourceLibrary.tsx');
  const css = read('src/page/warehouse/WarehousePanel.module.css');
  assert.match(icon, /MdExtension/);
  assert.match(icon, /kind === 'plugin'|plugin:\s*MdExtension/);
  assert.match(lib, /WarehouseEmptyIcon/);
  assert.match(lib, /kind=\{resourceType === 'plugin' \? 'plugin' : 'worldbook'\}/);
  assert.match(css, /\.emptyOrb\s*\{[\s\S]*?place-items:\s*center/);
  assert.match(css, /\.emptyOrbIcon\s*\{/);
  assert.doesNotMatch(lib, /<div className=\{panel\.emptyOrb\} aria-hidden \/>/);
});
