import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SceneDetailForm.module.css';
import { MdDownload } from 'react-icons/md';
import type { LocalScene } from './handlers';
import { SCENE_GENERATION_COST, getImageUrl, DEFAULT_SCENE_IMAGE, DEFAULT_WORLD_MAP_IMAGE } from '../../../utils/constants';
import { withCacheBust } from '../../../utils/imageCache';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';
import { isMiniProgramEnv } from '../../../utils/miniProgram';
import InlineFieldSave from '../InlineFieldSave';
import CurrencyIcon from '../../CurrencyIcon';

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
    isClearingImage?: boolean;
    generationEtaText?: string;
    isAddingNewSubscene?: boolean;
    getEffectiveImage?: (sceneId: string, subsceneId?: string) => string | undefined;
    /** 点击大图：有图时预览，无图时上传（由父组件决定） */
    onImageClick: () => void;
    /** 上传/重新上传按钮；默认回退到 onImageClick */
    onUploadClick?: () => void;
    onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRequestRegenerate: (scene: LocalScene) => void;
    onRequestClearImage?: () => void;
    canClearImage?: boolean;
    onFieldChange: (field: keyof LocalScene, value: string) => void;
    onDownloadImage?: (type: 'scenes' | 'subscenes', id: string, imagePath?: string) => void;
    sceneType?: 'scenes' | 'subscenes';
    nameDirty?: boolean;
    descDirty?: boolean;
    inlineSaveDisabled?: boolean;
    onNameSave?: () => void | Promise<void> | Promise<boolean>;
    onDescSave?: () => void | Promise<void> | Promise<boolean>;
}

const SceneDetailForm: React.FC<SceneDetailFormProps> = ({
    scene,
    bgmLibrary,
    fileInputRef,
    isGeneratingForThisScene,
    isClearingImage = false,
    generationEtaText = '',
    isAddingNewSubscene = false,
    getEffectiveImage,
    onImageClick,
    onUploadClick,
    onUploadChange,
    onRequestRegenerate,
    onRequestClearImage,
    canClearImage = false,
    onFieldChange,
    onDownloadImage,
    sceneType = 'scenes',
    nameDirty = false,
    descDirty = false,
    inlineSaveDisabled = false,
    onNameSave,
    onDescSave,
}) => {
    const { t } = useTranslation();
    const [isMobilePicker, setIsMobilePicker] = useState(false);
    const [isBgmPickerOpen, setIsBgmPickerOpen] = useState(false);

    // 会员折扣计算（暂时不打折）
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
        effectiveImage ? t('createGame.reupload') : t('createGame.uploadBackground'),
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
    const isImageActionDisabled = isDisabled || isClearingImage;

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
        : t('createGame.noSpecialBgm');

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
                        title={t('createGame.downloadImage')}
                    >
                        <MdDownload size={18} />
                    </button>
                )}
                {showDisabledMessage ? (
                    <span className={styles.heroHint}>{disabledMessage}</span>
                ) : effectiveImage ? (
                    <span className={styles.heroHint}>点击放大预览</span>
                ) : (
                    <span>{t('createGame.clickUploadBackground')}</span>
                )}
                {isGeneratingForThisScene && (
                    <div className="loadingOverlay">
                        <div className="loadingSpinner"></div>
                        <div className="loadingText">{t('createGame.generatingSceneImage')}</div>
                        {generationEtaText && (
                            <div className="loadingHint">{generationEtaText}</div>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.sceneImageActions}>
                <button
                    className={styles.ghostSmall}
                    onClick={onUploadClick || onImageClick}
                    disabled={isImageActionDisabled}
                    style={{ opacity: isImageActionDisabled ? 0.5 : 1 }}
                >
                    {uploadButtonText}
                </button>
                {onRequestClearImage && (
                    <button
                        className={`${styles.ghostSmall} ${styles.dangerButton}`}
                        onClick={onRequestClearImage}
                        disabled={!canClearImage || isImageActionDisabled}
                        style={{ opacity: !canClearImage || isImageActionDisabled ? 0.5 : 1 }}
                    >
                        {t('createGame.clearCurrentImage')}
                    </button>
                )}
                {scene && (
                    <button
                        className={`${styles.ghostSmall} ${styles.generateButton}`}
                        onClick={() => onRequestRegenerate(scene)}
                        disabled={isImageActionDisabled}
                        style={{ opacity: isImageActionDisabled ? 0.5 : 1 }}
                    >
                        <CurrencyIcon
                            currency="points"
                            className={styles.priceIcon}
                        />
                        {/* TODO: 恢复会员折扣UI时，取消下方注释
                        {showSceneDiscount ? (
                            <>
                                <span className={styles.originalPrice}>{SCENE_GENERATION_COST}</span>
                                <span className={`${styles.discountPrice} ${styles.discountPriceBlack}`}>{discountedSceneCost}</span>
                                <span>{t('createGame.aiGenerate')}</span>
                            </>
                        ) : ( */}
                            <span>{SCENE_GENERATION_COST} {t('createGame.aiGenerate')}</span>
                        {/* )} */}
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
                        <span>{t('createGame.sceneName')}</span>
                        <span className={styles.wordCounter}>
                            {nameWords}/{SCENE_WORD_LIMITS.name}
                        </span>
                    </div>
                    <InlineFieldSave
                        showSave={nameDirty}
                        onSave={() => onNameSave?.()}
                        disabled={inlineSaveDisabled}
                    >
                        <input
                            type="text"
                            value={scene.name}
                            {...nameLimit}
                        />
                    </InlineFieldSave>
                </label>
                <label className={styles.wide}>
                    <div className={styles.labelRowWithCounter}>
                        <span>{t('createGame.sceneDescription')}</span>
                        <span className={styles.wordCounter}>
                            {descWords}/{SCENE_WORD_LIMITS.desc}
                        </span>
                    </div>
                    <InlineFieldSave
                        showSave={descDirty}
                        onSave={() => onDescSave?.()}
                        disabled={inlineSaveDisabled}
                    >
                        <textarea
                            rows={3}
                            value={scene.desc}
                            {...descLimit}
                        />
                    </InlineFieldSave>
                </label>
                <label>
                    <span>{t('createGame.specialBgm')}</span>
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
                                            <strong>{t('createGame.selectSpecialBgm')}</strong>
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
                                                {t('createGame.noSpecialBgm')}
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
                                <option value="">{t('createGame.noSpecialBgm')}</option>
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

