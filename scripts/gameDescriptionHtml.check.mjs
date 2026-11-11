/**
 * 游戏简介 HTML：旧纯文本兼容、消毒、字数按纯文本计
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NOVEL_DESCRIPTION_MAX_LENGTH,
  descriptionToPlainText,
  looksLikeHtml,
  normalizeDescriptionForSave,
  plainTextToHtml,
  sanitizeDescriptionHtml,
  toEditorHtml,
  validateDescriptionContent,
} from '../src/utils/gameDescriptionHtml.ts';

test('plain legacy description_loads as paragraphs', () => {
  const html = toEditorHtml('第一行\n第二行');
  assert.match(html, /<p>第一行<\/p>/);
  assert.match(html, /<p>第二行<\/p>/);
  assert.equal(descriptionToPlainText(html), '第一行\n第二行');
});

test('existing html_is sanitized and kept', () => {
  const raw = '<p>你好<script>alert(1)</script></p><img src="/public/a.webp" onerror="x"><a href="javascript:alert(1)">x</a>';
  const html = sanitizeDescriptionHtml(raw);
  assert.doesNotMatch(html, /script/i);
  assert.doesNotMatch(html, /onerror/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /\/public\/a\.webp/);
});

test('validateDescriptionContent_counts plain text not tags', () => {
  const longPlain = '字'.repeat(NOVEL_DESCRIPTION_MAX_LENGTH);
  const wrapped = `<p><b>${longPlain}</b></p>`;
  assert.equal(validateDescriptionContent(wrapped).valid, true);

  const tooLong = `<p>${'字'.repeat(NOVEL_DESCRIPTION_MAX_LENGTH + 1)}</p>`;
  assert.equal(validateDescriptionContent(tooLong).error, 'DESCRIPTION_TOO_LONG');
});

test('normalizeDescriptionForSave_empty shells become empty', () => {
  assert.equal(normalizeDescriptionForSave('<p><br></p>'), '');
  assert.equal(normalizeDescriptionForSave('   '), '');
  assert.ok(looksLikeHtml(plainTextToHtml('hi')));
});

test('description image src_normalize and hydrate', async () => {
  const {
    normalizeDescriptionImageSrc,
    resolveDescriptionImageSrc,
    normalizeDescriptionHtmlForSave,
    hydrateDescriptionHtmlForDisplay,
  } = await import('../src/utils/gameDescriptionHtml.ts');

  assert.equal(
    normalizeDescriptionImageSrc('https://api.example.com/public/a.webp', 'https://api.example.com'),
    '/public/a.webp',
  );
  assert.equal(
    resolveDescriptionImageSrc('/public/a.webp', (p) => `https://cdn.test${p}`),
    'https://cdn.test/public/a.webp',
  );

  const saved = normalizeDescriptionHtmlForSave(
    '<p><img src="https://api.example.com/public/x.webp"></p>',
    'https://api.example.com',
  );
  assert.match(saved, /src="\/public\/x\.webp"/);

  const shown = hydrateDescriptionHtmlForDisplay(
    '<p><img src="/public/x.webp"></p>',
    (p) => `https://cdn.test${p}`,
  );
  assert.match(shown, /src="https:\/\/cdn\.test\/public\/x\.webp"/);
});
