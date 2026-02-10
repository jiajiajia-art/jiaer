import React from 'react';
import { createPortal } from 'react-dom';
import styles from './SaveConfirmModal.module.css';

interface SaveConfirmModalProps {
    isOpen: boolean;
    onSave: () => void;
    onDiscard: () => void;
    onCancel: () => void;
    title?: string;
    message?: string;
    saveButtonText?: string;
    discardButtonText?: string;
}

const SaveConfirmModal: React.FC<SaveConfirmModalProps> = ({
    isOpen,
    onSave,
    onDiscard,
    onCancel,
    title = "未保存的修改",
    message = "您有未保存的修改，是否要保存？",
    saveButtonText = "保存",
    discardButtonText = "不保存",
}) => {
    if (!isOpen) return null;

    const modalContent = (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.saveModal}>
                    {/* 顶部区域 */}
                    <div className={styles.modalHeader}>
                        <div className={styles.headerContent}>
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
                            <button className={styles.discardButton} onClick={onDiscard}>
                                {discardButtonText}
                            </button>
                            <button className={styles.saveButton} onClick={onSave}>
                                {saveButtonText}
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

export default SaveConfirmModal;

