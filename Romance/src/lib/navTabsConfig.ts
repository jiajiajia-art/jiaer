/**
 * 底栏页签配置：与 MudChrome.resolveNav / navPool 同契约的纯函数。
 * 模组编辑器与局内底栏共用，避免预览与实机分叉。
 */
import type { FeatureFlags, Terminology, TermKey } from "../mods/types";

export type NavTabId = "home" | "actions" | "sim" | "npc" | "phone" | "image" | "quest" | "settings";
export type NavGlyphName = "world" | "star" | "clipboard" | "people" | "book" | "gear" | "camera" | "flag";
export type NavTabCfg = { id: string; label?: string; on?: boolean };
export type NavPoolItem = { id: NavTabId; label: string; glyph: NavGlyphName };

/** 底栏标签最长字数（与局内 NavTabsEditor maxLength 一致） */
export const NAV_MAX_LABEL = 4;

/** 默认补位顺序（世界固定首位后按此填满格数） */
export const DEFAULT_NAV_ORDER: NavTabId[] = [
  "home", "actions", "npc", "phone", "sim", "image", "quest", "settings",
];

/** 页签 id → 术语键（写入 terms 以兼容 term() 读取） */
export const NAV_TAB_TERM: Partial<Record<NavTabId, TermKey>> = {
  home: "tabWorld",
  actions: "tabIndustry",
  npc: "tabNpc",
  phone: "tabPhone",
  image: "tabImage",
  sim: "tabSim",
};

type TabDef = {
  id: NavTabId;
  glyph: NavGlyphName;
  defaultLabel: string;
  featureKey?: keyof FeatureFlags;
};

const TAB_DEFS: TabDef[] = [
  { id: "home", glyph: "world", defaultLabel: "世界" },
  { id: "actions", glyph: "star", defaultLabel: "娱乐圈", featureKey: "industryTab" },
  { id: "sim", glyph: "clipboard", defaultLabel: "档案" },
  { id: "npc", glyph: "people", defaultLabel: "人物" },
  { id: "phone", glyph: "book", defaultLabel: "手机", featureKey: "phone" },
  { id: "image", glyph: "camera", defaultLabel: "形象", featureKey: "imageCrisis" },
  { id: "quest", glyph: "flag", defaultLabel: "支线" },
  { id: "settings", glyph: "gear", defaultLabel: "设置" },
];

/** 功能注释：terms/label 可能被 AI 写成非字符串，禁止直接 .trim() */
function navText(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** 功能注释：按模组功能开关过滤可选牌位；名称优先 terms，再默认。 */
export function buildNavPool(
  features?: FeatureFlags,
  terms?: Terminology,
  npcLabel?: string,
): NavPoolItem[] {
  return TAB_DEFS.filter((d) => {
    if (!d.featureKey) return true;
    // 与 FeatureFlags 惯例一致：未写 = 开启
    return features?.[d.featureKey] !== false;
  }).map((d) => {
    const tk = NAV_TAB_TERM[d.id];
    const fromTerm = tk ? navText(terms?.[tk]) : "";
    const label =
      d.id === "npc"
        ? (navText(npcLabel) || fromTerm || d.defaultLabel)
        : (fromTerm || d.defaultLabel);
    return { id: d.id, glyph: d.glyph, label };
  });
}

/** 可选格数：2 的倍数且 ≥4，受牌位数量约束 */
export function navSizesFor(poolLen: number): (4 | 6 | 8)[] {
  return ([4, 6, 8] as const).filter((n) => n <= poolLen);
}

/**
 * 功能注释：按自定义顺序取「显示」牌位，不足时按默认序补位；世界固定首位。
 * 与 MudChrome.resolveNav 算法一致。
 */
export function resolveNavSlots(
  pool: NavPoolItem[],
  navTabs?: NavTabCfg[],
  size?: number,
): NavPoolItem[] {
  const sizes = navSizesFor(pool.length);
  const n = sizes.includes(size as 4 | 6 | 8) ? (size as number) : sizes[0] ?? pool.length;
  const lbl = (id: string) => navText(navTabs?.find((c) => c.id === id)?.label);
  const picked: string[] = ["home"];
  for (const c of navTabs ?? []) {
    if (c.on !== false && !picked.includes(c.id) && pool.some((p) => p.id === c.id)) picked.push(c.id);
  }
  const hidden = new Set((navTabs ?? []).filter((c) => c.on === false).map((c) => c.id));
  for (const id of DEFAULT_NAV_ORDER) {
    if (picked.length < n && !picked.includes(id) && !hidden.has(id) && pool.some((p) => p.id === id)) {
      picked.push(id);
    }
  }
  for (const id of DEFAULT_NAV_ORDER) {
    if (picked.length < n && !picked.includes(id) && pool.some((p) => p.id === id)) picked.push(id);
  }
  return picked.slice(0, n).map((id) => {
    const p = pool.find((x) => x.id === id)!;
    return { ...p, label: lbl(id) || p.label };
  });
}

/** 编辑列表：已显示按底栏顺序在前，其余在后 */
export function editorNavList(
  pool: NavPoolItem[],
  navTabs: NavTabCfg[] | undefined,
  size: number,
): { id: NavTabId; label: string; placeholder: string; on: boolean }[] {
  const shown = resolveNavSlots(pool, navTabs, size).map((x) => x.id);
  const ids = [
    ...shown,
    ...pool.map((p) => p.id).filter((id) => !shown.includes(id)),
  ];
  return ids.map((id) => {
    const base = pool.find((p) => p.id === id)!;
    const cfg = navTabs?.find((c) => c.id === id);
    return {
      id,
      label: cfg?.label ?? "",
      placeholder: base.label,
      on: shown.includes(id),
    };
  });
}

/** 名称过长 / 显示数超格 / 格数大于可用牌位时的即时提示 */
export function navConfigWarnings(
  list: { id: string; label: string; on: boolean }[],
  size: number,
  poolLen: number,
): string[] {
  const msgs: string[] = [];
  const shown = list.filter((x) => x.on).length;
  if (size > poolLen) {
    msgs.push(`当前可用页签仅 ${poolLen} 个，格数 ${size} 超出容量，请关掉部分玩法开关或减小格数。`);
  }
  if (shown > size) {
    msgs.push(`已显示 ${shown} 个页签，超过底栏容量 ${size} 格；多出的不会出现在底栏。`);
  }
  for (const x of list) {
    const name = navText(x.label);
    if (name.length > NAV_MAX_LABEL) {
      msgs.push(`「${name}」超过 ${NAV_MAX_LABEL} 字，底栏可能截断显示。`);
    }
  }
  return msgs;
}

/** 把底栏自定义名写回 terms，供 term()/旧模组路径读取 */
export function termsFromNavTabs(
  navTabs: NavTabCfg[] | undefined,
  prev?: Terminology,
): Terminology | undefined {
  const next: Terminology = { ...(prev ?? {}) };
  let touched = false;
  for (const c of navTabs ?? []) {
    const tk = NAV_TAB_TERM[c.id as NavTabId];
    if (!tk) continue;
    const v = navText(c.label);
    if (v) {
      if (next[tk] !== v) {
        next[tk] = v;
        touched = true;
      }
    } else if (next[tk]) {
      delete next[tk];
      touched = true;
    }
  }
  if (!touched && !prev) return undefined;
  return Object.keys(next).length ? next : undefined;
}

/** 从旧 terms 种子生成 navTabs（首次打开编辑器时） */
export function navTabsFromTerms(terms?: Terminology): NavTabCfg[] | undefined {
  if (!terms) return undefined;
  const out: NavTabCfg[] = [];
  for (const [id, tk] of Object.entries(NAV_TAB_TERM) as [NavTabId, TermKey][]) {
    const label = navText(terms[tk]);
    if (label) out.push({ id, label, on: true });
  }
  return out.length ? out : undefined;
}

/** 压缩：全默认（默认格数、默认序、无隐藏、无自定义名）则省略，避免污染模组 JSON */
export function compactNavConfig(
  navTabs: NavTabCfg[] | undefined,
  navSize: 4 | 6 | 8 | undefined,
  poolLen: number,
): { navTabs?: NavTabCfg[]; navSize?: 4 | 6 | 8 } {
  const sizes = navSizesFor(poolLen);
  const defaultSize = (sizes[0] ?? 4) as 4 | 6 | 8;
  const sizeCustom =
    navSize && sizes.includes(navSize) && navSize !== defaultSize ? navSize : undefined;
  const effectiveSize = sizeCustom ?? defaultSize;
  if (!navTabs?.length) return { navTabs: undefined, navSize: sizeCustom };

  const shown = navTabs.filter((c) => c.on !== false);
  const defaultShown = DEFAULT_NAV_ORDER.slice(0, effectiveSize);
  const orderMatch =
    shown.length === defaultShown.length && shown.every((c, i) => c.id === defaultShown[i]);
  const noLabels = navTabs.every((c) => !navText(c.label));
  const pristine = orderMatch && noLabels && !sizeCustom;

  if (pristine) return { navTabs: undefined, navSize: undefined };

  return {
    navTabs: navTabs.map((c) => {
      const label = navText(c.label);
      return {
        id: c.id,
        ...(label ? { label } : {}),
        on: c.on !== false,
      };
    }),
    navSize: sizeCustom,
  };
}
