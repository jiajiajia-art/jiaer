/**
 * P8：生图「使用这张图」后一律进我的素材库（不限竖图位）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const picker = readFileSync(join(root, 'Romance/src/components/ImagePicker.tsx'), 'utf8');
const ai = readFileSync(join(root, 'Romance/src/components/AiImageGen.tsx'), 'utf8');

test('ImagePicker_applyUrl走saveWorkImage上传进素材库', () => {
  assert.match(picker, /saveWorkImage/);
  assert.match(picker, /void applyUrl\(url\)/);
  assert.doesNotMatch(ai, /如：二次元写实漫/);
  // 生图占位现为「这一张画什么」，不再写选填画风长句
  assert.match(ai, /这一张画什么：主体、场景、光线/);
});
