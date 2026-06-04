import React from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    message?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title = "确认操作",
    message = "请确认是否继续此操作？",
    confirmButtonText = "确认",
    cancelButtonText = "取消",
}) => {
    if (!isOpen) return null;

    const modalContent = (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.deleteModal}>
                    {/* 红色顶部区域 */}
                    <div className={styles.modalHeader}>
                        <div className={styles.headerContent}>
                            <div className={styles.titleIcon}>
                                <img 
                                    src={`${import.meta.env.BASE_URL}data/assets/create/弹框左上角图案.png`} 
                                    alt="confirm icon"
                                    className={styles.icon}
                                />
                            </div>
                            <h1 className={styles.title}>{title}</h1>
                            <button className={styles.closeButton} onClick={onCancel}>
                                <img 
                                    src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`} 
                                    alt="关闭" 
                                />
                            </button>
                        </div>
                    </div>
                    
                    {/* 白色内容区域 */}
                    <div className={styles.modalBody}>
                        <div className={styles.messageWrapper}>
                            <p className={styles.message}>{message}</p>
                        </div>
                        
                        <div className={styles.buttonGroup}>
                            <button className={styles.confirmButton} onClick={onConfirm}>
                                {confirmButtonText}
                            </button>
                            <button className={styles.cancelButton} onClick={onCancel}>
                                {cancelButtonText}
                            </button>
                        </div>
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

export default ConfirmModal;

