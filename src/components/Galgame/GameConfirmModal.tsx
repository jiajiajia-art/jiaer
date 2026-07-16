import React from 'react';
import styles from './GameConfirmModal.module.css';

interface GameConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** 叠在更高弹窗（如导出框 z=3400）之上时传入 */
  overlayZIndex?: number;
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
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      style={overlayZIndex ? { zIndex: overlayZIndex } : undefined}
      onClick={onCancel}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.closeButton} onClick={onCancel}>
            ×
          </button>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
          <div className={styles.buttons}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
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


