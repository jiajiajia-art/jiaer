import React from 'react';
import { createPortal } from 'react-dom';
import { MdContentCopy, MdQrCode2 } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import styles from './ShareModal.module.css';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCopyLink: () => void;
    onShowQRCode: () => void;
    /** 可选：底部举报入口（游戏详情） */
    onReport?: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({
    isOpen,
    onClose,
    onCopyLink,
    onShowQRCode,
    onReport,
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const handleCopyLink = () => {
        onCopyLink();
        onClose();
    };

    const handleShowQRCode = () => {
        onShowQRCode();
        onClose();
    };

    const handleReport = () => {
        onClose();
        onReport?.();
    };

    const modalContent = (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={styles.sheet}
                role="dialog"
                aria-modal="true"
                aria-label={t('gameDetail.shareMethods')}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.head}>
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        aria-label={t('common.close')}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 6L18 18M18 6L6 18" />
                        </svg>
                    </button>
                </div>
                <div className={styles.actions}>
                    <button type="button" className={styles.action} onClick={handleCopyLink}>
                        <span className={styles.tile}>
                            <MdContentCopy size={26} />
                        </span>
                        <span className={styles.label}>{t('gameDetail.copyLink')}</span>
                    </button>

                    <button type="button" className={styles.action} onClick={handleShowQRCode}>
                        <span className={styles.tile}>
                            <MdQrCode2 size={26} />
                        </span>
                        <span className={styles.label}>{t('gameDetail.generateQRCode')}</span>
                    </button>

                    {onReport ? (
                        <button type="button" className={styles.action} onClick={handleReport}>
                            <span className={styles.tile}>
                                <img
                                    className={styles.reportIcon}
                                    src={`${import.meta.env.BASE_URL}data/assetsv2/common/report.svg`}
                                    alt=""
                                />
                            </span>
                            <span className={styles.label}>{t('report.reportAction')}</span>
                        </button>
                    ) : null}
                </div>
                <button type="button" className={styles.cancel} onClick={onClose}>
                    {t('common.cancel')}
                </button>
            </div>
        </div>
    );

    if (typeof document === 'undefined') {
        return modalContent;
    }
    return createPortal(modalContent, document.body);
};

export default ShareModal;
