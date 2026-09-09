/**
 * 首页推荐曝光收集纯函数
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectRecommendExposeItems,
  shouldReportRecommendExpose,
} from '../src/lib/homeRecommendExpose.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('collectRecommendExposeItems_应去重并忽略无campaign', () => {
  const items = collectRecommendExposeItems([
    { file_id: 'a', campaign_id: 1 },
    { fileId: 'a', campaignId: 1 },
    { file_id: 'b' },
    { file_id: 'c', campaign_id: 2 },
  ]);
  assert.deepEqual(items, [
    { fileId: 'a', campaignId: 1 },
    { fileId: 'c', campaignId: 2 },
  ]);
});

test('collectRecommendExposeItems_空列表', () => {
  assert.deepEqual(collectRecommendExposeItems([]), []);
  assert.deepEqual(collectRecommendExposeItems(null), []);
});

test('shouldReportRecommendExpose_仅登录态上报', () => {
  assert.equal(shouldReportRecommendExpose(true), true);
  assert.equal(shouldReportRecommendExpose(false), false);
});

test('Home_推荐曝光应在未登录时跳过避免401', () => {
  const home = readFileSync(join(root, 'src/page/Home.tsx'), 'utf8');
  assert.match(home, /shouldReportRecommendExpose/);
  assert.match(
    home,
    /shouldReportRecommendExpose\(\s*useAuthStore\.getState\(\)\.isAuthenticated\s*\)/,
  );
});
