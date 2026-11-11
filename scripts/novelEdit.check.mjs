/**
 * 小说编辑修改单测：表单校验、Tag 切换、弹窗模式
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NOVEL_DESCRIPTION_MAX_LENGTH,
  THEME_TAG_MAX,
  toggleThemeTagSelection,
  validateEnabledThemeTagSelection,
  validateNovelDraftSave,
  validateNovelPublish,
  mapNovelEditErrorToI18nKey,
} from '../src/utils/novelEdit.ts';
import {
  resolvePublishModalMode,
  shouldOpenNovelEditModal,
} from '../src/utils/novelGame.ts';

const baseInput = {
  title: '测试小说',
  description: '简介内容',
  hasCover: true,
  themeTagIds: [],
};

test('validateNovelDraftSave allows 0 theme tags', () => {
  assert.equal(validateNovelDraftSave(baseInput).valid, true);
  assert.equal(validateNovelDraftSave({ ...baseInput, themeTagIds: [1] }).valid, true);
  assert.equal(validateNovelDraftSave({ ...baseInput, themeTagIds: [1, 2] }).valid, false);
});

test('validateNovelDraftSave requires title, description and cover', () => {
  assert.equal(validateNovelDraftSave({ ...baseInput, title: '  ' }).error, 'TITLE_REQUIRED');
  assert.equal(validateNovelDraftSave({ ...baseInput, description: '' }).error, 'DESCRIPTION_REQUIRED');
  assert.equal(validateNovelDraftSave({ ...baseInput, hasCover: false }).error, 'COVER_REQUIRED');
  assert.equal(
    validateNovelDraftSave({ ...baseInput, description: 'x'.repeat(NOVEL_DESCRIPTION_MAX_LENGTH + 1) }).error,
    'DESCRIPTION_TOO_LONG',
  );
  assert.equal(
    validateNovelDraftSave({
      ...baseInput,
      description: `<p><strong>${'字'.repeat(NOVEL_DESCRIPTION_MAX_LENGTH)}</strong></p>`,
    }).valid,
    true,
  );
});

test('validateNovelPublish requires 1-2 theme tags', () => {
  assert.equal(validateNovelPublish(baseInput).valid, false);
  assert.equal(validateNovelPublish(baseInput).error, 'THEME_TAG_MIN');
  assert.equal(validateNovelPublish({ ...baseInput, themeTagIds: [1] }).error, 'AUDIENCE_REQUIRED');
  assert.equal(validateNovelPublish({ ...baseInput, themeTagIds: [1], audienceType: 'male' }).valid, true);
  assert.equal(validateNovelPublish({ ...baseInput, themeTagIds: [1, 2], audienceType: 'all' }).error, 'THEME_TAG_MAX');
});

test('toggleThemeTagSelection enforces max selection', () => {
  assert.equal(THEME_TAG_MAX, 1);
  const first = toggleThemeTagSelection([], 1, THEME_TAG_MAX);
  assert.deepEqual(first.next, [1]);
  assert.equal(first.atMax, false);
  const replaced = toggleThemeTagSelection([1], 2, THEME_TAG_MAX);
  assert.deepEqual(replaced.next, [2]);
  assert.equal(replaced.atMax, false);
  const removed = toggleThemeTagSelection([2], 2, THEME_TAG_MAX);
  assert.deepEqual(removed.next, []);
});

test('mapNovelEditErrorToI18nKey maps validation errors', () => {
  assert.equal(mapNovelEditErrorToI18nKey('TITLE_REQUIRED'), 'common.publishSettings.titleRequired');
  assert.equal(mapNovelEditErrorToI18nKey('THEME_TAG_MIN'), 'createGame.themeTagRequired');
  assert.equal(mapNovelEditErrorToI18nKey('AUDIENCE_REQUIRED'), 'createGame.contentAudienceRequired');
});

test('resolvePublishModalMode keeps novel-edit for intent=edit (legacy helper)', () => {
  assert.equal(resolvePublishModalMode({ isNovel: true, intent: 'edit' }), 'novel-edit');
  assert.equal(resolvePublishModalMode({ isNovel: true, intent: 'publish' }), 'publish');
  assert.equal(resolvePublishModalMode({ isNovel: false, intent: 'edit' }), 'publish');
  assert.equal(shouldOpenNovelEditModal('NOVEL', 'NOVEL'), true);
  assert.equal(shouldOpenNovelEditModal('TXT', 'TXT'), false);
});

test('创作台「编辑修改」不再打开元信息弹窗，改为续玩（见 creatorContinuePlay）', async () => {
  const { shouldContinuePlayOnEdit } = await import('../src/utils/creatorContinuePlay.ts');
  assert.equal(shouldContinuePlayOnEdit('NOVEL', 'NOVEL'), true);
  assert.equal(shouldContinuePlayOnEdit('TXT', 'TXT'), false);
});


test('validateEnabledThemeTagSelection_停用题材不可提交', () => {
  assert.equal(validateEnabledThemeTagSelection([1], [1, 2]).valid, true);
  assert.equal(validateEnabledThemeTagSelection([], [1]).error, 'THEME_TAG_MIN');
  assert.equal(validateEnabledThemeTagSelection([3], [1, 2]).error, 'THEME_TAG_DISABLED');
});
