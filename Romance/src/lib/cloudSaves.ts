/**
 * Romance 云存档客户端：按 gameFileId 隔离；接口未上线（404/405/501）时整会话降级只存本机。
 */
import { resolveFunloomApiBase, readFunloomAuthToken } from "./platformAvatarLibrary";
import type { SaveSlot } from "./storage";

export type CloudSaveListItem = {
  id: string;
  name: string;
  auto?: boolean;
  updatedAt: number;
  summary?: string;
  playerName?: string;
  playerAvatar?: string;
  location?: string;
  time?: string;
  turnCount?: number;
  ended?: boolean;
};

type CloudResult<T> =
  | { ok: true; data: T }
  | { ok: false; code?: string; message?: string; unavailable?: boolean; status?: number };

let cloudDisabledForSession = false;

export function isRomanceCloudDisabled(): boolean {
  return cloudDisabledForSession;
}

export function resetRomanceCloudSessionFlag(): void {
  cloudDisabledForSession = false;
}

function markUnavailable(status: number): void {
  if (status === 404 || status === 405 || status === 501) {
    cloudDisabledForSession = true;
  }
}

function authHeaders(json = true): HeadersInit | null {
  const token = readFunloomAuthToken();
  if (!token) return null;
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<CloudResult<T>> {
  if (cloudDisabledForSession) {
    return { ok: false, unavailable: true, message: "云存档本会话已降级" };
  }
  const headers = authHeaders(body !== undefined);
  if (!headers) {
    return { ok: false, code: "NOT_LOGGED_IN", message: "请先登录" };
  }
  try {
    const res = await fetch(`${resolveFunloomApiBase()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
    });
    if (res.status === 404 || res.status === 405 || res.status === 501) {
      markUnavailable(res.status);
      return { ok: false, unavailable: true, status: res.status, message: "云存档接口未上线" };
    }
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: T;
      code?: string;
      message?: string;
    } | null;
    if (!json?.success) {
      return {
        ok: false,
        code: json?.code,
        message: json?.message || `请求失败 ${res.status}`,
        status: res.status,
      };
    }
    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "网络错误" };
  }
}

function qs(gameFileId: string): string {
  return `gameFileId=${encodeURIComponent(gameFileId)}`;
}

/** GET /api/romance/saves?gameFileId= */
export async function listCloudSaves(gameFileId: string): Promise<CloudResult<CloudSaveListItem[]>> {
  const result = await request<{ items?: CloudSaveListItem[] } | CloudSaveListItem[]>(
    "GET",
    `/api/romance/saves?${qs(gameFileId)}`,
  );
  if (!result.ok) return result;
  const raw = result.data;
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
  return { ok: true, data: items };
}

/** GET /api/romance/saves/:slotId?gameFileId= */
export async function getCloudSave(
  gameFileId: string,
  slotId: string,
): Promise<CloudResult<SaveSlot>> {
  return request<SaveSlot>("GET", `/api/romance/saves/${encodeURIComponent(slotId)}?${qs(gameFileId)}`);
}

/** PUT /api/romance/saves/:slotId?gameFileId= */
export async function putCloudSave(
  gameFileId: string,
  slot: SaveSlot,
): Promise<CloudResult<SaveSlot>> {
  if (String(slot.id || "").startsWith("__author_preview")) {
    return { ok: false, code: "AUTHOR_PREVIEW", message: "作者预览槽不上传云端" };
  }
  return request<SaveSlot>(
    "PUT",
    `/api/romance/saves/${encodeURIComponent(slot.id)}?${qs(gameFileId)}`,
    slot,
  );
}

/** PATCH /api/romance/saves/:slotId?gameFileId= */
export async function renameCloudSave(
  gameFileId: string,
  slotId: string,
  name: string,
): Promise<CloudResult<SaveSlot>> {
  return request<SaveSlot>(
    "PATCH",
    `/api/romance/saves/${encodeURIComponent(slotId)}?${qs(gameFileId)}`,
    { name },
  );
}

/** DELETE /api/romance/saves/:slotId?gameFileId= */
export async function deleteCloudSave(
  gameFileId: string,
  slotId: string,
): Promise<CloudResult<{ deleted?: boolean }>> {
  return request("DELETE", `/api/romance/saves/${encodeURIComponent(slotId)}?${qs(gameFileId)}`);
}
