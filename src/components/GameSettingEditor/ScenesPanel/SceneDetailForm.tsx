import React, { useEffect, useMemo, useState } from 'react';
import styles from './SceneDetailForm.module.css';
import { MdDownload } from 'react-icons/md';
import type { LocalScene } from './handlers';
import { SCENE_GENERATION_COST, getImageUrl, DEFAULT_SCENE_IMAGE, DEFAULT_WORLD_MAP_IMAGE } from '../../../utils/constants';
import { withCacheBust } from '../../../utils/imageCache';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';
import { isMiniProgramEnv } from '../../../utils/miniProgram';

// 字数限制配置
const SCENE_WORD_LIMITS = {
    name: 10,
    desc: 200,
} as const;

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
    generationEtaText?: string;
    isAddingNewSubscene?: boolean;
    getEffectiveImage?: (sceneId: string, subsceneId?: string) => string | undefined;
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
    generationEtaText = '',
    isAddingNewSubscene = false,
    getEffectiveImage,
    onImageClick,
    onUploadChange,
    onRequestRegenerate,
    onFieldChange,
    onDownloadImage,
    sceneType = 'scenes',
}) => {
    const [isMobilePicker, setIsMobilePicker] = useState(false);
    const [isBgmPickerOpen, setIsBgmPickerOpen] = useState(false);

    useEffect(() => {
        const updatePickerMode = () => {
            if (typeof window === 'undefined') {
                setIsMobilePicker(false);
                return;
            }
            setIsMobilePicker(isMiniProgramEnv() || window.innerWidth <= 720);
        };

        updatePickerMode();
        window.addEventListener('resize', updatePickerMode);
        return () => window.removeEventListener('resize', updatePickerMode);
    }, []);

    // 根据场景类型自动计算默认图片和上传按钮文本
    const defaultImage = useMemo(() =>
        sceneType === 'subscenes' ? DEFAULT_WORLD_MAP_IMAGE : DEFAULT_SCENE_IMAGE,
        [sceneType]
    );

    // 获取有效的图片
    const effectiveImage = getEffectiveImage
        ? getEffectiveImage(scene.id)
        : scene.image;

    const uploadButtonText = useMemo(() =>
        effectiveImage ? '重新上传' : '上传背景',
        [effectiveImage]
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

    // 字数统计
    const nameWords = useWordCount(scene.name ?? '');
    const descWords = useWordCount(scene.desc ?? '');

    // 字数限制处理
    const nameLimit = useWordLimit(SCENE_WORD_LIMITS.name, (value) => onFieldChange('name', value));
    const descLimit = useWordLimit(SCENE_WORD_LIMITS.desc, (value) => onFieldChange('desc', value));

    // 计算背景图片 URL
    const backgroundImageStyle = (() => {
        if (!effectiveImage) return `url('${defaultImage}')`;
        if (effectiveImage.startsWith('blob:') || effectiveImage.startsWith('data:')) {
            return `url('${effectiveImage}')`;
        }
        return `url('${withCacheBust(getImageUrl(effectiveImage))}')`;
    })();

    const selectedBgm = bgmLibrary.find((bgm) => bgm.id === scene.bgmId);
    const selectedBgmText = selectedBgm
        ? `${selectedBgm.name}${selectedBgm.description ? ` · ${selectedBgm.description}` : ''}`
        : '不绑定特殊 BGM';

    return (
        <>
            {/* 场景背景大图 */}
            <div
                className={`${styles.sceneHero} ${!effectiveImage ? styles.empty : ''}`}
                onClick={onImageClick}
                style={{
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.7 : 1,
                    backgroundImage: backgroundImageStyle,
                }}
            >
                {/* 下载按钮 */}
                {effectiveImage && onDownloadImage && (
                    <button
                        className={styles.downloadButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownloadImage(sceneType, scene.id, effectiveImage);
                        }}
                        title="下载图片"
                    >
                        <MdDownload size={18} />
                    </button>
                )}
                {showDisabledMessage ? (
                    <span className={styles.heroHint}>{disabledMessage}</span>
                ) : effectiveImage ? (
                    <span className={styles.heroHint}>点击替换背景</span>
                ) : (
                    <span>点击上传背景图</span>
                )}
                {isGeneratingForThisScene && (
                    <div className="loadingOverlay">
                        <div className="loadingSpinner"></div>
                        <div className="loadingText">正在生成场景图片...</div>
                        {generationEtaText && (
                            <div className="loadingHint">{generationEtaText}</div>
                        )}
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
                        <span>{SCENE_GENERATION_COST} AI生成</span>
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
                    <div className={styles.labelRowWithCounter}>
                        <span>场景名称</span>
                        <span className={styles.wordCounter}>
                            {nameWords}/{SCENE_WORD_LIMITS.name}
                        </span>
                    </div>
                    <input
                        type="text"
                        value={scene.name}
                        {...nameLimit}
                    />
                </label>
                <label className={styles.wide}>
                    <div className={styles.labelRowWithCounter}>
                        <span>场景描述</span>
                        <span className={styles.wordCounter}>
                            {descWords}/{SCENE_WORD_LIMITS.desc}
                        </span>
                    </div>
                    <textarea
                        rows={3}
                        value={scene.desc}
                        {...descLimit}
                    />
                </label>
                <label>
                    <span>特殊 BGM</span>
                    {isMobilePicker ? (
                        <>
                            {/* 实现移动端特殊 BGM 选项弹层。 */}
                            <button
                                type="button"
                                className={styles.mobileSelectTrigger}
                                onClick={() => setIsBgmPickerOpen(true)}
                            >
                                <span className={styles.mobileSelectValue}>{selectedBgmText}</span>
                                <span className={styles.mobileSelectArrow}>选择</span>
                            </button>

                            {isBgmPickerOpen && (
                                <div className={styles.mobilePickerOverlay} onClick={() => setIsBgmPickerOpen(false)}>
                                    <div className={styles.mobilePickerSheet} onClick={(e) => e.stopPropagation()}>
                                        <div className={styles.mobilePickerHeader}>
                                            <strong>选择特殊 BGM</strong>
                                            <button
                                                type="button"
                                                className={styles.mobilePickerClose}
                                                onClick={() => setIsBgmPickerOpen(false)}
                                            >
                                                关闭
                                            </button>
                                        </div>
                                        <div className={styles.mobilePickerList}>
                                            <button
                                                type="button"
                                                className={`${styles.mobilePickerOption} ${!scene.bgmId ? styles.mobilePickerOptionActive : ''}`}
                                                onClick={() => {
                                                    onFieldChange('bgmId', '');
                                                    setIsBgmPickerOpen(false);
                                                }}
                                            >
                                                不绑定特殊 BGM
                                            </button>
                                            {bgmLibrary.map((bgm) => (
                                                <button
                                                    key={bgm.id}
                                                    type="button"
                                                    className={`${styles.mobilePickerOption} ${scene.bgmId === bgm.id ? styles.mobilePickerOptionActive : ''}`}
                                                    onClick={() => {
                                                        onFieldChange('bgmId', bgm.id);
                                                        setIsBgmPickerOpen(false);
                                                    }}
                                                >
                                                    <span>{bgm.name}</span>
                                                    {bgm.description && (
                                                        <span className={styles.mobilePickerOptionDesc}>{bgm.description}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.selectWrap}>
                            <select
                                className={styles.specialBgmSelect}
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
                        </div>
                    )}
                </label>
            </div>
        </>
    );
};

export default SceneDetailForm;

