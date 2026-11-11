/**
 * 生成世界 · 故事设定输入：字数上限、超限闸门、自适应高度。
 * 与 WorldGenWizard UI / 单测共用，不依赖 React。
 */
import {
  WORLD_FORBID_MAX,
  WORLD_SETTING_MAX,
  formatWorldGenForbidBlock,
} from "./worldGenWizard.ts";

/** 功能注释：未勾选 AI 时超限弹窗文案（确认后截断到 5000） */
export const WORLD_GEN_SETTING_TRUNCATE_CONFIRM =
  `当前故事设定已超过 ${WORLD_SETTING_MAX} 字。未勾选「由 AI 整理设定」时将直接截断到前 ${WORLD_SETTING_MAX} 字，超出部分会丢失。确认继续吗？`;

export function worldGenSettingLen(setting: string | null | undefined): number {
  return String(setting ?? "").length;
}

export function isWorldGenSettingOverLimit(setting: string | null | undefined): boolean {
  return worldGenSettingLen(setting) > WORLD_SETTING_MAX;
}

/** 功能注释：硬截断到上限（不勾选 AI 且作者确认后使用） */
export function truncateWorldGenSetting(setting: string | null | undefined): string {
  return String(setting ?? "").slice(0, WORLD_SETTING_MAX);
}

export function worldGenForbidLen(forbidGen: string | null | undefined): number {
  return String(forbidGen ?? "").length;
}

export function isWorldGenForbidOverLimit(forbidGen: string | null | undefined): boolean {
  return worldGenForbidLen(forbidGen) > WORLD_FORBID_MAX;
}

/**
 * 功能注释：提交前闸门。
 * - 空设定 → error
 * - 超限且未勾选 AI → 须弹截断确认（needTruncateConfirm）
 * - 超限且勾选 AI → 放行，由模型整理润色到上限内
 * - 未超限 → 放行
 */
export type WorldGenSettingGate =
  | { ok: true; setting: string }
  | { ok: false; error: string }
  | { ok: false; needTruncateConfirm: true };

export function gateWorldGenSettingSubmit(opts: {
  setting: string | null | undefined;
  aiPolish: boolean;
}): WorldGenSettingGate {
  const setting = String(opts.setting ?? "");
  if (!setting.trim()) return { ok: false, error: "请填写故事设定" };
  if (isWorldGenSettingOverLimit(setting)) {
    if (opts.aiPolish) return { ok: true, setting };
    return { ok: false, needTruncateConfirm: true };
  }
  return { ok: true, setting };
}

/**
 * 功能注释：故事设定 / 禁止生成框高度跟着内容走，避免固定大空白；过高时内部滚动，手机/桌面都可用。
 */
export function fitWorldGenSettingTextarea(el: HTMLTextAreaElement | null | undefined): void {
  if (!el) return;
  el.style.height = "0px";
  const next = Math.max(el.scrollHeight, 0);
  el.style.height = `${next}px`;
}

/**
 * 功能注释：勾选「由 AI 整理设定」时注入生成提示——可润色作品名与故事设定；禁止清单必须原样保留。
 */
export function worldGenAiPolishPrompt(aiPolish: boolean): string {
  if (aiPolish) {
    return (
      `已勾选「由 AI 整理设定」：可优化作品名称（更贴合设定、简洁好记）；` +
      `故事设定请保留原意，补全结构并优化表达，整理后的创作基调不超过 ${WORLD_SETTING_MAX} 字。` +
      `「禁止生成」清单必须原样保留，不要整理、合并进故事设定，也不要删改。`
    );
  }
  return (
    "未勾选 AI 整理：尽量贴近创作者原文表述，不要过度改写。" +
    "「禁止生成」清单必须原样遵守，不要整理或删改。"
  );
}

/**
 * 功能注释：生成世界 / 后续 AI 补全时注入禁止清单；空则不占提示篇幅。
 */
export function worldGenForbidPrompt(forbidGen: string | null | undefined): string {
  const block = formatWorldGenForbidBlock(forbidGen);
  if (!block) return "";
  return (
    `${block}\n` +
    `以上为创作者硬性禁止项：生成与后续补全时不得出现清单中的内容或设定，不得改写该清单本身。`
  );
}
