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

test('ImagePicker_applyUrl非竖图也rememberAsset', () => {
  assert.match(picker, /rememberAsset\(url\)/);
  assert.match(picker, /rememberAsset\(fitted\)/);
  assert.doesNotMatch(ai, /如：二次元写实漫/);
  assert.match(ai, /选填：可写画风；留空则按主体与设定生成/);
});
