import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreatorWorkDetail } from '../../api/stats/creatorStatsApi';
import MetricTitleTip from './MetricTitleTip';
import styles from './CreatorWorkDetailSections.module.css';

interface CreatorWorkDetailSectionsProps {
  detail: CreatorWorkDetail;
}

const TOP_ACTIVE_HOUR_COUNT = 5;

const CreatorWorkDetailSections: React.FC<CreatorWorkDetailSectionsProps> = ({ detail }) => {
  const { t } = useTranslation();

  const topActiveHours = useMemo(() => {
    const sorted = [...detail.activeHours]
      .sort((left, right) => right.count - left.count || left.hour - right.hour)
      .slice(0, TOP_ACTIVE_HOUR_COUNT);
    return new Set(sorted.map((bucket) => bucket.hour));
  }, [detail.activeHours]);

  return (
    <>
      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>{t('creatorStats.ratingsTitle')}</h2>
        <div className={styles.ratingSummary}>
          <span className={styles.ratingValue}>{(detail.ratingAvg ?? 0).toFixed(1)}</span>
          <span>{t('creatorStats.ratingCount', { count: detail.ratingCount ?? 0 })}</span>
        </div>
      </section>

      <section className={styles.detailSection}>
        <MetricTitleTip
          className={styles.sectionTitle}
          title={t('creatorStats.activeHours')}
          tip={t('creatorStats.activeHoursTip')}
        />
        <div className={styles.hourGrid}>
          {detail.activeHours.map((bucket) => (
            <div
              key={bucket.hour}
              className={`${styles.hourCell} ${topActiveHours.has(bucket.hour) ? styles.hourCellTop : ''}`}
            >
              <div>{bucket.hour}:00</div>
              <strong>{bucket.count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>{t('creatorStats.recentComments')}</h2>
        <div className={styles.commentList}>
          {detail.comments.map((comment) => (
            <article key={comment.ratingId} className={styles.commentItem}>
              <div className={styles.commentMeta}>
                <span>{comment.nickname || comment.userId}</span>
                <span>
                  {comment.ratingValue != null ? (
                    <span className={styles.commentRating}>
                      {t('creatorStats.ratingStars', { value: comment.ratingValue })}
                    </span>
                  ) : null}
                  {' '}
                  {comment.createdAt}
                </span>
              </div>
              <div>{comment.commentContent}</div>
            </article>
          ))}
          {detail.comments.length === 0 ? (
            <div className={styles.emptyState}>{t('creatorStats.noComments')}</div>
          ) : null}
        </div>
      </section>
    </>
  );
};

export default CreatorWorkDetailSections;
