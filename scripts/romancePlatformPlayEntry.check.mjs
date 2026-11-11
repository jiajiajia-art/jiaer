/**
 * 玩家 / 审核预览进局入口：URL 解析与发布包 / 待审 API 路径
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const src = () => readFileSync(join(romance, 'lib/platformRomancePlay.ts'), 'utf8');

test('platformRomancePlay_解析play与reviewPreview', () => {
  const text = src();
  assert.match(text, /q\.get\("reviewPreview"\) === "1"/);
  assert.match(text, /q\.get\("play"\) === "1"/);
  assert.match(text, /export function resolveRomancePlayMode/);
  assert.match(text, /export type RomancePlayMode/);
  assert.match(text, /"play"/);
  assert.match(text, /"reviewPreview"/);
});

test('platformRomancePlay_发布与待审路径分离', () => {
  const text = src();
  assert.match(text, /\/api\/games\/romance\/.*\/published-content/);
  assert.match(text, /\/api\/admin\/moderation\/publish-queue\/.*\/romance-content/);
  assert.match(text, /fetchRomancePublishedContent/);
  assert.match(text, /fetchRomancePendingReviewContent/);
  assert.doesNotMatch(text, /drafts\/romance/);
});
