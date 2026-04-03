import React from 'react';
import { createPortal } from 'react-dom';
import { BsCheckCircle } from 'react-icons/bs';
import { IoCashOutline, IoWalletOutline } from 'react-icons/io5';
import styles from './GenerateResultModal.module.css';

interface GenerateResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    generatedCount?: number;
    totalCount?: number;
    pointsDeducted?: number;
    remainingPoints?: number;
    confirmButtonText?: string;
}

const GenerateResultModal: React.FC<GenerateResultModalProps> = ({
    isOpen,
    onClose,
    title = "生成结果",
    generatedCount,
    totalCount,
    pointsDeducted,
    remainingPoints,
    confirmButtonText = "确定",
}) => {
    if (!isOpen) return null;

    const modalContent = (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modal}>
                    {/* 红色顶部区域 */}
                    <div className={styles.modalHeader}>
                        <div className={styles.headerContent}>
                            <div className={styles.titleIcon}>
                                <img
                                    src={`${import.meta.env.BASE_URL}data/assets/create/弹框左上角图案.png`}
                                    alt="结果图标"
                                    className={styles.icon}
                                />
                            </div>
                            <h1 className={styles.title}>{title}</h1>
                            <button className={styles.closeButton} onClick={onClose}>
                                <img
                                    src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`}
                                    alt="关闭"
                                />
                            </button>
                        </div>
                    </div>

                    {/* 白色内容区域 */}
                    <div className={styles.modalBody}>
                        {generatedCount !== undefined && totalCount !== undefined && (
                            <div className={styles.resultItem}>
                                <BsCheckCircle className={styles.resultIcon} style={{ color: '#22c55e' }} />
                                <span className={styles.resultText}>
                                    成功生成 {generatedCount}/{totalCount} 张图片
                                </span>
                            </div>
                        )}

                        {pointsDeducted !== undefined && (
                            <div className={styles.resultItem}>
                                <IoCashOutline className={styles.resultIcon} style={{ color: '#f59e0b' }} />
                                <span className={styles.resultText}>
                                    本次扣除 {pointsDeducted} 积分
                                </span>
                            </div>
                        )}

                        {remainingPoints !== undefined && (
                            <div className={styles.resultItem}>
                                <IoWalletOutline className={styles.resultIcon} style={{ color: '#6366f1' }} />
                                <span className={styles.resultText}>
                                    剩余 {remainingPoints} 积分
                                </span>
                            </div>
                        )}

                        <div className={styles.buttonGroup}>
                            <button className={styles.confirmButton} onClick={onClose}>
                                {confirmButtonText}
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

export default GenerateResultModal;
