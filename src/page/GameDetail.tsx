import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import styles from './GameDetail.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore, authModalStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import statisticsApi from '../api/statistics/statisticsApi';
import GameAction from '../api/rpgGame/gameAction';
import getGameDataApi from '../api/home/getGameData';
import { RECORD_CONVERSION } from '../config';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import toast from 'react-hot-toast';
import createGalgameSessionApi from '../api/galgame/createGalgameSession';
import betaWhitelistApi from '../api/galgame/betaWhitelist';
import createWorldSessionApi from '../api/worldInteraction/createWorldSession';
import { getImageUrl } from '../utils/constants';
import { FaRegShareFromSquare } from 'react-icons/fa6';
import { IoChevronBack } from 'react-icons/io5';
import AuthModal from '../components/AuthModal';
import LoadSaveListModal from '../components/CreateGame/LoadSaveListModal';
import SavePreviewModal from '../components/CreateGame/SavePreviewModal';
import type { SaveSummaryItem } from '../api/galgame/saves';
import { useTrackingStore } from '../store/trackingStore';
import { trackingApi } from '../api/statistics/trackingApi';

// 检测是否在微信小程序环境
const isWebViewEnv = (): boolean => {
    const win = window as any;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

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
    const location = useLocation();

    // Hooks
    const { user } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();
    const { setFileId, setSessionId, setIsPreset, setGameDetail: setGameDetailToStore } = useGameStore();
    const { setStartedAt } = useTrackingStore();

    // 状态
    const [isLoading, setIsLoading] = useState(true);
    const [game, setGame] = useState<UserGameData | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [isUpdateWarningModalOpen, setIsUpdateWarningModalOpen] = useState(false);
    const [isLoadSaveOpen, setIsLoadSaveOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<SaveSummaryItem | null>(null);

    // Refs
    const likeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasRecordedViewRef = useRef(false);
    
    const lastTrackedLocationKeyRef = useRef<string | null>(null);

    // 计算值
    const userId = useMemo(() => user?.user?.id, [user?.user?.id]);
    const fileId = useMemo(() => fileIdParam || game?.file_id || game?.id, [fileIdParam, game]);

    // 解析进入详情页的来源
    const enterSource = useMemo(() => {
        // 1. 优先看路由 state 中的 source（需要做合法值校验，避免传错值）
        const rawStateSource = (location.state as any)?.source;
        const stateSource = String(rawStateSource || '').toLowerCase();
        if (stateSource === 'link' || stateSource === 'main_page' || stateSource === 'search' || stateSource === 'other') {
            return stateSource as 'link' | 'main_page' | 'search' | 'other';
        }

        // 2. 其次看 URL query 中是否带有 from/source 参数
        const searchParams = new URLSearchParams(location.search);
        const querySource = (searchParams.get('source') || searchParams.get('from') || '').toLowerCase();
        if (querySource === 'link' || querySource === 'main_page' || querySource === 'search' || querySource === 'other') {
            return querySource as 'link' | 'main_page' | 'search' | 'other';
        }

        // 3. 都没有时，认为是「外链 / 直接输入链接」进入
        return 'link' as const;
    }, [location.state, location.search]);

    useEffect(() => {
        if (!fileIdParam) return;

        if (lastTrackedLocationKeyRef.current === location.key) return;
        lastTrackedLocationKeyRef.current = location.key;

        trackingApi
            .enterGameDetail({
                gameFileId: String(fileIdParam),
                source: enterSource,
            })
            .catch((error) => {
                console.error('记录进入游戏详情页失败:', error);
                // 失败时允许下次进入同一个页面重试
                if (lastTrackedLocationKeyRef.current === location.key) {
                    lastTrackedLocationKeyRef.current = null;
                }
            });
    }, [fileIdParam, enterSource, location.key]);

    // 用户进入游戏，用户来源
    const mapSourceForSession = useCallback((source: 'link' | 'main_page' | 'search' | 'other'): 'link' | 'game_detail' | 'history' | 'other' => {
        if (source === 'link') {
            return 'link';// 如果详情页是分享链接进入的，游戏界面也保持 'link'
        }
        // 从主页面、搜索等进入详情页，然后进入游戏，应该传递 'game_detail'
        return 'game_detail';
    }, []);

    // 检查用户是否登录
    const checkAuth = () => {
        if (!userId) {
            // 未登录时打开全局登录弹窗（微信小程序环境不打开）
            if (!isWebViewEnv()) {
                setIsAuthModalOpen(true);
            }
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

    // 创建 Galgame 会话
    const createGalgameSession = async (presetId: string): Promise<string | null> => {
        if (!presetId || !userId) {
            return null;
        }

        setIsLoading(true);
        try {
            const sessionResponse = await createGalgameSessionApi.createGalgamePlaySession({ 
                fileId: presetId,
                source: mapSourceForSession(enterSource), // 映射并传递来源
            });
            if (sessionResponse.data.success) {
                const startTime = new Date().toISOString();
                setStartedAt(startTime);
                return sessionResponse.data.data.session.session_id;
            } else {
                toast.error(sessionResponse.data.message || '创建游戏失败，请重试');
                return null;
            }
        } catch (error: unknown) {
            console.error('❌ Galgame Session 创建错误:', error);
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: { message?: string } } };
                const errorMessage = axiosError.response?.data?.message || '创建游戏失败，请稍后重试';
                toast.error(errorMessage);
            } else {
                toast.error('创建游戏失败，请稍后重试');
            }
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
            const response = await createWorldSessionApi.createWorldPlaySession({ 
                fileId: presetId, 
                source: mapSourceForSession(enterSource),
            });
            if (response.data.success) {
                const startTime = new Date().toISOString();
                setStartedAt(startTime);
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

            // 内测白名单：在开始游戏前检查
            try {
                const resp = await betaWhitelistApi.get(fileId);
                const enabled = !!resp.data?.whitelisted;
                useGameStore.getState().setGalgameBetaAttributes(enabled);
            } catch (e) {
                // 网络或接口错误，不影响开始游戏，默认关闭
                useGameStore.getState().setGalgameBetaAttributes(false);
                console.warn('[Beta] whitelist check failed, default disabled');
            }

            const sessionId = await createGalgameSession(fileId);
            if (sessionId) {
                setSessionId(sessionId);
                navigate('/galgame');
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

    // 价格相关计算：统一处理原价 / 特价 / 免费
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

    const handleShare = async () => {
        // 优先使用原生分享 API
        if (canNativeShare) {
            try {
                await navigator.share({
                    title: game?.title || '游戏',
                    text: game?.description || '',
                    url: window.location.href,
                });
                return;
            } catch (error) {
                // 用户取消分享或其他错误，继续执行备用方案
                if ((error as any)?.name !== 'AbortError') {
                    console.log('原生分享失败，使用备用方案');
                } else {
                    return; // 用户取消，不执行备用方案
                }
            }
        }

        // 备用方案：复制链接到剪贴板
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success('链接已复制到剪贴板');
        } catch (error) {
            // 如果 clipboard API 也不可用，使用传统方法
            const textArea = document.createElement('textarea');
            textArea.value = window.location.href;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                toast.success('链接已复制到剪贴板');
            } catch (err) {
                toast.error('复制失败，请手动复制链接');
            }
            document.body.removeChild(textArea);
        }
    };

    // ===== 存档读取（列表 → 预览 → 加载） =====
    const handleOpenLoadSave = () => {
        if (!checkAuth()) return;
        setIsLoadSaveOpen(true);
    };

    const handlePreviewSave = async (item: SaveSummaryItem) => {
        // 加载详情并展示在 TEXT 区域
        try {
            if (!fileId) return;
            const resp = await (await import('../api/galgame/saves')).savesApi.getDetail(item.saveId, fileId);
            const detail = resp.data;
            setPreviewItem({ saveId: detail.saveId, summaryText: detail.summaryText, createdAt: detail.createdAt });
        } catch (e) {
            console.error('获取存档详情失败:', e);
            toast.error('获取存档详情失败');
            // 兜底显示列表项内容
            setPreviewItem(item);
        }
    };

    const handleLoadSave = async (saveId: string) => {
        try {
            if (!fileId) return;
            setIsLoading(true);
            // 复用可选 saveId 的 /visual/session/create
            const resp = await createGalgameSessionApi.createGalgameEditSession({ fileId, saveId });
            if (resp.data.success) {
                const sessionId = resp.data.data.session;
                setSessionId(sessionId);
                navigate('/galgame');
                return;
            }
            toast.error(resp.data.message || '加载存档失败');
        } catch (e) {
            console.error('加载存档失败:', e);
            toast.error('加载存档失败，请稍后重试');
        } finally {
            setIsLoading(false);
            setIsLoadSaveOpen(false);
            setPreviewItem(null);
        }
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


    return (
        <div className={styles.pageContainer}>
            {/* 顶部悬浮栏：仅返回 & 分享 */}
            <div className={styles.topBar}>
                <div className={styles.topBarContent}>
                    <button className={styles.backIconButton} onClick={handleBack} aria-label="返回">
                        <IoChevronBack />
                    </button>
                    <div className={styles.topActions}>
                        <button className={styles.topIconButton} onClick={handleShare} aria-label="分享">
                            <FaRegShareFromSquare />
                        </button>
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


                    <div className={styles.descriptionSection}>
                        <p>{normalizeNewlines(game.description || '暂无描述')}</p>
                    </div>

                </div>
            </div>

            {/* 底部悬浮按钮栏（横向排列：开始体验 + 读取存档） */}
            <div className={styles.floatingActionBar}>
                <div className={styles.floatingActionInner}>
                    <div className={styles.bottomActionRow}>
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
                                '开始体验'
                            )}
                        </button>
                        {(() => {
                            const mapServerEngine = (engine?: string) => {
                                switch ((engine || '').toUpperCase()) {
                                    case 'CUSTOM': return 'customif' as const;
                                    default: return undefined;
                                }
                            };
                            const normalized = mapServerEngine(game?.engine) || game?.game_tags;
                            const isGalgame = normalized === 'TXT';
                            if (!isGalgame) return null;
                            return (
                                <button
                                    className={styles.startButton}
                                    onClick={handleOpenLoadSave}
                                    disabled={isLoading}
                                >
                                    读取存档
                                </button>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* 模态框 */}
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
            {/* 登录弹窗（当前详情页也挂一份，确保能在本页触发显示，微信小程序环境不显示） */}
            {!isWebViewEnv() && (
                <AuthModal
                    isOpen={isAuthModalOpen}
                    onClose={() => setIsAuthModalOpen(false)}
                />
            )}

            {/* 存档读取弹窗链：列表 → 预览 → 加载 */}
            <LoadSaveListModal
                isOpen={isLoadSaveOpen}
                onClose={() => setIsLoadSaveOpen(false)}
                fileId={fileId || null}
                onPreview={handlePreviewSave}
                allowCreateSlot={false}
            />
            <SavePreviewModal
                isOpen={!!previewItem}
                onClose={() => setPreviewItem(null)}
                item={previewItem}
                onLoad={handleLoadSave}
                loadButtonText={'开始体验'}
            />
        </div>
    );
};

export default GameDetail;
