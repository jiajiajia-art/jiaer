import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './ContentActionMenu.module.css';

export type ContentActionMenuProps = {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onBlock: () => void;
  onReport: () => void;
};

const ContentActionMenu: React.FC<ContentActionMenuProps> = ({
  open,
  x,
  y,
  onClose,
  onBlock,
  onReport,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const left = Math.min(Math.max(8, x), window.innerWidth - 176);
  const top = Math.min(Math.max(8, y), window.innerHeight - 120);

  const node = (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.menu}
        style={{ left, top }}
        role="menu"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.item}
          role="menuitem"
          onClick={() => {
            onClose();
            onBlock();
          }}
        >
          {t('report.blockGame')}
        </button>
        <button
          type="button"
          className={`${styles.item} ${styles.itemDanger}`}
          role="menuitem"
          onClick={() => {
            onClose();
            onReport();
          }}
        >
          {t('report.reportAction')}
        </button>
      </div>
    </>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
};

export default ContentActionMenu;
