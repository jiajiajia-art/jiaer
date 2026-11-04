/**
 * 对接 funloom 运营地点库（/api/location-library）。
 * 库条目 = 一张大地图；treeJson 为其下地点树。编辑器「从地点库添加」复制整图进作品后与库脱钩。
 */
import { readFunloomAuthToken, resolveFunloomApiBase, resolvePlatformAvatarUrl } from "./platformAvatarLibrary";

export type PlatformLocationItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  status?: string;
  /** 功能注释：大地图下的地点树 JSON；缺省则导入时退化为单地点 */
  treeJson?: unknown;
};

function apiBase(): string {
  return resolveFunloomApiBase();
}

export function resolvePlatformLocationImageUrl(path: string | null | undefined): string {
  return resolvePlatformAvatarUrl(path);
}

/** 功能注释：创作者侧只请求启用中的大地图；停用项后端也不会返回给非运营账号 */
export async function listActivePlatformLocations(q = ""): Promise<PlatformLocationItem[]> {
  const token = readFunloomAuthToken();
  if (!token) throw new Error("请先登录后再从地点库添加");
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  const res = await fetch(`${apiBase()}/api/location-library${qs ? `?${qs}` : ""}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: PlatformLocationItem[];
    message?: string;
  } | null;
  if (!res.ok || !json?.success || !Array.isArray(json.data)) {
    throw new Error(json?.message || "加载地点库失败");
  }
  return json.data.filter((x) => x && String(x.name || "").trim() && String(x.status || "active") !== "disabled");
}
