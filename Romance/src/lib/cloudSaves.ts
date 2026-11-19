/**
 * 云存档客户端（对接 docs/后端对接-字段与接口清单.md 第 2 节 + 2025-11-17 配额需求）。
 * - 只在「已登录 + URL 带作品 fileId + 非作者预览」时启用。
 * - 账号级手动位：普通 10 / 会员 20；自动存档不占配额。
 * - 写入：手动槽立即上传，自动槽按 CLOUD_AUTOSAVE_INTERVAL_MS 节流。
 * - 读取：打开存档列表时拉摘要 + quota；云端比本机新的槽才下载完整 state。
 */
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";

export const CLOUD_AUTOSAVE_INTERVAL_MS = 15_000;
/** 功能注释：与后端约定单槽上限 10MB；超出不上传，只留本机 */
export const CLOUD_SAVE_MAX_BYTES = 10 * 1024 * 1024;

/** 功能注释：账号级云端手动存档权益数字（与后端 freeLimit / memberLimit 对齐） */
export const CLOUD_FREE_LIMIT = 10;
export const CLOUD_MEMBER_LIMIT = 20;

export type CloudSlot = { id: string; name: string; updatedAt: number; auto?: boolean; state: unknown };
export type CloudSlotSummary = { id: string; name: string; updatedAt: number; auto?: boolean };

export type CloudQuota = {
  used: number;
  limit: number;
  isMember: boolean;
  freeLimit: number;
  memberLimit: number;
};

export type CloudSyncStatus =
  | { kind: "off"; reason: "not-logged-in" | "no-game" | "preview" | "unavailable" }
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "ok"; at: number }
  | { kind: "error"; message: string };

let status: CloudSyncStatus = { kind: "idle" };
let unavailable = false;
let quotaCache: CloudQuota | null = null;
const listeners = new Set<(s: CloudSyncStatus) => void>();
const quotaListeners = new Set<(q: CloudQuota | null) => void>();

function setStatus(s: CloudSyncStatus) {
  status = s;
  for (const fn of listeners) fn(s);
}
export const getCloudStatus = () => status;
export function onCloudStatus(fn: (s: CloudSyncStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getCloudQuota = () => quotaCache;
export function onCloudQuota(fn: (q: CloudQuota | null) => void): () => void {
  quotaListeners.add(fn);
  fn(quotaCache);
  return () => quotaListeners.delete(fn);
}

function setQuota(q: CloudQuota | null) {
  quotaCache = q;
  for (const fn of quotaListeners) fn(q);
}

/** 功能注释：默认配额（接口未带 quota 时的展示兜底；仍以后端校验为准） */
export function defaultCloudQuota(partial?: Partial<CloudQuota>): CloudQuota {
  const freeLimit = partial?.freeLimit ?? CLOUD_FREE_LIMIT;
  const memberLimit = partial?.memberLimit ?? CLOUD_MEMBER_LIMIT;
  const isMember = !!partial?.isMember;
  const limit = partial?.limit ?? (isMember ? memberLimit : freeLimit);
  return {
    used: Math.max(0, partial?.used ?? 0),
    limit,
    isMember,
    freeLimit,
    memberLimit,
  };
}

function parseQuota(raw: unknown): CloudQuota | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const used = Number(o.used);
  const limit = Number(o.limit);
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return null;
  return defaultCloudQuota({
    used,
    limit,
    isMember: o.isMember === true,
    freeLimit: Number.isFinite(Number(o.freeLimit)) ? Number(o.freeLimit) : CLOUD_FREE_LIMIT,
    memberLimit: Number.isFinite(Number(o.memberLimit)) ? Number(o.memberLimit) : CLOUD_MEMBER_LIMIT,
  });
}

/** 功能注释：判断能否走云端；返回 null = 可用，否则为关闭原因 */
export function cloudOffReason(gameId: string, preview: boolean): CloudSyncStatus | null {
  if (preview) return { kind: "off", reason: "preview" };
  if (unavailable) return { kind: "off", reason: "unavailable" };
  if (!gameId || gameId === "local") return { kind: "off", reason: "no-game" };
  if (!readFunloomAuthToken()) return { kind: "off", reason: "not-logged-in" };
  return null;
}

export function cloudSaveUrl(gameId: string, slotId?: string, apiBase = resolveFunloomApiBase()): string {
  const base = String(apiBase || "").replace(/\/$/, "");
  const path = slotId ? `/api/romance/saves/${encodeURIComponent(slotId)}` : "/api/romance/saves";
  return `${base}${path}?gameFileId=${encodeURIComponent(gameId)}`;
}

class CloudError extends Error {
  status: number;
  code?: string;
  data?: unknown;
  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** 功能注释：配额超限错误码（新码 SAVE_SLOT_LIMIT；旧码 SLOT_LIMIT 等价） */
export function isSaveSlotLimitCode(code?: string): boolean {
  const c = String(code || "").toUpperCase();
  return c === "SAVE_SLOT_LIMIT" || c === "SLOT_LIMIT";
}

function slotLimitMessage(data: unknown, fallback?: string): string {
  const q = parseQuota(data) || (data && typeof data === "object" ? parseQuota({ ...(data as object), limit: (data as { limit?: number }).limit }) : null);
  if (q) {
    setQuota(q);
    if (!q.isMember && q.used >= q.freeLimit) {
      return fallback?.trim() || `云存档已满（${q.used}/${q.limit}）。开通会员可扩容至 ${q.memberLimit} 个，或覆盖已有槽、删除腾位后再存。`;
    }
    if (q.isMember && q.used >= q.limit) {
      return fallback?.trim() || `云存档已满（${q.used}/${q.limit}），请删除或覆盖后再存。`;
    }
    if (!q.isMember && q.limit <= q.freeLimit && q.used > q.freeLimit) {
      return fallback?.trim() || `会员已到期，云存档上限恢复为 ${q.freeLimit}；请删除多余存档或续费后再新建。`;
    }
  }
  return fallback?.trim() || "云存档位已满，请删除或覆盖后再存。";
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const token = readFunloomAuthToken();
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    code?: string;
    data?: T & { quota?: unknown };
  };
  if (res.status === 404 || res.status === 405 || res.status === 501) {
    // 功能注释：接口未上线——本会话不再请求；验收环境须开通
    unavailable = true;
    throw new CloudError("云存档暂未开通", res.status);
  }
  if (res.status === 401 || json.code === "NOT_LOGGED_IN") {
    throw new CloudError(json.message || "请先登录后使用云存档", 401, json.code || "NOT_LOGGED_IN");
  }
  if (!res.ok || json.success === false) {
    const code = json.code;
    const data = json.data;
    if (isSaveSlotLimitCode(code)) {
      throw new CloudError(slotLimitMessage(data, json.message), res.status, code, data);
    }
    throw new CloudError(json.message || `云存档请求失败（${res.status}）`, res.status, code, data);
  }
  return (json.data ?? (json as unknown)) as T;
}

/** 功能注释：作者预览槽不上云（文档约定） */
const isPreviewSlot = (id: string) => id.startsWith("__author_preview");

export type CloudListResult = { items: CloudSlotSummary[]; quota: CloudQuota | null };

export async function cloudList(gameId: string): Promise<CloudSlotSummary[]> {
  const { items } = await cloudListWithQuota(gameId);
  return items;
}

/** 功能注释：列表同时带回账号级 quota（used 仅统计手动槽、跨作品合计） */
export async function cloudListWithQuota(gameId: string): Promise<CloudListResult> {
  const data = await call<{ items?: CloudSlotSummary[]; quota?: unknown } | CloudSlotSummary[]>("GET", cloudSaveUrl(gameId));
  const rows = Array.isArray(data) ? data : data?.items ?? [];
  const items = rows.filter((r) => r && r.id && !isPreviewSlot(r.id));
  const quota = !Array.isArray(data) ? parseQuota(data?.quota) : null;
  if (quota) setQuota(quota);
  return { items, quota };
}

export const cloudGet = (gameId: string, id: string) => call<CloudSlot>("GET", cloudSaveUrl(gameId, id));
export const cloudDelete = async (gameId: string, id: string) => {
  const r = await call<unknown>("DELETE", cloudSaveUrl(gameId, id));
  // 功能注释：删除后尽量刷新配额；失败不挡本机删除
  void refreshCloudQuota(gameId).catch(() => undefined);
  return r;
};
export const cloudRename = (gameId: string, id: string, name: string) => call<unknown>("PATCH", cloudSaveUrl(gameId, id), { name });

/** 功能注释：单独刷新配额（打开面板 / 存删后） */
export async function refreshCloudQuota(gameId: string): Promise<CloudQuota | null> {
  const off = cloudOffReason(gameId, false);
  if (off) return null;
  try {
    const { quota } = await cloudListWithQuota(gameId);
    return quota;
  } catch {
    return quotaCache;
  }
}

/** 功能注释：契约别名（产品单测 / 旧调用）→ 现实现 cloud* */
export const listCloudSaves = cloudList;
export const getCloudSave = cloudGet;
export const deleteCloudSave = cloudDelete;
export const renameCloudSave = cloudRename;
export async function putCloudSave(gameId: string, slot: CloudSlot): Promise<unknown> {
  return call("PUT", cloudSaveUrl(gameId, slot.id), slot);
}
/** 功能注释：与 CLOUD_AUTOSAVE_INTERVAL_MS 同值，便于契约单测检索 */
export const CLOUD_AUTOSAVE_MIN_MS = CLOUD_AUTOSAVE_INTERVAL_MS;

export function slotByteSize(slot: CloudSlot): number {
  try { return new Blob([JSON.stringify(slot)]).size; } catch { return JSON.stringify(slot).length * 2; }
}

/* ───── 上传队列：同一槽只保留最后一次；自动槽节流 ───── */
const pending = new Map<string, { gameId: string; slot: CloudSlot }>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const lastPush = new Map<string, number>();

async function pushNow(key: string) {
  timers.delete(key);
  const job = pending.get(key);
  if (!job) return;
  pending.delete(key);
  const { gameId, slot } = job;
  if (slotByteSize(slot) > CLOUD_SAVE_MAX_BYTES) {
    setStatus({ kind: "error", message: "存档超过 10MB，无法上传云端" });
    return;
  }
  setStatus({ kind: "syncing" });
  try {
    await call("PUT", cloudSaveUrl(gameId, slot.id), slot);
    lastPush.set(key, Date.now());
    setStatus({ kind: "ok", at: Date.now() });
    if (!slot.auto) void refreshCloudQuota(gameId).catch(() => undefined);
  } catch (e) {
    const err = e as CloudError;
    if (err.status === 409 && err.code === "STALE_SAVE") {
      // 功能注释：云端有更新的版本（另一台设备玩过）——不覆盖，下次打开存档列表时会拉回来
      setStatus({ kind: "error", message: "云端有更新的进度，已保留云端版本；打开存档列表可同步" });
    } else if (isSaveSlotLimitCode(err.code)) {
      setStatus({ kind: "error", message: err.message });
    } else if (unavailable) {
      setStatus({ kind: "off", reason: "unavailable" });
    } else if (err.status === 401) {
      setStatus({ kind: "off", reason: "not-logged-in" });
    } else {
      setStatus({ kind: "error", message: err.message || "云端同步失败" });
    }
  }
}

/** 功能注释：本机写入成功后调用；不阻塞、不抛错 */
export function queueCloudPush(gameId: string, slot: CloudSlot, preview: boolean): void {
  const off = cloudOffReason(gameId, preview);
  if (off || isPreviewSlot(slot.id)) { if (off) setStatus(off); return; }
  const key = `${gameId}:${slot.id}`;
  pending.set(key, { gameId, slot });
  if (timers.has(key)) return;
  const wait = slot.auto ? Math.max(0, (lastPush.get(key) ?? 0) + CLOUD_AUTOSAVE_INTERVAL_MS - Date.now()) : 0;
  timers.set(key, setTimeout(() => { void pushNow(key); }, wait));
}

/** 功能注释：立即把排队中的上传发出去（退出 / 手动存档时） */
export async function flushCloudPushes(): Promise<void> {
  const keys = [...pending.keys()];
  for (const k of keys) { const t = timers.get(k); if (t) clearTimeout(t); }
  await Promise.all(keys.map((k) => pushNow(k)));
}

/**
 * 功能注释：拉取云端存档，比本机新的写回本机。
 * localUpdatedAt：本机各槽 updatedAt；write：写回本机（不再触发上传）。
 * 返回写回的槽数；云端不可用时返回 0。
 */
export async function pullCloudSaves(
  gameId: string,
  preview: boolean,
  localUpdatedAt: Map<string, number>,
  write: (slot: CloudSlot) => Promise<boolean>,
): Promise<number> {
  const off = cloudOffReason(gameId, preview);
  if (off) { setStatus(off); return 0; }
  setStatus({ kind: "syncing" });
  try {
    const { items } = await cloudListWithQuota(gameId);
    let n = 0;
    for (const r of items) {
      if ((localUpdatedAt.get(r.id) ?? 0) >= r.updatedAt) continue;
      const full = await cloudGet(gameId, r.id);
      if (full?.state && (await write({ ...full, id: r.id }))) n += 1;
    }
    setStatus({ kind: "ok", at: Date.now() });
    return n;
  } catch (e) {
    const err = e as CloudError;
    if (err.status === 401) setStatus({ kind: "off", reason: "not-logged-in" });
    else setStatus(unavailable ? { kind: "off", reason: "unavailable" } : { kind: "error", message: (e as Error).message });
    return 0;
  }
}

export function cloudStatusText(s: CloudSyncStatus): string {
  switch (s.kind) {
    case "off":
      return s.reason === "not-logged-in" ? "请先登录后使用云存档"
        : s.reason === "unavailable" ? "云存档暂未开通，请稍后重试"
        : s.reason === "preview" ? "作者测试存档 · 不上传云端"
        : "请绑定作品后使用云存档";
    case "syncing": return "正在同步云端…";
    case "ok": return "已同步到云端";
    case "error": return s.message;
    default: return "";
  }
}

/** 功能注释：前端预检——新建空槽时是否会超限（覆盖同 slotId 不拦） */
export function canCreateManualCloudSave(quota: CloudQuota | null | undefined, isOverwrite: boolean): boolean {
  if (isOverwrite) return true;
  if (!quota) return true; // 无配额信息时交给后端强校验
  return quota.used < quota.limit;
}

/** 功能注释：非会员接近满额（≥8）时的轻提示 */
export function nearLimitMemberHint(quota: CloudQuota | null | undefined): string | null {
  if (!quota || quota.isMember) return null;
  if (quota.used >= quota.freeLimit) return null;
  if (quota.used >= 8) return `开通会员可扩容至 ${quota.memberLimit} 个云存档`;
  return null;
}

/** 功能注释：拉起平台登录 */
export function openCloudLogin(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("funloom:open-auth"));
}

/** 功能注释：拉起充值中心 · 会员页（宿主 RomanceHost 监听） */
export function openCloudMembership(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("funloom:open-recharge", { detail: { tab: "membership" } }));
}

/** 功能注释：拉起充值中心 · 钻石/织梦豆页（宿主 detail.tab = diamonds | membership） */
export function openCloudRecharge(tab: "diamonds" | "membership" = "diamonds"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("funloom:open-recharge", { detail: { tab } }));
}
