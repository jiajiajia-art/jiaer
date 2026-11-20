/**
 * 跨周目记录（本机、按作品隔离）：通关次数、达成过的结局、用来通关的线路、任意一局触发过的事件。
 * 人物线路的解锁条件只读这里——建角时还没有本局数值。
 */
import { getWorldId } from "../mods/registry";
import { loadGlobal, saveGlobal } from "./saveScope";
import { isAuthorPreview } from "./authorPreview";
import { isPathLockCond, type PathLockCond } from "./pathDeps";

export type PathProgress = { clears: number; endings: string[]; routes: string[]; events: string[] };
const EMPTY: PathProgress = { clears: 0, endings: [], routes: [], events: [] };
// 功能注释：作者预览的测试局单独记，不污染正式游玩进度；「清空测试存档」时一并清掉
const keyOf = (worldId = getWorldId()) => `${isAuthorPreview() ? "preview-" : ""}path-progress:${worldId || "default"}`;

export function clearPreviewPathProgress() {
  if (isAuthorPreview()) saveGlobal(keyOf(), { ...EMPTY });
}

export function loadPathProgress(worldId?: string): PathProgress {
  const raw = loadGlobal<Partial<PathProgress> | null>(keyOf(worldId), null);
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return { clears: Number(raw.clears) || 0, endings: arr(raw.endings), routes: arr(raw.routes), events: arr(raw.events) };
}

const uniqAdd = (list: string[], add: (string | undefined)[]) => {
  const out = new Set(list);
  for (const x of add) if (x) out.add(x);
  return [...out];
};

/** 功能注释：任意一局里触发过的事件随时并入（不必通关） */
export function recordFiredEvents(ids: string[] | undefined) {
  if (!ids?.length) return;
  const p = loadPathProgress();
  const events = uniqAdd(p.events, ids);
  if (events.length !== p.events.length) saveGlobal(keyOf(), { ...p, events });
}

/** 功能注释：一局走到结局时记一次通关 */
export function recordRunCleared(run: { endingId?: string; routeId?: string; eventsFired?: string[] }) {
  const p = loadPathProgress();
  saveGlobal(keyOf(), {
    clears: p.clears + 1,
    endings: uniqAdd(p.endings, [run.endingId]),
    routes: uniqAdd(p.routes, [run.routeId]),
    events: uniqAdd(p.events, run.eventsFired ?? []),
  });
}

/** 功能注释：线路解锁判定——必须有至少一条条件且全部满足；无条件的未解锁线路只靠作者手动开关 */
export function pathLockMet(conds: unknown, p: PathProgress = loadPathProgress()): boolean {
  const list = (Array.isArray(conds) ? conds : []).filter(isPathLockCond) as PathLockCond[];
  if (!list.length) return false;
  return list.every((c) => {
    if (c.kind === "clear") return p.clears > 0;
    if (c.kind === "ending") return p.endings.includes(c.key);
    if (c.kind === "route") return p.routes.includes(c.key);
    return p.events.includes(c.key);
  });
}
