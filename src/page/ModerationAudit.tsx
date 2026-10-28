import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import adminReportApi, { type AdminModerationDetail } from '../api/admin/adminReportApi';
import { useAuthStore } from '../store/useAuthStore';
import { parseExternalModerationId } from '../lib/externalModerationId';
import { isPublishReviewModeration } from '../lib/moderationNotice';
import { GAME_CARD_DEFAULT_AVATAR_PATH } from '../lib/gameCardAuthor';
import { getImageUrl } from '../utils/constants';
import { getApiErrorMessage } from '../utils/error';
import styles from './ModerationAudit.module.css';

const resolveEffectLabel = (
  detail: AdminModerationDetail,
  t: (key: string) => string,
): string => {
  const status = String(detail.status || '').toLowerCase();
  if (status === 'revoked') return t('moderationAudit.revoked');
  const end = detail.endsAt ? new Date(detail.endsAt).getTime() : NaN;
  if (status === 'finished' || (Number.isFinite(end) && end <= Date.now())) {
    return t('moderationAudit.expired');
  }
  if (!detail.endsAt) return t('moderationAudit.permanent');
  return t('moderationAudit.active');
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
};

const ModerationAudit: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { moderationId: idParam } = useParams<{ moderationId: string }>();
  const moderationId = useMemo(() => parseExternalModerationId(idParam), [idParam]);

  const authUser = useAuthStore((state) => state.user?.user);
  const [detail, setDetail] = useState<AdminModerationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    if (moderationId == null) {
      setError(t('moderationAudit.notFound'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await adminReportApi.getModeration(moderationId);
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.message || t('moderationAudit.loadFailed'));
      }
      setDetail(res.data.data);
    } catch (err: unknown) {
      setDetail(null);
      setError(getApiErrorMessage(err, t('moderationAudit.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [moderationId, t]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const nickname = authUser?.nickname?.trim() || t('appeal.unsetNickname');
  const accountCode = authUser?.userCode?.trim() || '';
  const avatarSrc = getImageUrl(authUser?.avatarUrl)
    || `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;

  const notifyBody = (detail?.notifyBody || '').trim();
  const reasonTitle = (detail?.reasonTitle || detail?.reasonCode || '').trim();
  // 功能注释：reportDetail = 审核备注；null/空不渲染；与标题相同则不再重复
  const reportDetail = (detail?.reportDetail || '').trim();
  const showReportDetail = Boolean(reportDetail) && reportDetail !== reasonTitle;
  const isPublishReview = detail
    ? isPublishReviewModeration({ recordType: detail.recordType })
    : false;
  const showProblemCard = Boolean(reasonTitle) || showReportDetail;
  const penaltyCount = notifyBody || reasonTitle || reportDetail ? 1 : 0;
  const isRevoked = String(detail?.status || '').toLowerCase() === 'revoked';
  const canAppeal = detail?.canAppeal === true && !isRevoked && !isPublishReview;
  const noticeTime = formatDateTime(detail?.createdAt || detail?.startsAt);
  const showEffectChip = Boolean(detail) && !isPublishReview;

  return (
    <div className={styles.pageRoot}>
      <div className={styles.main}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate(-1)}
            aria-label={t('moderationAudit.back')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 6L9 12L15 18" />
            </svg>
          </button>
          <h1 className={styles.title}>
            {isPublishReview
              ? t('moderationAudit.publishReviewPageTitle')
              : t('moderationAudit.pageTitle')}
          </h1>
        </header>

        <section className={styles.profileCard}>
          <img className={styles.avatar} src={avatarSrc} alt="" />
          <div>
            <p className={styles.nickname}>{nickname}</p>
            {accountCode ? (
              <p className={styles.accountId}>{t('moderationAudit.accountId', { code: accountCode })}</p>
            ) : null}
          </div>
        </section>

        {loading ? <p className={styles.empty}>{t('common.loading')}</p> : null}
        {!loading && error ? <p className={styles.error}>{error}</p> : null}

        {!loading && detail ? (
          <>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>
                  {isPublishReview
                    ? t('moderationAudit.publishReviewSection')
                    : t('moderationAudit.penaltySection')}
                </h2>
                <span className={styles.cardCount}>
                  {t('moderationAudit.penaltyCount', { n: penaltyCount })}
                </span>
              </div>
              {notifyBody ? <p className={styles.bodyText}>{notifyBody}</p> : <p className={styles.bodyText}>—</p>}
              {isPublishReview ? (
                noticeTime ? (
                  <div className={styles.statusChip}>
                    <span>{t('moderationAudit.noticeTimeLabel')}</span>
                    <span className={styles.statusValue}>{noticeTime}</span>
                  </div>
                ) : null
              ) : showEffectChip ? (
                <div className={styles.statusChip}>
                  <span>{t('moderationAudit.effectiveLabel')}</span>
                  <span className={styles.statusValue}>{resolveEffectLabel(detail, t)}</span>
                </div>
              ) : null}
            </section>

            {/* 功能注释：无 reasonTitle/备注时不渲染空「存在问题」卡，避免发布驳回只剩 — */}
            {showProblemCard ? (
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>
                    {reasonTitle
                      ? t('moderationAudit.problemSection')
                      : t('moderationAudit.reviewNoteSection')}
                  </h2>
                </div>
                {reasonTitle ? <p className={styles.bodyText}>{reasonTitle}</p> : null}
                {showReportDetail ? (
                  <p className={reasonTitle ? styles.subText : styles.bodyText}>{reportDetail}</p>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      {!loading && detail && !isPublishReview ? (
        <div className={styles.footer}>
          {isRevoked ? (
            <p className={styles.footerHintMuted}>
              {t('moderationAudit.cannotAppealRevoked')}
            </p>
          ) : (
            <div className={styles.footerActions}>
              {canAppeal ? (
                <p className={styles.appealWindowHint}>
                  {t('moderationAudit.appealWindowHint')}
                </p>
              ) : null}
              <button
                type="button"
                className={styles.appealBtn}
                disabled={!canAppeal}
                onClick={() => {
                  if (!detail?.id || !canAppeal) return;
                  navigate(`/appeal/submit?relatedModerationId=${encodeURIComponent(detail.id)}`);
                }}
              >
                {t('moderationAudit.appeal')}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ModerationAudit;
