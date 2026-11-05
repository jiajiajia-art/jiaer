import type { ThemePref } from "./store";

/** 功能注释：国内可用的 Google Fonts 镜像；禁止 fonts.googleapis.com（国内常超时）。 */
export const GAME_FONTS_STYLESHEET =
  "https://fonts.loli.net/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;600;700&family=ZCOOL+KuaiLe&family=ZCOOL+XiaoWei&family=Ma+Shan+Zheng&family=Long+Cang&family=Zhi+Mang+Xing&family=Pixelify+Sans&family=VT323&display=swap";

const LINK_ID = "romance-game-fonts";

/**
 * 功能注释：把 8 款预设字体拉进页面一次。
 * 只设 class / CSS 变量而不加载字形时，浏览器会回落到系统默认字，点选预设看起来「没换字」。
 */
export function ensureGameFontsLoaded(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(LINK_ID)) return;
  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = GAME_FONTS_STYLESHEET;
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
