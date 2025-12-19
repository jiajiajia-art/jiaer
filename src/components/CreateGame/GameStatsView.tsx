import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoEye, IoWallet } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import type { UserGameData } from '../../api/home/getGameData.type';
import styles from './GameStatsView.module.css';
import { useAuthStore, authModalStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/gameStore';
import createSessionApi from '../../api/createGame/createSessionApi';
import createGalgameSessionApi from '../../api/galgame/createGalgameSession';
import GameAction from '../../api/rpgGame/gameAction';
import type { GameStatsResponse } from '../../api/rpgGame/gameAction.Api';
import createWorldSessionApi from '../../api/worldInteraction/createWorldSession';

interface GameStatsViewProps {
    gameDetail: UserGameData;
    heroBackground: string;
    onEdit: () => void;
    onDelete: () => void;
    isDeleting: boolean;
    onPublish: () => void;
    onUnpublish: (fileId: string) => void;
}

const GameStatsView: React.FC<GameStatsViewProps> = ({
    gameDetail,
    heroBackground,
    onEdit,
    onDelete,
    isDeleting,
    onPublish,
    onUnpublish,
}) => {
    const { user } = useAuthStore();
    const { setFileId, setSessionId, setIsPreset } = useGameStore();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [gameStats, setGameStats] = useState<GameStatsResponse>();

    /**
     * 创建会话
     */
    const createSession = async (fileId: string): Promise<{ sessionId: string | null; redirectUrl: string }> => {
        if (!fileId) {
            console.error('没有 fileId，无法创建 session');
            return { sessionId: null, redirectUrl: '' };
        }

        if (!user?.user?.userId || !user?.user?.id) {
            alert('用户信息错误，无法创建 session');
            return { sessionId: null, redirectUrl: '' };
        }

        setIsLoading(true);
        try {
            // 根据游戏版本判断进入的模式
            if (gameDetail.version == 'new') {
                // Galgame 模式
                const response = await createGalgameSessionApi.createGalgameSession({
                    presetId: fileId,
                });

                if (response.data.success) {
                    const sessionId = response.data.data.session.session_id;
                    return { sessionId, redirectUrl: `/galgame` };
                } else {
                    alert(response.data.message || '创建游戏失败，请重试');
                    return { sessionId: null, redirectUrl: '' };
                }
            } else if(gameDetail.version == 'old') {
                // 普通模式（Story）
                const response = await createSessionApi.getSession({
                    fileId: fileId,
                });

                if (response.data.success) {
                    const data = response.data.data;
                    const sessionId = data?.session.session_id || null;
                    return { sessionId, redirectUrl: '/rpgGame' };
                } else {
                    alert(response.data.message || '创建游戏失败，请重试');
                    return { sessionId: null, redirectUrl: '' };
                }
            } else if(gameDetail.version == 'map-plugin-version'){
                const response = await createWorldSessionApi.createWorldSession({fileId}); 
                if (response.data.success) {
                    const sessionId = response.data.data.session.session_id;
                    return { sessionId, redirectUrl: '/galgameMap'};
                } else {
                    alert(response.data.message || '创建游戏失败，请重试');
                    return { sessionId: null, redirectUrl: '' };
                } 
            } else {
                // 未知版本类型
                alert('未知的游戏版本类型，无法创建会话');
                return { sessionId: null, redirectUrl: '' };
            }
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            alert('创建游戏失败，请稍后重试');
            return { sessionId: null, redirectUrl: '' };
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
        setFileId(fileId);
        setIsPreset(gameDetail?.is_preset == 1);

        // 创建会话
        const { sessionId, redirectUrl } = await createSession(fileId);
        if (sessionId && redirectUrl) {
            setSessionId(sessionId);
            navigate(redirectUrl);
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
                        <div className={styles.heroPrimaryActions}>
                            <button
                                className={`${styles.primaryActionBtn} ${styles.startGameBtn}`}
                                onClick={handleStartGame}
                                disabled={isLoading}
                            >
                                {isLoading ? '加载中...' : '开始游戏'}
                            </button>

                            {
                                gameDetail.is_public == 0 ?
                                    <button
                                        className={`${styles.primaryActionBtn} ${styles.publishGameBtn}`}
                                        onClick={onPublish}
                                        disabled={isLoading}
                                    >
                                        发布
                                    </button>
                                    : <button
                                        className={`${styles.primaryActionBtn} ${styles.publishGameBtn}`}
                                        onClick={() => onUnpublish(gameDetail.file_id)}
                                        disabled={isLoading}
                                    >
                                        下架
                                    </button>
                            }

                        </div>
                    </div>
                </div>
            </div>
            <div className={styles.heroStatsWrapper}>
                <div className={styles.statsSection}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>
                            <img src={`${import.meta.env.BASE_URL}data/assets/create/我的数据.png`} alt="我的数据" />
                        </div>
                        <img className={styles.sectionDividerDesktop} src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`} alt="分界线" />
                        <button
                            type="button"
                            className={`${styles.more} ${styles.moreText}`}
                        >
                            每晚12:00更新
                            <img src={`${import.meta.env.BASE_URL}data/assets/home/箭头.png`} alt="箭头" />
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

