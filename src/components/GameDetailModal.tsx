import React, { useEffect, useRef, useState } from 'react';
import styles from './GameDetailModal.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore, authModalStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import statisticsApi from '../api/statistics/statisticsApi';
import createSessionApi from '../api/createGame/createSessionApi';
import { AiOutlineLike } from 'react-icons/ai';
import GameAction from '../api/game/gameAction';

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
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const likeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (!game || !game.file_id) {
            return;
        }

        // 检查用户是否登录
        if (!user?.user?.id) {
            return;
        }

        // 记录查看统计
        statisticsApi.addView({
            fileId: game.file_id,
            userId: String(user.user.id),
        }).catch((error) => {
            console.error('记录查看统计失败:', error);
        });

        // 获取游戏统计数据（包括点赞状态和数量）
        GameAction.getGameStats(game.file_id)
            .then((response) => {
                if (response.data.success && response.data.data) {
                    setLikeCount(response.data.data.likeCount || 0);
                    // 注意：getGameStats 可能不返回 isLike，需要单独获取
                    // 这里先设置默认值，实际应该从另一个 API 获取
                }
            })
            .catch((error) => {
                console.error('获取游戏统计数据失败:', error);
            });
    }, [isOpen, game, user]);

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

        const fileId = game?.file_id || game?.id;
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

    // const handleLike = () => {
    //     // 检查用户是否登录
    //     if (!user?.user?.id) {
    //         authModalStore.getState().setIsAuthModalOpen(true);
    //         return;
    //     }

    //     // 防止重复点击
    //     if (isLikeLoading) {
    //         return;
    //     }

    //     // 清除之前的定时器
    //     if (likeDebounceTimerRef.current) {
    //         clearTimeout(likeDebounceTimerRef.current);
    //     }

    //     // 设置防抖定时器
    //     likeDebounceTimerRef.current = setTimeout(async () => {
    //         setIsLikeLoading(true);
    //         try {
    //             const response = await GameAction.gameLike({
    //                 fileId: game.file_id || game.id,
    //                 userId: String(user.user.id),
    //             });

    //             if (response.data.success && response.data.data) {
    //                 const { isLike, likeCount: newLikeCount } = response.data.data;
    //                 setIsLiked(isLike);
    //                 setLikeCount(newLikeCount);
    //             } else {
    //                 console.error('点赞失败:', response.data);
    //             }
    //         } catch (error) {
    //             console.error('点赞失败:', error);
    //         } finally {
    //             setIsLikeLoading(false);
    //             likeDebounceTimerRef.current = null;
    //         }
    //     }, 300); // 300ms 防抖延迟
    // };

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
                <div className={styles.gameDetailModalInner}>
                    <div className={styles.gameDetailModalContent}>
                        <button className={styles.detailModalClose} onClick={onClose}>
                            <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                        </button>
                        <h2 className={styles.detailMainTitle}>剧本详情</h2>

                        <div className={styles.detailThreeColumns}>
                            <div className={styles.detailLeftColumn}>
                                {game.cover_url && (
                                    <img
                                        className={styles.detailLeftImage}
                                        src={game.cover_url}
                                        alt="游戏封面"
                                    />
                                )}
                            </div>

                            <div className={styles.detailMiddleColumn}>
                                <div className={styles.detailGameTitleContainer}>
                                    <h3 className={styles.detailGameTitle}>
                                        {(game.title || '未命名游戏').toUpperCase()}
                                    </h3>
                                    {/* <div className={styles.likeContainer}>
                                        <AiOutlineLike 
                                            className={`${styles.detailGameLike} ${isLiked ? styles.detailGameLikeActive : ''}`}
                                            onClick={handleLike}
                                        />
                                        {likeCount > 0 && (
                                            <span className={styles.likeCount}>{likeCount}</span>
                                        )}
                                    </div> */}
                                </div>

                                <div className={styles.detailGameType}>
                                    RPG
                                </div>

                                <div className={styles.detailDescription}>
                                    {game.description ? <p>{game.description}</p> : <p>暂无描述</p>}
                                </div>

                                <div className={styles.detailAuthor}>
                                    作者：{game.author_name || '未知作者'}
                                </div>
                            </div>

                            <div className={styles.detailRightColumn}>
                                <div className={styles.priceSection}>
                                    <div className={styles.priceTitle}>特惠价格</div>
                                    <div className={styles.priceValue}>
                                        ￥{game.special_price_amount ?? game.price_amount ?? 0}
                                    </div>
                                    <button className={styles.unlockBtn}>
                                        <img
                                            src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/解锁剧本按钮.png`}
                                            alt="解锁剧本"
                                        />
                                    </button>
                                </div>

                                <div className={styles.startGameSection}>
                                    <div className={styles.gameRating}>
                                        <div className={styles.ratingLabel}>
                                            {(game.rating_avg ?? '9.0')}
                                            <span className={styles.ratingLabelUnit}>分</span>
                                        </div>
                                        <div className={styles.ratingStars}>
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <img
                                                    key={star}
                                                    src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/星星.png`}
                                                    alt="星星"
                                                    className={styles.starIcon}
                                                />
                                            ))}
                                        </div>
                                        <div className={styles.ratingScore}>
                                            {(game.rating_count ?? 0)}人评价
                                        </div>
                                    </div>
                                    <button className={styles.startGameBtn} onClick={handleStartGame} disabled={isLoading}>
                                        {isLoading ? (
                                            <div className={styles.loading}>
                                                <span className={styles.loadingDot}></span>
                                                <span className={styles.loadingDot}></span>
                                                <span className={styles.loadingDot}></span>
                                            </div>
                                        ) : (
                                            <img
                                                src={`${import.meta.env.BASE_URL}data/asset/剧本详情页/开始游戏按钮.png`}
                                                alt="开始游戏"
                                            />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameDetailModal;

