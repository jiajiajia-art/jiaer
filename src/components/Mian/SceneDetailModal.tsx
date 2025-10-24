import React from 'react';
import styles from './SceneDetailModal.module.css';

interface SceneDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    sceneId: string | null;
    scene: any | null;
    player: any | null;
    onTravel: (sceneId: string, cost: number) => void;
}

const SceneDetailModal: React.FC<SceneDetailModalProps> = ({
    isOpen,
    onClose,
    sceneId,
    scene,
    player,
    onTravel
}) => {
    if (!isOpen || !sceneId || !scene) return null;

    const computeTravelCost = (scene: any) => {
        if (!scene) return 10;
        let cost = 10;
        if (scene.buildings && scene.buildings.length > 3) cost += 5;
        if (scene.npcs && scene.npcs.length > 2) cost += 5;
        return Math.max(5, cost);
    };

    const travelCost = computeTravelCost(scene);
    const playerGold = player?.currency?.gold ?? 0;

    const handleTravel = () => {
        if (playerGold < travelCost) {
            alert(`金币不足！需要 ${travelCost} 金币`);
            return;
        }
        onTravel(sceneId, travelCost);
    };

    return (
        <div className={styles.modal} onClick={onClose}>
            <div className={`${styles.modalContent} ${styles.sceneModalContent}`} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeSceneModal} onClick={onClose}>×</button>
                
                <div className={styles.sceneDetailImage}>
                    {scene.background && (
                        <img src={`http://localhost:3000${scene.background}`} alt="场景图片" />
                    )}
                </div>
                
                <div className={styles.sceneDetailInfo}>
                    <h2>{scene.name || '场景名称'}</h2>
                    
                    <div className={styles.sceneDetailDescription}>
                        <p>{scene.description || '场景描述'}</p>
                    </div>
                    
                    <div className={styles.sceneTravelCost}>
                        <div className={styles.costInfo}>
                            <span className={styles.costLabel}>旅行费用：</span>
                            <span className={styles.costValue}>{travelCost}</span>
                            <span className={styles.costIcon}>💰</span>
                        </div>
                        <div className={styles.playerGold}>
                            <span className={styles.goldLabel}>你的金币：</span>
                            <span className={styles.goldValue}>{playerGold}</span>
                            <span className={styles.goldIcon}>💰</span>
                        </div>
                    </div>
                    
                    <div className={styles.sceneDetailActions}>
                        <button 
                            className={styles.goToSceneBtn}
                            onClick={handleTravel}
                            disabled={playerGold < travelCost}
                        >
                            🚀 前往此场景
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SceneDetailModal;
