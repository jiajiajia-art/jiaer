/**
 * Visual dataPromptForms 前端校验（规则与后端 services/visual/dataPromptForms.js 保持一致）
 */
import type { DataPromptForm } from '../api/galgame/EditorData.type';

export type { DataPromptForm };

export const DATA_PROMPT_FORMS_MAX_COUNT = 10;
export const DATA_PROMPT_DESCRIPTION_MAX_LENGTH = 15;
export const DATA_PROMPT_TITLE_MAX_LENGTH = 80;
export const DATA_PROMPT_NEW_PANEL = 'dataPrompt:new';

/** title 即 keywords，与后端 keysFromTitle 一致 */
export function keysFromTitle(title: string): string[] {
  return String(title || '')
    .split(/[,，]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/** 生成条目 id；HTTP 局域网等非 secure context 下 crypto.randomUUID 不可用 */
export function createDataPromptFormId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Unicode 码点计数，与后端 countUnicodeChars 一致 */
export function countUnicodeChars(value: string): number {
  return Array.from(String(value || '')).length;
}

export function normalizeDataPromptForm(form: DataPromptForm, order: number): DataPromptForm {
  const hasConstant = Object.prototype.hasOwnProperty.call(form, 'constant');
  return {
    id: String(form.id || '').trim(),
    title: String(form.title || '').trim(),
    description: String(form.description || '').trim(),
    content: String(form.content || '').trim(),
    constant: hasConstant ? form.constant === true : true,
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    enabled: form.enabled !== false,
    updatedAt: form.updatedAt || new Date().toISOString(),
  };
}

/** 校验单条草稿（表单提交前）；返回 i18n key 或 null */
export function validateDataPromptFormDraft(form: Partial<DataPromptForm>): string | null {
  const title = String(form.title || '').trim();
  const description = String(form.description || '').trim();
  const content = String(form.content || '').trim();
  const isConstant = form.constant === true;

  if (!description) return 'createGame.dataPrompt.validationDescription';
  if (countUnicodeChars(description) > DATA_PROMPT_DESCRIPTION_MAX_LENGTH) {
    return 'createGame.dataPrompt.validationDescription';
  }
  if (!content) return 'createGame.dataPrompt.validationContent';

  if (isConstant) {
    if (title.length > DATA_PROMPT_TITLE_MAX_LENGTH) {
      return 'createGame.dataPrompt.validationTitle';
    }
    return null;
  }

  if (!title) return 'createGame.dataPrompt.validationKeywords';
  if (title.length > DATA_PROMPT_TITLE_MAX_LENGTH) return 'createGame.dataPrompt.validationKeywords';
  if (keysFromTitle(title).length === 0) return 'createGame.dataPrompt.validationKeywords';
  return null;
}

export function validateDataPromptFormsList(forms: unknown): string | null {
  if (!Array.isArray(forms)) {
    return 'createGame.dataPrompt.saveFailed';
  }
  if (forms.length > DATA_PROMPT_FORMS_MAX_COUNT) {
    return 'createGame.dataPrompt.maxReached';
  }
  for (const form of forms) {
    const err = validateDataPromptFormDraft(form as Partial<DataPromptForm>);
    if (err) return err;
  }
  return null;
}

export function isDataPromptPanel(panelId: string): boolean {
  return typeof panelId === 'string' && panelId.startsWith('dataPrompt:');
}

export function parseDataPromptPanel(panelId: string): { kind: 'new' } | { kind: 'edit'; id: string } | null {
  if (panelId === DATA_PROMPT_NEW_PANEL) {
    return { kind: 'new' };
  }
  if (isDataPromptPanel(panelId)) {
    return { kind: 'edit', id: panelId.slice('dataPrompt:'.length) };
  }
  return null;
}

export function buildDataPromptPanelId(id: string): string {
  return `dataPrompt:${id}`;
}
