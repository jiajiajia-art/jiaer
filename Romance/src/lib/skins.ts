import type { ThemePref } from "./store";

/** 功能注释：皮肤选项的 icon 键对应 lib/icons 线性图标，禁止再用装饰字符。 */
export type SkinIconKey = "spark" | "heart" | "sparkle" | "star" | "scroll";

/* 界面风格选项：设置页与模组编辑器共用 */
export const SKINS: { id: NonNullable<ThemePref["skin"]>; label: string; icon: SkinIconKey; desc: string }[] = [
  { id: "dream", label: "梦幻星紫", icon: "spark", desc: "薰衣草糖霜 · 梦幻质感" },
  { id: "bloody", label: "血腥玛丽", icon: "heart", desc: "甜美红×白天鹅 · 浓郁复古" },
  { id: "cute", label: "可爱奢华", icon: "sparkle", desc: "蜜桃玫瑰金 · 少女千金" },
  { id: "glass", label: "毛玻璃", icon: "star", desc: "半透磨砂 · 现代精致" },
  { id: "paper", label: "古朴宣纸", icon: "scroll", desc: "暖调柔和 · 沉浸典雅" },
];
export const ACCENTS: { id: ThemePref["accent"]; label: string; bg: string }[] = [
  { id: "fuchsia", label: "璀璨星紫", bg: "bg-purple-600" },
  { id: "plum", label: "玫瑰酒红", bg: "bg-rose-800" },
  { id: "rose", label: "胭脂蜜桃", bg: "bg-rose-500" },
  { id: "gold", label: "琥珀流金", bg: "bg-amber-600" },
  { id: "cyan", label: "赛博海蓝", bg: "bg-sky-600" },
  { id: "jade", label: "唱片墨绿", bg: "bg-emerald-800" },
  { id: "coral", label: "珊瑚朱红", bg: "bg-amber-500" },
  { id: "ink", label: "沉稳黛黑", bg: "bg-slate-700" },
];
export const FONTS: { id: NonNullable<ThemePref["font"]>; label: string; family: string; desc: string; sample: string }[] = [
  { id: "song", label: "典雅宋体", family: "'Noto Serif SC', serif", desc: "沉稳端庄 · 经典衬线", sample: "星" },
  { id: "hei", label: "现代黑体", family: "'Noto Sans SC', sans-serif", desc: "干净利落 · 清晰易读", sample: "曜" },
  { id: "round", label: "圆润可爱", family: "'ZCOOL KuaiLe', sans-serif", desc: "软萌活泼 · 轻松甜美", sample: "萌" },
  { id: "elegant", label: "清瘦雅致", family: "'ZCOOL XiaoWei', serif", desc: "秀气文艺 · 书卷温度", sample: "雅" },
  { id: "brush", label: "手写毛笔", family: "'Ma Shan Zheng', serif", desc: "洒脱写意 · 江湖侠气", sample: "墨" },
  { id: "hand", label: "行书手札", family: "'Long Cang', serif", desc: "随性信笺 · 日记独白", sample: "信" },
  { id: "cursive", label: "潇洒草书", family: "'Zhi Mang Xing', serif", desc: "飞白锋芒 · 诗意张力", sample: "风" },
  { id: "pixel", label: "复古像素", family: "'Pixelify Sans', 'VT323', 'Noto Sans SC', monospace", desc: "千禧电子 · 怀旧机能", sample: "Px" },
];
export const MODES: { id: ThemePref["mode"]; label: string }[] = [
  { id: "auto", label: "跟随系统" },
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
];

type SkinId = NonNullable<ThemePref["skin"]>;
type SkinThemePreset = Pick<ThemePref, "accent" | "font" | "mode">;

/** 功能注释：世界作者只选皮肤时，由皮肤补齐配套主题；显式自定义项始终优先覆盖。 */
export const SKIN_THEME_PRESETS: Record<SkinId, SkinThemePreset> = {
  dream: { accent: "fuchsia", font: "elegant", mode: "auto" },
  bloody: { accent: "plum", font: "song", mode: "dark" },
  cute: { accent: "rose", font: "round", mode: "light" },
  glass: { accent: "cyan", font: "hei", mode: "auto" },
  paper: { accent: "gold", font: "song", mode: "light" },
};

/** 功能注释：解析世界外观时仅为已选皮肤注入默认搭配，不选皮肤则完全不碰玩家外观。 */
export function resolveSkinTheme(
  theme: Partial<Pick<ThemePref, "skin" | "accent" | "font" | "mode">>,
): Partial<Pick<ThemePref, "skin" | "accent" | "font" | "mode">> {
  if (!theme.skin) return theme;
  return { ...SKIN_THEME_PRESETS[theme.skin], ...theme };
}
