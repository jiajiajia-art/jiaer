/**
 * 自定义上传体积预检契约
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkCustomUiUploadSize,
  DEFAULT_CUSTOM_UI_MAX_TOTAL_BYTES,
} from '../src/lib/customUiUploadSize.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('checkCustomUiUploadSize_145MB在200MB内应通过', () => {
  const r = checkCustomUiUploadSize({ totalBytes: 145.1 * 1024 * 1024 });
  assert.equal(r.ok, true);
  assert.equal(DEFAULT_CUSTOM_UI_MAX_TOTAL_BYTES, 200 * 1024 * 1024);
});

test('checkCustomUiUploadSize_超过总上限应拒绝', () => {
  const r = checkCustomUiUploadSize({ totalBytes: 250 * 1024 * 1024 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, 'TOTAL_TOO_LARGE');
});

test('CustomIFCreate_应调用体积预检', () => {
  const src = readFileSync(join(root, 'src/page/CustomIFCreate.tsx'), 'utf8');
  assert.match(src, /checkCustomUiUploadSize/);
});
