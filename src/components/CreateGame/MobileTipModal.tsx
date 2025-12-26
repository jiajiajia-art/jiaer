import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './MobileTipModal.module.css';
import toast, { Toaster } from 'react-hot-toast';

interface MobileTipModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    icon?: string;
}

const MobileTipModal: React.FC<MobileTipModalProps> = ({
    isOpen,
    onClose,
    title = '提示',
    message,
    icon = '💻',
}) => {
    const url = 'https://kurangames.com/funloom/';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            toast.success('链接已复制到剪贴板');
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            // 降级方案：使用传统方法
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                toast.success('链接已复制到剪贴板');
                setTimeout(() => {
                    onClose();
                }, 1000);
            } catch (e) {
                console.error('复制失败:', e);
                toast.error('复制失败，请重试');
            }
            document.body.removeChild(textArea);
        }
    };
    useEffect(() => {
        if (isOpen && typeof document !== 'undefined') {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';

            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    // 处理 ESC 键关闭
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    if (typeof document === 'undefined') {
        return null;
    }

    const modalContent = (
        <div
            className={styles.mobileTipModalOverlay}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-tip-modal-title"
        >
            <Toaster
                position="top-center"
                containerStyle={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            />
            <div
                className={styles.mobileTipModal}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.mobileTipModalHeader}>
                    <div
                        className={styles.mobileTipModalTitle}
                        id="mobile-tip-modal-title"
                    >
                        {title}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className={styles.mobileTipCloseButton}
                        aria-label="关闭"
                    >
                        ×
                    </button>
                </div>
                <div className={styles.mobileTipModalContent}>
                    <div className={styles.mobileTipIcon} aria-hidden="true">{icon}</div>
                    <div className={styles.mobileTipText}>
                        {message}
                    </div>
                    <div className={styles.mobileTipInputContainer}>
                        <input 
                            className={styles.mobileTipInput} 
                            value={url}
                            readOnly
                        />
                        <button 
                            className={styles.mobileTipInputButton}
                            onClick={handleCopy}
                            type="button"
                        >
                            复制
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default MobileTipModal;

