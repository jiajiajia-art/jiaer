import React from "react";
import styles from "./WorldModal.module.css";

interface WorldModalProps {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    // 是否为“危险/主操作”风格（决定按钮顺序和样式）
    primaryType?: "confirm" | "cancel";
}

const WorldModal: React.FC<WorldModalProps> = ({
    visible,
    title,
    message,
    confirmText = "确定",
    cancelText = "取消",
    onConfirm,
    onCancel,
    primaryType = "confirm",
}) => {
    if (!visible) return null;

    const renderButtons = () => {
        const confirmBtn = (
            <button
                key="confirm"
                className={styles.globalModalPrimaryButton}
                onClick={onConfirm}
            >
                {confirmText}
            </button>
        );

        const cancelBtn = onCancel ? (
            <button
                key="cancel"
                className={styles.globalModalSecondaryButton}
                onClick={onCancel}
            >
                {cancelText}
            </button>
        ) : null;

        if (!cancelBtn) {
            return confirmBtn;
        }

        // primaryType 决定主按钮在右还是在左
        return primaryType === "confirm"
            ? (
                <>
                    {cancelBtn}
                    {confirmBtn}
                </>
            )
            : (
                <>
                    {confirmBtn}
                    {cancelBtn}
                </>
            );
    };

    return (
        <div className={styles.globalModalOverlay}>
            <div className={styles.globalModal}>
                <h3 className={styles.globalModalTitle}>{title}</h3>
                <div className={styles.globalModalContent}>
                    <p>{message}</p>
                </div>
                <div className={styles.globalModalActions}>
                    {renderButtons()}
                </div>
            </div>
        </div>
    );
};

export default WorldModal;


