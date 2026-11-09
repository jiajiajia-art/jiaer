import { affinityCapOf } from "../worlds/star2005/content";
/* 全局引用索引与脏数据校验：扫描剧情桥段 / 选项 / 事件链断点 / 结局 / CG / 阵营 / 主线 / 世界书里的条件与效果，
 * 找出引用了不存在对象的条目、只读不写的标记、永远不会触发的设置，以及事件之间的循环依赖。只供编辑器调用。
 * 每条问题带 at（如 event:<id>），编辑器据此把提示挂到对应条目上。 */
import type { CgDef, CustomEnding, EngineRules, Faction, FixedCond, FixedEffect, FixedEvent, GameRule, GameState, Sideline, Storyline, WorldBookEntry } from "../lib/types";
import { asTrimmedString } from "../lib/asTrimmedString";
import { LIVE_ITEMS, LIVE_LOCATIONS, LIVE_PEOPLE, getWorldGameRules, getWorldRooms, getWorldSidelines, getWorldStorylines } from "../mods/registry";
import { resolveRules, rulesOf } from "./engineRules";
import { keywordTexts } from "../lib/worldBookKeywords";
import { modeOf } from "./worldbookPick";
import { hasCgImage } from "./cgImageStore";
import { asCondList } from "./safeConds.ts";

/** 功能注释：审计文案字段；AI 脏对象禁止 ?.trim()（会炸 trim is not a function） */
const txt = (v: unknown) => asTrimmedString(v);

export type RefKind = "npc" | "item" | "location" | "event" | "faction" | "quest" | "side" | "flag";
export type RefHit = { kind: RefKind; id: string; from: string; at?: string }; // from = 来源说明；at = 所属条目
export type AuditIssue = { level: "error" | "warn"; text: string; from?: string; at?: string };
export type AuditReport = { refs: RefHit[]; issues: AuditIssue[]; cycles: string[][] };
export type AuditInput = {
  events?: FixedEvent[]; endings?: CustomEnding[]; cgs?: CgDef[]; factions?: Faction[]; storylines?: Storyline[]; sidelines?: Sideline[]; worldBook?: WorldBookEntry[];
  npcIds?: string[]; roomIds?: string[]; skip?: RefKind[]; flags?: Record<string, number>; rules?: EngineRules;
  /** 物品 id；草稿审计里只认这份（缺省为空集合），不再用 LIVE_ITEMS 放行 */
  itemIds?: string[];
  /** 人物 id→名称，仅用于提示文案；草稿审计缺省用 npcIds（名称退化为 id） */
  people?: { id: string; name: string }[];
  /** 本作品玩法规则（只用于「标记有人写入」判断）；草稿审计缺省为空 */
  gameRules?: GameRule[];
  /**
   * 草稿模式开关：true = 只认传入的 npcIds / roomIds / itemIds / events / storylines / sidelines，
   * 绝不并入 LIVE_PEOPLE / LIVE_LOCATIONS / LIVE_ITEMS / getWorldRooms() / getWorldStorylines()。
   * 缺省：只要传了 npcIds / roomIds / itemIds 任一（哪怕是空数组）就视为草稿；
   * auditGame（存档）显式传 false，继续以当前生效世界为底。
   */
  draft?: boolean;
};

/** 功能注释：是否按「编辑器草稿」审计——传了人物/地点/物品清单（含空数组）即权威，不并入内置世界。 */
export function isDraftAudit(inp: Pick<AuditInput, "draft" | "npcIds" | "roomIds" | "itemIds">): boolean {
  return inp.draft ?? (inp.npcIds !== undefined || inp.roomIds !== undefined || inp.itemIds !== undefined);
}

export const REF_LABEL: Record<RefKind, string> = { npc: "人物", item: "物品", location: "地点", event: "事件", faction: "阵营", quest: "主线", side: "支线", flag: "标记" };

/* 把一组条件里的引用（含嵌套括号子组）展开 */
function condRefs(conds: FixedCond[] | undefined, from: string, at: string, out: RefHit[]) {
  for (const c of asCondList(conds)) {
    switch (c.kind) {
      case "rel": out.push({ kind: "npc", id: c.key, from, at }); break;
      case "relSet": for (const k of c.keys ?? []) out.push({ kind: "npc", id: k, from, at }); break;
      case "item": out.push({ kind: "item", id: c.key, from, at }); break;
      case "location": case "visited": out.push({ kind: "location", id: c.key, from, at }); break;
      case "event": out.push({ kind: "event", id: c.key, from, at }); break;
      case "faction": out.push({ kind: "faction", id: c.key, from, at }); break;
      case "quest": out.push({ kind: "quest", id: c.key, from, at }); break;
      case "side": out.push({ kind: "side", id: c.key, from, at }); break;
      case "flag": case "flagSet": out.push({ kind: "flag", id: c.key, from, at }); break;
      case "group": condRefs(c.conds, from, at, out); break;
      default: break;
    }
  }
}
function effectRefs(efs: FixedEffect[] | undefined, from: string, at: string, out: RefHit[], writes: Set<string>) {
  for (const f of efs ?? []) {
    switch (f.kind) {
      case "rel": out.push({ kind: "npc", id: f.key, from, at }); break;
      case "addItem": case "removeItem": out.push({ kind: "item", id: f.key, from, at }); break;
      case "unlockLocation": out.push({ kind: "location", id: f.key, from, at }); break;
      case "faction": out.push({ kind: "faction", id: f.key, from, at }); break;
      case "flag": writes.add(f.key); break;
      default: break;
    }
  }
}
/* 事件条件里「已触发事件」的直接依赖（含嵌套） */
function eventDeps(conds: FixedCond[] | undefined, out: Set<string>) {
  for (const c of asCondList(conds)) { if (c.kind === "event" && c.key) out.add(c.key); else if (c.kind === "group") eventDeps(c.conds, out); }
}
/* ——— 条件自身能不能成立：取值越界、同组互相矛盾、空括号、日期格式 ——— */
const OP_TXT: Record<string, string> = { gte: "≥", gt: ">", lte: "≤", lt: "<", eq: "=" };
const DATE_RE = /^\d{4}\.\d{1,2}\.\d{1,2}$/;
const relCap = affinityCapOf;
type Push = (level: AuditIssue["level"], text: string) => void;
function condSanity(conds: FixedCond[] | undefined, match: "all" | "any" | undefined, push: Push, nameOf: (kind: string, key: string) => string) {
  const list = asCondList(conds);
  // 同一「且」组里对同一个量的上下界
  const bounds = new Map<string, { lo: number; loStrict: boolean; hi: number; hiStrict: boolean; label: string }>();
  const exists = new Map<string, boolean>();
  let dateLo = "", dateHi = "";
  for (const c of list) {
    if (c.kind === "group") {
      // 功能注释：脏稿/AI 结局常缺 conds，禁止 .length 直接读 undefined 崩掉④剧情页
      const nested = asCondList(c.conds);
      if (!nested.length) push("warn", "有一个空的括号条件组，可以删掉");
      else condSanity(nested, c.not ? (c.match === "all" ? "any" : "all") : c.match, push, nameOf);
      continue;
    }
    if (c.kind === "date") {
      if (!DATE_RE.test(c.date ?? "")) { push("error", `日期「${c.date || "（空）"}」格式不对，应写成 2005.03.01`); continue; }
      const d = c.date.split(".").map((x) => x.padStart(2, "0")).join(".");
      if (c.op === "gte" && d > dateLo) dateLo = d;
      if (c.op === "lte" && (!dateHi || d < dateHi)) dateHi = d;
      continue;
    }
    if (c.kind === "clock" && (!/^\d{1,2}:\d{2}$/.test(c.from) || !/^\d{1,2}:\d{2}$/.test(c.to))) { push("error", "时段要写成 HH:MM，如 22:00"); continue; }
    if (c.kind === "relSet") {
      if (!c.keys?.length) push("error", "「好感集合」条件还没选人");
      else if (c.need != null && c.need > c.keys.length) push("error", `「好感集合」要求至少 ${c.need} 人满足，但只选了 ${c.keys.length} 人，永远不会成立`);
      continue;
    }
    if (c.kind === "flagSet") {
      const prev = exists.get(c.key);
      if (prev != null && prev !== c.exists && match !== "any") push("error", `同时要求标记「${c.key}」存在又不存在，永远不会成立`);
      exists.set(c.key, c.exists);
      continue;
    }
    if (!("op" in c) || typeof (c as { value?: unknown }).value !== "number") continue;
    const v = (c as { value: number }).value;
    const op = (c as { op: string }).op;
    const key = c.kind === "time" ? c.unit : (c as { key: string }).key;
    const label = c.kind === "time" ? `开局后${({ day: "天数", week: "周数", month: "月数", year: "年数" } as const)[c.unit]}` : nameOf(c.kind, key);
    // 取值越界：这些量有硬上下限
    if (c.kind === "rel") {
      const cap = relCap(key);
      if ((op === "gte" || op === "eq") && v > cap || op === "gt" && v >= cap) push("error", `${label} ${OP_TXT[op]} ${v}：好感最高只有 ${cap}，永远不会成立`);
      if ((op === "lte" || op === "eq") && v < -100 || op === "lt" && v <= -100) push("error", `${label} ${OP_TXT[op]} ${v}：好感最低只有 -100，永远不会成立`);
    }
    if (c.kind === "faction" && ((op === "gte" || op === "eq") && v > 100 || op === "gt" && v >= 100 || (op === "lte" || op === "eq") && v < -100 || op === "lt" && v <= -100)) push("error", `${label} ${OP_TXT[op]} ${v}：阵营声望只在 -100~100 之间，永远不会成立`);
    if (c.kind === "time" && v < 0) push("error", `${label}不能是负数`);
    if (match === "any") continue;
    const id = `${c.kind}:${key}`;
    const b = bounds.get(id) ?? { lo: -Infinity, loStrict: false, hi: Infinity, hiStrict: false, label };
    if (op === "gte" || op === "gt" || op === "eq") if (v > b.lo || (v === b.lo && op === "gt")) { b.lo = v; b.loStrict = op === "gt"; }
    if (op === "lte" || op === "lt" || op === "eq") if (v < b.hi || (v === b.hi && op === "lt")) { b.hi = v; b.hiStrict = op === "lt"; }
    bounds.set(id, b);
  }
  for (const b of bounds.values()) {
    if (b.lo > b.hi || (b.lo === b.hi && (b.loStrict || b.hiStrict))) push("error", `条件互相矛盾：${b.label}要${b.loStrict ? ">" : "≥"} ${b.lo} 又要${b.hiStrict ? "<" : "≤"} ${b.hi}，永远不会同时成立`);
  }
  if (dateLo && dateHi && dateLo > dateHi && match !== "any") push("error", `条件互相矛盾：日期要在 ${dateLo} 之后又要在 ${dateHi} 之前`);
}
/* 效果里的空操作 */
function effectSanity(efs: FixedEffect[] | undefined, push: Push) {
  for (const f of efs ?? []) {
    if ((f.kind === "stat" || f.kind === "metric" || f.kind === "rel" || f.kind === "faction" || (f.kind === "flag" && !f.set)) && !f.delta) push("warn", "有一项效果的数值是 0，不会产生任何变化");
    if ((f.kind === "memory" || f.kind === "flag") && !f.key?.trim()) push("error", `${f.kind === "flag" ? "标记" : "记忆"}效果没填名称`);
  }
}

const ACTIVATE = /·(后续|激活)$/; // 这些来源会把目标事件「激活」（解除 locked）

/** 当前存档的全量校验 */
export function auditGame(g: GameState, over: Partial<AuditInput> = {}): AuditReport {
  // 存档审计以当前生效世界为底：显式 draft:false，npcIds 只是补充存档里的人物
  return auditStory({ draft: false, events: g.fixedEvents, endings: g.customEndings, cgs: g.cgs, factions: g.factions, worldBook: g.worldBook, npcIds: g.npcs.map((n) => n.id), flags: g.sim?.flags, rules: rulesOf(g), ...over });
}

/** 按传入的内容校验（存档或模组编辑器里正在编辑的作品都可以用） */
export function auditStory(inp: AuditInput): AuditReport {
  const refs: RefHit[] = [];
  const issues: AuditIssue[] = [];
  const writes = new Set<string>();
  const events = inp.events ?? [];
  const draft = isDraftAudit(inp);
  // 功能注释：草稿模式缺主线/支线就是「没有」，不借当前世界的
  const storylines = inp.storylines ?? (draft ? [] : getWorldStorylines() ?? []);
  const sidelines = inp.sidelines ?? (draft ? [] : getWorldSidelines() ?? []);
  const rules = inp.rules ?? resolveRules(undefined);
  const evName = (id: string) => events.find((e) => e.id === id)?.name || id;
  const people = new Map<string, string>(draft
    ? [...(inp.npcIds ?? []).map((id): [string, string] => [id, id]), ...(inp.people ?? []).map((p): [string, string] => [p.id, p.name])]
    : LIVE_PEOPLE.map((p) => [p.id, p.name]));
  const nameOf = (kind: string, key: string) => kind === "rel" ? `与${people.get(key) ?? key}的好感` : kind === "faction" ? `阵营「${(inp.factions ?? []).find((f) => f.id === key)?.name ?? key}」声望` : kind === "flag" ? `标记「${key}」` : `「${key}」`;

  const ids = new Set<string>();
  for (const e of events) {
    const at = `event:${e.id}`;
    const from = `剧情桥段·${e.name || e.id}`;
    if (ids.has(e.id)) issues.push({ level: "error", text: `事件 ID「${e.id}」重复，后一个会被前一个遮住`, from, at });
    ids.add(e.id);
    condRefs(e.conds, from, at, refs);
    for (const gr of e.condGroups ?? []) condRefs(gr.conds, from, at, refs);
    for (const b of e.chainBreaks ?? []) condRefs(b.group?.conds, `${from}·断点`, at, refs);
    effectRefs(e.effects, from, at, refs, writes);
    for (const id of e.nextIds ?? []) refs.push({ kind: "event", id, from: `${from}·后续`, at });
    const t = e.trigger;
    if (t?.kind === "enter") refs.push({ kind: "location", id: t.room, from: `${from}·触发`, at });
    if (t?.kind === "rel") refs.push({ kind: "npc", id: t.npc, from: `${from}·触发`, at });
    if (t?.kind === "item") refs.push({ kind: "item", id: t.item, from: `${from}·触发`, at });
    if (t?.kind === "choice") refs.push({ kind: "event", id: t.event, from: `${from}·触发`, at });
    for (const c of e.choices ?? []) {
      const cf = `${from}·选项「${c.label || c.id}」`;
      if (!txt(c.label)) issues.push({ level: "warn", text: "有一个选项没有写文字，玩家看到的是空按钮", from: cf, at });
      condRefs(c.conds, cf, at, refs);
      for (const gr of c.condGroups ?? []) condRefs(gr.conds, cf, at, refs);
      condRefs(c.check?.conds, `${cf}·判定`, at, refs);
      effectRefs(c.effects, cf, at, refs, writes);
      effectRefs(c.failEffects, `${cf}·失败`, at, refs, writes);
      for (const id of [...(c.nextIds ?? []), ...(c.failNextIds ?? [])]) refs.push({ kind: "event", id, from: `${cf}·后续`, at });
    }
    // 条件 / 效果 / 时间 / 触发方式自身是否成立
    const sane = (where: string): Push => (level, text) => issues.push({ level, text: where ? `${where}：${text}` : text, from, at });
    condSanity(e.conds, e.condMatch, sane(""), nameOf);
    // 功能注释：AI/脏稿条件组常缺 conds；禁止 .length 直读 undefined（④剧情·固定事件一挂载就崩回①）
    for (const gr of e.condGroups ?? []) {
      const gConds = asCondList(gr.conds);
      if (!gConds.length) sane("")("warn", "有一个空的条件组");
      condSanity(gConds, gr.match, sane("条件组"), nameOf);
    }
    effectSanity(e.effects, sane(""));
    const tm = e.time;
    if (tm?.kind === "day" && tm.day < 0) sane("触发时间")("error", "天数不能是负数");
    if (tm?.kind === "date" && !DATE_RE.test(tm.date ?? "")) sane("触发时间")("error", `日期「${tm.date || "（空）"}」格式不对，应写成 2005.03.01`);
    if (tm?.kind === "every" && !(tm.days >= 1)) sane("触发时间")("error", "「每隔几天」至少要填 1");
    if (tm?.kind === "weekly" && !(tm.dow >= 0 && tm.dow <= 6)) sane("触发时间")("error", "「每周几」没选");
    if (t?.kind === "action" && !txt(t.text)) sane("触发方式")("error", "「行动完成」没填要匹配的文字，永远不会触发");
    if (t?.kind === "rel" && !t.delta) sane("触发方式")("error", "「好感变化」的阈值是 0，填正数表示上升、负数表示下降");
    if (t?.kind === "round" && !(t.every! > 0) && !(t.at! > 0)) sane("触发方式")("error", "「轮次」没填第几轮或每几轮");
    if (t?.kind === "choice" && t.event && !events.find((x) => x.id === t.event)?.choices?.some((c) => c.id === t.choice)) {
      if (events.some((x) => x.id === t.event)) sane("触发方式")("error", "选中的那个选项已经不存在于目标事件里，永远不会触发");
    }
    if (Array.isArray(e.keywords) && e.keywords.length && keywordTexts(e.keywords).length === 0) sane("")("warn", "关键词全是空的");
    if (e.once && e.cooldown) sane("")("warn", "已设为只触发一次，冷却天数不会起作用");
    const ch = e.choices ?? [];
    if (ch.length > 3) sane("")("warn", `有 ${ch.length} 个选项，最多只会显示 3 个`);
    if (ch.length && ch.every((c) => c.hidden)) sane("")("warn", "选项全是隐藏分支，玩家没有可点的选项");
    const labels = ch.map((c) => txt(c.label)).filter(Boolean);
    if (new Set(labels).size < labels.length) sane("")("warn", "有两个选项文字完全相同，玩家分不清");
    for (const c of ch) {
      const cs = sane(`选项「${txt(c.label) || c.id}」`);
      condSanity(c.conds, c.condMatch, cs, nameOf);
      for (const gr of c.condGroups ?? []) condSanity(gr.conds, gr.match, cs, nameOf);
      if (c.check) {
        const checkConds = asCondList(c.check.conds);
        if (!checkConds.length) cs("warn", "开启了成功判定但没有条件，永远算成功");
        condSanity(checkConds, c.check.match, cs, nameOf);
      }
      effectSanity(c.effects, cs);
      effectSanity(c.failEffects, cs);
    }
    if (!txt(e.name)) issues.push({ level: "warn", text: "事件没有名称，列表与日志里难以辨认", from, at });
    if (!txt(e.prompt)) issues.push({ level: "warn", text: "没有写事件提示词，上演时 AI 无从演绎", from, at });
  }

  // 结局：按列表顺序判定，第一个满足的生效
  // 功能注释：AI/脏稿常缺 title/body/conds；一律按空数组兜底，禁止④剧情挂载时 .length 崩页跳回①基础
  const endings = inp.endings ?? [];
  endings.forEach((en, i) => {
    const at = `ending:${en.id}`;
    const from = `结局·${en.title || en.id}`;
    const conds = asCondList(en.conds);
    condRefs(conds, from, at, refs);
    for (const gr of en.condGroups ?? []) condRefs(gr.conds, from, at, refs);
    if (en.sceneId) refs.push({ kind: "event", id: en.sceneId, from: `${from}·收尾场景`, at });
    if (!txt(en.title)) issues.push({ level: "warn", text: "结局没有标题", from, at });
    const es: Push = (level, text) => issues.push({ level, text, from, at });
    condSanity(conds, en.match, es, nameOf);
    for (const gr of en.condGroups ?? []) condSanity(gr.conds, gr.match, es, nameOf);
    if (en.enabled !== false && en.auto && !conds.length && !(en.condGroups ?? []).length && !en.minDay) es("error", "设为「满足即结算」却没有任何条件：开局第一回合就会直接结束游戏");
    const free = en.enabled !== false && !conds.length && !(en.condGroups ?? []).length && !en.minDay;
    const later = endings.slice(i + 1).filter((x) => x.enabled !== false).length;
    if (free && later) issues.push({ level: "warn", text: `这是无条件（保底）结局，却排在第 ${i + 1} 位：后面 ${later} 个结局永远轮不到判定。保底结局请拖到最后`, from, at });
  });

  for (const cg of inp.cgs ?? []) {
    const at = `cg:${cg.id}`;
    const from = `CG·${cg.title || cg.id}`;
    condRefs(cg.conds, from, at, refs);
    if (cg.npcId) refs.push({ kind: "npc", id: cg.npcId, from: `${from}·关联人物`, at });
    condSanity(cg.conds, "all", (level, text) => issues.push({ level, text, from, at }), nameOf);
    if (cg.enabled !== false && !asCondList(cg.conds).length) issues.push({ level: "error", text: "未设解锁条件，玩家看不到", from, at });
    if (!hasCgImage(cg)) issues.push({ level: "error", text: "还没有上传图片，不能发布", from, at });
  }
  for (const f of inp.factions ?? []) {
    const at = `faction:${f.id}`;
    for (const m of f.members ?? []) refs.push({ kind: "npc", id: m.npc, from: `阵营·${f.name || f.id}`, at });
    for (const r of f.rooms ?? []) refs.push({ kind: "location", id: r, from: `阵营·${f.name || f.id}`, at });
    const from = `阵营·${f.name || f.id}`;
    if (!f.name?.trim()) issues.push({ level: "error", text: "阵营没有名称，条件和剧情里无法辨认", from, at });
    else if ((inp.factions ?? []).filter((x) => x.name?.trim() === f.name.trim()).length > 1) issues.push({ level: "warn", text: `与其他阵营同名「${f.name.trim()}」`, from, at });
    const ms = (f.members ?? []).map((m) => m.npc);
    if (new Set(ms).size < ms.length) issues.push({ level: "warn", text: "同一个人被重复加入了本阵营", from, at });
  }

  // 主线：节点条件 / 奖励 / 完成后激活的事件
  for (const l of storylines) {
    const at = `quest:${l.id}`;
    const nodes = Array.isArray(l.nodes) ? l.nodes : [];
    if (!nodes.length) issues.push({ level: "warn", text: "主线还没有节点", from: `主线·${l.name || l.id}`, at });
    for (const n of nodes) {
      const from = `主线·${l.name || l.id}·${n.name || n.id}`;
      condRefs(n.conds, from, at, refs);
      condRefs(n.failConds, `${from}·失败`, at, refs);
      effectRefs(n.rewards, from, at, refs, writes);
      for (const id of n.unlockIds ?? []) refs.push({ kind: "event", id, from: `${from}·激活`, at });
      for (const id of n.failUnlockIds ?? []) refs.push({ kind: "event", id, from: `${from}·激活`, at });
      const ns: Push = (level, text) => issues.push({ level, text: `节点「${n.name || n.id}」：${text}`, from, at });
      condSanity(n.conds, n.match, ns, nameOf);
      condSanity(n.failConds, "any", ns, nameOf);
      effectSanity(n.rewards, ns);
      if (!(n.conds ?? []).length && !n.optional) issues.push({ level: "warn", text: `节点「${n.name || n.id}」没有完成条件，一开始判定就会直接完成`, from, at });
    }
  }

  // 支线：触发 / 完成 / 失败共享同一套条件，完成与失败奖励共享主线效果。
  const sideIds = new Set<string>();
  for (const s of sidelines) {
    const at = `side:${s.id}`;
    const from = `支线·${s.name || s.id}`;
    if (!s.id) issues.push({ level: "error", text: "支线缺少 ID，无法记录存档进度", from, at });
    else if (sideIds.has(s.id)) issues.push({ level: "error", text: `支线 ID「${s.id}」重复，存档进度会互相覆盖`, from, at });
    sideIds.add(s.id);
    if (!txt(s.name)) issues.push({ level: "error", text: "支线没有名称", from, at });
    condRefs(s.trigger, `${from}·触发`, at, refs);
    condRefs(s.conds, `${from}·完成`, at, refs);
    condRefs(s.failConds, `${from}·失败`, at, refs);
    effectRefs(s.rewards, `${from}·完成奖励`, at, refs, writes);
    effectRefs(s.failRewards, `${from}·失败奖励`, at, refs, writes);
    for (const id of s.unlockIds ?? []) refs.push({ kind: "event", id, from: `${from}·激活`, at });
    for (const id of s.failUnlockIds ?? []) refs.push({ kind: "event", id, from: `${from}·失败激活`, at });
    const ss: Push = (level, text) => issues.push({ level, text, from, at });
    condSanity(s.trigger, "all", ss, nameOf);
    condSanity(s.conds, s.match, ss, nameOf);
    condSanity(s.failConds, "any", ss, nameOf);
    effectSanity(s.rewards, ss);
    effectSanity(s.failRewards, ss);
    if (s.enabled !== false && !(s.conds ?? []).length) ss("warn", "未设完成条件，触发后会一直挂起");
    if (s.limitDays !== undefined && !(s.limitDays >= 1)) ss("error", "失败时限至少为 1 天");
  }

  for (const k of rules.affinity.noDecay) refs.push({ kind: "npc", id: k, from: "底层规则·不衰减角色", at: "rules" });
  for (const k of Object.keys(rules.npc.cdOverride)) refs.push({ kind: "npc", id: k, from: "底层规则·角色冷却", at: "rules" });

  // 世界书：会不会被注入、绑定对象在不在
  // 功能注释：草稿模式人物/地点只认表单传入的 id（可为空）；存档模式才并入当前世界
  const npcIds = new Set(draft ? (inp.npcIds ?? []) : [...(inp.npcIds ?? []), ...LIVE_PEOPLE.map((p) => p.id)]);
  const rooms = new Set(draft ? (inp.roomIds ?? []) : (inp.roomIds ?? Object.keys(getWorldRooms())));
  const titles = new Map<string, number>();
  for (const w of inp.worldBook ?? []) {
    const at = `wb:${w.id}`;
    const from = `世界书·${w.title || w.id}`;
    const t = txt(w.title);
    if (t) titles.set(t, (titles.get(t) ?? 0) + 1);
    if (!w.enabled) continue;
    if (!txt(w.content)) issues.push({ level: "warn", text: "正文为空，注入了也没有内容", from, at });
    if (modeOf(w) === "keyword" && keywordTexts(w.keywords).length === 0 && !(w.bindRooms?.length || w.bindNpcs?.length || (w.scope && w.scope !== "global" && w.scopeId))) {
      issues.push({ level: "warn", text: "没有关键词也没有挂地点/人物，依赖触发时可能从未注入", from, at });
    }
    if (w.probability === 0) issues.push({ level: "warn", text: "触发概率为 0，永远不会注入", from, at });
    {
      // 功能注释：地点/人物可选，未挂不再报「未挂依赖」；已挂的仍校验 id 是否还在本作品
      const bindRooms = w.bindRooms?.length ? w.bindRooms : w.scope === "room" && w.scopeId ? [w.scopeId] : [];
      const bindNpcs = w.bindNpcs?.length ? w.bindNpcs : w.scope === "npc" && w.scopeId ? [w.scopeId] : [];
      if (!inp.skip?.includes("location")) {
        for (const id of bindRooms) {
          if (!rooms.has(id)) issues.push({ level: "error", text: `绑定的地点「${id}」已不存在，条目不会再注入`, from, at });
        }
      }
      if (!inp.skip?.includes("npc")) {
        for (const id of bindNpcs) {
          if (!npcIds.has(id)) issues.push({ level: "error", text: `绑定的角色「${id}」已不存在，条目不会再注入`, from, at });
        }
      }
    }
  }
  for (const w of inp.worldBook ?? []) { const t = txt(w.title); if (t && (titles.get(t) ?? 0) > 1) issues.push({ level: "warn", text: `与其他条目同名「${t}」，AI 可能分不清`, from: `世界书·${t}`, at: `wb:${w.id}` }); }

  // 存在性校验：空引用与已失效的 id
  const exists: Record<Exclude<RefKind, "flag">, Set<string>> = {
    npc: npcIds,
    item: new Set(draft ? (inp.itemIds ?? []) : LIVE_ITEMS.map((i) => i.id)),
    location: draft ? rooms : new Set(LIVE_LOCATIONS.map((l) => l.id)),
    event: ids,
    faction: new Set((inp.factions ?? []).map((f) => f.id)),
    quest: new Set(storylines.flatMap((l) => [l.id, ...(Array.isArray(l.nodes) ? l.nodes : []).map((n) => n.id)])),
    side: new Set(sidelines.map((s) => s.id)),
  };
  for (const r of refs) {
    if (r.kind === "flag") continue;
    if ((r.kind === "faction" && !inp.factions) || inp.skip?.includes(r.kind)) continue; // 调用方显式 skip 才跳过；草稿审计不再靠 skip 躲开人物/地点/物品
    if (!r.id) issues.push({ level: "error", text: `${REF_LABEL[r.kind]}未选择`, from: r.from, at: r.at });
    else if (!exists[r.kind].has(r.id)) issues.push({ level: "error", text: `引用了不存在的${REF_LABEL[r.kind]}「${r.id}」`, from: r.from, at: r.at });
  }
  // 标记：只读不写（系统写入的前缀与压力崩溃标记除外；当前世界的玩法规则也算写入方）
  for (const r of (draft ? inp.gameRules : getWorldGameRules()) ?? []) for (const b of r.branches ?? []) for (const f of b.effects ?? []) if (f.kind === "flag") writes.add(f.key);
  const sysFlag = (k: string) => /^(faction:|mem:|quest:|side:|sideDone:|sideAt:|chain:|evday:|溢出:)/.test(k) || k === rules.attrs.stressFlag;
  for (const r of inp.skip?.includes("flag") ? [] : refs.filter((x) => x.kind === "flag")) {
    if (!r.id) issues.push({ level: "error", text: "标记名为空", from: r.from, at: r.at });
    else if (!writes.has(r.id) && !sysFlag(r.id) && !(inp.flags && r.id in inp.flags)) issues.push({ level: "warn", text: `标记「${r.id}」只被读取，没有任何效果写入它`, from: r.from, at: r.at });
  }

  // 循环依赖：A 需要 B 已触发、B 又需要 A 已触发 → 都永远无法触发
  const deps = new Map<string, Set<string>>();
  for (const e of events) { const d = new Set<string>(); eventDeps(e.conds, d); for (const gr of e.condGroups ?? []) eventDeps(gr.conds, d); deps.set(e.id, d); }
  const cycles: string[][] = [];
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const seen = new Set<string>();
  const dfs = (id: string) => {
    state.set(id, 1); stack.push(id);
    for (const n of deps.get(id) ?? []) {
      if (!deps.has(n)) continue;
      if (state.get(n) === 1) {
        const cyc = stack.slice(stack.indexOf(n));
        const key = [...cyc].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cyc.map(evName));
          const text = `循环依赖：${[...cyc, cyc[0]].map(evName).join(" → ")}（互相要求对方先触发，都无法上演）`;
          for (const id of cyc) issues.push({ level: "error", text, from: `剧情桥段·${evName(id)}`, at: `event:${id}` });
        }
      } else if (!state.has(n)) dfs(n);
    }
    stack.pop(); state.set(id, 2);
  };
  for (const id of deps.keys()) if (!state.has(id)) dfs(id);

  // 锁定事件无人激活：locked 却没有任何事件 / 选项 / 主线节点把它列为后续
  const activated = new Set(refs.filter((r) => r.kind === "event" && ACTIVATE.test(r.from)).map((r) => r.id));
  for (const e of events) if (e.locked && !activated.has(e.id)) issues.push({ level: "warn", text: "设为需前置激活，但没有任何事件、选项或主线节点会激活它", from: `剧情桥段·${e.name || e.id}`, at: `event:${e.id}` });

  return { refs, issues, cycles };
}

/** 某个条目上的问题（错误在前） */
export const issuesAt = (r: AuditReport | null | undefined, at: string) => (r?.issues ?? []).filter((x) => x.at === at).sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
