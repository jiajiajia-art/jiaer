/**
 * 平台 AI 线路：运营在后台（AI 模型中心）配置线路与计价，前端只读展示并让玩家选择。
 * 接口：GET /api/romance/ai-routes?capability=text|image|tts（见 docs/后端对接-字段与接口清单.md 第 14 节）。
 * 生图优先展示后台固定单价（pricePoints / priceKk）；文本仍可展示倍率。
 * 选择结果按能力全局保存；请求 AI 时带上 routeId，后端按该线路调用与计费。接口不可用时返回空列表，前端不展示选择器，由后端走默认线路。
 */
import { useEffect, useState } from "react";
import { loadGlobal, saveGlobal } from "./saveScope.ts";
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";

export type AiCapability = "text" | "image" | "tts";
export type AiRouteBillingMode = "per_token" | "per_call";

/** 语音线路下的可选音色（运营在后台为该线路配置） */
export type PlatformTtsVoice = { id: string; name: string; gender?: "男" | "女" };

export type PlatformAiRoute = {
  id: string;
  name: string;
  desc?: string;
  tag?: string;
  /** 用户价格倍率，1 = 不加价（文本按量时用；生图有固定单价时不再强调） */
  multiplier: number;
  isDefault?: boolean;
  available?: boolean;
  /** 仅 tts 线路：该线路可选音色 */
  voices?: PlatformTtsVoice[];
  /** 功能注释：后台计价模式；生图多为 per_call 固定花费 */
  billingMode?: AiRouteBillingMode;
  /** 创作 / 预览：织梦豆单价（按次或按量单位） */
  pricePoints?: number;
  /** 游玩：KK 币单价 */
  priceKk?: number;
  priceUnit?: string;
};

const K_SEL = (c: AiCapability) => `star:aiRoute:${c}`;
const EVT = "star:aiRoute";
const cache: Partial<Record<AiCapability, Promise<PlatformAiRoute[]>>> = {};

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** 功能注释：单价可能散落在顶层 / pricing / ×10000 整型；与主站 aiRouteSelection 对齐 */
function pickPrice(r: Record<string, unknown>, keys: string[]): number | undefined {
  const nested = r.pricing && typeof r.pricing === "object" ? (r.pricing as Record<string, unknown>) : undefined;
  for (const key of keys) {
    const v = num(r[key]) ?? (nested ? num(nested[key]) : undefined);
    if (v !== undefined) return v;
    const x = num(r[`${key}X10000`]) ?? (nested ? num(nested[`${key}X10000`]) : undefined);
    if (x !== undefined) return x / 10000;
  }
  return undefined;
}

function normalize(raw: unknown): PlatformAiRoute | null {
  const r = raw as Record<string, unknown>;
  const id = String(r?.id ?? "").trim();
  if (!id) return null;
  const mx = num(r.multiplierX10000);
  const multiplier = num(r.multiplier) ?? (mx !== undefined ? mx / 10000 : 1);
  const modeRaw = r.billingMode ?? (r.pricing as Record<string, unknown> | undefined)?.billingMode;
  const billingMode = modeRaw === "per_call" || modeRaw === "per_token" ? modeRaw : undefined;
  const priceUnitRaw = r.priceUnit ?? r.price_unit ?? (r.pricing as Record<string, unknown> | undefined)?.priceUnit;
  return {
    id,
    name: String(r.name ?? r.displayName ?? id),
    desc: r.desc ? String(r.desc) : undefined,
    tag: r.tag ? String(r.tag) : undefined,
    multiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
    isDefault: r.isDefault === true,
    available: r.available !== false,
    voices: Array.isArray(r.voices) ? (r.voices as unknown[]).map(normalizeVoice).filter((v): v is PlatformTtsVoice => !!v) : undefined,
    billingMode,
    pricePoints: pickPrice(r, ["pricePoints", "price_points", "pointsPrice", "userPricePoints"]),
    priceKk: pickPrice(r, ["priceKk", "price_kk", "kkPrice", "userPriceKk"]),
    priceUnit: priceUnitRaw ? String(priceUnitRaw) : undefined,
  };
}

function normalizeVoice(raw: unknown): PlatformTtsVoice | null {
  const v = raw as Record<string, unknown>;
  const id = String(v?.id ?? v?.voice ?? "").trim();
  if (!id) return null;
  const g = String(v.gender ?? "");
  return { id, name: String(v.name ?? v.displayName ?? id), gender: g === "男" || g === "male" ? "男" : g === "女" || g === "female" ? "女" : undefined };
}

export function fetchAiRoutes(capability: AiCapability, force = false): Promise<PlatformAiRoute[]> {
  if (!force && cache[capability]) return cache[capability]!;
  if (force) delete cache[capability];
  const base = String(resolveFunloomApiBase() || "").trim().replace(/\/$/, "");
  const token = readFunloomAuthToken();
  const p = fetch(`${base}/api/romance/ai-routes?capability=${capability}`, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const root = (j?.data ?? j) as Record<string, unknown> | null;
      const items: unknown[] = Array.isArray(root?.items) ? root.items : [];
      const topVoices = Array.isArray(root?.voices)
        ? root.voices.map(normalizeVoice).filter((v): v is PlatformTtsVoice => !!v)
        : [];
      let routes = items.map(normalize).filter((x): x is PlatformAiRoute => !!x);
      if (capability === "tts") {
        if (!routes.length && topVoices.length) {
          routes = [{
            id: "platform:tts",
            name: "平台语音",
            multiplier: 1,
            isDefault: true,
            available: true,
            billingMode: "per_token",
            voices: topVoices,
          }];
        } else if (topVoices.length) {
          routes = routes.map((r) => (r.voices?.length ? r : { ...r, voices: topVoices }));
        }
      }
      return routes;
    })
    .catch(() => []);
  cache[capability] = p;
  // 失败的空结果不长期缓存，下次打开再试
  p.then((list) => { if (!list.length) delete cache[capability]; });
  return p;
}

export const getSelectedAiRouteId = (c: AiCapability): string => loadGlobal<string>(K_SEL(c), "") || "";
export function setSelectedAiRouteId(c: AiCapability, id: string) {
  saveGlobal(K_SEL(c), id);
  window.dispatchEvent(new CustomEvent(EVT, { detail: c }));
}
/** 请求体附加字段：未选择时不带，后端用默认线路 */
export const aiRouteBody = (c: AiCapability): { routeId?: string } => {
  const id = getSelectedAiRouteId(c);
  return id ? { routeId: id } : {};
};

/** 线路列表 + 当前生效线路（未选或已下架时回落到默认 / 第一条可用） */
export function useAiRoutes(capability: AiCapability) {
  const [routes, setRoutes] = useState<PlatformAiRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(() => getSelectedAiRouteId(capability));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchAiRoutes(capability, tick > 0).then((r) => {
      if (!alive) return;
      setRoutes(r);
      setLoading(false);
    });
    const h = (e: Event) => { if ((e as CustomEvent).detail === capability) setSel(getSelectedAiRouteId(capability)); };
    window.addEventListener(EVT, h);
    return () => { alive = false; window.removeEventListener(EVT, h); };
  }, [capability, tick]);
  const usable = routes.filter((r) => r.available !== false);
  const current = usable.find((r) => r.id === sel) ?? usable.find((r) => r.isDefault) ?? usable[0];
  return {
    routes,
    loading,
    current,
    select: (id: string) => setSelectedAiRouteId(capability, id),
    reload: () => setTick((n) => n + 1),
  };
}

export const fmtMultiplier = (m: number) => `×${Number.isInteger(m) ? m.toFixed(1) : String(+m.toFixed(2))}`;

function fmtPriceNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** 功能注释：线路右侧 / 下拉里的计价短签；生图优先固定单价 */
export function fmtRoutePriceBadge(r: PlatformAiRoute, capability: AiCapability, prefer: "points" | "kk" = "points"): string {
  if (capability === "image") {
    if (prefer === "kk" && r.priceKk != null) return `${fmtPriceNum(r.priceKk)} KK/次`;
    if (prefer !== "kk" && r.pricePoints != null) return `${fmtPriceNum(r.pricePoints)} 豆/次`;
    if (r.pricePoints != null) return `${fmtPriceNum(r.pricePoints)} 豆/次`;
    if (r.priceKk != null) return `${fmtPriceNum(r.priceKk)} KK/次`;
    if (r.billingMode === "per_call") return `按次 · ${fmtMultiplier(r.multiplier)}`;
    return `倍率 ${fmtMultiplier(r.multiplier)}`;
  }
  return fmtMultiplier(r.multiplier);
}

/**
 * 功能注释：生图「开始生成」副文案——展示本次具体扣费。
 * currency=points 创作/审核扣织梦豆；kk 玩家游玩扣 KK 币。
 */
export function fmtImageChargeHint(
  r: PlatformAiRoute | undefined,
  opts?: { personalFallback?: boolean; currency?: "points" | "kk" },
): string {
  if (opts?.personalFallback) return "个人网关 · 不扣平台积分";
  // 功能注释：线路未到时不写「加载中」，避免底栏看起来像已经在生图
  if (!r) return "";
  const preferKk = opts?.currency === "kk";
  if (preferKk && r.priceKk != null) return `每次 ${fmtPriceNum(r.priceKk)} KK 币`;
  if (!preferKk && r.pricePoints != null) return `每次 ${fmtPriceNum(r.pricePoints)} 织梦豆`;
  if (r.pricePoints != null) return `每次 ${fmtPriceNum(r.pricePoints)} 织梦豆`;
  if (r.priceKk != null) return `每次 ${fmtPriceNum(r.priceKk)} KK 币`;
  if (r.billingMode === "per_call") return `按次扣费 · 倍率 ${fmtMultiplier(r.multiplier)}`;
  return `倍率 ${fmtMultiplier(r.multiplier)} · 按次计费`;
}

/** 功能注释：下拉选项文案 */
export function fmtRouteOptionLabel(r: PlatformAiRoute, capability: AiCapability): string {
  const maint = r.available === false ? "（维护中）" : "";
  if (capability === "image") {
    const badge = fmtRoutePriceBadge(r, capability);
    return `${r.name} · ${badge}${maint}`;
  }
  return `${r.name} · 倍率 ${fmtMultiplier(r.multiplier)}${maint}`;
}
