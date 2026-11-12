/**
 * 云存档客户端（对接 docs/后端对接-字段与接口清单.md 第 2 节）。
 * - 只在「已登录 + URL 带作品 fileId + 非作者预览」时启用；其余情况纯本机。
 * - 后端未开通（404/405/501）时本次会话自动关闭，不反复请求。
 * - 写入：手动槽立即上传，自动槽按 CLOUD_AUTOSAVE_INTERVAL_MS 节流（后端要求承受高频覆盖，但没必要每 300ms 一次）。
 * - 读取：打开存档列表时拉摘要，云端比本机新的槽才下载完整 state 写回本机（按 updatedAt 后写者胜）。
 */
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";

export const CLOUD_AUTOSAVE_INTERVAL_MS = 15_000;
/** 功能注释：与后端约定单槽上限 10MB；超出不上传，只留本机 */
export const CLOUD_SAVE_MAX_BYTES = 10 * 1024 * 1024;

export type CloudSlot = { id: string; name: string; updatedAt: number; auto?: boolean; state: unknown };
export type CloudSlotSummary = { id: string; name: string; updatedAt: number; auto?: boolean };

export type CloudSyncStatus =
  | { kind: "off"; reason: "not-logged-in" | "no-game" | "preview" | "unavailable" }
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "ok"; at: number }
  | { kind: "error"; message: string };

let status: CloudSyncStatus = { kind: "idle" };
let unavailable = false;
const listeners = new Set<(s: CloudSyncStatus) => void>();

function setStatus(s: CloudSyncStatus) {
  status = s;
  for (const fn of listeners) fn(s);
}
export const getCloudStatus = () => status;
export function onCloudStatus(fn: (s: CloudSyncStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
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
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
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
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; code?: string; data?: T };
  if (res.status === 404 || res.status === 405 || res.status === 501) {
    // 功能注释：接口未上线——本会话不再请求，界面显示「仅本机」
    unavailable = true;
    throw new CloudError("云存档暂未开通", res.status);
  }
  if (!res.ok || json.success === false) {
    throw new CloudError(json.message || `云存档请求失败（${res.status}）`, res.status, json.code);
  }
  return (json.data ?? (json as unknown)) as T;
}

/** 功能注释：作者预览槽不上云（文档约定） */
const isPreviewSlot = (id: string) => id.startsWith("__author_preview");

export async function cloudList(gameId: string): Promise<CloudSlotSummary[]> {
  const data = await call<{ items?: CloudSlotSummary[] } | CloudSlotSummary[]>("GET", cloudSaveUrl(gameId));
  const rows = Array.isArray(data) ? data : data?.items ?? [];
  return rows.filter((r) => r && r.id && !isPreviewSlot(r.id));
}
export const cloudGet = (gameId: string, id: string) => call<CloudSlot>("GET", cloudSaveUrl(gameId, id));
export const cloudDelete = (gameId: string, id: string) => call<unknown>("DELETE", cloudSaveUrl(gameId, id));
export const cloudRename = (gameId: string, id: string, name: string) => call<unknown>("PATCH", cloudSaveUrl(gameId, id), { name });

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
    setStatus({ kind: "error", message: "存档超过 10MB，只保存在本机" });
    return;
  }
  setStatus({ kind: "syncing" });
  try {
    await call("PUT", cloudSaveUrl(gameId, slot.id), slot);
    lastPush.set(key, Date.now());
    setStatus({ kind: "ok", at: Date.now() });
  } catch (e) {
    const err = e as CloudError;
    if (err.status === 409 && err.code === "STALE_SAVE") {
      // 功能注释：云端有更新的版本（另一台设备玩过）——不覆盖，下次打开存档列表时会拉回来
      setStatus({ kind: "error", message: "云端有更新的进度，已保留云端版本；打开存档列表可同步" });
    } else if (unavailable) {
      setStatus({ kind: "off", reason: "unavailable" });
    } else {
      setStatus({ kind: "error", message: err.message || "云端同步失败，已保存在本机" });
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
    const rows = await cloudList(gameId);
    let n = 0;
    for (const r of rows) {
      if ((localUpdatedAt.get(r.id) ?? 0) >= r.updatedAt) continue;
      const full = await cloudGet(gameId, r.id);
      if (full?.state && (await write({ ...full, id: r.id }))) n += 1;
    }
    setStatus({ kind: "ok", at: Date.now() });
    return n;
  } catch (e) {
    setStatus(unavailable ? { kind: "off", reason: "unavailable" } : { kind: "error", message: (e as Error).message });
    return 0;
  }
}

export function cloudStatusText(s: CloudSyncStatus): string {
  switch (s.kind) {
    case "off":
      return s.reason === "not-logged-in" ? "仅本机保存 · 登录后可云端同步"
        : s.reason === "unavailable" ? "仅本机保存 · 云存档暂未开通"
        : s.reason === "preview" ? "作者测试存档 · 不上传云端"
        : "仅本机保存";
    case "syncing": return "正在同步云端…";
    case "ok": return "已同步到云端";
    case "error": return s.message;
    default: return "";
  }
}
