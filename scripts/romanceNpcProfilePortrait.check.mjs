/**
 * 人物资料页不渲染「专属立绘」整块。
 * 立绘组件仍留给人物定制等其它入口，资料页不得再引用。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src/components');
const npcTab = readFileSync(join(root, 'NpcTab.tsx'), 'utf8');
const fixed = readFileSync(join(root, 'FixedPersonPanel.tsx'), 'utf8');
const upload = readFileSync(join(root, 'PortraitUpload.tsx'), 'utf8');

test('人物资料页_不出现专属立绘模块', () => {
  assert.doesNotMatch(npcTab, /专属立绘/);
  assert.doesNotMatch(npcTab, /PortraitUpload/);
  assert.doesNotMatch(npcTab, /setNpcPortrait/);
  assert.doesNotMatch(npcTab, /还没有立绘/);
  assert.match(npcTab, /title="个人能力"/);
});

test('其它入口_仍可上传立绘', () => {
  assert.match(fixed, /import PortraitUpload from "\.\/PortraitUpload"/);
  assert.match(fixed, /<PortraitUpload /);
  assert.match(upload, /还没有立绘/);
  assert.match(upload, /上传立绘/);
});
