/**
 * 对话立绘展示：禁止前端臆造尚不存在的 webp
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preferCharacterPortraitWebp, fallbackCharacterPortraitPng } from '../src/utils/characterPortraitUrl.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('fallbackCharacterPortraitPng_webp回退png', () => {
  assert.equal(
    fallbackCharacterPortraitPng('/api/visual/images/x/npcs/a/base_1.webp?t=9'),
    '/api/visual/images/x/npcs/a/base_1.png?t=9',
  );
  assert.equal(fallbackCharacterPortraitPng('/api/visual/images/x/scenes/a.webp'), '');
  assert.equal(
    fallbackCharacterPortraitPng('/public/visual/images/x/npcs/a/base_1_150.webp'),
    '',
  );
});

test('preferCharacterPortraitWebp_禁止臆造png改webp', () => {
  assert.equal(
    preferCharacterPortraitWebp('/api/visual/images/x/npcs/a/base_1_abc.png'),
    '/api/visual/images/x/npcs/a/base_1_abc.png',
  );
  assert.equal(
    preferCharacterPortraitWebp('/api/visual/images/x/players/base_1.png?t=1'),
    '/api/visual/images/x/players/base_1.png?t=1',
  );
  assert.equal(
    preferCharacterPortraitWebp('/api/visual/images/x/npcs/a/base.webp'),
    '/api/visual/images/x/npcs/a/base.webp',
  );
});

test('getImageUrl_须经preferCharacterPortraitWebp且不得臆造webp', () => {
  const src = readFileSync(join(root, 'src/utils/constants.ts'), 'utf8');
  assert.match(src, /preferCharacterPortraitWebp/);
  const preferSrc = readFileSync(join(root, 'src/utils/characterPortraitUrl.ts'), 'utf8');
  assert.match(preferSrc, /禁止把历史 base_\*\.png 改写成同名 \.webp|禁止前端把/);
  assert.doesNotMatch(
    preferSrc,
    /return `\$\{pathOnly\.replace\(\/\\\.png\$\/i, '\.webp'\)\}/,
  );
});

test('gameResourceManager_webp失败须回退png', () => {
  const src = readFileSync(join(root, 'src/utils/gameResourceManager.ts'), 'utf8');
  assert.match(src, /fallbackCharacterPortraitPng/);
  assert.match(src, /portrait webp miss, fallback png/);
});
