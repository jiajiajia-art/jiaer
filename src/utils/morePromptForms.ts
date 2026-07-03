/**
 * Visual morePromptForms 前端校验（规则与后端 services/visual/morePromptForms.js 保持一致）
 */
import type { MorePromptForm } from '../api/galgame/EditorData.type';

export type { MorePromptForm };

export const MORE_PROMPT_FORMS_MAX_COUNT = 10;
export const MORE_PROMPT_DESCRIPTION_MAX_LENGTH = 15;
export const MORE_PROMPT_TITLE_MAX_LENGTH = 80;
export const MORE_PROMPT_NEW_PANEL = 'morePrompt:new';

/** 生成条目 id；HTTP 局域网等非 secure context 下 crypto.randomUUID 不可用 */
export function createMorePromptFormId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Unicode 码点计数，与后端 countUnicodeChars 一致 */
export function countUnicodeChars(value: string): number {
  return Array.from(String(value || '')).length;
}

export function normalizeMorePromptForm(form: MorePromptForm, order: number): MorePromptForm {
  return {
    id: String(form.id || '').trim(),
    title: String(form.title || '').trim(),
    description: String(form.description || '').trim(),
    content: String(form.content || '').trim(),
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    enabled: form.enabled !== false,
    updatedAt: form.updatedAt || new Date().toISOString(),
  };
}

/** 校验单条草稿（表单提交前）；返回 i18n key 或 null */
export function validateMorePromptFormDraft(form: Partial<MorePromptForm>): string | null {
  const title = String(form.title || '').trim();
  const description = String(form.description || '').trim();
  const content = String(form.content || '').trim();

  if (!title) return 'createGame.morePrompt.validationTitle';
  if (title.length > MORE_PROMPT_TITLE_MAX_LENGTH) return 'createGame.morePrompt.validationTitle';
  if (!description) return 'createGame.morePrompt.validationDescription';
  if (countUnicodeChars(description) > MORE_PROMPT_DESCRIPTION_MAX_LENGTH) {
    return 'createGame.morePrompt.validationDescription';
  }
  if (!content) return 'createGame.morePrompt.validationContent';
  return null;
}

export function validateMorePromptFormsList(forms: unknown): string | null {
  if (!Array.isArray(forms)) {
    return 'createGame.morePrompt.saveFailed';
  }
  if (forms.length > MORE_PROMPT_FORMS_MAX_COUNT) {
    return 'createGame.morePrompt.maxReached';
  }
  for (const form of forms) {
    const err = validateMorePromptFormDraft(form as Partial<MorePromptForm>);
    if (err) return err;
  }
  return null;
}

export function isMorePromptPanel(panelId: string): boolean {
  return typeof panelId === 'string' && panelId.startsWith('morePrompt:');
}

export function parseMorePromptPanel(panelId: string): { kind: 'new' } | { kind: 'edit'; id: string } | null {
  if (panelId === MORE_PROMPT_NEW_PANEL) {
    return { kind: 'new' };
  }
  if (isMorePromptPanel(panelId)) {
    return { kind: 'edit', id: panelId.slice('morePrompt:'.length) };
  }
  return null;
}

export function buildMorePromptPanelId(id: string): string {
  return `morePrompt:${id}`;
}
