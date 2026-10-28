/* ═══════════════ 功能玩法 MOD · 运行时注册表 ═══════════════
 * MOD 只能「追加注册」声明式能力：私有变量 / 配置项 / 数据表 / 命名条件算子 / 触发器动作 / 组件 / 面板 / 皮肤。
 * 注册表从当前生效的模组链派生：启用即注册，关闭 / 卸载即全部注销（无残留）。
 * 原生触发器调度、引用检查、NPC 优先级、渲染流程都不经过这里，MOD 无法 patch 它们。 */
import { useSyncExternalStore } from "react";
import { loadGlobal, saveGlobal } from "../lib/saveScope";
import { getWorld, modById, subscribeMods } from "./registry";
import type { Mod, ModActionDef, ModCfgDef, ModComponentDef, ModCondDef, ModExports, ModExt, ModPanelDef, ModSubDef, ModVarDef } from "./types";

/* —— 日志：每条都带来源标记（原生 / MOD 名） —— */
/* 跨 MOD 通信链路记录：发起方 / 目标 / 操作 / 参数 / 结果 / 权限 / 错误码 */
export type CommTrace = { from: string; to: string; op: "read" | "write" | "call" | "emit" | "deliver"; target: string; args?: string; ok: boolean; code?: string; perm?: string };
export type ModLogEntry = { t: number; src: string; mod?: string; level: "info" | "warn" | "error"; text: string; trace?: CommTrace };
const LOG_MAX = 300;
let logs: ModLogEntry[] = [];
let logVer = 0;
const logL = new Set<() => void>();
export function modLog(src: string | undefined, level: ModLogEntry["level"], text: string) {
  const m = src ? modById(src) : undefined;
  const last = logs[logs.length - 1];
  if (last && last.text === text && last.mod === src) return; // 同一条刚刚记过（注册表重建时）
  logs = [...logs.slice(-(LOG_MAX - 1)), { t: Date.now(), src: m ? m.name : src ? src : "原生", mod: src, level, text }];
  logVer++;
  logL.forEach((l) => l());
}
export function commTrace(tr: CommTrace, text: string) {
  const m = modById(tr.from);
  logs = [...logs.slice(-(LOG_MAX - 1)), { t: Date.now(), src: m ? m.name : tr.from || "原生", mod: tr.from || undefined, level: tr.ok ? "info" : "warn", text, trace: tr }];
  logVer++;
  logL.forEach((l) => l());
}
export const getModLogs = () => logs;
export const clearModLogs = () => { logs = []; logVer++; logL.forEach((l) => l()); };
export function useModLogs() {
  useSyncExternalStore((l) => { logL.add(l); return () => { logL.delete(l); }; }, () => logVer);
  return logs;
}

/* —— 配置域：玩家对每个 MOD 配置项的取值（全局保存，与存档 flag 无关） —— */
const K_CFG = "star:mods:cfg";
const K_RES = "star:mods:conflict";
let cfg: Record<string, Record<string, number>> = loadGlobal(K_CFG, {});
/* 冲突裁决：键 = "动作:<id>" 等；值 = 胜出的 MOD id，或 "off:<mod>" 表示不启用该 MOD */
let resolutions: Record<string, string> = loadGlobal(K_RES, {});
let extVer = 0;
const extL = new Set<() => void>();
const bump = () => { cache = null; extVer++; extL.forEach((l) => l()); };
subscribeMods(bump);
export function useModExt() {
  useSyncExternalStore((l) => { extL.add(l); return () => { extL.delete(l); }; }, () => extVer);
  return getModRegistry();
}

export function cfgValue(mod: string, key: string): number {
  const own = cfg[mod]?.[key];
  if (typeof own === "number") return own;
  return modById(mod)?.ext?.config?.find((c) => c.key === key)?.def ?? 0;
}
export function setCfgValue(mod: string, key: string, v: number) {
  const def = modById(mod)?.ext?.config?.find((c) => c.key === key);
  if (def?.min != null) v = Math.max(def.min, v);
  if (def?.max != null) v = Math.min(def.max, v);
  cfg = { ...cfg, [mod]: { ...(cfg[mod] ?? {}), [key]: v } };
  saveGlobal(K_CFG, cfg);
  modLog(mod, "info", `配置「${def?.label || key}」设为 ${v}`);
  bump();
}
export function resetCfg(mod: string) { const n = { ...cfg }; delete n[mod]; cfg = n; saveGlobal(K_CFG, cfg); bump(); }
export function setResolution(key: string, v: string | undefined) {
  const n = { ...resolutions };
  if (v) n[key] = v; else delete n[key];
  resolutions = n;
  saveGlobal(K_RES, resolutions);
  bump();
}
export const getResolutions = () => resolutions;

/* —— 注册表 —— */
export type RegKind = "动作" | "条件" | "组件" | "面板";
type Reg<T> = { mod: string; def: T };
export type ModConflict = { key: string; kind: RegKind; id: string; mods: string[]; winner?: string };
export type ModRegistry = {
  mods: Mod[]; // 已注册（按加载顺序）
  skipped: { mod: string; reason: string }[];
  vars: Map<string, Map<string, ModVarDef>>; // mod → key → 定义
  config: Map<string, ModCfgDef[]>;
  actions: Map<string, Reg<ModActionDef>>;
  conds: Map<string, Reg<ModCondDef>>;
  components: Map<string, Reg<ModComponentDef>>;
  panels: Map<string, Reg<ModPanelDef>>;
  conflicts: ModConflict[];
  grants: Map<string, Map<string, "read" | "rw">>; // 数据所有者 → 被授权 MOD → 权限（旧版预设授权，等同 exports.presets）
  exports: Map<string, ModExports>; // 已启用 MOD 的导出项；关闭即下线
  subs: { mod: string; def: ModSubDef }[]; // 已启用 MOD 的订阅
};
let cache: ModRegistry | null = null;

export const hasExt = (m: Mod) => !!m.ext && Object.values(m.ext).some((v) => (Array.isArray(v) ? v.length : !!v));
export const modCategory = (m: Mod) => m.category ?? (m.kind === "world" ? "world" : hasExt(m) ? "feature" : "template");

export function buildRegistry(chain: Mod[]): ModRegistry {
  const r: ModRegistry = { mods: [], skipped: [], vars: new Map(), config: new Map(), actions: new Map(), conds: new Map(), components: new Map(), panels: new Map(), conflicts: [], grants: new Map(), exports: new Map(), subs: [] };
  const offs = new Set(Object.values(resolutions).filter((v) => v.startsWith("off:")).map((v) => v.slice(4)));
  const { order, cyclic } = loadOrder(chain.filter((m) => hasExt(m)));
  for (const m of cyclic) r.skipped.push({ mod: m.id, reason: "循环依赖（导入 / 前置互相引用），拒绝加载" });
  const ext = order;
  for (const m of ext) {
    if (offs.has(m.id)) { r.skipped.push({ mod: m.id, reason: "冲突裁决：不启用" }); continue; }
    r.mods.push(m);
    const e = m.ext as ModExt;
    r.vars.set(m.id, new Map((e.vars ?? []).map((v) => [v.key, v])));
    r.config.set(m.id, e.config ?? []);
    if (e.exports) r.exports.set(m.id, e.exports);
    for (const d of e.subs ?? []) if (d?.id && d.mod && d.event && d.action) r.subs.push({ mod: m.id, def: d });
    for (const g of e.grants ?? []) {
      const gm = r.grants.get(m.id) ?? new Map();
      gm.set(g.mod, g.access);
      r.grants.set(m.id, gm);
    }
  }
  // 同 id 注册项：默认后加载者胜出（越靠后优先级越高），玩家可在冲突面板里改判
  const put = <T extends { id: string }>(kind: RegKind, map: Map<string, Reg<T>>, list: (e: ModExt) => T[] | undefined) => {
    const seen = new Map<string, string[]>();
    for (const m of r.mods) for (const d of list(m.ext!) ?? []) {
      if (!d?.id) continue;
      seen.set(d.id, [...(seen.get(d.id) ?? []), m.id]);
    }
    for (const m of r.mods) for (const d of list(m.ext!) ?? []) {
      if (!d?.id) continue;
      const owners = [...new Set(seen.get(d.id) ?? [])];
      const key = `${kind}:${d.id}`;
      if (owners.length > 1) {
        const pick = resolutions[key];
        const winner = pick && owners.includes(pick) ? pick : owners[owners.length - 1];
        if (!r.conflicts.some((c) => c.key === key)) r.conflicts.push({ key, kind, id: d.id, mods: owners, winner: pick && owners.includes(pick) ? pick : undefined });
        if (m.id !== winner) continue;
      }
      map.set(d.id, { mod: m.id, def: d });
    }
  };
  put("动作", r.actions, (e) => e.actions);
  put("条件", r.conds, (e) => e.conds);
  put("组件", r.components, (e) => e.components);
  put("面板", r.panels, (e) => e.panels);
  return r;
}
/* 加载顺序：被依赖 / 被导入方先加载；同层保持原链路顺序。依赖环上的 MOD 全部拒绝加载 */
export function loadOrder(mods: Mod[]): { order: Mod[]; cyclic: Mod[] } {
  const ids = new Set(mods.map((m) => m.id));
  const need = new Map(mods.map((m) => [m.id, [...new Set([...(m.ext?.imports ?? []).map((i) => i.mod), ...(m.deps ?? []).map((d) => d.id), ...(m.dependencies ?? [])])].filter((x) => x !== m.id && ids.has(x))]));
  const st = new Map<string, 1 | 2>(), onCycle = new Set<string>(), out: Mod[] = [];
  const byId = new Map(mods.map((m) => [m.id, m]));
  const visit = (id: string, trail: string[]) => {
    if (st.get(id) === 2) return;
    if (st.get(id) === 1) { for (const x of trail.slice(trail.indexOf(id))) onCycle.add(x); return; }
    st.set(id, 1);
    for (const n of need.get(id) ?? []) visit(n, [...trail, id]);
    st.set(id, 2);
    out.push(byId.get(id)!);
  };
  for (const m of mods) visit(m.id, []);
  // 依赖了环上 MOD 的也无法加载
  let grew = true;
  while (grew) { grew = false; for (const m of mods) if (!onCycle.has(m.id) && (need.get(m.id) ?? []).some((x) => onCycle.has(x))) { onCycle.add(m.id); grew = true; } }
  return { order: out.filter((m) => !onCycle.has(m.id)), cyclic: mods.filter((m) => onCycle.has(m.id)) };
}
export function getModRegistry(): ModRegistry {
  if (cache) return cache;
  cache = buildRegistry(getWorld().chain);
  for (const m of cache.mods) modLog(m.id, "info", `已注册：${regSummary(m)}`);
  for (const s of cache.skipped) modLog(s.mod, "warn", `未注册（${s.reason}）`);
  for (const c of cache.conflicts) modLog(c.winner ?? c.mods[c.mods.length - 1], "warn", `注册冲突：${c.kind}「${c.id}」被 ${c.mods.join(" / ")} 同时注册`);
  return cache;
}
export function regSummary(m: Mod): string {
  const e = m.ext ?? {};
  const n = (a?: unknown[]) => a?.length ?? 0;
  return [n(e.vars) && `变量 ${n(e.vars)}`, n(e.config) && `配置 ${n(e.config)}`, n(e.tables) && `数据表 ${n(e.tables)}`, n(e.actions) && `动作 ${n(e.actions)}`,
    n(e.conds) && `条件算子 ${n(e.conds)}`, n(e.components) && `组件 ${n(e.components)}`, n(e.panels) && `面板 ${n(e.panels)}`, e.skin && "皮肤"].filter(Boolean).join(" · ") || "无注册项";
}

/* 内部访问：只有 MOD 自己（以及工程作者的原生触发器）能直接碰它的内部变量 / 配置 / 条件 / 动作。
 * 别的 MOD 一律拒绝——跨 MOD 只能走 mods/comm.ts 的导出项 + 导入 + 授权通道。 */
export function canAccess(reader: string | undefined, owner: string, _write: boolean): boolean {
  void _write;
  return !reader || reader === owner;
}
export function modVarValue(data: Record<string, Record<string, number>> | undefined, mod: string, key: string): number {
  const v = data?.[mod]?.[key];
  if (typeof v === "number") return v;
  return getModRegistry().vars.get(mod)?.get(key)?.init ?? 0;
}
export function clampModVar(mod: string, key: string, v: number): number {
  const d = getModRegistry().vars.get(mod)?.get(key);
  if (d?.min != null) v = Math.max(d.min, v);
  if (d?.max != null) v = Math.min(d.max, v);
  return v;
}
export const isModActive = (mod: string) => getModRegistry().mods.some((m) => m.id === mod);
