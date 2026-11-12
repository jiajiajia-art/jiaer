/**
 * 大地图层：作品可有多张大地图，每张下挂一棵地点树。
 * 旧稿无 worldMaps 时按顶层地点 / 设定推断区域名；推断不出才临时用「主地图」。
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

/**
 * 功能注释：补空大地图时优先用顶层地点名 / 设定里的区域称呼，避免无脑「主地图」。
 * 推断不出才回落 DEFAULT_WORLD_MAP_NAME，编辑器应提示创作者改名。
 */
export function inferWorldMapName(opts?: {
  rooms?: Rooms;
  setting?: string;
  title?: string;
}): string {
  const rooms = opts?.rooms ?? {};
  const topNames = Object.values(rooms)
    .filter((r) => !r.parent)
    .map((r) => String(r.name || "").trim())
    .filter(Boolean);
  // 功能注释：大地图是「区域」，不能与某个地点同名（否则大地图与顶层地点一模一样）
  const GENERIC = /^(主地图|新地点|地点|旅馆|厨房|卧室|客厅)$/;
  const ROOM_SUFFIX = /(大堂|大厅|前台|登记台|餐厅|饭厅|厨房|走廊|客房|房间|卧室|客厅|庭院|院子|花园|门口|大门|楼梯|天台|阳台|书房|浴室|洗手间|仓库|地下室|后门|停车场)$/;
  // 1) 多个顶层地点有共同前缀（如「山岚旅馆大堂」「山岚旅馆餐厅」→「山岚旅馆」）
  if (topNames.length > 1) {
    let prefix = topNames[0]!;
    for (const n of topNames.slice(1)) {
      let k = 0;
      while (k < prefix.length && k < n.length && prefix[k] === n[k]) k++;
      prefix = prefix.slice(0, k);
    }
    prefix = prefix.replace(/[的之·\s]+$/, "");
    if (prefix.length >= 2 && !GENERIC.test(prefix)) return prefix;
  }
  // 2) 顶层地点名去掉房间类后缀（「山岚旅馆大堂」→「山岚旅馆」）
  for (const n of topNames) {
    const stripped = n.replace(ROOM_SUFFIX, "").replace(/[的之·\s]+$/, "");
    if (stripped !== n && stripped.length >= 2 && !GENERIC.test(stripped)) return stripped;
  }
  // 3) 顶层地点本身就是区域名（「皇宫」「校园」），且不是房间类名
  const regionLike = topNames.find((n) => !GENERIC.test(n) && !ROOM_SUFFIX.test(n) && n.length <= 12);
  if (regionLike) return regionLike;

  const setting = String(opts?.setting || "").trim();
  // 功能注释：更具体的区域名优先（皇宫/紫禁城 先于 后宫）
  const m = setting.match(/(紫禁城|皇宫|宫廷|王城|校园|学院|经纪公司|片场|星城|海港|宫外|后宫)/);
  if (m?.[1]) return m[1];

  const title = String(opts?.title || "").trim();
  if (title && title.length <= 10 && !GENERIC.test(title)) return title;
  return DEFAULT_WORLD_MAP_NAME;
}

/** 功能注释：库里地点树节点（用 key 表达父子，导入时再换成作品内新 id） */
export type LibraryRoomNode = {
  key: string;
  name: string;
  description?: string;
  imageUrl?: string;
  parentKey?: string | null;
  order?: number;
  /** 功能注释：后台地点库标的点位（百分比）：顶层相对大地图图，子节点相对父节点 innerMapUrl */
  mapX?: number;
  mapY?: number;
  /** 功能注释：本节点的内部地图（子节点在其上标点） */
  innerMapUrl?: string;
};

export type LibraryMapTree = { rooms: LibraryRoomNode[] };

export function newWorldMapId(): string {
  return uid("map");
}

/** 功能注释：保证至少一张大地图；缺 mapId 的地点挂到第一张图上 */
export function ensureWorldMaps(
  rooms: Rooms | undefined,
  maps: WorldMapDef[] | undefined,
  opts?: { setting?: string; title?: string },
): { worldMaps: WorldMapDef[]; rooms: Rooms } {
  const nextRooms: Rooms = { ...(rooms ?? {}) };
  let worldMaps = Array.isArray(maps) ? maps.map((m) => ({ ...m })).filter((m) => m.id && String(m.name || "").trim()) : [];
  if (!worldMaps.length) {
    worldMaps = [{
      id: DEFAULT_WORLD_MAP_ID,
      name: inferWorldMapName({ rooms: nextRooms, setting: opts?.setting, title: opts?.title }),
      order: 0,
    }];
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
      // 功能注释：库里点好的点位与内部地图随整图复制进作品（各层都带）
      ...(typeof n.mapX === "number" && typeof n.mapY === "number" ? { mapX: n.mapX, mapY: n.mapY } : {}),
      ...(String(n.innerMapUrl || "").trim() ? { innerMap: String(n.innerMapUrl).trim() } : {}),
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

/**
 * 功能注释：AI 生成后纠偏大地图：剔除无效图；大地图与地点同名时改成区域名；
 * 子地点跟随父地点所在大地图；缺 mapId 的交给 ensureWorldMaps 挂到首图。
 */
export function healGeneratedWorldMaps(content: { rooms?: Rooms; worldMaps?: WorldMapDef[]; setting?: unknown; title?: unknown }): void {
  const rooms = content.rooms;
  if (!rooms || typeof rooms !== "object") return;
  const raw = Array.isArray(content.worldMaps) ? content.worldMaps : [];
  const seen = new Set<string>();
  const maps: WorldMapDef[] = [];
  raw.forEach((m, i) => {
    const id = String(m?.id ?? "").trim();
    const name = String(m?.name ?? "").trim();
    if (!id || !name || seen.has(id)) return;
    seen.add(id);
    maps.push({ ...m, id, name, order: typeof m.order === "number" ? m.order : i });
  });
  const roomNames = new Set(Object.values(rooms).map((r) => String(r?.name || "").trim()).filter(Boolean));
  for (const m of maps) {
    if (!roomNames.has(m.name)) continue;
    const own = Object.fromEntries(Object.entries(rooms).filter(([, r]) => r.mapId === m.id));
    let next = inferWorldMapName({ rooms: Object.keys(own).length ? own : rooms });
    if (next === DEFAULT_WORLD_MAP_NAME || roomNames.has(next)) next = `${m.name}一带`;
    m.name = next;
  }
  const ids = new Set(maps.map((m) => m.id));
  // 子地点归到父地点的大地图（最多迭代层数次）
  for (let pass = 0; pass < 4; pass++) {
    for (const [id, r] of Object.entries(rooms)) {
      if (r.mapId && !ids.has(r.mapId)) rooms[id] = { ...r, mapId: undefined };
      const par = r.parent ? rooms[r.parent] : undefined;
      if (par?.mapId && par.mapId !== rooms[id].mapId) rooms[id] = { ...rooms[id], mapId: par.mapId };
    }
  }
  if (maps.length) content.worldMaps = maps;
  else delete content.worldMaps;
}
