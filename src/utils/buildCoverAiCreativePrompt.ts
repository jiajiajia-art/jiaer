/**
 * 组装发给封面生图的创意提示：画面约束 + 示例标题字效（模型画字时用）。
 */

import { promptHasTitleStyleRequest } from '../lib/galgame/posterTitleStyle.ts';

const STYLE_HINT: Record<string, string> = {
  classic: '标题字体：经典白色宋体粗字，电影海报主标题，清晰可读，不要乱码',
  cheeseNeon: '标题字体：艺术黄油体（奶酪体），黄字、蓝色描边、轻微外发光，电影海报主标题字效',
};

/**
 * 功能注释：把示例芯片字效并入提示词，供模型画标题；用户已写字体要求时不重复覆盖。
 */
export function buildCoverAiCreativePrompt(options: {
  promptDraft?: string | null;
  styleId?: string | null;
  workTitle?: string | null;
}): string {
  const draft = String(options.promptDraft || '').trim();
  const styleId = String(options.styleId || '').trim();
  const workTitle = String(options.workTitle || '').trim();
  const hint = STYLE_HINT[styleId] || '';
  const parts: string[] = [];
  if (draft) parts.push(draft);
  else if (workTitle) parts.push(workTitle);
  if (hint && !promptHasTitleStyleRequest(draft)) {
    parts.push(hint);
  }
  return parts.filter(Boolean).join('。');
}
