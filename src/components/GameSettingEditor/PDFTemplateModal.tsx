import React from 'react';
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
    ];

    const handleDownload = (pdfPath: string, pdfName: string) => {
        try {
            // 使用完整的 URL，确保能正确访问 public 文件夹下的资源
            const fullPath = `${import.meta.env.BASE_URL}${pdfPath.startsWith('/') ? pdfPath.slice(1) : pdfPath}`;
            const link = document.createElement('a');
            link.href = fullPath;
            link.download = pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`;
            link.target = '_blank'; // 在新标签页打开，作为备用方案
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('下载 PDF 失败:', error);
            // 如果下载失败，尝试在新窗口打开
            window.open(`${import.meta.env.BASE_URL}${pdfPath.startsWith('/') ? pdfPath.slice(1) : pdfPath}`, '_blank');
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalContent}>
                    <div className={styles.modalHeader}>
                        <h2 className={styles.modalTitle}>Funloom 创作指南</h2>
                        <button className={styles.closeButton} onClick={onClose}>
                            <img 
                                src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`} 
                                alt="关闭" 
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
                                        onClick={() => handleDownload(pdf.path, pdf.name)}
                                    >
                                        下载
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

