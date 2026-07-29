/**
 * dataPromptForms 前端校验单测（规则与后端 dataPromptForms.js 对齐）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DATA_PROMPT_FORMS_MAX_COUNT,
  DATA_PROMPT_DESCRIPTION_MAX_LENGTH,
  DATA_PROMPT_TITLE_MAX_LENGTH,
  countUnicodeChars,
  keysFromTitle,
  normalizeDataPromptForm,
  validateDataPromptFormDraft,
  validateDataPromptFormsList,
  isDataPromptPanel,
  parseDataPromptPanel,
  buildDataPromptPanelId,
  DATA_PROMPT_NEW_PANEL,
} from '../src/utils/dataPromptForms.ts';

function createValidDraft(overrides = {}) {
  return {
    id: 'draft-1',
    title: '库存,好感度',
    description: '描述',
    content: 'Body content',
    order: 0,
    enabled: true,
    constant: false,
    ...overrides,
  };
}

test('keysFromTitle splits on comma and Chinese comma', () => {
  assert.deepEqual(keysFromTitle('a,b'), ['a', 'b']);
  assert.deepEqual(keysFromTitle('a，b'), ['a', 'b']);
  assert.deepEqual(keysFromTitle(''), []);
});

test('normalizeDataPromptForm trims and assigns order with constant', () => {
  const normalized = normalizeDataPromptForm({
    id: '  x ',
    title: '  Title ',
    description: ' d ',
    content: ' c ',
    constant: false,
    enabled: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }, 3);

  assert.equal(normalized.id, 'x');
  assert.equal(normalized.order, 3);
  assert.equal(normalized.constant, false);
});

test('validateDataPromptFormDraft requires keywords when not constant', () => {
  assert.equal(
    validateDataPromptFormDraft({ title: '   ', description: 'ok', content: 'ok', constant: false }),
    'createGame.dataPrompt.validationKeywords',
  );
  assert.equal(
    validateDataPromptFormDraft({ title: '库存,好感度', description: 'ok', content: 'ok', constant: false }),
    null,
  );
});

test('validateDataPromptFormDraft allows constant entry without keywords', () => {
  assert.equal(
    validateDataPromptFormDraft({ title: '', description: 'ok', content: 'ok', constant: true }),
    null,
  );
});

test('validateDataPromptFormsList enforces max count', () => {
  const many = Array.from({ length: DATA_PROMPT_FORMS_MAX_COUNT + 1 }, (_, i) => createValidDraft({
    id: `id-${i}`,
    order: i,
  }));
  assert.equal(validateDataPromptFormsList(many), 'createGame.dataPrompt.maxReached');

  const exactlyMax = Array.from({ length: DATA_PROMPT_FORMS_MAX_COUNT }, (_, i) => createValidDraft({
    id: `id-${i}`,
    order: i,
  }));
  assert.equal(validateDataPromptFormsList(exactlyMax), null);
});

test('dataPrompt panel id helpers cover new, edit and unknown panels', () => {
  assert.equal(isDataPromptPanel('world'), false);
  assert.equal(isDataPromptPanel(DATA_PROMPT_NEW_PANEL), true);
  assert.equal(isDataPromptPanel(buildDataPromptPanelId('abc')), true);

  assert.deepEqual(parseDataPromptPanel(DATA_PROMPT_NEW_PANEL), { kind: 'new' });
  assert.deepEqual(parseDataPromptPanel(buildDataPromptPanelId('abc')), { kind: 'edit', id: 'abc' });
  assert.equal(parseDataPromptPanel('world'), null);

  assert.equal(buildDataPromptPanelId('uuid-1'), 'dataPrompt:uuid-1');
  assert.equal(DATA_PROMPT_DESCRIPTION_MAX_LENGTH, 15);
  assert.equal(DATA_PROMPT_FORMS_MAX_COUNT, 10);
});

test('countUnicodeChars counts CJK code points', () => {
  assert.equal(countUnicodeChars('一二三四五'), 5);
});

test('frontend and backend share the same max limits', () => {
  assert.equal(DATA_PROMPT_FORMS_MAX_COUNT, 10);
  assert.equal(DATA_PROMPT_DESCRIPTION_MAX_LENGTH, 15);
  assert.equal(DATA_PROMPT_TITLE_MAX_LENGTH, 80);
});
