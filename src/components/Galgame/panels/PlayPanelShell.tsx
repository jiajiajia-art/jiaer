import React from 'react';
import styles from './PlayPanelShell.module.css';

interface PlayPanelShellProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 右上角操作（如「+ 添加角色」） */
  headerRight?: React.ReactNode;
  /** 顶栏返回：有则显示「‹」，点击回调（UE 详情/私聊返回） */
  onHeaderBack?: () => void;
  /** 底栏「返回」关闭整面板；与 onHeaderBack 互斥使用时通常关掉 */
  showBack?: boolean;
  /** 隐藏标题区（子页自带顶栏时） */
  hideHeader?: boolean;
}

/** 功能注释：四面板统一壳；支持 UE 顶栏返回 / 右上操作。 */
const PlayPanelShell: React.FC<PlayPanelShellProps> = ({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footer,
  headerRight,
  onHeaderBack,
  showBack = true,
  hideHeader = false,
}) => {
  if (!isOpen) return null;
  const hasFooter = Boolean(footer) || showBack;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {!hideHeader ? (
          <header className={styles.header}>
            <div className={styles.headerRow}>
              {onHeaderBack ? (
                <button type="button" className={styles.headerBack} onClick={onHeaderBack} aria-label="返回">
                  ‹
                </button>
              ) : null}
              <div className={styles.headerText}>
                <h2 className={styles.title}>{title}</h2>
                {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
              </div>
              {headerRight ? <div className={styles.headerRight}>{headerRight}</div> : null}
            </div>
          </header>
        ) : null}
        <div className={styles.body}>{children}</div>
        {hasFooter ? (
          <footer className={styles.footer}>
            {footer}
            {showBack ? (
              <button type="button" className={styles.backButton} onClick={onClose}>
                返回
              </button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
};

export default PlayPanelShell;
