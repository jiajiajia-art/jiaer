import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AiFillStar, AiOutlineStar } from 'react-icons/ai';
import gameRatingApi from '../../api/gameRating';
import gameDetailExtrasApi, {
  type GameUpdateLogItem,
} from '../../api/gameDetailExtrasApi';
import { getApiErrorMessage } from '../../utils/error';
import styles from './GameDetailModals.module.css';

const MAX_REVIEW = 300;
const MAX_ISSUE_CONTENT = 2000;
const MAX_CONTACT = 100;

const STAR_SIZE = 32;

/** 功能注释：半星评分——底星描边 + 实心裁切叠层；半星时底星保持灰描边，避免红框套小星 */
const HalfStarPicker: React.FC<{
  value: number;
  onChange: (value: number) => void;
  label: string;
}> = ({ value, onChange, label }) => (
  <div className={styles.stars} role="group" aria-label={label}>
    {[1, 2, 3, 4, 5].map((star) => {
      const filled = value >= star;
      const half = !filled && value >= star - 0.5;
      const halfValue = Math.max(1, star - 0.5);
      return (
        <span key={star} className={styles.starSlot}>
          <span className={styles.starIcon} aria-hidden="true">
            <AiOutlineStar className={styles.starEmpty} size={STAR_SIZE} />
            {filled ? (
              <span className={styles.starFill}>
                <AiFillStar size={STAR_SIZE} />
              </span>
            ) : null}
            {half ? (
              <span className={styles.starHalf}>
                <AiFillStar size={STAR_SIZE} />
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className={styles.starHalfHit}
            aria-label={`${halfValue}`}
            onClick={() => onChange(halfValue)}
          />
          <button
            type="button"
            className={styles.starFullHit}
            aria-label={`${star}`}
            onClick={() => onChange(star)}
          />
        </span>
      );
    })}
  </div>
);

type RatingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  gameTitle: string;
  initialValue?: number | null;
  initialComment?: string;
  canEdit: boolean;
  onSubmitted: (payload: { ratingValue: number; comment: string }) => void;
};

/** 功能注释：为作品评分弹窗——0.5 步进，短评 ≤300，提交以后端为准 */
export const GameRatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  fileId,
  gameTitle,
  initialValue,
  initialComment,
  canEdit,
  onSubmitted,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue && initialValue > 0 ? initialValue : 5);
  const [comment, setComment] = useState(initialComment || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setValue(initialValue && initialValue > 0 ? initialValue : 5);
    setComment(initialComment || '');
  }, [isOpen, initialValue, initialComment]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!canEdit) {
      toast.error(t('gameDetail.ratingEditExhausted'));
      return;
    }
    if (value < 1) {
      toast.error(t('gameDetail.ratingRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await gameRatingApi.submitRating({
        fileId,
        ratingValue: value,
        comment: comment.trim() || undefined,
      });
      if (!res.data.success) {
        throw new Error(res.data.message || t('gameDetail.ratingSubmitFailed'));
      }
      toast.success(t('gameDetail.ratingSubmitSuccess'));
      onSubmitted({ ratingValue: value, comment: comment.trim() });
      onClose();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('gameDetail.ratingSubmitFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const scoreText = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const panel = (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.panel} ${styles.ratingPanel}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-rating-modal-title"
      >
        <div className={styles.header}>
          <h2 id="game-rating-modal-title" className={styles.title}>
            {t('gameDetail.ratingModalTitle', { title: gameTitle || t('gameDetail.unnamedGame') })}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className={styles.body}>
          <div className={styles.ratingBlock}>
            <HalfStarPicker
              value={value}
              onChange={setValue}
              label={t('gameDetail.ratingStarsLabel')}
            />
            <div className={styles.scoreLine} aria-live="polite">
              {t('gameDetail.ratingScoreLabel', { score: scoreText })}
            </div>
          </div>
          <label className={styles.label} htmlFor="game-rating-comment">
            {t('gameDetail.ratingCommentLabel')}
          </label>
          <div className={styles.textareaWrap}>
            <textarea
              id="game-rating-comment"
              className={`${styles.textarea} ${styles.ratingTextarea}`}
              value={comment}
              maxLength={MAX_REVIEW}
              placeholder={t('gameDetail.ratingCommentPlaceholder')}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
            <span className={styles.charCount}>
              {comment.length}/{MAX_REVIEW}
            </span>
          </div>
          {/* 功能注释：注意事项——半星操作、短评规范、仅可改一次 */}
          <div className={styles.ratingNotes} role="note">
            <div className={styles.ratingNotesTitle}>{t('gameDetail.ratingNotesTitle')}</div>
            <ul className={styles.ratingNotesList}>
              <li>{t('gameDetail.ratingNoteHalfStar')}</li>
              <li>{t('gameDetail.ratingNoteComment')}</li>
              <li>{t('gameDetail.ratingNoteEditOnce')}</li>
            </ul>
          </div>
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.btnGhost} onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={submitting || !canEdit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? t('common.submitting', { defaultValue: '提交中…' }) : t('gameDetail.ratingSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? panel : createPortal(panel, document.body);
};

type UpdateLogModalProps = {
  isOpen: boolean;
  onClose: () => void;
  logs: GameUpdateLogItem[];
};

/** 功能注释：全部更新日志弹层，时间倒序 */
export const GameUpdateLogModal: React.FC<UpdateLogModalProps> = ({ isOpen, onClose, logs }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  const panel = (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2 className={styles.title}>{t('gameDetail.updateLogAll')}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className={styles.body}>
          {logs.length === 0 ? (
            <p className={styles.label}>{t('gameDetail.updateLogEmpty')}</p>
          ) : (
            <div className={styles.logList}>
              {logs.map((item) => (
                <div key={`${item.id}-${item.createdAt}`} className={styles.logItem}>
                  <time>{new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false })}</time>
                  <p>{item.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? panel : createPortal(panel, document.body);
};

type IssueModalProps = {
  isOpen?: boolean;
  onClose?: () => void;
  fileId: string;
  gameTitle: string;
  /** 嵌在详情页标签里，不再盖一层弹窗 */
  embedded?: boolean;
};

/** 功能注释：作品故障反馈弹窗——描述必填 + 联系方式可选；类型默认 other，不上传截图 */
export const GameIssueFeedbackModal: React.FC<IssueModalProps> = ({
  isOpen = false,
  onClose,
  fileId,
  gameTitle,
  embedded = false,
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (embedded || !isOpen) return;
    setContent('');
    setContact('');
  }, [embedded, isOpen]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error(t('gameDetail.issueContentRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await gameDetailExtrasApi.createIssueFeedback({
        fileId,
        gameTitle,
        issueType: 'other',
        content: content.trim(),
        contact: contact.trim() || undefined,
        screenshotUrls: [],
      });
      if (!res.data.success) {
        throw new Error(res.data.message || t('gameDetail.issueSubmitFailed'));
      }
      toast.success(
        t('gameDetail.issueSubmitSuccess', {
          ticket: res.data.data?.ticketNo || '',
        }),
      );
      if (embedded) {
        setContent('');
        setContact('');
      } else {
        onClose?.();
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('gameDetail.issueSubmitFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const form = (
    <>
      <div className={styles.issueBody}>
        <label className={styles.issueLabel} htmlFor="game-issue-content">
          {t('gameDetail.issueContentLabel')}
          <span className={styles.issueRequired} aria-hidden="true"> *</span>
        </label>
        <textarea
          id="game-issue-content"
          className={`${styles.textarea} ${styles.issueTextarea}`}
          value={content}
          maxLength={MAX_ISSUE_CONTENT}
          placeholder={t('gameDetail.issueContentPlaceholder')}
          onChange={(e) => setContent(e.target.value)}
        />
        <label className={styles.issueLabel} htmlFor="game-issue-contact">
          {t('gameDetail.issueContactLabel')}
        </label>
        <input
          id="game-issue-contact"
          type="text"
          className={`${styles.input} ${styles.issueInput}`}
          value={contact}
          maxLength={MAX_CONTACT}
          placeholder={t('gameDetail.issueContactPlaceholder')}
          onChange={(e) => setContact(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={styles.issueFooter}>
        <button
          type="button"
          className={styles.issueSubmitBtn}
          disabled={submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? t('common.submitting', { defaultValue: '提交中…' }) : t('gameDetail.issueSubmit')}
        </button>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className={styles.issueEmbedded}>
        {form}
      </div>
    );
  }

  if (!isOpen) return null;

  const panel = (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.panel} ${styles.issuePanel}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-issue-feedback-title"
      >
        <div className={styles.issueHeader}>
          <span className={styles.issueIcon} aria-hidden="true">!</span>
          <h2 id="game-issue-feedback-title" className={styles.issueTitle}>
            {t('gameDetail.issueModalTitle')}
          </h2>
        </div>
        {form}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? panel : createPortal(panel, document.body);
};
