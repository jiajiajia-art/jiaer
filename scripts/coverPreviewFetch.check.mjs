/**
 * 功能注释：封面预取与 bumpCacheBust 契约，避免 AI 生图后裂图回归。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('resolveCoverPreviewSrc_应预取并带重试', () => {
  const src = read('src/utils/resolveCoverPreviewSrc.ts');
  assert.match(src, /export async function resolveCoverPreviewSrc/);
  assert.match(src, /retries/);
  assert.match(src, /cache:\s*['"]no-store['"]/);
  assert.match(src, /bumpCacheBust/);
});

test('bumpCacheBust_应立刻写入新时间戳而非只delete', () => {
  const src = read('src/utils/imageCache.ts');
  assert.match(src, /imageCacheBustMap\.delete\(cleanUrl\)/);
  assert.match(src, /imageCacheBustMap\.set\(cleanUrl,\s*`\$\{cleanUrl\}/);
});

test('CoverUpload_生图后应预取预览且空coverUrl不清空', () => {
  const tsx = read('src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx');
  assert.match(tsx, /resolveCoverPreviewSrc/);
  assert.match(tsx, /applyCoverPreview/);
  assert.match(tsx, /if \(coverUrl\) setLandscapePreview\(coverUrl\)/);
  assert.match(tsx, /if \(portraitCoverUrl\) setPortraitPreview\(portraitCoverUrl\)/);
  assert.doesNotMatch(tsx, /setLandscapePreview\(coverUrl \|\| null\)/);
  assert.match(tsx, /onError/);
  assert.match(tsx, /dataset\.coverRetry/);
});
