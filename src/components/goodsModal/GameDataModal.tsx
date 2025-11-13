import React from 'react';
import styles from './GameDataModal.module.css';
import type { GameStatsResponse } from '../../api/game/gameAction.Api';

interface GameDataModalProps {
    isOpen: boolean;
    game: { id: string; title: string } | null;
    onClose: () => void;
    data: GameStatsResponse | null;
}

const GameDataModal: React.FC<GameDataModalProps> = ({
    isOpen,
    game,
    onClose,
    data,
}) => {
    if (!isOpen || !game) return null;

    // 如果没有数据，显示默认值
    const stats = data || {
        pv: 0,
        likeCount: 0,
        ratingAvg: 0,
    };

    return (
        <div className={`${styles.modal} ${styles.modalShow}`}>
            <div className={styles.dataModal}>
                    <div className={styles.dataModalContent}>
                        <button className={styles.closeBtn} onClick={onClose}>
                            <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                        </button>
                        <h2 className={styles.modalTitle}>作品数据</h2>
                        
                        <div className={styles.dataContent}>                            
                            <div className={styles.dataGrid}>
                                <div className={styles.dataItem}>
                                    <div className={styles.dataLabel}>点赞数</div>
                                    <div className={styles.dataValue}>{stats.likeCount ?? 0}</div>
                                </div>
                                
                                <div className={styles.dataItem}>
                                    <div className={styles.dataLabel}>点击数</div>
                                    <div className={styles.dataValue}>{stats.pv ?? 0}</div>
                                </div>
                                
                                <div className={styles.dataItem}>
                                    <div className={styles.dataLabel}>评分</div>
                                    <div className={styles.dataValue}>{stats.ratingAvg ? stats.ratingAvg.toFixed(1) : '0.0'}</div>
                                </div>
                                
                                <div className={styles.dataItem}>
                                    <div className={styles.dataLabel}>收益（元）</div>
                                    <div className={styles.dataValue}>0.00</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    );
};

export default GameDataModal;

