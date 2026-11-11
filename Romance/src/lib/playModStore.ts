/**
 * 功能注释：「添加玩法 Mod」商店数据——只读后端已上架组件（GET /api/components/shelf），不使用前端写死目录。
 * 字段与主站 src/api/playMod/playModApi.ts 的 PlayModRecord 一致；契约见 docs/11.11更新-后端交接文档.md 模块二 2.4。
 */
import type { LocalPlayModCatalogItem, PlayModEditorPanelId } from "../mods/playModCatalog";
import type { ThemeApplicabilityCode } from "./officialThemeApplicability";
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary";

/** 功能注释：shelf 每一项（PlayModRecord 子集） */
export type PlayModShelfApiItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  detailMd?: string | null;
  previewImages?: string[] | null;
  authorDisplayName?: string | null;
  iconUrl?: string | null;
  version: string;
  defaultNavLabel?: string | null;
  needsNavEntry?: boolean | null;
  editorPanels?: string[] | null;
  dependsOn?: string[] | null;
  conflictsWith?: string[] | null;
  compatMin?: string | null;
  compatMax?: string | null;
  priceKk?: number | null;
  componentKind?: string | null;
  applicableThemeTagIds?: number[] | null;
  applicableThemeCodes?: string[] | null;
  officialRecommend?: boolean | null;
  listedAt?: string | null;
  stats?: { installGames?: number | null } | null;
  purchased?: boolean | null;
};

/** 功能注释：商店条目 = 安装逻辑需要的目录项 + 接口独有字段 */
export type PlayModStoreItem = LocalPlayModCatalogItem & {
  iconUrl: string | null;
  publishedAt: string;
  recommended: boolean;
  purchased: boolean;
};

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = readFunloomAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function toStoreItem(x: PlayModShelfApiItem): PlayModStoreItem {
  return {
    id: String(x.id),
    slug: String(x.slug || x.id),
    name: x.name,
    description: x.description || "",
    detailDescription: x.detailMd || "",
    priceKk: Number(x.priceKk) || 0,
    version: x.version || "1.0.0",
    defaultNavLabel: x.defaultNavLabel || "",
    needsNavEntry: !!x.needsNavEntry,
    editorPanels: (x.editorPanels ?? []) as PlayModEditorPanelId[],
    // 功能注释：不注入远程 SVG；有 iconUrl 用 <img>，否则显示名称首字
    iconSvg: "",
    iconUrl: x.iconUrl || null,
    componentKind: x.componentKind === "phone_app" ? "phone_app" : "gameplay",
    dependsOn: x.dependsOn?.length ? [...x.dependsOn] : undefined,
    ...(x.conflictsWith?.length ? { conflictsWith: [...x.conflictsWith] } : {}),
    ...(x.compatMin ? { compatMin: x.compatMin } : {}),
    ...(x.compatMax ? { compatMax: x.compatMax } : {}),
    authorName: x.authorDisplayName || "",
    downloadCount: Number(x.stats?.installGames) || 0,
    // 功能注释：预览图只用作者上传的真实 URL
    previewImages: (x.previewImages ?? []).filter((u) => /^https?:\/\//.test(String(u))),
    applicableThemeCodes: (x.applicableThemeCodes ?? []) as ThemeApplicabilityCode[],
    applicableThemeTagIds: x.applicableThemeTagIds ?? null,
    publishedAt: x.listedAt || "",
    recommended: !!x.officialRecommend,
    purchased: !!x.purchased,
  };
}

/** 功能注释：拉取已上架玩法（带 token 时后端填 purchased）；installed 传本作品已装 slug */
export async function listPublishedPlayMods(installed: string[] = []): Promise<PlayModStoreItem[]> {
  const q = new URLSearchParams();
  if (installed.length) q.set("installed", installed.join(","));
  const qs = q.toString();
  const res = await fetch(`${resolveFunloomApiBase()}/api/components/shelf${qs ? `?${qs}` : ""}`, { headers: authHeaders() });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: unknown;
    message?: string;
  } | null;
  const data = json?.data as PlayModShelfApiItem[] | { items?: PlayModShelfApiItem[] } | undefined;
  const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;
  if (!res.ok || !json?.success || !rows) {
    throw new Error(json?.message || "加载玩法商店失败");
  }
  return rows.map(toStoreItem);
}

/** 功能注释：添加进作品后登记安装（POST /api/components/:id/install），用于累计安装数；失败不影响本地安装 */
export async function reportPlayModInstall(id: string, gameFileId?: string): Promise<void> {
  if (!gameFileId || !readFunloomAuthToken()) return;
  await fetch(`${resolveFunloomApiBase()}/api/components/${encodeURIComponent(id)}/install`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ gameFileId }),
  });
}
