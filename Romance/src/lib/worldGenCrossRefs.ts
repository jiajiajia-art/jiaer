/**
 * 生成世界 · 跨批 id 契约：第 2 次只能引用第 1 次已写出的属性 / 势力 / 世界书，
 * 世界书挂靠、人物 home、路线 hero/room、事件效果与主线条件都只认「已存在的 id」，禁止凭空编造。
 * 纯函数、不依赖 React，供 worldGenGenerate 清洗与软校验共用，也便于单测。
 */
import { asModArray } from "./asModArray.ts";
import { asTrimmedString } from "./asTrimmedString.ts";
import { formatStartDate, parseStartDateParts } from "./startDateFields.ts";
import { coerceWorldGenStartDate } from "./worldGenStartDate.ts";

/** 功能注释：软校验的「宽松区间」上限——建议条数之外仍接受，但防止灌爆；下限只要求非空。 */
export const WORLD_GEN_NPCS_SOFT_MAX = 12;
export const WORLD_GEN_ROOMS_SOFT_MAX = 16;
export const WORLD_GEN_FIXED_EVENTS_SOFT_MAX = 8;
export const WORLD_GEN_CUSTOM_ATTRS_SOFT_MAX = 8;

/** 功能注释：清洗跨批引用所需的上下文：第 1 次落盘内容 + 作品名/故事设定原文 */
export type WorldGenRefContext = {
  /** 已合并的 content（通常是 baseMod.content，含第 1 次产出） */
  content?: Record<string, unknown>;
  /** 作品名 + 故事设定，用于判断有无组织 / 恋爱 / 流浪者 / 明确年份 */
  settingText?: string;
};

export type WorldGenRefIds = {
  /** 功能注释：是否有上下文可对账；无上下文时不做「只许已有 id」的过滤，保持旧单测行为 */
  known: boolean;
  attrIds: Set<string>;
  npcIds: Set<string>;
  roomIds: Set<string>;
  factionIds: Set<string>;
  eventIds: Set<string>;
  /** 功能注释：名称/大小写别名 → 真实 id（AI 常把 key 写成属性中文名、人物名或地名） */
  attrAlias?: Map<string, string>;
  npcAlias?: Map<string, string>;
  roomAlias?: Map<string, string>;
};

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function objList(raw: unknown): Rec[] {
  return Array.isArray(raw) ? (raw.filter(isRec) as Rec[]) : [];
}

const ORG_RE = /势力|组织|宗门|门派|帮派|公会|家族|世家|集团|财团|社团|学会|派系|阵营|朝廷|商会|教会|联盟|军团|教派|黑帮|王国|帝国|学院派|社会团体/;
const RELATION_RE = /好感|恋爱|爱情|暧昧|心动|告白|表白|情侣|恋人|追求|攻略|暗恋|婚约|相亲|男友|女友|恋情|羁绊|情感线|romance|affinity|crush/i;
const ROAM_RE = /流浪|游历|行商|旅人|漂泊|云游|游侠|浪人|居无定所|巡游|游走|四处走动|到处走动|wander/i;

/** 功能注释：设定里有没有「组织 / 势力」——没有就不生成势力名单，人物与事件也不写势力 */
export function worldGenSettingHasOrgs(text: string): boolean {
  // 功能注释：先抹掉「没有任何组织」「无势力」这类否定短语，避免把否定当成有组织
  const ORG_WORDS = "(?:组织|势力|宗门|门派|帮派|公会|家族|世家|集团|财团|社团|学会|派系|阵营|朝廷|商会|教会|联盟|军团|教派|黑帮)";
  const negated = new RegExp(`(?:没有|无|不存在|不涉及|不含|没|并无)[^，。；;\\n]{0,6}?${ORG_WORDS}(?:[、和与及或]?${ORG_WORDS})*`, "g");
  const positive = text.replace(negated, "");
  return ORG_RE.test(positive);
}

/** 功能注释：设定 / 人物 / 事件里是否提到好感恋爱——没有就不写 metStart/wxStart 与 rel 效果 */
export function worldGenWantsRelations(text: string): boolean {
  return RELATION_RE.test(text);
}

/** 功能注释：设定里是否写了流浪者——只有这时人物才标 roam */
export function worldGenWantsRoamers(text: string): boolean {
  return ROAM_RE.test(text);
}

function idSetOf(rows: unknown): Set<string> {
  return new Set(
    asModArray<Rec>(rows)
      .map((r) => (isRec(r) ? asTrimmedString(r.id) : ""))
      .filter(Boolean),
  );
}

/** 功能注释：id / 小写 id / 显示名（label、name、title）都映射到真实 id */
function aliasMapOf(rows: unknown, nameKeys: readonly string[] = ["label", "name", "title"]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of asModArray<Rec>(rows)) {
    if (!isRec(r)) continue;
    const id = asTrimmedString(r.id);
    if (!id) continue;
    m.set(id, id);
    m.set(id.toLowerCase(), id);
    for (const k of nameKeys) {
      const n = asTrimmedString(r[k]);
      if (n && !m.has(n)) m.set(n, id);
    }
  }
  return m;
}

function roomAliasOf(rooms: Record<string, Rec>): Map<string, string> {
  return aliasMapOf(Object.entries(rooms).map(([id, r]) => ({ ...(isRec(r) ? r : {}), id })), ["name"]);
}

function resolveAlias(raw: string, ids: Set<string>, alias?: Map<string, string>): string {
  if (!raw) return "";
  if (ids.has(raw)) return raw;
  return alias?.get(raw) ?? alias?.get(raw.toLowerCase()) ?? "";
}

/**
 * 功能注释：把一条效果/条件的 key 对回真实 id；kind 缺失或写成 attr 时按 key 能对上的类型推断。
 * 对不上返回 null（调用方丢弃该条，但不因此丢整条事件）。
 */
function normalizeRefRow(row: Rec, refs: WorldGenRefIds, flags: RefFlags, roomKind: string): Rec | null {
  const rawKind = asTrimmedString(row.kind);
  const key = asTrimmedString(row.key);
  if (!key) return null;
  const attr = resolveAlias(key, refs.attrIds, refs.attrAlias);
  const npc = flags.allowRel ? resolveAlias(key, refs.npcIds, refs.npcAlias) : "";
  const room = resolveAlias(key, refs.roomIds, refs.roomAlias);
  const faction = flags.allowFaction && refs.factionIds.has(key) ? key : "";
  const kind = rawKind === "attr" || rawKind === "attribute" ? "stat" : rawKind;
  // 功能注释：作品自定义属性在引擎里是 metric + "c:" 前缀；写成 stat:id 会在编辑器显示「已失效」、局内读不到值
  if ((kind === "stat" || kind === "metric") && attr) return { ...row, kind: "metric", key: `c:${attr}` };
  if (kind === "rel" && npc) return { ...row, key: npc };
  if (kind === roomKind && room) return { ...row, key: room };
  if (kind === "faction" && faction) return row;
  if (!kind) {
    if (attr) return { ...row, kind: "metric", key: `c:${attr}` };
    if (npc) return { ...row, kind: "rel", key: npc };
    if (room) return { ...row, kind: roomKind, key: room };
  }
  return null;
}

function roomsMapOf(patch: Rec, ctx?: WorldGenRefContext): Record<string, Rec> {
  const raw = isRec(patch.rooms) ? patch.rooms : isRec(ctx?.content?.rooms) ? ctx!.content!.rooms : null;
  const out: Record<string, Rec> = {};
  if (!isRec(raw)) return out;
  for (const [id, v] of Object.entries(raw)) out[id] = isRec(v) ? v : {};
  return out;
}

function creationOf(content: Rec | undefined): Rec {
  return isRec(content?.creation) ? (content!.creation as Rec) : {};
}

/** 功能注释：收集可引用的 id 集合：本批补丁优先，其次第 1 次已落盘内容 */
export function collectWorldGenRefIds(patch: Rec, ctx?: WorldGenRefContext): WorldGenRefIds {
  const content = ctx?.content;
  const attrSrc = "customAttrs" in patch ? patch.customAttrs : content?.customAttrs;
  const npcSrc = Array.isArray(patch.npcs) ? patch.npcs : content?.npcs;
  const patchFactions = isRec(patch.creation) && Array.isArray((patch.creation as Rec).startFactions)
    ? (patch.creation as Rec).startFactions
    : undefined;
  const factionSrc = patchFactions
    ?? (Array.isArray(patch.factions) ? patch.factions : undefined)
    ?? creationOf(content).startFactions
    ?? content?.factions;
  return {
    known: !!content,
    attrIds: idSetOf(attrSrc),
    npcIds: idSetOf(npcSrc),
    roomIds: new Set(Object.keys(roomsMapOf(patch, ctx))),
    factionIds: idSetOf(factionSrc),
    eventIds: idSetOf(patch.fixedEvents),
    attrAlias: aliasMapOf(attrSrc),
    npcAlias: aliasMapOf(npcSrc, ["name"]),
    roomAlias: roomAliasOf(roomsMapOf(patch, ctx)),
  };
}

/** 功能注释：把模型写的地名 / 大小写不一致的 id 对回 rooms 的真实 id；对不上返回空串（调用方不得清空原值） */
export function resolveWorldGenRoomId(raw: unknown, rooms: Record<string, Rec>): string {
  const v = asTrimmedString(raw);
  if (!v) return "";
  if (v in rooms) return v;
  const lower = v.toLowerCase();
  for (const [id, r] of Object.entries(rooms)) {
    if (id.toLowerCase() === lower) return id;
    if (asTrimmedString(r?.name) === v) return id;
  }
  return "";
}

function resolveNpcId(raw: unknown, npcs: Rec[]): string {
  const v = asTrimmedString(raw);
  if (!v) return "";
  for (const n of npcs) {
    if (asTrimmedString(n.id) === v) return asTrimmedString(n.id);
  }
  for (const n of npcs) {
    if (asTrimmedString(n.name) === v) return asTrimmedString(n.id);
  }
  return "";
}

type RefFlags = { allowRel: boolean; allowFaction: boolean };

/** 功能注释：事件 / 选项后果只保留 已有属性 id、已有人物关系、已有地点、已有势力；没有 fame 属性就绝不出现 fame */
export function filterWorldGenEffectsByRefs(raw: unknown, refs: WorldGenRefIds, flags: RefFlags): Rec[] {
  const out: Rec[] = [];
  for (const row of objList(raw)) {
    const next = normalizeRefRow(row, refs, flags, "unlockLocation");
    if (next) out.push(next);
  }
  return out;
}

/** 功能注释：条件只用 已有属性 / 同批人物与地点 / 同批事件 id；时间类条件不涉及 id 可保留 */
export function filterWorldGenCondsByRefs(raw: unknown, refs: WorldGenRefIds, flags: RefFlags): Rec[] {
  const out: Rec[] = [];
  for (const row of objList(raw)) {
    const kind = asTrimmedString(row.kind);
    const key = asTrimmedString(row.key);
    if (kind === "time" || kind === "date" || kind === "clock") out.push(row);
    else if (kind === "event" && refs.eventIds.has(key)) out.push(row);
    else {
      const next = normalizeRefRow(row, refs, flags, kind === "visited" ? "visited" : "location");
      if (next) out.push(next);
    }
  }
  return out;
}

function eventTextBlob(patch: Rec): string {
  return objList(patch.fixedEvents).map((e) => `${asTrimmedString(e.name)} ${asTrimmedString(e.prompt)}`).join("\n");
}

function npcTextBlob(patch: Rec, ctx?: WorldGenRefContext): string {
  const npcs = Array.isArray(patch.npcs) ? patch.npcs : asModArray(ctx?.content?.npcs);
  return objList(npcs).map((n) => `${asTrimmedString(n.relation)} ${asTrimmedString(n.role)}`).join("\n");
}

/** 功能注释：是否需要关系线：设定 / 人物 / 事件提到好感恋爱，或已有关系档位 */
export function worldGenNeedsRelations(patch: Rec, ctx?: WorldGenRefContext): boolean {
  const stages = isRec(patch.contacts) ? (patch.contacts as Rec).stages : (ctx?.content?.contacts as Rec | undefined)?.stages;
  if (Array.isArray(stages) && stages.length) return true;
  return worldGenWantsRelations([ctx?.settingText ?? "", npcTextBlob(patch, ctx), eventTextBlob(patch)].join("\n"));
}

function flagsFor(patch: Rec, refs: WorldGenRefIds, ctx?: WorldGenRefContext): RefFlags {
  return {
    allowRel: refs.npcIds.size > 0 && worldGenNeedsRelations(patch, ctx),
    allowFaction: refs.factionIds.size > 0,
  };
}

/**
 * 功能注释：固定事件只留已有 id 的后果 / 条件；nextIds 只指向同批事件；选项须有文案。
 * 后果全部对不上时只清空后果、保留事件本身（纯叙事事件合法；仍不自动补 fame）。
 * 旧逻辑整条丢弃，导致 AI 把 key 写成中文名时事件被清空、反复「至少 1 条」失败。
 */
export function applyWorldGenEventRefs(patch: Rec, refs: WorldGenRefIds, flags: RefFlags): Rec {
  if (!Array.isArray(patch.fixedEvents) || !refs.known) return patch;
  const out: Rec = { ...patch };
  const firstPass = objList(patch.fixedEvents);
  let kept: Rec[] = [];
  for (const ev of firstPass) {
    const effects = filterWorldGenEffectsByRefs(ev.effects, refs, flags);
    const next: Rec = { ...ev };
    if (effects.length) next.effects = effects;
    else delete next.effects;
    kept.push(next);
  }
  const ids = new Set(kept.map((e) => asTrimmedString(e.id)).filter(Boolean));
  const scoped: WorldGenRefIds = { ...refs, eventIds: ids };
  kept = kept.map((ev) => {
    const id = asTrimmedString(ev.id);
    const next: Rec = { ...ev };
    const conds = filterWorldGenCondsByRefs(ev.conds, scoped, flags);
    if (conds.length) next.conds = conds;
    else delete next.conds;
    const nextIds = (Array.isArray(ev.nextIds) ? ev.nextIds : [])
      .map((x) => asTrimmedString(x))
      .filter((x) => x && x !== id && ids.has(x));
    if (nextIds.length) next.nextIds = nextIds;
    else delete next.nextIds;
    const choices = objList(ev.choices)
      .map((c, i) => {
        const label = asTrimmedString(c.label);
        if (!label) return null;
        const choice: Rec = { id: asTrimmedString(c.id) || `c${i + 1}`, label };
        const prompt = asTrimmedString(c.prompt);
        if (prompt) choice.prompt = prompt;
        const ceff = filterWorldGenEffectsByRefs(c.effects, refs, flags);
        if (ceff.length) choice.effects = ceff;
        const cnext = (Array.isArray(c.nextIds) ? c.nextIds : [])
          .map((x) => asTrimmedString(x))
          .filter((x) => x && x !== id && ids.has(x));
        if (cnext.length) choice.nextIds = cnext;
        return choice;
      })
      .filter(Boolean)
      .slice(0, 3);
    if (choices.length) next.choices = choices;
    else delete next.choices;
    return next;
  });
  if (kept.length) out.fixedEvents = kept;
  else delete out.fixedEvents;
  return out;
}

/** 功能注释：主线节点条件只认已有属性 / 人物 / 地点 / 同批事件；筛空了就留空，不自动补名气条件 */
export function applyWorldGenQuestRefs(patch: Rec, refs: WorldGenRefIds, flags: RefFlags): Rec {
  if (!Array.isArray(patch.storylines) || !refs.known) return patch;
  const out: Rec = { ...patch };
  out.storylines = objList(patch.storylines).map((line) => ({
    ...line,
    nodes: objList(line.nodes).map((node) => {
      const next: Rec = { ...node, conds: filterWorldGenCondsByRefs(node.conds, refs, flags) };
      if (Array.isArray(node.failConds)) {
        const fail = filterWorldGenCondsByRefs(node.failConds, refs, flags);
        if (fail.length) next.failConds = fail;
        else delete next.failConds;
      }
      return next;
    }),
  }));
  return out;
}

function nameIdMap(rows: Rec[], key = "name"): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    const id = asTrimmedString(r.id);
    const name = asTrimmedString(r[key]);
    if (id && name) m.set(name, id);
  }
  return m;
}

function resolveBindList(raw: unknown, valid: Set<string>, nameToId: Map<string, string>): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of list) {
    const v = asTrimmedString(item);
    if (!v) continue;
    const id = valid.has(v) ? v : nameToId.get(v) ?? "";
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * 功能注释：世界书挂靠只在「人物 / 地点已写出」之后填：
 * - 本批没有人物地点（第 1 次）→ 剥掉 bindRooms/bindNpcs，只留标题/关键词/正文；
 * - 本批写出了人物或地点（第 2 次）→ 绑定只保留有效 id（地名对回 id），无效删除；
 *   已有条目没有任何有效挂靠时，按标题/正文/关键词里提到的人名地名确定性补绑，不编造。
 */
export function applyWorldBookBinds(patch: Rec, stepIds: readonly string[], ctx?: WorldGenRefContext): Rec {
  const ids = new Set(stepIds);
  const rosterBatch = ids.has("npcs") || ids.has("rooms");
  const out: Rec = { ...patch };
  const patchBook = objList(patch.worldBook);
  if (!rosterBatch) {
    if (Array.isArray(patch.worldBook)) {
      out.worldBook = patchBook.map((e) => {
        const next = { ...e };
        delete next.bindRooms;
        delete next.bindNpcs;
        return next;
      });
    }
    return out;
  }
  const rooms = roomsMapOf(patch, ctx);
  const roomRows = Object.entries(rooms).map(([id, r]) => ({ id, name: r.name }) as Rec);
  const npcRows = objList(Array.isArray(patch.npcs) ? patch.npcs : ctx?.content?.npcs);
  const roomIds = new Set(Object.keys(rooms));
  const npcIds = new Set(npcRows.map((n) => asTrimmedString(n.id)).filter(Boolean));
  const roomByName = nameIdMap(roomRows);
  const npcByName = nameIdMap(npcRows);
  const baseBook = objList(ctx?.content?.worldBook);
  const baseIds = new Set(baseBook.map((e) => asTrimmedString(e.id)).filter(Boolean));

  const byId = new Map<string, Rec>();
  for (const e of baseBook) byId.set(asTrimmedString(e.id), e);
  for (const e of patchBook) {
    const id = asTrimmedString(e.id);
    if (!id) continue;
    const complete = !!asTrimmedString(e.title) && !!asTrimmedString(e.content);
    // 功能注释：第 2 次不得凭空新增世界书；只认第 1 次已有条目，或自带完整标题正文的条目
    if (ctx?.content && !baseIds.has(id) && !complete) continue;
    byId.set(id, { ...(byId.get(id) ?? {}), ...e });
  }
  const result: Rec[] = [];
  for (const [id, e] of byId) {
    const bindRooms = resolveBindList(e.bindRooms, roomIds, roomByName);
    const bindNpcs = resolveBindList(e.bindNpcs, npcIds, npcByName);
    if (!bindRooms.length && !bindNpcs.length) {
      const blob = [e.title, e.content, Array.isArray(e.keywords) ? e.keywords.join(" ") : e.keywords]
        .map((x) => asTrimmedString(x))
        .join("\n");
      for (const [name, rid] of roomByName) if (blob.includes(name) && !bindRooms.includes(rid)) bindRooms.push(rid);
      for (const [name, nid] of npcByName) if (blob.includes(name) && !bindNpcs.includes(nid)) bindNpcs.push(nid);
    }
    if (!bindRooms.length && !bindNpcs.length) continue;
    const row: Rec = { id };
    // 功能注释：基础条目只写 id+挂靠即可，merge 时按 id 补进已有条目；全新完整条目则整条写入
    if (!baseIds.has(id)) Object.assign(row, e);
    if (bindRooms.length) row.bindRooms = bindRooms;
    else delete row.bindRooms;
    if (bindNpcs.length) row.bindNpcs = bindNpcs;
    else delete row.bindNpcs;
    result.push(row);
  }
  if (result.length) out.worldBook = result;
  else delete out.worldBook;
  return out;
}

/** 功能注释：把「25-30」「二十岁」之类写法收成单个整数年龄；解析不了返回 null */
export function coerceWorldGenSingleAge(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  const s = asTrimmedString(raw);
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function explicitEraYear(text: string): number | null {
  const years = new Set<number>();
  for (const m of text.matchAll(/(?<!\d)(1[89]\d{2}|20\d{2}|21\d{2})(?!\d)\s*年?/g)) years.add(Number(m[1]));
  return years.size === 1 ? [...years][0]! : null;
}

/**
 * 功能注释：年龄与开局日期同一时代——年龄收成单值；故事设定写了唯一年份而 startDate 不在该年时，
 * 把 startDate 对到该年（月日保留），保证只有一个 startDate。
 */
export function alignWorldGenAgesAndStartDate(patch: Rec, ctx?: WorldGenRefContext): Rec {
  if (!Array.isArray(patch.npcs)) return patch;
  const out: Rec = { ...patch };
  out.npcs = objList(patch.npcs).map((n) => {
    if (!("age" in n)) return n;
    const age = coerceWorldGenSingleAge(n.age);
    return age == null ? n : { ...n, age };
  });
  const sd = coerceWorldGenStartDate(patch.startDate ?? ctx?.content?.startDate);
  const era = ctx?.settingText ? explicitEraYear(ctx.settingText) : null;
  const parts = parseStartDateParts(sd);
  if (parts && era && parts.year !== era) {
    const fixed = formatStartDate({ ...parts, year: era });
    out.startDate = fixed || sd;
  } else if (sd) {
    out.startDate = sd;
  }
  return out;
}

/**
 * 功能注释：人物写出后回填线路——hero 必须是有效人物 id，room 必须是有效地点 id；
 * 找不到对应人物的线路整条丢弃；用完即删 npc.pathId 辅助字段。
 */
export function fillWorldGenPaths(patch: Rec, ctx?: WorldGenRefContext): Rec {
  if (!Array.isArray(patch.npcs)) return patch;
  const creation = isRec(patch.creation) ? (patch.creation as Rec) : creationOf(ctx?.content);
  const rawPaths = isRec(patch.creation) && Array.isArray((patch.creation as Rec).paths)
    ? (patch.creation as Rec).paths
    : creationOf(ctx?.content).paths;
  const npcs = objList(patch.npcs);
  const rooms = roomsMapOf(patch, ctx);
  const fallbackRoom = resolveWorldGenRoomId(patch.startRoom ?? ctx?.content?.startRoom, rooms);
  const out: Rec = { ...patch };
  out.npcs = npcs.map((n) => {
    if (!("pathId" in n)) return n;
    const next = { ...n };
    delete next.pathId;
    return next;
  });
  if (!Array.isArray(rawPaths)) return out;
  const filled: Rec[] = [];
  for (const p of objList(rawPaths)) {
    const pid = asTrimmedString(p.id);
    const blob = [p.name, p.about, p.blurb, p.tag].map((x) => asTrimmedString(x)).join("\n");
    const hero =
      npcs.find((n) => resolveNpcId(p.hero, [n]) === asTrimmedString(n.id) && asTrimmedString(p.hero))
      ?? (pid ? npcs.find((n) => asTrimmedString(n.pathId) === pid) : undefined)
      ?? npcs.find((n) => asTrimmedString(n.name) && blob.includes(asTrimmedString(n.name)));
    if (!hero) continue;
    const room =
      resolveWorldGenRoomId(p.room, rooms)
      || resolveWorldGenRoomId(hero.home, rooms)
      || fallbackRoom;
    const row: Rec = { ...p, hero: asTrimmedString(hero.id) };
    if (room) row.room = room;
    else delete row.room;
    filled.push(row);
  }
  out.creation = { ...creation, ...(isRec(patch.creation) ? (patch.creation as Rec) : {}), paths: filled };
  return out;
}

/**
 * 功能注释：跨批清洗总入口（顺序固定）：
 * 去 locations → 势力 → 人物（home / 关系 / 势力 / roam）→ 年龄与日期 → 线路回填 → 世界书挂靠 → 事件与主线引用。
 */
export function applyWorldGenCrossRefs(
  patch: Rec,
  stepIds: readonly string[],
  ctx?: WorldGenRefContext,
): Rec {
  let out: Rec = { ...patch };
  // 功能注释：只用 rooms；locations[] 一律剥掉
  delete out.locations;
  const settingText = ctx?.settingText ?? "";
  const refs0 = collectWorldGenRefIds(out, ctx);

  // 功能注释：设定里没有组织 → 不要势力名单；且人物 / 事件不写势力
  const baseFactions = creationOf(ctx?.content).startFactions;
  const hadBaseFactions = Array.isArray(baseFactions) && baseFactions.length > 0;
  if (ctx?.settingText != null && !worldGenSettingHasOrgs(settingText) && !hadBaseFactions) {
    if (isRec(out.creation) && "startFactions" in (out.creation as Rec)) {
      const creation = { ...(out.creation as Rec) };
      delete creation.startFactions;
      out.creation = creation;
    }
    delete out.factions;
    refs0.factionIds.clear();
  }

  if (Array.isArray(out.npcs)) {
    const rooms = roomsMapOf(out, ctx);
    const needRel = worldGenNeedsRelations(out, ctx);
    const roamSetting = worldGenWantsRoamers(settingText);
    out.npcs = objList(out.npcs)
      .slice(0, WORLD_GEN_NPCS_SOFT_MAX)
      .map((n) => {
        const next: Rec = { ...n };
        if (refs0.factionIds.size && asTrimmedString(next.factionId) && refs0.factionIds.has(asTrimmedString(next.factionId))) {
          next.factionId = asTrimmedString(next.factionId);
        } else {
          delete next.factionId;
        }
        if (!needRel) {
          delete next.metStart;
          delete next.wxStart;
        }
        const homeRaw = asTrimmedString(next.home);
        if (homeRaw) {
          const rid = resolveWorldGenRoomId(homeRaw, rooms);
          if (rid) next.home = rid;
          // 功能注释：对不上保留原值，由软校验打回重试；禁止清空 home
        }
        const wanders = roamSetting || worldGenWantsRoamers(asTrimmedString(next.role));
        if (next.kind === "roam" && wanders) {
          const roam = (Array.isArray(next.roam) ? next.roam : [])
            .map((r) => resolveWorldGenRoomId(r, rooms))
            .filter(Boolean);
          next.roam = roam;
        } else {
          next.kind = "staff";
          next.roam = [];
        }
        return next;
      });
    if (!(out.npcs as unknown[]).length) delete out.npcs;
  }

  out = alignWorldGenAgesAndStartDate(out, ctx);
  if (stepIds.includes("npcs")) out = fillWorldGenPaths(out, ctx);
  out = applyWorldBookBinds(out, stepIds, ctx);

  const refs = collectWorldGenRefIds(out, ctx);
  if (ctx?.settingText != null && !worldGenSettingHasOrgs(settingText) && !hadBaseFactions) refs.factionIds.clear();
  const flags = flagsFor(out, refs, ctx);
  out = applyWorldGenEventRefs(out, refs, flags);
  const refsAfterEvents = collectWorldGenRefIds(out, ctx);
  out = applyWorldGenQuestRefs(out, { ...refsAfterEvents, factionIds: refs.factionIds }, flags);
  return out;
}

/**
 * 功能注释：跨批软校验——人物 home 必须是有效地点 id（含未写 home）；startRoom 必须是 rooms id；
 * 年龄须为合理单值；条数超过宽松上限才失败（建议区间之外不拦）。
 */
export function softValidateWorldGenCrossRefs(
  stepIds: readonly string[],
  patch: Rec,
  ctx?: WorldGenRefContext,
): string | null {
  const ids = new Set(stepIds);
  const rooms = roomsMapOf(patch, ctx);
  const hasRooms = Object.keys(rooms).length > 0;
  if (ids.has("rooms")) {
    if (Object.keys(rooms).length > WORLD_GEN_ROOMS_SOFT_MAX) {
      return `地点过多（${Object.keys(rooms).length}），请控制在 ${WORLD_GEN_ROOMS_SOFT_MAX} 个以内`;
    }
    const start = asTrimmedString(patch.startRoom);
    if (!start) return "缺少开局地点 startRoom（须为 rooms 里的 id）";
    if (!(start in rooms)) return `开局地点 startRoom「${start}」不是 rooms 里的 id`;
  }
  if (ids.has("npcs") && Array.isArray(patch.npcs)) {
    for (const n of objList(patch.npcs)) {
      const name = asTrimmedString(n.name) || "未命名";
      const age = n.age;
      if (typeof age === "number" && (age < 0 || age > 120)) return `人物「${name}」年龄须为 0–120 的单个数字`;
      if (!hasRooms) continue;
      const home = asTrimmedString(n.home);
      if (!home) return `人物「${name}」缺少 home（须为 rooms 里的地点 id）`;
      if (!(home in rooms)) return `人物「${name}」的 home「${home}」不是 rooms 里的 id`;
    }
  }
  if (ids.has("fixedEvents") && Array.isArray(patch.fixedEvents) && patch.fixedEvents.length > WORLD_GEN_FIXED_EVENTS_SOFT_MAX) {
    return `固定事件过多（${patch.fixedEvents.length}），请控制在 ${WORLD_GEN_FIXED_EVENTS_SOFT_MAX} 条以内`;
  }
  if (ids.has("creation") && Array.isArray(patch.customAttrs) && patch.customAttrs.length > WORLD_GEN_CUSTOM_ATTRS_SOFT_MAX) {
    return `建角属性过多（${patch.customAttrs.length}），请控制在 ${WORLD_GEN_CUSTOM_ATTRS_SOFT_MAX} 条以内`;
  }
  return null;
}
