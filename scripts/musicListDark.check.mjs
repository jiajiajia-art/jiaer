/**
 * BGM 库空状态对齐效果图：墨底卡、描边空井、底栏酒红上传胶囊
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('MusicList_空状态应为墨底描边井加底栏酒红上传胶囊', () => {
  const css = read('src/components/GameSettingEditor/UploadMusic/MusicList.module.css');
  const tsx = read('src/components/GameSettingEditor/UploadMusic/MusicList.tsx');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(css, /\.musicListContainer\s*\{[\s\S]*?background:\s*(?:#1C1C1E|var\(--|color-mix\()/);
  assert.match(css, /\.emptyState\s*\{[\s\S]*?background:\s*(?:#0E0E10|var\(--|color-mix\()/);
  assert.match(css, /\.emptyState\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /\.emptyIconWrap\s*\{[\s\S]*?border-radius:\s*50%/);
  assert.match(css, /\.uploadCta\s*\{[\s\S]*?background:\s*(?:#8E2135|var\(--|color-mix\()/);
  assert.match(css, /\.uploadCta\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.musicListContainer\s*\{[\s\S]*?gap:\s*12px/);
  assert.doesNotMatch(css, /\.musicListContainer\s*\{[\s\S]*?background:\s*#fff/);
  assert.doesNotMatch(css, /\.emptyState\s*\{[\s\S]*?padding:\s*60px/);
  assert.match(tsx, /uploadCta/);
  assert.match(tsx, /MdLibraryMusic/);
  assert.match(tsx, /MdUpload/);
  assert.doesNotMatch(tsx, /ghostSmall/);
  assert.doesNotMatch(tsx, /🎵/);
  assert.match(zh, /"bgmLibrary":\s*"BGM音乐库"/);
});
