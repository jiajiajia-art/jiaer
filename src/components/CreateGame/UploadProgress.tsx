import React from 'react';
import styles from './UploadProgress.module.css';

interface UploadProgressProps {
    isOpen: boolean;
    progress: number;
    progressText: string;
    onCancel: () => void;
    // 可选：完成后不自动关闭，展示操作按钮
    completed?: boolean;
    primaryText?: string;
    secondaryText?: string;
    onPrimary?: () => void;
    onSecondary?: () => void;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
    isOpen,
    progress,
    progressText,
    onCancel,
    completed = false,
    primaryText = '确定',
    secondaryText = '开始测试',
    onPrimary,
    onSecondary,
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.uploadOverlay}>
            <div className={styles.uploadOverlayContent}>
                <h3 className={styles.uploadOverlayTitle}>正在创建作品</h3>

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
                    {progressText || '处理中...'}
                </p>

                {/* 操作区域 */}
                {completed ? (
                    <div className={styles.actionRow}>
                        <button type="button" className={styles.secondaryBtn} onClick={onPrimary}>{primaryText}</button>
                        <button type="button" className={styles.primaryBtn} onClick={onSecondary}>{secondaryText}</button>
                    </div>
                ) : (
                    <button
                        className={styles.cancelUploadBtn}
                        onClick={onCancel}
                        type="button"
                    >
                        取消上传
                    </button>
                )}
            </div>
        </div>
    );
};

export default UploadProgress;
