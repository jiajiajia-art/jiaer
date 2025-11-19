import React from 'react';
import styles from './UploadProgress.module.css';

interface UploadProgressProps {
    isOpen: boolean;
    progress: number;
    progressText: string;
    onCancel: () => void;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
    isOpen,
    progress,
    progressText,
    onCancel,
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.uploadOverlay}>
            <div className={styles.uploadOverlayContent}>
                <h3 className={styles.uploadOverlayTitle}>正在创建游戏</h3>

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

                {/* 取消按钮 */}
                <button
                    className={styles.cancelUploadBtn}
                    onClick={onCancel}
                    type="button"
                >
                    取消上传
                </button>
            </div>
        </div>
    );
};

export default UploadProgress;

