import React, { useEffect, useRef, useState, useCallback } from 'react';
import styles from './GameDetailModal.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore, authModalStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import statisticsApi from '../api/statistics/statisticsApi';
import createSessionApi from '../api/createGame/createSessionApi';
import { AiOutlineLike } from 'react-icons/ai';
import GameAction from '../api/game/gameAction';
import getGameDataApi from '../api/home/getGameData';

interface GameDetailModalProps {
    isOpen: boolean;
    game: UserGameData;
    onClose: () => void;
}

const GameDetailModal: React.FC<GameDetailModalProps> = ({
    isOpen,
    game,
    onClose,
}) => {
    const { user } = useAuthStore();
    const { setPdfFileId, setSessionId } = useGameStore();
    const navigate = useNavigate();
    // 跟踪上一次的打开状态，用于检测弹窗从关闭到打开的变化
    const prevIsOpenRef = useRef(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    // 判断是否点赞的辅助函数，支持多种格式
    const checkIsLiked = (reaction: string | number | null | undefined): boolean => {
        if (reaction === null || reaction === undefined) return false;
        // 支持字符串格式
        if (typeof reaction === 'string') {
            return reaction === 'like' || reaction === '1';
        }
        // 支持数字格式
        if (typeof reaction === 'number') {
            return reaction === 1;
        }
        return false;
    };

    const [isLiked, setIsLiked] = useState(checkIsLiked(game.reaction));
    const [likeCount, setLikeCount] = useState(game.like_count || 0);
    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const likeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [gameDetail, setGameDetail] = useState<UserGameData | null>(null);

    const currentGame = gameDetail ?? game;

    // 当弹窗打开时记录统计和获取点赞状态（每次打开都记录一次）
    useEffect(() => {
        // 检测弹窗从关闭到打开的状态变化
        const wasClosed = !prevIsOpenRef.current;
        const isNowOpen = isOpen;
        const justOpened = wasClosed && isNowOpen;

        // 更新状态
        prevIsOpenRef.current = isOpen;

        // 只有在弹窗刚打开时（从关闭到打开）才记录
        if (!justOpened) {
            return;
        }

        // 检查必要的数据
        if (!currentGame || !currentGame.file_id) {
            return;
        }

        // 检查用户是否登录
        if (!user?.user?.id) {
            return;
        }

        statisticsApi.addView({
            fileId: currentGame.file_id,
            userId: String(user.user.id),
        }).catch((error) => {
            console.error('添加浏览统计失败:', error);
        });

    }, [isOpen, game, user]);

    const fetchGameDetail = useCallback(async () => {
        if (!game?.file_id) {
            console.warn('没有 file_id，无法获取详情');
            return;
        }

        try {
            const response = await getGameDataApi.getGameDetail({
                fileId: game.file_id,
                userId: String(user?.user.id || ''),
            });

            console.log('获取剧本详情响应:', response);

            if (response.data && response.data.data) {
                const gameData = response.data.data;
                setGameDetail(gameData);
                setIsLiked(checkIsLiked(gameData.reaction));
                setLikeCount(gameData.like_count || 0);
            } else {
                console.warn('无法解析剧本详情数据，使用传入的 game 数据');
                // 如果无法解析，保持使用传入的 game 数据
                setGameDetail(game);
            }
        } catch (error) {
            console.error('获取剧本详情失败:', error);
            // 出错时使用传入的 game 数据
            setGameDetail(game);
        }
    }, [game, user?.user.id]);

    useEffect(() => {
        if (isOpen) {
            // 初始化时使用传入的 game 数据
            setGameDetail(game);
            setIsLiked(game.reaction === 'like');
            setLikeCount(game.like_count || 0);
            // 然后获取最新数据
            fetchGameDetail();
        } else {
            // 关闭时重置
            setGameDetail(null);
        }
    }, [isOpen, game, fetchGameDetail]);

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
        // 检查用户是否登录
        if (!user?.user?.userId || !user?.user?.id) {
            // 打开登录弹窗
            authModalStore.getState().setIsAuthModalOpen(true);
            return;
        }

        const fileId = currentGame?.file_id || currentGame?.id;
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

    if (!isOpen || !game) return null;

    const handleLike = () => {
        // 检查用户是否登录
        if (!user?.user?.id) {
            authModalStore.getState().setIsAuthModalOpen(true);
            return;
        }

        // 防止重复点击
        if (isLikeLoading) {
            return;
        }

        // 清除之前的定时器
        if (likeDebounceTimerRef.current) {
            clearTimeout(likeDebounceTimerRef.current);
        }

        // 设置防抖定时器
        likeDebounceTimerRef.current = setTimeout(async () => {
            setIsLikeLoading(true);
            try {
                const response = await GameAction.gameLike({
                    fileId: currentGame.file_id || currentGame.id,
                    userId: String(user.user.id),
                });

                if (response.data.success && response.data.data) {
                    const { isLike, likeCount: newLikeCount } = response.data.data;
                    setIsLiked(isLike);
                    setLikeCount(newLikeCount);
                    await fetchGameDetail();
                } else {
                    console.error('点赞失败:', response.data);
                }
            } catch (error) {
                console.error('点赞失败:', error);
            } finally {
                setIsLikeLoading(false);
                likeDebounceTimerRef.current = null;
            }
        }, 300); // 300ms 防抖延迟
    };

    // 组件卸载时清理定时器
    useEffect(() => {
        return () => {
            if (likeDebounceTimerRef.current) {
                clearTimeout(likeDebounceTimerRef.current);
            }
        };
    }, []);

    return (
        <div className={`${styles.modal} ${styles.modalShow}`}>
            <div className={styles.gameDetailModal}>
                <button className={styles.detailModalClose} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </button>
                <div className={styles.detailThreeColumns}>
                    <div className={styles.detailLeftColumn}>
                        {currentGame.cover_url && (
                            <img
                                className={styles.detailLeftImage}
                                src={currentGame.cover_url}
                                alt="游戏封面"
                            />
                        )}
                    </div>

                    <div className={styles.detailMiddleColumn}>
                        <div className={styles.detailGameTitleContainer}>
                            <h3 className={styles.detailGameTitle}>
                                {(currentGame.title || '未命名游戏').toUpperCase()}
                            </h3>
                            <div className={styles.detailGameType}>
                                RPG
                            </div>

                            <div className={styles.likeContainer}>
                                <AiOutlineLike
                                    className={`${styles.detailGameLike} ${isLiked ? styles.detailGameLikeActive : ''}`}
                                    onClick={handleLike}
                                />
                                {likeCount > 0 && (
                                    <span className={styles.likeCount}>{likeCount}</span>
                                )}
                            </div>
                        </div>

                        <div className={styles.startGameSection}>
                            <div className={styles.gameRating}>
                                <div className={styles.ratingLabel}>
                                    {(currentGame.rating_avg ?? '9.0')}
                                    <span className={styles.ratingLabelUnit}>分</span>
                                </div>
                                <div className={styles.ratingScore}>
                                    {(currentGame.rating_count ?? 0)}人评价
                                </div>
                            </div>
                        </div>

                        <div className={styles.detailDescription}>
                            {currentGame.description ? <p>{currentGame.description}</p> : <p>暂无描述</p>}
                        </div>

                        <div className={styles.detailFooter}>
                            <div className={styles.detailAuthor}>
                                <span className={styles.authorName}>
                                    作者：
                                </span>
                                <img
                                    className={styles.authorAvatar}
                                    src={`${import.meta.env.BASE_URL}/data/assets/defaultAvatar.png`}
                                    alt="作者头像"
                                />
                                <span className={styles.authorName}>
                                    {currentGame.author_name || '未知作者'}
                                </span>
                            </div>

                            <div className={styles.priceSection}>

                                {!isUnlocked && currentGame.creator_user_id !== user?.user.id ? (
                                    <>
                                        <div className={styles.priceLabel}>
                                            <div className={styles.priceLabelText}>限时特惠</div>
                                            <div className={styles.originalPrice}>￥256</div>
                                        </div>
                                        <button className={styles.priceWrapper} onClick={() => setIsUnlocked(true)}>
                                            ￥0
                                        </button>
                                    </>
                                ) : (
                                    <button className={styles.priceWrapper} onClick={handleStartGame} disabled={isLoading}>
                                        {isLoading ? (
                                            <div className={styles.loading}>
                                                <span className={styles.loadingDot}></span>
                                                <span className={styles.loadingDot}></span>
                                                <span className={styles.loadingDot}></span>
                                            </div>
                                        ) : (
                                            <span>开始游戏</span>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default GameDetailModal;