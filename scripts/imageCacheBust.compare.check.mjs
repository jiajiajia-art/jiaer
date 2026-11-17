/**
 * 功能注释：立绘同路径比较须忽略 cache bust（不直接 import imageCache，避免拉到 Vite 侧 constants）
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('imageCache_须导出stripImageCacheBust并去掉查询串', () => {
  const src = readFileSync(join(root, 'src/utils/imageCache.ts'), 'utf8');
  assert.match(src, /export const stripImageCacheBust/);
  assert.match(src, /split\(\/\[\?#\]\/\)/);
});

test('withCacheBust_不得给data或blob拼时间戳', () => {
  const src = readFileSync(join(root, 'src/utils/imageCache.ts'), 'utf8');
  // 功能注释：列表卡 addImageTimestamp 会走这里；拼 ?t= 会毁掉 Romance data: 封面
  assert.match(src, /export const withCacheBust/);
  assert.match(src, /startsWith\(\s*['"]data:['"]\s*\)/);
  assert.match(src, /startsWith\(\s*['"]blob:['"]\s*\)/);
  assert.match(src, /data:\/blob:/);
});

test('useGalgameController_旁路立绘比较须用stripImageCacheBust', () => {
  const src = readFileSync(join(root, 'src/hooks/galgame/useGalgameController.ts'), 'utf8');
  assert.match(src, /stripImageCacheBust\(prev\.characterImage\)/);
  assert.match(src, /stripImageCacheBust\(imageUrl\)/);
  assert.match(src, /buildPortraitSpeakerKey/);
  assert.match(src, /prev\.speakerKey === nextSpeakerKey/);
});

test('CharacterLayer_同身份不再重放进场动画', () => {
  const src = readFileSync(join(root, 'src/components/Galgame/CharacterLayer.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/components/Galgame/CharacterLayer.module.css'), 'utf8');
  assert.match(src, /enterAnimActive/);
  assert.match(src, /enterSettled/);
  assert.match(css, /\.enterSettled/);
});
