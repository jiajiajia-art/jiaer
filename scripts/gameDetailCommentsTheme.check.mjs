/**
 * 详情页评论区暗色效果图接线（结构/文案，不改接口）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('GameRating_comments模式应对齐效果图暗色与标题顺序', () => {
  const tsx = read('src/components/GameRating/GameRating.tsx');
  const css = read('src/components/GameRating/GameRating.module.css');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(tsx, /gameRating\.commentsSection/);
  assert.match(tsx, /gameRating\.latestSort/);
  assert.match(tsx, /styles\.sortPill/);
  assert.match(tsx, /data-mode=\{mode\}/);
  /* 功能注释：评论区标题出现在输入框之前（效果图顺序） */
  assert.match(
    tsx,
    /commentsSection[\s\S]*?writeForm[\s\S]*?commentsSection/,
  );
  assert.match(css, /\[data-mode='comments'\]/);
  assert.match(css, /\.sortPill/);
  assert.match(css, /\[data-mode='comments'\][\s\S]*\.commentInput[\s\S]*(?:#141416|var\(--|color-mix\()/);
  assert.match(css, /\[data-mode='comments'\][\s\S]*\.submitBtn[\s\S]*(?:#252528|var\(--|color-mix\()/);
  assert.match(zh, /"commentsSection":\s*"评论区"/);
  assert.match(zh, /"latestSort":\s*"最新发布"/);
  assert.match(zh, /"submit":\s*"发表评论"/);
  assert.match(zh, /"commentPlaceholder":\s*"说说你的游玩感受……最多500字"/);
});
