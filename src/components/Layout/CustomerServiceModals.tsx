import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import customerServiceApi, {
  type CoopType,
  type FeedbackType,
} from '../../api/customerService/customerServiceApi';
import { getApiErrorMessage } from '../../utils/error';
import styles from './CustomerServiceModals.module.css';

const MAX_CONTENT = 2000;
const MAX_SCREENSHOTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

const FEEDBACK_TYPES: FeedbackType[] = ['bug', 'game', 'payment', 'product', 'other'];
const COOP_TYPES: CoopType[] = ['brand', 'content', 'channel', 'procurement', 'other'];

type Shot = { key: string; previewUrl: string };

type CommonProps = {
  isOpen: boolean;
  onClose: () => void;
};

/** 功能注释：意见反馈弹窗——类型标签 + 内容 + 可选联系方式/截图，成功展示 FL- 编号 */
export const FeedbackModal: React.FC<CommonProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ticketNo, setTicketNo] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFeedbackType('bug');
    setContent('');
    setContact('');
    setTicketNo('');
    setShots((prev) => {
      prev.forEach((s) => {
        if (s.previewUrl.startsWith('blob:')) URL.revokeObjectURL(s.previewUrl);
      });
      return [];
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (shots.length >= MAX_SCREENSHOTS) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast.error(t('customerService.feedback.imageTypeInvalid'));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('customerService.feedback.imageTooLarge'));
      return;
    }
    setUploading(true);
    try {
      const res = await customerServiceApi.uploadFeedbackScreenshot(file);
      if (!res.data.success || !res.data.data?.key) {
        throw new Error(res.data.message || t('customerService.feedback.uploadFailed'));
      }
      const previewUrl = URL.createObjectURL(file);
      setShots((prev) => [...prev, { key: res.data.data!.key, previewUrl }]);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('customerService.feedback.uploadFailed')));
    } finally {
      setUploading(false);
    }
  };

  const removeShot = (key: string) => {
    setShots((prev) => {
      const removed = prev.find((s) => s.key === key);
      if (removed?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((s) => s.key !== key);
    });
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error(t('customerService.feedback.contentRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await customerServiceApi.createFeedback({
        feedbackType,
        content: trimmed,
        contact: contact.trim() || undefined,
        screenshotUrls: shots.map((s) => s.key),
      });
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.message || t('customerService.feedback.submitFailed'));
      }
      setTicketNo(res.data.data.ticketNo);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('customerService.feedback.submitFailed')));
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
        aria-label={t('customerService.feedback.title')}
      >
        {ticketNo ? (
          <div className={styles.successWrap}>
            <div className={styles.successIcon} aria-hidden>✓</div>
            <h2 className={styles.successTitle}>{t('customerService.feedback.successTitle')}</h2>
            <p className={styles.ticketNo}>{ticketNo}</p>
            <button type="button" className={styles.submitBtn} onClick={onClose}>
              {t('customerService.done')}
            </button>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>{t('customerService.feedback.title')}</h2>
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>
                ×
              </button>
            </div>
            <div className={styles.body}>
              <div className={styles.label}>
                {t('customerService.feedback.typeLabel')}
                <span className={styles.required}>*</span>
              </div>
              <div className={styles.chips}>
                {FEEDBACK_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`${styles.chip} ${feedbackType === type ? styles.chipActive : ''}`}
                    onClick={() => setFeedbackType(type)}
                  >
                    {t(`customerService.feedback.types.${type}`)}
                  </button>
                ))}
              </div>
              <div className={styles.label}>
                {t('customerService.feedback.contentLabel')}
                <span className={styles.required}>*</span>
              </div>
              <textarea
                className={styles.textarea}
                value={content}
                maxLength={MAX_CONTENT}
                placeholder={t('customerService.feedback.contentPlaceholder')}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className={styles.label}>{t('customerService.feedback.contactLabel')}</div>
              <input
                className={styles.input}
                value={contact}
                placeholder={t('customerService.feedback.contactPlaceholder')}
                onChange={(e) => setContact(e.target.value)}
              />
              <div className={styles.label}>
                {t('customerService.feedback.screenshotsLabel')}
                <span className={styles.hint}> {t('customerService.feedback.screenshotsHint')}</span>
              </div>
              <div className={styles.evidenceRow}>
                {shots.map((shot) => (
                  <div key={shot.key} className={styles.thumb}>
                    <img src={shot.previewUrl} alt="" />
                    <button
                      type="button"
                      className={styles.thumbRemove}
                      onClick={() => removeShot(shot.key)}
                      aria-label={t('customerService.feedback.removeImage')}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {shots.length < MAX_SCREENSHOTS ? (
                  <button
                    type="button"
                    className={styles.addEvidence}
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? '…' : '+'}
                  </button>
                ) : null}
                <input
                  ref={fileRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void handleUpload(e)}
                />
              </div>
            </div>
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.submitBtn}
                disabled={submitting || uploading || !content.trim()}
                onClick={() => void handleSubmit()}
              >
                {submitting ? t('customerService.submitting') : t('customerService.feedback.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return panel;
  return createPortal(panel, document.body);
};

/** 功能注释：商务合作弹窗——合作类型/联系人/公司/联系方式/说明，成功展示 BC- 编号 */
export const BusinessCoopModal: React.FC<CommonProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [coopType, setCoopType] = useState<CoopType>('brand');
  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketNo, setTicketNo] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCoopType('brand');
    setContactName('');
    setCompanyName('');
    setContact('');
    setDescription('');
    setTicketNo('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!contactName.trim() || !companyName.trim() || !contact.trim() || !description.trim()) {
      toast.error(t('customerService.business.requiredFields'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await customerServiceApi.createBusinessCoop({
        coopType,
        contactName: contactName.trim(),
        companyName: companyName.trim(),
        contact: contact.trim(),
        description: description.trim(),
      });
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.message || t('customerService.business.submitFailed'));
      }
      setTicketNo(res.data.data.ticketNo);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('customerService.business.submitFailed')));
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
        aria-label={t('customerService.business.title')}
      >
        {ticketNo ? (
          <div className={styles.successWrap}>
            <div className={styles.successIcon} aria-hidden>✓</div>
            <h2 className={styles.successTitle}>{t('customerService.business.successTitle')}</h2>
            <p className={styles.ticketNo}>{ticketNo}</p>
            <button type="button" className={styles.submitBtn} onClick={onClose}>
              {t('customerService.done')}
            </button>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>{t('customerService.business.title')}</h2>
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>
                ×
              </button>
            </div>
            <div className={styles.body}>
              <div className={styles.label}>
                {t('customerService.business.typeLabel')}
                <span className={styles.required}>*</span>
              </div>
              <select
                className={styles.select}
                value={coopType}
                onChange={(e) => setCoopType(e.target.value as CoopType)}
              >
                {COOP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`customerService.business.types.${type}`)}
                  </option>
                ))}
              </select>
              <div className={styles.label}>
                {t('customerService.business.contactNameLabel')}
                <span className={styles.required}>*</span>
              </div>
              <input
                className={styles.input}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
              <div className={styles.label}>
                {t('customerService.business.companyLabel')}
                <span className={styles.required}>*</span>
              </div>
              <input
                className={styles.input}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <div className={styles.label}>
                {t('customerService.business.contactLabel')}
                <span className={styles.required}>*</span>
              </div>
              <input
                className={styles.input}
                value={contact}
                placeholder={t('customerService.business.contactPlaceholder')}
                onChange={(e) => setContact(e.target.value)}
              />
              <div className={styles.label}>
                {t('customerService.business.descriptionLabel')}
                <span className={styles.required}>*</span>
              </div>
              <textarea
                className={styles.textarea}
                value={description}
                maxLength={MAX_CONTENT}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.submitBtn}
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? t('customerService.submitting') : t('customerService.business.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return panel;
  return createPortal(panel, document.body);
};
