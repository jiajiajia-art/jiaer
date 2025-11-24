import React from 'react';
import styles from './DeleteModal.module.css';

interface DeletModalProps {
    isOpen: boolean;
    onDelete: () => void;
    onCancel: () => void;
}

const DeletModal: React.FC<DeletModalProps> = ({ isOpen, onDelete, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onCancel}>
                    <img src={`${import.meta.env.BASE_URL}data/assets/关闭.png`} alt="关闭" />
                </button>
                <div className={styles.deletModal}>
                    <h1 className={styles.title}>删除作品</h1>
                    <p className={styles.message}>删除后不可恢复，请谨慎操作！</p>
                    <div className={styles.buttonGroup}>
                        <button className={styles.confirmButton} onClick={onDelete}>确认删除</button>
                        <button className={styles.cancelButton} onClick={onCancel}>我再想想</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeletModal;