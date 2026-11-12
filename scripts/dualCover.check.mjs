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

test('CoverUpload_AI生成按钮红底白字对齐更换按钮', () => {
  const css = read('src/components/GameSettingEditor/WorldPanel/WorldPanel.module.css');
  // 功能注释：行首 .coverAiBtn，避开 .uploadCoverCompact .coverAiBtn
  const ai = css.match(/(?:^|\n)\.coverAiBtn\s*\{[^}]*\}/)?.[0] || '';
  // 颜色改走主题变量：主色底 + 主色上文字
  assert.match(ai, /background:\s*var\(--color-primary\)/);
  assert.match(ai, /color:\s*var\(--color-on-primary\)/);
  assert.doesNotMatch(ai, /rgba\(142,\s*33,\s*53,\s*0\.12\)/);
});

test('generateGameCover_超时应长于上传120s', () => {
  const base = read('src/api/base.ts');
  const editor = read('src/api/galgame/EditorData.ts');
  assert.match(base, /COVER_GENERATE_TIMEOUT_MS\s*=\s*600000/);
  assert.match(editor, /timeout:\s*COVER_GENERATE_TIMEOUT_MS/);
  assert.doesNotMatch(
    editor.match(/generateGameCover:[\s\S]*?\},\s*\{[\s\S]*?timeout:[^,]+/)?.[0] || '',
    /UPLOAD_TIMEOUT_MS/,
  );
  const zh = read('src/i18n/locales/zh.json');
  assert.match(zh, /"aiGenerateTimeout":\s*"[^"]*超时/);
});

test('CoverUpload_提示词占位_无样式示例芯片', () => {
  const zh = read('src/i18n/locales/zh.json');
  const en = read('src/i18n/locales/en.json');
  const tsx = read('src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx');
  assert.match(zh, /"promptPlaceholder":\s*"[^"]*画风[^"]*色调/);
  assert.match(zh, /"promptModalHintWithRef":\s*"[^"]*沿用参考图标题/);
  assert.doesNotMatch(zh, /"titleStyleLabel"/);
  assert.doesNotMatch(tsx, /POSTER_TITLE_STYLE_ORDER|titleStyleId|coverBriefStyleRow/);
  assert.match(en, /"promptPlaceholder":\s*"[^"]*Scene style/i);
  assert.match(en, /keep the reference title style/i);
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

test('uploadGameCover_FormData不得手写multipart_且拦截器清除Content-Type', () => {
  const editor = read('src/api/galgame/EditorData.ts');
  const uploadBlock = editor.match(/uploadGameCover:[\s\S]*?\},\s*\n\s*\/\*\*/)?.[0]
    || editor.match(/uploadGameCover:[\s\S]*?UPLOAD_TIMEOUT_MS[\s\S]*?\},/)?.[0]
    || '';
  assert.match(uploadBlock, /new FormData\(\)/);
  assert.match(uploadBlock, /orientation/);
  assert.doesNotMatch(uploadBlock, /Content-Type['"]?\s*:\s*['"]multipart\/form-data/);

  const base = read('src/api/base.ts');
  assert.match(base, /config\.data instanceof FormData/);
  assert.match(base, /setContentType\(false\)|delete\(['"]Content-Type['"]\)/);

  const zh = JSON.parse(read('src/i18n/locales/zh.json'));
  assert.match(String(zh?.common?.coverUpload?.uploadFailed || ''), /封面上传失败/);
  assert.doesNotMatch(String(zh?.common?.coverUpload?.uploadFailed || ''), /Failed to upload cover/);
});
