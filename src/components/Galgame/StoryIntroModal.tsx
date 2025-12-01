import React from 'react';
import styles from './StoryIntroModal.module.css';
import type { GetGalgamePresetResponse } from '../../api/galgame/getGalgamePreset.type';

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

    const title = presetData?.worldSetting?.title || '故事介绍';
    const summary = presetData?.worldSetting?.summary || '';
    const background = presetData?.worldSetting?.background || '';

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>{title}</h2>
                </div>
                <div className={styles.modalBody}>
                    {summary && (
                        <p className={styles.storySummary}>{summary}</p>
                    )}
                    {background && (
                        <div className={styles.storyBackground}>
                            {background}
                        </div>
                    )}
                    {!summary && !background && (
                        <p className={styles.storySummary}>
                            欢迎来到这个精彩的故事世界，准备好开始你的冒险了吗？
                        </p>
                    )}
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
                         : '开始游戏'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StoryIntroModal;

