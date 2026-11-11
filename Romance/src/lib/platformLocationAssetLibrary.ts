/**
 * 平台地点素材库（/api/location-asset-library）：只存图，按用途筛选。
 * 与地点库（大地图+地点树整包）分离；下架项不返回给创作者。
 */
import { readFunloomAuthToken, resolveFunloomApiBase, resolvePlatformAvatarUrl } from "./platformAvatarLibrary";

export type LocationAssetPurpose = "world_map" | "location_scene" | "cover";

export type PlatformLocationAssetItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  purpose: LocationAssetPurpose;
  tags?: string[];
  authorKul?: string;
  status?: string;
};

export const LOCATION_ASSET_PURPOSE_LABEL: Record<LocationAssetPurpose, string> = {
  world_map: "大地图图",
  location_scene: "地点场景图",
  cover: "封面",
};

function apiBase(): string {
  return resolveFunloomApiBase();
}

export function resolvePlatformLocationAssetUrl(path: string | null | undefined): string {
  return resolvePlatformAvatarUrl(path);
}

/** 功能注释：创作者只读上架素材；可按用途筛，q 搜名称/库兰号/标签 */
export async function listActivePlatformLocationAssets(opts: {
  q?: string;
  purpose?: LocationAssetPurpose;
} = {}): Promise<PlatformLocationAssetItem[]> {
  const token = readFunloomAuthToken();
  if (!token) throw new Error("请先登录后再打开素材库");
  const params = new URLSearchParams();
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.purpose) params.set("purpose", opts.purpose);
  const qs = params.toString();
  const res = await fetch(`${apiBase()}/api/location-asset-library${qs ? `?${qs}` : ""}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: PlatformLocationAssetItem[];
    message?: string;
  } | null;
  if (!res.ok || !json?.success || !Array.isArray(json.data)) {
    throw new Error(json?.message || "加载地点素材库失败");
  }
  return json.data.filter((x) => x && String(x.imageUrl || "").trim() && String(x.status || "active") !== "disabled");
}
