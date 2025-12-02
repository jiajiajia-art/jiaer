import React, { useMemo } from 'react';
import styles from './StoryIntroModal.module.css';
import type { GetGalgamePresetResponse } from '../../api/galgame/getGalgamePreset.type';
import { useStoryTyping } from '../../hooks/story/useStoryTyping';
import { HOST_ADDRESS } from '../../config';

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
    if (!isOpen) return null;

    const title = presetData?.worldSetting?.title || '故事';
    const preamble = presetData?.worldSetting?.preamble || '欢迎来到这个精彩的故事世界，准备好开始你的冒险了吗？';
    const playerImage = presetData?.sceneSetting?.scenes[0]?.images;

    const { displayedText, isTyping } = useStoryTyping({
        text: preamble,
        enabled: isOpen && !!preamble,
        speed: 50
    });

    const playerImageUrl = useMemo(() => {
        if (!playerImage) return null;
        return playerImage.startsWith('http') ? playerImage : `${HOST_ADDRESS}${playerImage}`;
    }, [playerImage]);

    return (
        <div
            className={styles.modalOverlay}
            style={playerImageUrl ? {
                backgroundImage: `url(${playerImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            } : undefined}
        >
            <div className={styles.modalContent}>
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
                            disabled={isLoading || isTyping}
                        >
                            {isLoading ?
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

