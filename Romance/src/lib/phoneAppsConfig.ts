/**
 * 作品手机应用配置：只保存已装上的平台 appId。
 * 应用元数据（名称/图标/作者/类型/内容）一律读平台应用表，不在作品里写死。
 * 旧 JSON 若仍带 avail/label 等目录差异字段，读取时按旧逻辑展开预装列表以兼容。
 */
import {
  OFFICIAL_PLATFORM_APP_THEME_CODES,
  type ThemeApplicabilityCode,
} from "./officialThemeApplicability.ts";

/** 功能注释：与后端种子一致的 11 个官方 appId；旧作品未写 phoneAppsCfg 时兼容预装 */
export const OFFICIAL_PLATFORM_APP_IDS = Object.freeze([
  "wechat",
  "sms",
  "call",
  "mail",
  "weibo",
  "xhs",
  "ticket",
  "cloudmusic",
  "read",
  "video",
  "bosspin",
] as const);

/** 功能注释：官方应用适用题材语义（C0.3）；缺配置时 modern 兜底 */
export function officialAppThemeCodes(appId: string): ThemeApplicabilityCode[] {
  const codes = OFFICIAL_PLATFORM_APP_THEME_CODES[appId];
  return codes?.length ? [...codes] : ["modern"];
}

export type PhoneAppAvail = "preinstall" | "store" | "locked" | "hidden" | "disabled";
export type PhoneAppAvailSimple = "preinstall" | "store";

export type PhoneAppDef = {
  id: string;
  /** @deprecated 平台表权威；旧 JSON 可能仍有 */
  label?: string;
  icon?: string;
  order?: number;
  avail?: PhoneAppAvail;
  unlockHint?: string;
};

/** 引擎内置、不进平台应用表的系统入口 */
export const ENGINE_PHONE_APP_IDS = Object.freeze(["appstore", "settings"] as const);

/** 功能注释：把旧五态收成预装 / 商店（仅兼容旧 JSON） */
export function normalizePhoneAppAvail(avail?: PhoneAppAvail | null): PhoneAppAvailSimple {
  return avail === "preinstall" ? "preinstall" : "store";
}

/** 功能注释：AI 可能把 phoneAppsCfg 写成 {apps:[]}；非数组时按空覆盖 */
export function asPhoneOverrides(raw: unknown): PhoneAppDef[] {
  if (Array.isArray(raw)) return raw as PhoneAppDef[];
  if (raw && typeof raw === "object") {
    const bag = raw as Record<string, unknown>;
    for (const k of ["apps", "items", "list", "overrides"]) {
      if (Array.isArray(bag[k])) return bag[k] as PhoneAppDef[];
    }
  }
  return [];
}

/**
 * 功能注释：世界合并后的 phoneAppsCfg 三态规整（P4）。
 * - null/undefined（或无法识别的脏值）→ undefined：旧作品兼容，预装 11 个官方应用
 * - 空数组 / {apps:[]} → []：明确没装，开局桌面只有应用商店与设置；禁止收成 undefined
 * - 非空 → 浅拷贝每项
 */
export function normalizeWorldPhoneAppsCfg(raw: unknown): PhoneAppDef[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw.map((a) => ({ ...(a as PhoneAppDef) }));
  if (typeof raw === "object") {
    const bag = raw as Record<string, unknown>;
    for (const k of ["apps", "items", "list", "overrides"]) {
      if (Array.isArray(bag[k])) return (bag[k] as PhoneAppDef[]).map((a) => ({ ...a }));
    }
  }
  return undefined;
}

/** 功能注释：是否仍是旧「目录差异补丁」形态（含 avail/label 等） */
export function isLegacyPhoneAppsCfg(raw: unknown): boolean {
  const list = asPhoneOverrides(raw);
  return list.some(
    (o) =>
      o.avail != null ||
      (typeof o.label === "string" && o.label.trim() !== "") ||
      (typeof o.unlockHint === "string" && o.unlockHint.trim() !== "") ||
      typeof o.order === "number" ||
      (typeof o.icon === "string" && o.icon.trim() !== ""),
  );
}

/**
 * 作品已安装的平台 appId（不含 appstore/settings）。
 * - null/undefined：旧作品未写字段 → 兼容预装 11 个官方应用
 * - []：新作品明确未装 → 空
 * - 新格式 {id}[]：列表即已装
 * - 旧格式：按历史目录默认 + avail 算出预装
 */
export function installedPlatformAppIds(overrides?: PhoneAppDef[] | null): string[] {
  if (overrides == null) return [...OFFICIAL_PLATFORM_APP_IDS];
  const list = asPhoneOverrides(overrides);
  if (!list.length) return [];
  if (!isLegacyPhoneAppsCfg(list)) {
    return Array.from(new Set(list.map((o) => String(o.id || "").trim()).filter(Boolean)));
  }
  // 旧契约：以官方 11 + 常见目录默认预装，再被 avail 覆盖
  const legacyDefaults = new Map<string, PhoneAppAvailSimple>([
    ...OFFICIAL_PLATFORM_APP_IDS.map((id): [string, PhoneAppAvailSimple] => [id, "preinstall"]),
    ["xianyu", "store"],
    ["peek", "preinstall"],
    ["couple", "preinstall"],
  ]);
  const map = new Map(list.map((o) => [o.id, o]));
  const out: string[] = [];
  for (const [id, defAvail] of legacyDefaults) {
    const o = map.get(id);
    const avail = normalizePhoneAppAvail(o?.avail ?? defAvail);
    if (avail === "preinstall") out.push(id);
  }
  // 旧补丁里显式 preinstall 的其它 id
  for (const o of list) {
    const id = String(o.id || "").trim();
    if (!id || out.includes(id)) continue;
    if (normalizePhoneAppAvail(o.avail) === "preinstall") out.push(id);
  }
  return out;
}

/** 开局应预装：作品已装平台应用 + 强制应用商店 */
export function preinstallIds(overrides?: PhoneAppDef[] | null): string[] {
  return Array.from(new Set(["appstore", "settings", ...installedPlatformAppIds(overrides)]));
}

/** 功能注释：写入作品时只留 appId，卸下=从数组移除，不改平台表 */
export function compactInstalledAppIds(ids: string[]): PhoneAppDef[] | undefined {
  const out = Array.from(
    new Set(ids.map((id) => String(id || "").trim()).filter((id) => id && id !== "appstore" && id !== "settings")),
  ).map((id) => ({ id }));
  return out.length ? out : [];
}

/** @deprecated 兼容旧调用：等价于把已装列表压成 {id}[] */
export function compactPhoneApps(list: PhoneAppDef[]): PhoneAppDef[] | undefined {
  return compactInstalledAppIds(list.map((a) => a.id));
}

export type ResolvedPhoneApp = {
  id: string;
  label: string;
  icon?: string;
  order: number;
  avail: PhoneAppAvailSimple;
  unlockHint: string;
};

/**
 * 兼容旧 resolvePhoneApps：无平台缓存时仅按已装 id 生成占位。
 * 编辑器 / 运行时应优先用平台表字段覆盖 label/icon。
 */
export function resolvePhoneApps(overrides?: PhoneAppDef[] | null): ResolvedPhoneApp[] {
  const ids = installedPlatformAppIds(overrides);
  return ids.map((id, i) => ({
    id,
    label: id,
    order: i,
    avail: "preinstall" as const,
    unlockHint: "",
  }));
}

export function storeVisibleIds(overrides?: PhoneAppDef[] | null): string[] {
  return installedPlatformAppIds(overrides);
}

export function phoneAppVisible(_id: string, _overrides?: PhoneAppDef[] | null): boolean {
  return true;
}

export function phoneAppLabel(id: string, overrides?: PhoneAppDef[] | null, fallback?: string): string {
  const hit = asPhoneOverrides(overrides).find((x) => x.id === id);
  const label = typeof hit?.label === "string" ? hit.label.trim() : "";
  return label || fallback || id;
}

/** 保留旧目录导出供测试/过渡；运行时不再作为商店数据源 */
export type PhoneAppCatalogItem = {
  id: string;
  label: string;
  kind: "core" | "store";
  defaultAvail: PhoneAppAvailSimple;
  blurb: string;
  emptyHint: string;
  entries: string[];
};

export const PHONE_APP_CATALOG: readonly PhoneAppCatalogItem[] = Object.freeze(
  OFFICIAL_PLATFORM_APP_IDS.map((id) => ({
    id,
    label: id,
    kind: "core" as const,
    defaultAvail: "preinstall" as const,
    blurb: "",
    emptyHint: "",
    entries: [] as string[],
  })),
);

export function catalogItem(id: string): PhoneAppCatalogItem | undefined {
  return PHONE_APP_CATALOG.find((a) => a.id === id);
}
