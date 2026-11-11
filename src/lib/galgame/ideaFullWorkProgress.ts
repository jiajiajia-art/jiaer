/**
 * 完整作品生图进度快照：供横幅分阶段展示与刷新恢复。
 */
import type { EditorAssetImageCounts } from './assetCompleteness';
import type { IdeaAssetFlags } from './ideaFullWorkEstimate';

export type IdeaFullWorkAssetPhase = 'portraits' | 'scenes' | 'cover';

export const IDEA_ASSET_PROGRESS_EVENT = 'idea-full-work-progress';

const PROGRESS_PREFIX = 'idea-full-work-progress:';

export type IdeaAssetPhaseState = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

export type IdeaAssetPhaseRow = {
  state: IdeaAssetPhaseState;
  completed: number;
  total: number;
  failed?: number;
  /** 已启动的 visual 批量 job，续跑只轮询此 id，禁止再 start */
  jobId?: string;
};

export interface IdeaAssetProgressSnapshot {
  fileId: string;
  /** 当前活跃阶段 */
  phase: IdeaFullWorkAssetPhase | 'idle' | 'done';
  flags: IdeaAssetFlags;
  portraits: IdeaAssetPhaseRow;
  scenes: IdeaAssetPhaseRow;
  cover: IdeaAssetPhaseRow;
  /** 0–100 整体进度 */
  percent: number;
  updatedAt: number;
}

/**
 * 功能注释：用编辑器真实张数校准进度行；进行中缺口不算失败，避免 pending 场景显示「失败 N」。
 */
export function mergeAssetProgressRowWithLiveCounts(
  phase: IdeaFullWorkAssetPhase,
  row: IdeaAssetPhaseRow | undefined,
  live: EditorAssetImageCounts | null | undefined,
): IdeaAssetPhaseRow | undefined {
  if (!row) return row;
  if (!live) return row;

  const inFlight = row.state === 'pending' || row.state === 'skipped' || row.state === 'active';

  if (phase === 'portraits' && live.portraitsTotal > 0) {
    const completed = live.portraitsPresent;
    const total = Math.max(row.total, live.portraitsTotal);
    const failed = inFlight
      ? Math.max(0, Number(row.failed) || 0)
      : Math.max(0, total - completed);
    const state: IdeaAssetPhaseState = inFlight
      ? row.state
      : (failed > 0 ? 'failed' : 'done');
    return { ...row, completed, total, failed, state };
  }

  if (phase === 'scenes' && live.scenesTotal > 0) {
    const completed = live.scenesPresent;
    const total = Math.max(row.total, live.scenesTotal);
    const failed = inFlight
      ? Math.max(0, Number(row.failed) || 0)
      : Math.max(0, total - completed);
    const state: IdeaAssetPhaseState = inFlight
      ? row.state
      : (failed > 0 ? 'failed' : 'done');
    return { ...row, completed, total, failed, state };
  }

  if (phase === 'cover') {
    const completed = live.coverPresent ? 1 : 0;
    const total = Math.max(row.total, 1);
    const failed = inFlight ? 0 : Math.max(0, total - completed);
    const state: IdeaAssetPhaseState = inFlight
      ? row.state
      : (failed > 0 ? 'failed' : 'done');
    return { ...row, completed, total, failed, state };
  }

  return row;
}

function progressKey(fileId: string): string {
  return `${PROGRESS_PREFIX}${fileId}`;
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * 功能注释：按勾选计算整体百分比（文本已完成后立绘/场景/封面均分权重）。
 */
export function computeIdeaAssetPercent(snapshot: Pick<
  IdeaAssetSnapshotLike,
  'flags' | 'portraits' | 'scenes' | 'cover' | 'phase'
>): number {
  const weights: Array<{ key: 'portraits' | 'scenes' | 'cover'; w: number }> = [];
  if (snapshot.flags.portraits) weights.push({ key: 'portraits', w: 1 });
  if (snapshot.flags.scenes) weights.push({ key: 'scenes', w: 1 });
  if (snapshot.flags.cover) weights.push({ key: 'cover', w: 1 });
  if (weights.length === 0) return 100;

  const unit = 100 / weights.length;
  let sum = 0;
  for (const { key, w } of weights) {
    const row = snapshot[key];
    if (row.state === 'done') {
      sum += unit * w;
      continue;
    }
    if (row.state === 'failed' || row.state === 'skipped') {
      sum += unit * w;
      continue;
    }
    if (row.state === 'active' && row.total > 0) {
      sum += unit * w * Math.min(1, row.completed / row.total);
    }
  }
  if (snapshot.phase === 'done') return 100;
  return Math.max(0, Math.min(99, Math.round(sum)));
}

type IdeaAssetSnapshotLike = IdeaAssetProgressSnapshot;

/** 功能注释：初始化「文本已完成 → 按勾选排队」进度快照。 */
export function createInitialIdeaAssetProgress(
  fileId: string,
  flags: IdeaAssetFlags,
): IdeaAssetProgressSnapshot {
  const skip = (on: boolean): IdeaAssetPhaseState => (on ? 'pending' : 'skipped');
  const snap: IdeaAssetProgressSnapshot = {
    fileId,
    phase: 'idle',
    flags: { ...flags },
    portraits: { state: skip(flags.portraits), completed: 0, total: 0 },
    scenes: { state: skip(flags.scenes), completed: 0, total: 0 },
    cover: { state: skip(flags.cover), completed: 0, total: flags.cover ? 1 : 0 },
    percent: 0,
    updatedAt: Date.now(),
  };
  snap.percent = computeIdeaAssetPercent(snap);
  return snap;
}

export function publishIdeaAssetProgress(snapshot: IdeaAssetProgressSnapshot): void {
  const next = {
    ...snapshot,
    percent: computeIdeaAssetPercent(snapshot),
    updatedAt: Date.now(),
  };
  safeSet(progressKey(snapshot.fileId), JSON.stringify(next));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(IDEA_ASSET_PROGRESS_EVENT, { detail: next }));
  }
}

export function peekIdeaAssetProgress(fileId: string): IdeaAssetProgressSnapshot | null {
  if (!fileId) return null;
  const raw = safeGet(progressKey(fileId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IdeaAssetProgressSnapshot;
  } catch {
    return null;
  }
}

export function clearIdeaAssetProgress(fileId: string): void {
  if (!fileId) return;
  safeRemove(progressKey(fileId));
}

/**
 * 功能注释：把当前阶段推进为 active，并写入可选 total。
 */
export function patchIdeaAssetPhase(
  fileId: string,
  phase: IdeaFullWorkAssetPhase,
  patch: Partial<{ state: IdeaAssetPhaseState; completed: number; total: number; failed: number; jobId: string }>,
  flags?: IdeaAssetFlags,
): IdeaAssetProgressSnapshot | null {
  const prev = peekIdeaAssetProgress(fileId)
    || (flags ? createInitialIdeaAssetProgress(fileId, flags) : null);
  if (!prev) return null;
  const next: IdeaAssetProgressSnapshot = {
    ...prev,
    phase,
    [phase]: {
      ...prev[phase],
      ...patch,
    },
  };
  publishIdeaAssetProgress(next);
  return next;
}
