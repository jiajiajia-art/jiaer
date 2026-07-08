import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/Layout/Navbar';
import FooterArea from '../../components/Layout/FooterArea';
import MobileBottomNav from '../../components/Layout/MobileBottomNav';
import StatsOverviewSection from '../../components/stats/StatsOverviewSection';
import CreatorWorkDetailSections from '../../components/stats/CreatorWorkDetailSections';
import creatorStatsApi, { type CreatorWorkDetail } from '../../api/stats/creatorStatsApi';
import createStyles from '../Create.module.css';
import styles from './CreatorDataCenter.module.css';

const CreatorWorkStats: React.FC = () => {
  const { fileId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CreatorWorkDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const overview = useMemo(() => {
    if (!detail) return null;
    return {
      pv: detail.pv,
      uv: detail.uv,
      likeCount: detail.likeCount,
      shareCount: detail.shareCount,
      shareUv: 0,
      playCount: detail.playCount,
      playUv: 0,
      playDurationSeconds: detail.playDurationSeconds,
      commentCount: detail.commentCount,
      spendPoints: detail.spendPoints,
      activeHours: detail.activeHours,
    };
  }, [detail]);

  useEffect(() => {
    if (!fileId) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await creatorStatsApi.getWorkDetail(fileId, { commentLimit: 30 });
        if (response.data.success) {
          setDetail(response.data.data);
        }
      } catch (error) {
        console.error('[CreatorWorkStats] load failed', error);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [fileId]);

  return (
    <div className={createStyles.pageRoot}>
      <Navbar />
      <div className={createStyles.mainContent}>
        <main className={createStyles.main}>
          <div className={styles.detailHeader}>
            <button type="button" className={styles.linkButton} onClick={() => navigate('/create')}>
              {t('creatorStats.backToOverview')}
            </button>
            <h1>{detail?.title || t('creatorStats.workStatsTitle')}</h1>
          </div>

          {isLoading ? (
            <div className={styles.loadingBox}>{t('creatorStats.loading')}</div>
          ) : detail ? (
            <>
              <StatsOverviewSection stats={overview} updatedAt={new Date().toLocaleString()} />
              <CreatorWorkDetailSections detail={detail} />
            </>
          ) : (
            <div className={styles.emptyState}>{t('creatorStats.workNotFound')}</div>
          )}
        </main>
      </div>
      <MobileBottomNav />
      <FooterArea />
    </div>
  );
};

export default CreatorWorkStats;
