/**
 * 人物线路依赖契约：解锁条件 / 开局数值只认已有配置（属性、人物、地点、事件）。
 * 未选中的依赖开局不生效；纯文案（简介、处境）不走本模块。
 */
import type { CmpOp, FixedCond } from "./types.ts";
import { CMP_OPS, cmpSym } from "./types.ts";
import { normRouteFx, type RouteFx, type RouteFavor, type RouteNum } from "../game/routeFx.ts";

/** 功能注释：线路解锁允许的条件种类（从已有配置选，禁止手打长文） */
export const PATH_LOCK_COND_KINDS = ["stat", "metric", "rel", "location", "event"] as const;
export type PathLockCondKind = (typeof PATH_LOCK_COND_KINDS)[number];

export type PathDepOption = { id: string; label: string };

export type PathDepPools = {
  stats: PathDepOption[];
  metrics: PathDepOption[];
  people: PathDepOption[];
  rooms: PathDepOption[];
  events: PathDepOption[];
};

const OP_LABEL: Record<string, string> = Object.fromEntries(CMP_OPS.map((o) => [o.v, o.t]));

function labelOf(opts: PathDepOption[], id: string): string {
  return opts.find((o) => o.id === id)?.label || id || "（未选）";
}

/** 功能注释：把结构化解锁条件编成建角卡片上的短提示；无条件则空串 */
export function formatPathLockHint(
  conds: FixedCond[] | null | undefined,
  pools: PathDepPools,
): string {
  const list = (Array.isArray(conds) ? conds : []).filter(isPathLockCond);
  if (!list.length) return "";
  return list
    .map((c) => {
      if (c.kind === "stat") return `${labelOf(pools.stats, c.key)} ${OP_LABEL[c.op] ?? cmpSym(c.op)} ${c.value}`;
      if (c.kind === "metric") return `${labelOf(pools.metrics, c.key)} ${OP_LABEL[c.op] ?? cmpSym(c.op)} ${c.value}`;
      if (c.kind === "rel") return `与${labelOf(pools.people, c.key)}好感 ${OP_LABEL[c.op] ?? cmpSym(c.op)} ${c.value}`;
      if (c.kind === "location") return `当前地点为「${labelOf(pools.rooms, c.key)}」`;
      if (c.kind === "event") return `已触发事件「${labelOf(pools.events, c.key)}」`;
      return "";
    })
    .filter(Boolean)
    .join(" · ");
}

export function isPathLockCond(c: FixedCond | null | undefined): c is Extract<FixedCond, { kind: PathLockCondKind }> {
  return !!c && typeof c === "object" && (PATH_LOCK_COND_KINDS as readonly string[]).includes((c as FixedCond).kind);
}

/** 功能注释：清洗解锁条件——只留允许种类，且 key 必须落在当前依赖池（没选中的丢掉） */
export function sanitizePathLockConds(
  raw: unknown,
  pools: PathDepPools,
): FixedCond[] {
  if (!Array.isArray(raw)) return [];
  const out: FixedCond[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const c = row as FixedCond;
    if (!isPathLockCond(c)) continue;
    if (c.kind === "stat") {
      if (!pools.stats.some((o) => o.id === c.key)) continue;
      out.push({ kind: "stat", key: c.key, op: (c.op as CmpOp) || "gte", value: Number(c.value) || 0 });
      continue;
    }
    if (c.kind === "metric") {
      if (!pools.metrics.some((o) => o.id === c.key)) continue;
      out.push({ kind: "metric", key: c.key, op: (c.op as CmpOp) || "gte", value: Number(c.value) || 0 });
      continue;
    }
    if (c.kind === "rel") {
      if (!pools.people.some((o) => o.id === c.key)) continue;
      out.push({ kind: "rel", key: c.key, op: (c.op as CmpOp) || "gte", value: Number(c.value) || 0 });
      continue;
    }
    if (c.kind === "location") {
      if (!pools.rooms.some((o) => o.id === c.key)) continue;
      out.push({ kind: "location", key: c.key });
      continue;
    }
    if (c.kind === "event") {
      if (!pools.events.some((o) => o.id === c.key)) continue;
      out.push({ kind: "event", key: c.key });
    }
  }
  return out;
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

/** 功能注释：默认一条解锁条件（必须指向池内已有项） */
export function defaultPathLockCond(kind: PathLockCondKind, pools: PathDepPools): FixedCond {
  if (kind === "stat") {
    const key = pools.stats[0]?.id ?? "";
    return { kind: "stat", key, op: "gte", value: 100 };
  }
  if (kind === "metric") {
    const key = pools.metrics[0]?.id ?? "";
    return { kind: "metric", key, op: "gte", value: 10 };
  }
  if (kind === "rel") {
    const key = pools.people[0]?.id ?? "";
    return { kind: "rel", key, op: "gte", value: 20 };
  }
  if (kind === "location") {
    return { kind: "location", key: pools.rooms[0]?.id ?? "" };
  }
  return { kind: "event", key: pools.events[0]?.id ?? "" };
}

export function emptyRouteNum(): RouteNum {
  return { name: "", val: 0 };
}
export function emptyRouteFavor(): RouteFavor {
  return { target: "", val: 0 };
}
