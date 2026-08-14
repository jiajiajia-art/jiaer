/**
 * 立绘渲染：canvas 失败须切 img；默认不得 scale(1.5) 导致超出裁切
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

test('GameImageRenderer_disableMobileGuard时不因中等屏放弃canvas', () => {
  const src = readFileSync(join(dir, '../src/components/Galgame/GameImageRenderer.tsx'), 'utf8');
  assert.match(src, /preferImgFallback\s*=\s*!useCanvas\s*\|\|\s*\(isMediumScreen\s*&&\s*!disableMobileGuard\)/);
  assert.match(src, /setUseFallback\(true\)/);
  assert.match(src, /showFallbackImg/);
});

test('CharacterLayer_默认不得强制scale1_5', () => {
  const src = readFileSync(join(dir, '../src/components/Galgame/CharacterLayer.tsx'), 'utf8');
  assert.doesNotMatch(
    src,
    /DEFAULT_SCALE\s*=\s*1\.5/,
    '默认 1.5 会把立绘放大出框，头顶被裁',
  );
  assert.match(src, /effectiveScale\s*=\s*hasExplicitScale\s*\?\s*Number\(portraitScale\)\s*:\s*1/);
  assert.match(src, /overflow:\s*'hidden'/);
});

test('CharacterLayer_须disableMobileGuard', () => {
  const src = readFileSync(join(dir, '../src/components/Galgame/CharacterLayer.tsx'), 'utf8');
  assert.match(src, /disableMobileGuard=\{true\}/);
});
