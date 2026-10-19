import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import adminReportApi from '../api/admin/adminReportApi';
import appealApi from '../api/appeal/appealApi';
import type { AppealEligibleItem } from '../api/appeal/appeal.type';
import type { ReportReasonItem } from '../api/report/report.type';
import { formatAppealRecordTitle } from '../lib/appealRecordLabel';
import { readRelatedModerationIdParam } from '../lib/externalModerationId';
import { getApiErrorMessage } from '../utils/error';
import styles from './AppealSubmit.module.css';

const MAX_REASON = 100;
const MAX_EVIDENCE = 3;
const MIN_EVIDENCE = 1;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

type EvidenceItem = {
  key: string;
  previewUrl: string;
};

const AppealSubmit: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const relatedModerationIdParam = useMemo(
    () => readRelatedModerationIdParam(searchParams),
    [searchParams],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [eligible, setEligible] = useState<AppealEligibleItem[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [checkingTarget, setCheckingTarget] = useState(false);
  const [targetBlocked, setTargetBlocked] = useState(false);
  const [selectedRelatedId, setSelectedRelatedId] = useState<string | null>(relatedModerationIdParam);
  const [reasonOptions, setReasonOptions] = useState<ReportReasonItem[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(true);
  const [reasonCode, setReasonCode] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelectedRelatedId(relatedModerationIdParam);
  }, [relatedModerationIdParam]);

  useEffect(() => {
    let cancelled = false;
    setLoadingReasons(true);
    void appealApi
      .getReasonOptions()
      .then((res) => {
        if (cancelled) return;
        if (!res.data.success || !res.data.data) {
          throw new Error(res.data.message || t('appeal.loadReasonsFailed'));
        }
        setReasonOptions(res.data.data.list || []);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, t('appeal.loadReasonsFailed')));
          setReasonOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReasons(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (relatedModerationIdParam != null) {
      setEligible([]);
      setLoadingEligible(false);
      let cancelled = false;
      setCheckingTarget(true);
      setTargetBlocked(false);
      void adminReportApi
        .getModeration(relatedModerationIdParam)
        .then((res) => {
          if (cancelled) return;
          const canAppeal = Boolean(res.data.success && res.data.data?.canAppeal === true);
          setTargetBlocked(!canAppeal);
        })
        .catch(() => {
          if (!cancelled) setTargetBlocked(true);
        })
        .finally(() => {
          if (!cancelled) setCheckingTarget(false);
        });
      return () => {
        cancelled = true;
      };
    }

    setCheckingTarget(false);
    setTargetBlocked(false);

    let cancelled = false;
    setLoadingEligible(true);
    void appealApi
      .getEligible()
      .then((res) => {
        if (cancelled) return;
        if (!res.data.success || !res.data.data) {
          throw new Error(res.data.message || t('appeal.loadEligibleFailed'));
        }
        const list = (res.data.data.list || []).filter((item) => item.canAppeal !== false);
        setEligible(list);
        if (list.length === 1) setSelectedRelatedId(list[0].id);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, t('appeal.loadEligibleFailed')));
          setEligible([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEligible(false);
      });

    return () => {
      cancelled = true;
    };
  }, [relatedModerationIdParam, t]);

  useEffect(() => () => {
    evidence.forEach((item) => {
      if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
    });
  }, [evidence]);

  const handlePickEvidence = () => {
    if (evidence.length >= MAX_EVIDENCE || uploading) return;
    fileInputRef.current?.click();
  };

  const handleEvidenceChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (evidence.length >= MAX_EVIDENCE) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      toast.error(t('appeal.evidenceTypeInvalid'));
      return;
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      toast.error(t('appeal.evidenceTooLarge'));
      return;
    }
    setUploading(true);
    try {
      const res = await appealApi.uploadEvidence(file);
      if (!res.data.success || !res.data.data?.key) {
        throw new Error(res.data.message || t('appeal.evidenceUploadFailed'));
      }
      const previewUrl = URL.createObjectURL(file);
      setEvidence((prev) => [...prev, { key: res.data.data!.key, previewUrl }]);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('appeal.evidenceUploadFailed')));
    } finally {
      setUploading(false);
    }
  };

  const removeEvidence = (key: string) => {
    setEvidence((prev) => {
      const next = prev.filter((item) => item.key !== key);
      const removed = prev.find((item) => item.key === key);
      if (removed?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const selectedReason = reasonOptions.find((item) => item.code === reasonCode);
  const needPickTarget = relatedModerationIdParam == null;

  const canSubmit =
    Boolean(selectedRelatedId)
    && Boolean(reasonCode)
    && reason.trim().length > 0
    && reason.trim().length <= MAX_REASON
    && evidence.length >= MIN_EVIDENCE
    && !submitting
    && !uploading
    && !loadingEligible
    && !loadingReasons
    && !checkingTarget
    && !targetBlocked;

  const handleSubmit = async () => {
    if (!canSubmit || selectedRelatedId == null) return;
    setSubmitting(true);
    try {
      const res = await appealApi.submit({
        relatedModerationId: selectedRelatedId,
        reasonCode,
        reason: reason.trim(),
        evidenceKeys: evidence.map((item) => item.key),
      });
      if (!res.data.success || !res.data.data?.appealId) {
        throw new Error(res.data.message || t('appeal.submitFailed'));
      }
      toast.success(res.data.message || t('appeal.submitSuccess'));
      navigate(`/appeals/${res.data.data.appealId}`, { replace: true });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('appeal.submitFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.pageRoot}>
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
        <h1 className={styles.title}>{t('appeal.title')}</h1>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </header>

      <div className={styles.main}>
        {checkingTarget ? (
          <div className={styles.loading}>{t('common.loading')}</div>
        ) : null}
        {!checkingTarget && targetBlocked ? (
          <p className={styles.hint}>{t('appeal.cannotAppeal')}</p>
        ) : null}
        {!checkingTarget && !targetBlocked && needPickTarget ? (
          <>
            <div className={styles.sectionLabel}>{t('appeal.selectTarget')}</div>
            {loadingEligible ? (
              <div className={styles.loading}>{t('appeal.loadingEligible')}</div>
            ) : eligible.length === 0 ? (
              <p className={styles.hint}>{t('appeal.noEligible')}</p>
            ) : (
              <div className={styles.reasonList}>
                {eligible.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.reasonItem} ${selectedRelatedId === item.id ? styles.reasonItemActive : ''}`}
                    onClick={() => setSelectedRelatedId(item.id)}
                  >
                    <span className={styles.reasonTitle}>
                      {formatAppealRecordTitle(t, item.recordType, item.level)}
                    </span>
                    <span className={styles.reasonDesc}>
                      {item.notifyBody || t('appeal.targetFallback')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}

        {!checkingTarget && !targetBlocked ? (
        <>
        <div className={styles.sectionLabel}>
          {t('appeal.reasonTypeLabel')}
          <span className={styles.requiredMark}>*</span>
        </div>
        {loadingReasons ? (
          <div className={styles.loading}>{t('appeal.loadingReasons')}</div>
        ) : (
          <>
            <div className={styles.reasonChips}>
              {reasonOptions.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={`${styles.reasonItem} ${reasonCode === item.code ? styles.reasonItemActive : ''}`}
                  aria-pressed={reasonCode === item.code}
                  onClick={() => setReasonCode(item.code)}
                >
                  <span className={styles.reasonTitle}>{item.title}</span>
                </button>
              ))}
            </div>
            {selectedReason?.description ? (
              <p className={styles.reasonPreview}>{selectedReason.description}</p>
            ) : null}
          </>
        )}

        <div className={styles.sectionLabel}>{t('appeal.descriptionLabel')}</div>
        <div className={styles.textareaWrap}>
          <textarea
            className={styles.textarea}
            value={reason}
            maxLength={MAX_REASON}
            placeholder={t('appeal.reasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className={styles.charCount}>{reason.length}/{MAX_REASON}</p>
        </div>

        <div className={styles.sectionLabel}>{t('appeal.evidenceLabel')}</div>
        <div className={styles.evidenceRow}>
          {evidence.map((item) => (
            <div key={item.key} className={styles.evidenceThumb}>
              <img src={item.previewUrl} alt="" />
              <button
                type="button"
                className={styles.evidenceRemove}
                onClick={() => removeEvidence(item.key)}
                aria-label={t('appeal.removeEvidence')}
              >
                ×
              </button>
            </div>
          ))}
          {evidence.length < MAX_EVIDENCE ? (
            <button
              type="button"
              className={`${styles.addEvidence}${uploading ? ` ${styles.addEvidenceBusy}` : ''}`}
              onClick={handlePickEvidence}
              disabled={uploading}
              aria-label={t('appeal.addEvidence')}
            >
              {uploading ? t('appeal.uploading') : '+'}
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            className={styles.hiddenInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void handleEvidenceChange(e)}
          />
        </div>
        </>
        ) : null}
      </div>

      {!checkingTarget && !targetBlocked ? (
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.submitBtn}
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {submitting ? t('appeal.submitting') : t('appeal.submit')}
        </button>
      </div>
      ) : null}
    </div>
  );
};

export default AppealSubmit;
