/**
 * 大地图层：作品可有多张大地图，每张下挂一棵地点树。
 * 旧稿无 worldMaps 时自动补一张「主地图」，并把未标注的地点归进去。
 */
import type { RoomContent } from "../worlds/star2005/content";

export type WorldMapDef = {
  id: string;
  name: string;
  desc?: string;
  bg?: string;
  order?: number;
};

export type Rooms = Record<string, RoomContent>;

export const DEFAULT_WORLD_MAP_ID = "map_main";
export const DEFAULT_WORLD_MAP_NAME = "主地图";

const uid = (p: string) => `${p}_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;

/** 功能注释：库里地点树节点（用 key 表达父子，导入时再换成作品内新 id） */
export type LibraryRoomNode = {
  key: string;
  name: string;
  description?: string;
  imageUrl?: string;
  parentKey?: string | null;
  order?: number;
};

export type LibraryMapTree = { rooms: LibraryRoomNode[] };

export function newWorldMapId(): string {
  return uid("map");
}

/** 功能注释：保证至少一张大地图；缺 mapId 的地点挂到第一张图上 */
export function ensureWorldMaps(
  rooms: Rooms | undefined,
  maps: WorldMapDef[] | undefined,
): { worldMaps: WorldMapDef[]; rooms: Rooms } {
  const nextRooms: Rooms = { ...(rooms ?? {}) };
  let worldMaps = Array.isArray(maps) ? maps.map((m) => ({ ...m })).filter((m) => m.id && String(m.name || "").trim()) : [];
  if (!worldMaps.length) {
    worldMaps = [{ id: DEFAULT_WORLD_MAP_ID, name: DEFAULT_WORLD_MAP_NAME, order: 0 }];
  }
  const mapIds = new Set(worldMaps.map((m) => m.id));
  const fallback = worldMaps[0]!.id;
  for (const id of Object.keys(nextRooms)) {
    const mid = nextRooms[id].mapId;
    if (!mid || !mapIds.has(mid)) {
      nextRooms[id] = { ...nextRooms[id], mapId: fallback };
    }
  }
  return { worldMaps, rooms: nextRooms };
}

/** 功能注释：某张大地图下的地点表（仅该图） */
export function roomsOfMap(rooms: Rooms, mapId: string): Rooms {
  const out: Rooms = {};
  for (const [id, r] of Object.entries(rooms)) {
    if ((r.mapId || DEFAULT_WORLD_MAP_ID) === mapId) out[id] = r;
  }
  return out;
}

/** 功能注释：把库大地图 + 地点树复制进作品；返回新 map、新地点与可选开局候选 */
export function importLibraryMapTree(opts: {
  mapName: string;
  mapDesc?: string;
  mapBg?: string;
  tree: LibraryMapTree | null | undefined;
  existingRooms: Rooms;
  newRoomId?: () => string;
  newMapId?: () => string;
}): { map: WorldMapDef; rooms: Rooms; rootId?: string } {
  const newRoomId = opts.newRoomId ?? (() => uid("room"));
  const mapId = (opts.newMapId ?? newWorldMapId)();
  const map: WorldMapDef = {
    id: mapId,
    name: String(opts.mapName || "大地图").trim() || "大地图",
    ...(opts.mapDesc?.trim() ? { desc: opts.mapDesc.trim() } : {}),
    ...(opts.mapBg?.trim() ? { bg: opts.mapBg.trim() } : {}),
  };
  const nodes = Array.isArray(opts.tree?.rooms) ? opts.tree!.rooms : [];
  // 功能注释：旧库条目没有 tree —— 退化为「大地图名 = 唯一顶层地点」
  if (!nodes.length) {
    const id = newRoomId();
    const name = map.name;
    return {
      map,
      rooms: {
        [id]: {
          name,
          desc: opts.mapDesc?.trim() || `你来到了「${name}」。`,
          exits: {},
          mapId,
          ...(opts.mapBg?.trim() ? { bg: opts.mapBg.trim() } : {}),
        },
      },
      rootId: id,
    };
  }
  const keyToId = new Map<string, string>();
  for (const n of nodes) {
    const key = String(n.key || "").trim();
    if (!key || keyToId.has(key)) continue;
    keyToId.set(key, newRoomId());
  }
  const rooms: Rooms = {};
  let rootId: string | undefined;
  const ordered = [...nodes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const n of ordered) {
    const key = String(n.key || "").trim();
    const id = keyToId.get(key);
    if (!id) continue;
    const name = String(n.name || "地点").trim() || "地点";
    const parentKey = n.parentKey ? String(n.parentKey).trim() : "";
    const parent = parentKey && keyToId.has(parentKey) ? keyToId.get(parentKey) : undefined;
    if (!parent && !rootId) rootId = id;
    rooms[id] = {
      name,
      desc: String(n.description || "").trim() || `你来到了「${name}」。`,
      exits: {},
      mapId,
      ...(parent ? { parent, order: n.order } : { order: n.order }),
      ...(String(n.imageUrl || "").trim() ? { bg: String(n.imageUrl).trim() } : {}),
    };
  }
  return { map, rooms, rootId };
}

/** 功能注释：解析库接口返回的 treeJson（字符串或对象） */
export function parseLibraryMapTree(raw: unknown): LibraryMapTree | null {
  let v = raw;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    try { v = JSON.parse(t); } catch { return null; }
  }
  if (!v || typeof v !== "object") return null;
  const rooms = (v as { rooms?: unknown }).rooms;
  if (!Array.isArray(rooms)) return null;
  const out: LibraryRoomNode[] = [];
  for (const row of rooms) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const key = String(r.key ?? r.id ?? "").trim();
    const name = String(r.name ?? "").trim();
    if (!key || !name) continue;
    out.push({
      key,
      name,
      description: String(r.description ?? r.desc ?? "").trim() || undefined,
      imageUrl: String(r.imageUrl ?? r.image_url ?? r.bg ?? "").trim() || undefined,
      parentKey: r.parentKey != null || r.parent != null ? String(r.parentKey ?? r.parent ?? "").trim() || null : null,
      order: Number.isFinite(Number(r.order)) ? Number(r.order) : undefined,
    });
  }
  return out.length ? { rooms: out } : null;
}
