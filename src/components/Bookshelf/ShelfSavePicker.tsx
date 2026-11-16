import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './Bookshelf.module.css';
import {
  formatShelfSaveTime,
  shelfSaveProgressLabel,
  type ShelfResumeOption,
  type ShelfSaveEntry,
} from '../../lib/bookshelf';

interface ShelfSavePickerProps {
  isOpen: boolean;
  gameTitle: string;
  options: ShelfResumeOption[];
  invalid: ShelfSaveEntry[];
  defaultKey: string;
  onConfirm: (option: ShelfResumeOption) => void;
  onViewDetail: () => void;
  onClose: () => void;
}

/**
 * 【选择存档】：列出可读进度（主角名 / 进度 / 存档时间）与不可读存档（灰显 + 原因）。
 * 没有可读存档时只提示原因并引导去详情页，绝不自动清档重开。
 */
const ShelfSavePicker: React.FC<ShelfSavePickerProps> = ({
  isOpen,
  gameTitle,
  options,
  invalid,
  defaultKey,
  onConfirm,
  onViewDetail,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState(defaultKey);

  useEffect(() => {
    if (isOpen) setSelectedKey(defaultKey);
  }, [isOpen, defaultKey]);

  if (!isOpen) return null;
  const selected = options.find((o) => o.key === selectedKey) || null;

  return createPortal(
    <div className={styles.sheetOverlay} onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('bookshelfUi.savePicker.dialogAria')} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHeader}>
          <div className={styles.sheetHeading}>
            <h3 className={styles.sheetTitle}>{t('bookshelfUi.savePicker.title')}</h3>
            <p className={styles.sheetSub}>{gameTitle}</p>
          </div>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label={t('bookshelfUi.savePicker.closeAria')}>×</button>
        </div>
        <div className={styles.sheetBody}>
          {options.length === 0 && (
            <div className={styles.sheetHint}>{t('bookshelfUi.savePicker.noReadableSaves')}</div>
          )}
          {options.map((option) => {
            const progress = shelfSaveProgressLabel(option);
            const meta = [progress, formatShelfSaveTime(option.savedAt)].filter(Boolean).join(' · ');
            return (
              <button
                key={option.key}
                type="button"
                className={`${styles.saveRow} ${selectedKey === option.key ? styles.saveRowActive : ''}`}
                onClick={() => setSelectedKey(option.key)}
              >
                <span className={`${styles.radio} ${selectedKey === option.key ? styles.radioOn : ''}`} aria-hidden="true" />
                <span className={styles.saveRowMain}>
                  <span className={styles.saveRowTitle}>
                    {option.playerName || (option.kind === 'session' ? t('bookshelfUi.savePicker.lastSession') : t('bookshelfUi.savePicker.saveFallback'))}
                    {option.kind === 'session' ? t('bookshelfUi.savePicker.autoProgress') : ''}
                  </span>
                  {meta && <span className={styles.saveRowMeta}>{meta}</span>}
                  {option.summary && <span className={styles.saveRowSummary}>{option.summary}</span>}
                </span>
              </button>
            );
          })}
          {invalid.map((entry) => (
            <div key={entry.saveId} className={`${styles.saveRow} ${styles.saveRowInvalid}`}>
              <span className={styles.radio} aria-hidden="true" />
              <span className={styles.saveRowMain}>
                <span className={styles.saveRowTitle}>{entry.playerName || t('bookshelfUi.savePicker.saveFallback')}{t('bookshelfUi.savePicker.unreadableSuffix')}</span>
                {entry.createdAt > 0 && (
                  <span className={styles.saveRowMeta}>{formatShelfSaveTime(entry.createdAt)}</span>
                )}
                <span className={styles.saveRowReason}>{entry.reason || t('bookshelfUi.savePicker.unreadableReason')}</span>
              </span>
            </div>
          ))}
        </div>
        <div className={styles.sheetFooter}>
          <button type="button" className={styles.ghostButton} onClick={onViewDetail}>{t('bookshelfUi.savePicker.viewDetail')}</button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
          >
            {t('bookshelfUi.savePicker.continuePlay')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ShelfSavePicker;
