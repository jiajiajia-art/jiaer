/**
 * 简介编辑器回车插入 br
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RICH_EDITOR_LINE_BREAK_HTML,
  insertRichEditorLineBreak,
  shouldInsertLineBreakOnKeyDown,
} from '../src/utils/richEditorEnter.ts';

test('shouldInsertLineBreakOnKeyDown_only plain Enter', () => {
  assert.equal(shouldInsertLineBreakOnKeyDown({ key: 'Enter' }), true);
  assert.equal(shouldInsertLineBreakOnKeyDown({ key: 'Enter', shiftKey: true }), true);
  assert.equal(shouldInsertLineBreakOnKeyDown({ key: 'Enter', isComposing: true }), false);
  assert.equal(shouldInsertLineBreakOnKeyDown({ key: 'Enter', ctrlKey: true }), false);
  assert.equal(shouldInsertLineBreakOnKeyDown({ key: 'a' }), false);
});

test('insertRichEditorLineBreak_prefers insertLineBreak then html', () => {
  const calls = [];
  const ok = insertRichEditorLineBreak((commandId, showUI, value) => {
    calls.push({ commandId, showUI, value });
    return commandId === 'insertLineBreak';
  });
  assert.equal(ok, true);
  assert.equal(calls[0].commandId, 'insertLineBreak');

  const calls2 = [];
  const ok2 = insertRichEditorLineBreak((commandId, showUI, value) => {
    calls2.push({ commandId, showUI, value });
    return commandId === 'insertHTML';
  });
  assert.equal(ok2, true);
  assert.equal(calls2[0].commandId, 'insertLineBreak');
  assert.equal(calls2[1].commandId, 'insertHTML');
  assert.match(String(calls2[1].value || ''), new RegExp(RICH_EDITOR_LINE_BREAK_HTML));
});
