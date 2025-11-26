import React from 'react';
import styles from './DeleteModal.module.css';

interface DeletModalProps {
    isOpen: boolean;
    onDelete: () => void;
    onCancel: () => void;
    title?: string;
    message?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
}

const DeletModal: React.FC<DeletModalProps> = ({
    isOpen,
    onDelete,
    onCancel,
    title = "删除作品",
    message = "删除后作品不可恢复，请谨慎操作！",
    confirmButtonText = "确认删除",
    cancelButtonText = "我再想想",
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onCancel}>
                    <img src={`${import.meta.env.BASE_URL}data/assets/关闭.png`} alt="关闭" />
                </button>
                <div className={styles.deletModal}>
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.message}>{message}</p>
                    <div className={styles.buttonGroup}>
                        <button className={styles.confirmButton} onClick={onDelete}>{confirmButtonText}</button>
                        <button className={styles.cancelButton} onClick={onCancel}>{cancelButtonText}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeletModal;