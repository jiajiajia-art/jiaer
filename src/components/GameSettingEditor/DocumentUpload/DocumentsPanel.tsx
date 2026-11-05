import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { IoChevronDown } from 'react-icons/io5';
import styles from './DocumentsPanel.module.css';
import { BsUpload, BsCheckCircle } from 'react-icons/bs';
import { HiOutlineGlobeAlt, HiOutlineUserGroup, HiOutlineMap, HiOutlineCheckCircle } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useUploadStore, type UploadJob } from '../../../store/uploadStore';
import CreateEmptyGameModal from './CreateEmptyGameModal';
import GenerateFromIdeaModal, { type IdeaGenerateOptions } from './GenerateFromIdeaModal';
import type { UploadResult } from '../../../hooks/editor/useFileUpload';
import { getUploadEtaText } from '../../../utils/etaText';
import { copyTextToClipboard } from '../../../utils/clipboard';
import { TXT_IDEA_GENERATE_COST } from '../../../utils/constants';
import type { IdeaGenerateMode } from '../../../lib/galgame/ideaFullWorkEstimate';

type CreateMethod = 'document' | 'idea';
interface DocumentsPanelProps {
    onFileUpload: (file: File) => Promise<UploadResult>;
    isParsing: boolean;
    onParsingStart: () => void;
    onParsingSuccess: () => void;
    onParsingFailed: () => void;
    fileId: string;
    onCreateEmptyGame?: (title: string) => Promise<void>;
    onGenerateFromIdea?: (idea: string, options: IdeaGenerateOptions) => Promise<boolean>;
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
    const { t } = useTranslation();
    const defaultParseErrorMessage = t('createGame.parseErrorDefault');
    const [showCreateEmptyModal, setShowCreateEmptyModal] = useState(false);
    const [showGenerateFromIdeaModal, setShowGenerateFromIdeaModal] = useState(false);
    const [ideaModalInitialMode, setIdeaModalInitialMode] = useState<IdeaGenerateMode>('text');
    /** 功能注释：移动端「选择创建方式」在文档导入 / 一句话生成间切换 */
    const [createMethod, setCreateMethod] = useState<CreateMethod>('document');
    const [createMethodMenuOpen, setCreateMethodMenuOpen] = useState(false);
    const createMethodSelectRef = useRef<HTMLDivElement>(null);
    const isVisualMode = mode === 'visual' || !mode;
    const canGenerateFromIdea = Boolean(isVisualMode && onGenerateFromIdea);

    const createMethodOptions = useMemo(
        () => [
            { value: 'document' as const, label: t('createGame.documentImport') },
            { value: 'idea' as const, label: t('createGame.aiGenerateFromIdea') },
        ],
        [t],
    );

    const createMethodLabel = createMethodOptions.find((item) => item.value === createMethod)?.label
        ?? t('createGame.documentImport');

    useEffect(() => {
        if (!createMethodMenuOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            if (!createMethodSelectRef.current?.contains(event.target as Node)) {
                setCreateMethodMenuOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setCreateMethodMenuOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [createMethodMenuOpen]);

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
            toast.error(t('createGame.uploadPdfOrWord'));
            return false;
        }
        return true;
    }, [t]);

    const openParseErrorModal = useCallback((errorDetail: string) => {
        // 实现解析失败弹窗展示
        setParseErrorModal({
            visible: true,
            message: defaultParseErrorMessage,
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
            stage: snapshot?.stage || t('createGame.uploadStage'),
            error: errorDetail,
        });
        openParseErrorModal(errorDetail);
        onParsingFailed();
    }, [onParsingFailed, openParseErrorModal, t, uploadedFile?.name]);

    const handleCopyErrorDetail = useCallback(async () => {
        const text = parseErrorModal.errorDetail;
        if (!text) {
            toast.error(t('createGame.noErrorToCopy'));
            return;
        }

        try {
            await copyTextToClipboard(text);
            toast.success(t('createGame.errorCopied'));
        } catch (error) {
            console.error('复制报错信息失败:', error);
            toast.error(t('createGame.copyFailedRetry'));
        }
    }, [parseErrorModal.errorDetail, t]);

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
            handleUploadFailure(result.error || t('createGame.uploadParseFailed'));
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
                currentJob.error || t('createGame.uploadParseFailed'),
                {
                    fileName: currentJob.fileName,
                    progress: currentJob.progress ?? 0,
                    stage: currentJob.stage || t('createGame.parseFailed'),
                },
            );
        }
    }, [currentJob, handleUploadFailure, isParsing, onParsingSuccess, t]);

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
    const stage = currentJob?.stage || failedJobSnapshot?.stage || (isUploading ? t('createGame.uploadStage') : '');
    const apiError =
        currentJob?.status === 'failed'
            ? (currentJob.error || t('createGame.uploadParseFailed'))
            : (failedJobSnapshot?.error || null);
    const uploadEtaText = getUploadEtaText({
        status: currentJob?.status,
        elapsedSeconds: currentJob?.elapsedSeconds,
        estimatedRemainingSeconds: currentJob?.estimatedRemainingSeconds,
        estimatedTotalSeconds: currentJob?.estimatedTotalSeconds,
    }, (key) => t(`eta.${key}`));

    const isIdeaJob = currentJob?.kind === 'idea';
    const parseSteps = useMemo(() => {
        // 功能注释：一句话生成与文档导入阶段同进度阈值，但文案用「生成」而非「解析」
        if (isIdeaJob) {
            return [
                {
                    id: 'world',
                    label: t('createGame.generatingWorld'),
                    progress: 30,
                    icon: HiOutlineGlobeAlt,
                    description: t('createGame.generatingWorldIdeaDesc'),
                },
                {
                    id: 'npc',
                    label: t('createGame.generatingNpc'),
                    progress: 55,
                    icon: HiOutlineUserGroup,
                    description: t('createGame.generatingNpcDesc'),
                },
                {
                    id: 'scene',
                    label: t('createGame.generatingScene'),
                    progress: 75,
                    icon: HiOutlineMap,
                    description: t('createGame.generatingSceneDesc'),
                },
                {
                    id: 'complete',
                    label: t('createGame.complete'),
                    progress: 100,
                    icon: HiOutlineCheckCircle,
                    description: t('createGame.generateCompleteDesc'),
                },
            ];
        }
        return [
            {
                id: 'world',
                label: t('createGame.generatingWorld'),
                progress: 30,
                icon: HiOutlineGlobeAlt,
                description: t('createGame.generatingWorldDesc'),
            },
            {
                id: 'npc',
                label: t('createGame.parsingNpc'),
                progress: 55,
                icon: HiOutlineUserGroup,
                description: t('createGame.parsingNpcDesc'),
            },
            {
                id: 'scene',
                label: t('createGame.parsingScene'),
                progress: 75,
                icon: HiOutlineMap,
                description: t('createGame.parsingSceneDesc'),
            },
            {
                id: 'complete',
                label: t('createGame.complete'),
                progress: 100,
                icon: HiOutlineCheckCircle,
                description: t('createGame.parseCompleteDesc'),
            },
        ];
    }, [isIdeaJob, t]);

    const getCurrentStepIndex = () => {
        if (progress >= 100) return 3;
        if (progress >= 75) return 2;
        if (progress >= 55) return 1;
        if (progress >= 30) return 0;
        return 0;
    };

    const currentStepIndex = getCurrentStepIndex();
    const isCompleted = currentJob?.status === 'completed';

    const openIdeaModal = useCallback((mode: IdeaGenerateMode) => {
        setIdeaModalInitialMode(mode);
        setShowGenerateFromIdeaModal(true);
    }, []);

    const handleGenerateFromIdeaSubmit = useCallback(async (idea: string, options: IdeaGenerateOptions) => {
        if (!onGenerateFromIdea) {
            return false;
        }

        resetParseFeedback();
        setCreateMethod('idea');
        setActiveParseStartedAt(Date.now());
        setUploadedFile(null);
        return onGenerateFromIdea(idea, options);
    }, [onGenerateFromIdea, resetParseFeedback]);

    const showLiveProgress = (isParsing || isUploading) && !apiError;

    const renderProgressSection = () => (
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
    );

    return (
        <div className={styles.panelContent} data-create-method={createMethod}>
            <div className={styles.panelHeader}>
                <div>
                    <h2>
                        {createMethod === 'idea' && canGenerateFromIdea
                            ? t('createGame.aiGenerateFromIdea')
                            : t('createGame.uploadDocument')}
                    </h2>
                    <p className={styles.subtitle}>
                        {createMethod === 'idea' && canGenerateFromIdea
                            ? t('createGame.aiIdeaDesc')
                            : t('createGame.oneClickUploadTip')}
                    </p>
                </div>
                {onCreateEmptyGame && (
                    <button
                        className={`${styles.ghost} ${styles.hideOnMobile}`}
                        onClick={() => setShowCreateEmptyModal(true)}
                        disabled={isParsing}
                    >
                        {t('createGame.withoutDocument')}
                    </button>
                )}
            </div>

            {/* 功能注释：移动端自定义暗色下拉，切换文档导入 / 一句话生成（禁原生 select 系统蓝框） */}
            {canGenerateFromIdea && (
                <div className={styles.createMethodBlock}>
                    <p className={styles.createMethodLabel}>{t('createGame.selectCreateMethod')}</p>
                    <div ref={createMethodSelectRef} className={styles.createMethodSelect}>
                        <button
                            type="button"
                            className={`${styles.createMethodTrigger} ${createMethodMenuOpen ? styles.createMethodTriggerOpen : ''}`}
                            disabled={isParsing}
                            aria-haspopup="listbox"
                            aria-expanded={createMethodMenuOpen}
                            aria-label={t('createGame.selectCreateMethod')}
                            onClick={() => {
                                if (isParsing) return;
                                setCreateMethodMenuOpen((open) => !open);
                            }}
                        >
                            <span className={styles.createMethodTriggerLabel}>{createMethodLabel}</span>
                            <IoChevronDown
                                className={`${styles.createMethodChevron} ${createMethodMenuOpen ? styles.createMethodChevronOpen : ''}`}
                                aria-hidden
                            />
                        </button>
                        {createMethodMenuOpen ? (
                            <ul className={styles.createMethodMenu} role="listbox" aria-label={t('createGame.selectCreateMethod')}>
                                {createMethodOptions.map((option) => {
                                    const selected = option.value === createMethod;
                                    return (
                                        <li key={option.value} role="presentation">
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={selected}
                                                className={`${styles.createMethodOption} ${selected ? styles.createMethodOptionSelected : ''}`}
                                                onClick={() => {
                                                    setCreateMethod(option.value);
                                                    setCreateMethodMenuOpen(false);
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : null}
                    </div>
                </div>
            )}

            {canGenerateFromIdea && (
                <div className={`${styles.generateFromIdeaCard} ${styles.ideaMethodPanel}`}>
                    <div className={styles.generateFromIdeaContent}>
                        <div className={styles.generateFromIdeaIcon}>✨</div>
                        <div className={styles.generateFromIdeaText}>
                            <h3 className={styles.generateFromIdeaTitle}>{t('createGame.aiGenerateFromIdea')}</h3>
                            <p className={styles.generateFromIdeaDesc}>
                                {t('createGame.aiIdeaDesc')}
                            </p>
                            <p className={styles.generateFromIdeaHint}>
                                {t('createGame.aiIdeaLaterHint')}
                            </p>
                        </div>
                        <div className={styles.generateFromIdeaActions}>
                            <button
                                type="button"
                                className={styles.generateFromIdeaSecondary}
                                onClick={() => openIdeaModal('text')}
                                disabled={isParsing}
                            >
                                {t('createGame.generateTextOnlyWithCost', { points: TXT_IDEA_GENERATE_COST })}
                            </button>
                            <button
                                type="button"
                                className={styles.generateFromIdeaButton}
                                onClick={() => openIdeaModal('full')}
                                disabled={isParsing}
                            >
                                {t('createGame.generateFullWorkCta')}
                            </button>
                        </div>
                    </div>
                    {/* 功能注释：一句话任务进度挂在本卡片下，避免误显在「文档导入」区 */}
                    {apiError && isIdeaJob ? (
                        <>
                            <p className={styles.errorText}>{t('createGame.uploadFailed', { error: apiError })}</p>
                            <div className={styles.progressSection}>
                                <div className={styles.progressHeader}>
                                    <span className={styles.progressPercentage}>
                                        {Math.round(progress)}%
                                    </span>
                                    {stage ? (
                                        <span className={styles.progressStage}>{stage}</span>
                                    ) : null}
                                </div>
                            </div>
                        </>
                    ) : null}
                    {showLiveProgress && isIdeaJob ? renderProgressSection() : null}
                </div>
            )}

            <div className={`${styles.twoCol} ${styles.documentMethodPanel}`}>
                <div className={styles.card}>
                    <h3>{t('createGame.documentImportWithCost')}</h3>
                    <p className={`${styles.muted} ${styles.hideOnMobile}`}>
                        {t('createGame.documentUploadTip')}
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
                                <p>{t('createGame.dragOrClickUpload')}</p>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.uploadedFileBox}>
                            <span className={styles.fileName}>{uploadedFile.name}</span>
                            <span className={styles.fileSize}>{formatFileSize(uploadedFile.size)}</span>
                            {apiError && !isIdeaJob ? (
                                <span className={styles.retryLink} onClick={handleRetry}>{t('common.retry')}</span>
                            ) : null}
                        </div>
                    )}

                    {apiError && !isIdeaJob ? (
                        <>
                            <p className={styles.errorText}>{t('createGame.uploadFailed', { error: apiError })}</p>
                            <div className={styles.progressSection}>
                                <div className={styles.progressHeader}>
                                    <span className={styles.progressPercentage}>
                                        {Math.round(progress)}%
                                    </span>
                                    {stage ? (
                                        <span className={styles.progressStage}>{stage}</span>
                                    ) : null}
                                </div>
                            </div>
                        </>
                    ) : null}

                    {showLiveProgress && !isIdeaJob ? renderProgressSection() : null}

                    {!isParsing && !apiError ? (
                        <p className={styles.mutedSmall}>
                            {t('createGame.step2AutoOpen')}
                        </p>
                    ) : null}
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
                    initialMode={ideaModalInitialMode}
                />
            )}

            {parseErrorModal.visible && typeof document !== 'undefined' && createPortal(
                <div className={styles.errorModalOverlay} onClick={closeParseErrorModal}>
                    <div className={styles.errorModalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.errorModalHeader}>
                            <div>
                                <p className={styles.errorModalEyebrow}>{t('createGame.parseFailed')}</p>
                                <h3>{t('createGame.pleaseReupload')}</h3>
                            </div>
                            <button
                                type="button"
                                className={styles.errorModalClose}
                                onClick={closeParseErrorModal}
                                aria-label={t('createGame.closeParseErrorModal')}
                            >
                                ×
                            </button>
                        </div>
                        <div className={styles.errorModalBody}>
                            <p className={styles.errorModalMessage}>{parseErrorModal.message}</p>
                            <div className={styles.errorDetailBlock}>
                                <div className={styles.errorDetailHeader}>
                                    <span>{t('createGame.errorInfo')}</span>
                                    <button
                                        type="button"
                                        className={styles.copyErrorButton}
                                        onClick={handleCopyErrorDetail}
                                    >
                                        {t('createGame.copyErrorDetail')}
                                    </button>
                                </div>
                                <pre className={styles.errorDetailText}>{parseErrorModal.errorDetail}</pre>
                            </div>
                            <p className={styles.errorModalHint}>
                                {t('createGame.copyErrorTip')}
                            </p>
                        </div>
                        <div className={styles.errorModalFooter}>
                            <button
                                type="button"
                                className={styles.errorModalPrimary}
                                onClick={closeParseErrorModal}
                            >
                                {t('common.close')}
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
