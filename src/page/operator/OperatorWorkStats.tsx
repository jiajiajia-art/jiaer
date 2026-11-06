import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Image, Row, Skeleton, Tag } from 'antd';
import { ClockCircleOutlined, HeartOutlined, PictureOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import AdminShell from '../../components/admin-shell/AdminShell';
import StatsOverviewSection from '../../components/stats/StatsOverviewSection';
import type { CreatorWorkDetail } from '../../api/stats/creatorStatsApi';
import operatorStatsApi from '../../api/stats/operatorStatsApi';
import { getImageUrl } from '../../utils/constants';
import adminStyles from '../AdminPanel.module.css';
import styles from './OperatorWorkStats.module.css';

const OperatorWorkStats: React.FC = () => {
  const { fileId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CreatorWorkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!fileId) {
      setLoading(false);
      setFailed(true);
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      const response = await operatorStatsApi.getWorkDetail(fileId, { commentLimit: 20 });
      if (!response.data.success || !response.data.data) throw new Error('Work stats response is empty');
      setDetail(response.data.data);
    } catch (error) {
      console.error('[OperatorWorkStats] load failed', error);
      setDetail(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const overview = useMemo(() => {
    if (!detail) return null;
    return {
      pv: detail.pv,
      uv: detail.uv,
      likeCount: detail.likeCount,
      shareCount: detail.shareCount,
      shareUv: detail.shareUv,
      playCount: detail.playCount,
      playUv: detail.playUv,
      playRounds: detail.playRounds ?? 0,
      playDurationSeconds: detail.playDurationSeconds,
      commentCount: detail.commentCount,
      spendPoints: detail.spendPoints,
      aiCallCount: detail.aiCallCount,
      aiInputTokens: detail.aiInputTokens,
      aiOutputTokens: detail.aiOutputTokens,
      aiCachedInputTokens: detail.aiCachedInputTokens,
      billedKkMinor: detail.billedKkMinor,
      activeHours: detail.activeHours,
    };
  }, [detail]);

  const activeHours = useMemo(
    () => [...(detail?.activeHours ?? [])].sort((left, right) => right.count - left.count || left.hour - right.hour),
    [detail?.activeHours],
  );
  const peakHour = activeHours[0]?.count ? activeHours[0].hour : null;
  const coverUrl = detail?.coverUrl ? getImageUrl(detail.coverUrl) : undefined;

  return (
    <AdminShell mode="operator" activeKey="stats">
      <div className={adminStyles.pageRoot}>
        <div className={adminStyles.pageBody}>
          <div className={adminStyles.contentArea}>
            {loading ? (
              <Card className={styles.loadingCard}>
                <Skeleton active avatar paragraph={{ rows: 2 }} />
              </Card>
            ) : failed ? (
              <Alert
                type="error"
                showIcon
                message={t('operator.statsOverviewLoadFailed')}
                action={<Button size="small" onClick={() => void loadDetail()}>{t('operator.statsOverviewRetry')}</Button>}
              />
            ) : detail ? (
              <>
                <Card className={styles.workCard}>
                  <div className={styles.workIdentity}>
                    {coverUrl ? (
                      <div className={styles.coverFrame}>
                        <Image className={styles.cover} src={coverUrl} alt="" preview={false} />
                      </div>
                    ) : (
                      <div className={styles.coverPlaceholder}><PictureOutlined /></div>
                    )}
                    <div className={styles.workText}>
                      <div className={styles.workEyebrow}>{t('operator.workStats.eyebrow')}</div>
                      <h1 className={styles.workTitle}>{detail.title}</h1>
                      <div className={styles.workMeta}>
                        <Tag color={detail.isPublic ? 'green' : 'default'}>
                          {detail.isPublic ? t('operator.workStats.public') : t('operator.workStats.private')}
                        </Tag>
                        <span>{t('operator.workStats.fileId', { fileId: detail.fileId })}</span>
                        {detail.createdAt ? (
                          <span>{t('operator.workStats.createdAt', { time: new Date(detail.createdAt).toLocaleDateString() })}</span>
                        ) : null}
                      </div>
                    </div>
                    <Button className={styles.backButton} onClick={() => navigate('/operator')}>
                      {t('operator.workStats.backToWorks')}
                    </Button>
                  </div>
                </Card>

                <section className={styles.metricsSection}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>{t('operator.workStats.metricsTitle')}</h2>
                      <p>{t('operator.workStats.metricsHint')}</p>
                    </div>
                  </div>
                  <StatsOverviewSection stats={overview} variant="admin" />
                </section>

                <Row gutter={[16, 16]} className={styles.detailGrid}>
                  <Col xs={24} xl={8}>
                    <Card className={styles.ratingCard}>
                      <div className={styles.cardEyebrow}><HeartOutlined />{t('operator.workStats.ratingTitle')}</div>
                      <div className={styles.ratingValue}>{detail.ratingAvg == null ? '—' : detail.ratingAvg.toFixed(1)}</div>
                      <div className={styles.ratingMeta}>
                        {t('creatorStats.ratingCount', { count: detail.ratingCount })}
                      </div>
                      <div className={styles.ratingFootnote}>{t('operator.workStats.ratingHint')}</div>
                    </Card>
                  </Col>
                  <Col xs={24} xl={16}>
                    <Card className={styles.activityCard}>
                      <div className={styles.activityHeading}>
                        <div>
                          <div className={styles.cardEyebrow}><ClockCircleOutlined />{t('creatorStats.activeHours')}</div>
                          <div className={styles.activityHint}>{t('creatorStats.activeHoursTip')}</div>
                        </div>
                        {peakHour != null ? <Tag color="blue">{t('operator.workStats.peakHour', { hour: peakHour })}</Tag> : null}
                      </div>
                      <div className={styles.hourGrid}>
                        {detail.activeHours.map((bucket) => {
                          const maxCount = activeHours[0]?.count || 0;
                          const intensity = maxCount ? bucket.count / maxCount : 0;
                          return (
                            <div
                              key={bucket.hour}
                              className={styles.hourCell}
                              style={{ '--activity-intensity': intensity } as React.CSSProperties}
                              title={`${bucket.hour}:00 · ${bucket.count}`}
                            >
                              <span>{String(bucket.hour).padStart(2, '0')}</span>
                              <strong>{bucket.count.toLocaleString()}</strong>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </Col>
                </Row>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </AdminShell>
  );
};

export default OperatorWorkStats;
