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
