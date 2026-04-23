import React, { useEffect, useMemo, useState } from 'react';
import styles from './ShareReplayModal.module.css';

interface Props {
  isOpen: boolean;
  defaultTitle?: string;
  onSubmit: (payload: {
    title: string;
    description?: string;
    visibility: 'public' | 'unlisted' | 'private';
  }) => Promise<void> | void;
  onClose: () => void;
}

const MAX_TITLE_LENGTH = 20;

const clampTitle = (value: string) => value.slice(0, MAX_TITLE_LENGTH);

const ShareReplayModal: React.FC<Props> = ({ isOpen, defaultTitle, onSubmit, onClose }) => {
  const [title, setTitle] = useState(clampTitle(defaultTitle || '我的回放'));
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(clampTitle(defaultTitle || '我的回放'));
  }, [defaultTitle, isOpen]);

  const canSubmit = useMemo(() => title.trim().length > 0 && !submitting, [title, submitting]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.titleWrap}>
              <img
                className={styles.titleIcon}
                src={`${import.meta.env.BASE_URL}data/assets/create/弹框左上角图案.png`}
                alt=""
              />
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
              <img
                className={styles.closeImg}
                src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`}
                alt="关闭"
              />
            </button>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>标题</label>
            <input
              className={styles.input}
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(event) => setTitle(clampTitle(event.target.value))}
              placeholder="如：第一章·与艾琳的选择"
            />
            <div className={styles.helperText}>
              {title.length}/{MAX_TITLE_LENGTH}
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>简介（可选）</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="简要说明这个回放发生了什么"
            />
          </div>
          <div className={`${styles.field} ${styles.visibilityField}`}>
            <label className={styles.label}>可见性</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  checked={visibility === 'public'}
                  onChange={() => setVisibility('public')}
                />
                <span className={styles.radioText}>公开</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  checked={visibility === 'unlisted'}
                  onChange={() => setVisibility('unlisted')}
                />
                <span className={styles.radioText}>不公开（持链接可见）</span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                />
                <span className={styles.radioText}>私密（仅自己可见）</span>
              </label>
            </div>
          </div>
        </div>
        <div className={styles.footer}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? '创建中…' : '创建回放'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareReplayModal;
