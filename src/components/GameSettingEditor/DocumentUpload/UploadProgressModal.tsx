import React, { useState, useEffect } from 'react';
import { useUploadStore } from '../../../store/uploadStore';
import styles from './UploadProgressModal.module.css';
import { getUploadEtaText } from '../../../utils/etaText';

const UploadProgressModal: React.FC = () => {
    const { jobs, showProgressModal, setShowProgressModal, isMinimized, setIsMinimized, removeJob } = useUploadStore();
    const [currentTime, setCurrentTime] = useState(Date.now()); // 用于每秒更新时间显示
    
    const jobList = Object.values(jobs);
    
    // 每秒更新时间，确保时间显示实时更新
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);
        
        return () => clearInterval(interval);
    }, []);
    
    // 如果没有任务，不显示
    if (jobList.length === 0) return null;
    
    // 如果没有活跃任务且弹窗已关闭，不显示
    const hasActiveJobs = jobList.some(
        job => job.status === 'uploading' || job.status === 'processing'
    );
    
    // 如果有活跃任务，自动显示；如果没有活跃任务但用户手动打开，也显示
    if (!hasActiveJobs && !showProgressModal) return null;
    
    const getStatusText = (status: string) => {
        switch (status) {
            case 'uploading':
                return '上传中';
            case 'processing':
                return '解析中';
            case 'completed':
                return '完成';
            case 'failed':
                return '失败';
            default:
                return '处理中';
        }
    };
    
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'uploading':
            case 'processing':
                return '#FB4655';
            case 'completed':
                return '#22C55E';
            case 'failed':
                return '#ff4d4f';
            default:
                return '#FB4655';
        }
    };
    
    const formatTime = (timestamp: number) => {
        const seconds = Math.floor((currentTime - timestamp) / 1000);
        if (seconds < 60) return `${seconds}秒`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}分${remainingSeconds}秒`;
    };
    
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.title}>文件上传进度</h2>
                    <div className={styles.headerActions}>
                        <button 
                            className={styles.minimizeButton}
                            onClick={() => setIsMinimized(!isMinimized)}
                            title={isMinimized ? '展开' : '最小化'}
                        >
                            {isMinimized ? '▲' : '▼'}
                        </button>
                        <button 
                            className={styles.closeButton} 
                            onClick={() => setShowProgressModal(false)}
                            title="关闭"
                        >
                            <img 
                                src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`} 
                                alt="关闭" 
                            />
                        </button>
                    </div>
                </div>
                
                {!isMinimized && (
                    <div className={styles.modalBody}>
                    {jobList.map((job) => {
                        const etaText = getUploadEtaText({
                            status: job.status,
                            elapsedSeconds: job.elapsedSeconds,
                            estimatedRemainingSeconds: job.estimatedRemainingSeconds,
                            estimatedTotalSeconds: job.estimatedTotalSeconds,
                        });

                        return (
                        <div key={job.jobId} className={styles.jobItem}>
                            <div className={styles.jobHeader}>
                                <div className={styles.jobInfo}>
                                    <span className={styles.fileName} title={job.fileName}>
                                        {job.fileName}
                                    </span>
                                    <span 
                                        className={styles.status} 
                                        style={{ color: getStatusColor(job.status) }}
                                    >
                                        {getStatusText(job.status)}
                                    </span>
                                </div>
                                {job.status === 'completed' || job.status === 'failed' ? (
                                    <button 
                                        className={styles.removeButton}
                                        onClick={() => removeJob(job.jobId)}
                                    >
                                        移除
                                    </button>
                                ) : null}
                            </div>
                            
                            <div className={styles.progressContainer}>
                                <div className={styles.progressBar}>
                                    <div 
                                        className={styles.progressFill}
                                        style={{ 
                                            width: `${Math.min(100, Math.max(0, job.progress))}%`,
                                            backgroundColor: getStatusColor(job.status)
                                        }}
                                    />
                                </div>
                                <span className={styles.progressText}>
                                    {Math.min(100, Math.max(0, job.progress))}%
                                </span>
                            </div>
                            
                            <div className={styles.jobDetails}>
                                <span className={styles.stage} title={job.stage}>
                                    {job.stage || '处理中'}
                                </span>
                                <span className={styles.time}>
                                    {formatTime(job.startTime)}
                                </span>
                            </div>
                            {etaText && (
                                <div className={styles.etaText}>{etaText}</div>
                            )}
                            
                            {job.error && (
                                <div className={styles.errorMessage}>
                                    {job.error}
                                </div>
                            )}
                            
                            {job.status === 'completed' && job.fileId && (
                                <div className={styles.successMessage}>
                                    文件ID: {job.fileId}
                                </div>
                            )}
                        </div>
                        );
                    })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadProgressModal;

