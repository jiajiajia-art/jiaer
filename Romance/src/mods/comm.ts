/* ═══════════════ MOD 间通信层 ═══════════════
 * 规则：默认隔离、显式授权。只有 exports 里声明的字段 / 动作 / 事件对外可见；
 * 使用方须在 imports 里申请（目标 / 版本范围 / 条目 / 权限），并经「包内预设授权」或「本工程手动授权」放行。
 * 授权记录存在当前工程（存档 sim.modAuth），不写进 MOD 包。只在已启用的 MOD 之间生效：关闭即下线。
 * 本模块只做校验、参数规范与链路记录；执行仍走原生触发器引擎（fixedEvents），不绕过其引用校验与队列保护。
 * 通信只传静态基础类型（数字 / 布尔 / 字符串 / ID / 简单数组），不传对象、实体引用或代码。 */
import type { Mod, ModArg, ModEventFilter, ModExportAction, ModExportEvent, ModExportField, ModImportDef, ModImportPerm, ModParamDef } from "./types";
import { commTrace, getModLogs, getModRegistry } from "./ext";
import { allMods, cmpVer, modById } from "./registry";
import { loadData, onLoadPlayerData, saveData } from "../lib/saveScope";
import { useSyncExternalStore } from "react";

/* —— 本工程的手动授权（跟随当前存档 / 工程，不写进 MOD 包）—— */
const K_AUTH = "star.modAuth";
let projAuth: Record<string, "allow" | "deny"> = loadData(K_AUTH, {});
let authVer = 0;
const authL = new Set<() => void>();
const authBump = () => { authVer++; authL.forEach((l) => l()); };
onLoadPlayerData(() => { projAuth = loadData(K_AUTH, {}); authBump(); });
export const getProjectAuth = () => projAuth;
export function setProjectAuth(key: string, v: "allow" | "deny" | undefined) {
  const n = { ...projAuth }; if (v) n[key] = v; else delete n[key];
  projAuth = n; saveData(K_AUTH, n); authBump();
}
export function useProjectAuth() {
  useSyncExternalStore((l) => { authL.add(l); return () => { authL.delete(l); }; }, () => authVer);
  return projAuth;
}

export type ModErrCode = "ERR_MOD_NOT_LOADED" | "ERR_NO_PERMISSION" | "ERR_NOT_EXIST" | "ERR_PARAM_INVALID" | "ERR_DEPTH";
export const ERR_TEXT: Record<ModErrCode, string> = {
  ERR_MOD_NOT_LOADED: "对方 MOD 未启用",
  ERR_NO_PERMISSION: "没有对应权限",
  ERR_NOT_EXIST: "导出项不存在",
  ERR_PARAM_INVALID: "参数格式不对",
  ERR_DEPTH: "调用层数超限（疑似循环调用）",
};
export type CommResult<T> = { ok: true; value: T } | { ok: false; code: ModErrCode; msg: string };
const fail = (code: ModErrCode, msg: string): { ok: false; code: ModErrCode; msg: string } => ({ ok: false, code, msg });
export const COMM_MAX_DEPTH = 8;
export type ExportKind = "field" | "action" | "event" | "audio";
export type Auth = Record<string, "allow" | "deny"> | undefined;
export const PERM_LABEL: Record<ModImportPerm, string> = { read: "仅读取", write: "允许写入", call: "允许调用动作", subscribe: "允许订阅事件" };
export const KIND_LABEL: Record<ExportKind, string> = { field: "数据字段", action: "动作", event: "事件", audio: "音频" };
/* 命名空间：对外展示一律带前缀，不与原生 flag / 其他 MOD 重名 */
export const nsName = (mod: string, name: string) => `mod.${mod}.${name}`;
export const authKey = (from: string, to: string, name: string, perm: ModImportPerm) => `${from}>${to}#${name}@${perm}`;
export const rangeKey = (from: string, to: string) => `${from}>${to}#@version`;

/* —— 版本范围：空格分隔的比较式，如 ">=1.2.0 <2.0.0"、"^1.2.0"、"~1.4.0"、"1.3.0" —— */
const TOK = /^(>=|<=|>|<|=|\^|~)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;
export function validRange(range: string | undefined): boolean {
  return !range?.trim() || range.trim().split(/\s+/).every((t) => TOK.test(t));
}
export function satisfies(version: string, range: string | undefined): boolean {
  if (!range?.trim()) return true;
  for (const t of range.trim().split(/\s+/)) {
    const m = TOK.exec(t);
    if (!m) return false;
    const [, op = "=", a, b = "0", c = "0"] = m;
    const v = `${a}.${b}.${c}`, d = cmpVer(version, v);
    if (op === "^") { if (d < 0 || cmpVer(version, `${Number(a) + 1}.0.0`) >= 0) return false; continue; }
    if (op === "~") { if (d < 0 || cmpVer(version, `${a}.${Number(b) + 1}.0`) >= 0) return false; continue; }
    const ok = op === ">=" ? d >= 0 : op === "<=" ? d <= 0 : op === ">" ? d > 0 : op === "<" ? d < 0 : d === 0;
    if (!ok) return false;
  }
  return true;
}

/* —— 导出项查找（只看已启用 MOD；关闭 / 卸载即不可见） —— */
type ExportItem = ModExportField | ModExportAction | ModExportEvent | { id: string; label?: string };
export function findExport(to: string, kind: "field", name: string): ModExportField | undefined;
export function findExport(to: string, kind: "action", name: string): ModExportAction | undefined;
export function findExport(to: string, kind: "event", name: string): ModExportEvent | undefined;
export function findExport(to: string, kind: "audio", name: string): { id: string; label?: string } | undefined;
export function findExport(to: string, kind: ExportKind, name: string): ExportItem | undefined {
  const e = getModRegistry().exports.get(to);
  if (!e) return undefined;
  if (kind === "field") return e.fields?.find((x) => x.key === name);
  if (kind === "action") return e.actions?.find((x) => x.id === name);
  if (kind === "audio") return e.audio?.find((x) => x.id === name);
  return e.events?.find((x) => x.id === name);
}
const loaded = (id: string) => getModRegistry().mods.some((m) => m.id === id);
export const permOf = (kind: ExportKind, write = false): ModImportPerm => (kind === "field" || kind === "audio" ? (write ? "write" : "read") : kind === "action" ? "call" : "subscribe");

/* 包内预设授权（模式 A）：数据所有者在自己的 exports.presets 里写明；旧版 grants 视同预设 */
export function presetAllows(to: string, from: string, name: string, perm: ModImportPerm): boolean {
  const reg = getModRegistry();
  if ((reg.exports.get(to)?.presets ?? []).some((p) => p.mod === from && (p.items.includes(name) || p.items.includes("*")) && p.perms.includes(perm))) return true;
  const g = reg.grants.get(to)?.get(from);
  return g === "rw" || (g === "read" && (perm === "read" || perm === "subscribe"));
}

/* 核心校验：from（MOD id；undefined = 工程自身的原生触发器）能否以 perm 使用 to 导出的 name */
export function checkAccess(auth0: Auth, from: string | undefined, to: string, kind: ExportKind, name: string, perm: ModImportPerm): CommResult<ExportItem> {
  const auth = { ...projAuth, ...(auth0 ?? {}) }; // 存档内覆盖优先于工程级授权
  if (!to || !loaded(to)) return fail("ERR_MOD_NOT_LOADED", `「${to || "（空）"}」未启用或已卸载`);
  if (from && !loaded(from)) return fail("ERR_MOD_NOT_LOADED", `调用方「${from}」未启用`);
  const item = findExport(to, kind as "field", name) as ExportItem | undefined;
  if (!item) return fail("ERR_NOT_EXIST", `${nsName(to, name)} 未在导出清单中（内部项完全私有）`);
  if (perm === "write" && (item as ModExportField).access !== "rw") return fail("ERR_NO_PERMISSION", `${nsName(to, name)} 是只读字段`);
  if (!from) return { ok: true, value: item }; // 工程作者的原生触发器：可直接使用任何已启用 MOD 的导出项
  const imp = modById(from)?.ext?.imports?.find((i) => i.mod === to);
  if (!imp?.items.some((i) => i.name === name && i.perms.includes(perm))) return fail("ERR_NO_PERMISSION", `「${from}」没有在导入声明里申请 ${nsName(to, name)}（${PERM_LABEL[perm]}）`);
  const rk = auth?.[rangeKey(from, to)];
  if (rk === "deny") return fail("ERR_NO_PERMISSION", `本工程已禁用「${from}」对「${to}」的导入`);
  const tv = modById(to)?.version ?? "0.0.0";
  if (!satisfies(tv, imp.range) && rk !== "allow") return fail("ERR_NO_PERMISSION", `版本不匹配：需要 ${to} ${imp.range}，当前 ${tv}`);
  const a = auth?.[authKey(from, to, name, perm)];
  if (a === "deny") return fail("ERR_NO_PERMISSION", `本工程拒绝了「${from}」${PERM_LABEL[perm]} ${nsName(to, name)}`);
  if (a === "allow" || presetAllows(to, from, name, perm)) return { ok: true, value: item };
  return fail("ERR_NO_PERMISSION", `「${from}」${PERM_LABEL[perm]} ${nsName(to, name)} 尚待本工程授权`);
}

/* —— 参数规范：只允许基础类型，按导出声明校验 —— */
const ID_ARG = /^[\w:.\-\u4e00-\u9fff]{1,80}$/;
const BAD_STR = /<\s*script|javascript\s*:|\son[a-z]+\s*=/i;
const prim = (v: unknown) => typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && v.length <= 500 && !BAD_STR.test(v));
export function validateArgs(params: ModParamDef[] | undefined, args: Record<string, unknown> | undefined): CommResult<Record<string, ModArg>> {
  const out: Record<string, ModArg> = {};
  const ps = params ?? [];
  if (args != null && (typeof args !== "object" || Array.isArray(args))) return fail("ERR_PARAM_INVALID", "参数须为键值表");
  for (const k of Object.keys(args ?? {})) if (!ps.some((p) => p.name === k)) return fail("ERR_PARAM_INVALID", `未声明的参数「${k}」`);
  for (const p of ps) {
    const v = args?.[p.name];
    if (v === undefined || v === "") { if (!p.optional) return fail("ERR_PARAM_INVALID", `缺少参数「${p.name}」`); continue; }
    const ok = p.type === "number" ? typeof v === "number" && Number.isFinite(v)
      : p.type === "boolean" ? typeof v === "boolean"
        : p.type === "string" ? typeof v === "string" && prim(v)
          : p.type === "id" ? typeof v === "string" && ID_ARG.test(v)
            : Array.isArray(v) && v.length <= 50 && v.every(prim);
    if (!ok) return fail("ERR_PARAM_INVALID", `参数「${p.name}」须为${({ number: "数字", boolean: "布尔", string: "字符串", id: "ID 字符串", list: "基础类型数组" })[p.type]}`);
    out[p.name] = v as ModArg;
  }
  return { ok: true, value: out };
}
/* 代入参数：静态数据里与 "$参数名" 完全相同的字符串换成实参（不做任何求值） */
export function bindArgs<T>(v: T, args: Record<string, ModArg>, depth = 0): T {
  if (depth > 30) return v;
  if (typeof v === "string" && v.startsWith("$") && Object.prototype.hasOwnProperty.call(args, v.slice(1))) return args[v.slice(1)] as T;
  if (Array.isArray(v)) return v.map((x) => bindArgs(x, args, depth + 1)) as T;
  if (v && typeof v === "object") { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) o[k] = bindArgs(x, args, depth + 1); return o as T; }
  return v;
}
export function filterPass(filters: ModEventFilter[] | undefined, args: Record<string, ModArg> | undefined): boolean {
  return (filters ?? []).every((f) => {
    const v = args?.[f.param];
    if (f.op === "eq") return v === f.value;
    if (f.op === "ne") return v !== f.value;
    if (typeof v !== "number" || typeof f.value !== "number") return false;
    return f.op === "gt" ? v > f.value : f.op === "gte" ? v >= f.value : f.op === "lt" ? v < f.value : v <= f.value;
  });
}
export const argsText = (a?: Record<string, unknown>) => { const s = a && Object.keys(a).length ? JSON.stringify(a) : ""; return s.length > 160 ? s.slice(0, 157) + "…" : s; };

/* —— 链路记录 —— */
export function trace(op: "read" | "write" | "call" | "emit" | "deliver", from: string | undefined, to: string, target: string, r: CommResult<unknown>, perm?: ModImportPerm, args?: Record<string, unknown>) {
  const who = from ? modById(from)?.name ?? from : "工程触发器";
  const OP = { read: "读取", write: "写入", call: "调用", emit: "广播", deliver: "投递" }[op];
  commTrace({ from: from ?? "", to, op, target, args: argsText(args), ok: r.ok, code: r.ok ? undefined : r.code, perm: perm && PERM_LABEL[perm] },
    `${who} ${OP} ${nsName(to, target)}${args && Object.keys(args).length ? ` ${argsText(args)}` : ""} → ${r.ok ? "成功" : `${r.code}：${r.msg}`}`);
}
/* 可选异步回调：同步结果照常返回，回调排到微任务里，回调出错只记日志 */
export function withCallback<T>(result: T, cb?: (r: T) => void): T {
  if (cb) queueMicrotask(() => { try { cb(result); } catch (e) { commTrace({ from: "", to: "", op: "call", target: "callback", ok: false, code: "ERR_PARAM_INVALID" }, `异步回调出错：${(e as Error).message}`); } });
  return result;
}

/* —— 订阅者：只给已授权订阅的、已启用的 MOD，按（工程调过的）优先级、再按加载顺序串行投递 —— */
export const subKey = (mod: string, subId: string) => `${mod}:${subId}`;
export function subscribersOf(auth: Auth, prio: Record<string, number> | undefined, from: string, event: string) {
  const reg = getModRegistry();
  const idx = new Map(reg.mods.map((m, i) => [m.id, i]));
  return reg.subs
    .filter((s) => s.def.mod === from && s.def.event === event && s.mod !== from)
    .map((s) => ({ ...s, prio: prio?.[subKey(s.mod, s.def.id)] ?? s.def.priority ?? 0, access: checkAccess(auth, s.mod, from, "event", event, "subscribe") }))
    .sort((a, b) => a.prio - b.prio || (idx.get(a.mod) ?? 0) - (idx.get(b.mod) ?? 0));
}

/* —— 授权清单：所有已启用 MOD 的导入申请及其状态 —— */
export type AuthRow = { from: string; to: string; name: string; kind: ExportKind | null; perm: ModImportPerm; key: string; status: "preset" | "allow" | "deny" | "pending" | "missing" | "offline" | "version"; range?: string; label: string };
export function authRows(auth0: Auth): AuthRow[] {
  const auth = { ...projAuth, ...(auth0 ?? {}) };
  const reg = getModRegistry();
  const rows: AuthRow[] = [];
  for (const m of reg.mods) for (const imp of m.ext?.imports ?? []) for (const it of imp.items) for (const perm of it.perms) {
    const kind: ExportKind | null = it.kind === "audio" ? "audio" : perm === "read" || perm === "write" ? "field" : perm === "call" ? "action" : "event";
    const key = authKey(m.id, imp.mod, it.name, perm);
    const ex = loaded(imp.mod) ? findExport(imp.mod, kind as "field", it.name) as ExportItem | undefined : undefined;
    const rk = auth?.[rangeKey(m.id, imp.mod)];
    const verBad = loaded(imp.mod) && !satisfies(modById(imp.mod)?.version ?? "0.0.0", imp.range) && rk !== "allow";
    const status: AuthRow["status"] = !loaded(imp.mod) ? "offline" : !ex ? "missing" : verBad ? "version" : rk === "deny" ? "deny"
      : auth?.[key] === "deny" ? "deny" : auth?.[key] === "allow" ? "allow" : presetAllows(imp.mod, m.id, it.name, perm) ? "preset" : "pending";
    rows.push({ from: m.id, to: imp.mod, name: it.name, kind, perm, key, status, range: imp.range, label: (ex as { label?: string } | undefined)?.label || it.name });
  }
  return rows;
}
export const pendingRows = (auth: Auth) => authRows(auth).filter((r) => r.status === "pending");
/* 版本不匹配的导入（可选强制继续 / 禁用导入） */
export function versionIssues(auth0: Auth): { from: string; to: string; range: string; have: string; key: string; state?: "allow" | "deny" }[] {
  const auth = { ...projAuth, ...(auth0 ?? {}) };
  const out: ReturnType<typeof versionIssues> = [];
  for (const m of getModRegistry().mods) for (const imp of m.ext?.imports ?? []) {
    if (!loaded(imp.mod) || !imp.range) continue;
    const have = modById(imp.mod)?.version ?? "0.0.0";
    if (!satisfies(have, imp.range)) out.push({ from: m.id, to: imp.mod, range: imp.range, have, key: rangeKey(m.id, imp.mod), state: auth?.[rangeKey(m.id, imp.mod)] });
  }
  return out;
}

/* —— 调试：导出总表 / 调用链路（谁在调用谁） —— */
export function exportTable(): { mod: string; kind: ExportKind; name: string; label?: string; detail: string }[] {
  const out: ReturnType<typeof exportTable> = [];
  for (const [mod, e] of getModRegistry().exports) {
    for (const f of e.fields ?? []) out.push({ mod, kind: "field", name: f.key, label: f.label, detail: f.access === "rw" ? "可读写" : "只读" });
    for (const a of e.actions ?? []) out.push({ mod, kind: "action", name: a.id, label: a.label, detail: `(${(a.params ?? []).map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.type}`).join(", ")})` });
    for (const v of e.audio ?? []) out.push({ mod, kind: "audio", name: v.id, label: v.label, detail: "可播放" });
    for (const v of e.events ?? []) out.push({ mod, kind: "event", name: v.id, label: v.label, detail: `{${(v.params ?? []).map((p) => `${p.name}: ${p.type}`).join(", ")}}` });
  }
  return out;
}
export function callChains(): { to: string; target: string; from: string; op: string; n: number; fails: number; lastCode?: string }[] {
  const m = new Map<string, { to: string; target: string; from: string; op: string; n: number; fails: number; lastCode?: string }>();
  for (const l of getModLogs()) {
    const t = l.trace;
    if (!t) continue;
    const k = `${t.to}|${t.target}|${t.from}|${t.op}`;
    const cur = m.get(k) ?? { to: t.to, target: t.target, from: t.from, op: t.op, n: 0, fails: 0 };
    cur.n++;
    if (!t.ok) { cur.fails++; cur.lastCode = t.code; }
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => a.to.localeCompare(b.to) || b.n - a.n);
}

/* —— 包内声明体检（导出 / 导入 / 订阅），供 nmod.modHealth 与导入校验使用 —— */
export function commProblems(m: Mod): { level: "error" | "warn"; text: string }[] {
  const out: { level: "error" | "warn"; text: string }[] = [];
  const e = m.ext ?? {};
  const vars = new Set((e.vars ?? []).map((v) => v.key)), acts = new Set((e.actions ?? []).map((a) => a.id));
  const x = e.exports ?? {};
  const dup = (label: string, ids: string[]) => { const s = new Set<string>(); for (const i of ids) { if (s.has(i)) out.push({ level: "error", text: `导出${label}「${i}」重复` }); s.add(i); } };
  dup("字段", (x.fields ?? []).map((f) => f.key)); dup("动作", (x.actions ?? []).map((a) => a.id)); dup("事件", (x.events ?? []).map((v) => v.id));
  for (const f of x.fields ?? []) if (!vars.has(f.key)) out.push({ level: "error", text: `导出字段「${f.key}」不是本 MOD 声明的私有变量` });
  for (const a of x.actions ?? []) if (!acts.has(a.action)) out.push({ level: "error", text: `导出动作「${a.id}」指向的内部动作「${a.action}」不存在` });
  const checkParams = (where: string, ps?: ModParamDef[]) => { const s = new Set<string>(); for (const p of ps ?? []) { if (!/^[a-zA-Z_]\w{0,30}$/.test(p.name)) out.push({ level: "error", text: `${where}：参数名「${p.name}」不合法` }); if (s.has(p.name)) out.push({ level: "error", text: `${where}：参数「${p.name}」重复` }); s.add(p.name); } };
  for (const a of x.actions ?? []) checkParams(`导出动作「${a.id}」`, a.params);
  for (const v of x.events ?? []) checkParams(`导出事件「${v.id}」`, v.params);
  for (const p of x.presets ?? []) if (p.mod === m.id) out.push({ level: "warn", text: "预设授权不需要授权给自己" });
  const imps = new Map<string, ModImportDef>();
  for (const i of e.imports ?? []) {
    if (i.mod === m.id) { out.push({ level: "error", text: "不能导入自己" }); continue; }
    if (imps.has(i.mod)) out.push({ level: "error", text: `对「${i.mod}」的导入声明重复` });
    imps.set(i.mod, i);
    if (!validRange(i.range)) out.push({ level: "error", text: `对「${i.mod}」的版本范围「${i.range}」格式不对（如 >=1.2.0 <2.0.0）` });
    const target = modById(i.mod);
    if (!target) { out.push({ level: "warn", text: `导入目标「${i.mod}」未安装` }); continue; }
    if (!satisfies(target.version, i.range)) out.push({ level: "warn", text: `导入「${target.name}」要求 ${i.range}，已安装 ${target.version}` });
    const tx = target.ext?.exports ?? {};
    for (const it of i.items) for (const perm of it.perms) {
      const ok = perm === "read" ? tx.fields?.some((f) => f.key === it.name) : perm === "write" ? tx.fields?.some((f) => f.key === it.name && f.access === "rw")
        : perm === "call" ? tx.actions?.some((a) => a.id === it.name) : tx.events?.some((v) => v.id === it.name);
      if (!ok) out.push({ level: "error", text: `导入「${target.name}」的 ${it.name}（${PERM_LABEL[perm]}）：对方没有这样导出` });
    }
  }
  for (const s of e.subs ?? []) {
    if (!acts.has(s.action)) out.push({ level: "error", text: `订阅「${s.id}」的处理动作「${s.action}」不存在` });
    if (!imps.get(s.mod)?.items.some((i) => i.name === s.event && i.perms.includes("subscribe"))) out.push({ level: "error", text: `订阅「${s.id}」：没有在导入里申请订阅 ${nsName(s.mod, s.event)}` });
  }
  // 发出的事件必须是自己导出的
  const walk = (v: unknown) => { if (!v || typeof v !== "object") return; if (Array.isArray(v)) return v.forEach(walk); const o = v as Record<string, unknown>; if (o.kind === "modEmit" && !x.events?.some((ev) => ev.id === o.event)) out.push({ level: "error", text: `广播的事件「${String(o.event)}」未在导出清单里声明` }); if (o.kind === "modCall" && o.mod !== m.id && !imps.get(o.mod as string)?.items.some((i) => i.name === o.id && i.perms.includes("call"))) out.push({ level: "error", text: `调用 ${nsName(String(o.mod), String(o.id))} 没有导入申请` }); Object.values(o).forEach(walk); };
  walk(e.actions);
  return out;
}
export const modName = (id: string) => modById(id)?.name ?? id;
export const knownMods = () => allMods();
