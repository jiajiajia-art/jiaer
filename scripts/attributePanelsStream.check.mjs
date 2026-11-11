/**
 * 属性面板 SSE 解析：fence / 截取花括号（单测）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonFromStreamText } from '../src/lib/galgame/attributePanelValues.ts';

test('extractJsonFromStreamText_应解析纯JSON', () => {
  const data = extractJsonFromStreamText('{"panels":{"属性":"敏捷：1"}}');
  assert.equal(typeof data, 'object');
  assert.equal(data.panels['属性'], '敏捷：1');
});

test('extractJsonFromStreamText_应解析markdown fence', () => {
  const data = extractJsonFromStreamText('```json\n{"panels":{"属性":"力量：2"}}\n```');
  assert.equal(data.panels['属性'], '力量：2');
});

test('extractJsonFromStreamText_前后杂质仍能截取对象', () => {
  const data = extractJsonFromStreamText('说明如下\n{"panels":{"属性":"洞察：3"}}\n完');
  assert.equal(data.panels['属性'], '洞察：3');
});

test('extractJsonFromStreamText_空或非法返回null', () => {
  assert.equal(extractJsonFromStreamText(''), null);
  assert.equal(extractJsonFromStreamText('不是json'), null);
});
