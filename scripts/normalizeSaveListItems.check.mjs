/**
 * 存档列表字段归一化单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeSaveListItem,
  normalizeSaveListItems,
} from '../src/lib/galgame/normalizeSaveListItems.ts';
import {
  buildLoadedSaveStorePatch,
  shouldEnterGalgameAfterLoadSave,
} from '../src/lib/galgame/loadSaveSessionGate.ts';

test('normalizeSaveListItem_后端 summaryPreview 应映射为 summaryText', () => {
  const item = normalizeSaveListItem({
    saveId: 's1',
    summaryPreview: '草稿箱里存下的进度摘要够十个字',
    createdAt: 1710000000000,
  });
  assert.ok(item);
  assert.equal(item.saveId, 's1');
  assert.equal(item.summaryText, '草稿箱里存下的进度摘要够十个字');
  assert.equal(item.createdAt, 1710000000000);
});

test('normalizeSaveListItem_优先使用 summaryText', () => {
  const item = normalizeSaveListItem({
    saveId: 's2',
    summaryText: '完整摘要',
    summaryPreview: '截断',
    createdAt: 1,
  });
  assert.equal(item?.summaryText, '完整摘要');
});

test('normalizeSaveListItem_无 saveId 应丢弃', () => {
  assert.equal(normalizeSaveListItem({ summaryPreview: 'x', createdAt: 1 }), null);
  assert.equal(normalizeSaveListItem(null), null);
});

test('normalizeSaveListItems_非法输入返回空数组', () => {
  assert.deepEqual(normalizeSaveListItems(null), []);
  assert.deepEqual(normalizeSaveListItems('bad'), []);
  assert.equal(normalizeSaveListItems([{ saveId: 'a', summaryPreview: 'hello world!!', createdAt: 9 }]).length, 1);
});

test('shouldEnterGalgameAfterLoadSave_必须同时有 fileId 与 sessionId', () => {
  assert.equal(shouldEnterGalgameAfterLoadSave({ fileId: 'f1', sessionId: 's1' }), true);
  assert.equal(shouldEnterGalgameAfterLoadSave({ fileId: '', sessionId: 's1' }), false);
  assert.equal(shouldEnterGalgameAfterLoadSave({ fileId: 'f1', sessionId: null }), false);
});

test('buildLoadedSaveStorePatch_缺一返回 null', () => {
  assert.deepEqual(buildLoadedSaveStorePatch({ fileId: ' f1 ', sessionId: ' s1 ' }), {
    fileId: 'f1',
    sessionId: 's1',
  });
  assert.equal(buildLoadedSaveStorePatch({ fileId: '', sessionId: 's1' }), null);
});
