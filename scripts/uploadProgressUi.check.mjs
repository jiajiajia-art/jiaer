/**
 * 上传进度浮层：样式对齐暗色主站；自定义游戏成功态展示立刻去测试 + 取消
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('UploadProgress_默认仍支持完成自动关闭', () => {
  const tsx = read('src/components/CreateGame/UploadProgress.tsx');
  assert.match(tsx, /autoCloseOnComplete\s*=\s*true/);
  assert.match(tsx, /onPrimaryRef\.current/);
  assert.match(tsx, /setTimeout/);
  assert.match(tsx, /showManualActions/);
});

test('UploadProgress_取消按钮缺文案时应回落到cancelUpload', () => {
  const tsx = read('src/components/CreateGame/UploadProgress.tsx');
  const custom = read('src/page/CustomIFCreate.tsx');
  assert.match(tsx, /resolvedCancelText/);
  assert.match(tsx, /createGame\.cancelUpload/);
  assert.match(custom, /cancelText=\{t\('createGame\.cancelUpload'\)\}/);
});

test('UploadProgress_取消与进度条应对齐通栏卡片风格_禁止红描边胶囊', () => {
  const css = read('src/components/CreateGame/UploadProgress.module.css');
  const cancel = css.match(/\.cancelUploadBtn\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(cancel, /width:\s*100%/);
  assert.match(cancel, /border-radius:\s*14px/);
  assert.match(cancel, /background:\s*var\(--dock-input\)/);
  assert.doesNotMatch(cancel, /border-radius:\s*999px/);
  assert.doesNotMatch(cancel, /color:\s*#ffb4bf/i);
  assert.match(css, /\.uploadProgressBar\s*\{[\s\S]*?height:\s*5px/);
  assert.doesNotMatch(css, /\.uploadProgressBar\s*\{[^}]*height:\s*10px/);
  assert.match(css, /\.uploadProgressFillDone\s*\{/);
});

test('CustomIFCreate_成功态应立刻去测试与取消_成功toast须盖住遮罩', () => {
  const custom = read('src/page/CustomIFCreate.tsx');
  const app = read('src/App.tsx');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(custom, /autoCloseOnComplete=\{false\}/);
  assert.match(custom, /customIFCreate\.goTestNow/);
  assert.match(custom, /customIFCreate\.dismissUploadResult/);
  assert.match(custom, /onSecondary=\{/);
  assert.match(custom, /navigate\(`\/customif\/\$\{id\}`\)/);
  assert.match(custom, /toast\.success\([\s\S]*uploadSuccess/);
  assert.match(zh, /"goTestNow":\s*"立刻去测试"/);
  assert.match(zh, /"dismissUploadResult":\s*"取消"/);
  // 功能注释：Toaster 须高于 UploadProgress 遮罩 9999
  assert.match(app, /zIndex:\s*11000/);
});

test('CustomIFCreate_按钮文案前应带对应icon', () => {
  const custom = read('src/page/CustomIFCreate.tsx');
  const css = read('src/page/CustomIFCreate.module.css');
  const progress = read('src/components/CreateGame/UploadProgress.tsx');
  // 功能注释：二次确认、主次 CTA、上传进度成功态均须有前导图标
  assert.match(custom, /HiOutlineCloudUpload/);
  assert.match(custom, /HiOutlinePlay/);
  assert.match(custom, /HiOutlineX/);
  assert.match(custom, /btnGhost[\s\S]*HiOutlineX[\s\S]*common\.cancel/);
  assert.match(custom, /btnPrimary[\s\S]*HiOutlineCloudUpload[\s\S]*confirmUpload/);
  assert.match(custom, /primaryIcon=\{<HiOutlineX\s*\/>\}/);
  assert.match(custom, /secondaryIcon=\{<HiOutlinePlay\s*\/>\}/);
  assert.match(custom, /cancelIcon=\{<HiOutlineX\s*\/>\}/);
  assert.match(css, /\.btnLabel\s*\{/);
  assert.match(css, /\.btnIcon\s*\{/);
  assert.match(progress, /cancelIcon/);
  assert.match(progress, /primaryIcon/);
  assert.match(progress, /secondaryIcon/);
  assert.match(progress, /ButtonLabel/);
});

test('AssetsUpload_成功路径仍提示上传成功', () => {
  const assets = read('src/components/StGame/AssetsUpload.tsx');
  assert.match(assets, /toast\.success\([\s\S]*assetsUploadSuccess/);
  assert.match(assets, /<UploadProgress/);
});
