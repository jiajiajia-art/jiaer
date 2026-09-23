import React from 'react';
import { useTranslation } from 'react-i18next';
import type { StatsOverview } from '../../api/stats/creatorStatsApi';
import createStyles from '../../page/Create.module.css';

/** 功能注释：数据概览图标对齐已发布作品效果图（assetsv2/home） */
const HOME_ICON_BASE = `${import.meta.env.BASE_URL}data/assetsv2/home`;
const statsIcon = (name: string) => `${HOME_ICON_BASE}/${name}`;

interface StatsOverviewSectionProps {
  stats: StatsOverview | null;
  updatedAt?: string;
  /** 功能注释：汇总接口较慢；loading 时不应展示 0 误导运营 */
  loading?: boolean;
  loadFailed?: boolean;
  onRetry?: () => void;
}

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const StatsOverviewSection: React.FC<StatsOverviewSectionProps> = ({
  stats,
  updatedAt,
  loading = false,
  loadFailed = false,
  onRetry,
}) => {
  const { t } = useTranslation();

  const items = [
    { key: 'pv', label: t('creatorStats.totalViews'), value: stats?.pv ?? 0, icon: statsIcon('stats_view.webp') },
    { key: 'uv', label: t('creatorStats.totalVisitors'), value: stats?.uv ?? 0, icon: statsIcon('icon_users.webp') },
    { key: 'likes', label: t('creatorStats.totalLikes'), value: stats?.likeCount ?? 0, icon: statsIcon('icon_heart.webp') },
    { key: 'plays', label: t('creatorStats.playCount'), value: stats?.playCount ?? 0, icon: statsIcon('stats_play.webp') },
    { key: 'duration', label: t('creatorStats.playDuration'), value: formatDuration(stats?.playDurationSeconds ?? 0), icon: statsIcon('icon_history.webp') },
    { key: 'shares', label: t('creatorStats.shareCount'), value: stats?.shareCount ?? 0, icon: statsIcon('stats_share.webp') },
    { key: 'comments', label: t('creatorStats.commentCount'), value: stats?.commentCount ?? 0, icon: statsIcon('icon_comment.webp') },
    { key: 'spend', label: t('creatorStats.spendPoints'), value: stats?.spendPoints ?? 0, icon: statsIcon('stats_income.webp') },
  ];

  const renderValue = (item: typeof items[number]) => {
    if (loading) return t('operator.statsOverviewLoading');
    if (typeof item.value === 'string') return item.value;
    return item.value;
  };

  return (
    <section className={createStyles.statsSection}>
      <div className={createStyles.sectionHeader}>
        <img src="/funloom/data/assets/create/myData.png" alt="" className={createStyles.sectionTitleImage} />
        <div className={createStyles.sectionDivider} />
        {updatedAt ? (
          <span className={createStyles.statsUpdateTime}>
            {t('create.statsUpdateTime', { time: updatedAt })}
          </span>
        ) : null}
      </div>
      {loadFailed && !loading ? (
        <div className={createStyles.statsGrid}>
          <div className={createStyles.statBox} style={{ gridColumn: '1 / -1' }}>
            <div className={createStyles.statLabel}>
              <span>{t('operator.statsOverviewLoadFailed')}</span>
            </div>
            {onRetry ? (
              <button type="button" className={createStyles.statValue} onClick={onRetry}>
                {t('operator.statsOverviewRetry')}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className={createStyles.statsGrid}>
          {items.map((item) => (
            <div key={item.key} className={createStyles.statBox}>
              <div className={createStyles.statLabel}>
                <img src={item.icon} alt="" />
                <span>{item.label}</span>
              </div>
              <div className={createStyles.statValue}>{renderValue(item)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default StatsOverviewSection;
