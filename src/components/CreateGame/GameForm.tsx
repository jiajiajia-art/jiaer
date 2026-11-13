import React, { useRef, useState, useEffect } from 'react';
import { FaFileAlt, FaImage } from 'react-icons/fa';
import styles from './GameForm.module.css';
import type { UserGameData } from '../../api/home/getGameData.type';
import { getImageUrl } from '../../utils/constants';
import { toDisplayCoverUrl } from '../../utils/displayCoverUrl';
import { useImageCropper } from '../../hooks/useImageCropper';
import ImageCropModal from '../CommonModal/ImageCropModal';
import SimpleRichTextEditor from '../Common/SimpleRichTextEditor';
import EditorApi from '../../api/galgame/EditorData';
import {
  NOVEL_DESCRIPTION_MAX_LENGTH,
  normalizeDescriptionForSave,
  toEditorHtml,
} from '../../utils/gameDescriptionHtml';

export interface GameFormData {
    gameName: string;
    gameSubtitle: string;
    gameDescription: string;
    noImageMode: boolean;
    uploadedFile: File | null;
    coverFile: File | null;
    coverImage: string | null;
    existingDocFile: File | null;
    existingCoverFile: File | null;
    generateImages: boolean;
}

interface GameFormProps {
    initialGameData?: UserGameData;
    initialFiles?: {
        existingDocFile?: File | null;
        existingCoverFile?: File | null;
    };
    isCreating?: boolean;
    onFormDataChange?: (data: GameFormData) => void;
    onTestGame?: () => void;
    isFormValid?: boolean;
}

const GameForm: React.FC<GameFormProps> = ({
    initialGameData,
    initialFiles,
    isCreating = false,
    onFormDataChange,
    onTestGame,
    isFormValid = false,
}) => {
    const [gameName, setGameName] = useState(initialGameData?.title || '');
    const [gameSubtitle, setGameSubtitle] = useState(initialGameData?.subtitle || '');
    const [gameDescription, setGameDescription] = useState(toEditorHtml(initialGameData?.description || ''));
    const [noImageMode, setNoImageMode] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(initialGameData?.cover_url || null);
    const [existingDocFile, setExistingDocFile] = useState<File | null>(initialFiles?.existingDocFile || null);
    const [existingCoverFile, setExistingCoverFile] = useState<File | null>(initialFiles?.existingCoverFile || null);
    const [isDragover, setIsDragover] = useState(false);
    const [isDragoverCover, setIsDragoverCover] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const {
        cropPreset,
        pendingCropFile,
        openCropper,
        closeCropper,
        handleCropComplete,
    } = useImageCropper({
        preset: 'gameCover',
        onCropped: async (croppedFile) => {
            if (coverImage?.startsWith('blob:')) {
                URL.revokeObjectURL(coverImage);
            }
            setCoverFile(croppedFile);
            setExistingCoverFile(null);
            setCoverImage(URL.createObjectURL(croppedFile));
        },
    });

    // 当初始数据变化时更新状态（用于编辑模式）
    useEffect(() => {
        if (initialGameData) {
            setGameName(initialGameData.title || '');
            setGameSubtitle(initialGameData.subtitle || '');
            setGameDescription(toEditorHtml(initialGameData.description || ''));
            // 功能注释：表单回显封面走 display-cover/cover.webp；blob 预览 URL 不命中规则，自然保持原样
            const displayCoverPath = toDisplayCoverUrl(initialGameData.cover_url);
            setCoverImage(displayCoverPath ? getImageUrl(displayCoverPath) : (getImageUrl(initialGameData.cover_url) || null));
        }
        if (initialFiles) {
            if (initialFiles.existingDocFile !== undefined) setExistingDocFile(initialFiles.existingDocFile);
            if (initialFiles.existingCoverFile !== undefined) setExistingCoverFile(initialFiles.existingCoverFile);
        }
    }, [initialGameData, initialFiles]);

    useEffect(() => {
        return () => {
            if (coverImage?.startsWith('blob:')) {
                URL.revokeObjectURL(coverImage);
            }
        };
    }, [coverImage]);

    // 当表单数据变化时通知父组件
    useEffect(() => {
        if (onFormDataChange) {
            onFormDataChange({
                gameName,
                gameSubtitle,
                gameDescription: normalizeDescriptionForSave(gameDescription),
                noImageMode,
                uploadedFile,
                coverFile,
                coverImage,
                existingDocFile,
                existingCoverFile,
                generateImages: noImageMode,
            });
        }
    }, [gameName, gameSubtitle, gameDescription, noImageMode, uploadedFile, coverFile, coverImage, existingDocFile, existingCoverFile, onFormDataChange]);

    const formatFileSizeLabel = (size?: number | null) => {
        if (!size) return '--';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    // 处理文件选择
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const allowedTypes = [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!allowedTypes.includes(file.type)) {
                alert('请上传PDF或DOCX格式的文件！');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('文件大小不能超过10MB！');
                return;
            }
            setUploadedFile(file);
            setExistingDocFile(null);
        }
    };

    // 处理封面图片选择
    const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                alert('请上传图片格式的文件！');
                return;
            }
            setCoverFile(file);
            setExistingCoverFile(null);
            const reader = new FileReader();
            reader.onload = (e) => {
                setCoverImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // 移除文件
    const removeFile = () => {
        setUploadedFile(null);
        setExistingDocFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 移除封面
    const removeCover = () => {
        setCoverFile(null);
        setExistingCoverFile(null);
        setCoverImage(null);
        if (coverInputRef.current) {
            coverInputRef.current.value = '';
        }
    };

    // 处理拖拽上传
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragover(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragover(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragover(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const allowedTypes = [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!allowedTypes.includes(file.type)) {
                alert('请上传PDF或DOCX格式的文件！');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('文件大小不能超过10MB！');
                return;
            }
            setUploadedFile(file);
            setExistingDocFile(null);
        }
    };

    // 处理封面拖拽
    const handleCoverDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragoverCover(true);
    };

    const handleCoverDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragoverCover(false);
    };

    const handleCoverDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragoverCover(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                alert('请上传图片格式的文件！');
                return;
            }
            setCoverFile(file);
            setExistingCoverFile(null);
            const reader = new FileReader();
            reader.onload = (e) => {
                setCoverImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCoverSelectForCrop = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please upload a supported image file.');
            return;
        }

        void openCropper(file);
    };
    void handleCoverSelect;

    const handleCoverDropForCrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragoverCover(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please upload a supported image file.');
            return;
        }

        void openCropper(file);
    };
    void handleCoverDrop;

    const documentDisplayName = uploadedFile?.name ?? existingDocFile?.name ?? '';
    const documentDisplaySize = uploadedFile ? uploadedFile.size : (existingDocFile ? existingDocFile.size : null);

    return (
        <div className={styles.formSection}>
            <div className={styles.formGroup}>
                <label htmlFor="gameName">游戏名称</label>
                <input
                    type="text"
                    id="gameName"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder="输入游戏名称"
                    required
                    autoComplete="off"
                    disabled={isCreating}
                />
            </div>

            <div className={styles.formGroup}>
                <label htmlFor="gameSubtitle">游戏副标题</label>
                <input
                    type="text"
                    id="gameSubtitle"
                    value={gameSubtitle}
                    onChange={(e) => setGameSubtitle(e.target.value)}
                    placeholder="例如：经典奇幻冒险RPG"
                    required
                    autoComplete="off"
                    disabled={isCreating}
                />
            </div>

            <div className={styles.formGroup}>
                <label htmlFor="gameDescription">游戏简介</label>
                <div className={styles.descriptionEditor}>
                    <SimpleRichTextEditor
                        value={gameDescription}
                        onChange={setGameDescription}
                        maxPlainLength={NOVEL_DESCRIPTION_MAX_LENGTH}
                        placeholder="简单介绍你的游戏世界..."
                        disabled={isCreating}
                        onUploadImage={
                            initialGameData?.file_id
                                ? async (file) => {
                                    const resp = await EditorApi.uploadDescImage(String(initialGameData.file_id), file);
                                    const url = resp.data?.data?.url;
                                    if (!resp.data?.success || !url) {
                                        throw new Error(resp.data?.message || '图片上传失败');
                                    }
                                    return url.startsWith('/') ? url : `/${url}`;
                                }
                                : undefined
                        }
                    />
                </div>
            </div>

            <div className={`${styles.formGroup} ${styles.requiredField}`}>
                <label htmlFor="gamePDF">文档内容</label>
                <div
                    className={`${styles.documentUploadArea} ${isDragover ? styles.dragActive : ''} ${isCreating ? styles.disabled : ''}`}
                    onClick={() => !isCreating && fileInputRef.current?.click()}
                    onDragOver={(e) => !isCreating && handleDragOver(e)}
                    onDragLeave={(e) => !isCreating && handleDragLeave(e)}
                    onDrop={(e) => !isCreating && handleDrop(e)}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        id="gamePDF"
                        accept=".pdf,.docx"
                        hidden
                        onChange={handleFileSelect}
                        autoComplete="off"
                        disabled={isCreating}
                    />
                    {documentDisplayName ? (
                        <div className={styles.uploadInfo}>
                            <span className={styles.fileIcon}>
                                <FaFileAlt color="var(--color-text-secondary)" />
                            </span>
                            <div className={styles.fileMeta}>
                                <span className={styles.fileName}>{documentDisplayName}</span>
                                <span className={styles.fileSize}>{formatFileSizeLabel(documentDisplaySize)}</span>
                            </div>
                            <button
                                type="button"
                                className={styles.removeFileBtn}
                                onClick={removeFile}
                                disabled={isCreating}
                            >
                                ×
                            </button>
                        </div>
                    ) : (
                        <div className={styles.uploadPlaceholder}>
                            <span className={styles.uploadIcon}>
                                <FaFileAlt color="var(--color-text-secondary)" />
                            </span>
                            <p className={styles.uploadText}>点击或拖拽文档文件到此处</p>
                            <p className={styles.uploadHint}>支持 DOCX 文件，最大 10MB</p>
                        </div>
                    )}

                    {initialGameData?.doc_url && (
                        <a
                            href={getImageUrl(initialGameData.doc_url)}
                            download
                            className={styles.downloadFileBtn}
                            onClick={(e) => e.stopPropagation()}
                        >
                            下载原版文件
                        </a>
                    )}
                </div>
            </div>

            <div className={`${styles.formGroup} ${styles.requiredField}`}>
                <label htmlFor="coverImage">封面预览</label>
                <div
                    className={`${styles.coverUploadArea} ${isDragoverCover ? styles.dragActive : ''} ${isCreating ? styles.disabled : ''}`}
                    onClick={() => !isCreating && coverInputRef.current?.click()}
                    onDragOver={(e) => !isCreating && handleCoverDragOver(e)}
                    onDragLeave={(e) => !isCreating && handleCoverDragLeave(e)}
                        onDrop={(e) => !isCreating && handleCoverDropForCrop(e)}
                >
                    <input
                        ref={coverInputRef}
                        type="file"
                        id="coverImage"
                        accept="image/jpeg,image/png,image/jpg"
                        hidden
                        onChange={handleCoverSelectForCrop}
                        autoComplete="off"
                        disabled={isCreating}
                    />
                    {!coverImage ? (
                        <div className={styles.uploadPlaceholder}>
                            <span className={styles.uploadIcon}>
                                <FaImage color='var(--color-text-secondary)' />
                            </span>
                            <p className={styles.uploadText}>点击或拖拽图片到此处</p>
                            <p className={styles.uploadHint}>支持 JPG、PNG 格式</p>
                        </div>
                    ) : (
                        <div className={styles.coverPreviewContainer}>
                            <img src={coverImage} alt="封面预览" className={styles.coverPreviewImage} />
                            <button
                                type="button"
                                className={styles.removeFileBtn}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeCover();
                                }}
                                disabled={isCreating}
                            >
                                ×
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.noImageModeLabel}></label>
                <div className={styles.noImageModeContainer}>
                    <input
                        type="checkbox"
                        checked={noImageMode}
                        onChange={(e) => setNoImageMode(e.target.checked)}
                        disabled={isCreating}
                        className={styles.noImageModeCheckbox}
                    />
                    <span className={styles.noImageModeText}>无图模式</span>
                </div>
            </div>

            <div className={styles.formGroup}>
                <label className={styles.createGameBtnLabel}></label>
                <button
                    className={`${styles.gameBtn} ${styles.createGameBtn}`}
                    onClick={onTestGame}
                    disabled={isCreating || !isFormValid}
                >
                    {
                        initialGameData ? '提交修改' : '创建游戏'
                    }
                </button>
            </div>
            {pendingCropFile ? (
                <ImageCropModal
                    isOpen
                    imageSrc={pendingCropFile.imageSrc}
                    title={cropPreset.title}
                    description={cropPreset.description}
                    aspectRatio={cropPreset.aspectRatio}
                    aspectLabel={cropPreset.aspectLabel}
                    defaultCropScale={cropPreset.defaultCropScale}
                    mimeType={pendingCropFile.mimeType}
                    onClose={closeCropper}
                    onCropComplete={handleCropComplete}
                />
            ) : null}
        </div>
    );
};

export default GameForm;
