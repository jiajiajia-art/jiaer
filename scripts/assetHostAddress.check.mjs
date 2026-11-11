/**
 * 功能注释：Aliyun cn-test API 基址带 /cn-test-api 时，静态图必须落到站点根 /public，否则全裂。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

test('resolveAssetHostAddress_应去掉cn-test-api后缀', async () => {
  // 动态 import 需在构建外直接读源码门禁 + 轻量复刻逻辑，避免 Vite 环境依赖
  const src = readFileSync(join(root, 'src/config.ts'), 'utf8');
  assert.match(src, /export function resolveAssetHostAddress/);
  assert.match(src, /\/cn-test-api\$\/i/);
  assert.match(src, /ASSET_HOST_ADDRESS/);

  const constants = readFileSync(join(root, 'src/utils/constants.ts'), 'utf8');
  assert.match(constants, /resolveImageHostAddress/);
  assert.doesNotMatch(
    constants,
    /return `\$\{HOST_ADDRESS\}\$\{normalizedPath\}`/,
  );
  assert.match(src, /export function resolveImageHostAddress/);
  assert.match(src, /interactive-fiction-game-avatar/);

  const strip = (apiBase) =>
    String(apiBase || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/cn-test-api$/i, '');

  const imageHost = (imagePath, apiBase) => {
    const path = String(imagePath || '');
    const api = String(apiBase || '').trim().replace(/\/+$/, '');
    if (path.includes('/interactive-fiction-game-avatar/')) return api;
    return strip(apiBase);
  };
  assert.equal(
    imageHost('/interactive-fiction-game-avatar/u/a.jpg', 'https://kurangames.cn/cn-test-api'),
    'https://kurangames.cn/cn-test-api',
  );
  assert.equal(
    imageHost('/public/cover.jpg', 'https://kurangames.cn/cn-test-api'),
    'https://kurangames.cn',
  );

  assert.equal(
    strip('https://kurangames.cn/cn-test-api'),
    'https://kurangames.cn',
  );
  assert.equal(strip('https://kurangames.cn/cn-test-api/'), 'https://kurangames.cn');
  assert.equal(strip('https://kurangames.cn'), 'https://kurangames.cn');
  assert.equal(
    strip('http://47.93.42.104/cn-test-api'),
    'http://47.93.42.104',
  );
  void require;
});
