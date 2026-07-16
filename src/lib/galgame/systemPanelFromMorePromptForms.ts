/**
 * 将 world.morePromptForms 转为系统面板只读卡片（触发关键词 = title 拆词）。
 */
/** 与 morePromptForms.keysFromTitle 一致；本地实现便于 node:test 无 bundler 直跑 */
function keysFromTitle(title: string): string[] {
  return String(title || '')
    .split(/[,，]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export interface MorePromptFormLike {
  id?: string;
  title?: string;
  description?: string;
  content?: string;
  constant?: boolean;
  enabled?: boolean;
  order?: number;
}

export interface SystemPanelItem {
  id: string;
  /** 列表主标题：优先 description，否则用 title 原文 */
  name: string;
  /** 简介：content 截断或空 */
  summary: string;
  keywords: string[];
  constant: boolean;
  enabled: boolean;
}

const CONTENT_SUMMARY_MAX = 120;

function truncateSummary(content: string): string {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (Array.from(text).length <= CONTENT_SUMMARY_MAX) return text;
  return `${Array.from(text).slice(0, CONTENT_SUMMARY_MAX).join('')}…`;
}

/** 功能注释：过滤 disabled；按 order 升序；供系统面板静态展示。 */
export function buildSystemPanelItems(forms: unknown): SystemPanelItem[] {
  if (!Array.isArray(forms)) return [];

  type Prepared = { order: number; item: SystemPanelItem };
  const prepared: Prepared[] = [];

  forms.forEach((raw, index) => {
    const form = raw as MorePromptFormLike;
    if (!form || typeof form !== 'object') return;
    if (form.enabled === false) return;
    const title = String(form.title || '').trim();
    const description = String(form.description || '').trim();
    const id = String(form.id || '').trim() || `system-${index}`;
    const order = Number.isFinite(Number(form.order)) ? Number(form.order) : index;
    prepared.push({
      order,
      item: {
        id,
        name: description || title || `系统 ${index + 1}`,
        summary: truncateSummary(String(form.content || '')),
        keywords: keysFromTitle(title),
        constant: form.constant === true,
        enabled: true,
      },
    });
  });

  prepared.sort((a, b) => a.order - b.order);
  return prepared.map((entry) => entry.item);
}
