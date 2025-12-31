import React, { useRef, useState, useEffect, useCallback } from 'react';
import styles from './DocumentsPanel.module.css';
import { BsUpload } from 'react-icons/bs';
import EditorApi from '../../../api/galgame/EditorData';
import toast from 'react-hot-toast';
import { useUploadStore } from '../../../store/uploadStore';
interface DocumentsPanelProps {
    onFileUpload: (file: File) => Promise<boolean>;
    isParsing: boolean;
    onParsingStart: () => void;
    onParsingComplete: () => void;
    fileId: string;
}

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
                {/* <button className={styles.ghost}>查看解析历史</button> */}
            </div>

            <div className={styles.twoCol}>
                <div className={styles.card}>
                    <h3>文档导入</h3>
                    <p className={styles.muted}>
                        支持 Word（.docx），解析完成后将自动跳转到「世界观表单」
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

                    {isParsing && !apiError && currentJob && (
                        <div className={styles.progressText}>
                            {stage ? `${stage}：` : '解析进度：'}{Math.round(progress)}%
                        </div>
                    )}

                    {/* {isParsing && !apiError && currentJob && (
                        <div className={styles.statusInfo}>
                            <p className={styles.statusText}>
                                {currentJob.status === 'uploading' && '正在上传文件...'}
                                {currentJob.status === 'processing' && (stage || '正在处理中...')}
                                {currentJob.status === 'completed' && '解析完成！'}
                            </p>
                        </div>
                    )} */}

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
