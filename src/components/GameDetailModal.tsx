import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import styles from './GameDetailModal.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore, authModalStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import statisticsApi from '../api/statistics/statisticsApi';
import createSessionApi from '../api/createGame/createSessionApi';
import GameAction from '../api/game/gameAction';
import getGameDataApi from '../api/home/getGameData';
import { BiLike } from 'react-icons/bi';
import { RECORD_CONVERSION } from '../config';
import DeletModal from './goodsModal/DeletModal';
import toast, { Toaster } from 'react-hot-toast';

interface GameDetailModalProps {
    isOpen: boolean;
    game: UserGameData;
    onClose: () => void;
}

// 常量
const LIKE_DEBOUNCE_DELAY = 300;
const DEFAULT_RATING = '9.0';
const DEFAULT_AVATAR_PATH = 'data/assets/defaultAvatar.png';
const CLOSE_BUTTON_PATH = 'data/assets/关闭.png';

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

const GameDetailModal: React.FC<GameDetailModalProps> = ({
    isOpen,
    game,
    onClose,
}) => {
    // Hooks
    const { user } = useAuthStore();
    const { setPdfFileId, setSessionId } = useGameStore();
    const navigate = useNavigate();

    // 状态
    const [isLoading, setIsLoading] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isLiked, setIsLiked] = useState(() => checkIsLiked(game.reaction));
    const [likeCount, setLikeCount] = useState(game.like_count || 0);
    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [gameDetail, setGameDetail] = useState<UserGameData | null>(null);

    // Refs
    const prevIsOpenRef = useRef(false);
    const likeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 计算值
    const currentGame = useMemo(() => gameDetail ?? game, [gameDetail, game]);
    const userId = useMemo(() => user?.user?.id, [user?.user?.id]);
    const isOwner = useMemo(() => currentGame.creator_user_id === userId, [currentGame.creator_user_id, userId]);
    const fileId = useMemo(() => currentGame?.file_id || currentGame?.id, [currentGame]);

    const [isDeletModalOpen, setIsDeletModalOpen] = useState(false);

    // 检查用户是否登录
    const checkAuth = useCallback(() => {
        if (!userId) {
            authModalStore.getState().setIsAuthModalOpen(true);
            return false;
        }
        return true;
    }, [userId]);

    // 当弹窗打开时记录浏览统计
    useEffect(() => {
        if (RECORD_CONVERSION || !isOpen) return;

        const wasClosed = !prevIsOpenRef.current;
        const justOpened = wasClosed && isOpen;
        prevIsOpenRef.current = isOpen;

        if (!justOpened || !fileId || !userId) return;

        statisticsApi.addView({
            fileId,
            userId: String(userId),
        }).catch((error) => {
            console.error('添加浏览统计失败:', error);
        });
    }, [isOpen, fileId, userId]);

    // 获取游戏详情
    const fetchGameDetail = useCallback(async () => {
        if (!game?.file_id) {
            console.warn('没有 file_id，无法获取详情');
            return;
        }

        try {
            const response = await getGameDataApi.getGameDetail({
                fileId: game.file_id,
                userId: String(userId || ''),
            });

            if (response.data?.data) {
                const gameData = response.data.data;
                setGameDetail(gameData);
                setIsLiked(checkIsLiked(gameData.reaction));
                setLikeCount(gameData.like_count || 0);
            } else {
                setGameDetail(game);
            }
        } catch (error) {
            console.error('获取剧本详情失败:', error);
            setGameDetail(game);
        }
    }, [game, userId]);

    // 初始化游戏数据
    useEffect(() => {
        if (isOpen) {
            setGameDetail(game);
            setIsLiked(checkIsLiked(game.reaction));
            setLikeCount(game.like_count || 0);
            fetchGameDetail();
        } else {
            setGameDetail(null);
            setIsUnlocked(false);
        }
    }, [isOpen, game, fetchGameDetail]);

    // 创建会话
    const createSession = useCallback(async (fileId: string): Promise<string | null> => {
        if (!fileId || !userId) {
            return null;
        }

        setIsLoading(true);
        try {
            const response = await createSessionApi.getSession({
                fileId,
                userId
            });

            if (response.data.success) {
                return response.data.data?.session.session_id || null;
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
    }, [userId]);

    // 处理开始游戏
    const handleStartGame = useCallback(async () => {
        if (!checkAuth()) return;

        if (!fileId) {
            alert('游戏信息错误，请重试');
            return;
        }

        setPdfFileId(fileId);
        const sessionId = await createSession(fileId);

        if (sessionId) {
            setSessionId(sessionId);
            navigate('/newmain');
        }
    }, [checkAuth, fileId, createSession, setPdfFileId, setSessionId, navigate]);

    // 处理点赞
    const handleLike = useCallback(() => {
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
                    userId: String(userId),
                });

                if (response.data.success && response.data.data) {
                    const { isLike, likeCount: newLikeCount } = response.data.data;
                    setIsLiked(isLike);
                    setLikeCount(newLikeCount);
                    await fetchGameDetail();
                }
            } catch (error) {
                console.error('点赞失败:', error);
            } finally {
                setIsLikeLoading(false);
                likeDebounceTimerRef.current = null;
            }
        }, LIKE_DEBOUNCE_DELAY);
    }, [checkAuth, isLikeLoading, fileId, userId, fetchGameDetail]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (likeDebounceTimerRef.current) {
                clearTimeout(likeDebounceTimerRef.current);
            }
        };
    }, []);

    // 计算样式
    const modalStyle = useMemo(() => {
        if (!currentGame.cover_url) return {};
        return {
            backgroundImage: `url(${currentGame.cover_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        };
    }, [currentGame.cover_url]);

    if (!isOpen || !game) return null;

    const handleDeleteSession = useCallback(async () => {
        if (!checkAuth()) return;
        if (!fileId || !userId) return;
        try {
            const response = await GameAction.deletGameSession({
                fileId,
                userId: String(userId),
            });
            if (response.data.success) {
                toast.success('删除成功');
            } else {
                toast.error(response.data.message || '删除失败');
            }
        } catch (error) {
            console.error('删除存档失败:', error);
        } finally {
            setIsDeletModalOpen(false);
        }
    }, [checkAuth, fileId, userId]);

    return (
        <div className={`${styles.modal} ${styles.modalShow}`}>
            <Toaster
                position="top-center"
                containerStyle={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
                toastOptions={{
                    duration: 3000,
                    style: {
                        minWidth: '250px',
                        textAlign: 'center',
                        borderRadius: '8px',
                    },
                }}
            />
            <div className={styles.gameDetailModal} style={modalStyle}>
                <button className={styles.detailModalClose} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}${CLOSE_BUTTON_PATH}`} alt="关闭" />
                </button>
                {currentGame.is_public && (
                    <button className={styles.handleDeleteSession} onClick={() => setIsDeletModalOpen(true)}>
                        删除存档
                    </button>
                )}
                <div className={styles.detailThreeColumns}>
                    <div className={styles.detailMiddleColumn}>
                        <div className={styles.detailGameTitleContainer}>
                            <h3 className={styles.detailGameTitle}>
                                {(currentGame.title || '未命名游戏').toUpperCase()}
                            </h3>
                            <div className={styles.detailGameType}>
                                RPG
                            </div>
                        </div>

                        <div className={styles.gameRatingContainer}>
                            <div className={styles.gameRating}>
                                <div className={styles.ratingLabel}>
                                    {currentGame.rating_avg ?? DEFAULT_RATING}
                                    <span className={styles.ratingLabelUnit}>分</span>
                                </div>
                                <div className={styles.ratingScore}>
                                    {currentGame.rating_count ?? 0}人评价
                                </div>
                            </div>
                            <div className={styles.likeContainer}>
                                <BiLike
                                    className={`${styles.detailGameLike} ${isLiked ? styles.detailGameLikeActive : ''}`}
                                    onClick={handleLike}
                                />
                                {likeCount > 0 && (
                                    <span className={`${styles.likeCount} ${isLiked ? styles.likeCountActive : ''}`}>
                                        {likeCount}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className={styles.detailDescription}>
                            {currentGame.description ? <p>{currentGame.description}</p> : <p>暂无描述</p>}
                        </div>

                        <div className={styles.detailFooter}>
                            <div className={styles.priceSection}>
                                <div className={styles.priceTopBar}>
                                    <div className={styles.detailAuthor}>
                                        <span className={styles.authorName}>
                                            作者：
                                        </span>
                                        <img
                                            className={styles.authorAvatar}
                                            src={currentGame.avatarUrl?.trim() || `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`}
                                            alt="作者头像"
                                        />
                                        <span className={styles.authorName}>
                                            {currentGame.author_name || '未知作者'}
                                        </span>
                                    </div>

                                    {!isUnlocked && !isOwner && (
                                        <div className={styles.priceLabel}>
                                            <div className={styles.priceLabelText}>限时特惠</div>
                                            <div className={styles.originalPrice}>￥256</div>
                                        </div>
                                    )}
                                </div>

                                {!isUnlocked && !isOwner ? (
                                    <button className={styles.priceWrapper} onClick={() => setIsUnlocked(true)}>
                                        {currentGame.special_price_amount == 0 ? '免费' : `￥${currentGame.special_price_amount}`}
                                    </button>
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
            <DeletModal isOpen={isDeletModalOpen} onDelete={handleDeleteSession} onCancel={()=>setIsDeletModalOpen(false)} />
        </div>
    );
};

export default GameDetailModal;