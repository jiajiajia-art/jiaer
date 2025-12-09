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
                <div className={styles.deleteModal}>
                    {/* 红色顶部区域 */}
                    <div className={styles.modalHeader}>
                        <div className={styles.headerContent}>
                            <div className={styles.titleIcon}>
                                <img 
                                    src={`${import.meta.env.BASE_URL}data/assets/create/弹框左上角图案.png`} 
                                    alt="删除图标"
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
                            <button className={styles.confirmButton} onClick={onDelete}>
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
};

export default DeletModal;