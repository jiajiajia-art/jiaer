import React from 'react';
import styles from './UploadProgress.module.css';

interface UploadProgressProps {
    isOpen: boolean;
    progress: number;
    progressText?: string;
    onCancel: () => void;
    completed?: boolean;
    primaryText?: string;
    secondaryText?: string;
    onPrimary?: () => void;
    onSecondary?: () => void;
    titleText?: string;
    cancelText?: string;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
    isOpen,
    progress,
    progressText,
    onCancel,
    completed = false,
    primaryText,
    secondaryText,
    onPrimary,
    onSecondary,
    titleText,
    cancelText,
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.uploadOverlay}>
            <div className={styles.uploadOverlayContent}>
                <h3 className={styles.uploadOverlayTitle}>{titleText}</h3>

                {/* 进度条 */}
                <div className={styles.uploadProgressContainer}>
                    <div className={styles.uploadProgressBar}>
                        <div
                            className={styles.uploadProgressFill}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className={styles.uploadProgressPercent}>
                        {Math.round(progress)}%
                    </div>
                </div>

                {/* 提示文字 */}
                <p className={styles.uploadOverlayText}>
                    {progressText}
                </p>

                {/* 操作区域 */}
                {completed ? (
                    <div className={styles.actionRow}>
                        <button
                            type="button"
                            className={onSecondary ? styles.secondaryBtn : styles.primaryBtn}
                            onClick={onPrimary}
                        >
                            {primaryText}
                        </button>
                        {onSecondary ? (
                            <button type="button" className={styles.primaryBtn} onClick={onSecondary}>{secondaryText}</button>
                        ) : null}
                    </div>
                ) : (
                    <button
                        className={styles.cancelUploadBtn}
                        onClick={onCancel}
                        type="button"
                    >
                        {cancelText}
                    </button>
                )}
            </div>
        </div>
    );
};

export default UploadProgress;
