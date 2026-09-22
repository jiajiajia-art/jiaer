/**
 * 海报标题换行：优先冒号断行，避免末行单字。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapPosterTitleLines } from '../src/lib/galgame/wrapPosterTitleLines.ts';

/** 等宽测宽：每字宽度 1 */
const measure = (s) => [...s].length;

test('wrapPosterTitleLines_能一行则不折', () => {
  assert.deepEqual(
    wrapPosterTitleLines('短标题', 10, measure, 2),
    ['短标题'],
  );
});

test('wrapPosterTitleLines_优先在冒号后断行', () => {
  const title = '大学毕业第一份工作：送外卖';
  const lines = wrapPosterTitleLines(title, 12, measure, 2);
  assert.deepEqual(lines, ['大学毕业第一份工作：', '送外卖']);
});

test('wrapPosterTitleLines_禁止末行只剩单字', () => {
  // 强制在「送外」后折出「卖」时，应回挪成「送 / 外卖」或「…外 / 卖」→ 挪成两字
  const title = 'abcdefghijklm'; // 用拉丁模拟长度；中文测宽另测
  const lines = wrapPosterTitleLines('一二三四五六七八九十卖', 10, measure, 2);
  assert.equal(lines.length, 2);
  assert.notEqual([...lines[1]].length, 1);
});
