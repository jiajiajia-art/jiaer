/**
 * 简介编辑器源码模式：应用 / 打开草稿
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRichEditorSourceHtml,
  openRichEditorSourceDraft,
} from '../src/utils/richEditorSource.ts';

test('openRichEditorSourceDraft_normalizes visual html', () => {
  const draft = openRichEditorSourceDraft(
    '<p>hi<img src="https://api.example.com/public/a.webp"></p>',
    'https://api.example.com',
  );
  assert.match(draft, /hi/);
  assert.match(draft, /\/public\/a\.webp/);
});

test('applyRichEditorSourceHtml_strips scripts and keeps safe tags', () => {
  const result = applyRichEditorSourceHtml(
    '<p>ok<script>evil()</script><img src="/public/x.webp"><br></p>',
    '',
  );
  assert.match(result.html, /ok/);
  assert.doesNotMatch(result.html, /script/i);
  assert.match(result.html, /\/public\/x\.webp/);
  assert.ok(result.plainLength >= 2);
});

test('applyRichEditorSourceHtml_empty shells become empty', () => {
  assert.equal(applyRichEditorSourceHtml('<p><br></p>').html, '');
});
