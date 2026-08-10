import React from 'react';
import styles from './GameConfirmModal.module.css';

interface GameConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** 叠在更高弹窗（如导出框 z=3400）之上时传入 */
  overlayZIndex?: number;
  /**
   * light：白底红顶（默认，兼容旧调用）
   * dossier：深色玻璃笺，对齐局内设置 / 人物档案
   */
  variant?: 'light' | 'dossier';
  /** 消息下方扩展区（如提示词补充面板） */
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 仅用于 Galgame / GalgameMap 等“手机画布”场景的确认弹窗：
 *  - 不使用 portal，直接渲染在游戏容器内
 *  - 遮罩和内容宽度与 SettingsModal 一致，保持比例
 */
const GameConfirmModal: React.FC<GameConfirmModalProps> = ({
  isOpen,
  title = '确认操作',
  message = '请确认是否继续此操作？',
  confirmText = '确认',
  cancelText = '取消',
  overlayZIndex,
  variant = 'light',
  children,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isDossier = variant === 'dossier';

  return (
    <div
      className={styles.overlay}
      style={overlayZIndex ? { zIndex: overlayZIndex } : undefined}
      onClick={onCancel}
    >
      <div
        className={`${styles.modal} ${isDossier ? styles.modalDossier : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${styles.header} ${isDossier ? styles.headerDossier : ''}`}>
          <h3 className={`${styles.title} ${isDossier ? styles.titleDossier : ''}`}>{title}</h3>
          <button
            type="button"
            className={`${styles.closeButton} ${isDossier ? styles.closeButtonDossier : ''}`}
            onClick={onCancel}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className={`${styles.body} ${isDossier ? styles.bodyDossier : ''}`}>
          <div className={styles.messageBlock}>
            {typeof message === 'string' ? (
              <p className={`${styles.message} ${isDossier ? styles.messageDossier : ''}`}>
                {message}
              </p>
            ) : (
              <div className={`${styles.message} ${isDossier ? styles.messageDossier : ''}`}>
                {message}
              </div>
            )}
            {children}
          </div>
          <div className={styles.buttons}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${isDossier ? styles.btnDossierPrimary : ''}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${isDossier ? styles.btnDossierSecondary : ''}`}
              onClick={onCancel}
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameConfirmModal;
