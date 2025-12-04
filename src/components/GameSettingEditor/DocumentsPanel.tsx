import React, { useRef, useState, useEffect, useCallback } from 'react';
import styles from './DocumentsPanel.module.css';
import { BsUpload } from 'react-icons/bs';

interface DocumentsPanelProps {
    onFileUpload: (file: File) => Promise<boolean>;
    isParsing: boolean;
    onParsingStart: () => void;
    onParsingComplete: () => void;
}

// 解析步骤配置（时间单位：秒）
const PARSING_STEPS = [
    { label: '上传完成', duration: 3 },
    { label: '解析世界观', duration: 180 },
    { label: '提取角色 / 场景', duration: 120 },
    { label: '生成剧情节点', duration: 120 },
];

const TOTAL_DURATION = PARSING_STEPS.reduce((sum, step) => sum + step.duration, 0);
const MAX_FAKE_PROGRESS = 95;

const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
    onFileUpload,
    isParsing,
    onParsingStart,
    onParsingComplete
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
    const [progress, setProgress] = useState<number>(0);
    const [apiCompleted, setApiCompleted] = useState<boolean>(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [isCompleted, setIsCompleted] = useState<boolean>(false);
    const progressIntervalRef = useRef<number | null>(null);
    const apiCompletedRef = useRef<boolean>(false);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            setApiError(null);
            setApiCompleted(false);
            apiCompletedRef.current = false;
            setIsCompleted(false);

            startParsing();

            try {
                const success = await onFileUpload(file);
                apiCompletedRef.current = true;
                setApiCompleted(true);
                if (!success) {
                    setApiError('文件上传或解析失败，请重试');
                }
            } catch (error) {
                apiCompletedRef.current = true;
                setApiCompleted(true);
                setApiError('文件上传或解析失败，请重试');
            }
        }
    };

    const handleDropzoneClick = () => {
        fileInputRef.current?.click();
    };

    const finishProgress = useCallback(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }

        let currentProgress = progress;
        const finishInterval = setInterval(() => {
            currentProgress += 2;
            if (currentProgress >= 100) {
                clearInterval(finishInterval);
                setProgress(100);
                setCurrentStepIndex(PARSING_STEPS.length);
                setIsCompleted(true);
                onParsingComplete();
            } else {
                setProgress(currentProgress);
                let accumulatedPercent = 0;
                for (let i = 0; i < PARSING_STEPS.length; i++) {
                    const stepPercent = (PARSING_STEPS[i].duration / TOTAL_DURATION) * 100;
                    if (currentProgress >= accumulatedPercent + stepPercent) {
                        accumulatedPercent += stepPercent;
                    } else {
                        setCurrentStepIndex(i);
                        break;
                    }
                }
            }
        }, 50);
    }, [progress, onParsingComplete]);

    const startParsing = useCallback(() => {
        onParsingStart();
        setCurrentStepIndex(0);
        setProgress(0);

        let elapsedTime = 0;
        const interval = 100;

        progressIntervalRef.current = window.setInterval(() => {
            elapsedTime += interval / 1000;

            const rawProgress = (elapsedTime / TOTAL_DURATION) * 100;
            const cappedProgress = Math.min(rawProgress, MAX_FAKE_PROGRESS);
            setProgress(cappedProgress);

            let accumulatedTime = 0;
            let stepIndex = 0;
            for (let i = 0; i < PARSING_STEPS.length; i++) {
                if (elapsedTime >= accumulatedTime + PARSING_STEPS[i].duration) {
                    accumulatedTime += PARSING_STEPS[i].duration;
                    stepIndex = i + 1;
                } else {
                    break;
                }
            }
            setCurrentStepIndex(Math.min(stepIndex, PARSING_STEPS.length - 1));

            if (rawProgress >= MAX_FAKE_PROGRESS) {
                if (apiCompletedRef.current) {
                    if (progressIntervalRef.current) {
                        clearInterval(progressIntervalRef.current);
                        progressIntervalRef.current = null;
                    }
                    finishProgress();
                }
            }
        }, interval);
    }, [onParsingStart, finishProgress]);

    useEffect(() => {
        if (apiCompleted && progress >= MAX_FAKE_PROGRESS && !isCompleted && !apiError) {
            finishProgress();
        }
    }, [apiCompleted, progress, isCompleted, apiError, finishProgress]);

    useEffect(() => {
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, []);

    const handleRetry = () => {
        setUploadedFile(null);
        setApiError(null);
        setApiCompleted(false);
        apiCompletedRef.current = false;
        setProgress(0);
        setCurrentStepIndex(-1);
        setIsCompleted(false);
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const getStepState = (index: number) => {
        if (apiError) return index === currentStepIndex ? 'error' : (index < currentStepIndex ? 'done' : '');
        if (currentStepIndex > index) return 'done';
        if (currentStepIndex === index) return 'active';
        return '';
    };

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 1</p>
                    <h2>上传设定文档 · 自动解析</h2>
                    <p className={styles.subtitle}>
                        一键上传 PDF / Word，系统自动拆解世界观、角色与剧情节点
                    </p>
                </div>
                <button className={styles.ghost}>查看解析历史</button>
            </div>

            <div className={styles.twoCol}>
                <div className={styles.card}>
                    <h3>文档导入</h3>
                    <p className={styles.muted}>
                        支持 PDF / Word（.docx），解析完成后将自动跳转到「世界观表单」
                    </p>

                    {!uploadedFile ? (
                        <div className={styles.dropzone} onClick={handleDropzoneClick}>
                            <BsUpload className={styles.uploadIcon} size={24} />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx"
                                hidden
                                onChange={handleFileSelect}
                            />
                            <div>
                                <p>拖拽文件或<span className={styles.link}>点击上传</span></p>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.uploadedFileBox}>
                            <span className={styles.fileName}>{uploadedFile.name}</span>
                            <span className={styles.fileSize}>{formatFileSize(uploadedFile.size)}</span>
                            {apiError && (
                                <span className={styles.retryLink} onClick={handleRetry}>重试</span>
                            )}
                        </div>
                    )}

                    {apiError && (
                        <p className={styles.errorText}>{apiError}</p>
                    )}

                    {isParsing && !apiError && (
                        <div className={styles.progressText}>
                            解析进度：{Math.round(progress)}%
                        </div>
                    )}

                    <ul className={styles.statusList}>
                        {PARSING_STEPS.map((step, index) => (
                            <li key={index} data-state={getStepState(index)}>
                                {step.label}
                            </li>
                        ))}
                    </ul>

                    <p className={styles.mutedSmall}>
                        {apiError
                            ? '解析失败，请点击重试。'
                            : isParsing
                                ? '正在解析中，请耐心等待...'
                                : isCompleted
                                    ? '解析完成！即将跳转到 Step 2...'
                                    : '解析完成后系统将自动为你打开 Step 2 继续校对。'
                        }
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DocumentsPanel;
