import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import appealApi from '../api/appeal/appealApi';
import type { AppealDetail } from '../api/appeal/appeal.type';
import { formatMessageDateTime } from '../lib/messageCenterView';
import { resolveEvidenceImageUrl } from '../utils/evidenceImageUrl';
import { getApiErrorMessage } from '../utils/error';
import styles from './AppealResult.module.css';

const DESC_COLLAPSE_LEN = 72;

const AppealResult: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { appealId: appealIdParam } = useParams<{ appealId: string }>();
  const appealId = useMemo(() => {
    const raw = String(appealIdParam || '').trim();
    return raw || null;
  }, [appealIdParam]);

  const [detail, setDetail] = useState<AppealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);

  const loadDetail = useCallback(async () => {
    if (appealId == null) {
      setError(t('appeal.resultNotFound'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await appealApi.getMine(appealId);
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.message || t('appeal.loadDetailFailed'));
      }
      setDetail(res.data.data);
    } catch (err: unknown) {
      setDetail(null);
      setError(getApiErrorMessage(err, t('appeal.loadDetailFailed')));
    } finally {
      setLoading(false);
    }
  }, [appealId, t]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const statusKey = String(detail?.status || '').toLowerCase();
  const isRejected = statusKey === 'rejected';
  const isApproved = statusKey === 'approved' || statusKey === 'revoked';
  const statusText = isApproved
    ? t('messages.appealResultApproved')
    : isRejected
      ? t('messages.appealResultRejected')
      : t('messages.appealResultPending');

  const statusIconClass = isApproved
    ? styles.statusIconApproved
    : isRejected
      ? styles.statusIconRejected
      : styles.statusIconPending;

  const targetLabel = useMemo(() => {
    if (!detail) return '—';
    const gameTitle = detail.gameTitle?.trim();
    if (gameTitle) return gameTitle;
    const nickname = detail.targetOwnerNickname?.trim();
    if (nickname) return t('appeal.targetAccountQuoted', { name: nickname });
    return t('appeal.unsetNickname');
  }, [detail, t]);

  const reasonText = (detail?.reason || '').trim();
  const notifyBody = (detail?.notifyBody || '').trim();
  const canCollapseDesc = reasonText.length > DESC_COLLAPSE_LEN;
  const evidenceUrls = detail?.evidenceUrls || [];

  const handleCopyId = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(String(detail.id));
      toast.success(t('appeal.idCopied'));
    } catch {
      toast.error(t('appeal.idCopyFailed'));
    }
  };

  return (
    <div className={styles.pageRoot}>
      <div className={styles.main}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate(-1)}
            aria-label={t('appeal.back')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 6L9 12L15 18" />
            </svg>
          </button>
          <h1 className={styles.title}>{t('appeal.resultPageTitle')}</h1>
        </header>

        {loading ? <p className={styles.empty}>{t('common.loading')}</p> : null}
        {!loading && error ? <p className={styles.error}>{error}</p> : null}

        {!loading && detail ? (
          <>
            <section className={styles.statusBlock}>
              <div className={`${styles.statusIcon} ${statusIconClass}`} aria-hidden="true">
                {isApproved ? (
                  <svg className={styles.statusCheck} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 12.5L10 17.5L19 6.5"
                      stroke="currentColor"
                      strokeWidth="2.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  '!'
                )}
              </div>
              <p className={styles.statusLabel}>{statusText}</p>
              {/* 功能注释：接口 notifyBody，放在结果标题下作平台结论说明 */}
              {notifyBody ? (
                <p className={styles.notifyBody}>{notifyBody}</p>
              ) : null}
            </section>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{t('appeal.detailSection')}</h2>
              <dl className={styles.rows}>
                <div className={styles.row}>
                  <dt className={styles.rowLabel}>{t('appeal.idLabel')}</dt>
                  <dd className={styles.rowValue}>
                    <span className={styles.idRow}>
                      <span>{detail.id}</span>
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={() => void handleCopyId()}
                        aria-label={t('appeal.copyId')}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                      </button>
                    </span>
                  </dd>
                </div>

                <div className={styles.row}>
                  <dt className={styles.rowLabel}>{t('appeal.targetLabel')}</dt>
                  <dd className={styles.rowValue}>{targetLabel}</dd>
                </div>

                <div className={styles.row}>
                  <dt className={styles.rowLabel}>{t('appeal.reasonTypeLabel')}</dt>
                  <dd className={styles.rowValue}>
                    {detail.reasonTitle?.trim() || '—'}
                  </dd>
                </div>

                <div className={styles.row}>
                  <dt className={styles.rowLabel}>{t('appeal.evidenceShortLabel')}</dt>
                  <dd className={styles.rowValue}>
                    {evidenceUrls.length > 0 ? (
                      <div className={styles.evidenceList}>
                        {evidenceUrls.map((url) => {
                          const src = resolveEvidenceImageUrl(url);
                          if (!src) return null;
                          return (
                            <a
                              key={url}
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={url}
                            >
                              <img className={styles.evidenceThumb} src={src} alt="" />
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>

                <div className={styles.row}>
                  <dt className={styles.rowLabel}>{t('appeal.descriptionLabel')}</dt>
                  <dd className={styles.rowValue}>
                    {reasonText ? (
                      <>
                        <p className={canCollapseDesc && !descExpanded ? styles.descClamp : ''}>
                          {reasonText}
                        </p>
                        {canCollapseDesc ? (
                          <button
                            type="button"
                            className={styles.descToggle}
                            onClick={() => setDescExpanded((v) => !v)}
                          >
                            {descExpanded
                              ? t('appeal.collapseDescription')
                              : t('appeal.expandDescription')}
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d={descExpanded ? 'M6 15L12 9L18 15' : 'M6 9L12 15L18 9'} />
                            </svg>
                          </button>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>

                <div className={styles.row}>
                  <dt className={styles.rowLabel}>{t('appeal.timeLabel')}</dt>
                  <dd className={styles.rowValue}>
                    {formatMessageDateTime(detail.createdAt) || '—'}
                  </dd>
                </div>
              </dl>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default AppealResult;
