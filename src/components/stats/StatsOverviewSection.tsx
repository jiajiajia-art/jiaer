import React from 'react';
import { IoEye, IoShareSocial, IoStatsChartSharp, IoTime, IoChatbubbleEllipses } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import type { StatsOverview } from '../../api/stats/creatorStatsApi';
import createStyles from '../../page/Create.module.css';

interface StatsOverviewSectionProps {
  stats: StatsOverview | null;
  updatedAt?: string;
}

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const StatsOverviewSection: React.FC<StatsOverviewSectionProps> = ({ stats, updatedAt }) => {
  const { t } = useTranslation();

  const items = [
    { key: 'pv', label: t('creatorStats.totalViews'), value: stats?.pv ?? 0, icon: <IoEye /> },
    { key: 'uv', label: t('creatorStats.totalVisitors'), value: stats?.uv ?? 0, icon: <IoStatsChartSharp /> },
    { key: 'likes', label: t('creatorStats.totalLikes'), value: stats?.likeCount ?? 0, icon: <TbHandClick /> },
    { key: 'plays', label: t('creatorStats.playCount'), value: stats?.playCount ?? 0, icon: <IoStatsChartSharp /> },
    { key: 'duration', label: t('creatorStats.playDuration'), value: formatDuration(stats?.playDurationSeconds ?? 0), icon: <IoTime /> },
    { key: 'shares', label: t('creatorStats.shareCount'), value: stats?.shareCount ?? 0, icon: <IoShareSocial /> },
    { key: 'comments', label: t('creatorStats.commentCount'), value: stats?.commentCount ?? 0, icon: <IoChatbubbleEllipses /> },
    { key: 'spend', label: t('creatorStats.spendPoints'), value: stats?.spendPoints ?? 0, icon: <TbHandClick /> },
  ];

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
      <div className={createStyles.statsGrid}>
        {items.map((item) => (
          <div key={item.key} className={createStyles.statBox}>
            <div className={createStyles.statLabel}>
              {item.icon}
              <span>{item.label}</span>
            </div>
            <div className={createStyles.statValue}>{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default StatsOverviewSection;
