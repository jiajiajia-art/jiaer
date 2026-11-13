/**
 * 上传音乐弹窗：白纸表单 + 虚线投递区 + 描边双按钮，对齐效果图
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UPLOAD_MUSIC_MAX_BYTES,
  isValidUploadMusicExtension,
  rejectUploadMusicFile,
} from '../src/components/GameSettingEditor/UploadMusic/uploadMusicValidation.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('UploadMusicModal_应对齐白纸弹层与虚线投递区', () => {
  const css = read('src/components/GameSettingEditor/UploadMusic/UploadMusicModal.module.css');
  const tsx = read('src/components/GameSettingEditor/UploadMusic/UploadMusicModal.tsx');
  const zh = read('src/i18n/locales/zh.json');

  assert.match(css, /\.modalContent\s*\{[\s\S]*?background:\s*(?:#ffffff|var\(--|color-mix\()/);
  assert.match(css, /\.uploadArea\s*\{[\s\S]*?border:\s*1px dashed/);
  assert.match(css, /\.footerBtn\s*\{[\s\S]*?background:\s*(?:#ffffff|var\(--|color-mix\()/);
  assert.match(css, /--music-modal-accent:\s*(?:#8e2135|var\(--|color-mix\()/);
  assert.match(css, /--music-modal-required:\s*(?:#e03d4b|var\(--|color-mix\()/);
  assert.doesNotMatch(css, /\.ghostSmall/);

  assert.match(tsx, /rejectUploadMusicFile/);
  assert.match(tsx, /bgmDescriptionPlaceholder/);
  assert.match(tsx, /type="button"/);
  assert.match(tsx, /role="dialog"/);
  assert.doesNotMatch(tsx, /styles\.ghostSmall/);

  assert.match(zh, /"bgmDescriptionPlaceholder":\s*"BGM 描述"/);
  assert.match(zh, /"uploadMusicDropHint":\s*"点击或拖拽文件到此处上传"/);
  assert.match(zh, /"confirmUpload":\s*"确认上传"/);
});

test('rejectUploadMusicFile_应拒绝非法扩展名与超限体积', () => {
  assert.equal(isValidUploadMusicExtension('theme.mp3'), true);
  assert.equal(isValidUploadMusicExtension('theme.TXT'), false);
  assert.equal(rejectUploadMusicFile({ name: 'a.wav', size: 1024 }), null);
  assert.equal(rejectUploadMusicFile({ name: 'a.exe', size: 1024 }), 'invalid');
  assert.equal(
    rejectUploadMusicFile({ name: 'a.mp3', size: UPLOAD_MUSIC_MAX_BYTES + 1 }),
    'too_large',
  );
  assert.equal(rejectUploadMusicFile({ name: 'a.flac', size: UPLOAD_MUSIC_MAX_BYTES }), null);
});
