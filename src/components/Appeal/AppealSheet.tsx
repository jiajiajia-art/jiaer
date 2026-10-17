import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import appealApi from '../../api/appeal/appealApi';
import type { AppealEligibleItem } from '../../api/appeal/appeal.type';
import { getApiErrorMessage } from '../../utils/error';
import styles from '../Report/ReportSheet.module.css';

const MAX_REASON = 1000;
const MAX_EVIDENCE = 3;
const MIN_EVIDENCE = 1;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

type EvidenceItem = {
  key: string;
  previewUrl: string;
};

export type AppealSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /** 被申诉的 moderation id；缺省则从 eligible 选择 */
  relatedId?: number | null;
  onSubmitted?: () => void;
};

const AppealSheet: React.FC<AppealSheetProps> = ({
  isOpen,
  onClose,
  relatedId = null,
  onSubmitted,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [eligible, setEligible] = useState<AppealEligibleItem[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [selectedRelatedId, setSelectedRelatedId] = useState<number | null>(relatedId);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setSelectedRelatedId(relatedId ?? null);
    setEvidence((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });

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
        if (relatedId == null && list.length === 1) {
          setSelectedRelatedId(list[0].id);
        }
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
  }, [isOpen, relatedId, t]);

  if (!isOpen) return null;

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

  const canSubmit =
    Boolean(selectedRelatedId)
    && reason.trim().length > 0
    && evidence.length >= MIN_EVIDENCE
    && !submitting
    && !uploading
    && !loadingEligible;

  const handleSubmit = async () => {
    if (!canSubmit || selectedRelatedId == null) return;
    setSubmitting(true);
    try {
      const res = await appealApi.submit({
        relatedId: selectedRelatedId,
        reason: reason.trim(),
        evidenceKeys: evidence.map((item) => item.key),
      });
      if (!res.data.success) {
        throw new Error(res.data.message || t('appeal.submitFailed'));
      }
      toast.success(res.data.message || t('appeal.submitSuccess'));
      onSubmitted?.();
      onClose();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('appeal.submitFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const needPickTarget = relatedId == null;

  const panel = (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('appeal.title')}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{t('appeal.title')}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <div className={styles.body}>
          {needPickTarget ? (
            <>
              <div className={styles.sectionLabel}>{t('appeal.selectTarget')}</div>
              {loadingEligible ? (
                <div className={styles.loadingReasons}>{t('appeal.loadingEligible')}</div>
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
                        #{item.id} · {item.recordType}
                        {item.level != null ? ` L${item.level}` : ''}
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

          <div className={styles.sectionLabel}>{t('appeal.reasonLabel')}</div>
          <textarea
            className={styles.textarea}
            value={reason}
            maxLength={MAX_REASON}
            placeholder={t('appeal.reasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className={styles.charCount}>{reason.length}/{MAX_REASON}</p>

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
                className={styles.addEvidence}
                onClick={handlePickEvidence}
                disabled={uploading}
              >
                {uploading ? t('appeal.uploading') : t('appeal.addEvidence')}
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
        </div>

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
      </div>
    </div>
  );

  if (typeof document === 'undefined') return panel;
  return createPortal(panel, document.body);
};

export default AppealSheet;
