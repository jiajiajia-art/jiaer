import React from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    message?: React.ReactNode;
    confirmButtonText?: string;
    cancelButtonText?: string;
    /** alert：仅确认按钮，用于系统提示（替代原生 alert） */
    variant?: 'confirm' | 'alert';
    /** dark：个人中心墨黑酒红；glass：磨砂深色提示；admin：管理后台暖色 */
    tone?: 'default' | 'dark' | 'glass' | 'admin';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title = "确认操作",
    message = "请确认是否继续此操作？",
    confirmButtonText = "确认",
    cancelButtonText = "取消",
    variant = 'confirm',
    tone = 'default',
}) => {
    if (!isOpen) return null;

    const isAlert = variant === 'alert';

    // 功能注释：default / dark / glass 统一为同一套简洁深色卡片；admin 仍保留后台暖色
    const modalContent = tone === 'admin' ? (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={`${styles.deleteModal} ${styles.adminModal}`} role="dialog" aria-modal="true" aria-labelledby="confirm-admin-title">
                    <button className={styles.adminClose} onClick={onCancel} type="button" aria-label="close">×</button>
                    <div className={styles.adminHeader}>
                        <h1 id="confirm-admin-title" className={styles.adminTitle}>{title}</h1>
                    </div>
                    <div className={styles.adminBody}>
                        <div className={styles.adminMessage}>{message}</div>
                    </div>
                    <div className={styles.adminFooter}>
                        {!isAlert && (
                            <button className={styles.adminCancel} onClick={onCancel} type="button">{cancelButtonText}</button>
                        )}
                        <button className={styles.adminConfirm} onClick={onConfirm} type="button">{confirmButtonText}</button>
                    </div>
                </div>
            </div>
        </div>
    ) : (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
                    <button className={styles.cardClose} onClick={onCancel} type="button" aria-label="close">×</button>
                    <h1 id="confirm-modal-title" className={styles.cardTitle}>{title}</h1>
                    <div className={styles.cardMessage}>{message}</div>
                    <div className={styles.cardActions}>
                        {!isAlert && (
                            <button className={styles.cardCancel} onClick={onCancel} type="button">{cancelButtonText}</button>
                        )}
                        <button className={styles.cardConfirm} onClick={onConfirm} type="button">{confirmButtonText}</button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') {
        return modalContent;
    }
    return createPortal(modalContent, document.body);
};

export default ConfirmModal;
