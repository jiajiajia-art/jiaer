/**
 * 平台 AI 线路：运营在后台（AI 模型中心）配置线路与用户价格倍率，前端只读展示并让玩家选择。
 * 接口：GET /api/romance/ai-routes?capability=text|image（见 docs/后端对接-字段与接口清单.md 第 14 节）。
 * 选择结果按能力全局保存；请求 AI 时带上 routeId，后端按该线路调用与计费。接口不可用时返回空列表，前端不展示选择器，由后端走默认线路。
 */
import { useEffect, useState } from "react";
import { loadGlobal, saveGlobal } from "./saveScope";
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";

export type AiCapability = "text" | "image";

export type PlatformAiRoute = {
  id: string;
  name: string;
  desc?: string;
  tag?: string;
  /** 用户价格倍率，1 = 不加价 */
  multiplier: number;
  isDefault?: boolean;
  available?: boolean;
};

const K_SEL = (c: AiCapability) => `star:aiRoute:${c}`;
const EVT = "star:aiRoute";
const cache: Partial<Record<AiCapability, Promise<PlatformAiRoute[]>>> = {};

function normalize(raw: unknown): PlatformAiRoute | null {
  const r = raw as Record<string, unknown>;
  const id = String(r?.id ?? "").trim();
  if (!id) return null;
  const mx = r.multiplierX10000;
  const multiplier = typeof r.multiplier === "number" ? r.multiplier : typeof mx === "number" ? mx / 10000 : 1;
  return {
    id,
    name: String(r.name ?? r.displayName ?? id),
    desc: r.desc ? String(r.desc) : undefined,
    tag: r.tag ? String(r.tag) : undefined,
    multiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
    isDefault: r.isDefault === true,
    available: r.available !== false,
  };
}

export function fetchAiRoutes(capability: AiCapability, force = false): Promise<PlatformAiRoute[]> {
  if (!force && cache[capability]) return cache[capability]!;
  const base = String(resolveFunloomApiBase() || "").trim().replace(/\/$/, "");
  const token = readFunloomAuthToken();
  const p = fetch(`${base}/api/romance/ai-routes?capability=${capability}`, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const items: unknown[] = j?.data?.items ?? j?.items ?? [];
      return Array.isArray(items) ? items.map(normalize).filter((x): x is PlatformAiRoute => !!x) : [];
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
  useEffect(() => {
    let alive = true;
    void fetchAiRoutes(capability).then((r) => { if (alive) { setRoutes(r); setLoading(false); } });
    const h = (e: Event) => { if ((e as CustomEvent).detail === capability) setSel(getSelectedAiRouteId(capability)); };
    window.addEventListener(EVT, h);
    return () => { alive = false; window.removeEventListener(EVT, h); };
  }, [capability]);
  const usable = routes.filter((r) => r.available !== false);
  const current = usable.find((r) => r.id === sel) ?? usable.find((r) => r.isDefault) ?? usable[0];
  return { routes, loading, current, select: (id: string) => setSelectedAiRouteId(capability, id) };
}

export const fmtMultiplier = (m: number) => `×${Number.isInteger(m) ? m.toFixed(1) : String(+m.toFixed(2))}`;
