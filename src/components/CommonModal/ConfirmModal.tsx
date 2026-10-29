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
    const isDark = tone === 'dark';
    const isGlass = tone === 'glass';
    const isAdmin = tone === 'admin';
    const usesOwnLayout = isGlass || isAdmin;

    const modalContent = (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div
                    className={[
                        styles.deleteModal,
                        isAlert && !usesOwnLayout ? styles.alertModal : '',
                        isDark ? styles.darkModal : '',
                        isGlass ? styles.glassModal : '',
                        isAdmin ? styles.adminModal : '',
                    ].filter(Boolean).join(' ')}
                    role={usesOwnLayout ? 'dialog' : undefined}
                    aria-modal={usesOwnLayout ? true : undefined}
                    aria-labelledby={isGlass ? 'confirm-glass-title' : isAdmin ? 'confirm-admin-title' : undefined}
                >
                    {isAdmin ? (
                        <>
                            <button
                                className={styles.adminClose}
                                onClick={onCancel}
                                type="button"
                                aria-label="close"
                            >
                                ×
                            </button>
                            <div className={styles.adminHeader}>
                                <h1 id="confirm-admin-title" className={styles.adminTitle}>{title}</h1>
                            </div>
                            <div className={styles.adminBody}>
                                <div className={styles.adminMessage}>{message}</div>
                            </div>
                            <div className={styles.adminFooter}>
                                {!isAlert ? (
                                    <button
                                        className={styles.adminCancel}
                                        onClick={onCancel}
                                        type="button"
                                    >
                                        {cancelButtonText}
                                    </button>
                                ) : null}
                                <button
                                    className={styles.adminConfirm}
                                    onClick={onConfirm}
                                    type="button"
                                >
                                    {confirmButtonText}
                                </button>
                            </div>
                        </>
                    ) : isGlass ? (
                        <>
                            <button
                                className={styles.glassClose}
                                onClick={onCancel}
                                type="button"
                                aria-label="close"
                            >
                                ×
                            </button>
                            <div className={styles.glassHeader}>
                                <h1 id="confirm-glass-title" className={styles.glassTitle}>{title}</h1>
                            </div>
                            <div className={styles.glassBody}>
                                <div className={styles.glassMessage}>{message}</div>
                            </div>
                            <div className={styles.glassFooter}>
                                <button
                                    className={styles.glassConfirm}
                                    onClick={onConfirm}
                                    type="button"
                                >
                                    {confirmButtonText}
                                </button>
                            </div>
                        </>
                    ) : isDark ? (
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

                    {!usesOwnLayout ? (
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
                    ) : null}
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
