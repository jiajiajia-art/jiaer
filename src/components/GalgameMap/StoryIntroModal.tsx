import React, { useMemo } from 'react';
import styles from './StoryIntroModal.module.css';
import { useStoryTyping } from '../../hooks/story/useStoryTyping';
import type { AllGameData } from '../../api/worldInteraction/mapWorldData.type';

interface StoryIntroModalProps {
    isOpen: boolean;
    gameData: AllGameData | null;
    onStartGame: () => void;
    isDistributingEvent: boolean;
}

const StoryIntroModal: React.FC<StoryIntroModalProps> = ({
    isOpen,
    gameData,
    onStartGame,
    isDistributingEvent = false,
}) => {
    if (!isOpen) return null;

    const title = gameData?.worldSetting?.title || '故事';
    const preamble = gameData?.worldSetting?.preamble || '欢迎来到这个精彩的故事世界，准备好开始你的冒险了吗？';
    const backgroundImage = gameData?.worldSetting.worldMapImage+'/dummy' || null;

    const { displayedText, isTyping } = useStoryTyping({
        text: preamble,
        enabled: isOpen && !!preamble,
        speed: 50
    });

    const backgroundImageUrl = useMemo(() => {
        if (!backgroundImage) return null;
        return backgroundImage.startsWith('http') ? backgroundImage : `${backgroundImage}`;
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

