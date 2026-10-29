/**
 * 场景背景图不是地址时，不得交给 img，否则缩略图会画出裂图。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { displayableImageSrc } from '../Romance/src/lib/displayableImageSrc.ts';

const picker = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../Romance/src/components/ImagePicker.tsx'), 'utf8');

test('displayableImageSrc_说明文字和坏对象_不当图片地址', () => {
  assert.equal(displayableImageSrc('暖光客厅，沙发靠窗'), '');
  assert.equal(displayableImageSrc({ zh: '家里客厅' }), '');
  assert.equal(displayableImageSrc({ prompt: '一张客厅图' }), '');
  assert.equal(displayableImageSrc('[object Object]'), '');
  assert.equal(displayableImageSrc(undefined), '');
});

test('displayableImageSrc_直链和包装对象_保留地址', () => {
  assert.equal(displayableImageSrc('https://cdn.example/room.png'), 'https://cdn.example/room.png');
  assert.equal(displayableImageSrc({ url: 'https://cdn.example/room.webp' }), 'https://cdn.example/room.webp');
  assert.equal(displayableImageSrc('data:image/png;base64,aaa'), 'data:image/png;base64,aaa');
  assert.equal(displayableImageSrc('/funloom/room.png'), '/funloom/room.png');
});

test('ImagePicker_非图片地址不得直接当src', () => {
  assert.match(picker, /displayableImageSrc\(value\)/);
  assert.match(picker, /onError=\{\(\) => setBroken\(true\)\}/);
  assert.doesNotMatch(picker, /\{value \? \(\s*<img src=\{value\}/);
});
