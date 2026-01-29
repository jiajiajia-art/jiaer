import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './GameDetail.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore, authModalStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import statisticsApi from '../api/statistics/statisticsApi';
import createSessionApi from '../api/createGame/createSessionApi';
import GameAction from '../api/rpgGame/gameAction';
import getGameDataApi from '../api/home/getGameData';
import { RECORD_CONVERSION } from '../config';
import ConfirmModal from '../components/GoodsModal/ConfirmModal';
import toast from 'react-hot-toast';
import payApi from '../api/pay/payApi';
import createGalgameSessionApi from '../api/galgame/createGalgameSession';
import createWorldSessionApi from '../api/worldInteraction/createWorldSession';
import { getImageUrl } from '../utils/constants';
import { FaRegShareFromSquare } from 'react-icons/fa6';
import { IoChevronBack } from 'react-icons/io5';
import AuthModal from '../components/AuthModal';

// 常量
const LIKE_DEBOUNCE_DELAY = 300;
const DEFAULT_RATING = '9.0';
const DEFAULT_AVATAR_PATH = 'data/assets/defaultAvatar.png';

// 判断是否点赞的辅助函数
const checkIsLiked = (reaction: string | number | null | undefined): boolean => {
    if (reaction === null || reaction === undefined) return false;
    if (typeof reaction === 'string') {
        return reaction === 'like' || reaction === '1';
    }
    if (typeof reaction === 'number') {
        return reaction === 1;
    }
    return false;
};

const GameDetail: React.FC = () => {
    const { fileId: fileIdParam } = useParams<{ fileId: string }>();
    const navigate = useNavigate();

    // Hooks
    const { user } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();
    const { setFileId, setSessionId, setIsPreset, setGameDetail: setGameDetailToStore } = useGameStore();

    // 状态
    const [isLoading, setIsLoading] = useState(true);
    const [game, setGame] = useState<UserGameData | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isUpdateWarningModalOpen, setIsUpdateWarningModalOpen] = useState(false);

    // Refs
    const likeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasRecordedViewRef = useRef(false);

    // 计算值
    const userId = useMemo(() => user?.user?.id, [user?.user?.id]);
    const fileId = useMemo(() => fileIdParam || game?.file_id || game?.id, [fileIdParam, game]);

    // 检查用户是否登录
    const checkAuth = () => {
        if (!userId) {
            // 未登录时打开全局登录弹窗
            setIsAuthModalOpen(true);
            return false;
        }
        return true;
    };

    // 加载游戏详情
    const fetchGameDetail = useCallback(async () => {
        if (!fileId) {
            toast.error('游戏ID无效');
            navigate('/home');
            return;
        }

        setIsLoading(true);
        try {
            const response = await getGameDataApi.getGameDetail({
                fileId,
            });

            if (response.data?.data) {
                const gameData = response.data.data;
                setGame(gameData);
                setIsLiked(checkIsLiked(gameData.reaction));
                setLikeCount(gameData.like_count || 0);
                setGameDetailToStore(gameData);

                // 记录浏览统计（只记录一次）
                if (RECORD_CONVERSION && userId && !hasRecordedViewRef.current) {
                    hasRecordedViewRef.current = true;
                    statisticsApi.addView({
                        fileId,
                        userId: String(userId),
                    }).catch((error) => {
                        console.error('添加浏览统计失败:', error);
                    });
                }
            } else {
                toast.error('游戏不存在');
                navigate('/home');
            }
        } catch (error) {
            console.error('获取游戏详情失败:', error);
            toast.error('加载游戏详情失败');
            navigate('/home');
        } finally {
            setIsLoading(false);
        }
    }, [fileId, userId, navigate, setGameDetailToStore]);

    // 初始化加载
    useEffect(() => {
        if (fileIdParam) {
            fetchGameDetail();
        }
    }, [fileIdParam, fetchGameDetail]);

    // 创建普通游戏会话
    const createSession = async (fileId: string): Promise<string | null> => {
        if (!fileId || !userId) {
            return null;
        }

        setIsLoading(true);
        try {
            const response = await createSessionApi.getSession({
                fileId,
            });

            if (response.data.success) {
                return response.data.data?.session.session_id || null;
            } else {
                toast.error(response.data.message || '创建游戏失败，请重试');
                return null;
            }
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            toast.error('创建游戏失败，请稍后重试');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // 创建 Galgame 会话
    const createGalgameSession = async (presetId: string): Promise<string | null> => {
        if (!presetId || !userId) {
            return null;
        }

        setIsLoading(true);
        try {
            const sessionResponse = await createGalgameSessionApi.createGalgamePlaySession({ presetId });
            if (sessionResponse.data.success) {
                return sessionResponse.data.data.session.session_id;
            } else {
                toast.error(sessionResponse.data.message || '创建游戏失败，请重试');
                return null;
            }
        } catch (error: any) {
            console.error('❌ Galgame Session 创建错误:', error);
            const errorMessage = error.response?.data?.message || error.message || '创建游戏失败，请稍后重试';
            toast.error(errorMessage);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const createMapWorldSession = async (presetId: string): Promise<string | null> => {
        if (!presetId || !userId) {
            return null;
        }
        try {
            const response = await createWorldSessionApi.createWorldPlaySession({ fileId: presetId });
            if (response.data.success) {
                return response.data.data.session.session_id;
            } else {
                toast.error(response.data.message || '创建游戏失败，请重试');
                return null;
            }
        } catch (error) {
            console.error('❌ World Session 创建错误:', error);
            toast.error('创建游戏失败，请稍后重试');
            return null;
        }
    };

    // 实际开始游戏的逻辑
    const startGameInternal = async () => {
        if (!fileId || !game) {
            toast.error('游戏信息错误，请重试');
            return;
        }

        // engine 映射：RPG→story，TXT→galgame，AVG→world，CUSTOM→customif
        const mapServerEngine = (engine?: string) => {
            switch ((engine || '').toUpperCase()) {
                case 'CUSTOM': return 'customif' as const;
                default: return undefined;
            }
        };

        const normalized = mapServerEngine(game.engine) || game.game_tags;
        if (!normalized) {
            toast.error('未知的游戏类型，无法创建会话');
            return;
        }

        if (normalized === 'customif') {
            const appId = game.customAppId || fileId;
            if (!appId) {
                toast.error('缺少自定义 AppID，无法开始游戏');
                return;
            }
            navigate(`/customif/${appId}`);
            return;
        }

        if (normalized === 'TXT') {
            setFileId(fileId);
            setIsPreset(game.is_preset == 1);
            const sessionId = await createGalgameSession(fileId);
            if (sessionId) {
                setSessionId(sessionId);
                navigate('/galgame');
            }
            return;
        }

        if (normalized === 'RPG') {
            setFileId(fileId);
            setIsPreset(game.is_preset == 1);
            const sessionId = await createSession(fileId);
            if (sessionId) {
                setSessionId(sessionId);
                navigate('/rpgGame');
            }
            return;
        }

        if (normalized === 'AVG') {
            setFileId(fileId);
            const sessionId = await createMapWorldSession(fileId);
            if (sessionId) {
                setSessionId(sessionId);
                navigate('/galgameMap');
            }
            return;
        }
    };

    // 处理开始游戏（检查是否需要显示更新提示）
    const handleStartGame = async () => {
        if (!checkAuth()) return;

        // 如果游戏已更新，先显示提示模态框
        if (game?.needDeleted) {
            setIsUpdateWarningModalOpen(true);
            return;
        }

        // 否则直接开始游戏
        await startGameInternal();
    };

    // 处理点赞
    const handleLike = () => {
        if (!checkAuth() || isLikeLoading) return;

        if (likeDebounceTimerRef.current) {
            clearTimeout(likeDebounceTimerRef.current);
        }

        likeDebounceTimerRef.current = setTimeout(async () => {
            if (!fileId || !userId) return;

            setIsLikeLoading(true);
            try {
                const response = await GameAction.gameLike({
                    fileId,
                });

                if (response.data.success && response.data.data) {
                    const { isLiked, likeCount: newLikeCount } = response.data.data;
                    // 只更新本地状态，不重新拉取整个游戏数据
                    setIsLiked(isLiked);
                    setLikeCount(newLikeCount);
                    // 同步更新游戏数据中的点赞信息
                    if (game) {
                        setGame({
                            ...game,
                            reaction: isLiked ? 'like' : '0',
                            like_count: newLikeCount,
                        });
                    }
                }
            } catch (error) {
                console.error('点赞失败:', error);
            } finally {
                setIsLikeLoading(false);
                likeDebounceTimerRef.current = null;
            }
        }, LIKE_DEBOUNCE_DELAY);
    };

    // 清理定时器
    useEffect(() => {
        return () => {
            if (likeDebounceTimerRef.current) {
                clearTimeout(likeDebounceTimerRef.current);
            }
        };
    }, []);

    // 处理删除存档
    const handleDeleteSession = async () => {
        if (!checkAuth()) return;
        if (!fileId || !userId) return;
        try {
            const response = await GameAction.deletGameSession({
                fileId,
            });
            if (response.data.success) {
                toast.success('删除成功');
                fetchGameDetail();
            } else {
                toast.error(response.data.message || '删除失败');
            }
        } catch (error) {
            console.error('删除存档失败:', error);
        } finally {
            setIsConfirmModalOpen(false);
        }
    };

    // 处理购买游戏
    const purchaseGame = async () => {
        if (!checkAuth()) return;
        if (!fileId || !userId) return;
        if (isPurchasing) return;

        if (!game) return;

        // 计算实际价格
        const actualPrice = (game.special_price_amount != null)
            ? game.special_price_amount
            : (game.price_amount ?? 0);

        const isFreeGame = actualPrice == 0;

        if (!isFreeGame) {
            const userPoints = user?.user.points ?? 0;
            if (userPoints < actualPrice) {
                toast.error('积分不足');
                return;
            }
        }

        try {
            setIsPurchasing(true);
            const response = await payApi.purchasePoints({
                fileId,
            });
            if (response.data.success) {
                if (isFreeGame) {
                    toast.success('免费游戏已解锁');
                } else {
                    toast.success('购买成功');
                }
                setIsPurchaseModalOpen(false);
                // 只更新本地状态，标记为已购买
                setGame({
                    ...game,
                    paid: true,
                });
            } else {
                toast.error(response.data.message || '购买失败');
            }
        } catch (error) {
            console.error('购买失败:', error);
        } finally {
            setIsPurchasing(false);
        }
    };

    // 计算样式
    const heroStyle = useMemo(() => {
        if (!game?.cover_url) return {};
        return {
            backgroundImage: `url(${getImageUrl(game.cover_url)})`,
        };
    }, [game?.cover_url]);

    const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    const normalizeNewlines = useCallback((text: string) => {
        return (text ?? '').replaceAll('\\n', '\n').replaceAll('/n', '\n');
    }, []);

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/home');
        }
    };

    const handleShare = () => {
        if (!canNativeShare) return;
        navigator.share({
            title: game?.title || '游戏',
            text: game?.description || '',
            url: window.location.href,
        }).catch(() => { });
    };

    if (isLoading) {
        return (
            <div className={styles.fullscreenOverlay}>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner}></div>
                    <p>加载中...</p>
                </div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.errorContainer}>
                    <p>游戏不存在</p>
                    <button onClick={() => navigate('/home')} className={styles.backButton}>
                        返回首页
                    </button>
                </div>
            </div>
        );
    }

    const price = game.special_price_amount != null
        ? game.special_price_amount
        : game.price_amount;
    const isFreePrice = price == null || price == 0;
    const displayPrice = isFreePrice ? '免费' : `${price}`;

    return (
        <div className={styles.pageContainer}>
            {/* 顶部悬浮栏 */}
            <div className={styles.topBar}>
                <div className={styles.topBarContent}>
                    <button className={styles.backIconButton} onClick={handleBack} aria-label="返回">
                        <IoChevronBack />
                    </button>
                    <div className={styles.topActions}>
                        <button
                            className={styles.topDeleteButton}
                            onClick={() => {
                                if (!checkAuth()) return;
                                setIsConfirmModalOpen(true);
                            }}
                        >
                            删除存档
                        </button>
                        {canNativeShare && (
                            <button className={styles.topIconButton} onClick={handleShare} aria-label="分享">
                                <FaRegShareFromSquare />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 英雄区域（封面图） */}
            <div className={styles.heroSection} style={heroStyle}></div>

            {/* 内容区域 */}
            <div className={styles.contentSection}>
                <div className={styles.contentWrapper}>
                    {/* 标题和类型 */}
                    <div className={styles.headerSection}>
                        <div className={styles.titleRow}>
                            <div className={styles.titleLeft}>
                                <div className={styles.titleWithButton}>
                                    <h1 className={styles.gameTitle}>
                                        {game.title || '未命名游戏'}
                                    </h1>
                                    <button
                                        className={`${styles.likeButton} ${isLiked ? styles.liked : ''} ${styles.likeInline}`}
                                        onClick={handleLike}
                                        disabled={isLikeLoading}
                                        aria-label="点赞"
                                    >
                                        <img
                                            src={`${import.meta.env.BASE_URL}data/assets/gameDetail/${isLiked ? '点赞' : '未点赞'}.png`}
                                            alt="点赞"
                                        />
                                        <span>{likeCount || 0}</span>
                                    </button>
                                </div>
                                <div className={styles.gameMeta}>
                                    <span className={styles.gameType}>{game.game_tags}</span>
                                    <div className={styles.ratingSection}>
                                        <span className={styles.rating}>
                                            {game.rating_avg ?? DEFAULT_RATING}
                                            <span className={styles.ratingUnit}>分</span>
                                        </span>
                                        {/* <span className={styles.ratingCount}>
                                            {likeCount}人评价
                                        </span> */}
                                    </div>
                                </div>
                                {/* 作者信息放在标题下面 */}
                                <div className={styles.authorSection}>
                                    <img
                                        className={styles.authorAvatar}
                                        src={getImageUrl(game.avatarUrl) || `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`}
                                        alt="作者头像"
                                    />
                                    <span className={styles.authorName}>
                                        {game.author_name || '未知作者'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 描述 */}
                    <div className={styles.descriptionSection}>
                        <p>{normalizeNewlines(game.description || '暂无描述')}</p>
                    </div>

                    {/* 价格和操作按钮 */}
                </div>
            </div>

            {/* 底部悬浮按钮栏 */}
            <div className={styles.floatingActionBar}>
                <div className={styles.floatingActionInner}>
                    <div className={styles.actionSection}>
                        {game.special_price_amount != null && (
                            <div className={styles.priceTopRow}>
                                <div className={styles.priceLabel}>
                                    <span className={styles.specialLabel}>限时特惠</span>
                                    {game.price_amount && game.price_amount > 0 && (
                                        <span className={styles.originalPrice}>
                                            <img
                                                src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                                                alt=""
                                            />
                                            {game.price_amount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    {game.paid ? (
                        <button
                            className={styles.startButton}
                            onClick={handleStartGame}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className={styles.loading}>
                                    <span className={styles.loadingDot}></span>
                                    <span className={styles.loadingDot}></span>
                                    <span className={styles.loadingDot}></span>
                                </div>
                            ) : (
                                '开始游戏'
                            )}
                        </button>
                    ) : (
                        <button
                            className={styles.purchaseButton}
                            disabled={isPurchasing}
                            onClick={() => {
                                if (!checkAuth() || isPurchasing) return;
                                if (game.special_price_amount == 0 && !game.paid) {
                                    purchaseGame();
                                } else {
                                    setIsPurchaseModalOpen(true);
                                }
                            }}
                        >
                            {!isFreePrice && (
                                <img
                                    src={`${import.meta.env.BASE_URL}data/assets/金币.png`}
                                    alt=""
                                />
                            )}
                            {isPurchasing ? '购买中...' : displayPrice}
                        </button>
                    )}
                </div>
            </div>

            {/* 模态框 */}
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onConfirm={handleDeleteSession}
                onCancel={() => setIsConfirmModalOpen(false)}
                title="删除存档"
                message={normalizeNewlines("确认删除该游戏的存档吗？\\n删除后无法恢复。")}
            />
            <ConfirmModal
                isOpen={isPurchaseModalOpen}
                onConfirm={purchaseGame}
                onCancel={() => setIsPurchaseModalOpen(false)}
                title="购买游戏"
                message={normalizeNewlines(`确认花费 ${game.special_price_amount != null && game.special_price_amount > 0 ? game.special_price_amount : game.price_amount} 积分购买该游戏吗？`)}
                confirmButtonText="确认购买"
                cancelButtonText="取消"
            />
            <ConfirmModal
                isOpen={isUpdateWarningModalOpen}
                onConfirm={async () => {
                    setIsUpdateWarningModalOpen(false);
                    await startGameInternal();
                }}
                onCancel={() => setIsUpdateWarningModalOpen(false)}
                title="游戏已更新"
                message={normalizeNewlines("游戏已更新，如在游戏中遇到问题，建议删除存档解决。")}
                confirmButtonText="继续游戏"
                cancelButtonText="取消"
            />
            {/* 登录弹窗（当前详情页也挂一份，确保能在本页触发显示） */}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />
        </div>
    );
};

export default GameDetail;
