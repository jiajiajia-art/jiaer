/**
 * 我的资产：分页 totalPages 不得写死为 1，且支持滚动加载更多
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('AssetDetails uses payload.totalPages and IntersectionObserver load-more', () => {
  const src = readFileSync(join(root, 'src/page/AssetDetails.tsx'), 'utf8');
  assert.doesNotMatch(src, /setTotalPages\(1\);\s*setPage\(nextPage\)/);
  assert.match(src, /payload\.totalPages/);
  assert.match(src, /IntersectionObserver/);
  assert.match(src, /loadMoreSentinelRef/);
  assert.match(src, /hasMore/);
});

test('PointsDetails and DiamondsDetails read totalPages from API', () => {
  const points = readFileSync(join(root, 'src/page/PointsDetails.tsx'), 'utf8');
  const diamonds = readFileSync(join(root, 'src/page/DiamondsDetails.tsx'), 'utf8');
  assert.match(points, /payload\.totalPages/);
  assert.match(diamonds, /payload\.totalPages/);
  assert.doesNotMatch(points, /setTotalPages\(1\);\s*setPage\(nextPage\)/);
  assert.doesNotMatch(diamonds, /setTotalPages\(1\);\s*setPage\(nextPage\)/);
});
