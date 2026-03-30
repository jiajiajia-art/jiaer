import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import styles from './MobileTipModal.module.css';

interface MobileTipModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    icon?: string;
    linkUrl?: string;
    copyButtonText?: string;
}

const MobileTipModal: React.FC<MobileTipModalProps> = ({
    isOpen,
    onClose,
    title = '提示',
    message,
    icon = '💻',
    linkUrl,
    copyButtonText = '复制',
}) => {
    const url = linkUrl || new URL(import.meta.env.BASE_URL, window.location.origin).href;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            toast.success('链接已复制到剪贴板');
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch {
            // 兼容剪贴板能力较弱的 WebView，降级到传统复制方案。
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
            } catch (execError) {
                console.error('复制失败:', execError);
                toast.error('复制失败，请稍后重试');
            }

            document.body.removeChild(textArea);
        }
    };

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') {
            return;
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen || typeof document === 'undefined') {
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
            <div
                className={styles.mobileTipModal}
                onClick={(event) => event.stopPropagation()}
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
                    <div className={styles.mobileTipIcon} aria-hidden="true">
                        {icon}
                    </div>
                    <div className={styles.mobileTipText}>{message}</div>
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
                            {copyButtonText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default MobileTipModal;
