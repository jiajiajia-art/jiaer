import React from 'react';
import styles from '../ScenesPanel.module.css';
import { MdDownload } from 'react-icons/md';
import type { LocalScene } from './handlers';

interface BgmItem {
    id: string;
    name: string;
    description: string;
}

interface SceneDetailFormProps {
    scene: LocalScene;
    bgmLibrary: BgmItem[];
    defaultImage: string;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    isGeneratingForThisScene: boolean;
    disabled?: boolean;
    disabledMessage?: string;
    uploadButtonText?: string;
    onImageClick: () => void;
    onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRequestRegenerate: (scene: LocalScene) => void;
    onFieldChange: (field: keyof LocalScene, value: string) => void;
    onDownloadImage?: (type: 'scenes' | 'subscenes', id: string) => void;
    sceneType?: 'scenes' | 'subscenes';
}

const SceneDetailForm: React.FC<SceneDetailFormProps> = ({
    scene,
    bgmLibrary,
    defaultImage,
    fileInputRef,
    isGeneratingForThisScene,
    disabled = false,
    disabledMessage,
    uploadButtonText = '上传背景',
    onImageClick,
    onUploadChange,
    onRequestRegenerate,
    onFieldChange,
    onDownloadImage,
    sceneType = 'scenes',
}) => {
    const showDisabledMessage = disabled && disabledMessage;
    const isDisabled = disabled || isGeneratingForThisScene;

    return (
        <>
            {/* 场景背景大图 */}
            <div
                className={`${styles.sceneHero} ${!scene.image ? styles.empty : ''}`}
                onClick={onImageClick}
                style={{
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.7 : 1,
                    backgroundImage: `url('${scene.image || defaultImage}')`,
                }}
            >
                {/* 下载按钮 */}
                {scene.image && onDownloadImage && (
                    <button
                        className={styles.downloadButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownloadImage(sceneType, scene.id);
                        }}
                        title="下载图片"
                    >
                        <MdDownload size={18} />
                    </button>
                )}
                {showDisabledMessage ? (
                    <span className={styles.heroHint}>{disabledMessage}</span>
                ) : scene.image ? (
                    <span className={styles.heroHint}>点击替换背景</span>
                ) : (
                    <span>点击上传背景图</span>
                )}
                {isGeneratingForThisScene && (
                    <div className="loadingOverlay">
                        <div className="loadingSpinner"></div>
                        <div className="loadingText">正在生成场景图片...</div>
                    </div>
                )}
            </div>

            <div className={styles.sceneImageActions}>
                <button
                    className={styles.ghostSmall}
                    onClick={onImageClick}
                    disabled={isDisabled}
                    style={{ opacity: isDisabled ? 0.5 : 1 }}
                >
                    {uploadButtonText}
                </button>
                {scene && (
                    <button
                        className={`${styles.ghostSmall} ${styles.generateButton}`}
                        onClick={() => onRequestRegenerate(scene)}
                        disabled={isDisabled}
                        style={{ opacity: isDisabled ? 0.5 : 1 }}
                    >
                        <img
                            src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                            alt=""
                            className={styles.priceIcon}
                        />
                        <span>10 AI生成</span>
                    </button>
                )}
            </div>

            {/* 隐藏的文件输入 */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onUploadChange}
            />

            <div className={styles.formGrid}>
                <label>
                    <span>场景名称</span>
                    <input
                        type="text"
                        value={scene.name}
                        onChange={(e) => onFieldChange('name', e.target.value)}
                    />
                </label>
                <label className={styles.wide}>
                    <span>场景描述</span>
                    <textarea
                        rows={3}
                        value={scene.desc}
                        onChange={(e) => onFieldChange('desc', e.target.value)}
                    />
                </label>
                <label>
                    <span>特殊 BGM</span>
                    <select
                        value={scene.bgmId}
                        onChange={(e) => onFieldChange('bgmId', e.target.value)}
                    >
                        <option value="">不绑定特殊 BGM</option>
                        {bgmLibrary.map((bgm) => (
                            <option key={bgm.id} value={bgm.id}>
                                {bgm.name}{bgm.description ? ` · ${bgm.description}` : ''}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </>
    );
};

export default SceneDetailForm;

