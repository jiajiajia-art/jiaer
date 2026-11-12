/**
 * 创作者统一素材库 API：头像（已有）/ 地点整包 / 地点图 / 通用图。
 * 功能注释：所有请求带 funloom JWT；失败抛出可直接 Toast 的中文 message。
 */
import {
  readFunloomAuthToken,
  resolveFunloomApiBase,
  resolvePlatformAvatarUrl,
} from "./platformAvatarLibrary";
import type { PlatformLocationItem } from "./platformLocationLibrary";
import type { LocationAssetPurpose, PlatformLocationAssetItem } from "./platformLocationAssetLibrary";
import type { Asset } from "./freeStyle";

function apiBase(): string {
  return resolveFunloomApiBase();
}

function authHeaders(json = true): HeadersInit {
  const token = readFunloomAuthToken();
  if (!token) throw new Error("请先登录后使用云端素材库");
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function parseJson<T>(res: Response): Promise<T & { success?: boolean; message?: string }> {
  const json = (await res.json().catch(() => null)) as (T & { success?: boolean; message?: string }) | null;
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || (res.status === 503 ? "对象存储不可用，请稍后重试" : `请求失败 ${res.status}`));
  }
  return json;
}

export type CreatorAssetTab = "avatar" | "locationPack" | "locationImage" | "general";
export type CreatorAssetScope = "mine" | "public";

export type PlatformAvatarMineItem = {
  id: string;
  gender: string;
  ageGroup: string;
  backgroundType: string;
  imageUrl: string;
  thumbUrl?: string;
  title?: string;
  kind?: string;
};

/** 功能注释：头像库 mine / public / system */
export async function listPlatformAvatars(scope: "mine" | "public" | "system", q = ""): Promise<PlatformAvatarMineItem[]> {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (q.trim()) params.set("q", q.trim());
  const res = await fetch(`${apiBase()}/api/avatar-library?${params}`, { headers: authHeaders(false) });
  const json = await parseJson<{ data?: PlatformAvatarMineItem[] }>(res);
  return (json.data || [])
    .filter((x) => x && String(x.imageUrl || "").trim())
    .map((x) => ({ ...x, imageUrl: resolvePlatformAvatarUrl(x.imageUrl), thumbUrl: x.thumbUrl ? resolvePlatformAvatarUrl(x.thumbUrl) : undefined }));
}

/** 功能注释：私人头像上传（正方形裁剪由调用方先做完再传 File） */
export async function uploadPrivateAvatar(
  file: File,
  meta: { gender: string; ageGroup: string; backgroundType: string; title?: string },
): Promise<PlatformAvatarMineItem> {
  const token = readFunloomAuthToken();
  if (!token) throw new Error("请先登录后使用云端素材库");
  const form = new FormData();
  form.append("file", file);
  form.append("gender", meta.gender);
  form.append("ageGroup", meta.ageGroup);
  form.append("backgroundType", meta.backgroundType);
  form.append("kind", "private");
  if (meta.title) form.append("title", meta.title);
  const res = await fetch(`${apiBase()}/api/avatar-library/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body: form,
  });
  const json = await parseJson<{ data?: PlatformAvatarMineItem }>(res);
  if (!json.data?.imageUrl) throw new Error("上传头像失败");
  return {
    ...json.data,
    imageUrl: resolvePlatformAvatarUrl(json.data.imageUrl),
    thumbUrl: json.data.thumbUrl ? resolvePlatformAvatarUrl(json.data.thumbUrl) : undefined,
  };
}

export async function deletePrivateAvatar(id: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/avatar-library/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  await parseJson(res);
}

/** 功能注释：地点整包 mine / public */
export async function listLocationPacks(scope: CreatorAssetScope, q = ""): Promise<PlatformLocationItem[]> {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (q.trim()) params.set("q", q.trim());
  const res = await fetch(`${apiBase()}/api/location-library?${params}`, { headers: authHeaders(false) });
  const json = await parseJson<{ data?: PlatformLocationItem[] }>(res);
  return (json.data || [])
    .filter((x) => x && String(x.name || "").trim())
    .map((x) => ({ ...x, imageUrl: resolvePlatformAvatarUrl(x.imageUrl) }));
}

export async function uploadLocationPackCover(file: File): Promise<string> {
  const token = readFunloomAuthToken();
  if (!token) throw new Error("请先登录后使用云端素材库");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${apiBase()}/api/location-library/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body: form,
  });
  const json = await parseJson<{ data?: { imageUrl?: string } }>(res);
  const url = String(json.data?.imageUrl || "").trim();
  if (!url) throw new Error("封面上传失败");
  return resolvePlatformAvatarUrl(url);
}

export async function saveLocationPack(body: {
  id?: string;
  name: string;
  description?: string;
  imageUrl: string;
  treeJson?: unknown;
  tags?: string[];
}): Promise<PlatformLocationItem> {
  if (body.id) {
    const res = await fetch(`${apiBase()}/api/location-library/${encodeURIComponent(body.id)}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await parseJson<{ data?: PlatformLocationItem }>(res);
    if (!json.data) throw new Error("保存地点整包失败");
    return json.data;
  }
  const res = await fetch(`${apiBase()}/api/location-library`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await parseJson<{ data?: PlatformLocationItem }>(res);
  if (!json.data) throw new Error("保存到我的地点库失败");
  return json.data;
}

export async function disableLocationPack(id: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/location-library/${encodeURIComponent(id)}/disable`, {
    method: "POST",
    headers: authHeaders(false),
  });
  await parseJson(res);
}

/** 功能注释：地点图 mine / public */
export async function listLocationImages(
  scope: CreatorAssetScope,
  opts: { q?: string; purpose?: LocationAssetPurpose } = {},
): Promise<PlatformLocationAssetItem[]> {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.purpose) params.set("purpose", opts.purpose);
  const res = await fetch(`${apiBase()}/api/location-asset-library?${params}`, { headers: authHeaders(false) });
  const json = await parseJson<{ data?: PlatformLocationAssetItem[] }>(res);
  return (json.data || [])
    .filter((x) => x && String(x.imageUrl || "").trim())
    .map((x) => ({ ...x, imageUrl: resolvePlatformAvatarUrl(x.imageUrl) }));
}

export async function uploadLocationImageFile(file: File): Promise<string> {
  const token = readFunloomAuthToken();
  if (!token) throw new Error("请先登录后使用云端素材库");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${apiBase()}/api/location-asset-library/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body: form,
  });
  const json = await parseJson<{ data?: { imageUrl?: string } }>(res);
  const url = String(json.data?.imageUrl || "").trim();
  if (!url) throw new Error("上传地点图失败");
  return resolvePlatformAvatarUrl(url);
}

export async function createLocationImage(body: {
  name: string;
  imageUrl: string;
  purpose?: LocationAssetPurpose;
  tags?: string[];
  description?: string;
}): Promise<PlatformLocationAssetItem> {
  const res = await fetch(`${apiBase()}/api/location-asset-library`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await parseJson<{ data?: PlatformLocationAssetItem }>(res);
  if (!json.data) throw new Error("保存地点图失败");
  return { ...json.data, imageUrl: resolvePlatformAvatarUrl(json.data.imageUrl) };
}

export async function disableLocationImage(id: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/location-asset-library/${encodeURIComponent(id)}/disable`, {
    method: "POST",
    headers: authHeaders(false),
  });
  await parseJson(res);
}

/** 功能注释：通用图云端列表 */
export async function listRomanceCloudAssets(): Promise<Asset[]> {
  const res = await fetch(`${apiBase()}/api/romance/assets`, { headers: authHeaders(false) });
  const json = await parseJson<{ data?: Asset[] }>(res);
  return (json.data || []).filter((x) => x?.url);
}

export async function upsertRomanceCloudAsset(asset: Partial<Asset> & { url: string }): Promise<Asset> {
  const res = await fetch(`${apiBase()}/api/romance/assets`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(asset),
  });
  const json = await parseJson<{ data?: Asset }>(res);
  if (!json.data) throw new Error("保存到我的素材库失败");
  return json.data;
}

export async function patchRomanceCloudAsset(id: string, body: { temp?: boolean; usedAt?: number; name?: string }): Promise<Asset> {
  const res = await fetch(`${apiBase()}/api/romance/assets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await parseJson<{ data?: Asset }>(res);
  if (!json.data) throw new Error("更新素材失败");
  return json.data;
}

export async function deleteRomanceCloudAsset(id: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/romance/assets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  await parseJson(res);
}

/** 功能注释：有 token 时把采用/上传结果写入云端「我的 · 通用图」；失败不阻断本地写入 */
export function syncRememberToCloud(url: string, name = "图片", opts?: { temp?: boolean }): void {
  if (!url || !readFunloomAuthToken()) return;
  void upsertRomanceCloudAsset({ url, name: name.slice(0, 24) || "图片", temp: opts?.temp, at: Date.now() }).catch(() => {
    /* 本机已记住；云端失败由下次打开素材库再提示 */
  });
}
