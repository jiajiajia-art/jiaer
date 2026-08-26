/**
 * 首页推荐曝光收集纯函数
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectRecommendExposeItems } from '../src/lib/homeRecommendExpose.ts';

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
