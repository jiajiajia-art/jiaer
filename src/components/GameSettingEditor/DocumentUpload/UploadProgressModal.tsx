import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUploadStore } from '../../../store/uploadStore';
import styles from './UploadProgressModal.module.css';
import { formatEtaPrecise, getUploadEtaText } from '../../../utils/etaText';
import { formatIdeaJobStage } from '../../../utils/ideaJobStage';

const STATUS_CLASS: Record<string, string> = {
    uploading: styles.statusLive,
    processing: styles.statusLive,
    completed: styles.statusDone,
    failed: styles.statusFail,
};

const UploadProgressModal: React.FC = () => {
    const { t } = useTranslation();
    const { jobs, showProgressModal, setShowProgressModal, isMinimized, setIsMinimized, removeJob } = useUploadStore();
    const [currentTime, setCurrentTime] = useState(Date.now());

    const jobList = Object.values(jobs);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    if (jobList.length === 0) return null;

    const hasActiveJobs = jobList.some(
        job => job.status === 'uploading' || job.status === 'processing'
    );

    if (!hasActiveJobs && !showProgressModal) return null;

    const getStatusText = (status: string) => {
        switch (status) {
            case 'uploading':
                return t('createGame.statusUpload');
            case 'processing':
                return t('createGame.statusParsing');
            case 'completed':
                return t('createGame.statusComplete');
            case 'failed':
                return t('createGame.statusFailed');
            default:
                return t('createGame.statusProcessing');
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.title}>{t('createGame.uploadProgress')}</h2>
                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            className={styles.minimizeButton}
                            onClick={() => setIsMinimized(!isMinimized)}
                            title={isMinimized ? t('common.expand') : t('common.minimize')}
                            aria-label={isMinimized ? t('common.expand') : t('common.minimize')}
                        >
                            {isMinimized ? '▲' : '▼'}
                        </button>
                        <button
                            type="button"
                            className={styles.closeButton}
                            onClick={() => setShowProgressModal(false)}
                            title={t('common.close')}
                            aria-label={t('common.close')}
                        >
                            ×
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
                        }, t);
                        const elapsedSeconds = Math.max(0, Math.floor((currentTime - job.startTime) / 1000));
                        const isLive = job.status === 'uploading' || job.status === 'processing';

                        return (
                        <div
                            key={job.jobId}
                            className={`${styles.jobItem} ${isLive ? styles.jobItemLive : ''}`}
                            data-status={job.status}
                        >
                            <div className={styles.jobHeader}>
                                <div className={styles.jobInfo}>
                                    <span className={styles.fileName} title={job.fileName}>
                                        {job.fileName}
                                    </span>
                                    <span className={`${styles.status} ${STATUS_CLASS[job.status] || styles.statusLive}`}>
                                        {getStatusText(job.status)}
                                    </span>
                                </div>
                                {job.status === 'completed' || job.status === 'failed' ? (
                                    <button
                                        type="button"
                                        className={styles.removeButton}
                                        onClick={() => removeJob(job.jobId)}
                                    >
                                        {t('createGame.remove')}
                                    </button>
                                ) : null}
                            </div>

                            <div className={styles.progressContainer}>
                                <div className={styles.progressBar}>
                                    <div
                                        className={`${styles.progressFill} ${isLive ? styles.progressFillLive : ''} ${STATUS_CLASS[job.status] || ''}`}
                                        style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                                    />
                                </div>
                                <span className={styles.progressText}>
                                    {Math.min(100, Math.max(0, job.progress))}%
                                </span>
                            </div>

                            <div className={styles.jobDetails}>
                                <span className={styles.stage} title={job.stage}>
                                    {formatIdeaJobStage(job.stage, t)}
                                </span>
                                <span className={styles.time}>
                                    {formatEtaPrecise(elapsedSeconds, t)}
                                </span>
                                {etaText ? (
                                    <span className={styles.etaText}>{etaText}</span>
                                ) : null}
                            </div>

                            {job.error && (
                                <div className={styles.errorMessage}>
                                    {job.error}
                                </div>
                            )}

                            {job.status === 'completed' && job.fileId && (
                                <div className={styles.successMessage}>
                                    {t('createGame.fileId')}: {job.fileId}
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
