import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './PDFTemplateModal.module.css';

interface PDFTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface PDFFile {
    name: string;
    path: string;
}

const PDFTemplateModal: React.FC<PDFTemplateModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    const { t } = useTranslation();

    const pdfFiles: PDFFile[] = [
        {
            name: t('gameSettingEditor.pDFTemplateModal.sf6b9e95565'),
            path: t('gameSettingEditor.pDFTemplateModal.s6ec46feac6'),
        },
        {
            name: t('gameSettingEditor.pDFTemplateModal.s0bf7f7a0c7'),
            path: t('gameSettingEditor.pDFTemplateModal.s79580c45db'),
        },
        {
            name: t('gameSettingEditor.pDFTemplateModal.s4ff5c9c552'),
            path: t('gameSettingEditor.pDFTemplateModal.sdd52d5fb5a'),
        },
        {
            name: t('gameSettingEditor.pDFTemplateModal.sff3233b3bb'),
            path: t('gameSettingEditor.pDFTemplateModal.s78b2c96c71'),
        },
    ];

    const handleDownload = (filePath: string) => {
        try {
            const fullPath = `${import.meta.env.BASE_URL}${filePath.startsWith('/') ? filePath.slice(1) : filePath}`;
            const fileName = filePath.split('/').pop() || filePath;
            const link = document.createElement('a');
            link.href = fullPath;
            link.download = fileName;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(`${import.meta.env.BASE_URL}${filePath.startsWith('/') ? filePath.slice(1) : filePath}`, '_blank');
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalContent}>
                    <div className={styles.modalHeader}>
                        <h2 className={styles.modalTitle}>{t('createGame.funloomGuide')}</h2>
                        <button className={styles.closeButton} onClick={onClose}>
                            <img 
                                src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`} 
                            alt={t('common.close')} 
                            />
                        </button>
                    </div>
                    <div className={styles.modalBody}>
                        <div className={styles.pdfList}>
                            {pdfFiles.map((pdf, index) => (
                                <div key={index} className={styles.pdfItem}>
                                    <div className={styles.pdfInfo}>
                                        <div className={styles.pdfIcon}>📄</div>
                                        <span className={styles.pdfName}>{pdf.name}</span>
                                    </div>
                                    <button
                                        className={styles.downloadButton}
                                        onClick={() => handleDownload(pdf.path)}
                                    >
                                        {t('common.download')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PDFTemplateModal;

