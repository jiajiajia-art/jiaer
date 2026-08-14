/**
 * 源码取消/退出后强制恢复可视化内容
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isRichEditorVisualEmpty,
  shouldForceRestoreVisualAfterSourceExit,
} from '../src/utils/richEditorSourceRestore.ts';

test('isRichEditorVisualEmpty_detects blank shells', () => {
  assert.equal(isRichEditorVisualEmpty(''), true);
  assert.equal(isRichEditorVisualEmpty('<br>'), true);
  assert.equal(isRichEditorVisualEmpty('<p></p>'), true);
  assert.equal(isRichEditorVisualEmpty('<p>hi</p>'), false);
  assert.equal(isRichEditorVisualEmpty('<p><img src="/public/a.webp"></p>'), false);
});

test('shouldForceRestoreVisualAfterSourceExit_when dom emptied after cancel', () => {
  assert.equal(
    shouldForceRestoreVisualAfterSourceExit({
      sourceMode: false,
      valueHtml: '<p>简介<img src="/public/a.webp"></p>',
      lastEmittedHtml: '<p>简介<img src="/public/a.webp"></p>',
      visualInnerHTML: '',
    }),
    true,
  );
  assert.equal(
    shouldForceRestoreVisualAfterSourceExit({
      sourceMode: true,
      valueHtml: '<p>简介</p>',
      lastEmittedHtml: '<p>简介</p>',
      visualInnerHTML: '',
    }),
    false,
  );
  assert.equal(
    shouldForceRestoreVisualAfterSourceExit({
      sourceMode: false,
      valueHtml: '<p>简介</p>',
      lastEmittedHtml: '<p>简介</p>',
      visualInnerHTML: '<p>简介</p>',
    }),
    false,
  );
});
