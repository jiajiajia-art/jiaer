import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [selectedKey, setSelectedKey] = useState(defaultKey);

  useEffect(() => {
    if (isOpen) setSelectedKey(defaultKey);
  }, [isOpen, defaultKey]);

  if (!isOpen) return null;
  const selected = options.find((o) => o.key === selectedKey) || null;

  return createPortal(
    <div className={styles.sheetOverlay} onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="选择存档" onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHeader}>
          <div className={styles.sheetHeading}>
            <h3 className={styles.sheetTitle}>选择存档</h3>
            <p className={styles.sheetSub}>{gameTitle}</p>
          </div>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className={styles.sheetBody}>
          {options.length === 0 && (
            <div className={styles.sheetHint}>没有可以读取的存档，请到详情页重新开始或联系作者</div>
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
                    {option.playerName || (option.kind === 'session' ? '上次进度' : '存档')}
                    {option.kind === 'session' ? '（自动进度）' : ''}
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
                <span className={styles.saveRowTitle}>{entry.playerName || '存档'}（无法读取）</span>
                {entry.createdAt > 0 && (
                  <span className={styles.saveRowMeta}>{formatShelfSaveTime(entry.createdAt)}</span>
                )}
                <span className={styles.saveRowReason}>{entry.reason || '存档无法读取'}</span>
              </span>
            </div>
          ))}
        </div>
        <div className={styles.sheetFooter}>
          <button type="button" className={styles.ghostButton} onClick={onViewDetail}>查看详情</button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
          >
            继续游玩
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ShelfSavePicker;
