/* 世界书依赖（地点 / 人物）与「详细设定 / 节日 → 世界书」合并。
 * 创作者一条设定只写进 worldBook；必须挂本作品地点或人物才能保存。
 * 运行时：玩家在挂靠地点、挂靠人物在场、或正文提到关键词 → 才注入 AI。 */
import type { Festival, LoreChar, LoreRegion, WorldBookEntry } from "./types.ts";
import { asTrimmedString } from "./asTrimmedString.ts";
import { keywordTexts } from "./worldBookKeywords.ts";

const txt = (raw: unknown) => asTrimmedString(raw);

/** 功能注释：统一读出地点依赖；兼容旧 scope/scopeId */
export function worldBookBindRooms(e: WorldBookEntry): string[] {
  if (Array.isArray(e.bindRooms) && e.bindRooms.length) {
    return [...new Set(e.bindRooms.map(String).map((s) => s.trim()).filter(Boolean))];
  }
  if (e.scope === "room" && e.scopeId) return [String(e.scopeId)];
  return [];
}

/** 功能注释：统一读出人物依赖；兼容旧 scope/scopeId */
export function worldBookBindNpcs(e: WorldBookEntry): string[] {
  if (Array.isArray(e.bindNpcs) && e.bindNpcs.length) {
    return [...new Set(e.bindNpcs.map(String).map((s) => s.trim()).filter(Boolean))];
  }
  if (e.scope === "npc" && e.scopeId) return [String(e.scopeId)];
  return [];
}

/** 功能注释：是否已挂至少一个本作品地点或人物 */
export function worldBookHasDeps(e: WorldBookEntry): boolean {
  return worldBookBindRooms(e).length > 0 || worldBookBindNpcs(e).length > 0;
}

/** 功能注释：运行时依赖命中（地点 / 人物 OR）。roomPath = 当前点的祖先链，子地点也算身处挂靠点。 */
export function worldBookDepHit(
  e: WorldBookEntry,
  opts: { room?: string; roomPath?: string[]; npcIds?: string[] },
): boolean {
  const rooms = worldBookBindRooms(e);
  const npcs = worldBookBindNpcs(e);
  if (!rooms.length && !npcs.length) return false;
  const path = opts.roomPath ?? [];
  const roomOk = rooms.length > 0 && !!opts.room && (
    rooms.includes(opts.room) || rooms.some((id) => path.includes(id))
  );
  const npcOk = npcs.length > 0 && (opts.npcIds ?? []).some((id) => npcs.includes(id));
  return roomOk || npcOk;
}

/** 功能注释：写入依赖，并回填旧 scope 字段，方便旧版检索仍可读 */
export function withWorldBookDeps(
  e: WorldBookEntry,
  rooms: string[],
  npcs: string[],
): WorldBookEntry {
  const bindRooms = [...new Set(rooms.map(String).map((s) => s.trim()).filter(Boolean))];
  const bindNpcs = [...new Set(npcs.map(String).map((s) => s.trim()).filter(Boolean))];
  const next: WorldBookEntry = { ...e, bindRooms: bindRooms.length ? bindRooms : undefined, bindNpcs: bindNpcs.length ? bindNpcs : undefined };
  if (bindRooms.length === 1 && !bindNpcs.length) {
    next.scope = "room";
    next.scopeId = bindRooms[0];
  } else if (bindNpcs.length === 1 && !bindRooms.length) {
    next.scope = "npc";
    next.scopeId = bindNpcs[0];
  } else {
    // 多依赖或空依赖：不再用单一 scope 表达
    delete next.scope;
    delete next.scopeId;
  }
  return next;
}

/** 功能注释：保存前校验——启用中的设定条目必须挂本作品地点或人物 */
export function worldBookMissingDepsErrors(list: WorldBookEntry[] | undefined): string[] {
  const errs: string[] = [];
  for (const e of list ?? []) {
    if (!e.enabled) continue;
    const title = txt(e.title) || e.id;
    const body = txt(e.content);
    if (!body && !txt(e.title)) continue;
    if (!worldBookHasDeps(e)) errs.push(`世界书「${title}」未挂地点或人物，不能保存`);
  }
  return errs;
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

function nodeEntry(
  id: string,
  name: string,
  brief: string,
  detail: string,
  keywords: string[] | undefined,
  rooms: string[],
  npcs: string[],
): WorldBookEntry | null {
  const title = txt(name);
  const content = txt(detail) || txt(brief);
  if (!title && !content) return null;
  const keys = [...keywordTexts(keywords), title].filter(Boolean);
  const hasDep = rooms.length > 0 || npcs.length > 0;
  // 功能注释：没有可挂靠的地点/人物时先停用，避免合并后卡住保存
  return withWorldBookDeps(
    {
      id,
      title: title || "未命名设定",
      keywords: [...new Set(keys)],
      content: content || title,
      enabled: hasDep,
      mode: "keyword",
      order: 100,
      probability: 100,
    },
    rooms,
    npcs,
  );
}

/** 功能注释：把「详细设定」树展平成世界书条目（地区 / 势力 / 角色各一条） */
export function loreToWorldBook(regions: LoreRegion[] | undefined): WorldBookEntry[] {
  const out: WorldBookEntry[] = [];
  for (const r of regions ?? []) {
    const rooms = (Array.isArray(r.rooms) ? r.rooms : []).map(String).filter(Boolean);
    const region = nodeEntry(`wb_lore_${r.id}`, r.name, r.brief, r.detail, r.keywords, rooms, []);
    if (region) out.push(region);
    const pushChars = (chars: LoreChar[] | undefined, inheritRooms: string[]) => {
      for (const c of chars ?? []) {
        const npcs = c.npcId ? [String(c.npcId)] : [];
        const entry = nodeEntry(`wb_lore_${c.id}`, c.name, c.brief, c.detail, c.keywords, inheritRooms, npcs);
        if (entry) out.push(entry);
      }
    };
    for (const f of r.factions ?? []) {
      const faction = nodeEntry(`wb_lore_${f.id}`, f.name, f.brief, f.detail, f.keywords, rooms, []);
      if (faction) out.push(faction);
      pushChars(f.chars, rooms);
    }
    pushChars(r.chars, rooms);
  }
  return out;
}

/** 功能注释：节日并入世界书正文；依赖需作者补挂（旧节日无地点） */
export function festivalsToWorldBook(list: Festival[] | undefined): WorldBookEntry[] {
  const out: WorldBookEntry[] = [];
  for (const f of list ?? []) {
    const name = txt(f.name);
    const detail = txt(f.detail) || txt(f.brief);
    if (!name && !detail) continue;
    const head = [`日期 ${txt(f.date) || "—"}${(f.days ?? 1) > 1 ? `，持续 ${f.days} 天` : ""}`, txt(f.brief)].filter(Boolean).join("\n");
    // 功能注释：旧节日无地点依赖；先停用写入世界书，作者挂地点/人物后再启用
    out.push({
      id: `wb_fest_${f.id}`,
      title: name || "节日",
      keywords: [...new Set([name, ...keywordTexts(f.keywords)].filter(Boolean))],
      content: [head, detail].filter(Boolean).join("\n"),
      enabled: false,
      mode: "keyword",
      order: 100,
      probability: 100,
    });
  }
  return out;
}

export type FoldableWorldContent = {
  worldBook?: WorldBookEntry[];
  lore?: LoreRegion[];
  festivals?: Festival[];
};

/** 功能注释：把 lore / festivals 合并进 worldBook，并清掉另两处，保证只存一份 */
export function foldLoreFestivalsIntoWorldBook<T extends FoldableWorldContent>(content: T): T {
  const lore = content.lore;
  const festivals = content.festivals;
  if (!lore?.length && !festivals?.length) return content;
  const existing = content.worldBook ?? [];
  const ids = new Set(existing.map((e) => e.id));
  const merged = [...existing];
  for (const e of [...loreToWorldBook(lore), ...festivalsToWorldBook(festivals)]) {
    if (ids.has(e.id)) continue;
    ids.add(e.id);
    merged.push(e);
  }
  const next = { ...content, worldBook: merged.length ? merged : undefined };
  delete next.lore;
  delete next.festivals;
  return next;
}

/** 新条目默认壳（尚未挂依赖，编辑器内需补全才能保存） */
export function blankWorldBookEntry(order = 100): WorldBookEntry {
  return {
    id: uid("wb"),
    title: "新条目",
    keywords: [],
    content: "",
    enabled: true,
    mode: "keyword",
    order,
    probability: 100,
  };
}
