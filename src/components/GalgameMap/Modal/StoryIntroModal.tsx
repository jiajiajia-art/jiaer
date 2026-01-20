import React, { useMemo } from 'react';
import styles from './StoryIntroModal.module.css';
import { useStoryTyping } from '../../../hooks/story/useStoryTyping';
import type { AllGameData } from '../../../api/worldInteraction/mapWorldData.type';
import { getImageUrl } from '../../../utils/constants';

interface StoryIntroModalProps {
    isOpen: boolean;
    gameData: AllGameData | null;
    onStartGame: () => void;
    isDistributingEvent: boolean;
}

const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;

const StoryIntroModal: React.FC<StoryIntroModalProps> = ({
    isOpen,
    gameData,
    onStartGame,
    isDistributingEvent = false,
}) => {
    if (!isOpen) return null;

    const title = gameData?.worldSetting?.title || '故事';
    const preamble = gameData?.worldSetting?.preamble || '欢迎来到这个精彩的故事世界，准备好开始你的冒险了吗？';
    // 修改：只有当 worldMapImage 存在且不是默认图片时才添加 '/dummy'
    const worldMapImage = gameData?.worldSetting?.worldMapImage;
    
    const backgroundImage = worldMapImage 
        ? (worldMapImage.includes('defaultScene.png') ? worldMapImage : `${worldMapImage}/dummy`)
        : DEFAULT_SCENE_IMAGE;

    const { displayedText, isTyping } = useStoryTyping({
        text: preamble,
        enabled: isOpen && !!preamble,
        speed: 50
    });

    const backgroundImageUrl = useMemo(() => {
        if (!backgroundImage) return null;
        // 如果已经是完整URL或默认图片，直接返回
        if (backgroundImage.startsWith('http') || backgroundImage.includes('defaultScene.png')) {
            return backgroundImage;
        }
        // 其他情况（相对路径）使用工具函数处理，加上host地址
        return getImageUrl(backgroundImage);
    }, [backgroundImage]);

    return (
        <div
            className={styles.modalOverlay}
        >
            <div className={styles.modalContent}
                style={backgroundImageUrl ? {
                    backgroundImage: `url(${backgroundImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                } : undefined}
            >
                <div className={styles.modalHeader}>
                    <h1 className={styles.modalTitle}>{title}</h1>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.preambleText}>
                        {displayedText}
                        {isTyping && <span className={styles.cursor}></span>}
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    {!isTyping &&
                        <button
                            className={styles.startButton}
                            onClick={onStartGame}
                            disabled={isDistributingEvent || isTyping}
                        >
                            {isDistributingEvent ?
                                <div className={styles.loading}>
                                    <span className={styles.loadingDot}></span>
                                    <span className={styles.loadingDot}></span>
                                    <span className={styles.loadingDot}></span>
                                </div>
                                : '开始游戏'}
                        </button>
                    }
                </div>
            </div>
        </div>
    );
};

export default StoryIntroModal;