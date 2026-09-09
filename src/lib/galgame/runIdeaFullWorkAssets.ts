/**
 * 一句话「完整作品」：文本 job 成功后按勾选接力批量立绘 / 场景 / 封面。
 */
import EditorApi from '../../api/galgame/EditorData';
import {
  BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS,
  resolveBatchImageJobPollStep,
  resolveBatchImageJobProgressCounts,
  type BatchImageJobProgressCounts,
} from '../../utils/batchImageJobPoll';
import {
  editorAssetImageCountsFromEditorData,
  reconcileJobCountsWithEditorImages,
} from './assetCompleteness';
import type { IdeaAssetFlags } from './ideaFullWorkEstimate';
import {
  createInitialIdeaAssetProgress,
  patchIdeaAssetPhase,
  publishIdeaAssetProgress,
  peekIdeaAssetProgress,
  type IdeaAssetPhaseRow,
  type IdeaAssetPhaseState,
  type IdeaFullWorkAssetPhase,
} from './ideaFullWorkProgress';
import { resolveIdeaAssetPhaseAction } from './ideaFullWorkResume';

const POLL_INTERVAL_MS = 1500;

export type { IdeaFullWorkAssetPhase };

export interface IdeaFullWorkAssetResult {
  portraitsOk: boolean;
  scenesOk: boolean;
  coverOk: boolean;
  errors: string[];
  /** 已有进行中的编排时复用同一 Promise，调用方勿再 toast/改横幅 */
  joinedExisting?: boolean;
}

/** 同 fileId 共用进行中的 Promise，避免文本完成竞态双开 / 误判失败 */
const inflightFullWorkByFileId = new Map<string, Promise<IdeaFullWorkAssetResult>>();

export interface IdeaFullWorkProgressEvent {
  phase: IdeaFullWorkAssetPhase;
  state: 'starting' | 'running' | 'done' | 'failed';
  completed?: number;
  total?: number;
  failed?: number;
  detail?: string;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function errMessage(err: unknown, fallback: string): string {
  const anyErr = err as {
    message?: string;
    response?: { data?: { message?: string; error?: string } };
  };
  return (
    anyErr?.response?.data?.message
    || anyErr?.response?.data?.error
    || anyErr?.message
    || fallback
  );
}

/**
 * 功能注释：拉取 editor complete，用真实场景/立绘张数校准进度（对齐侧栏「待上传」）。
 */
async function reconcilePhaseWithEditorData(
  fileId: string,
  phase: 'portraits' | 'scenes',
  job: { successCount: number; failedCount: number; totalCount: number },
  assets: IdeaAssetFlags,
): Promise<{ completed: number; failed: number; total: number; state: IdeaAssetPhaseState }> {
  try {
    const res = await EditorApi.getEditorData(fileId);
    const counts = editorAssetImageCountsFromEditorData(res.data as Parameters<typeof editorAssetImageCountsFromEditorData>[0]);
    const reconciled = reconcileJobCountsWithEditorImages({
      jobSuccess: job.successCount,
      jobFailed: job.failedCount,
      jobTotal: job.totalCount,
      editorPresent: phase === 'scenes' ? counts.scenesPresent : counts.portraitsPresent,
      editorTotal: phase === 'scenes' ? counts.scenesTotal : counts.portraitsTotal,
    });
    const state: IdeaAssetPhaseState = reconciled.failed > 0 || reconciled.completed < reconciled.total
      ? 'failed'
      : 'done';
    patchIdeaAssetPhase(fileId, phase, {
      state,
      completed: reconciled.completed,
      failed: reconciled.failed,
      total: reconciled.total,
    }, assets);
    return { ...reconciled, state };
  } catch (err) {
    console.warn('[runIdeaFullWorkAssets] reconcile with editor failed:', err);
    const failed = job.failedCount > 0 || (job.totalCount > 0 && job.successCount < job.totalCount);
    const state: IdeaAssetPhaseState = failed ? 'failed' : 'done';
    patchIdeaAssetPhase(fileId, phase, {
      state,
      completed: job.successCount,
      failed: job.failedCount,
      total: job.totalCount,
    }, assets);
    return {
      completed: job.successCount,
      failed: job.failedCount,
      total: job.totalCount,
      state,
    };
  }
}

export interface PollBatchImageJobResult {
  status: 'completed' | 'failed' | 'timeout';
  counts: BatchImageJobProgressCounts;
}

/**
 * 功能注释：轮询 visual 批量生图 job；进度只回写成功落盘张数，失败另计。
 */
async function pollBatchImageJob(
  jobId: string,
  onTick?: (counts: BatchImageJobProgressCounts) => void,
): Promise<PollBatchImageJobResult> {
  let lastCounts: BatchImageJobProgressCounts = {
    successCount: 0,
    failedCount: 0,
    totalCount: 0,
    settledCount: 0,
  };

  for (let attempt = 0; attempt < BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS; attempt += 1) {
    const res = await EditorApi.getGenerateAllImagesJobStatus(jobId);
    const data = res.data as {
      status?: string;
      completedCount?: number;
      totalCount?: number;
      failedCount?: number;
      savedResults?: unknown;
      items?: Array<{ stage?: string }>;
      result?: {
        results?: { effectiveSuccessful?: number };
        scenes?: { effective?: number };
        npcs?: { effective?: number };
        player?: { effective?: number };
      };
    };
    lastCounts = resolveBatchImageJobProgressCounts(data);
    onTick?.(lastCounts);

    // 功能注释：一句话完整作品路径禁止 board_settled 提前停轮询——
    // 否则最后一张刚落盘、job 仍 running 时前端退出，后端来不及 finalize，背景已出却不扣积分。
    const step = resolveBatchImageJobPollStep({
      cancelRequested: false,
      status: String(data?.status || 'running'),
      attempt,
      boardSettledWithFailures: false,
    });
    if (step === 'completed') {
      // job completed 仍可能部分失败：成功数 < 总数则视为 failed
      if (lastCounts.failedCount > 0 || (
        lastCounts.totalCount > 0 && lastCounts.successCount < lastCounts.totalCount
      )) {
        return { status: 'failed', counts: lastCounts };
      }
      return { status: 'completed', counts: lastCounts };
    }
    if (step === 'failed') {
      return { status: 'failed', counts: lastCounts };
    }
    if (step === 'timeout') return { status: 'timeout', counts: lastCounts };
    await sleep(POLL_INTERVAL_MS);
  }
  return { status: 'timeout', counts: lastCounts };
}

type BatchPhaseStartBody = {
  generateNPCs: boolean;
  generatePlayer: boolean;
  generateScenes: boolean;
  generateVariants: boolean;
  removeBg: boolean;
  pluginType: 'visual';
};

/**
 * 功能注释：按阶段 skip / 轮询已有 job / 新开任务。已完成或失败不 POST start，避免切页把已有图重生成。
 */
async function runBatchImagePhase(options: {
  fileId: string;
  assets: IdeaAssetFlags;
  phase: 'portraits' | 'scenes';
  enabled: boolean;
  startBody: BatchPhaseStartBody;
  failLabel: string;
  onProgress?: (event: IdeaFullWorkProgressEvent) => void;
  result: IdeaFullWorkAssetResult;
  resultKey: 'portraitsOk' | 'scenesOk';
}): Promise<void> {
  const { fileId, assets, phase, enabled, startBody, failLabel, onProgress, result, resultKey } = options;
  if (!enabled) return;

  const row: IdeaAssetPhaseRow | undefined = peekIdeaAssetProgress(fileId)?.[phase];
  const action = resolveIdeaAssetPhaseAction(true, row);
  if (action === 'skip') {
    result[resultKey] = row?.state !== 'failed';
    if (row?.state === 'failed') {
      result.errors.push(
        row.failed && row.total
          ? `${failLabel}仅成功 ${row.completed}/${row.total} 张`
          : `${failLabel}未完成`,
      );
    }
    return;
  }

  onProgress?.({ phase, state: 'starting' });
  const keepCompleted = Number(row?.completed) || 0;
  const keepTotal = Number(row?.total) || 0;
  const keepFailed = Number(row?.failed) || 0;
  patchIdeaAssetPhase(fileId, phase, {
    state: 'active',
    completed: keepCompleted,
    total: keepTotal,
    failed: keepFailed,
    ...(row?.jobId ? { jobId: row.jobId } : {}),
  }, assets);

  try {
    let jobId = action === 'poll' ? String(row?.jobId || '').trim() : '';
    let bootstrapTotal = keepTotal;
    if (!jobId) {
      const start = await EditorApi.startGenerateAllImages(fileId, startBody);
      const payload = start.data as {
        success?: boolean;
        jobId?: string;
        message?: string;
        error?: string;
        totalCount?: number;
      };
      if (!payload?.success || !payload.jobId) {
        result[resultKey] = false;
        result.errors.push(payload?.message || payload?.error || `${failLabel}任务启动失败`);
        patchIdeaAssetPhase(fileId, phase, { state: 'failed' }, assets);
        onProgress?.({ phase, state: 'failed' });
        return;
      }
      jobId = String(payload.jobId);
      bootstrapTotal = Number(payload.totalCount) || keepTotal;
      patchIdeaAssetPhase(fileId, phase, {
        state: 'active',
        jobId,
        total: bootstrapTotal || keepTotal,
        completed: keepCompleted,
        failed: keepFailed,
      }, assets);
    }

    const poll = await pollBatchImageJob(jobId, (counts) => {
      patchIdeaAssetPhase(fileId, phase, {
        state: 'active',
        jobId,
        completed: counts.successCount,
        failed: counts.failedCount,
        total: counts.totalCount || bootstrapTotal,
      }, assets);
      onProgress?.({
        phase,
        state: 'running',
        completed: counts.successCount,
        failed: counts.failedCount,
        total: counts.totalCount || bootstrapTotal,
      });
    });
    const reconciled = await reconcilePhaseWithEditorData(fileId, phase, {
      successCount: poll.counts.successCount,
      failedCount: poll.counts.failedCount,
      totalCount: poll.counts.totalCount || bootstrapTotal,
    }, assets);
    result[resultKey] = reconciled.state === 'done';
    onProgress?.({
      phase,
      state: result[resultKey] ? 'done' : 'failed',
      completed: reconciled.completed,
      failed: reconciled.failed,
      total: reconciled.total,
      detail: poll.status,
    });
    if (!result[resultKey]) {
      result.errors.push(
        reconciled.failed > 0
          ? `${failLabel}仅成功 ${reconciled.completed}/${reconciled.total} 张`
          : `${failLabel}生成未完成（${poll.status}）`,
      );
    }
  } catch (err) {
    result[resultKey] = false;
    result.errors.push(errMessage(err, `${failLabel}生成失败`));
    patchIdeaAssetPhase(fileId, phase, { state: 'failed' }, assets);
    onProgress?.({ phase, state: 'failed' });
  }
}

/**
 * 功能注释：是否已有进行中的完整作品生图编排（续跑 effect 避让上传回调）。
 */
export function isIdeaFullWorkAssetsInflight(fileId: string): boolean {
  return Boolean(fileId) && inflightFullWorkByFileId.has(fileId);
}

/**
 * 功能注释：文本生成完成后，按用户勾选依次启动角色立绘、场景背景、封面生图，并发布进度。
 * 同 fileId 并发调用会 await 同一任务，避免「已在进行中」被当成失败、横幅打成素材待补齐。
 */
export async function runIdeaFullWorkAssets(
  fileId: string,
  assets: IdeaAssetFlags,
  onProgress?: (event: IdeaFullWorkProgressEvent) => void,
): Promise<IdeaFullWorkAssetResult> {
  if (!fileId) {
    return {
      portraitsOk: false,
      scenesOk: false,
      coverOk: false,
      errors: ['缺少 fileId'],
    };
  }

  const existing = inflightFullWorkByFileId.get(fileId);
  if (existing) {
    const joined = await existing;
    return { ...joined, joinedExisting: true };
  }

  const task = (async (): Promise<IdeaFullWorkAssetResult> => {
    const result: IdeaFullWorkAssetResult = {
      portraitsOk: true,
      scenesOk: true,
      coverOk: true,
      errors: [],
    };
    return runIdeaFullWorkAssetsInner(fileId, assets, onProgress, result);
  })();

  inflightFullWorkByFileId.set(fileId, task);
  try {
    return await task;
  } finally {
    if (inflightFullWorkByFileId.get(fileId) === task) {
      inflightFullWorkByFileId.delete(fileId);
    }
  }
}

async function runIdeaFullWorkAssetsInner(
  fileId: string,
  assets: IdeaAssetFlags,
  onProgress: ((event: IdeaFullWorkProgressEvent) => void) | undefined,
  result: IdeaFullWorkAssetResult,
): Promise<IdeaFullWorkAssetResult> {
  const base = peekIdeaAssetProgress(fileId) || createInitialIdeaAssetProgress(fileId, assets);
  publishIdeaAssetProgress({ ...base, flags: { ...assets }, phase: base.phase === 'idle' ? 'idle' : base.phase });

  await runBatchImagePhase({
    fileId,
    assets,
    phase: 'portraits',
    enabled: assets.portraits,
    startBody: {
      generateNPCs: true,
      generatePlayer: true,
      generateScenes: false,
      generateVariants: false,
      removeBg: true,
      pluginType: 'visual',
    },
    failLabel: '角色立绘',
    onProgress,
    result,
    resultKey: 'portraitsOk',
  });

  await runBatchImagePhase({
    fileId,
    assets,
    phase: 'scenes',
    enabled: assets.scenes,
    startBody: {
      generateNPCs: false,
      generatePlayer: false,
      generateScenes: true,
      generateVariants: false,
      removeBg: false,
      pluginType: 'visual',
    },
    failLabel: '场景背景',
    onProgress,
    result,
    resultKey: 'scenesOk',
  });

  if (assets.cover) {
    const coverRow = peekIdeaAssetProgress(fileId)?.cover;
    const coverAction = resolveIdeaAssetPhaseAction(true, coverRow);
    if (coverAction === 'skip') {
      result.coverOk = coverRow?.state !== 'failed';
      if (coverRow?.state === 'failed') {
        result.errors.push('封面生成失败');
      }
    } else {
      onProgress?.({ phase: 'cover', state: 'starting' });
      patchIdeaAssetPhase(fileId, 'cover', { state: 'active', completed: 0, total: 1 }, assets);
      try {
        const coverRes = await EditorApi.generateGameCover(fileId, {});
        const ok = Boolean((coverRes.data as { success?: boolean })?.success);
        result.coverOk = ok;
        patchIdeaAssetPhase(
          fileId,
          'cover',
          { state: ok ? 'done' : 'failed', completed: ok ? 1 : 0, total: 1 },
          assets,
        );
        onProgress?.({ phase: 'cover', state: ok ? 'done' : 'failed' });
        if (!ok) {
          result.errors.push(
            (coverRes.data as { message?: string; error?: string })?.message
            || (coverRes.data as { error?: string })?.error
            || '封面生成失败',
          );
        }
      } catch (err) {
        result.coverOk = false;
        result.errors.push(errMessage(err, '封面生成失败'));
        patchIdeaAssetPhase(fileId, 'cover', { state: 'failed' }, assets);
        onProgress?.({ phase: 'cover', state: 'failed' });
      }
    }
  }

  const final = peekIdeaAssetProgress(fileId);
  if (final) {
    publishIdeaAssetProgress({ ...final, phase: 'done' });
  }

  return result;
}
