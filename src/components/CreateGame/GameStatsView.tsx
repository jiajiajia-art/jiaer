import React from 'react';
import { IoEye, IoWallet } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import { IoIosArrowForward } from 'react-icons/io';
import type { UserGameData } from '../../api/home/getGameData.type';
import styles from './GameStatsView.module.css';

interface GameStatsViewProps {
    gameDetail: UserGameData;
    heroBackground: string;
    onEdit: () => void;
    onDelete: () => void;
    isDeleting: boolean;
}

const GameStatsView: React.FC<GameStatsViewProps> = ({
    gameDetail,
    heroBackground,
    onEdit,
    onDelete,
    isDeleting,
}) => {
    return (
        <div className={styles.statsModeWrapper}>
            <div
                className={styles.heroBanner}
                style={{ backgroundImage: `url(${heroBackground})` }}
            >
                <div className={styles.heroOverlay}>
                    <div className={styles.heroContent}>
                        <div className={styles.heroTitle}>{gameDetail.title || '未命名剧本'}</div>
                        <div className={styles.heroMeta}>
                            <span className={styles.heroRating}>
                                {(Number(gameDetail.rating_avg ?? 0)).toFixed(1)}
                            </span>
                            <span className={styles.heroMetaLabel}>
                                {(gameDetail.rating_count || 0).toLocaleString()} 人评论
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div className={styles.heroStatsWrapper}>
                <div className={styles.statsSection}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>我的数据</div>
                        <hr />
                        <button
                            type="button"
                            className={`${styles.more} ${styles.moreText}`}
                        >
                            每晚12:00更新
                            <IoIosArrowForward />
                        </button>
                    </div>
                    <div className={styles.statsGrid}>
                        <div className={styles.statBox}>
                            <div className={styles.statLabel}>
                                <IoEye />
                                <span>浏览量</span>
                            </div>
                            <div className={styles.statValue}>200</div>
                        </div>
                        <div className={styles.statBox}>
                            <div className={styles.statLabel}>
                                <TbHandClick />
                                <span>点击</span>
                            </div>
                            <div className={styles.statValue}>6</div>
                        </div>
                        <div className={styles.statBox}>
                            <div className={styles.statLabel}>
                                <IoWallet />
                                <span>收益</span>
                            </div>
                            <div className={styles.statValue}>0</div>
                        </div>
                    </div>
                </div>

                <div className={styles.heroActionGroup}>
                    <button
                        className={styles.editGameBtn}
                        onClick={onEdit}
                    >
                        编辑游戏
                    </button>

                    <button
                        className={styles.deleteGameBtn}
                        onClick={onDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? '删除中...' : '删除游戏'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameStatsView;

