import React, { useMemo, useState } from 'react';
import styles from './ShareReplayModal.module.css';

interface Props {
  isOpen: boolean;
  defaultTitle?: string;
  onSubmit: (payload: { title: string; description?: string; visibility: 'public'|'unlisted'|'private' }) => Promise<void> | void;
  onClose: () => void;
}

const ShareReplayModal: React.FC<Props> = ({ isOpen, defaultTitle, onSubmit, onClose }) => {
  const [title, setTitle] = useState(defaultTitle || '我的回放');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public'|'unlisted'|'private'>('public');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => title.trim().length > 0 && !submitting, [title, submitting]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await onSubmit({ title: title.trim(), description: description.trim() || undefined, visibility });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.titleWrap}>
              <img className={styles.titleIcon} src={`${import.meta.env.BASE_URL}data/assets/create/弹框左上角图案.png`} alt="icon" />
              <div className={styles.title}>分享回放</div>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
              <img className={styles.closeImg} src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`} alt="关闭" />
            </button>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>标题</label>
            <input className={styles.input} value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="如：第1章·与艾琳的选择" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>简介（可选）</label>
            <textarea className={styles.textarea} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="简要说明这个回放发生了什么" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>可见性</label>
            <div className={styles.radio}>
              <label><input type="radio" checked={visibility==='public'} onChange={()=>setVisibility('public')} /> 公开</label>
              <label><input type="radio" checked={visibility==='unlisted'} onChange={()=>setVisibility('unlisted')} /> 不公开（持链接可见）</label>
              <label><input type="radio" checked={visibility==='private'} onChange={()=>setVisibility('private')} /> 私密（仅自己可见）</label>
            </div>
          </div>
        </div>
        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose} disabled={submitting}>取消</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit} disabled={!canSubmit}>{submitting ? '创建中…' : '创建回放'}</button>
        </div>
      </div>
    </div>
  );
}

export default ShareReplayModal;
