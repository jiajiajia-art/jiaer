import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OperatorDeltaRatio, OperatorWorkMetrics } from '../../api/stats/operatorStatsApi';
import {
  formatOperatorDeltaRatio,
  formatOperatorPlayDuration,
  OPERATOR_METRIC_KEYS,
  operatorMetricLabelKey,
} from '../../utils/operatorStatsRange';
import styles from './OperatorStatsKpiGrid.module.css';

interface OperatorStatsKpiGridProps {
  metrics: Partial<OperatorWorkMetrics> | null;
  deltaRatio?: OperatorDeltaRatio | null;
  deltaLabel: string;
  loading?: boolean;
  loadFailed?: boolean;
  onRetry?: () => void;
}

const OperatorStatsKpiGrid: React.FC<OperatorStatsKpiGridProps> = ({
  metrics,
  deltaRatio,
  deltaLabel,
  loading = false,
  loadFailed = false,
  onRetry,
}) => {
  const { t } = useTranslation();

  const valueOf = (key: (typeof OPERATOR_METRIC_KEYS)[number]) => {
    if (loading) return t('operator.statsOverviewLoading');
    if (key === 'playDurationSeconds') {
      return formatOperatorPlayDuration(Number(metrics?.playDurationSeconds ?? 0));
    }
    const raw = metrics?.[key];
    return typeof raw === 'number' ? raw.toLocaleString() : '0';
  };

  if (loadFailed && !loading) {
    return (
      <div className={styles.grid}>
        <div className={styles.failed}>
          <div>{t('operator.statsOverviewLoadFailed')}</div>
          {onRetry ? (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              {t('operator.statsOverviewRetry')}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {OPERATOR_METRIC_KEYS.map((key) => {
        const delta = formatOperatorDeltaRatio(deltaRatio?.[key]);
        const deltaClass =
          delta.direction === 'up'
            ? styles.deltaUp
            : delta.direction === 'down'
              ? styles.deltaDown
              : '';
        const arrow =
          delta.direction === 'up' ? ' ↑' : delta.direction === 'down' ? ' ↓' : '';
        return (
          <div key={key} className={styles.card}>
            <p className={styles.label}>{t(operatorMetricLabelKey(key))}</p>
            <div className={styles.value}>{valueOf(key)}</div>
            <div className={`${styles.delta} ${deltaClass}`}>
              {deltaLabel} {delta.text}{arrow}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OperatorStatsKpiGrid;
