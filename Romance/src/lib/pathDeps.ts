/**
 * 人物线路依赖契约：解锁条件（跨周目记录）/ 开局数值只认已有配置。
 * 未选中的依赖开局不生效；纯文案（简介、处境）不走本模块。
 */
import { normRouteFx, type RouteFx, type RouteFavor, type RouteNum } from "../game/routeFx.ts";

/**
 * 功能注释：线路解锁 = 跨周目条件。建角时还没有本局数值，所以只认「本机过往游戏记录」：
 * clear 二周目（通关任意结局一次）/ ending 达成过指定结局 / route 用指定线路通关过 / event 任意一局触发过指定事件（任务）。
 */
export const PATH_LOCK_COND_KINDS = ["clear", "ending", "route", "event"] as const;
export type PathLockCondKind = (typeof PATH_LOCK_COND_KINDS)[number];
export type PathLockCond =
  | { kind: "clear" }
  | { kind: "ending"; key: string }
  | { kind: "route"; key: string }
  | { kind: "event"; key: string };

export type PathDepOption = { id: string; label: string };

export type PathDepPools = {
  events: PathDepOption[];
  endings: PathDepOption[];
  routes: PathDepOption[];
  stats?: PathDepOption[];
  metrics?: PathDepOption[];
  people?: PathDepOption[];
  rooms?: PathDepOption[];
};

export const PATH_LOCK_KIND_LABEL: Record<PathLockCondKind, string> = {
  clear: "二周目：通关过任意结局",
  ending: "达成过指定结局",
  route: "用指定线路通关过",
  event: "完成过指定事件 / 任务",
};

function labelOf(opts: PathDepOption[], id: string): string {
  return opts.find((o) => o.id === id)?.label || id || "（未选）";
}

/** 功能注释：建角卡片上的解锁提示；无条件则空串 */
export function formatPathLockHint(conds: unknown, pools: PathDepPools): string {
  const list = (Array.isArray(conds) ? conds : []).filter(isPathLockCond);
  if (!list.length) return "";
  return list
    .map((c) => {
      if (c.kind === "clear") return "通关任意结局一次（二周目）";
      if (c.kind === "ending") return `达成结局「${labelOf(pools.endings, c.key)}」`;
      if (c.kind === "route") return `用「${labelOf(pools.routes, c.key)}」线路通关`;
      return `在任意一局完成「${labelOf(pools.events, c.key)}」`;
    })
    .join(" · ") + "后解锁";
}

export function isPathLockCond(c: unknown): c is PathLockCond {
  return !!c && typeof c === "object" && (PATH_LOCK_COND_KINDS as readonly string[]).includes((c as { kind?: string }).kind ?? "");
}

/** 功能注释：清洗解锁条件——只留跨周目种类，key 必须落在当前依赖池；旧版属性/地点条件（建角时无法判定）直接丢弃 */
export function sanitizePathLockConds(raw: unknown, pools: PathDepPools): PathLockCond[] {
  if (!Array.isArray(raw)) return [];
  const out: PathLockCond[] = [];
  for (const c of raw) {
    if (!isPathLockCond(c)) continue;
    if (c.kind === "clear") { if (!out.some((x) => x.kind === "clear")) out.push({ kind: "clear" }); continue; }
    const pool = c.kind === "ending" ? pools.endings : c.kind === "route" ? pools.routes : pools.events;
    if (!pool.some((o) => o.id === c.key)) continue;
    out.push({ kind: c.kind, key: c.key });
  }
  return out;
}

/** 功能注释：默认一条解锁条件（必须指向池内已有项） */
export function defaultPathLockCond(kind: PathLockCondKind, pools: PathDepPools): PathLockCond {
  if (kind === "clear") return { kind: "clear" };
  if (kind === "ending") return { kind: "ending", key: pools.endings[0]?.id ?? "" };
  if (kind === "route") return { kind: "route", key: pools.routes[0]?.id ?? "" };
  return { kind: "event", key: pools.events[0]?.id ?? "" };
}

export type RouteFxKnownLookup = {
  /** 属性/词条显示名 → 是否在本世界已有配置（八维、内置指标、自定义属性） */
  hasAttrName: (name: string) => boolean;
  /** 好感目标：人物 id 或名字是否在角色库 */
  hasPerson: (target: string) => boolean;
};

/**
 * 功能注释：开局结算前过滤线路数值——只保留挂到已有属性/人物的行；未选中或手填野名一律丢弃，禁止自动新建属性。
 */
export function filterRouteFxToKnown(
  raw: unknown,
  lookup: RouteFxKnownLookup,
): RouteFx | undefined {
  const fx = normRouteFx(raw);
  if (!fx) return undefined;
  const attr = (fx.attr ?? []).filter((r) => r.name && lookup.hasAttrName(r.name) && r.val);
  const reputation = (fx.reputation ?? []).filter((r) => r.name && lookup.hasAttrName(r.name) && r.val);
  const favor = (fx.favor ?? []).filter((r) => r.target && lookup.hasPerson(r.target) && r.val);
  const out: RouteFx = {
    ...fx,
    attr,
    reputation,
    favor,
  };
  return out.attr!.length || out.favor!.length || out.reputation!.length || out.note || out.text ? out : undefined;
}

/** 功能注释：从属性池选项构造「名称是否已知」查询（label 与 id 都算） */
export function makeAttrNameLookup(opts: PathDepOption[]): (name: string) => boolean {
  const set = new Set(opts.flatMap((o) => [o.label, o.id].filter(Boolean)));
  return (name: string) => set.has(String(name ?? "").trim());
}

/**
 * 功能注释：线路「可变自由决定 / 固定不可改」只能挂本作品已有属性；
 * 手填野名或失效 id 丢掉，命中 id 时统一写成显示名便于卡片展示。
 */
export function sanitizePathAttrNames(raw: unknown, opts: PathDepOption[]): string[] {
  if (!Array.isArray(raw) || !opts.length) return [];
  const byId = new Map(opts.map((o) => [o.id, o.label || o.id]));
  const byLabel = new Map(opts.map((o) => [o.label || o.id, o.label || o.id]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const key = String(row ?? "").trim();
    if (!key) continue;
    const label = byId.get(key) ?? byLabel.get(key);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

export function makePersonLookup(people: PathDepOption[]): (target: string) => boolean {
  const set = new Set(people.flatMap((o) => [o.id, o.label].filter(Boolean)));
  return (target: string) => set.has(String(target ?? "").trim());
}

export function emptyRouteNum(): RouteNum {
  return { name: "", val: 0 };
}
export function emptyRouteFavor(): RouteFavor {
  return { target: "", val: 0 };
}
