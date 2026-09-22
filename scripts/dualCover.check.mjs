/**
 * 双封面：发布弹窗与世界观上传组件契约
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasBothGameCovers } from '../src/utils/gameCovers.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('hasBothGameCovers_横竖都有才算齐', () => {
  assert.equal(hasBothGameCovers({ cover_url: '/a.webp' }), false);
  assert.equal(hasBothGameCovers({ portrait_cover_url: '/b.webp' }), false);
  assert.equal(hasBothGameCovers({ cover_url: '/a.webp', portrait_cover_url: '/b.webp' }), true);
  assert.equal(hasBothGameCovers({ coverUrl: '/a.webp', portraitCoverUrl: '/b.webp' }), true);
});

test('CoverUpload_双槽位与orientation上传生图', () => {
  const tsx = read('src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx');
  assert.match(tsx, /renderSlotHeader\('landscape'\)/);
  assert.match(tsx, /renderSlotHeader\('portrait'\)/);
  assert.match(tsx, /renderSlotFrame\('landscape'\)/);
  assert.match(tsx, /renderSlotFrame\('portrait'\)/);
  assert.match(tsx, /uploadGameCover\(fileId, file, orientation\)/);
  assert.match(tsx, /generateGameCover\(fileId, \{[\s\S]*orientation/);
  assert.match(tsx, /gamePortraitCover/);
});

test('CoverUpload_横竖同高配对64fr27fr', () => {
  const css = read('src/components/GameSettingEditor/WorldPanel/WorldPanel.module.css');
  const tsx = read('src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx');
  assert.match(css, /grid-template-columns:\s*64fr\s+27fr/);
  assert.match(css, /\.coverUploadAreaLandscape\s*\{[\s\S]*?aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.coverUploadAreaPortrait\s*\{[\s\S]*?aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(css, /\.coverUploadAreaPreview\s*\{[\s\S]*?padding:\s*0/);
  assert.doesNotMatch(css, /\.coverUploadArea\s*\{[\s\S]*?min-height:\s*200px/);
  assert.doesNotMatch(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+136px/);
  assert.match(tsx, /coverUploadAreaLandscape/);
  assert.match(tsx, /coverUploadAreaPortrait/);
});

test('CoverUpload_编辑预览contain避免裁顶标题', () => {
  const css = read('src/components/GameSettingEditor/WorldPanel/WorldPanel.module.css');
  const previewBlock = css.match(/\.coverPreview\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(previewBlock, /object-fit:\s*contain/);
  assert.doesNotMatch(previewBlock, /object-fit:\s*cover/);
  const tsx = read('src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx');
  assert.match(tsx, /compositePosterTitleOntoCover\([\s\S]*orientation/);
});

test('CoverUpload_手机企划笺按钮横排不竖叠', () => {
  const css = read('src/components/GameSettingEditor/WorldPanel/WorldPanel.module.css');
  const mobile = css.match(/@media \(max-width:\s*480px\)\s*\{[\s\S]*$/)?.[0] || '';
  const actions = mobile.match(/\.coverBriefActions\s*\{[^}]*\}/)?.[0] || '';
  assert.match(actions, /flex-direction:\s*row/);
  assert.doesNotMatch(actions, /column-reverse/);
  assert.doesNotMatch(mobile, /\.coverBriefGhost,\s*\n\s*\.coverBriefPrimary\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.coverBriefActions\s*\{[\s\S]*?border-top:/);
});

test('CoverUpload_提示词占位引导画面与字体给AI', () => {
  const zh = read('src/i18n/locales/zh.json');
  const en = read('src/i18n/locales/en.json');
  assert.match(zh, /"promptPlaceholder":\s*"[^"]*画风[^"]*色调/);
  assert.match(zh, /"titleStyleLabel":\s*"标题样式示例（写入提示词给 AI）"/);
  assert.match(zh, /"cheeseNeon":\s*"黄字蓝描边"/);
  assert.match(zh, /"promptModalHint":\s*"[^"]*AI[^"]*标题/);
  assert.match(en, /"promptPlaceholder":\s*"[^"]*Scene style/i);
  assert.match(en, /"titleStyleLabel":\s*"Title style examples \(sent to AI\)"/);
});

test('PublishSettingsModal_复用CoverUpload并校验双封面', () => {
  const tsx = read('src/components/CommonModal/PublishSettingsModal.tsx');
  assert.match(tsx, /<CoverUpload/);
  assert.match(tsx, /hasBothGameCovers/);
  assert.match(tsx, /portraitCoverUrl/);
});

test('PublishSettingsModal_表单应拉满弹窗宽度', () => {
  const css = read('src/components/CommonModal/PublishSettingsModal.module.css');
  assert.match(css, /\.formContent\s*\{[\s\S]*?width:\s*100%/);
  assert.doesNotMatch(css, /min\(520px/);
  assert.match(css, /\.coverFormGroup\s*\{[\s\S]*?align-items:\s*stretch/);
});

test('GameGrid_列表卡优先竖版封面', () => {
  const tsx = read('src/components/GameGrid.tsx');
  assert.match(tsx, /resolveGameListCoverUrl/);
  assert.match(tsx, /portrait_cover_url/);
});
