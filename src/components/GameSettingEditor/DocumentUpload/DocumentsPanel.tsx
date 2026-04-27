import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './DocumentsPanel.module.css';
import { BsUpload, BsCheckCircle } from 'react-icons/bs';
import { HiOutlineGlobeAlt, HiOutlineUserGroup, HiOutlineMap, HiOutlineCheckCircle } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useUploadStore, type UploadJob } from '../../../store/uploadStore';
import CreateEmptyGameModal from './CreateEmptyGameModal';
import GenerateFromIdeaModal from './GenerateFromIdeaModal';
import type { UploadResult } from '../../../hooks/editor/useFileUpload';
import { getUploadEtaText } from '../../../utils/etaText';

interface DocumentsPanelProps {
    onFileUpload: (file: File) => Promise<UploadResult>;
    isParsing: boolean;
    onParsingStart: () => void;
    onParsingSuccess: () => void;
    onParsingFailed: () => void;
    fileId: string;
    onCreateEmptyGame?: (title: string) => Promise<void>;
    onGenerateFromIdea?: (idea: string) => Promise<boolean>;
    mode?: string;
}

interface FailedJobSnapshot {
    fileName?: string;
    progress: number;
    stage: string;
    error: string;
}

interface ParseErrorModalState {
    visible: boolean;
    message: string;
    errorDetail: string;
}

const DEFAULT_PARSE_ERROR_MESSAGE = '由于网络波动导致上传失败，请再次重试';

const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
    onFileUpload,
    isParsing,
    onParsingStart,
    onParsingSuccess,
    onParsingFailed,
    onCreateEmptyGame,
    onGenerateFromIdea,
    mode,
}) => {
    const [showCreateEmptyModal, setShowCreateEmptyModal] = useState(false);
    const [showGenerateFromIdeaModal, setShowGenerateFromIdeaModal] = useState(false);
    const isVisualMode = mode === 'visual' || !mode;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handledJobStateRef = useRef<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [activeParseStartedAt, setActiveParseStartedAt] = useState<number | null>(null);
    const [failedJobSnapshot, setFailedJobSnapshot] = useState<FailedJobSnapshot | null>(null);
    const [parseErrorModal, setParseErrorModal] = useState<ParseErrorModalState>({
        visible: false,
        message: '',
        errorDetail: '',
    });
    const { jobs } = useUploadStore();

    const validateFileType = useCallback((file: File) => {
        const validTypes = ['.pdf', '.docx'];
        const fileName = file.name.toLowerCase();
        const isValidType = validTypes.some((type) => fileName.endsWith(type));
        if (!isValidType) {
            toast.error('请上传 PDF 或 Word (.docx) 文件');
            return false;
        }
        return true;
    }, []);

    const openParseErrorModal = useCallback((errorDetail: string) => {
        // 实现解析失败弹窗展示
        setParseErrorModal({
            visible: true,
            message: DEFAULT_PARSE_ERROR_MESSAGE,
            errorDetail,
        });
    }, []);

    const closeParseErrorModal = useCallback(() => {
        setParseErrorModal((prev) => ({
            ...prev,
            visible: false,
        }));
    }, []);

    const resetParseFeedback = useCallback(() => {
        // 清理上一次 Step 1 的临时状态，避免复用旧任务结果。
        setFailedJobSnapshot(null);
        setParseErrorModal({
            visible: false,
            message: '',
            errorDetail: '',
        });
        handledJobStateRef.current = null;
    }, []);

    const handleUploadFailure = useCallback((errorDetail: string, snapshot?: Partial<FailedJobSnapshot>) => {
        // 实现解析失败状态同步
        setFailedJobSnapshot({
            fileName: snapshot?.fileName || uploadedFile?.name,
            progress: snapshot?.progress ?? 0,
            stage: snapshot?.stage || '上传失败',
            error: errorDetail,
        });
        openParseErrorModal(errorDetail);
        onParsingFailed();
    }, [onParsingFailed, openParseErrorModal, uploadedFile?.name]);

    const handleCopyErrorDetail = useCallback(async () => {
        const text = parseErrorModal.errorDetail;
        if (!text) {
            toast.error('没有可复制的报错信息');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            toast.success('报错信息已复制');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();

            try {
                document.execCommand('copy');
                toast.success('报错信息已复制');
            } catch (copyError) {
                console.error('复制报错信息失败:', copyError || error);
                toast.error('复制失败，请稍后重试');
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }, [parseErrorModal.errorDetail]);

    const startUpload = useCallback(async (file: File) => {
        if (!validateFileType(file)) {
            return;
        }

        resetParseFeedback();
        setActiveParseStartedAt(Date.now());
        setUploadedFile(file);
        onParsingStart();

        const result = await onFileUpload(file);
        if (!result.success) {
            handleUploadFailure(result.error || '文件上传或解析失败，请重试');
            return;
        }

        if (result.completedImmediately) {
            setFailedJobSnapshot(null);
            onParsingSuccess();
        }
    }, [handleUploadFailure, onFileUpload, onParsingStart, onParsingSuccess, resetParseFeedback, validateFileType]);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        // 记录点击上传入口状态
        console.log('[DocumentsPanel] File selected:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
        });

        await startUpload(file);
    };

    const handleDropzoneClick = () => {
        fileInputRef.current?.click();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const file = e.dataTransfer.files?.[0];
        if (!file) {
            return;
        }

        // 记录拖拽上传入口状态
        console.log('[DocumentsPanel] File dropped:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
        });

        await startUpload(file);
    };

    const getLatestJob = useCallback((jobList: UploadJob[]) => {
        if (jobList.length === 0) {
            return null;
        }

        return jobList.reduce((latestJob, job) => (
            job.startTime >= latestJob.startTime ? job : latestJob
        ));
    }, []);

    const jobList = useMemo(() => Object.values(jobs), [jobs]);

    const currentJob = useMemo(() => {
        if (activeParseStartedAt === null) {
            return null;
        }

        const scopedJobs = jobList.filter((job) => job.startTime >= activeParseStartedAt);

        if (scopedJobs.length === 0) {
            return null;
        }

        const activeJobs = scopedJobs.filter(
            (job) => job.status === 'uploading' || job.status === 'processing',
        );
        const candidateJobs = activeJobs.length > 0 ? activeJobs : scopedJobs;

        if (uploadedFile?.name) {
            const matchedJobs = candidateJobs.filter((job) => job.fileName === uploadedFile.name);
            if (matchedJobs.length > 0) {
                return getLatestJob(matchedJobs);
            }
        }

        return getLatestJob(candidateJobs);
    }, [activeParseStartedAt, getLatestJob, jobList, uploadedFile?.name]);

    useEffect(() => {
        if (!isParsing || !currentJob) {
            return;
        }

        const handledStateKey = `${currentJob.jobId}-${currentJob.status}`;
        if (handledJobStateRef.current === handledStateKey) {
            return;
        }

        if (currentJob.status === 'completed') {
            handledJobStateRef.current = handledStateKey;
            setFailedJobSnapshot(null);
            onParsingSuccess();
            return;
        }

        if (currentJob.status === 'failed') {
            handledJobStateRef.current = handledStateKey;
            handleUploadFailure(
                currentJob.error || '文件上传或解析失败，请重试',
                {
                    fileName: currentJob.fileName,
                    progress: currentJob.progress ?? 0,
                    stage: currentJob.stage || '解析失败',
                },
            );
        }
    }, [currentJob, handleUploadFailure, isParsing, onParsingSuccess]);

    const handleRetry = () => {
        resetParseFeedback();
        setActiveParseStartedAt(null);
        setUploadedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isUploading = isParsing && !currentJob && uploadedFile;
    const progress = (currentJob?.progress ?? failedJobSnapshot?.progress) ?? 0;
    const stage = currentJob?.stage || failedJobSnapshot?.stage || (isUploading ? '正在上传文件...' : '');
    const apiError =
        currentJob?.status === 'failed'
            ? (currentJob.error || '文件上传或解析失败，请重试')
            : (failedJobSnapshot?.error || null);
    const uploadEtaText = getUploadEtaText({
        status: currentJob?.status,
        elapsedSeconds: currentJob?.elapsedSeconds,
        estimatedRemainingSeconds: currentJob?.estimatedRemainingSeconds,
        estimatedTotalSeconds: currentJob?.estimatedTotalSeconds,
    });

    const parseSteps = useMemo(() => [
        {
            id: 'world',
            label: '生成世界',
            progress: 30,
            icon: HiOutlineGlobeAlt,
            description: '正在分析文档结构，生成世界观设定...',
        },
        {
            id: 'npc',
            label: '解析NPC',
            progress: 55,
            icon: HiOutlineUserGroup,
            description: '正在提取角色信息，构建 NPC 数据...',
        },
        {
            id: 'scene',
            label: '解析场景',
            progress: 75,
            icon: HiOutlineMap,
            description: '正在识别场景描述，整理场景节点...',
        },
        {
            id: 'complete',
            label: '完成',
            progress: 100,
            icon: HiOutlineCheckCircle,
            description: '解析完成，准备跳转到下一步...',
        },
    ], []);

    const getCurrentStepIndex = () => {
        if (progress >= 100) return 3;
        if (progress >= 75) return 2;
        if (progress >= 55) return 1;
        if (progress >= 30) return 0;
        return 0;
    };

    const currentStepIndex = getCurrentStepIndex();
    const isCompleted = currentJob?.status === 'completed';

    const handleGenerateFromIdeaSubmit = useCallback(async (idea: string) => {
        if (!onGenerateFromIdea) {
            return false;
        }

        resetParseFeedback();
        setActiveParseStartedAt(Date.now());
        setUploadedFile(null);
        return onGenerateFromIdea(idea);
    }, [onGenerateFromIdea, resetParseFeedback]);

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 1</p>
                    <h2>上传设定文档 · 自动解析</h2>
                    <p className={styles.subtitle}>
                        一键上传 PDF / Word（.pdf / .docx），系统自动拆解世界观、角色与剧情节点
                    </p>
                </div>
                {onCreateEmptyGame && (
                    <button
                        className={styles.ghost}
                        onClick={() => setShowCreateEmptyModal(true)}
                        disabled={isParsing}
                    >
                        无文档，直接填写
                    </button>
                )}
            </div>

            {isVisualMode && onGenerateFromIdea && (
                <div className={styles.generateFromIdeaCard}>
                    <div className={styles.generateFromIdeaContent}>
                        <div className={styles.generateFromIdeaIcon}>✨</div>
                        <div className={styles.generateFromIdeaText}>
                            <h3 className={styles.generateFromIdeaTitle}>AI 一句话生成游戏</h3>
                            <p className={styles.generateFromIdeaDesc}>
                                输入你的游戏创意，AI 自动生成完整的游戏设定文档
                            </p>
                        </div>
                        <button
                            className={styles.generateFromIdeaButton}
                            onClick={() => setShowGenerateFromIdeaModal(true)}
                            disabled={isParsing}
                        >
                            立即生成
                        </button>
                    </div>
                </div>
            )}

            <div className={styles.twoCol}>
                <div className={styles.card}>
                    <h3>文档导入</h3>
                    <p className={styles.muted}>
                        支持 PDF / Word（.pdf / .docx），解析完成后将自动跳转到「世界观表单」
                    </p>

                    {!uploadedFile ? (
                        <div
                            className={styles.dropzone}
                            onClick={handleDropzoneClick}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
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
                        <>
                            <p className={styles.errorText}>上传失败：{apiError}</p>
                            <div className={styles.progressSection}>
                                <div className={styles.progressHeader}>
                                    <span className={styles.progressPercentage}>
                                        {Math.round(progress)}%
                                    </span>
                                    {stage && (
                                        <span className={styles.progressStage}>{stage}</span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {(isParsing || isUploading) && !apiError && (
                        <div className={styles.progressSection}>
                            <div className={styles.progressHeader}>
                                <span className={styles.progressPercentage}>
                                    {Math.round(progress)}%
                                </span>
                                {stage && (
                                    <span className={styles.progressStage}>{stage}</span>
                                )}
                            </div>
                            {uploadEtaText && (
                                <div className={styles.progressMeta}>{uploadEtaText}</div>
                            )}

                            <div className={styles.stepsIndicator}>
                                {parseSteps.map((step, index) => {
                                    const StepIcon = step.icon;
                                    const isActive = index === currentStepIndex && !isCompleted;
                                    const isDone = index < currentStepIndex || (isCompleted && index === 3);

                                    return (
                                        <div
                                            key={step.id}
                                            className={`${styles.stepItem} ${
                                                isActive ? styles.stepActive :
                                                isDone ? styles.stepDone :
                                                styles.stepPending
                                            }`}
                                        >
                                            <div className={styles.stepIconWrapper}>
                                                <div className={styles.stepIcon}>
                                                    {isDone ? <BsCheckCircle /> : <StepIcon />}
                                                </div>
                                                {index < parseSteps.length - 1 && (
                                                    <div
                                                        className={`${styles.stepConnector} ${
                                                            isDone ? styles.stepConnectorDone : ''
                                                        }`}
                                                    />
                                                )}
                                            </div>
                                            <div className={styles.stepContent}>
                                                <span className={styles.stepLabel}>{step.label}</span>
                                                {isActive && (
                                                    <span className={styles.stepDescription}>
                                                        {step.description}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {!isParsing && !apiError && (
                        <p className={styles.mutedSmall}>
                            解析完成后系统将自动为你打开 Step 2 继续校对。
                        </p>
                    )}
                </div>
            </div>

            {onCreateEmptyGame && (
                <CreateEmptyGameModal
                    isOpen={showCreateEmptyModal}
                    onClose={() => setShowCreateEmptyModal(false)}
                    onSubmit={onCreateEmptyGame}
                />
            )}

            {isVisualMode && onGenerateFromIdea && (
                <GenerateFromIdeaModal
                    isOpen={showGenerateFromIdeaModal}
                    onClose={() => setShowGenerateFromIdeaModal(false)}
                    onSubmit={handleGenerateFromIdeaSubmit}
                />
            )}

            {parseErrorModal.visible && typeof document !== 'undefined' && createPortal(
                <div className={styles.errorModalOverlay} onClick={closeParseErrorModal}>
                    <div className={styles.errorModalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.errorModalHeader}>
                            <div>
                                <p className={styles.errorModalEyebrow}>解析失败</p>
                                <h3>请重新上传文档</h3>
                            </div>
                            <button
                                type="button"
                                className={styles.errorModalClose}
                                onClick={closeParseErrorModal}
                                aria-label="关闭解析失败弹窗"
                            >
                                ×
                            </button>
                        </div>
                        <div className={styles.errorModalBody}>
                            <p className={styles.errorModalMessage}>{parseErrorModal.message}</p>
                            <div className={styles.errorDetailBlock}>
                                <div className={styles.errorDetailHeader}>
                                    <span>异常信息</span>
                                    <button
                                        type="button"
                                        className={styles.copyErrorButton}
                                        onClick={handleCopyErrorDetail}
                                    >
                                        复制报错信息
                                    </button>
                                </div>
                                <pre className={styles.errorDetailText}>{parseErrorModal.errorDetail}</pre>
                            </div>
                            <p className={styles.errorModalHint}>
                                如果多次报错，请复制这个报错信息给技术人员
                            </p>
                        </div>
                        <div className={styles.errorModalFooter}>
                            <button
                                type="button"
                                className={styles.errorModalPrimary}
                                onClick={closeParseErrorModal}
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};

export default DocumentsPanel;
