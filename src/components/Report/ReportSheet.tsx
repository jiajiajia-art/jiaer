import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import reportApi from '../../api/report/reportApi';
import type { ReportReasonItem, ReportTargetType } from '../../api/report/report.type';
import { getApiErrorMessage } from '../../utils/error';
import styles from './ReportSheet.module.css';

const MAX_DETAIL = 400;
const MAX_EVIDENCE = 3;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

type EvidenceItem = {
  key: string;
  previewUrl: string;
};

/** 功能注释：按接口返回顺序归大类，组内保持原顺序 */
function groupReasonsByCategory(list: ReportReasonItem[]) {
  const groups: { category: string; items: ReportReasonItem[] }[] = [];
  const indexByCategory = new Map<string, number>();
  for (const item of list) {
    const category = String(item.category || '').trim();
    const key = category || '__uncategorized__';
    const existing = indexByCategory.get(key);
    if (existing == null) {
      indexByCategory.set(key, groups.length);
      groups.push({ category, items: [item] });
    } else {
      groups[existing].items.push(item);
    }
  }
  return groups;
}

export type ReportSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** 分享菜单底部说明等 */
  showPolicyHint?: boolean;
};

const ReportSheet: React.FC<ReportSheetProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  showPolicyHint = false,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reasons, setReasons] = useState<ReportReasonItem[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [categoryKey, setCategoryKey] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [detail, setDetail] = useState('');
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reasonGroups = useMemo(() => groupReasonsByCategory(reasons), [reasons]);
  const activeGroup = reasonGroups.find(
    (group) => (group.category || '__uncategorized__') === categoryKey,
  );
  /** 功能注释：大类下仅 1 个小类时跳过「具体问题」（如「其他」） */
  const hideSpecificBlock = Boolean(activeGroup && activeGroup.items.length === 1);
  const selectedReason = activeGroup?.items.find((item) => item.code === reasonCode);

  useEffect(() => {
    if (!isOpen) return;
    setCategoryKey('');
    setReasonCode('');
    setDetail('');
    setEvidence((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
    let cancelled = false;
    setLoadingReasons(true);
    void reportApi
      .getReasons(targetType)
      .then((res) => {
        if (cancelled) return;
        if (!res.data.success || !res.data.data) {
          throw new Error(res.data.message || t('report.loadReasonsFailed'));
        }
        setReasons(res.data.data.list || []);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, t('report.loadReasonsFailed')));
          setReasons([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReasons(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, targetType, t]);

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
      toast.error(t('report.evidenceTypeInvalid'));
      return;
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      toast.error(t('report.evidenceTooLarge'));
      return;
    }
    setUploading(true);
    try {
      const res = await reportApi.uploadEvidence(file);
      if (!res.data.success || !res.data.data?.key) {
        throw new Error(res.data.message || t('report.evidenceUploadFailed'));
      }
      // 功能注释：证据 url 本版可能是 R2 key，预览一律用本地 blob
      const previewUrl = URL.createObjectURL(file);
      setEvidence((prev) => [...prev, { key: res.data.data!.key, previewUrl }]);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('report.evidenceUploadFailed')));
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

  const handleSubmit = async () => {
    const trimmedDetail = detail.trim();
    if (!reasonCode || submitting || trimmedDetail.length > MAX_DETAIL) return;
    setSubmitting(true);
    try {
      const res = await reportApi.submit({
        targetType,
        targetId,
        reasonCode,
        detail: trimmedDetail || undefined,
        evidenceKeys: evidence.map((item) => item.key),
      });
      if (!res.data.success) {
        throw new Error(res.data.message || t('report.submitFailed'));
      }
      toast.success(res.data.message || t('report.submitSuccess'));
      onClose();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('report.submitFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const panel = (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('report.title')}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{t('report.title')}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <div className={styles.body}>
          {showPolicyHint ? <p className={styles.hint}>{t('report.policyHint')}</p> : null}

          <div className={styles.sectionLabel}>{t('report.reasonLabel')}</div>
          {loadingReasons ? (
            <div className={styles.loadingReasons}>{t('report.loadingReasons')}</div>
          ) : (
            <>
              <div className={styles.reasonChips}>
                {reasonGroups.map((group) => {
                  const key = group.category || '__uncategorized__';
                  const selectedCategory = key === categoryKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.reasonItem} ${selectedCategory ? styles.reasonItemActive : ''}`}
                      aria-pressed={selectedCategory}
                      onClick={() => {
                        setCategoryKey(key);
                        if (group.items.length === 1) {
                          setReasonCode(group.items[0].code);
                          return;
                        }
                        setReasonCode('');
                      }}
                    >
                      <span className={styles.reasonTitle}>{group.category || t('report.reasonLabel')}</span>
                    </button>
                  );
                })}
              </div>
              {activeGroup && !hideSpecificBlock ? (
                <div className={styles.specificBlock}>
                  <div className={styles.sectionLabel}>
                    {t('report.specificReasonLabel')}
                    <span className={styles.requiredMark}>*</span>
                  </div>
                  <div className={styles.reasonChips}>
                    {activeGroup.items.map((reason) => {
                      const selectedItem = reasonCode === reason.code;
                      return (
                        <button
                          key={reason.code}
                          type="button"
                          className={`${styles.reasonItem} ${selectedItem ? styles.reasonItemActive : ''}`}
                          aria-pressed={selectedItem}
                          onClick={() => setReasonCode(reason.code)}
                        >
                          <span className={styles.reasonTitle}>{reason.title}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedReason?.description ? (
                    <p className={styles.reasonPreview}>{selectedReason.description}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <div className={styles.sectionLabel}>{t('report.detailLabel')}</div>
          <div className={styles.textareaWrap}>
            <textarea
              className={styles.textarea}
              value={detail}
              maxLength={MAX_DETAIL}
              placeholder={t('report.detailPlaceholder')}
              onChange={(e) => setDetail(e.target.value)}
            />
            <p className={styles.charCount}>{detail.length}/{MAX_DETAIL}</p>
          </div>

          <div className={styles.sectionLabel}>{t('report.evidenceLabel')}</div>
          <div className={styles.evidenceRow}>
            {evidence.map((item) => (
              <div key={item.key} className={styles.evidenceThumb}>
                <img src={item.previewUrl} alt="" />
                <button
                  type="button"
                  className={styles.evidenceRemove}
                  onClick={() => removeEvidence(item.key)}
                  aria-label={t('report.removeEvidence')}
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
                aria-label={t('report.addEvidence')}
              >
                {uploading ? t('report.uploading') : '+'}
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
            disabled={!reasonCode || submitting || uploading || loadingReasons}
            onClick={() => void handleSubmit()}
          >
            {submitting ? t('report.submitting') : t('report.submit')}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return panel;
  return createPortal(panel, document.body);
};

export default ReportSheet;
