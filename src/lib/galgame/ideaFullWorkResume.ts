/**
 * 完整作品生图：何时续跑编排、某阶段是跳过 / 接续轮询 / 新开任务。
 * 切左侧菜单不得新开批量生图；失败也不自动把已有图重生成。
 */
import type { IdeaAssetGenStatus } from './ideaFullWorkSession';
import type { IdeaAssetPhaseRow } from './ideaFullWorkProgress';

export type IdeaAssetPhaseAction = 'skip' | 'poll' | 'start';

export interface ShouldResumeIdeaFullWorkInput {
  hasFlags: boolean;
  inflight: boolean;
  status: IdeaAssetGenStatus | null;
}

/**
 * 功能注释：仅「从未启动的 pending」可自动开跑。
 * running 表示上传回调或本页编排已接管；failed 应由用户在角色/场景页手动补齐。
 */
export function shouldResumeIdeaFullWorkOrchestration(
  input: ShouldResumeIdeaFullWorkInput,
): boolean {
  if (!input.hasFlags || input.inflight) return false;
  return input.status === 'pending';
}

/**
 * 功能注释：已完成/失败/未勾选不新开任务；已有 jobId 且仍在进行则只轮询，禁止再 POST /all/start。
 */
export function resolveIdeaAssetPhaseAction(
  enabled: boolean,
  row?: Pick<IdeaAssetPhaseRow, 'state' | 'jobId'> | null,
): IdeaAssetPhaseAction {
  if (!enabled) return 'skip';
  if (!row || row.state === 'skipped') return 'skip';
  if (row.state === 'done' || row.state === 'failed') return 'skip';
  const jobId = typeof row.jobId === 'string' ? row.jobId.trim() : '';
  if (jobId && (row.state === 'active' || row.state === 'pending')) return 'poll';
  return 'start';
}
