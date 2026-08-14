import {
  NOVEL_DESCRIPTION_MAX_LENGTH,
  descriptionToPlainText,
  validateDescriptionContent,
} from './gameDescriptionHtml.ts';

export { NOVEL_DESCRIPTION_MAX_LENGTH };
export const THEME_TAG_MAX = 2;
export const THEME_TAG_MIN_DRAFT = 0;
export const THEME_TAG_MIN_PUBLISH = 1;

export type NovelEditValidationError =
  | 'TITLE_REQUIRED'
  | 'DESCRIPTION_REQUIRED'
  | 'DESCRIPTION_TOO_LONG'
  | 'COVER_REQUIRED'
  | 'THEME_TAG_MIN'
  | 'THEME_TAG_MAX';

export type NovelEditFormInput = {
  title: string;
  description: string;
  hasCover: boolean;
  themeTagIds: number[];
};

export function toggleThemeTagSelection(
  selected: number[],
  tagId: number,
  max: number = THEME_TAG_MAX,
): { next: number[]; atMax: boolean } {
  const normalizedId = Number(tagId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return { next: selected, atMax: false };
  }

  if (selected.includes(normalizedId)) {
    return { next: selected.filter((id) => id !== normalizedId), atMax: false };
  }

  if (selected.length >= max) {
    return { next: selected, atMax: true };
  }

  return { next: [...selected, normalizedId], atMax: false };
}

export function validateNovelDraftSave(input: NovelEditFormInput): {
  valid: boolean;
  error?: NovelEditValidationError;
} {
  const title = String(input.title || '').trim();
  if (!title) {
    return { valid: false, error: 'TITLE_REQUIRED' };
  }

  const descCheck = validateDescriptionContent(input.description || '', { required: true });
  if (!descCheck.valid && descCheck.error === 'DESCRIPTION_REQUIRED') {
    return { valid: false, error: 'DESCRIPTION_REQUIRED' };
  }
  if (!descCheck.valid && (descCheck.error === 'DESCRIPTION_TOO_LONG' || descCheck.error === 'DESCRIPTION_HTML_TOO_LONG')) {
    return { valid: false, error: 'DESCRIPTION_TOO_LONG' };
  }
  // 保留纯文本抽取，避免空壳 HTML 绕过
  if (!descriptionToPlainText(descCheck.html) && !/<img\b/i.test(descCheck.html)) {
    return { valid: false, error: 'DESCRIPTION_REQUIRED' };
  }

  if (!input.hasCover) {
    return { valid: false, error: 'COVER_REQUIRED' };
  }

  const tagCount = input.themeTagIds.length;
  if (tagCount > THEME_TAG_MAX) {
    return { valid: false, error: 'THEME_TAG_MAX' };
  }

  return { valid: true };
}

export function validateNovelPublish(input: NovelEditFormInput): {
  valid: boolean;
  error?: NovelEditValidationError;
} {
  const draftValidation = validateNovelDraftSave(input);
  if (!draftValidation.valid) {
    return draftValidation;
  }

  const tagCount = input.themeTagIds.length;
  if (tagCount < THEME_TAG_MIN_PUBLISH) {
    return { valid: false, error: 'THEME_TAG_MIN' };
  }

  return { valid: true };
}

export function mapNovelEditErrorToI18nKey(error?: NovelEditValidationError): string {
  switch (error) {
    case 'TITLE_REQUIRED':
      return 'common.publishSettings.titleRequired';
    case 'DESCRIPTION_REQUIRED':
      return 'common.publishSettings.descriptionRequired';
    case 'DESCRIPTION_TOO_LONG':
      return 'common.publishSettings.descriptionTooLong';
    case 'COVER_REQUIRED':
      return 'common.publishSettings.coverRequired';
    case 'THEME_TAG_MIN':
    case 'THEME_TAG_MAX':
      return 'createGame.themeTagRequired';
    default:
      return 'createGame.publishFailed';
  }
}
