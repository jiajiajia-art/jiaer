import React, { useMemo } from 'react';
import styles from './SceneDetailForm.module.css';
import { MdDownload } from 'react-icons/md';
import type { LocalScene } from './handlers';
import { IMAGE_GENERATION_COST, getImageUrl, DEFAULT_SCENE_IMAGE, DEFAULT_WORLD_MAP_IMAGE } from '../../../utils/constants';
import { withCacheBust } from '../../../utils/imageCache';

interface BgmItem {
    id: string;
    name: string;
    description: string;
}

interface SceneDetailFormProps {
    scene: LocalScene;
    bgmLibrary: BgmItem[];
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    isGeneratingForThisScene: boolean;
    isAddingNewSubscene?: boolean;
    onImageClick: () => void;
    onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRequestRegenerate: (scene: LocalScene) => void;
    onFieldChange: (field: keyof LocalScene, value: string) => void;
    onDownloadImage?: (type: 'scenes' | 'subscenes', id: string, imagePath?: string) => void;
    sceneType?: 'scenes' | 'subscenes';
}

const SceneDetailForm: React.FC<SceneDetailFormProps> = ({
    scene,
    bgmLibrary,
    fileInputRef,
    isGeneratingForThisScene,
    isAddingNewSubscene = false,
    onImageClick,
    onUploadChange,
    onRequestRegenerate,
    onFieldChange,
    onDownloadImage,
    sceneType = 'scenes',
}) => {
    // 根据场景类型自动计算默认图片和上传按钮文本
    const defaultImage = useMemo(() => 
        sceneType === 'subscenes' ? DEFAULT_WORLD_MAP_IMAGE : DEFAULT_SCENE_IMAGE,
        [sceneType]
    );

    const uploadButtonText = useMemo(() => 
        scene.image ? '重新上传' : '上传背景',
        [scene.image]
    );

    // 根据场景ID判断是否为临时场景（新增状态）
    const isTempScene = scene.id.startsWith('temp-');
    // 新增场景或新增子场景时都应该禁用
    const disabled = isTempScene;
    const disabledMessage = disabled 
        ? (isAddingNewSubscene 
            ? '请先确认新增子场景，然后再上传图片' 
            : '请先确认新增场景，然后再上传图片')
        : undefined;
    
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
                    backgroundImage: `url('${scene.image ? withCacheBust(getImageUrl(scene.image)) : defaultImage}')`,
                }}
            >
                {/* 下载按钮 */}
                {scene.image && onDownloadImage && (
                    <button
                        className={styles.downloadButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownloadImage(sceneType, scene.id, scene.image);
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
                        <span>{IMAGE_GENERATION_COST} AI生成</span>
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

