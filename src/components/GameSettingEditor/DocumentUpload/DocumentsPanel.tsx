import React, { useRef, useState, useEffect } from 'react';
import styles from './DocumentsPanel.module.css';
import { BsUpload } from 'react-icons/bs';
import toast from 'react-hot-toast';
import { useUploadStore } from '../../../store/uploadStore';
import CreateEmptyGameModal from './CreateEmptyGameModal';
interface DocumentsPanelProps {
    onFileUpload: (file: File) => Promise<boolean>;
    isParsing: boolean;
    onParsingStart: () => void;
    onParsingComplete: () => void;
    fileId: string;
    onCreateEmptyGame?: (title: string) => Promise<void>;
    mode?: string;
}

const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
    onFileUpload,
    isParsing,
    onParsingStart,
    onParsingComplete,
    onCreateEmptyGame,
}) => {
    const [showCreateEmptyModal, setShowCreateEmptyModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const { jobs } = useUploadStore();
    const currentJobRef = useRef<string | null>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            onParsingStart();

            try {
                const success = await onFileUpload(file);
                if (!success) {
                    // 上传失败会在轮询状态中处理
                }
            } catch (error) {
                // 错误会在轮询状态中处理
            }
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

            try {
                const success = await onFileUpload(file);
                if (!success) {
                    // 上传失败会在轮询状态中处理
                }
            } catch (error) {
                // 错误会在轮询状态中处理
            }
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

            // 根据实际状态处理
            if (currentJob.status === 'completed') {
                // 完成
                onParsingComplete();
            } else if (currentJob.status === 'failed') {
                // 失败状态已在下方处理
            }
        }
    }, [jobs, uploadedFile, onParsingComplete]);

    const handleRetry = () => {
        setUploadedFile(null);
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
    const progress = currentJob?.progress || 0;
    const stage = currentJob?.stage || '';
    const apiError = currentJob?.status === 'failed' ? (currentJob.error || '文件上传或解析失败，请重试') : null;

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

                    {isParsing && !apiError && currentJob && (
                        <div className={styles.progressText}>
                            {stage ? `${stage}：` : '解析进度：'}{Math.round(progress)}%
                        </div>
                    )}

                    <p className={styles.mutedSmall}>
                        {apiError
                            ? '解析失败，请点击重试。'
                            : isParsing
                                ? currentJob?.status === 'completed'
                                    ? '解析完成！即将跳转到 Step 2...'
                                    : '正在解析中，请耐心等待...'
                                : '解析完成后系统将自动为你打开 Step 2 继续校对。'
                        }
                    </p>
                </div>
            </div>
            
            {onCreateEmptyGame && (
                <CreateEmptyGameModal
                    isOpen={showCreateEmptyModal}
                    onClose={() => setShowCreateEmptyModal(false)}
                    onSubmit={onCreateEmptyGame}
                />
            )}
        </div>
    );
};

export default DocumentsPanel;
