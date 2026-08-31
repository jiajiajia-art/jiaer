/**
 * 一句话「完整作品」：文本 job 成功后按勾选接力批量立绘 / 场景 / 封面。
 */
import EditorApi from '../../api/galgame/EditorData';
import {
  BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS,
  resolveBatchImageJobPollStep,
} from '../../utils/batchImageJobPoll';
import type { IdeaAssetFlags } from './ideaFullWorkEstimate';

const POLL_INTERVAL_MS = 1500;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 功能注释：轮询 visual 批量生图 job 至终态（完成/失败/超时）。
 */
async function pollBatchImageJob(jobId: string): Promise<'completed' | 'failed' | 'timeout'> {
  for (let attempt = 0; attempt < BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS; attempt += 1) {
    const res = await EditorApi.getGenerateAllImagesJobStatus(jobId);
    const data = res.data as { status?: string };
    const step = resolveBatchImageJobPollStep({
      cancelRequested: false,
      status: String(data?.status || 'running'),
      attempt,
    });
    if (step === 'completed') return 'completed';
    if (step === 'failed' || step === 'board_settled_retry') return 'failed';
    if (step === 'timeout') return 'timeout';
    await sleep(POLL_INTERVAL_MS);
  }
  return 'timeout';
}

/**
 * 功能注释：文本生成完成后，按用户勾选依次启动角色立绘、场景背景、封面生图。
 */
export async function runIdeaFullWorkAssets(
  fileId: string,
  assets: IdeaAssetFlags,
): Promise<{ portraitsOk: boolean; scenesOk: boolean; coverOk: boolean }> {
  const result = { portraitsOk: true, scenesOk: true, coverOk: true };

  if (assets.portraits) {
    try {
      const start = await EditorApi.startGenerateAllImages(fileId, {
        generateNPCs: true,
        generatePlayer: true,
        generateScenes: false,
        generateVariants: false,
        removeBg: true,
        pluginType: 'visual',
      });
      const payload = start.data as { success?: boolean; jobId?: string; message?: string; error?: string };
      if (!payload?.success || !payload.jobId) {
        result.portraitsOk = false;
      } else {
        const status = await pollBatchImageJob(String(payload.jobId));
        result.portraitsOk = status === 'completed';
      }
    } catch {
      result.portraitsOk = false;
    }
  }

  if (assets.scenes) {
    try {
      const start = await EditorApi.startGenerateAllImages(fileId, {
        generateNPCs: false,
        generatePlayer: false,
        generateScenes: true,
        generateVariants: false,
        removeBg: false,
        pluginType: 'visual',
      });
      const payload = start.data as { success?: boolean; jobId?: string };
      if (!payload?.success || !payload.jobId) {
        result.scenesOk = false;
      } else {
        const status = await pollBatchImageJob(String(payload.jobId));
        result.scenesOk = status === 'completed';
      }
    } catch {
      result.scenesOk = false;
    }
  }

  if (assets.cover) {
    try {
      const coverRes = await EditorApi.generateGameCover(fileId, {});
      const ok = Boolean((coverRes.data as { success?: boolean })?.success);
      result.coverOk = ok;
    } catch {
      result.coverOk = false;
    }
  }

  return result;
}
