import React, { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
    /** 功能注释：文案前导图标，提升按钮可识别性 */
    cancelIcon?: ReactNode;
    primaryIcon?: ReactNode;
    secondaryIcon?: ReactNode;
    /** 功能注释：仅上传成功后自动收起；上传中仍保留取消 */
    autoCloseOnComplete?: boolean;
    autoCloseDelayMs?: number;
}

const DEFAULT_AUTO_CLOSE_MS = 900;

function ButtonLabel({ icon, text }: { icon?: ReactNode; text?: ReactNode }) {
    return (
        <span className={styles.btnLabel}>
            {icon ? <span className={styles.btnIcon} aria-hidden="true">{icon}</span> : null}
            <span>{text}</span>
        </span>
    );
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
    cancelIcon,
    primaryIcon,
    secondaryIcon,
    autoCloseOnComplete = true,
    autoCloseDelayMs = DEFAULT_AUTO_CLOSE_MS,
}) => {
    const { t } = useTranslation();
    const resolvedCancelText = (cancelText && String(cancelText).trim()) || t('createGame.cancelUpload');
    const clamped = Math.min(100, Math.max(0, Number(progress) || 0));
    const showManualActions = completed && (!autoCloseOnComplete || Boolean(onSecondary));
    const onPrimaryRef = useRef(onPrimary);
    onPrimaryRef.current = onPrimary;

    // 功能注释：成功态短暂展示后自动关闭，避免再点「确定」；失败/进行中不触发
    useEffect(() => {
        if (!isOpen || !completed || !autoCloseOnComplete) return;
        const timer = window.setTimeout(() => {
            onPrimaryRef.current?.();
        }, Math.max(0, autoCloseDelayMs));
        return () => window.clearTimeout(timer);
    }, [isOpen, completed, autoCloseOnComplete, autoCloseDelayMs]);

    if (!isOpen) return null;

    return (
        <div className={styles.uploadOverlay} role="dialog" aria-modal="true" aria-live="polite">
            <div className={`${styles.uploadOverlayContent} ${completed ? styles.uploadOverlayContentDone : ''}`}>
                {titleText ? <h3 className={styles.uploadOverlayTitle}>{titleText}</h3> : null}

                <div className={styles.uploadProgressContainer}>
                    <div
                        className={`${styles.uploadProgressBar} ${completed ? styles.uploadProgressBarDone : ''}`}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(clamped)}
                    >
                        <div
                            className={`${styles.uploadProgressFill} ${completed ? styles.uploadProgressFillDone : ''}`}
                            style={{ width: `${clamped}%` }}
                        />
                    </div>
                    <div className={styles.uploadProgressPercent}>
                        {Math.round(clamped)}%
                    </div>
                </div>

                <p className={`${styles.uploadOverlayText} ${completed ? styles.uploadOverlayTextDone : ''}`}>
                    {progressText}
                </p>

                {completed ? (
                    showManualActions ? (
                        onSecondary ? (
                            <div className={styles.actionRow}>
                                {/* 功能注释：左取消收起，右主 CTA（立刻去测试） */}
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={onPrimary}
                                >
                                    <ButtonLabel icon={primaryIcon} text={primaryText || t('common.cancel')} />
                                </button>
                                <button
                                    type="button"
                                    className={styles.primaryBtn}
                                    onClick={onSecondary}
                                >
                                    <ButtonLabel icon={secondaryIcon} text={secondaryText} />
                                </button>
                            </div>
                        ) : (
                            <div className={styles.actionRow}>
                                <button
                                    type="button"
                                    className={styles.primaryBtn}
                                    onClick={onPrimary}
                                >
                                    <ButtonLabel icon={primaryIcon} text={primaryText} />
                                </button>
                            </div>
                        )
                    ) : (
                        <div className={styles.autoCloseHint} aria-hidden="true" />
                    )
                ) : (
                    <button
                        className={styles.cancelUploadBtn}
                        onClick={onCancel}
                        type="button"
                    >
                        <ButtonLabel icon={cancelIcon} text={resolvedCancelText} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default UploadProgress;
