import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './StoryIntroModal.module.css';
import type { GetGalgamePresetResponse } from '../../api/galgame/getGalgamePreset.type';
import { HOST_ADDRESS } from '../../config';
import { resolveStoryIntroText } from '../../lib/worldSettingFields';

const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultMap.png`;

interface StoryIntroModalProps {
    isOpen: boolean;
    presetData: GetGalgamePresetResponse | null;
    onStartGame: () => void;
    isLoading?: boolean;
}

const StoryIntroModal: React.FC<StoryIntroModalProps> = ({
    isOpen,
    presetData,
    onStartGame,
    isLoading = false,
}) => {
    const { t } = useTranslation();

    const title = useMemo(() => presetData?.world?.title || t('common.storyIntro.defaultTitle'), [presetData, t]);
    // 功能注释：开场弹窗优先用开场白；旧档无 preamble 时回退开场剧情
    const introText = useMemo(
        () => resolveStoryIntroText({
            preamble: presetData?.world?.preamble,
            initialPlot: presetData?.world?.initialPlot,
        }) || t('common.storyIntro.defaultPlot'),
        [presetData, t],
    );
    const playerImage = presetData?.scenes.scenes[0]?.image || presetData?.scenes.scenes[0]?.images;

    const playerImageUrl = useMemo(() => {
        if (!playerImage) return DEFAULT_SCENE_IMAGE;
        if (typeof playerImage === 'string' && playerImage.startsWith('http')) {
            return playerImage;
        }
        return `${HOST_ADDRESS}${playerImage}`;
    }, [playerImage]);

    if (!isOpen) return null;

    return (
        <div
            className={styles.modalOverlay}
        >
            <div className={styles.modalContent}
                style={{
                    backgroundImage: `url(${playerImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}
            >
                <div className={styles.modalHeader}>
                    <h1 className={styles.modalTitle}>{title}</h1>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.preambleText}>
                        {introText}
                    </div>
                </div>
                <div className={styles.modalFooter}>
                        <button
                            className={styles.startButton}
                            onClick={onStartGame}
                        disabled={isLoading}
                        >
                            {isLoading ?
                                <div className={styles.loading}>
                                    <span className={styles.loadingDot}></span>
                                    <span className={styles.loadingDot}></span>
                                    <span className={styles.loadingDot}></span>
                                </div>
                                : t('common.storyIntro.startExperience')}
                        </button>
                </div>
            </div>
        </div>
    );
};

export default StoryIntroModal;

