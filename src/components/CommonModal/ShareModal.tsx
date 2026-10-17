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
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>{t('gameDetail.shareMethods')}</h2>
                        <button
                            type="button"
                            className={styles.closeButton}
                            onClick={onClose}
                            aria-label={t('common.close')}
                        >
                            ×
                        </button>
                    </div>

                    <div className={styles.body}>
                        <button className={styles.shareOption} onClick={handleCopyLink}>
                            <div className={styles.iconWrapper}>
                                <MdContentCopy size={32} />
                            </div>
                            <div className={styles.optionText}>
                                <span className={styles.optionTitle}>{t('gameDetail.copyLink')}</span>
                                <span className={styles.optionDesc}>{t('gameDetail.copyLinkDesc')}</span>
                            </div>
                        </button>

                        <button className={styles.shareOption} onClick={handleShowQRCode}>
                            <div className={styles.iconWrapper}>
                                <MdQrCode2 size={32} />
                            </div>
                            <div className={styles.optionText}>
                                <span className={styles.optionTitle}>{t('gameDetail.generateQRCode')}</span>
                                <span className={styles.optionDesc}>{t('gameDetail.generateQRCodeDesc')}</span>
                            </div>
                        </button>

                        {onReport ? (
                            <button
                                type="button"
                                className={styles.shareOption}
                                onClick={handleReport}
                            >
                                <div className={styles.iconWrapper}>
                                    <img
                                        className={styles.reportIconImg}
                                        src={`${import.meta.env.BASE_URL}data/assetsv2/common/report.svg`}
                                        alt=""
                                    />
                                </div>
                                <div className={styles.optionText}>
                                    <span className={styles.optionTitle}>
                                        {t('report.reportAction')}
                                    </span>
                                    <span className={styles.optionDesc}>{t('report.reportFromShareDesc')}</span>
                                </div>
                            </button>
                        ) : null}
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

export default ShareModal;
