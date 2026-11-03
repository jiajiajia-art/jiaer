import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AdminShell from '../../components/admin-shell/AdminShell';
import StatsOverviewSection from '../../components/stats/StatsOverviewSection';
import type { CreatorWorkDetail } from '../../api/stats/creatorStatsApi';
import operatorStatsApi from '../../api/stats/operatorStatsApi';
import adminStyles from '../AdminPanel.module.css';

const OperatorWorkStats: React.FC = () => {
  const { fileId = '' } = useParams();
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
    <AdminShell mode="operator" activeKey="stats">
    <div className={adminStyles.pageRoot}>
      <div className={adminStyles.pageBody}>
        <div className={adminStyles.contentArea}>
          <StatsOverviewSection stats={overview} updatedAt={new Date().toLocaleString()} />
        </div>
      </div>
    </div>
    </AdminShell>
  );
};

export default OperatorWorkStats;
