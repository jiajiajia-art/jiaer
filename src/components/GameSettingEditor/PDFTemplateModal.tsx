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
            name: 'Funloom创作指南',
            path: '/pdf/Funloom创作指南.pdf',
        },
        {
            name: '历史类模板-大唐科举之路',
            path: '/pdf/历史类模板-大唐科举之路.pdf',
        },
        {
            name: '都市类模板-杭城网红模拟器',
            path: '/pdf/都市类模板-杭城网红模拟器.pdf',
        },
        {
            name: 'AVG教程-崇祯模拟器',
            path: '/pdf/AVG教程-崇祯模拟器.zip',
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

