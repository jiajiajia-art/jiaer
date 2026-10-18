import type { TFunction } from 'i18next';

const LEVEL_WORD = ['', '一', '二', '三', '四'] as const;

/** 功能注释：申诉列表 / 选择目标用中文标题，不展示 #id */
export function formatAppealRecordTitle(
  t: TFunction,
  recordType?: string | null,
  level?: number | null,
): string {
  if (recordType === 'warning') return t('appeal.recordWarning');
  if (recordType === 'penalty') {
    if (level != null && level >= 1 && level <= 4) {
      return t('appeal.recordPenaltyLevel', { level: LEVEL_WORD[level] });
    }
    return t('appeal.recordPenalty');
  }
  if (recordType === 'appeal') return t('appeal.recordAppeal');
  return String(recordType || '').trim() || t('appeal.targetFallback');
}
