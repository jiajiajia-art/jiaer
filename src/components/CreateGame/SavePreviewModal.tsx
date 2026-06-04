import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SavePreviewModal.module.css';
import type { SaveSummaryItem } from '../../api/galgame/saves';

interface SavePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: SaveSummaryItem | null;
  onLoad: (saveId: string) => void;
  loadButtonText?: string;
}

const SavePreviewModal: React.FC<SavePreviewModalProps> = ({ isOpen, onClose, item, onLoad, loadButtonText }) => {
  const { t } = useTranslation();
  if (!isOpen || !item) return null;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>{t('createGame.savePreview.title')}</div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.body}>
          <div className={styles.summary}>{item.summaryText}</div>
        </div>
        <div className={styles.footer}>
          <button className={styles.btn} onClick={onClose}>{t('common.cancel')}</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onLoad(item.saveId)}>{loadButtonText || t('createGame.savePreview.loadSave')}</button>
        </div>
      </div>
    </div>
  );
};

export default SavePreviewModal;
