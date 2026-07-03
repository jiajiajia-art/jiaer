/**
 * morePromptForms 前端校验单测（规则与后端 morePromptForms.js 对齐）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MORE_PROMPT_FORMS_MAX_COUNT,
  MORE_PROMPT_DESCRIPTION_MAX_LENGTH,
  MORE_PROMPT_TITLE_MAX_LENGTH,
  countUnicodeChars,
  normalizeMorePromptForm,
  validateMorePromptFormDraft,
  validateMorePromptFormsList,
  isMorePromptPanel,
  parseMorePromptPanel,
  buildMorePromptPanelId,
  MORE_PROMPT_NEW_PANEL,
} from '../src/utils/morePromptForms.ts';

function createValidDraft(overrides = {}) {
  return {
    id: 'draft-1',
    title: 'Title',
    description: '描述',
    content: 'Body content',
    order: 0,
    enabled: true,
    ...overrides,
  };
}

test('countUnicodeChars counts CJK and emoji code points', () => {
  assert.equal(countUnicodeChars(''), 0);
  assert.equal(countUnicodeChars('abc'), 3);
  assert.equal(countUnicodeChars('一二三四五'), 5);
  assert.equal(countUnicodeChars('Hi👋'), 3);
});

test('normalizeMorePromptForm trims and assigns order', () => {
  const normalized = normalizeMorePromptForm({
    id: '  x ',
    title: '  Title ',
    description: ' d ',
    content: ' c ',
    enabled: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }, 3);

  assert.equal(normalized.id, 'x');
  assert.equal(normalized.title, 'Title');
  assert.equal(normalized.order, 3);
  assert.equal(normalized.enabled, false);
  assert.equal(normalized.updatedAt, '2026-01-01T00:00:00.000Z');
});

test('validateMorePromptFormDraft rejects whitespace-only required fields', () => {
  assert.equal(
    validateMorePromptFormDraft({ title: '   ', description: 'ok', content: 'ok' }),
    'createGame.morePrompt.validationTitle',
  );
  assert.equal(
    validateMorePromptFormDraft({ title: 'ok', description: '   ', content: 'ok' }),
    'createGame.morePrompt.validationDescription',
  );
  assert.equal(
    validateMorePromptFormDraft({ title: 'ok', description: 'ok', content: '   ' }),
    'createGame.morePrompt.validationContent',
  );
});

test('validateMorePromptFormDraft rejects title over max length', () => {
  assert.equal(
    validateMorePromptFormDraft({
      title: 'x'.repeat(MORE_PROMPT_TITLE_MAX_LENGTH + 1),
      description: 'ok',
      content: 'ok',
    }),
    'createGame.morePrompt.validationTitle',
  );
});

test('validateMorePromptFormDraft accepts description at exact max length', () => {
  const exact15 = '123456789012345';
  assert.equal(countUnicodeChars(exact15), MORE_PROMPT_DESCRIPTION_MAX_LENGTH);
  assert.equal(
    validateMorePromptFormDraft({
      title: 'T',
      description: exact15,
      content: 'body',
    }),
    null,
  );
});

test('validateMorePromptFormDraft rejects empty and long description', () => {
  assert.equal(validateMorePromptFormDraft({ title: '', description: 'x', content: 'y' }), 'createGame.morePrompt.validationTitle');
  assert.equal(
    validateMorePromptFormDraft({
      title: 'T',
      description: '一二三四五六七八九十十一十二十三45',
      content: 'body',
    }),
    'createGame.morePrompt.validationDescription',
  );
  assert.equal(validateMorePromptFormDraft({ title: 'T', description: 'ok', content: '' }), 'createGame.morePrompt.validationContent');
  assert.equal(validateMorePromptFormDraft({ title: 'T', description: 'ok', content: 'ok' }), null);
});

test('validateMorePromptFormsList rejects non-array input', () => {
  assert.equal(validateMorePromptFormsList(null), 'createGame.morePrompt.saveFailed');
  assert.equal(validateMorePromptFormsList({}), 'createGame.morePrompt.saveFailed');
});

test('validateMorePromptFormsList enforces max count and validates each entry', () => {
  const many = Array.from({ length: MORE_PROMPT_FORMS_MAX_COUNT + 1 }, (_, i) => createValidDraft({
    id: `id-${i}`,
    order: i,
  }));
  assert.equal(validateMorePromptFormsList(many), 'createGame.morePrompt.maxReached');

  const exactlyMax = Array.from({ length: MORE_PROMPT_FORMS_MAX_COUNT }, (_, i) => createValidDraft({
    id: `id-${i}`,
    order: i,
  }));
  assert.equal(validateMorePromptFormsList(exactlyMax), null);
  assert.equal(validateMorePromptFormsList([]), null);

  const invalidOne = [createValidDraft({ title: '' })];
  assert.equal(validateMorePromptFormsList(invalidOne), 'createGame.morePrompt.validationTitle');
});

test('morePrompt panel id helpers cover new, edit and unknown panels', () => {
  assert.equal(isMorePromptPanel('world'), false);
  assert.equal(isMorePromptPanel('documents'), false);
  assert.equal(isMorePromptPanel(MORE_PROMPT_NEW_PANEL), true);
  assert.equal(isMorePromptPanel(buildMorePromptPanelId('abc')), true);

  assert.deepEqual(parseMorePromptPanel(MORE_PROMPT_NEW_PANEL), { kind: 'new' });
  assert.deepEqual(parseMorePromptPanel(buildMorePromptPanelId('abc')), { kind: 'edit', id: 'abc' });
  assert.equal(parseMorePromptPanel('world'), null);
  assert.deepEqual(parseMorePromptPanel('morePrompt:'), { kind: 'edit', id: '' });

  assert.equal(buildMorePromptPanelId('uuid-1'), 'morePrompt:uuid-1');
  assert.equal(MORE_PROMPT_DESCRIPTION_MAX_LENGTH, 15);
  assert.equal(MORE_PROMPT_FORMS_MAX_COUNT, 10);
});

test('frontend and backend share the same max limits', () => {
  assert.equal(MORE_PROMPT_FORMS_MAX_COUNT, 10);
  assert.equal(MORE_PROMPT_DESCRIPTION_MAX_LENGTH, 15);
  assert.equal(MORE_PROMPT_TITLE_MAX_LENGTH, 80);
});
