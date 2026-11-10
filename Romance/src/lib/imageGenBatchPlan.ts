/**
 * 功能注释：C1.1 批量生图的「选范围 → 组任务 → 回写结果」纯逻辑。
 * UI（ModBatchImageGen）只负责勾选与进度展示；本文件不碰网络 / DOM，便于单测。
 * 实际逐张请求仍走 imageGenBatch.runImageGenBatch → generatePlatformImage，不另起网关。
 */
import type { BatchImageJob, BatchImageJobResult } from "./imageGenBatchCore.ts";
import {
  LOCATION_SCENE_GEN_SIZE,
  WORLD_MAP_GEN_SIZE,
  buildLocationScenePromptParts,
  buildWorldMapPromptParts,
  composePositivePrompt,
  type WorkImageStyleSettings,
} from "./editorImagePrompts.ts";

/** 功能注释：批量范围——当前大地图无图地点 / 全部大地图无图地点 / 手动勾选的地点 */
export type BatchScope = "map-empty" | "all-empty" | "selected";

export const BATCH_SCOPE_LABEL: Record<BatchScope, string> = {
  "map-empty": "当前大地图 · 无图地点",
  "all-empty": "所有大地图 · 无图地点",
  selected: "手动勾选地点",
};

/** 功能注释：批量任务 id 前缀；回写时靠前缀分辨地点图与大地图图 */
export const BATCH_ROOM_PREFIX = "room:";
export const BATCH_MAP_PREFIX = "map:";

type RoomLike = { name?: string; scenePrompt?: string; bg?: string; mapId?: string };
type MapLike = { id: string; name?: string; desc?: string; bg?: string };

const DEFAULT_MAP_ID = "map_main";
const hasImage = (u?: string | null) => Boolean(String(u ?? "").trim());
const mapIdOfRoom = (r: RoomLike) => r.mapId || DEFAULT_MAP_ID;

/** 功能注释：按范围挑出要处理的地点 id；selected 范围只认仍存在的勾选项（有图的由 fillEmptyOnly 在队列里跳过） */
export function pickBatchRoomIds(opts: {
  scope: BatchScope;
  rooms: Record<string, RoomLike>;
  curMapId: string;
  selectedIds?: Iterable<string>;
}): string[] {
  const { scope, rooms, curMapId } = opts;
  if (scope === "selected") {
    const out: string[] = [];
    for (const id of opts.selectedIds ?? []) if (rooms[id] && !out.includes(id)) out.push(id);
    return out;
  }
  return Object.keys(rooms).filter((id) => {
    const r = rooms[id];
    if (hasImage(r.bg)) return false;
    return scope === "all-empty" ? true : mapIdOfRoom(r) === curMapId;
  });
}

/** 功能注释：组装批量任务（地点图 + 可选大地图图）；复用三层提示词构造器，主体为空的项剔除并计入 skippedNoPrompt */
export function buildBatchJobs(opts: {
  scope: BatchScope;
  rooms: Record<string, RoomLike>;
  maps: MapLike[];
  curMapId: string;
  selectedIds?: Iterable<string>;
  /** 是否连同大地图图一起生成 */
  includeMapImages?: boolean;
  settings?: WorkImageStyleSettings;
}): { jobs: BatchImageJob[]; skippedNoPrompt: number } {
  const settings = opts.settings ?? {};
  const jobs: BatchImageJob[] = [];
  let skippedNoPrompt = 0;

  // 功能注释：大地图任务排在地点之前——先出区域图
  if (opts.includeMapImages) {
    const targetMaps = opts.scope === "all-empty" ? opts.maps : opts.maps.filter((m) => m.id === opts.curMapId);
    for (const m of targetMaps) {
      if (opts.scope !== "selected" && hasImage(m.bg)) continue;
      const places = Object.values(opts.rooms)
        .filter((r) => mapIdOfRoom(r) === m.id)
        .map((r) => r.name || "");
      const parts = buildWorldMapPromptParts({ name: m.name, places, desc: m.desc }, settings);
      const prompt = composePositivePrompt(parts);
      if (!prompt) { skippedNoPrompt += 1; continue; }
      jobs.push({
        id: `${BATCH_MAP_PREFIX}${m.id}`,
        label: `大地图 · ${m.name || m.id}`,
        prompt,
        size: WORLD_MAP_GEN_SIZE,
        negativePrompt: parts.negative || undefined,
        existingUrl: m.bg,
      });
    }
  }

  for (const id of pickBatchRoomIds(opts)) {
    const r = opts.rooms[id];
    const parts = buildLocationScenePromptParts({ name: r.name, scenePrompt: r.scenePrompt }, settings);
    const prompt = composePositivePrompt(parts);
    if (!prompt) { skippedNoPrompt += 1; continue; }
    jobs.push({
      id: `${BATCH_ROOM_PREFIX}${id}`,
      label: r.name || id,
      prompt,
      size: LOCATION_SCENE_GEN_SIZE,
      negativePrompt: parts.negative || undefined,
      existingUrl: r.bg,
    });
  }
  return { jobs, skippedNoPrompt };
}

export type BatchApplyPatch = { roomBg: Record<string, string>; mapBg: Record<string, string> };

/** 功能注释：从结果里取出成功项（done 且有 url），按地点 / 大地图分桶，供一次性回写 */
export function collectBatchApplyPatch(results: BatchImageJobResult[]): BatchApplyPatch {
  const patch: BatchApplyPatch = { roomBg: {}, mapBg: {} };
  for (const r of results) {
    if (r.status !== "done" || !r.url) continue;
    if (r.id.startsWith(BATCH_ROOM_PREFIX)) patch.roomBg[r.id.slice(BATCH_ROOM_PREFIX.length)] = r.url;
    else if (r.id.startsWith(BATCH_MAP_PREFIX)) patch.mapBg[r.id.slice(BATCH_MAP_PREFIX.length)] = r.url;
  }
  return patch;
}

/** 功能注释：把补丁写进地点表 / 大地图表（不可变更新；补丁里已不存在的 id 忽略，避免批量期间用户删点后复活） */
export function applyBatchPatch<R extends RoomLike, M extends MapLike>(
  rooms: Record<string, R>,
  maps: M[],
  patch: BatchApplyPatch,
): { rooms: Record<string, R>; maps: M[]; changed: number } {
  let changed = 0;
  const nextRooms: Record<string, R> = { ...rooms };
  for (const [id, url] of Object.entries(patch.roomBg)) {
    if (!nextRooms[id]) continue;
    nextRooms[id] = { ...nextRooms[id], bg: url };
    changed += 1;
  }
  const nextMaps = maps.map((m) => {
    const url = patch.mapBg[m.id];
    if (!url) return m;
    changed += 1;
    return { ...m, bg: url };
  });
  return { rooms: nextRooms, maps: nextMaps, changed };
}

export type BatchSummary = {
  total: number;
  pending: number;
  running: number;
  done: number;
  failed: number;
  skipped: number;
  aborted: number;
};

/** 功能注释：统计各状态条数，供进度条 / 按钮可用态判断 */
export function summarizeBatch(results: BatchImageJobResult[]): BatchSummary {
  const s: BatchSummary = { total: results.length, pending: 0, running: 0, done: 0, failed: 0, skipped: 0, aborted: 0 };
  for (const r of results) s[r.status] += 1;
  return s;
}

export const BATCH_STATUS_LABEL: Record<BatchImageJobResult["status"], string> = {
  pending: "等待",
  running: "生成中",
  done: "完成",
  failed: "失败",
  skipped: "已跳过",
  aborted: "已中止",
};
