/** 玩家侧评分展示：五星平均 ×2 十分制；无人评分显示暂无，禁止写死 9.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = process.cwd();
const mod = await import(pathToFileURL(join(root, 'src/utils/ratingDisplay.ts')).href);

test('ratingDisplay_五星换算十分制', () => {
  assert.deepEqual(mod.resolveRatingDisplay(4.5, 12), { hasScore: true, score: '9.0', count: 12 });
  assert.deepEqual(mod.resolveRatingDisplay('3.26', 3), { hasScore: true, score: '6.5', count: 3 });
  assert.equal(mod.resolveRatingDisplay(7, 2).score, '10.0', '越界按 5 星封顶');
});

test('ratingDisplay_无人评分显示暂无', () => {
  assert.equal(mod.resolveRatingDisplay(null, 0).hasScore, false);
  assert.equal(mod.resolveRatingDisplay(4.2, 0).hasScore, false);
  assert.equal(mod.resolveRatingDisplay(0, 5).hasScore, false);
});

test('GameDetail_不再写死默认评分', () => {
  const src = readFileSync(join(root, 'src/page/GameDetail.tsx'), 'utf8');
  assert.doesNotMatch(src, /DEFAULT_RATING|'9\.0'/);
  assert.match(src, /resolveRatingDisplay/);
});

test('GameRating_排序可点击且传 sort', () => {
  const src = readFileSync(join(root, 'src/components/GameRating/GameRating.tsx'), 'utf8');
  assert.doesNotMatch(src, /sortPill\} aria-hidden/);
  assert.match(src, /getRatings\(fileId, pageNum, PAGE_SIZE, sortMode\)/);
});
