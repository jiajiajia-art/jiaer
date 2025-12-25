import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './MobileTipModal.module.css';

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
                </div>
                <div className={styles.mobileTipModalContent}>
                    <div className={styles.mobileTipIcon} aria-hidden="true">{icon}</div>
                    <div className={styles.mobileTipText}>
                        {message}
                    </div>
                </div>
                <div className={styles.mobileTipModalFooter}>
                    <button
                        type="button"
                        onClick={onClose}
                        className={styles.mobileTipConfirmButton}
                        autoFocus
                    >
                        知道了
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default MobileTipModal;

