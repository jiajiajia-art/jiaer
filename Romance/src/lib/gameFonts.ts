import type { ThemePref } from "./store";

const LINK_ID = "romance-game-fonts";

/**
 * 功能注释：本地字体 CSS 路径（随 VITE_BASE，如 /funloom/fonts/game/fonts.css）。
 * 禁止再注入任何第三方字体 CDN。
 */
export function resolveGameFontsStylesheetHref(
  baseUrl = typeof import.meta !== "undefined"
    ? String((import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL || "/")
    : "/",
): string {
  const base = String(baseUrl || "/").replace(/\/?$/, "/");
  return `${base}fonts/game/fonts.css`;
}

/** @deprecated 兼容旧单测字段名；实际为本地相对路径解析结果 */
export const GAME_FONTS_STYLESHEET = resolveGameFontsStylesheetHref("/");

/**
 * 功能注释：把预设展示字体拉进页面一次。
 * 只设 class / CSS 变量而不加载字形时，浏览器会回落到系统默认字，点选预设看起来「没换字」。
 */
export function ensureGameFontsLoaded(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(LINK_ID)) return;
  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = resolveGameFontsStylesheetHref();
  document.head.appendChild(link);
}

/**
 * 功能注释：点选预设字体时清掉自定义字体文件。
 * free-style 注入的 --font-* 权重高于 html.font-xxx，不清除则预设 class 不会生效。
 */
export function withFontPreset(theme: ThemePref, fontId: NonNullable<ThemePref["font"]>): ThemePref {
  if (!theme.free?.font) return { ...theme, font: fontId };
  return { ...theme, font: fontId, free: { ...theme.free, font: undefined } };
}
