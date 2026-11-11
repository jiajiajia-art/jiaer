import { getWorldSlot } from "../mods/registry";
import type { Gig } from "./data";

/**
 * 功能注释：通告（工作单）玩法的结构配置——分类、阵容角色、星级称号。
 * 引擎（分类判定 / 发布节奏 / 名气是否计入）与局内界面、编辑器共用这一份；
 * 作品未写 gigConfig 时用原版娱乐圈结构，保证老作品行为不变。
 */
export type GigCatDef = {
  id: string;
  label: string;
  /** 按「类型」文字匹配的关键词，用 | 分隔；通告写了 cat 时以 cat 为准 */
  match?: string;
  /** 发布节奏：奇数周 / 偶数周 / 每周 */
  publish?: "odd" | "even" | "always";
  /** 判定成功率时是否把名气算进去（只看实力的类别填 false） */
  fameJudge?: boolean;
};
export type GigRoleDef = { key: string; label: string };
export type GigConfig = { cats?: GigCatDef[]; roles?: GigRoleDef[]; tierNames?: string[] };

export const DEFAULT_GIG_CATS: GigCatDef[] = [
  { id: "film", label: "电影", match: "电影", publish: "even", fameJudge: false },
  { id: "record", label: "唱片", match: "唱片|音乐|单曲|专辑|演唱会", publish: "even", fameJudge: false },
  { id: "tv", label: "电视剧", match: "电视剧|剧", publish: "odd", fameJudge: true },
  { id: "variety", label: "综艺", match: "综艺|采访|直播", publish: "always", fameJudge: true },
  { id: "ad", label: "广告", match: "", publish: "odd", fameJudge: true },
];
export const DEFAULT_GIG_ROLES: GigRoleDef[] = [
  { key: "maleLead", label: "男主" },
  { key: "femaleLead", label: "女主" },
  { key: "maleSupport", label: "男配" },
  { key: "femaleSupport", label: "女配" },
];
export const DEFAULT_GIG_TIER_NAMES = ["起步", "崭露头角", "小有名气", "当红一线", "顶流大咖"];

export function gigConfig(): { cats: GigCatDef[]; roles: GigRoleDef[]; tierNames: string[] } {
  return normalizeGigConfig(getWorldSlot("gigConfig") as GigConfig | undefined);
}

/** 功能注释：纯函数版，编辑器用草稿里的 gigConfig 预览，不依赖当前局 */
export function normalizeGigConfig(c: GigConfig | undefined): { cats: GigCatDef[]; roles: GigRoleDef[]; tierNames: string[] } {
  const cats = Array.isArray(c?.cats) && c.cats.length ? c.cats.filter((x) => x && String(x.id || "").trim()) : DEFAULT_GIG_CATS;
  const roles = Array.isArray(c?.roles) ? c.roles.filter((x) => x && String(x.key || "").trim()) : DEFAULT_GIG_ROLES;
  const tierNames = DEFAULT_GIG_TIER_NAMES.map((d, i) => String(c?.tierNames?.[i] ?? "").trim() || d);
  return { cats: cats.length ? cats : DEFAULT_GIG_CATS, roles, tierNames };
}

/** 功能注释：通告归类——显式 cat 优先；否则按各类关键词依次匹配类型；都不中归入最后一类（兜底类）。 */
export function resolveGigCat(g: Pick<Gig, "type"> & { cat?: string }, cats = gigConfig().cats): GigCatDef {
  if (g.cat) {
    const hit = cats.find((c) => c.id === g.cat);
    if (hit) return hit;
  }
  const t = String(g.type ?? "");
  for (const c of cats) {
    const words = String(c.match ?? "").split("|").map((w) => w.trim()).filter(Boolean);
    if (words.some((w) => t.includes(w))) return c;
  }
  return cats[cats.length - 1];
}

export function catPublishes(cat: GigCatDef | undefined, week: number): boolean {
  const p = cat?.publish ?? "always";
  if (p === "always") return true;
  return p === "odd" ? week % 2 === 1 : week % 2 === 0;
}
