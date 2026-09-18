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
    /** dark：对齐个人中心 / 提现弹窗的墨黑酒红风格 */
    tone?: 'default' | 'dark';
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
    const isDark = tone === 'dark';

    const modalContent = (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div
                    className={[
                        styles.deleteModal,
                        isAlert ? styles.alertModal : '',
                        isDark ? styles.darkModal : '',
                    ].filter(Boolean).join(' ')}
                >
                    {isDark ? (
                        <div className={styles.darkHeader}>
                            <button
                                className={styles.darkCloseButton}
                                onClick={onCancel}
                                type="button"
                                aria-label="close"
                            >
                                <span className={styles.darkCloseIcon} aria-hidden="true" />
                            </button>
                            <h1 className={styles.darkTitle}>{title}</h1>
                        </div>
                    ) : (
                        <div className={styles.modalHeader}>
                            <div className={styles.headerContent}>
                                <div className={styles.titleIcon}>
                                    <img
                                        src={`${import.meta.env.BASE_URL}data/assets/create/弹框左上角图案.png`}
                                        alt=""
                                        className={styles.icon}
                                    />
                                    <h1 className={styles.title}>{title}</h1>
                                </div>
                                <button className={styles.closeButton} onClick={onCancel} type="button" aria-label="close">
                                    <img
                                        src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`}
                                        alt=""
                                    />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`${styles.modalBody} ${isDark ? styles.darkBody : ''}`}>
                        <div className={`${styles.messageWrapper} ${isDark ? styles.darkMessageWrapper : ''}`}>
                            <p className={`${styles.message} ${isDark ? styles.darkMessage : ''}`}>{message}</p>
                        </div>

                        <div
                            className={[
                                styles.buttonGroup,
                                isAlert ? styles.buttonGroupAlert : '',
                                isDark ? styles.darkButtonGroup : '',
                            ].filter(Boolean).join(' ')}
                        >
                            <button
                                className={`${styles.confirmButton} ${isDark ? styles.darkConfirmButton : ''}`}
                                onClick={onConfirm}
                                type="button"
                            >
                                {confirmButtonText}
                            </button>
                            {!isAlert ? (
                                <button
                                    className={`${styles.cancelButton} ${isDark ? styles.darkCancelButton : ''}`}
                                    onClick={onCancel}
                                    type="button"
                                >
                                    {cancelButtonText}
                                </button>
                            ) : null}
                        </div>
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
