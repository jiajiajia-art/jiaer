import React from 'react';
import styles from './AlertModal.module.css';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    message: string;
    title?: string;
}

const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, message }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.closeBtn} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </div>
                
                {/* <h2 className={styles.title}>{title}</h2> */}
                
                <div className={styles.message}>{message}</div>
                
                <button className={styles.confirmBtn} onClick={onClose}>
                    确定
                </button>
            </div>
        </div>
    );
};

export default AlertModal;

