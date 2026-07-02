import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { HOST_ADDRESS } from '../../config';
import styles from './QRCodeModal.module.css';

// 二维码 API 地址
const QR_CODE_API_URL = `${HOST_ADDRESS}/api/qrcode`;

interface QRCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
    isOpen,
    onClose,
    url,
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    // 生成后端二维码 API 的 URL
    const qrCodeUrl = `${QR_CODE_API_URL}?url=${encodeURIComponent(url)}`;

    const modalContent = (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modal}>
                    <button className={styles.closeButton} onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    <div className={styles.body}>
                        <div className={styles.qrContainer}>
                            <img
                                src={qrCodeUrl}
                                alt="QR Code"
                                className={styles.qrImage}
                            />
                        </div>

                        <p className={styles.longPressTip}>{t('gameDetail.longPressToSave')}</p>
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

export default QRCodeModal;
