/**
 * 功能注释：排行榜简介须剥 HTML，禁止新作榜/飙升榜等子榜卡片露出 <p> 标签。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRankingsPlainDescription } from '../src/lib/rankingsUi.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rankingsPage = readFileSync(join(root, 'src/page/Rankings.tsx'), 'utf8');

test('榜单简介须剥HTML标签_禁止露出p标签', () => {
  assert.equal(
    resolveRankingsPlainDescription('<p>故事发生在2026年的现代都市</p>'),
    '故事发生在2026年的现代都市',
  );
  assert.equal(
    resolveRankingsPlainDescription('<p>第一行</p><p>第二行</p>'),
    '第一行 第二行',
  );
  assert.equal(
    resolveRankingsPlainDescription('<!--StartFragment--><p>传说，嫦娥吞下仙药</p>'),
    '传说，嫦娥吞下仙药',
  );
  assert.equal(resolveRankingsPlainDescription('纯文本简介'), '纯文本简介');
  assert.equal(resolveRankingsPlainDescription(''), '');
  assert.doesNotMatch(resolveRankingsPlainDescription('<p>有标签</p>'), /<p>/);
});

test('Rankings页面映射须走纯文本简介', () => {
  assert.match(rankingsPage, /resolveRankingsPlainDescription/);
  assert.match(
    rankingsPage,
    /plainDescription|resolveRankingsPlainDescription\(item\.description/,
  );
  assert.doesNotMatch(
    rankingsPage,
    /description:\s*item\.description\s*\|\|\s*''/,
  );
});
