import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import styles from './UploadMusicModal.module.css';

interface UploadMusicModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (file: File, name: string, description: string) => Promise<void>;
}

const UploadMusicModal: React.FC<UploadMusicModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [musicFile, setMusicFile] = useState<File | null>(null);
    const [musicName, setMusicName] = useState('');
    const [musicDescription, setMusicDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;
    const { t } = useTranslation();

    // 获取文件扩展名
    const getFileExtension = (filename: string): string => {
        return filename.split('.').pop()?.toLowerCase() || '';
    };

    // 验证文件格式
    const isValidAudioFile = (file: File): boolean => {
        const validExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'];
        const extension = getFileExtension(file.name);
        return validExtensions.includes(extension);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // 验证文件格式（使用扩展名，因为 MIME 类型可能不准确）
            if (!isValidAudioFile(file)) {
                toast.error('请选择音频文件（MP3、WAV、OGG、M4A、AAC、FLAC、WEBM）');
                return;
            }
            // 验证文件大小（例如：最大 10MB）
            if (file.size > 10 * 1024 * 1024) {
                toast.error('文件大小不能超过 10MB');
                return;
            }
            setMusicFile(file);
        }
    };

    const handleConfirm = async () => {
        // 验证必填项
        if (!musicFile) {
            toast.error('请选择要上传的音乐文件');
            return;
        }
        if (!musicName.trim()) {
            toast.error(t('createGame.enterBgmName'));
            return;
        }
        if (!musicDescription.trim()) {
            toast.error(t('createGame.enterBgmDescription'));
            return;
        }

        setIsUploading(true);
        try {
            await onConfirm(musicFile, musicName.trim(), musicDescription.trim());
            // 重置表单
            setMusicFile(null);
            setMusicName('');
            setMusicDescription('');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            onClose();
        } catch (error) {
            console.error('上传音乐失败:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancel = () => {
        setMusicFile(null);
        setMusicName('');
        setMusicDescription('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    return (
        <div className={styles.modalOverlay} onClick={handleCancel}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>{t('createGame.uploadMusic')}</h3>
                    <button className={styles.modalClose} onClick={handleCancel}>×</button>
                </div>
                <div className={styles.modalBody}>
                    <label>
                        <span>{t('createGame.bgmName')}<span className={styles.required}>*</span></span>
                        <input
                            type="text"
                            value={musicName}
                            onChange={(e) => setMusicName(e.target.value)}
                            placeholder={t('createGame.bgmNamePlaceholder') || '请输入 BGM 名称'}
                            disabled={isUploading}
                        />
                    </label>
                    <label>
                        <span>{t('createGame.bgmDescription')}<span className={styles.required}>*</span></span>
                        <textarea
                            rows={3}
                            value={musicDescription}
                            onChange={(e) => setMusicDescription(e.target.value)}
                            placeholder={t('createGame.bgmDescription')}
                            disabled={isUploading}
                        />
                    </label>
                    <div className={styles.uploadSection}>
                        <span className={styles.uploadLabel}>
                            上传文件<span className={styles.required}>*</span>
                        </span>
                        <div
                            className={`${styles.uploadArea} ${musicFile ? styles.uploadAreaHasFile : ''}`}
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isUploading) return;
                                const file = e.dataTransfer.files?.[0];
                                if (file) {
                                    // 验证文件格式（使用扩展名，因为 MIME 类型可能不准确）
                                    if (!isValidAudioFile(file)) {
                                        toast.error('请选择音频文件（MP3、WAV、OGG、M4A、AAC、FLAC、WEBM）');
                                        return;
                                    }
                                    if (file.size > 10 * 1024 * 1024) {
                                        toast.error('文件大小不能超过 10MB');
                                        return;
                                    }
                                    setMusicFile(file);
                                    if (fileInputRef.current) {
                                        const dataTransfer = new DataTransfer();
                                        dataTransfer.items.add(file);
                                        fileInputRef.current.files = dataTransfer.files;
                                    }
                                }
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="audio/*"
                                onChange={handleFileChange}
                                disabled={isUploading}
                                className={styles.hiddenInput}
                            />
                            {musicFile ? (
                                <div className={styles.fileSelected}>
                                    <div className={styles.fileInfo}>
                                        <p className={styles.fileName}>{musicFile.name}</p>
                                        <p className={styles.fileSize}>{(musicFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.removeFile}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMusicFile(null);
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                        }}
                                        disabled={isUploading}
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.uploadPlaceholder}>
                                    <p className={styles.uploadText}>点击或拖拽文件到此处上传</p>
                                    <p className={styles.uploadHint}>支持 MP3、WAV、OGG、M4A、AAC、FLAC、WEBM 格式，最大 10MB</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button
                        className={styles.ghostSmall}
                        onClick={handleCancel}
                        disabled={isUploading}
                    >
                        取消
                    </button>
                    <button
                        className={styles.ghostSmall}
                        onClick={handleConfirm}
                        disabled={isUploading}
                    >
                        {isUploading ? '上传中...' : '确认上传'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadMusicModal;

