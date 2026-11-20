/* 手机壁纸清单：仅保留实景照片，供主屏外壳与「设置」共用 */
export type WallpaperKind = "photo";
export type Wallpaper = { id: string; label: string; css: string; dark?: boolean; kind: WallpaperKind };

export const WALLPAPERS: Wallpaper[] = [
  { id: "flower", label: "写真", dark: false, kind: "photo", css: "center/cover no-repeat url(/wallpaper-2.jpg)" },
];

export const DEFAULT_WALLPAPER = WALLPAPERS[0].id;

/* 自定义上传壁纸的占位 id；实际图片以 data URL 存在 prefs.customWallpaper */
export const CUSTOM_WALLPAPER_ID = "custom";

export function wallpaperById(id: string): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}

/* 把一张图片的 data URL 包成可用作 background 的 CSS（居中裁切铺满） */
export function customWallpaperCss(dataUrl: string): string {
  return `center/cover no-repeat url(${dataUrl})`;
}

/* 综合解析当前壁纸：自定义优先，否则回退到内置清单 */
export function resolveWallpaper(id: string, customCss?: string): Wallpaper {
  if (id === CUSTOM_WALLPAPER_ID && customCss) {
    return { id: CUSTOM_WALLPAPER_ID, label: "自定义", css: customCss, dark: true, kind: "photo" };
  }
  return wallpaperById(id);
}

/** 功能注释：图片地址或已写好的 background 值，铺成壁纸。空串当没图。 */
function imageWallpaper(id: string, label: string, raw: string | undefined, dark = false): Wallpaper | null {
  const src = typeof raw === "string" ? raw.trim() : "";
  if (!src) return null;
  const css = /url\(/i.test(src) ? src : customWallpaperCss(src);
  return { id, label, css, dark, kind: "photo" };
}

/**
 * 功能注释：桌面背景优先级。
 * 玩家在设置里换过（含上传）→ 用玩家的；
 * 否则创作者上传了手机壁纸就用那张；
 * 再否则用作品封面；都没有才用引擎默认写真。
 */
export function resolveEffectiveHomeWallpaper(
  worldWallpaper: string | undefined,
  prefs: { wallpaper: string; customWallpaper?: string; wallpaperUserSet?: boolean },
  coverUrl?: string,
): Wallpaper {
  if (prefs.wallpaperUserSet || (prefs.wallpaper === CUSTOM_WALLPAPER_ID && prefs.customWallpaper)) {
    return resolveWallpaper(prefs.wallpaper, prefs.customWallpaper);
  }
  return imageWallpaper("world-home", "作品默认", worldWallpaper)
    // 功能注释：封面常是深色海报，状态栏用白字；创作者另传的浅色壁纸仍走上面那支
    ?? imageWallpaper("work-cover", "作品封面", coverUrl, true)
    ?? resolveWallpaper(prefs.wallpaper || DEFAULT_WALLPAPER, prefs.customWallpaper);
}
