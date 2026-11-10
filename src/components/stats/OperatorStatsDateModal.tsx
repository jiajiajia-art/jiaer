import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  OPERATOR_METRIC_KEYS,
  type OperatorSortBy,
  type OperatorStatsPreset,
  operatorCustomRangeError,
  operatorMetricLabelKey,
  operatorPresetLabelKey,
  resolveOperatorStatsRange,
} from '../../utils/operatorStatsRange';
import styles from '../../page/operator/OperatorStatsShared.module.css';

const DEFAULT_QUICK_PRESETS: OperatorStatsPreset[] = ['last7', 'last30', 'lastMonth'];

export interface OperatorStatsDateModalSubmit {
  startDate: string;
  endDate: string;
  sortBy?: OperatorSortBy;
}

interface OperatorStatsDateModalProps {
  open: boolean;
  title: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (next: OperatorStatsDateModalSubmit) => void;
  /** 列表自定义：榜单指标；详情仅日期时可省略 */
  sortBy?: OperatorSortBy;
  onSortByChange?: (value: OperatorSortBy) => void;
  showRankMetric?: boolean;
  quickPresets?: OperatorStatsPreset[];
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  submitLabel?: string;
}

const OperatorStatsDateModal: React.FC<OperatorStatsDateModalProps> = ({
  open,
  title,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClose,
  onSubmit,
  sortBy,
  onSortByChange,
  showRankMetric = false,
  quickPresets = DEFAULT_QUICK_PRESETS,
  secondaryAction,
  submitLabel,
}) => {
  const { t } = useTranslation();
  const titleId = useId();

  if (!open) return null;

  const handleSubmit = () => {
    const rangeError = operatorCustomRangeError(startDate, endDate);
    if (rangeError) {
      toast.error(t(`operator.siteStats.customDate${rangeError === 'required' ? 'Required' : 'Invalid'}`));
      return;
    }
    onSubmit({
      startDate,
      endDate,
      ...(showRankMetric && sortBy ? { sortBy } : {}),
    });
  };

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 id={titleId} className={styles.modalTitle}>{title}</h3>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="close">
            ×
          </button>
        </div>

        <div className={styles.modalSection}>
          <span className={styles.modalLabel}>{t('operator.siteStats.timeRange')}</span>
          <div className={styles.dateRangeRow}>
            <input
              className={styles.dateInput}
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
            />
            <span>~</span>
            <input
              className={styles.dateInput}
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
            />
          </div>
        </div>

        {quickPresets.length > 0 ? (
          <div className={styles.modalSection}>
            <span className={styles.modalLabel}>{t('operator.siteStats.quickSelect')}</span>
            <div className={styles.quickRow}>
              {quickPresets.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={styles.presetButton}
                  onClick={() => {
                    const range = resolveOperatorStatsRange(item);
                    onStartDateChange(range.startDate || '');
                    onEndDateChange(range.endDate || '');
                  }}
                >
                  {t(operatorPresetLabelKey(item))}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showRankMetric && sortBy && onSortByChange ? (
          <div className={styles.modalSection}>
            <span className={styles.modalLabel}>{t('operator.siteStats.rankMetric')}</span>
            <div className={styles.metricRadios}>
              {OPERATOR_METRIC_KEYS.map((field) => (
                <label key={field} className={styles.radioItem}>
                  <input
                    type="radio"
                    name="operator-stats-sort"
                    checked={sortBy === field}
                    onChange={() => onSortByChange(field)}
                  />
                  <span>{t(operatorMetricLabelKey(field))}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={secondaryAction ? secondaryAction.onClick : onClose}
          >
            {secondaryAction?.label || t('common.cancel')}
          </button>
          <button type="button" className={styles.primaryButton} onClick={handleSubmit}>
            {submitLabel || t('operator.siteStats.queryRank')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperatorStatsDateModal;
