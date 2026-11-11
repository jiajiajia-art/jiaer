import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Col, Row, Statistic, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  DollarCircleOutlined,
  EyeOutlined,
  HeartFilled,
  MessageOutlined,
  PlayCircleOutlined,
  ShareAltOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { StatsOverview } from '../../api/stats/creatorStatsApi';
import createStyles from '../../page/Create.module.css';
import styles from './StatsOverviewSection.module.css';

/** 功能注释：数据概览图标对齐已发布作品效果图（assetsv2/home） */
const HOME_ICON_BASE = `${import.meta.env.BASE_URL}data/assetsv2/home`;
const statsIcon = (name: string) => `${HOME_ICON_BASE}/${name}`;

interface StatsOverviewSectionProps {
  stats: StatsOverview | null;
  updatedAt?: string;
  variant?: 'legacy' | 'admin';
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

const formatCompactTokens = (tokens: number) => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 10_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toLocaleString();
};

const StatsOverviewSection: React.FC<StatsOverviewSectionProps> = ({
  stats,
  updatedAt,
  variant = 'legacy',
  loading = false,
  loadFailed = false,
  onRetry,
}) => {
  const { t } = useTranslation();

  const items = [
    { key: 'pv', label: t('creatorStats.totalViews'), value: stats?.pv ?? 0, icon: statsIcon('stats_view.webp'), adminIcon: <EyeOutlined /> },
    { key: 'uv', label: t('creatorStats.totalVisitors'), value: stats?.uv ?? 0, icon: statsIcon('icon_users.webp'), adminIcon: <TeamOutlined /> },
    { key: 'likes', label: t('creatorStats.totalLikes'), value: stats?.likeCount ?? 0, icon: statsIcon('icon_heart.webp'), adminIcon: <HeartFilled /> },
    { key: 'plays', label: t('creatorStats.playCount'), value: stats?.playCount ?? 0, icon: statsIcon('stats_play.webp'), adminIcon: <PlayCircleOutlined /> },
    // 功能注释：游玩轮次与作者榜同源（成功 AI 生成），与上方进局 playCount 分开展示
    { key: 'playRounds', label: t('creatorStats.playRounds'), value: stats?.playRounds ?? 0, icon: statsIcon('stats_play.webp'), adminIcon: <PlayCircleOutlined /> },
    { key: 'duration', label: t('creatorStats.playDuration'), value: formatDuration(stats?.playDurationSeconds ?? 0), icon: statsIcon('icon_history.webp'), adminIcon: <ClockCircleOutlined /> },
    { key: 'shares', label: t('creatorStats.shareCount'), value: stats?.shareCount ?? 0, icon: statsIcon('stats_share.webp'), adminIcon: <ShareAltOutlined /> },
    { key: 'comments', label: t('creatorStats.commentCount'), value: stats?.commentCount ?? 0, icon: statsIcon('icon_comment.webp'), adminIcon: <MessageOutlined /> },
    { key: 'spend', label: t('creatorStats.spendPoints'), value: stats?.spendPoints ?? 0, icon: statsIcon('stats_income.webp'), adminIcon: <DollarCircleOutlined /> },
    ...(variant === 'admin' ? [
      { key: 'aiCalls', label: t('creatorStats.aiCallCount'), value: stats?.aiCallCount ?? 0, icon: statsIcon('stats_play.webp'), adminIcon: <PlayCircleOutlined /> },
      { key: 'aiTokens', label: t('creatorStats.aiTokens'), value: formatCompactTokens((stats?.aiInputTokens ?? 0) + (stats?.aiOutputTokens ?? 0)), icon: statsIcon('stats_income.webp'), adminIcon: <DollarCircleOutlined /> },
      { key: 'aiInputTokens', label: t('creatorStats.aiInputTokens'), value: formatCompactTokens(stats?.aiInputTokens ?? 0), icon: statsIcon('stats_income.webp'), adminIcon: <DollarCircleOutlined /> },
      { key: 'aiOutputTokens', label: t('creatorStats.aiOutputTokens'), value: formatCompactTokens(stats?.aiOutputTokens ?? 0), icon: statsIcon('stats_income.webp'), adminIcon: <DollarCircleOutlined /> },
      { key: 'aiCachedInputTokens', label: t('creatorStats.aiCachedInputTokens'), value: formatCompactTokens(stats?.aiCachedInputTokens ?? 0), icon: statsIcon('stats_income.webp'), adminIcon: <DollarCircleOutlined /> },
      { key: 'kkSpent', label: t('creatorStats.aiKkSpent'), value: ((stats?.billedKkMinor ?? 0) / 100).toFixed(2), icon: statsIcon('stats_income.webp'), adminIcon: <DollarCircleOutlined /> },
    ] : []),
  ];

  const renderValue = (item: typeof items[number]) => {
    if (loading) return t('operator.statsOverviewLoading');
    if (typeof item.value === 'string') return item.value;
    return item.value;
  };

  if (variant === 'admin') {
    return (
      <section className={styles.adminStatsSection}>
        <div className={styles.adminStatsHeader}>
          {updatedAt ? <span className={styles.adminStatsUpdateTime}>{t('create.statsUpdateTime', { time: updatedAt })}</span> : null}
        </div>
        {loadFailed && !loading ? (
          <Alert
            type="error"
            showIcon
            message={t('operator.statsOverviewLoadFailed')}
            action={onRetry ? <Button size="small" onClick={onRetry}>{t('operator.statsOverviewRetry')}</Button> : null}
          />
        ) : (
          <Row gutter={[16, 16]}>
            {items.map((item) => (
              <Col key={item.key} xs={24} sm={12} lg={8} xl={6}>
                <Tooltip title={item.key.includes('Token') ? Number(item.key === 'aiTokens'
                  ? (stats?.aiInputTokens ?? 0) + (stats?.aiOutputTokens ?? 0)
                  : item.key === 'aiInputTokens'
                    ? stats?.aiInputTokens ?? 0
                    : item.key === 'aiOutputTokens'
                      ? stats?.aiOutputTokens ?? 0
                      : stats?.aiCachedInputTokens ?? 0).toLocaleString() : undefined}>
                  <Card className={styles.adminStatCard} size="small" loading={loading}>
                    <Statistic
                      title={<span className={styles.adminStatTitle}><span className={styles.adminStatIcon}>{item.adminIcon}</span>{item.label}</span>}
                      value={renderValue(item)}
                    />
                  </Card>
                </Tooltip>
              </Col>
            ))}
          </Row>
        )}
      </section>
    );
  }

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
