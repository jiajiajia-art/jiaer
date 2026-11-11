/**
 * 主屏雪碧图必须带 alpha：否则圆角外的奶油底会显示成白方块。
 * 同时锁定 phone-icon-in / Sprite 透明底，避免 UA button 白底透出。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel));
const readText = (rel) => readFileSync(join(root, rel), 'utf8');

/** 功能注释：解析 WebP 是否声明 alpha（VP8L 或 VP8X alpha 位） */
function webpDeclaresAlpha(buf) {
  if (buf.length < 16 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return false;
  }
  // VP8L = lossless，可含 alpha；贴图打透明后必须以 lossless/VP8X 写出
  if (buf.includes(Buffer.from('VP8L'))) return true;
  const i = buf.indexOf(Buffer.from('VP8X'));
  if (i < 0 || i + 8 >= buf.length) return false;
  // VP8X chunk: 'VP8X'(4) + size(4 LE) + flags(1)；bit4 = alpha
  const flags = buf[i + 8];
  return (flags & 0x10) !== 0;
}

/** 功能注释：PNG 须为 RGBA（色型 6）或带 tRNS */
function pngHasAlpha(buf) {
  if (buf.length < 33 || buf.toString('ascii', 1, 4) !== 'PNG') return false;
  // IHDR: color type at byte 25 (8+8+4+4+1+1+1+1+1 → offset 16+9=25 for color type)
  const colorType = buf[25];
  if (colorType === 4 || colorType === 6) return true;
  return buf.includes(Buffer.from('tRNS'));
}

for (const name of ['app-icons', 'app-icons-2']) {
  test(`雪碧图_${name}_webp_须声明alpha通道`, () => {
    const rel = `Romance/src/assets/${name}.webp`;
    assert.ok(existsSync(join(root, rel)), `${rel} 缺失`);
    assert.ok(webpDeclaresAlpha(read(rel)), `${rel} 无 alpha（仍是不透明 VP8），圆角外会露白底`);
  });

  test(`雪碧图_${name}_png_须带alpha`, () => {
    const rel = `Romance/src/assets/${name}.png`;
    assert.ok(existsSync(join(root, rel)), `${rel} 缺失`);
    assert.ok(pngHasAlpha(read(rel)), `${rel} 非 RGBA/tRNS`);
  });
}

test('Sprite_须显式transparent背景避免白底', () => {
  const src = readText('Romance/src/components/phone/appIcons.tsx');
  assert.match(src, /backgroundColor:\s*["']transparent["']/);
  assert.match(src, /app-icons\.webp/);
  assert.match(src, /app-icons-2\.webp/);
});

test('phone-icon-in_须强制按钮透明底', () => {
  const css = readText('Romance/src/index.css');
  assert.match(css, /\.phone-icon-in\s*\{[^}]*background(?:-color)?:\s*transparent/s);
  assert.match(css, /\.ios-icon\s*\{[^}]*overflow:\s*hidden/s);
});

test('AppTile_按钮须带bg-transparent', () => {
  const tsx = readText('Romance/src/components/Phone.tsx');
  assert.match(tsx, /phone-icon-in[^`]*bg-transparent/);
});
