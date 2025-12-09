import React, { useRef, useState, useEffect, useCallback } from 'react';
import styles from './DocumentsPanel.module.css';
import { BsUpload } from 'react-icons/bs';
import EditorApi from '../../api/galgame/EditorData';
import toast from 'react-hot-toast';
interface DocumentsPanelProps {
    onFileUpload: (file: File) => Promise<boolean>;
    isParsing: boolean;
    onParsingStart: () => void;
    onParsingComplete: () => void;
    fileId: string;
}

// 解析步骤配置（时间单位：秒）
const PARSING_STEPS = [
    { label: '上传完成', duration: 3 },
    { label: '解析世界观', duration: 60 },
    { label: '提取角色 / 场景', duration: 35 },
    { label: '生成剧情节点', duration: 22 },
];

const TOTAL_DURATION = PARSING_STEPS.reduce((sum, step) => sum + step.duration, 0); // 总共 120 秒（2 分钟）
const MAX_FAKE_PROGRESS = 95;

const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
    onFileUpload,
    isParsing,
    onParsingStart,
    onParsingComplete,
    fileId
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverUploading, setCoverUploading] = useState<boolean>(false);
    const [coverError, setCoverError] = useState<string | null>(null);
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

    const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // 验证文件类型
            if (!file.type.startsWith('image/')) {
                setCoverError('请上传图片文件');
                return;
            }
            // 验证文件大小（例如：最大 5MB）
            if (file.size > 5 * 1024 * 1024) {
                setCoverError('图片大小不能超过 5MB');
                return;
            }
            setCoverError(null);
            // 创建预览
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverPreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            // 上传封面
            uploadCover(file);
        }
    };

    const handleCoverClick = () => {
        coverInputRef.current?.click();
    };

    const handleRemoveCover = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCoverPreview(null);
        if (coverInputRef.current) {
            coverInputRef.current.value = '';
        }
    };

    const uploadCover = useCallback(async (file: File) => {
        if (!fileId) {
            setCoverError('缺少文件ID，无法上传封面');
            return;
        }
        try {
            setCoverUploading(true);
            setCoverError(null);
            const response = await EditorApi.uploadGameCover(fileId, file);
            if (response.data.success) {
                toast.success('封面上传成功');
            }
            console.log('封面上传成功:', response.data);
            setCoverUploading(false);
        } catch (error) {
            console.error('上传封面失败:', error);
            setCoverError('封面上传失败，请重试');
            setCoverUploading(false);
        }
    }, [fileId]);

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
        let hasReachedMaxProgress = false;

        progressIntervalRef.current = window.setInterval(() => {
            // 如果 API 已经完成，立即跳到 100%
            if (apiCompletedRef.current) {
                if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                }
                finishProgress();
                return;
            }

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

            // 如果到达最大进度但 API 还没完成，继续等待（延迟）
            if (rawProgress >= MAX_FAKE_PROGRESS && !hasReachedMaxProgress) {
                hasReachedMaxProgress = true;
                // 继续等待 API 完成，进度条保持在 95%
            }
        }, interval);
    }, [onParsingStart, finishProgress]);

    // 当 API 提前完成时，立即跳到 100%
    useEffect(() => {
        if (apiCompleted && !isCompleted && !apiError) {
            // 如果进度条还在运行，停止它并立即完成
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
            finishProgress();
        }
    }, [apiCompleted, isCompleted, apiError, finishProgress]);

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
                {/* <button className={styles.ghost}>查看解析历史</button> */}
            </div>

            <div className={styles.twoCol}>
                <div className={styles.card}>
                    <h3>文档导入</h3>
                    <p className={styles.muted}>
                        支持 PDF / Word（.docx），解析完成后将自动跳转到「世界观表单」
                    </p>

                    {!uploadedFile ? (
                        <div className={styles.dropzone} onClick={handleDropzoneClick}>
                            <BsUpload className={styles.coverUploadIcon} size={32} />
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
            <div className={styles.uploadCover}>
                {/* <p className={styles.eyebrow}>Step 1</p> */}
                <h2>游戏封面图片上传</h2>
                <div className={styles.coverUploadArea} onClick={handleCoverClick}>
                    <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,image/webp"
                        hidden
                        onChange={handleCoverSelect}
                        disabled={coverUploading || !fileId}
                    />
                    {coverPreview ? (
                        <div className={styles.coverPreviewContainer}>
                            <img src={coverPreview} alt="封面预览" className={styles.coverPreview} />
                            <div className={styles.coverActions}>
                                <button
                                    type="button"
                                    className={styles.removeCoverBtn}
                                    onClick={handleRemoveCover}
                                    disabled={coverUploading}
                                >
                                    移除
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.coverPlaceholder}>
                            <BsUpload className={styles.coverUploadIcon} size={32} />
                            <p className={styles.coverUploadText}>点击上传封面图片</p>
                            <p className={styles.coverUploadHint}>支持 JPG、PNG、WEBP，最大 5MB</p>
                        </div>
                    )}
                </div>
                {coverError && (
                    <p className={styles.coverErrorText}>{coverError}</p>
                )}
            </div>
        </div>
    );
};

export default DocumentsPanel;
