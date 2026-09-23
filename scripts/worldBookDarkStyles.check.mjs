/**
 * 世界书 / 数据库：对齐 funloom 墨黑账本，禁止白卡粉描边
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('WorldBookPanel_应对齐墨黑账本而非白卡粉描边', () => {
  const css = read('src/components/GameSettingEditor/WorldBook/WorldBookPanel.module.css');
  const dbTsx = read('src/components/GameSettingEditor/Database/DatabasePanel.tsx');
  assert.match(css, /--wb-surface:\s*#1A1A1A/);
  assert.match(css, /--wb-rail:\s*#121212/);
  assert.match(css, /--wb-input:\s*#1C1C1E/);
  assert.match(css, /--wb-accent:\s*#8E2135/);
  assert.match(css, /\.body\s*\{[\s\S]*?background:\s*var\(--wb-surface\)/);
  assert.match(css, /\.subNav\s*\{[\s\S]*?background:\s*var\(--wb-rail\)/);
  assert.match(css, /\.header h2\s*\{[\s\S]*?color:\s*#ffffff/);
  assert.match(css, /\.emptyTitle\s*\{[\s\S]*?color:\s*#ffffff/);
  assert.doesNotMatch(css, /background:\s*#fff(?:fff)?\b/);
  assert.doesNotMatch(css, /#fff8f8|#faf7f7|rgba\(255,\s*248,\s*249/);
  /* 功能注释：数据库空态与世界书共用同一暗色壳，禁止另起白卡 */
  assert.match(dbTsx, /WorldBookPanel\.module\.css/);
});

test('MorePromptFormPanel_主按钮应为酒红胶囊且输入井暗色', () => {
  const css = read('src/components/GameSettingEditor/MorePromptForms/MorePromptFormPanel.module.css');
  assert.match(css, /--prompt-surface:\s*#1A1A1A/);
  assert.match(css, /--prompt-input:\s*#1C1C1E/);
  assert.match(css, /--prompt-accent:\s*#8E2135/);
  assert.match(css, /\.field input\[type='text'\]\s*\{[\s\S]*?background:\s*var\(--prompt-input\)/);
  assert.match(css, /\.confirmBtn\s*\{[\s\S]*?background:\s*var\(--prompt-accent\)/);
  assert.match(css, /\.confirmBtn,\s*\n\s*\.cancelBtn\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.confirmBtn,\s*\n\s*\.cancelBtn\s*\{[\s\S]*?min-height:\s*48px/);
  assert.doesNotMatch(css, /linear-gradient\(135deg,\s*var\(--primary\)/);
  assert.doesNotMatch(css, /background:\s*#ffffff/);
});

test('MorePromptNav_补录按钮禁止白底粉渐变', () => {
  const css = read('src/components/GameSettingEditor/MorePromptForms/MorePromptNavSection.module.css');
  assert.match(css, /\.addBtn\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.addBtnActive\s*\{[\s\S]*?background:\s*rgba\(142,\s*33,\s*53,\s*0\.28\)/);
  assert.doesNotMatch(css, /background:\s*rgba\(255,\s*255,\s*255,\s*0\.9\)/);
  assert.doesNotMatch(css, /rgba\(255,\s*244,\s*245/);
});

test('MarkdownContentField_应对齐暗色输入井', () => {
  const css = read('src/components/GameSettingEditor/MorePromptForms/MarkdownContentField.module.css');
  assert.match(css, /background:\s*#1C1C1E/);
  assert.match(css, /color:\s*#ffffff/);
  assert.doesNotMatch(css, /background:\s*#ffffff/);
  assert.doesNotMatch(css, /rgba\(255,\s*244,\s*245/);
});
