import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/Layout/Navbar';
import StatsOverviewSection from '../../components/stats/StatsOverviewSection';
import type { CreatorWorkDetail } from '../../api/stats/creatorStatsApi';
import operatorStatsApi from '../../api/stats/operatorStatsApi';
import adminStyles from '../AdminPanel.module.css';
import styles from '../operator/OperatorPanel.module.css';

const OperatorWorkStats: React.FC = () => {
  const { fileId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CreatorWorkDetail | null>(null);

  useEffect(() => {
    if (!fileId) return;
    void operatorStatsApi.getWorkDetail(fileId, { commentLimit: 20 }).then((response) => {
      if (response.data.success) setDetail(response.data.data);
    });
  }, [fileId]);

  const overview = detail ? {
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
  } : null;

  return (
    <div className={adminStyles.pageRoot}>
      <Navbar />
      <div className={adminStyles.pageBody}>
        <div className={adminStyles.contentArea}>
          <button type="button" className={styles.linkLikeButton} onClick={() => navigate('/operator')}>
            {t('creatorStats.backToOverview')}
          </button>
          <h1>{detail?.title || t('creatorStats.workStatsTitle')}</h1>
          <StatsOverviewSection stats={overview} updatedAt={new Date().toLocaleString()} />
        </div>
      </div>
    </div>
  );
};

export default OperatorWorkStats;
