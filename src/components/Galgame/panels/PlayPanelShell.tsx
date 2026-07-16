import React from 'react';
import styles from './PlayPanelShell.module.css';

interface PlayPanelShellProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** 功能注释：四面板统一壳（深色列表页 + 返回），不挡对白时可叠在对白之上。 */
const PlayPanelShell: React.FC<PlayPanelShellProps> = ({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footer,
}) => {
  if (!isOpen) return null;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </header>
        <div className={styles.body}>{children}</div>
        <footer className={styles.footer}>
          {footer}
          <button type="button" className={styles.backButton} onClick={onClose}>
            返回
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PlayPanelShell;
