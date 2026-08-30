/**
 * 问题2：任务追踪顶栏用词清洗
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getQuestTrackerLabel,
  normalizeQuestItem,
  sanitizeQuestObjectiveText,
} from '../src/lib/galgame/quests.ts';

test('sanitizeQuestObjectiveText_向游戏询问应改为弄清当前处境', () => {
  const out = sanitizeQuestObjectiveText('向游戏询问当前的详细情况');
  assert.doesNotMatch(out, /向游戏/);
  assert.doesNotMatch(out, /详细情况/);
  assert.match(out, /弄清/);
});

test('getQuestTrackerLabel_展示前应已清洗出戏用词', () => {
  const item = normalizeQuestItem({
    id: 'q1',
    title: '主线',
    goalText: '向游戏询问当前的详细情况',
    type: 'main',
    status: 'active',
    tracked: true,
  });
  const label = getQuestTrackerLabel(item);
  assert.doesNotMatch(label, /向游戏/);
  assert.match(label, /弄清/);
});
