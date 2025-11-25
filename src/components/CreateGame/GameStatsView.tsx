import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoEye, IoWallet } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import { IoIosArrowForward } from 'react-icons/io';
import type { UserGameData } from '../../api/home/getGameData.type';
import styles from './GameStatsView.module.css';
import { useAuthStore, authModalStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/gameStore';
import createSessionApi from '../../api/createGame/createSessionApi';
import GameAction from '../../api/game/gameAction';
import type { GameStatsResponse } from '../../api/game/gameAction.Api';

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
    const { user } = useAuthStore();
    const { setPdfFileId, setSessionId } = useGameStore();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [gameStats, setGameStats] = useState<GameStatsResponse>();

    /**
     * 创建会话
     */
    const createSession = async (fileId: string): Promise<string | null> => {
        if (!fileId) {
            console.error('没有 fileId，无法创建 session');
            return null;
        }

        if (!user?.user?.userId || !user?.user?.id) {
            alert('用户信息错误，无法创建 session');
            return null;
        }

        setIsLoading(true);
        try {
            const response = await createSessionApi.getSession({
                fileId: fileId,
                userId: user.user.id
            });

            if (response.data.success) {
                const data = response.data.data;
                return data?.session.session_id || null;
            } else {
                alert(response.data.message || '创建游戏失败，请重试');
                return null;
            }
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            alert('创建游戏失败，请稍后重试');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 处理开始游戏按钮点击
     */
    const handleStartGame = async () => {
        if (!user?.user.userId || !user?.user.id) {
            authModalStore.getState().setIsAuthModalOpen(true);
            return;
        }

        const fileId = gameDetail?.file_id || gameDetail?.id;
        if (!fileId) {
            alert('游戏信息错误，请重试');
            return;
        }

        // 更新 store
        setPdfFileId(fileId);

        // 创建会话
        const sessionId = await createSession(fileId);
        if (sessionId) {
            setSessionId(sessionId);
            navigate('/newmain');
        }
    };

    const getGameStats = async () => {
        const response = await GameAction.getGameStats(gameDetail.file_id);
        if (response.data.success) {
            setGameStats(response.data.data ?? undefined);
        }
    };

    useEffect(() => {
        getGameStats();
    }, [gameDetail.file_id]);

    return (
        <div className={styles.statsModeWrapper}>
            <div
                className={styles.heroBanner}
                style={{ backgroundImage: `url(https://kurangames.com/images/${heroBackground})` }}
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
                        <button 
                            className={styles.startGameBtn}
                            onClick={handleStartGame}
                            disabled={isLoading}
                        >
                            {isLoading ? '加载中...' : '开始游戏'}
                        </button>
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
                            <div className={styles.statValue}>{gameStats?.pv || 0}</div>
                        </div>
                        <div className={styles.statBox}>
                            <div className={styles.statLabel}>
                                <TbHandClick />
                                <span>点击</span>
                            </div>
                            <div className={styles.statValue}>{gameStats?.pv || 0}</div>
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

