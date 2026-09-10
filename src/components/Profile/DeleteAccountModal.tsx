import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './DeleteAccountModal.module.css';

interface DeleteAccountModalProps {
    isOpen: boolean;
    isSubmitting?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * 功能注释：账号注销二次确认弹窗——重要提醒 + 8 条后果 +「再想想 / 确认注销」。
 * 对齐产品稿：居中警告图标、可滚动条款、左右并排危险确认按钮。
 */
const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
    isOpen,
    isSubmitting = false,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const consequences = t('profile.deleteAccount.consequences', {
        returnObjects: true,
    }) as string[];

    const modalContent = (
        <div className={styles.overlay} onClick={isSubmitting ? undefined : onCancel}>
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-account-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.warningIcon} aria-hidden="true">
                    <span className={styles.warningMark}>!</span>
                </div>
                <h2 id="delete-account-title" className={styles.title}>
                    {t('profile.deleteAccount.warningTitle')}
                </h2>
                <p className={styles.intro}>{t('profile.deleteAccount.intro')}</p>
                <ol className={styles.list}>
                    {(Array.isArray(consequences) ? consequences : []).map((item, index) => (
                        <li key={`delete-consequence-${index}`}>{item}</li>
                    ))}
                </ol>
                <p className={styles.footerNote}>{t('profile.deleteAccount.footerNote')}</p>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        {t('profile.deleteAccount.thinkAgain')}
                    </button>
                    <button
                        type="button"
                        className={styles.confirmBtn}
                        onClick={onConfirm}
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? t('profile.deleteAccount.deleting')
                            : t('profile.deleteAccount.confirmDelete')}
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return modalContent;
    return createPortal(modalContent, document.body);
};

export default DeleteAccountModal;
