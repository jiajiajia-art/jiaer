/* ═══════════════ 模组注册表 ═══════════════
 * · 内置模组（娱乐圈 / 校园示例）+ 用户模组（JSON 导入，存 localStorage）
 * · 「选择」= 玩家在模组管理里勾选的世界观与叠加包；「生效」= 当前局实际使用的组合。
 *   选择只在开新局时提交为生效（commitSelection）；局中不可切换——读档按存档记录的组合激活（activateWorld）。
 * · 合并顺序：world 在前，addons 按启用顺序在后；后者覆盖前者（同 id 条目替换、键值浅合并）。
 * 引擎通过本文件导出的读取函数取内容，不直接认识任何题材。 */
import { loadGlobal, saveGlobal } from "../lib/saveScope";
import { useSyncExternalStore } from "react";
import { SLOT_KEYS, type ContentSlots, type FeatureFlags, type MapVisuals, type Mod, type ModContent, type PromptFragments, type ResolvedWorld, type SlotKey, type TermKey } from "./types";
import type { LibraryGroup } from "../game/eventLibrary";
import { setSlotReader, setTermReader, termFallback, liveArray, liveRecord, hasSlot } from "./live";
import entMod from "./ent";
import campusMod from "./campus";
import titlesPlusMod from "./titlesPlus";
import { entPacks, ENT_PACK_IDS } from "./entPacks";
import { WORLD_RULE_DIMS, type Gig, type MapLocation } from "../game/data";
import { applyGigPrices } from "../game/gigLibrary";
import type { PersonContent, RoomActivity, RoomContent, RoomItem } from "../worlds/star2005/content";
import { phoneAppVisible, resolvePhoneApps } from "../lib/phoneAppsConfig";
import { normalizeStartMetList } from "../lib/normalizeStartMet";

const K_USER = "star:mods:user";
const K_SEL = "star:mods:selection";
const K_APPLIED = "star:mods:applied";
export const DEFAULT_WORLD = "ent";

export type ModSelection = { world: string; addons: string[] };

const builtins = (): Mod[] => [entMod, campusMod, titlesPlusMod, ...entPacks];

/* —— 持久化 —— */
const read = <T,>(k: string, fb: T): T => {
  return loadGlobal<T>(k, fb); // 模组 = 全局公共数据
};
const write = (k: string, v: unknown) => {
  saveGlobal(k, v);
};

let userMods: Mod[] = []; // 在校验函数定义之后再从本地读取（见下方）
let selection: ModSelection = read<ModSelection>(K_SEL, { world: DEFAULT_WORLD, addons: [...ENT_PACK_IDS] });
// 一次性迁移：娱乐圈拆包前保存的模组选择，补上原版玩法扩展包（之后玩家可自行关闭）
if (!read<boolean>("star:mods:ent-split-v1", false)) {
  if (selection.world === DEFAULT_WORLD) selection = { ...selection, addons: [...ENT_PACK_IDS.filter((id) => !selection.addons.includes(id)), ...selection.addons] };
  write(K_SEL, selection);
  write("star:mods:ent-split-v1", true);
}
// 清掉本地选择里残留的旧「pack-xianyu」记录（咸鱼是手机应用商店的 App，不是模组）
for (const k of [K_SEL, K_APPLIED]) {
  const v = read<ModSelection | null>(k, null);
  if (v?.addons?.includes("pack-xianyu")) write(k, { ...v, addons: v.addons.filter((id) => id !== "pack-xianyu") });
}
selection = { ...selection, addons: selection.addons.filter((id) => id !== "pack-xianyu") };
let applied: ModSelection = read<ModSelection>(K_APPLIED, selection);
let cache: ResolvedWorld | null = null;
let version = 0;
/** 作者预览：内存中的草稿模组，不写入用户模组库 */
let authorPreviewMod: Mod | null = null;
let authorPreviewRestore: ModSelection | null = null;

/* 监听器用函数声明懒建：函数声明会被提升，模块循环引用时（如 ext.ts / audioLib.ts 在本模块
 * 尚未执行完时就 subscribeMods）也不会触发 TDZ「Cannot access before initialization」 */
function modListeners(): Set<() => void> {
  const f = modListeners as unknown as { s?: Set<() => void> };
  return (f.s ??= new Set());
}
function emit() {
  cache = null;
  version++;
  modListeners().forEach((l) => l());
}
export function subscribeMods(l: () => void) { modListeners().add(l); return () => { modListeners().delete(l); }; }

/* —— 校验 —— */
const ID_RE = /^[a-z0-9][a-z0-9_-]{1,40}$/;
const VER_RE = /^\d+\.\d+\.\d+([-+].*)?$/;
export function validateMod(raw: unknown): string[] {
  const errs: string[] = [];
  if (!raw || typeof raw !== "object") return ["模组必须是一个 JSON 对象"];
  const m = raw as Partial<Mod>;
  if (typeof m.id !== "string" || !ID_RE.test(m.id)) errs.push("id 缺失或不合法（2~41 位小写字母 / 数字 / - _，首字符为字母或数字）");
  if (typeof m.name !== "string" || !m.name.trim()) errs.push("name 缺失");
  if (typeof m.version !== "string" || !VER_RE.test(m.version)) errs.push("version 须为语义化版本，如 1.0.0");
  if (m.kind !== "world" && m.kind !== "addon") errs.push('kind 须为 "world" 或 "addon"');
  if (m.dependencies !== undefined && (!Array.isArray(m.dependencies) || m.dependencies.some((d) => typeof d !== "string")))
    errs.push("dependencies 须为字符串数组");
  if (m.slotMerge !== undefined && m.slotMerge !== "replace" && m.slotMerge !== "merge") errs.push('slotMerge 须为 "replace" 或 "merge"');
  const c = (m as { content?: unknown }).content;
  if (c === undefined) return errs;
  if (!c || typeof c !== "object" || Array.isArray(c)) { errs.push("content 须为对象"); return errs; }
  const ct = c as ModContent;
  const arr = (k: keyof ModContent) => { const v = ct[k]; if (v !== undefined && !Array.isArray(v)) errs.push(`content.${k} 须为数组`); };
  const obj = (k: keyof ModContent) => { const v = ct[k]; if (v !== undefined && (typeof v !== "object" || v === null || Array.isArray(v))) errs.push(`content.${k} 须为对象`); };
  (["npcs", "items", "gigs", "events", "fixedEvents", "endings", "worldBook", "worldRules", "gradeDims"] as const).forEach(arr);
  (["rooms", "prompt", "terms", "features", "timeLimit"] as const).forEach(obj);
  const needId = (k: "npcs" | "items" | "gigs" | "events" | "fixedEvents" | "endings" | "worldBook" | "worldRules") =>
    (Array.isArray(ct[k]) ? (ct[k] as { id?: unknown }[]) : []).forEach((e, i) => {
      if (!e || typeof e.id !== "string" || !e.id) errs.push(`content.${k}[${i}] 缺少 id`);
    });
  (["npcs", "items", "gigs", "events", "fixedEvents", "endings", "worldBook", "worldRules"] as const).forEach(needId);
  // 内容槽：类型校验
  const SLOT_ARR = ["trainings", "sideJobs", "zodiacs", "encounters", "sideQuests", "styles", "identities", "backgrounds", "directions", "weekendActs", "titles", "cars", "meals", "lore", "festivals"] as const;
  const SLOT_OBJ = ["stats", "map", "sideQuestCast", "relations", "calendar", "travel", "contracts", "projects", "imageCrisis", "industry", "help", "opening", "cover", "weeklyPaper", "creation", "npcPool", "bills", "pregnancy", "gigPrices", "allowance", "tuning", "play", "avatars"] as const;
  arr("eventGroups");
  (["gameRules", "lookRules"] as const).forEach((k) => {
    arr(k);
    (Array.isArray(ct[k]) ? (ct[k] as { id?: unknown; conds?: unknown; branches?: unknown }[]) : []).forEach((e, i) => {
      if (!e || typeof e.id !== "string" || !e.id) errs.push(`content.${k}[${i}] 缺少 id`);
      else if (k === "gameRules" && !Array.isArray(e.branches)) errs.push(`content.gameRules[${i}].branches 须为数组（每项 { conds, effects }）`);
      else if (k === "lookRules" && !Array.isArray(e.conds)) errs.push(`content.lookRules[${i}].conds 须为数组`);
    });
  });
  SLOT_ARR.forEach((k) => arr(k));
  SLOT_OBJ.forEach((k) => obj(k));
  SLOT_ARR.forEach((k) =>
    (Array.isArray(ct[k]) ? (ct[k] as { id?: unknown }[]) : []).forEach((e, i) => { if (!e || typeof e.id !== "string" || !e.id) errs.push(`content.${k}[${i}] 缺少 id`); }));
  if (ct.startMoney !== undefined && (typeof ct.startMoney !== "number" || !Number.isFinite(ct.startMoney) || ct.startMoney < 0)) errs.push("content.startMoney 须为非负数字");
  if (ct.startDate !== undefined && (typeof ct.startDate !== "string" || !/^\d{4}[-./]\d{2}[-./]\d{2}$/.test(ct.startDate))) errs.push("content.startDate 须形如 2005.01.03");
  if (ct.weather !== undefined && typeof ct.weather !== "string") errs.push("content.weather 须为字符串");
  for (const k of ["startTime", "dayStart", "dayEnd"] as const) if (ct[k] !== undefined && (typeof ct[k] !== "string" || !/^\d{1,2}:[0-5]\d$/.test(ct[k]!))) errs.push(`content.${k} 须形如 08:00`);
  if (ct.school !== undefined && typeof ct.school !== "string") errs.push("content.school 须为字符串");
  const strArr = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");
  if (ct.parentJobs !== undefined && !strArr(ct.parentJobs)) errs.push("content.parentJobs 须为字符串数组");
  if (ct.fameTiers !== undefined) {
    if (!Array.isArray(ct.fameTiers)) errs.push("content.fameTiers 须为数组");
    else ct.fameTiers.forEach((t, i) => { if (typeof t?.min !== "number" || typeof t?.label !== "string") errs.push(`content.fameTiers[${i}] 须含 min（数字）与 label`); });
  }
  if (Array.isArray(ct.titles)) ct.titles.forEach((t, i) => {
    if (!t?.req || typeof t.req !== "object") errs.push(`content.titles[${i}].req 须为对象（如 { "fame": 100 }）`);
    else for (const [k, v] of Object.entries(t.req)) if (typeof v !== "number") errs.push(`content.titles[${i}].req.${k} 须为数字阈值（键可为 fame / reputation / works / awards、stat:<能力>、c:<自定义属性>）`);
    if (!["青铜", "白银", "黄金", "钻石"].includes(t?.tier as string)) errs.push(`content.titles[${i}].tier 须为 青铜 / 白银 / 黄金 / 钻石`);
  });
  if (Array.isArray(ct.cars)) ct.cars.forEach((c, i) => { if (typeof c?.price !== "number" || typeof c?.resale !== "number") errs.push(`content.cars[${i}] 须含 price 与 resale（残值率 0~1）`); });
  if (Array.isArray(ct.weekendActs)) ct.weekendActs.forEach((w, i) => { if (typeof w?.name !== "string" || typeof w?.cost !== "number") errs.push(`content.weekendActs[${i}] 须含 name 与 cost`); });
  if (Array.isArray(ct.meals)) ct.meals.forEach((m, i) => { if (typeof m?.name !== "string" || typeof m?.cost !== "number") errs.push(`content.meals[${i}] 须含 name 与 cost（每周伙食费）`); });
  if (ct.npcPool) for (const k of ["names", "randomNames", "directions", "personalities", "prefs"] as const) if (ct.npcPool[k] !== undefined && !strArr(ct.npcPool[k])) errs.push(`content.npcPool.${k} 须为字符串数组`);
  if (ct.bills) for (const k of ["weekly", "monthly"] as const) {
    const v = ct.bills[k];
    if (v !== undefined && (!Array.isArray(v) || v.some((b) => typeof b?.label !== "string" || typeof b?.amount !== "number"))) errs.push(`content.bills.${k} 须为 { label, amount } 数组`);
  }
  if (ct.bills?.tiers !== undefined) {
    if (!Array.isArray(ct.bills.tiers)) errs.push("content.bills.tiers 须为数组（每项 { minFame, weekly?, monthly? }）");
    else ct.bills.tiers.forEach((t, i) => { if (typeof t?.minFame !== "number") errs.push(`content.bills.tiers[${i}].minFame 须为数字（名气门槛）`); });
  }
  if (ct.gigPrices) for (const [k, v] of Object.entries(ct.gigPrices)) if (!Array.isArray(v) || v.length < 5 || v.some((x) => typeof x !== "number")) errs.push(`content.gigPrices.${k} 须为 5 个数字（星级 1~5）`);
  if (ct.creation) for (const k of ["identityOpts", "backgroundOpts", "klassOpts"] as const) if (ct.creation[k] !== undefined && !strArr(ct.creation[k])) errs.push(`content.creation.${k} 须为字符串数组`);
  if (ct.stats) {
    const KEYS = ["yanji", "geyi", "koucai", "yitai", "donggan", "tineng", "caizhi", "zixin"];
    for (const part of ["labels", "base"] as const) for (const k of Object.keys(ct.stats[part] ?? {})) if (!KEYS.includes(k)) errs.push(`content.stats.${part}.${k} 不是引擎八维键（${KEYS.join(" / ")}）`);
    if (ct.stats.order !== undefined && (!Array.isArray(ct.stats.order) || ct.stats.order.some((k) => !KEYS.includes(k)))) errs.push("content.stats.order 须为八维键数组");
  }
  if (Array.isArray(ct.encounters)) ct.encounters.forEach((e, i) => { if (typeof e?.personId !== "string") errs.push(`content.encounters[${i}] 缺少 personId`); if (typeof e?.seed !== "string") errs.push(`content.encounters[${i}] 缺少 seed`); });
  if (Array.isArray(ct.sideQuests)) ct.sideQuests.forEach((q, i) => { if (!Array.isArray(q?.scene)) errs.push(`content.sideQuests[${i}].scene 须为字符串数组`); });
  if (ct.projects && !Array.isArray(ct.projects.projects)) errs.push("content.projects.projects 须为项目模板数组（其余规则参数可省略，沿用引擎默认）");
  if (ct.help && !Array.isArray(ct.help.docs)) errs.push("content.help.docs 须为数组");
  if (ct.contracts && !Array.isArray(ct.contracts.signing)) errs.push("content.contracts.signing 须为数组");
  if (ct.rooms && typeof ct.rooms === "object") {
    const ids = new Set(Object.keys(ct.rooms));
    for (const [rid, r] of Object.entries(ct.rooms)) {
      if (!r || typeof r !== "object") { errs.push(`rooms.${rid} 须为对象`); continue; }
      if (typeof r.desc !== "string") errs.push(`rooms.${rid}.desc 缺失`);
      for (const [d, to] of Object.entries(r.exits ?? {})) if (to && !ids.has(to as string)) errs.push(`rooms.${rid}.exits.${d} 指向不存在的房间「${to}」`);
    }
    if (ct.startRoom && !ids.has(ct.startRoom)) errs.push(`startRoom「${ct.startRoom}」不在 rooms 中`);
  }
  if (Array.isArray(ct.encounters) && Array.isArray(ct.npcs)) {
    const ids = new Set(ct.npcs.map((n) => n?.id));
    ct.encounters.forEach((e) => { if (e?.personId && !ids.has(e.personId)) errs.push(`邂逅「${e.label ?? e.id}」的 personId「${e.personId}」不在本模组 npcs 中（若依赖其他模组可忽略）`); });
  }
  if (Array.isArray(ct.npcs) && ct.rooms) ct.npcs.forEach((n) => { if (n?.home && !(n.home in ct.rooms!)) errs.push(`NPC「${n.name ?? n.id}」的 home「${n.home}」不在 rooms 中`); });
  return errs;
}

/* 用户模组：仅载入仍能通过校验的条目 */
userMods = read<Mod[]>(K_USER, []).filter((m) => validateMod(m).length === 0);

/* —— 查询 —— */
export const allMods = (): Mod[] => (
  authorPreviewMod ? [...builtins(), ...userMods, authorPreviewMod] : [...builtins(), ...userMods]
);
export const modById = (id: string) => {
  if (authorPreviewMod && authorPreviewMod.id === id) return authorPreviewMod;
  return allMods().find((m) => m.id === id);
};
export const getSelection = () => selection;
export const getApplied = () => applied;
export const isAuthorPreviewModActive = () => !!authorPreviewMod;

/**
 * 功能注释：用编辑器草稿临时覆盖「生效」组合；退出时还原，绝不写 K_APPLIED / 用户模组库。
 */
export function beginAuthorPreviewMod(draft: Mod): { ok: true } | { ok: false; errors: string[] } {
  try {
    const mod: Mod = {
      ...structuredClone(draft),
      content: draft.content ?? {},
      builtin: false,
    };
    if (!mod.id?.trim()) return { ok: false, errors: ["缺少模组 id"] };
    if (mod.kind !== "world" && mod.kind !== "addon") mod.kind = "world";
    authorPreviewRestore = { world: applied.world, addons: [...applied.addons] };
    authorPreviewMod = mod;
    if (mod.kind === "world") {
      applied = {
        world: mod.id,
        addons: (mod.dependencies ?? []).filter((id) => {
          const d = id === mod.id ? null : (builtins().find((b) => b.id === id) || userMods.find((u) => u.id === id));
          return d?.kind === "addon";
        }),
      };
    } else {
      const addons = [...applied.addons.filter((id) => id !== mod.id), mod.id];
      applied = { world: applied.world || DEFAULT_WORLD, addons };
    }
    emit();
    return { ok: true };
  } catch (e) {
    authorPreviewMod = null;
    authorPreviewRestore = null;
    return { ok: false, errors: [`无法启动预览：${(e as Error).message || e}`] };
  }
}

/** 功能注释：结束作者预览，还原进入前的生效模组组合（不触碰玩家在管理面板的「选择」） */
export function endAuthorPreviewMod() {
  authorPreviewMod = null;
  if (authorPreviewRestore) {
    applied = authorPreviewRestore;
    authorPreviewRestore = null;
  }
  emit();
}

/* 依赖检查：返回某模组在给定组合中缺失的依赖 */
export function missingDeps(mod: Mod, sel: ModSelection): string[] {
  const present = new Set([sel.world, ...sel.addons]);
  const out = (mod.dependencies ?? []).filter((d) => !present.has(d) || !modById(d));
  // 带版本要求的依赖（.nmod deps）：须已启用、版本够新，且排在本包之前加载
  const order = [sel.world, ...sel.addons];
  for (const d of mod.deps ?? []) {
    const dm = modById(d.id);
    if (!dm || !present.has(d.id)) { if (!out.includes(d.id)) out.push(d.id); continue; }
    if (d.min && cmpVer(dm.version, d.min) < 0) out.push(`${d.id}（需 ≥ ${d.min}，当前 ${dm.version}）`);
    else if (order.includes(mod.id) && order.indexOf(d.id) > order.indexOf(mod.id)) out.push(`${d.id}（须排在本包之前加载）`);
  }
  return out;
}
/* 语义化版本比较：a<b 返回负数 */
export function cmpVer(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((x) => parseInt(x, 10) || 0), pb = b.split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

/* 组合级问题清单（管理面板展示） */
export function selectionProblems(sel: ModSelection = selection): string[] {
  const p: string[] = [];
  const w = modById(sel.world);
  if (!w) p.push(`世界观「${sel.world}」不存在，将回退到「${DEFAULT_WORLD}」`);
  else if (w.kind !== "world") p.push(`「${w.name}」不是世界观模组`);
  for (const id of sel.addons) {
    const a = modById(id);
    if (!a) { p.push(`叠加包「${id}」不存在，已跳过`); continue; }
    const miss = missingDeps(a, sel);
    if (miss.length) p.push(`叠加包「${a.name}」缺少依赖：${miss.join("、")}，已跳过`);
  }
  return p;
}

/* —— 合并 —— */
type WithId = { id: string };
const mergeById = <T extends WithId>(base: T[], over: T[] | undefined): T[] => {
  if (!over?.length) return base;
  const idx = new Map(base.map((e, i) => [e.id, i]));
  const out = [...base];
  for (const e of over) { const i = idx.get(e.id); if (i === undefined) { idx.set(e.id, out.length); out.push(e); } else out[i] = e; }
  return out;
};

const NO_FALLBACK_TERMS: TermKey[] = ["city", "industry", "celebrity"];
const entTermsBase = () => {
  const t = { ...(entMod.content.terms ?? {}) };
  for (const k of NO_FALLBACK_TERMS) delete t[k];
  return t;
};

function resolve(sel: ModSelection): ResolvedWorld {
  let world = modById(sel.world);
  if (!world || world.kind !== "world") world = entMod;
  const chain: Mod[] = [world];
  for (const id of sel.addons) {
    const a = modById(id);
    if (a && a.kind === "addon" && missingDeps(a, { world: world.id, addons: sel.addons }).length === 0) chain.push(a);
  }
  const wc = world.content;
  const content: ResolvedWorld["content"] = {
    rooms: { ...(wc.rooms ?? {}) },
    startRoom: wc.startRoom,
    locations: [...(wc.locations ?? [])],
    startMet: normalizeStartMetList(wc.startMet),
    familyWx: wc.familyWx,
    familyVoices: wc.familyVoices ? { ...wc.familyVoices } : undefined,
    npcs: [...(wc.npcs ?? [])],
    items: [...(wc.items ?? [])],
    gigs: [...(wc.gigs ?? [])],
    events: [...(wc.events ?? [])],
    fixedEvents: [...(wc.fixedEvents ?? [])],
    endings: [...(wc.endings ?? [])],
    timeLimit: wc.timeLimit ? { ...wc.timeLimit } : undefined,
    gradeDims: wc.gradeDims?.length ? wc.gradeDims.map((d) => ({ ...d, src: { ...d.src } })) : undefined,
    worldBook: [...(wc.worldBook ?? [])],
    income: [...(wc.income ?? [])],
    gameRules: [...(wc.gameRules ?? [])],
    storylines: [...(wc.storylines ?? [])],
    lookRules: [...(wc.lookRules ?? [])],
    worldRules: [...(wc.worldRules ?? WORLD_RULE_DIMS)],
    prompt: { ...(wc.prompt ?? {}) },
    terms: { ...entTermsBase(), ...(wc.terms ?? {}) }, // 旧模组术语仍合并读取；页签名可由底栏编辑器同步
    navTabs: wc.navTabs ? wc.navTabs.map((t) => ({ ...t })) : undefined,
    navSize: wc.navSize,
    phoneAppsCfg: wc.phoneAppsCfg ? [...wc.phoneAppsCfg] : undefined,
    features: { ...(wc.features ?? {}) },
    theme: { ...(wc.theme ?? {}) },
  };
  for (const a of chain.slice(1)) {
    const c = a.content;
    if (c.rooms) Object.assign(content.rooms, c.rooms);
    if (c.startRoom) content.startRoom = c.startRoom;
    {
      // 功能注释：AI/脏数据可能把 startMet 写成对象或字符串，规范化后再合并
      const addonMet = normalizeStartMetList(c.startMet);
      if (addonMet?.length) {
        content.startMet = normalizeStartMetList([...(content.startMet ?? []), ...addonMet]);
      }
    }
    if (c.familyWx != null) content.familyWx = c.familyWx;
    if (c.familyVoices) content.familyVoices = { ...(content.familyVoices ?? {}), ...c.familyVoices };
    content.locations = mergeById(content.locations, c.locations);
    content.npcs = mergeById(content.npcs, c.npcs);
    content.items = mergeById(content.items, c.items);
    content.gigs = mergeById(content.gigs, c.gigs);
    content.events = mergeById(content.events, c.events);
    content.fixedEvents = mergeById(content.fixedEvents, c.fixedEvents);
    content.endings = mergeById(content.endings, c.endings);
    if (c.timeLimit) content.timeLimit = { ...c.timeLimit };
    if (c.gradeDims?.length) content.gradeDims = c.gradeDims.map((d) => ({ ...d, src: { ...d.src } }));
    content.worldBook = mergeById(content.worldBook, c.worldBook);
    content.income = mergeById(content.income, c.income);
    content.gameRules = mergeById(content.gameRules, c.gameRules);
    content.storylines = mergeById(content.storylines, c.storylines);
    content.lookRules = mergeById(content.lookRules, c.lookRules);
    content.worldRules = mergeById(content.worldRules, c.worldRules);
    // 提示片段：worldIntro / terminology 叠加追加，其余覆盖
    const p = c.prompt ?? {};
    content.prompt = {
      ...content.prompt, ...p,
      worldIntro: [content.prompt.worldIntro, p.worldIntro].filter(Boolean).join("\n") || undefined,
      terminology: [content.prompt.terminology, p.terminology].filter(Boolean).join("\n") || undefined,
    };
    Object.assign(content.terms, c.terms ?? {});
    // 底栏：后包覆盖前包的顺序 / 显隐 / 格数
    if (c.navTabs?.length) content.navTabs = c.navTabs.map((t) => ({ ...t }));
    if (c.navSize) content.navSize = c.navSize;
    if (c.phoneAppsCfg?.length) {
      // 按 id 覆盖合并应用配置（后包覆盖前包同 id）
      const map = new Map((content.phoneAppsCfg ?? []).map((a) => [a.id, a]));
      for (const a of c.phoneAppsCfg) map.set(a.id, { ...(map.get(a.id) ?? { id: a.id }), ...a });
      content.phoneAppsCfg = [...map.values()];
    }
    const extra = [...(content.features.phoneAppsExtra ?? []), ...(c.features?.phoneAppsExtra ?? [])];
    Object.assign(content.features, c.features ?? {});
    if (extra.length) content.features.phoneAppsExtra = [...new Set(extra)];
    Object.assign(content.theme, c.theme ?? {});
  }
  // 通告库价目表：沿合并链取最后声明者，按本世界价目重算库内通告
  const prices = [...chain].reverse().find((m) => m.content.gigPrices)?.content.gigPrices;
  content.gigs = applyGigPrices(content.gigs, prices);
  // 地点名录缺失的房间：由 rooms[].name 推导（模组世界无需单独维护 LOCATIONS）
  const have = new Set(content.locations.map((l) => l.id));
  for (const [id, r] of Object.entries(content.rooms)) {
    if (!have.has(id)) content.locations.push({ id, name: r.name ?? id, icon: "", func: r.desc?.slice(0, 18) ?? "", tier: "P1", action: "", hint: "" });
  }
  return { worldId: world.id, addonIds: chain.slice(1).map((m) => m.id), chain, content };
}

/* 当前生效世界（缓存，模组变动时失效） */
export function getWorld(): ResolvedWorld {
  return (cache ??= resolve(applied));
}

/* 两层浅合并：顶层键合并，值也是普通对象时再合并一层（如 stats.labels 只改一个能力的叫法） */
const merge2 = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    out[k] = v && cur && typeof v === "object" && typeof cur === "object" && !Array.isArray(v) && !Array.isArray(cur) ? { ...cur, ...v } : v;
  }
  return out;
};
/* —— 内容槽读取：沿合并链自后向前取第一个声明者（叠加包整槽覆盖世界观） —— */
const slotCache = new WeakMap<ResolvedWorld, Map<string, { has: boolean; value: unknown }>>();
/* 本局开局日期（建角时玩家自选）：覆盖世界观的 startDate 槽，只作用于当前存档 */
let startDateOverride: string | undefined;
export function setStartDateOverride(d?: string) { startDateOverride = d && /^\d{4}[-./]\d{2}[-./]\d{2}$/.test(d) ? d : undefined; }
function readSlot(key: string) {
  const w = getWorld();
  if (key === "startDate" && startDateOverride) return { has: true, value: startDateOverride as unknown, worldId: w.worldId };
  let m = slotCache.get(w);
  if (!m) { m = new Map(); slotCache.set(w, m); }
  let r = m.get(key);
  if (!r) {
    r = { has: false, value: undefined };
    // 自前向后叠：merge 模式的模组对 id 列表按 id 合并，其余整槽替换
    for (const mod of w.chain) {
      const v = (mod.content as Record<string, unknown>)[key];
      if (v === undefined) continue;
      const canMerge: boolean = mod.slotMerge === "merge" && r.has && Array.isArray(r.value) && Array.isArray(v) && v.every((x) => x && typeof (x as WithId).id === "string");
      const isObj = (x: unknown) => !!x && typeof x === "object" && !Array.isArray(x);
      // 对象槽（stats / tuning / bills…）在 merge 模式下浅合并：只改写到的键
      const objMerge: boolean = mod.slotMerge === "merge" && r.has && isObj(r.value) && isObj(v);
      r = { has: true, value: canMerge ? mergeById(r.value as WithId[], v as WithId[]) : objMerge ? merge2(r.value as Record<string, unknown>, v as Record<string, unknown>) : v };
    }
    m.set(key, r);
  }
  return { ...r, worldId: w.worldId };
}
setSlotReader(readSlot);
/* 当前世界是否声明了某内容槽（UI 据此隐藏未提供的功能） */
export const worldHas = (k: SlotKey): boolean => hasSlot(k);
export function getWorldSlot<K extends SlotKey>(k: K): ContentSlots[K] | undefined {
  const r = readSlot(k);
  return r.has ? (r.value as ContentSlots[K]) : undefined;
}
export const getWorldMap = (): MapVisuals => getWorldSlot("map") ?? {};
/* 事件编辑器的事件库分组：模组声明 eventGroups 则用之，否则把本世界 events 归为一组 */
export function getWorldEventGroups(): LibraryGroup[] {
  const g = getWorldSlot("eventGroups");
  if (g && g.length) return g;
  const ev = getWorldEvents();
  return ev.length ? [{ id: `${getWorldId()}_events`, kind: "random", title: `${getWorld().chain[0].name} · 事件`, desc: "本世界观模组自带的事件", events: ev }] : [];
}
export { SLOT_KEYS };

/* —— 变更 —— */
export function selectWorld(id: string) {
  const m = modById(id);
  if (!m || m.kind !== "world") throw new Error(`「${id}」不是可用的世界观模组`);
  selection = { ...selection, world: id };
  write(K_SEL, selection);
  emit();
}
export function toggleAddon(id: string, on: boolean) {
  const m = modById(id);
  if (!m || m.kind !== "addon") throw new Error(`「${id}」不是叠加包`);
  const rest = selection.addons.filter((x) => x !== id);
  if (on) {
    // 依赖链阻断：缺失的前置必须先启用
    const miss = missingDeps(m, { ...selection, addons: [...rest, id] });
    if (miss.length) throw new Error(`「${m.name}」缺少前置依赖：${miss.join("、")}。请先导入并启用（并排在它前面）`);
  }
  selection = { ...selection, addons: on ? [...rest, id] : rest };
  write(K_SEL, selection);
  emit();
}
/* 用另一个叠加包顶替已启用的叠加包（保持原位置）：内置玩法包另存为「我的」副本后直接换上 */
export function replaceAddon(oldId: string, newId: string) {
  if (!selection.addons.includes(oldId) || !modById(newId)) return false;
  const rest = selection.addons.filter((x) => x !== newId);
  selection = { ...selection, addons: rest.map((x) => (x === oldId ? newId : x)) };
  write(K_SEL, selection);
  emit();
  return true;
}
/* 调整叠加包顺序（越靠后优先级越高） */
export function moveAddon(id: string, delta: -1 | 1) {
  const a = [...selection.addons];
  const i = a.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  selection = { ...selection, addons: a };
  write(K_SEL, selection);
  emit();
}
/* 把「选择」提交为「生效」：仅在开新局时调用 */
export function commitSelection() {
  applied = { world: selection.world, addons: [...selection.addons] };
  write(K_APPLIED, applied);
  emit();
}
/* 读档：按存档记录的组合激活（不改玩家在管理面板里的「选择」）；缺失的模组自动回退 */
/* 存档的叠加包：娱乐圈拆包前的存档（无 entSplit 标记）自动补上原版玩法扩展包，保证老存档玩法不变 */
export function saveAddons(s: { worldId?: string; addons?: string[]; entSplit?: boolean }): string[] {
  const a = s.addons ?? [];
  if (s.entSplit || (s.worldId ?? DEFAULT_WORLD) !== DEFAULT_WORLD) return a;
  return [...ENT_PACK_IDS.filter((id) => !a.includes(id)), ...a];
}
export function activateWorld(worldId: string | undefined, addons: string[] | undefined) {
  const w = worldId && modById(worldId)?.kind === "world" ? worldId : DEFAULT_WORLD;
  const next = { world: w, addons: (addons ?? []).filter((id) => modById(id)?.kind === "addon") };
  if (next.world === applied.world && next.addons.join("|") === applied.addons.join("|")) return;
  applied = next;
  write(K_APPLIED, applied);
  emit();
}
export const selectionPending = () =>
  selection.world !== applied.world || selection.addons.join("|") !== applied.addons.join("|");

/* 导入用户模组 JSON：返回错误列表（空=成功） */
export function importModJson(text: string): { ok: boolean; errors: string[]; mod?: Mod } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { return { ok: false, errors: [`JSON 解析失败：${(e as Error).message}`] }; }
  const errors = validateMod(raw);
  if (errors.length) return { ok: false, errors };
  const m = raw as Mod;
  if (builtins().some((b) => b.id === m.id)) return { ok: false, errors: [`id「${m.id}」与内置模组冲突，请改名`] };
  const content = { ...(m.content ?? {}) };
  if ("startMet" in content) {
    const met = normalizeStartMetList(content.startMet);
    if (met?.length) content.startMet = met;
    else delete content.startMet;
  }
  const mod: Mod = { ...m, content, builtin: false };
  userMods = [...userMods.filter((u) => u.id !== mod.id), mod];
  write(K_USER, userMods);
  emit();
  return { ok: true, errors: [], mod };
}
/* 直接保存一个已校验的用户模组（.nmod 导入 / 增量更新用；内置 id 不可覆盖） */
export function upsertUserMod(m: Mod): string[] {
  const errs = validateMod(m);
  if (errs.length) return errs;
  if (builtins().some((b) => b.id === m.id)) return [`id「${m.id}」与内置模组冲突，请改名`];
  // 功能注释：落盘前把 startMet 收成 string[]，避免 AI/旧草稿脏对象再次进库后炸展开
  const content = { ...(m.content ?? {}) };
  if ("startMet" in content) {
    const met = normalizeStartMetList(content.startMet);
    if (met?.length) content.startMet = met;
    else delete content.startMet;
  }
  const mod: Mod = { ...m, content, builtin: false };
  userMods = [...userMods.filter((u) => u.id !== mod.id), mod];
  write(K_USER, userMods);
  emit();
  return [];
}
/* 设定叠加包完整顺序（加载优先级） */
export function setAddonOrder(ids: string[]) {
  selection = { ...selection, addons: ids.filter((x) => selection.addons.includes(x)) };
  write(K_SEL, selection);
  emit();
}
export function removeUserMod(id: string) {
  userMods = userMods.filter((m) => m.id !== id);
  write(K_USER, userMods);
  selection = { world: selection.world === id ? DEFAULT_WORLD : selection.world, addons: selection.addons.filter((x) => x !== id) };
  write(K_SEL, selection);
  emit();
}
/* 导出为 JSON（内置模组的 getter 会被展开成实际数据，可作为新模组的模板） */
export function exportModJson(id: string): string {
  const m = modById(id);
  if (!m) throw new Error(`模组「${id}」不存在`);
  const { builtin: _b, ...rest } = m;
  void _b;
  return JSON.stringify(rest, null, 2);
}
/* 空白模板（「新建模组」下载用） */
export function modTemplate(kind: "world" | "addon"): string {
  const t: Mod = {
    id: kind === "world" ? "my-world" : "my-addon", name: kind === "world" ? "我的世界观" : "我的叠加包", version: "0.1.0", author: "", description: "",
    kind, dependencies: kind === "addon" ? ["ent"] : [],
    content: {
      worldBook: [{ id: "wb1", title: "设定", keywords: [], content: "在这里写世界设定", enabled: true, constant: true }],
      prompt: { worldIntro: "" }, terms: {}, features: {},
      ...(kind === "world"
        ? {
            rooms: { start: { name: "起点", desc: "起点", exits: {} } }, startRoom: "start",
            npcs: [{ id: "npc1", name: "某人", role: "身份", kind: "staff", home: "start", roam: [], bio: "", gender: "女", age: 20, requires: [] }],
            // —— 内容槽（全部可省略：基础数值缺省=引擎默认；玩法内容缺省=该功能关闭） ——
            stats: { labels: { yanji: "演技" }, base: {}, order: [] },
            startMoney: 5000, startDate: "2005.01.03", weather: "晴",
            encounters: [{ id: "enc1", personId: "npc1", label: "邂逅名", seed: "交给 AI 演绎的场景种子", once: true, effects: { rel: 5 } }],
            sideQuests: [{ id: "sq1", code: "支线01", title: "支线标题", condition: "触发条件", scene: ["第一段"], continuationKind: "自由续接", continuation: "续接约束" }],
            opening: { title: "序章", paragraphs: ["{name}的故事从这里开始，兜里有 {money} 元。"], cta: "开始" },
            help: { intro: "", docs: [] },
            map: { background: "", photos: {}, hotspots: {} },
            // 建角池
            styles: [{ id: "s1", name: "风格名", tag: "标签", desc: "说明", stats: {} }],
            backgrounds: [{ id: "b1", name: "普通家庭", tag: "标签", desc: "说明" }],
            school: "", parentJobs: ["教师", "医生"],
            creation: { formIntro: "{city} · {year} {season}。一页定型——锁住满意的（{lock}），其余随时重掷。", identityOpts: ["身份A", "身份B"], backgroundOpts: [], klassOpts: [], cta: "开启故事" },
            // 养成系统
            weekendActs: [{ id: "freeroam", name: "自由活动", effect: "压力 -6", icon: "", cost: 0, energy: 0, stress: -6 }, { id: "recuperate", name: "彻底休整", effect: "压力 -16", icon: "", cost: 0, energy: 34, stress: -16 }],
            fameTiers: [{ min: 0, label: "无名", desc: "" }, { min: 100, label: "小有名气", desc: "" }],
            titles: [{ id: "t_fame", name: "头衔名", tier: "青铜", req: { fame: 50 }, desc: "名气 ≥ 50" }],
            cars: [],
            npcPool: { names: ["路人甲", "路人乙"], directions: [], personalities: [], prefs: [] },
            bills: { weekly: [{ label: "生活费", amount: 500 }], monthly: [{ label: "房租", amount: 2000 }] },
            gigPrices: { fameReq: [0, 45, 120, 230, 410], payBase: [32000, 85000, 175000, 340000, 820000], fameReward: [10, 20, 34, 68, 140], days: [1, 2, 2, 3, 4], energy: [9, 11, 13, 16, 22] },
          }
        : {}),
    },
  };
  return JSON.stringify(t, null, 2);
}

/**
 * 功能注释：术语解析——旧模组 terms 仍可读；玩法类键优先回落到真实配置名，
 * 避免作者只改「叫法」却未改属性 / 通告 / 作品等实际玩法。
 */
function resolveLiveTerm(w: ResolvedWorld, k: TermKey, fallback?: string): string {
  // 功能注释：terms 值可能是非字符串（AI 脏数据），禁止直接 .trim()
  const rawTerm = w.content.terms[k] as unknown;
  const fromTerms = typeof rawTerm === "string" ? rawTerm.trim() : "";
  // 底栏页签 / 提示仍允许 terms 覆盖（编辑器「底栏页签」写入）
  if (k.startsWith("tab") || k.startsWith("hint")) {
    return fromTerms || termFallback(k, fallback);
  }
  // 玩法类：有旧 terms 则兼容；否则从真实配置推导（禁止再调 liveTerm，否则与 termReader 死循环）
  if (fromTerms) return fromTerms;
  const slots = w.chain.map((m) => m.content);
  const pickSlot = <T,>(read: (c: ModContent) => T | undefined): T | undefined => {
    for (let i = slots.length - 1; i >= 0; i--) {
      const v = read(slots[i]);
      if (v !== undefined && v !== null && !(typeof v === "string" && !v.trim())) return v;
    }
    return undefined;
  };
  switch (k) {
    case "money": {
      const attrs = pickSlot((c) => c.customAttrs);
      const hit = attrs?.find((a) => /money|货币|金币|片酬|灵石|零花|现金/i.test(`${a.id}${a.label}`));
      // 功能注释：customAttrs.label 可能被 AI 写成对象，禁止 ?.trim()
      const moneyLabel = typeof hit?.label === "string" ? hit.label.trim() : "";
      if (moneyLabel) return moneyLabel;
      return termFallback(k, fallback);
    }
    case "fame": {
      const tiers = pickSlot((c) => c.fameTiers);
      if (tiers?.length) return "名气";
      const labels = pickSlot((c) => c.stats?.labels);
      const fameRaw = labels && (labels as Record<string, unknown>).fame;
      const fameLabel = typeof fameRaw === "string" ? fameRaw.trim() : "";
      if (fameLabel) return fameLabel;
      return termFallback(k, fallback);
    }
    case "gig": {
      const gigs = w.content.gigs;
      if (gigs.length) return "通告";
      return termFallback(k, fallback ?? "工作");
    }
    case "works": {
      if (hasSlot("projects") || pickSlot((c) => c.projects)) return "作品";
      return termFallback(k, fallback);
    }
    case "advance": {
      const titles = pickSlot((c) => c.titles);
      if (titles?.length) return "晋升";
      return termFallback(k, fallback);
    }
    case "city": {
      const start = w.content.startRoom;
      const room = start ? w.content.rooms[start] : undefined;
      const roomName = typeof room?.name === "string" ? room.name.trim() : "";
      if (roomName) return roomName;
      const locRaw = w.content.locations[0]?.name;
      const loc = typeof locRaw === "string" ? locRaw.trim() : "";
      if (loc) return loc;
      return termFallback(k, fallback);
    }
    case "industry": {
      if (hasSlot("industry") || w.content.features.industryTab !== false) {
        const ind = pickSlot((c) => c.industry);
        if (ind && typeof ind === "object" && "name" in (ind as object) && (ind as { name?: string }).name) {
          return String((ind as { name?: string }).name);
        }
      }
      return termFallback(k, fallback);
    }
    case "celebrity":
    case "fans":
    case "reputation":
      return termFallback(k, fallback);
    default:
      return termFallback(k, fallback);
  }
}

/* —— 引擎读取接口 —— */
export const term = (k: TermKey, fallback?: string): string => resolveLiveTerm(getWorld(), k, fallback);
/**
 * liveTerm 经 termReader 走完整推导；resolveLiveTerm 内部必须用 termFallback，
 * 禁止再调 liveTerm，否则 Maximum call stack size exceeded。
 */
setTermReader((k) => resolveLiveTerm(getWorld(), k as TermKey));
/* 功能开关：未声明=开启（娱乐圈完整玩法为引擎默认） */
/* 依赖内容槽的功能：世界未提供对应内容时自动关闭（界面随之隐藏） */
const FEATURE_NEEDS: Partial<Record<Exclude<keyof FeatureFlags, "phoneApps" | "phoneAppsExtra">, (w: ResolvedWorld) => boolean>> = {
  imageCrisis: () => hasSlot("imageCrisis"),
  cars: () => hasSlot("cars"),
  weeklyPaper: () => hasSlot("industry"),
  industryTab: () => hasSlot("industry"),
  career: (w) => w.content.gigs.length > 0 || hasSlot("projects"),
  // 孕育没有内容槽可判：须由世界观或「孕育包」显式开启（未声明 = 关闭，避免校园 / 自建世界意外出现怀孕）
  pregnancy: (w) => w.content.features.pregnancy === true,
};
export const feature = (k: Exclude<keyof FeatureFlags, "phoneApps" | "phoneAppsExtra">): boolean => {
  const w = getWorld();
  if (w.content.features[k] === false) return false;
  const need = FEATURE_NEEDS[k];
  return need ? need(w) : true;
};
/* 「选择中」的世界（建角页用：尚未提交为生效时也能按所选世界观调整流程） */
export const getSelectedWorld = (): ResolvedWorld => resolve(selection);
/** 读「当前选中（尚未开局）」世界的内容槽：封面在开局前展示，取选中的世界 + 叠加包 */
export function selectedSlot<K extends SlotKey>(k: K): ContentSlots[K] | undefined {
  const chain = getSelectedWorld().chain;
  for (let i = chain.length - 1; i >= 0; i--) {
    const v = (chain[i].content as ContentSlots)[k];
    if (v !== undefined) return v;
  }
  return undefined;
}
export const selectedFeature = (k: Exclude<keyof FeatureFlags, "phoneApps" | "phoneAppsExtra">): boolean => getSelectedWorld().content.features[k] !== false;
export const selectedTerm = (k: TermKey, fallback?: string): string => resolveLiveTerm(getSelectedWorld(), k, fallback);
/** 当前世界手机应用配置（合并后） */
export const worldPhoneAppsCfg = () => getWorld().content.phoneAppsCfg;
/** 模组底栏配置：新局写入存档 navTabs / navSize */
export const worldNavTabs = () => getWorld().content.navTabs;
export const worldNavSize = () => getWorld().content.navSize;
/* 手机应用商店自带的 App：属于手机，不受世界观 / 模组控制，任何世界都可在商店获取 */
const STORE_APPS = new Set(["xianyu", "mail"]); // 不受世界观手机白名单限制的应用（邮箱是线上线下联动的基础设施）
export const phoneAppAllowed = (id: string): boolean => {
  const cfg = getWorld().content.phoneAppsCfg;
  // 新配置优先：hidden/disabled 直接拒绝；其余再叠旧白名单
  if (cfg?.length && !phoneAppVisible(id, cfg)) return false;
  if (STORE_APPS.has(id)) return true;
  if (id === "bosspin" && !feature("career")) return false;
  // 若写了 phoneAppsCfg 且该 id 在目录内，以配置为准（不再要求旧白名单）
  if (cfg?.length && resolvePhoneApps(cfg).some((a) => a.id === id)) return true;
  const { phoneApps: list, phoneAppsExtra } = getWorld().content.features;
  return !list || list.includes(id) || !!phoneAppsExtra?.includes(id);
};
export const getWorldBookSeed = () => getWorld().content.worldBook.map((e) => ({ ...e, keywords: [...(e.keywords ?? [])] }));
export const getWorldRuleDims = () => getWorld().content.worldRules;
/* 存档里的「自建地点」（地图编辑器添加 / 文本解析 / 公共地图）：叠加在世界观房间之上，与原地点双向连通 */
export type RuntimeSpot = { id: string; name: string; desc?: string; link?: string };
let runtime: { spots: RuntimeSpot[]; world?: ResolvedWorld; rooms?: Record<string, RoomContent>; locs?: MapLocation[] } = { spots: [] };
export function setRuntimeSpots(spots: RuntimeSpot[]) { runtime = { spots }; }
function overlay() {
  const w = getWorld();
  if (runtime.world !== w || !runtime.rooms) {
    const rooms: Record<string, RoomContent> = { ...w.content.rooms };
    const locs = [...w.content.locations];
    const ids = new Set(Object.keys(rooms));
    for (const sp of runtime.spots) {
      if (ids.has(sp.id)) continue;
      rooms[sp.id] = { name: sp.name, desc: sp.desc ?? "", exits: {} };
      locs.push({ id: sp.id, name: sp.name, icon: "", func: sp.desc?.slice(0, 18) || "自建地点", tier: "P1", action: "", hint: "" });
    }
    runtime = { ...runtime, world: w, rooms, locs };
  }
  return runtime as Required<typeof runtime>;
}
/** 自建地点的额外连线（无方向） */
export function runtimeLinks(id: string): string[] {
  const out: string[] = [];
  for (const sp of runtime.spots) {
    const link = sp.link && sp.link in overlay().rooms ? sp.link : getWorldStartRoom();
    if (sp.id === id && link !== id) out.push(link);
    else if (link === id) out.push(sp.id);
  }
  return out;
}
export const getWorldRooms = () => overlay().rooms;
export const getWorldNpcs = () => getWorld().content.npcs;
export const getWorldGigs = () => getWorld().content.gigs;
export const getWorldEvents = () => getWorld().content.events;
export const getWorldIncome = () => getWorld().content.income;
export const getWorldGameRules = () => getWorld().content.gameRules;
export const getWorldStorylines = () => getWorld().content.storylines;
export const getWorldLookRules = () => getWorld().content.lookRules;
export const getWorldFixedEvents = () => getWorld().content.fixedEvents;
export const getWorldEndings = () => getWorld().content.endings;
export const getWorldTimeLimit = () => getWorld().content.timeLimit;
export const getWorldGradeDims = () => getWorld().content.gradeDims;
export const getWorldId = () => getWorld().worldId;
export const getWorldLocations = () => overlay().locs;
export const getWorldStartMet = () => normalizeStartMetList(getWorld().content.startMet) ?? [];
/* 开局房间：显式 startRoom → 娱乐圈默认 apartment → 第一个房间 */
export function getWorldStartRoom(): string {
  const c = getWorld().content;
  if (c.startRoom && c.startRoom in c.rooms) return c.startRoom;
  if ("apartment" in c.rooms) return "apartment";
  return Object.keys(c.rooms)[0] ?? "apartment";
}

/* —— 派生索引（按生效世界缓存） —— */
type Derived = { personById: Record<string, PersonContent>; items: RoomItem[]; itemById: Map<string, RoomItem> };
const derivedCache = new WeakMap<ResolvedWorld, Derived>();
function derived(): Derived {
  const w = getWorld();
  let d = derivedCache.get(w);
  if (!d) {
    const items: RoomItem[] = [];
    const seen = new Set<string>();
    for (const r of Object.values(w.content.rooms)) for (const it of r.items ?? []) if (!seen.has(it.id)) { seen.add(it.id); items.push(it); }
    for (const it of w.content.items) if (!seen.has(it.id)) { seen.add(it.id); items.push(it); }
    d = { personById: Object.fromEntries(w.content.npcs.map((p) => [p.id, p])), items, itemById: new Map(items.map((i) => [i.id, i])) };
    derivedCache.set(w, d);
  }
  return d;
}
export const worldPersonById = (id: string): PersonContent | undefined => derived().personById[id];
export const getWorldItems = (): RoomItem[] => derived().items;
export const worldItemById = (id: string): RoomItem | undefined => derived().itemById.get(id);
export const worldRoom = (id: string): RoomContent | undefined => getWorld().content.rooms[id];
export const worldItemsOfRoom = (id: string): RoomItem[] => worldRoom(id)?.items ?? [];
/* 各层子地点的活动互相独立；勾了「沿用父地点」时逐层向上叠加（去重、防环） */
export const worldActivitiesOfRoom = (id: string): RoomActivity[] => {
  const out: RoomActivity[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const r = worldRoom(cur);
    if (!r) break;
    for (const a of r.activities ?? []) if (!out.some((x) => x.id === a.id)) out.push(a);
    cur = r.inheritEvents ? r.parent : undefined;
  }
  return out;
};
export const worldIntroOf = (id: string): string | undefined => worldRoom(id)?.intro;
export const worldLocOf = (id: string): MapLocation | undefined => getWorldLocations().find((l) => l.id === id);

/* —— 活视图：形如常量、实则每次访问都读当前生效世界（供旧代码以最小改动接入）。
 * 只在函数体内访问，切勿在模块顶层求值（避免循环依赖下的 TDZ）。 —— */
export const LIVE_PEOPLE: PersonContent[] = liveArray(() => getWorldNpcs());
export const LIVE_PERSON_BY_ID: Record<string, PersonContent> = liveRecord<Record<string, PersonContent>>(() => derived().personById);
export const LIVE_ROOMS: Record<string, RoomContent> = liveRecord<Record<string, RoomContent>>(() => getWorldRooms());
export const LIVE_ITEMS: RoomItem[] = liveArray(() => getWorldItems());
export const LIVE_GIGS: Gig[] = liveArray(() => getWorldGigs());
export const LIVE_LOCATIONS: MapLocation[] = liveArray(() => getWorldLocations());

/* AI 提示：开篇 GM 段（娱乐圈下与原文逐字一致）+ 世界观 / 文风 / 术语附加段 */
export function getWorldPromptHeader(fallback = ""): string {
  return getWorld().content.prompt.gmIntro ?? fallback;
}
/* 取提示片段（未声明 → fallback） */
export function promptFrag<K extends keyof PromptFragments>(k: K, fallback: NonNullable<PromptFragments[K]>): NonNullable<PromptFragments[K]> {
  return (getWorld().content.prompt[k] ?? fallback) as NonNullable<PromptFragments[K]>;
}
export function getWorldPromptFragment(): string {
  const p = getWorld().content.prompt;
  const parts = [
    p.worldIntro && `【世界观】\n${p.worldIntro}`,
    p.narratorPersona && `【叙事口吻】\n${p.narratorPersona}`,
    p.terminology && `【术语】\n${p.terminology}`,
    p.extraRules && `【补充规则】\n${p.extraRules}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join("\n\n")}\n\n` : "";
}
export const getOpeningDirective = (fallback: string): string => getWorld().content.prompt.openingDirective ?? fallback;

/* React 订阅：模组变化时重渲染 */
export function useMods() {
  useSyncExternalStore(subscribeMods, () => version);
  return { world: getWorld(), selection, applied, mods: allMods(), pending: selectionPending() };
}

/* 当前世界观是否配置了工作委托（通告等）系统 */
export const hasWorldGigs = (): boolean => (getWorld().content.gigs?.length ?? 0) > 0;
