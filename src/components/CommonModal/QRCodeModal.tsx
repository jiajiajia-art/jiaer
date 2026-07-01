import React, { useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import styles from './QRCodeModal.module.css';

interface QRCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
    isOpen,
    onClose,
    url,
    title,
}) => {
    const { t } = useTranslation();
    const qrCodeRef = useRef<HTMLDivElement>(null);

    const handleDownload = useCallback(() => {
        const svg = document.getElementById('qr-code-svg');
        if (!svg) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();

        canvas.width = 400;
        canvas.height = 400;

        img.onload = () => {
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }

            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = `qrcode-${Date.now()}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        };

        img.onerror = () => {
            console.error('Failed to load SVG for QR code');
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }, []);

    if (!isOpen) return null;

    const displayTitle = title || t('createGame.game');

    const modalContent = (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>{displayTitle}</h2>
                        <button className={styles.closeButton} onClick={onClose}>
                            <img
                                src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`}
                                alt={t('common.close')}
                            />
                        </button>
                    </div>

                    <div className={styles.body}>
                        <div className={styles.qrContainer} ref={qrCodeRef}>
                            <QRCodeSVG
                                id="qr-code-svg"
                                value={url}
                                size={240}
                                level="H"
                                includeMargin={true}
                                bgColor="#ffffff"
                                fgColor="#000000"
                            />
                        </div>

                        <p className={styles.tip}>{t('gameDetail.scanToOpen')}</p>

                        <button className={styles.downloadButton} onClick={handleDownload}>
                            {t('gameDetail.downloadQRCode')}
                        </button>
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
