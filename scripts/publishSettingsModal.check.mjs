/**
 * 发布设置弹窗：对齐 funloom 墨黑账本，禁止白卡粉描边与粉色关闭图
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('PublishSettingsModal_应对齐墨黑账本而非白卡粉描边', () => {
  const css = read('src/components/CommonModal/PublishSettingsModal.module.css');
  const tsx = read('src/components/CommonModal/PublishSettingsModal.tsx');
  assert.match(css, /--pub-surface:\s*#1A1A1A/);
  assert.match(css, /--pub-input:\s*#1C1C1E/);
  assert.match(css, /--pub-accent:\s*#8E2135/);
  assert.match(css, /\.publishModalContent\s*\{[\s\S]*?background:\s*var\(--pub-surface\)/);
  assert.match(css, /\.publishBtn\s*\{[\s\S]*?background:\s*var\(--pub-accent\)/);
  assert.match(css, /\.themeTagsWrap\s*\{[\s\S]*?repeat\(6,/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.themeTagsWrap\s*\{[\s\S]*?repeat\(3,/);
  assert.match(css, /\.themeTagChip\s*\{[\s\S]*?border-radius:\s*14px/);
  assert.match(css, /\.themeTagChipActive\s*\{[\s\S]*?background:\s*var\(--pub-accent\)/);
  assert.doesNotMatch(css, /#fff8f8|#faf7f7|#ff6b6b/);
  assert.doesNotMatch(tsx, /关闭\.png|#FB4655/);
  assert.match(tsx, /styles\.modalHead/);
  assert.match(tsx, /styles\.richEditorDark/);
  assert.match(tsx, /ContentAudienceField/);
  assert.match(tsx, /CoverUpload/);
  assert.match(css, /\.richEditorDark/);
  assert.match(css, /\.formContent\s*\{[\s\S]*?width:\s*100%/);
  assert.doesNotMatch(css, /min\(520px/);
});

test('发布设置_结算货币应固定为KK币且不向用户暴露选择项', () => {
  const modal = read('src/components/CommonModal/PublishSettingsModal.tsx');
  const createGame = read('src/page/CreateGame.tsx');
  const publishApi = read('src/api/rpgGame/gameAction.Api.ts');

  assert.doesNotMatch(modal, /shareType|CustomSelect|CURRENCY_OPTIONS/);
  assert.doesNotMatch(createGame, /shareType/);
  assert.doesNotMatch(publishApi, /shareType/);
});
