import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/Layout/Navbar';
import FooterArea from '../../components/Layout/FooterArea';
import MobileBottomNav from '../../components/Layout/MobileBottomNav';
import VerifiedBadge from '../../components/VerifiedBadge';
import StatsOverviewSection from '../../components/stats/StatsOverviewSection';
import creatorStatsApi, { type CreatorWorkItem, type StatsOverview } from '../../api/stats/creatorStatsApi';
import { useAuthStore } from '../../store/useAuthStore';
import { isVerifiedCreatorRole } from '../../utils/userRoles';
import createStyles from '../Create.module.css';
import styles from './CreatorDataCenter.module.css';

const CreatorDataCenter: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [works, setWorks] = useState<CreatorWorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userName = user?.user?.nickname || user?.user?.name || t('create.userNameDefault');
  const showVerifiedBadge = isVerifiedCreatorRole(user?.user?.role);

  const updatedAt = useMemo(
    () => new Date().toLocaleString(),
    [overview]
  );

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [overviewResp, worksResp] = await Promise.all([
          creatorStatsApi.getOverview(),
          creatorStatsApi.getWorks(),
        ]);
        if (overviewResp.data.success) {
          setOverview(overviewResp.data.data);
        }
        if (worksResp.data.success && worksResp.data.data) {
          setWorks(worksResp.data.data.works || []);
        }
      } catch (error) {
        console.error('[CreatorDataCenter] load failed', error);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className={createStyles.pageRoot}>
      <Navbar />
      <div className={createStyles.mainContent}>
        <main className={createStyles.main}>
          <section className={styles.heroCard}>
            <div>
              <p className={styles.heroEyebrow}>{t('creatorStats.pageTitle')}</p>
              <h1 className={styles.heroTitle}>
                {userName}
                {showVerifiedBadge ? <VerifiedBadge /> : null}
              </h1>
              <p className={styles.heroDesc}>{t('creatorStats.pageDesc')}</p>
            </div>
            <button type="button" className={styles.linkButton} onClick={() => navigate('/profile')}>
              {t('creatorStats.backToStudio')}
            </button>
          </section>

          {isLoading ? (
            <div className={styles.loadingBox}>{t('creatorStats.loading')}</div>
          ) : (
            <>
              <StatsOverviewSection stats={overview} updatedAt={updatedAt} />
              <section className={styles.worksSection}>
                <div className={createStyles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>{t('creatorStats.worksTitle')}</h2>
                </div>
                <div className={styles.workList}>
                  {works.map((work) => (
                    <button
                      key={work.fileId}
                      type="button"
                      className={styles.workCard}
                      onClick={() => navigate(`/creator/works/${work.fileId}/stats`)}
                    >
                      <div className={styles.workTitle}>{work.title}</div>
                      <div className={styles.workMeta}>
                        <span>{t('creatorStats.playCount')}: {work.metrics.playCount}</span>
                        <span>{t('creatorStats.totalViews')}: {work.metrics.pv}</span>
                        <span>{work.isPublic ? t('creatorStats.public') : t('creatorStats.draft')}</span>
                      </div>
                    </button>
                  ))}
                  {works.length === 0 ? (
                    <div className={styles.emptyState}>{t('creatorStats.noWorks')}</div>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
      <MobileBottomNav />
      <FooterArea />
    </div>
  );
};

export default CreatorDataCenter;
