import React, { useRef, useState, useEffect, useMemo } from 'react';
import styles from './DocumentsPanel.module.css';
import { BsUpload, BsCheckCircle } from 'react-icons/bs';
import { HiOutlineGlobeAlt, HiOutlineUserGroup, HiOutlineMap, HiOutlineCheckCircle } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useUploadStore } from '../../../store/uploadStore';
import CreateEmptyGameModal from './CreateEmptyGameModal';
import GenerateFromIdeaModal from './GenerateFromIdeaModal';
interface DocumentsPanelProps {
    onFileUpload: (file: File) => Promise<boolean>;
    isParsing: boolean;
    onParsingStart: () => void;
    onParsingComplete: () => void;
    fileId: string;
    onCreateEmptyGame?: (title: string) => Promise<void>;
    onGenerateFromIdea?: (idea: string) => Promise<boolean>;
    mode?: string;
}

const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
    onFileUpload,
    isParsing,
    onParsingStart,
    onParsingComplete,
    onCreateEmptyGame,
    onGenerateFromIdea,
    mode,
}) => {
    const [showCreateEmptyModal, setShowCreateEmptyModal] = useState(false);
    const [showGenerateFromIdeaModal, setShowGenerateFromIdeaModal] = useState(false);
    const isVisualMode = mode === 'visual' || !mode; // 默认为 visual 模式
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const { jobs } = useUploadStore();
    const currentJobRef = useRef<string | null>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            onParsingStart();
            await onFileUpload(file);
        }
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
        if (file) {
            // 验证文件类型
            const validTypes = ['.pdf', '.docx'];
            const fileName = file.name.toLowerCase();
            const isValidType = validTypes.some(type => fileName.endsWith(type));
            
            if (!isValidType) {
                toast.error('请上传 PDF 或 Word (.docx) 文件');
                return;
            }
            
            setUploadedFile(file);
            onParsingStart();
            await onFileUpload(file);
        }
    };


    // 监听 uploadStore 中的任务状态，使用后端返回的真实状态
    useEffect(() => {
        const jobList = Object.values(jobs);
        if (jobList.length === 0) {
            return;
        }

        // 找到当前文件对应的任务（通过文件名匹配，或使用最新的任务）
        const currentJob = jobList.find(job => 
            job.fileName === uploadedFile?.name
        ) || jobList[jobList.length - 1];

        if (currentJob) {
            currentJobRef.current = currentJob.jobId;
            if (currentJob.status === 'completed') {
                onParsingComplete();
            } else if (currentJob.status === 'failed') {
                // 上传失败时，清空已上传的文档，让用户可以重新上传
                setUploadedFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                currentJobRef.current = null;
            }
        }
    }, [jobs, uploadedFile, onParsingComplete]);

    const handleRetry = () => {
        setUploadedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        currentJobRef.current = null;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // 获取当前任务的状态信息
    const getCurrentJob = () => {
        const jobList = Object.values(jobs);
        if (jobList.length === 0) return null;
        return jobList.find(job => 
            job.fileName === uploadedFile?.name
        ) || jobList[jobList.length - 1];
    };

    const currentJob = getCurrentJob();
    // 如果正在解析但没有 jobId（还在上传中），显示上传状态
    const isUploading = isParsing && !currentJob && uploadedFile;
    const progress = currentJob?.progress ?? 0; // 还没拿到 jobId 时保持 0%，避免“假进度”
    const stage = currentJob?.stage || (isUploading ? '正在上传文件...' : '');
    const apiError = currentJob?.status === 'failed' ? (currentJob.error || '文件上传或解析失败，请重试') : null;

    // 定义解析步骤
    const parseSteps = useMemo(() => [
        { 
            id: 'world', 
            label: '生成世界', 
            progress: 30,
            icon: HiOutlineGlobeAlt,
            description: '正在分析文档结构，生成世界观设定...'
        },
        { 
            id: 'npc', 
            label: '解析NPC', 
            progress: 55,
            icon: HiOutlineUserGroup,
            description: '正在提取角色信息，构建NPC数据...'
        },
        { 
            id: 'scene', 
            label: '解析场景', 
            progress: 75,
            icon: HiOutlineMap,
            description: '正在识别场景描述，整理场景节点...'
        },
        { 
            id: 'complete', 
            label: '完成', 
            progress: 100,
            icon: HiOutlineCheckCircle,
            description: '解析完成，准备跳转到下一步...'
        }
    ], []);

    // 根据进度判断当前步骤
    const getCurrentStepIndex = () => {
        if (progress >= 100) return 3;
        if (progress >= 75) return 2;
        if (progress >= 55) return 1;
        if (progress >= 30) return 0;
        return 0;
    };

    const currentStepIndex = getCurrentStepIndex();
    const isCompleted = currentJob?.status === 'completed';

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

            {/* 一句话生成 - 更突出的展示 */}
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
                        支持 Word（.docx），解析完成后将自动跳转到「世界观表单」
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
                        <p className={styles.errorText}>{apiError}</p>
                    )}

                    {(isParsing || isUploading) && !apiError && (
                        <div className={styles.progressSection}>
                            {/* 进度百分比和阶段 */}
                            <div className={styles.progressHeader}>
                                <span className={styles.progressPercentage}>
                                    {Math.round(progress)}%
                                </span>
                                {stage && (
                                    <span className={styles.progressStage}>{stage}</span>
                                )}
                            </div>

                            {/* 步骤指示器 */}
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
                                                    {isDone ? (
                                                        <BsCheckCircle />
                                                    ) : (
                                                        <StepIcon />
                                                    )}
                                                </div>
                                                {index < parseSteps.length - 1 && (
                                                    <div className={`${styles.stepConnector} ${
                                                        isDone ? styles.stepConnectorDone : ''
                                                    }`} />
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
                    onSubmit={onGenerateFromIdea}
                />
            )}
        </div>
    );
};

export default DocumentsPanel;
