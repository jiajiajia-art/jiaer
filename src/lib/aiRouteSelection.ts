/**
 * 功能注释：玩家 AI 线路选择（主站侧）。AI 文游 / 酒馆卡 / Romance 游玩共用同一份选择：
 * - 存储键与事件与 Romance `lib/platformAiRoutes.ts` 完全一致（`star:aiRoute:text`，值为 JSON 字符串；事件 `star:aiRoute`），
 *   所以在任意一处切换，另外两处立即同步；Romance 请求体自带 `routeId`。
 * - 主站 AI 接口（/api/visual/session/*、/api/st/apps/*\/session/*）由 authFetch / axios 拦截器自动追加查询参数 `aiRouteId`。
 *   用查询参数而非自定义请求头：不触发跨域预检；只有玩家主动选了线路才追加，未选择 = 平台默认线路。
 * - 线路列表读 `GET /api/romance/ai-routes?capability=text`（玩家只读接口）。
 */
import { HOST_ADDRESS } from '../config';

export const AI_ROUTE_STORAGE_KEY = 'star:aiRoute:text';
export const AI_ROUTE_EVENT = 'star:aiRoute';

export type AiRouteBillingMode = 'per_token' | 'per_call';

export type AiRouteOption = {
  id: string;
  name: string;
  desc?: string;
  tag?: string;
  /** 功能注释：分组名（厂商 / 系列）；后端未给时用 tag，再没有归「平台线路」 */
  group: string;
  groupIcon?: string;
  /** 功能注释：用户价格倍率，1 = 不加价 */
  multiplier: number;
  isDefault: boolean;
  available: boolean;
  /** 功能注释：以下为后端可选字段，给了才显示（见交接文档模块六） */
  billingMode?: AiRouteBillingMode;
  /** 创作 / 预览：织梦豆单价 */
  pricePoints?: number;
  /** 游玩：KK 币单价 */
  priceKk?: number;
  priceUnit?: string;
};

function readJsonString(key: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return '';
    const v = JSON.parse(raw);
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

export const getSelectedAiRouteId = (): string => readJsonString(AI_ROUTE_STORAGE_KEY);

/** 功能注释：空串 = 恢复平台默认线路 */
export function setSelectedAiRouteId(id: string): void {
  try {
    if (id) localStorage.setItem(AI_ROUTE_STORAGE_KEY, JSON.stringify(id));
    else localStorage.removeItem(AI_ROUTE_STORAGE_KEY);
  } catch {
    /* 隐私模式等：不影响游玩，走默认线路 */
  }
  window.dispatchEvent(new CustomEvent(AI_ROUTE_EVENT, { detail: 'text' }));
}

export function subscribeAiRoute(fn: () => void): () => void {
  const onEvt = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (!d || d === 'text') fn();
  };
  const onStorage = (e: StorageEvent) => { if (e.key === AI_ROUTE_STORAGE_KEY) fn(); };
  window.addEventListener(AI_ROUTE_EVENT, onEvt);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(AI_ROUTE_EVENT, onEvt);
    window.removeEventListener('storage', onStorage);
  };
}

/* —— 请求自动带线路 —— */
const AI_URL_RE = /\/api\/visual\/session\/|\/(?:api\/)?st\/apps\/[^/?#]+\/session\//;

export const isAiRoutedUrl = (url: string): boolean => AI_URL_RE.test(url);

/** 功能注释：给主站 AI 接口地址追加 aiRouteId；未选择线路或非 AI 接口原样返回 */
export function withAiRouteParam(url: string): string {
  const id = getSelectedAiRouteId();
  if (!id || !isAiRoutedUrl(url) || /[?&]aiRouteId=/.test(url)) return url;
  const hashAt = url.indexOf('#');
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const hash = hashAt >= 0 ? url.slice(hashAt) : '';
  return `${base}${base.includes('?') ? '&' : '?'}aiRouteId=${encodeURIComponent(id)}${hash}`;
}

/* —— 线路列表 —— */
function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** 功能注释：单价可能散落在顶层 / pricing / 多种别名；×10000 整型也兼容 */
function pickPrice(r: Record<string, unknown>, keys: string[]): number | undefined {
  const nested = (r.pricing && typeof r.pricing === 'object')
    ? (r.pricing as Record<string, unknown>)
    : undefined;
  for (const key of keys) {
    const v = num(r[key]) ?? (nested ? num(nested[key]) : undefined);
    if (v !== undefined) return v;
    const x = num(r[`${key}X10000`]) ?? (nested ? num(nested[`${key}X10000`]) : undefined);
    if (x !== undefined) return x / 10000;
  }
  return undefined;
}

export function normalizeAiRoute(raw: unknown): AiRouteOption | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  if (!id) return null;
  const mx = num(r.multiplierX10000);
  const m = num(r.multiplier) ?? (mx !== undefined ? mx / 10000 : 1);
  const tag = r.tag ? String(r.tag) : undefined;
  const modeRaw = r.billingMode ?? (r.pricing as Record<string, unknown> | undefined)?.billingMode;
  const mode = modeRaw === 'per_call' || modeRaw === 'per_token' ? modeRaw : undefined;
  const priceUnitRaw = r.priceUnit ?? r.price_unit ?? (r.pricing as Record<string, unknown> | undefined)?.priceUnit;
  return {
    id,
    name: String(r.name ?? r.displayName ?? id),
    desc: r.desc ? String(r.desc) : undefined,
    tag,
    group: String(r.group ?? r.vendor ?? tag ?? '平台线路'),
    groupIcon: r.groupIcon ? String(r.groupIcon) : undefined,
    multiplier: m > 0 ? m : 1,
    isDefault: r.isDefault === true,
    available: r.available !== false,
    billingMode: mode,
    pricePoints: pickPrice(r, ['pricePoints', 'price_points', 'pointsPrice', 'userPricePoints']),
    priceKk: pickPrice(r, ['priceKk', 'price_kk', 'kkPrice', 'userPriceKk']),
    priceUnit: priceUnitRaw ? String(priceUnitRaw) : undefined,
  };
}

let routesCache: Promise<AiRouteOption[]> | null = null;

export function fetchAiRouteOptions(token?: string | null, force = false): Promise<AiRouteOption[]> {
  if (!force && routesCache) return routesCache;
  const base = String(HOST_ADDRESS || '').replace(/\/$/, '');
  const p = fetch(`${base}/api/romance/ai-routes?capability=text`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const items: unknown[] = j?.data?.items ?? j?.items ?? [];
      return Array.isArray(items) ? items.map(normalizeAiRoute).filter((x): x is AiRouteOption => !!x) : [];
    })
    .catch(() => [] as AiRouteOption[]);
  routesCache = p;
  void p.then((list) => { if (!list.length) routesCache = null; });
  return p;
}

/** 功能注释：当前生效线路——玩家选的（且仍可用）优先，否则平台默认，再否则第一条可用 */
export function resolveActiveRoute(routes: AiRouteOption[], selectedId: string): AiRouteOption | undefined {
  const picked = selectedId ? routes.find((r) => r.id === selectedId && r.available) : undefined;
  return picked ?? routes.find((r) => r.isDefault && r.available) ?? routes.find((r) => r.available);
}

export const fmtMultiplier = (m: number) => `×${Number.isInteger(m) ? m : m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;

function fmtPriceNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** 功能注释：线路消耗文案（倍率 + 可选单价），列表与「正在使用」共用 */
export function formatAiRouteCostLines(r: Pick<AiRouteOption, 'multiplier' | 'billingMode' | 'pricePoints' | 'priceKk' | 'priceUnit'>): string[] {
  const unit = r.priceUnit || '万 token';
  const lines: string[] = [];
  if (r.billingMode) lines.push(r.billingMode === 'per_call' ? '按次扣费' : '按量扣费');
  lines.push(`倍率 ${fmtMultiplier(r.multiplier)}`);
  if (r.pricePoints !== undefined) lines.push(`${fmtPriceNum(r.pricePoints)} 织梦豆 / ${unit}`);
  if (r.priceKk !== undefined) lines.push(`${fmtPriceNum(r.priceKk)} KK 币 / ${unit}`);
  return lines;
}
