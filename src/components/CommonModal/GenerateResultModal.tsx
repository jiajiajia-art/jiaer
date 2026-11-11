import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BsCheckCircle } from 'react-icons/bs';
import { IoCashOutline, IoWalletOutline } from 'react-icons/io5';
import styles from './GenerateResultModal.module.css';

interface GenerateResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    generatedCount?: number;
    totalCount?: number;
    pointsDeducted?: number;
    remainingPoints?: number;
    confirmButtonText?: string;
}

const GenerateResultModal: React.FC<GenerateResultModalProps> = ({
    isOpen,
    onClose,
    title,
    generatedCount,
    totalCount,
    pointsDeducted,
    remainingPoints,
    confirmButtonText,
}) => {
    const { t } = useTranslation();

    const defaultTitle = t('createGame.generationComplete');
    const defaultConfirmText = t('createGame.confirm');

    if (!isOpen) return null;

    const modalContent = (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modal}>
                    <div className={styles.modalHeader}>
                        <div className={styles.headerContent}>
                            <div className={styles.titleIcon}>
                                <img
                                    src={`${import.meta.env.BASE_URL}data/assets/create/弹框左上角图案.png`}
                                    alt="result icon"
                                    className={styles.icon}
                                />
                            </div>
                            <h1 className={styles.title}>{title || defaultTitle}</h1>
                            <button className={styles.closeButton} onClick={onClose}>
                                <img
                                    src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`}
                                    alt="close"
                                />
                            </button>
                        </div>
                    </div>

                    <div className={styles.modalBody}>
                        {generatedCount !== undefined && totalCount !== undefined && (
                            <div className={styles.resultItem}>
                                <BsCheckCircle className={styles.resultIcon} style={{ color: 'var(--color-success)' }} />
                                <span className={styles.resultText}>
                                    {t('createGame.successGenerated', { count: `${generatedCount}/${totalCount}` })}
                                </span>
                            </div>
                        )}

                        {pointsDeducted !== undefined && (
                            <div className={styles.resultItem}>
                                <IoCashOutline className={styles.resultIcon} style={{ color: 'var(--color-highlight)' }} />
                                <span className={styles.resultText}>
                                    {t('createGame.thisTimeDeducted', { points: pointsDeducted })}
                                </span>
                            </div>
                        )}

                        {remainingPoints !== undefined && (
                            <div className={styles.resultItem}>
                                <IoWalletOutline className={styles.resultIcon} style={{ color: 'var(--color-info)' }} />
                                <span className={styles.resultText}>
                                    {t('createGame.remainingPoints', { points: remainingPoints })}
                                </span>
                            </div>
                        )}

                        <div className={styles.buttonGroup}>
                            <button className={styles.confirmButton} onClick={onClose}>
                                {confirmButtonText || defaultConfirmText}
                            </button>
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

export default GenerateResultModal;
