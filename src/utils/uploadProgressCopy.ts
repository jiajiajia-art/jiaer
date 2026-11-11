/**
 * 功能注释：文档导入 vs 一句话生成共用进度弹窗时的标题/状态文案分流。
 */
import type { UploadJob, UploadJobKind } from '../store/uploadStore';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function resolveUploadProgressTitle(
  jobs: Array<Pick<UploadJob, 'kind'>>,
  t: TranslateFn,
): string {
  if (jobs.length === 0) return t('createGame.uploadProgress');
  const kinds = new Set(jobs.map((j) => j.kind || 'document'));
  if (kinds.size === 1 && kinds.has('idea')) {
    return t('createGame.ideaProgress');
  }
  if (kinds.size === 1 && kinds.has('document')) {
    return t('createGame.uploadProgress');
  }
  return t('createGame.taskProgress');
}

export function resolveUploadJobStatusLabel(
  job: Pick<UploadJob, 'kind' | 'status'>,
  t: TranslateFn,
): string {
  const kind: UploadJobKind = job.kind || 'document';
  switch (job.status) {
    case 'uploading':
      return kind === 'idea' ? t('createGame.inQueue') : t('createGame.statusUpload');
    case 'processing':
      return kind === 'idea' ? t('createGame.statusGenerating') : t('createGame.statusParsing');
    case 'completed':
      return t('createGame.statusComplete');
    case 'failed':
      return t('createGame.statusFailed');
    default:
      return t('createGame.statusProcessing');
  }
}
