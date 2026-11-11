/**
 * Galgame play-ui 缓存接口解析兼容性单测。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePlayUiJson } from '../src/lib/galgame/playUiState.ts';

test('parsePlayUiJson_解析标准JSON', () => {
  assert.equal(parsePlayUiJson('{"success":true}').success, true);
});

test('parsePlayUiJson_兼容SSEData行', () => {
  const parsed = parsePlayUiJson('event: message\ndata: {"success":true,"data":{"attributePanels":{"属性":"体力：72"}}}\n\n');
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.attributePanels['属性'], '体力：72');
});

test('parsePlayUiJson_多条SSE取最后一个可解析Data', () => {
  const parsed = parsePlayUiJson('data: {"type":"start"}\n\ndata: {"success":true,"data":{"quests":[]}}\n\n');
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.quests, []);
});

test('parsePlayUiJson_兼容前后混杂文本', () => {
  assert.equal(parsePlayUiJson('notice\n{"success":true}\ndone').success, true);
});

test('parsePlayUiJson_坏数据返回null', () => {
  assert.equal(parsePlayUiJson('data: [DONE]'), null);
});
