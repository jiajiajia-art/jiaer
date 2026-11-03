/**
 * 封面背景：生图改到「上传」旁按钮 + Modal；页内不铺提示词；
 * 压暗 / 模糊 / 压暗颜色整段删除；生图走平台既有入口，不另起一套。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('platformImageGen_复用generateImage不另起网关', () => {
  const src = read('lib/platformImageGen.ts');
  assert.match(src, /from ["']\.\/ai["']/);
  assert.match(src, /return generateImage\(cfg, prompt, size\)/);
  assert.match(src, /export async function generatePlatformImage/);
  assert.match(src, /export function platformImageConfigured/);
  // 功能注释：适配层不得自己再 fetch 生图 URL，必须委托既有 generateImage
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /optical\/games\/generate-cover/);
});

test('AiImageGen_走platformImageGen入口', () => {
  const gen = read('components/AiImageGen.tsx');
  assert.match(gen, /generatePlatformImage/);
  assert.match(gen, /platformImageConfigured/);
  assert.match(gen, /bare/);
  assert.doesNotMatch(gen, /from ["']\.\.\/lib\/ai["']/);
});

test('ImagePicker_上传旁生图按钮弹窗不内联铺输入框', () => {
  const picker = read('components/ImagePicker.tsx');
  assert.match(picker, /生图/);
  assert.match(picker, /aiGen/);
  assert.match(picker, /from ["']\.\/ui["']/);
  assert.match(picker, /<Modal title="生图"/);
  assert.match(picker, /AiImageGen/);
  assert.match(picker, /bare/);
  // 功能注释：按钮须在上传之后、素材库之前（与产品标注一致）
  const uploadIdx = picker.search(/\n\s*上传\n/);
  const genIdx = picker.search(/\n\s*生图\n/);
  const libIdx = picker.search(/\n\s*素材库\n/);
  assert.ok(uploadIdx >= 0 && genIdx > uploadIdx && libIdx > genIdx, '生图按钮应夹在上传与素材库之间');
});

test('CoverDiyPanel_背景页去掉内联生图与压暗模糊颜色', () => {
  const panel = read('components/CoverDiyPanel.tsx');
  assert.doesNotMatch(panel, /import AiImageGen/);
  assert.doesNotMatch(panel, /<AiImageGen/);
  assert.doesNotMatch(panel, /label="压暗"/);
  assert.doesNotMatch(panel, /label="模糊"/);
  assert.doesNotMatch(panel, /压暗颜色/);
  assert.doesNotMatch(panel, /暖黄/);
  assert.match(panel, /aiGen=\{\{/);
  assert.match(panel, /size:\s*["']1024x1792["']/);
  // 功能注释：固定 CG 的 ImagePicker 开生图；轮播经 CoverCgEditor 透传
  assert.match(panel, /CoverCgEditor[\s\S]*aiGen=/);
});

test('CoverCgEditor_透传aiGen给ImagePicker', () => {
  const ed = read('components/CoverCgEditor.tsx');
  assert.match(ed, /aiGen\?:/);
  assert.match(ed, /aiGen=\{aiGen\}/);
});
