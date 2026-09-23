import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import styles from './UploadMusicModal.module.css';
import { rejectUploadMusicFile } from './uploadMusicValidation';

interface UploadMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File, name: string, description: string) => Promise<void>;
}

const UploadMusicModal: React.FC<UploadMusicModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicName, setMusicName] = useState('');
  const [musicDescription, setMusicDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  /** 功能注释：统一格式/体积校验，失败时 toast 并阻止写入选中态 */
  const tryAcceptFile = (file: File): boolean => {
    const reason = rejectUploadMusicFile(file);
    if (reason === 'invalid') {
      toast.error(t('createGame.uploadMusicErrors.invalidAudioFile'));
      return false;
    }
    if (reason === 'too_large') {
      toast.error(t('createGame.uploadMusicErrors.fileTooLarge'));
      return false;
    }
    setMusicFile(file);
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) tryAcceptFile(file);
  };

  const resetForm = () => {
    setMusicFile(null);
    setMusicName('');
    setMusicDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!musicFile) {
      toast.error(t('createGame.uploadMusicErrors.selectMusicFile'));
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
      resetForm();
      onClose();
    } catch (error) {
      console.error('上传音乐失败:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleCancel}>
      <div
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-music-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 id="upload-music-modal-title">{t('createGame.uploadMusic')}</h3>
          <button
            type="button"
            className={styles.modalClose}
            onClick={handleCancel}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {t('createGame.bgmName')}
              <span className={styles.required} aria-hidden="true">
                *
              </span>
            </span>
            <input
              type="text"
              className={styles.fieldInput}
              value={musicName}
              onChange={(e) => setMusicName(e.target.value)}
              placeholder={t('createGame.bgmNamePlaceholder')}
              disabled={isUploading}
              autoComplete="off"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {t('createGame.bgmDescription')}
              <span className={styles.required} aria-hidden="true">
                *
              </span>
            </span>
            <textarea
              className={styles.fieldTextarea}
              rows={3}
              value={musicDescription}
              onChange={(e) => setMusicDescription(e.target.value)}
              placeholder={t('createGame.bgmDescriptionPlaceholder')}
              disabled={isUploading}
            />
          </label>
          <div className={styles.uploadSection}>
            <span className={styles.fieldLabel}>
              {t('createGame.uploadMusicFile')}
              <span className={styles.required} aria-hidden="true">
                *
              </span>
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
                if (!file) return;
                if (!tryAcceptFile(file)) return;
                if (fileInputRef.current) {
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  fileInputRef.current.files = dataTransfer.files;
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
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
                    aria-label={t('createGame.uploadMusicErrors.removeSelectedFile')}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className={styles.uploadPlaceholder}>
                  <p className={styles.uploadText}>{t('createGame.uploadMusicDropHint')}</p>
                  <p className={styles.uploadHint}>{t('createGame.uploadMusicSupportHint')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.footerBtn}
            onClick={handleCancel}
            disabled={isUploading}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={styles.footerBtn}
            onClick={() => void handleConfirm()}
            disabled={isUploading}
          >
            {isUploading ? t('createGame.uploading') : t('createGame.confirmUpload')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadMusicModal;
