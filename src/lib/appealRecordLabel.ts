import type { TFunction } from 'i18next';
import i18n from '../i18n';

const LEVEL_WORD_ZH = ['', '一', '二', '三', '四'] as const;

/** 功能注释：申诉列表 / 选择目标展示类型文案，不带记录 id */
export function formatAppealRecordTitle(
  t: TFunction,
  recordType?: string | null,
  level?: number | null,
): string {
  const type = String(recordType || '').trim();
  if (type === 'warning') return t('appeal.recordWarning');
  if (type === 'appeal') return t('appeal.recordAppeal');
  if (type === 'penalty') {
    if (level != null && level >= 1 && level <= 4) {
      const n = String(i18n.language || '').startsWith('zh')
        ? LEVEL_WORD_ZH[level]
        : String(level);
      return t('appeal.recordPenaltyLevel', { n });
    }
    return t('appeal.recordPenalty');
  }
  return type || t('appeal.targetFallback');
}
