import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import styles from './GameDetail.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore, authModalStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import statisticsApi from '../api/statistics/statisticsApi';
import GameAction from '../api/rpgGame/gameAction';
import favoriteApi from '../api/favorite/favoriteApi';
import getGameDataApi from '../api/home/getGameData';
import { RECORD_CONVERSION } from '../config';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import toast from 'react-hot-toast';
import createGalgameSessionApi from '../api/galgame/createGalgameSession';
import betaWhitelistApi from '../api/galgame/betaWhitelist';
import createWorldSessionApi from '../api/worldInteraction/createWorldSession';
import { getImageUrl } from '../utils/constants';
import { FaRegShareFromSquare } from 'react-icons/fa6';
import { MdContentCopy } from 'react-icons/md';
import { IoChevronBack } from 'react-icons/io5';
import { AiOutlineStar, AiFillStar } from 'react-icons/ai';
import AuthModal from '../components/AuthModal';
import LoadSaveListModal from '../components/CreateGame/LoadSaveListModal';
import SavePreviewModal from '../components/CreateGame/SavePreviewModal';
import ReplayList from '../components/Galgame/ReplayList';
import ShareModal from '../components/CommonModal/ShareModal';
import QRCodeModal from '../components/CommonModal/QRCodeModal';
import type { ReplayVisibility } from '../api/galgame/replay';
import type { SaveSummaryItem } from '../api/galgame/saves';
import { useTrackingStore } from '../store/trackingStore';
import { trackingApi } from '../api/statistics/trackingApi';
import { useDailyTaskStore } from '../store/dailyTaskStore';
import { useTranslation } from 'react-i18next';

// 检测是否在微信小程序环境
const isWebViewEnv = (): boolean => {
    const win = window as any;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

// 常量
const LIKE_DEBOUNCE_DELAY = 300;
const FAVORITE_DEBOUNCE_DELAY = 300;
const DEFAULT_RATING = '9.0';
const DEFAULT_AVATAR_PATH = 'data/assets/defaultAvatar.png';
const DEFAULT_PLAY_STATUS = {
    hasContinueState: true,
    hasSave: true,
};

const REPLAY_VISIBILITY_TABS_PUBLIC = 'public';
const REPLAY_VISIBILITY_TABS_UNLISTED = 'unlisted';
const REPLAY_VISIBILITY_TABS_PRIVATE = 'private';

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

const normalizeGameMode = (engine?: string | null, gameTags?: string | null) => {
    const normalizeRaw = (value?: string | null) => {
        if (!value) return '';
        return String(value)
            .trim()
            .replace(/^\[\s*/, '')
            .replace(/\s*\]$/, '')
            .split(',')[0]
            .replace(/^["']|["']$/g, '')
            .trim()
            .toUpperCase();
    };

    const normalizedEngine = normalizeRaw(engine);
    if (normalizedEngine === 'CUSTOM') return 'customif' as const;
    if (normalizedEngine === 'ST') return 'st' as const;
    if (normalizedEngine === 'IVG') return 'interactive-video' as const;
    if (normalizedEngine === 'TXT' || normalizedEngine === 'AVG' || normalizedEngine === 'RPG') return normalizedEngine;

    const normalizedTags = normalizeRaw(gameTags);
    if (normalizedTags === 'CUSTOM') return 'customif' as const;
    if (normalizedTags === 'IVG') return 'interactive-video' as const;
    if (normalizedTags === 'TXT' || normalizedTags === 'AVG' || normalizedTags === 'RPG') return normalizedTags;

    return '';
};

const normalizePlaybackOrientation = (value?: string | null) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'landscape' || normalized === 'portrait' ? normalized : null;
};

const GameDetail: React.FC = () => {
    const { t } = useTranslation();
    const { fileId: fileIdParam } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // Hooks
    const { user } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();
    const { setFileId, setIsPreset, setGameDetail: setGameDetailToStore } = useGameStore();
    const { setStartedAt } = useTrackingStore();
    const syncDailyTaskPayload = useDailyTaskStore((state) => state.syncFromPayload);

    // 状态
    const [isLoading, setIsLoading] = useState(true);
    const [game, setGame] = useState<UserGameData | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
    const [isUpdateWarningModalOpen, setIsUpdateWarningModalOpen] = useState(false);
    const [isLoadSaveOpen, setIsLoadSaveOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<SaveSummaryItem | null>(null);
    const [isStartOptionsOpen, setIsStartOptionsOpen] = useState(false);
    const [isInteractiveVideoRestartConfirmOpen, setIsInteractiveVideoRestartConfirmOpen] = useState(false);
    const [isReplayDrawerOpen, setIsReplayDrawerOpen] = useState(false);
    const [activeReplayVisibility, setActiveReplayVisibility] = useState<ReplayVisibility>('public');
    const [isPlayStatusLoading, setIsPlayStatusLoading] = useState(false);
    const [playStatus, setPlayStatus] = useState(DEFAULT_PLAY_STATUS);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);

    // Refs
    const likeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const favoriteDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasRecordedViewRef = useRef(false);
    
    const lastTrackedLocationKeyRef = useRef<string | null>(null);

    // 计算值
    const userId = useMemo(() => user?.user?.id, [user?.user?.id]);
    const creatorUserId = useMemo(() => user?.user?.userId, [user?.user?.userId]);
    const fileId = useMemo(() => fileIdParam || game?.file_id || game?.id, [fileIdParam, game]);
    const isStartButtonLoading = isLoading || isPlayStatusLoading;
    const replayManagerUserId = useMemo(() => {
        if (!creatorUserId) return '';
        return String(creatorUserId);
    }, [creatorUserId]);
    const canManageReplayTabs = Boolean(replayManagerUserId);
    const normalizedGameMode = useMemo(
        () => normalizeGameMode(game?.engine, game?.game_tags),
        [game?.engine, game?.game_tags],
    );
    const isGalgame = normalizedGameMode === 'TXT';
    const isInteractiveVideo = normalizedGameMode === 'interactive-video';

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
            toast.error(t('gameDetail.gameIdInvalid'));
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
                setIsFavorited(Boolean(gameData.isFavorited));
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
                toast.error(t('gameDetail.gameNotExist'));
                navigate('/home');
            }
        } catch (error) {
            console.error('获取游戏详情失败:', error);
            toast.error(t('gameDetail.loadGameDetailsFailed'));
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
    const createGalgameSession = async (presetId: string, restart?: boolean): Promise<string | null> => {
        if (!presetId || !userId) {
            return null;
        }

        setIsLoading(true);
        
        try {
            const sessionResponse = await createGalgameSessionApi.createGalgamePlaySession({ 
                fileId: presetId,
                source: mapSourceForSession(enterSource),
                restart,
            });
            
            if (sessionResponse.data.success) {
                const startTime = new Date().toISOString();
                setStartedAt(startTime);
                const sessionId = sessionResponse.data.data.session.session_id;
                trackingApi.reportGameEntry({
                    gameFileId: presetId,
                    source: 'game_detail',
                })
                    .then((resp) => {
                        syncDailyTaskPayload(resp.data.data);
                    })
                    .catch(() => {});
                return sessionId;
            } else {
                toast.error(sessionResponse.data.message || t('gameDetail.createGameFailed'));
                return null;
            }
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response?: { data?: { message?: string } } };
                const errorMessage = axiosError.response?.data?.message || t('gameDetail.createGameFailedRetry');
                toast.error(errorMessage);
            } else {
                toast.error(t('gameDetail.createGameFailedRetry'));
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
                trackingApi.reportGameEntry({
                    gameFileId: presetId,
                    source: 'game_detail',
                })
                    .then((resp) => {
                        syncDailyTaskPayload(resp.data.data);
                    })
                    .catch(() => {});
                return response.data.data.session.session_id;
            } else {
                toast.error(response.data.message || t('gameDetail.createGameFailed'));
                return null;
            }
        } catch (error) {
            console.error('❌ World Session 创建错误:', error);
            toast.error(t('gameDetail.createGameFailedRetry'));
            return null;
        }
    };

    // 实际开始游戏的逻辑
    const startInteractiveVideo = async (restart = false) => {
        if (!fileId) {
            toast.error(t('gameDetail.gameIdInvalid'));
            return;
        }

        const playbackOrientation = normalizePlaybackOrientation(game?.playbackOrientation);
        useGameStore.getState().clearAll();
        navigate(`/interactive-video/${fileId}`, {
            state: {
                fromGameDetail: true,
                ...(playbackOrientation ? { playbackOrientation } : {}),
                ...(restart ? { restart: true } : {}),
            },
        });
    };

    const startGameInternal = async () => {
        if (!fileId || !game) {
            toast.error(t('gameDetail.gameInfoError'));
            return;
        }

        // engine 映射：RPG→story，TXT→galgame，AVG→world，CUSTOM→customif
        const normalized = normalizedGameMode;
        if (!normalized) {
            toast.error(t('gameDetail.unknownGameType'));
            return;
        }

        if (normalized === 'customif') {
            // 进入游戏前清理旧状态
            useGameStore.getState().clearAll();
            const appId = game.customAppId || fileId;
            if (!appId) {
                toast.error(t('gameDetail.missingCustomAppId'));
                return;
            }
            navigate(`/customif/${appId}`);
            return;
        }

        if (normalized === 'st') {
            useGameStore.getState().clearAll();
            navigate(`/st/${fileId}?source=game_detail`);
            return;
        }

        if (normalized === 'interactive-video') {
            await startInteractiveVideo(false);
            return;
        }

        if (normalized === 'TXT') {
            // 进入游戏前清理旧状态
            useGameStore.getState().clearAll();
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
                useGameStore.getState().setFileId(fileId);
                useGameStore.getState().setSessionId(sessionId);
                navigate('/galgame');
            }
            return;
        }

        if (normalized === 'AVG') {
            // 进入游戏前清理旧状态
            useGameStore.getState().clearAll();
            const sessionId = await createMapWorldSession(fileId);
            if (sessionId) {
                useGameStore.getState().setFileId(fileId);
                useGameStore.getState().setSessionId(sessionId);
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

    const fetchPlayStatus = async () => {
        if (!fileId) {
            return DEFAULT_PLAY_STATUS;
        }

        try {
            const response = await getGameDataApi.getPlayStatus(fileId);
            if (response.data?.success && response.data?.data) {
                return {
                    hasContinueState: !!response.data.data.hasContinueState,
                    hasSave: !!response.data.data.hasSave,
                };
            }
            toast.error(response.data?.message || t('gameDetail.getPlayStatusFailed'));
        } catch (error) {
            console.error('获取游玩状态失败:', error);
            toast.error(t('gameDetail.getPlayStatusFailed'));
        }

        return DEFAULT_PLAY_STATUS;
    };

    const handleOpenStartOptions = async () => {
        if (!checkAuth()) return;
        if (!fileId) {
            toast.error(t('gameDetail.gameIdInvalid'));
            return;
        }

        // CUSTOM/ST 模式：直接开始，不需要弹窗
        if (normalizedGameMode === 'customif' || normalizedGameMode === 'st') {
            await startGameInternal();
            return;
        }

        setIsPlayStatusLoading(true);
        try {
            const status = await fetchPlayStatus();
            if (isInteractiveVideo) {
                if (status.hasContinueState) {
                    setPlayStatus(status);
                    setIsStartOptionsOpen(true);
                    return;
                }
                await startInteractiveVideo(true);
                return;
            }
            setPlayStatus(status);
            setIsStartOptionsOpen(true);
        } finally {
            setIsPlayStatusLoading(false);
        }
    };

    const handleStartNewGame = async () => {
        if (!fileId || !normalizedGameMode) {
            toast.error(t('gameDetail.gameIdInvalid'));
            return;
        }
        
        // 进入游戏前清理旧状态
        useGameStore.getState().clearAll();

        if (normalizedGameMode === 'TXT') {
            const sessionId = await createGalgameSession(fileId, true);
            if (sessionId) {
                useGameStore.getState().setFileId(fileId);
                useGameStore.getState().setSessionId(sessionId);
                navigate('/galgame');
            }
            return;
        }

        if (normalizedGameMode === 'st') {
            navigate(`/st/${fileId}?source=game_detail`);
            return;
        }

        if (normalizedGameMode === 'interactive-video') {
            await startInteractiveVideo(true);
            return;
        }

        if (normalizedGameMode === 'AVG') {
            try {
                await GameAction.deletGameSession({ fileId });
            } catch (error) {
                console.error('Delete AVG session before restart failed:', error);
            }

            const sessionId = await createMapWorldSession(fileId);
            if (sessionId) {
                useGameStore.getState().setFileId(fileId);
                useGameStore.getState().setSessionId(sessionId);
                navigate('/galgameMap');
            }
        }
    };

    // 处理点赞
    const handleContinueInteractiveVideo = async () => {
        closeStartOptions();
        await startInteractiveVideo(false);
    };

    const handleRequestInteractiveVideoRestart = () => {
        closeStartOptions();
        setIsInteractiveVideoRestartConfirmOpen(true);
    };

    const handleConfirmInteractiveVideoRestart = async () => {
        setIsInteractiveVideoRestartConfirmOpen(false);
        await startInteractiveVideo(true);
    };

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

    const handleFavorite = () => {
        if (!checkAuth() || isFavoriteLoading) return;

        if (favoriteDebounceTimerRef.current) {
            clearTimeout(favoriteDebounceTimerRef.current);
        }

        favoriteDebounceTimerRef.current = setTimeout(async () => {
            if (!fileId || !userId) return;

            setIsFavoriteLoading(true);
            try {
                const response = await favoriteApi.toggle({ fileId });

                if (response.data.success && response.data.data) {
                    const nextFavorited = response.data.data.isFavorited;
                    setIsFavorited(nextFavorited);
                    if (game) {
                        setGame({
                            ...game,
                            isFavorited: nextFavorited,
                        });
                    }
                    toast.success(nextFavorited ? t('gameDetail.favoriteAdded') : t('gameDetail.favoriteRemoved'));
                }
            } catch (error) {
                console.error('收藏操作失败:', error);
                toast.error(t('gameDetail.favoriteFailed'));
            } finally {
                setIsFavoriteLoading(false);
                favoriteDebounceTimerRef.current = null;
            }
        }, FAVORITE_DEBOUNCE_DELAY);
    };

    // 清理定时器
    useEffect(() => {
        return () => {
            if (likeDebounceTimerRef.current) {
                clearTimeout(likeDebounceTimerRef.current);
            }
            if (favoriteDebounceTimerRef.current) {
                clearTimeout(favoriteDebounceTimerRef.current);
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
        setIsShareModalOpen(true);
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success(t('gameDetail.linkCopied'));
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = window.location.href;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                toast.success(t('gameDetail.linkCopied'));
            } catch (err) {
                toast.error(t('copyFailed'));
            }
            document.body.removeChild(textArea);
        }
    };

    const handleShowQRCode = () => {
        setIsShareModalOpen(false);
        setIsQRCodeModalOpen(true);
    };

    // ===== 存档读取（列表 → 预览 → 加载） =====
    const handleOpenLoadSave = () => {
        if (!checkAuth()) return;
        setIsLoadSaveOpen(true);
    };

    const closeStartOptions = () => {
        setIsStartOptionsOpen(false);
    };

    const openReplayDrawer = useCallback(() => {
        setIsStartOptionsOpen(false);
        setIsReplayDrawerOpen(true);
    }, []);

    const closeReplayDrawer = useCallback(() => {
        setIsReplayDrawerOpen(false);
    }, []);

    useEffect(() => {
        if (!isReplayDrawerOpen) return;

        const previousOverflow = document.body.style.overflow;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeReplayDrawer();
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [closeReplayDrawer, isReplayDrawerOpen]);

    const handlePreviewSave = async (item: SaveSummaryItem) => {
        // 加载详情并展示在 TEXT 区域
        try {
            if (!fileId) return;
            const resp = await (await import('../api/galgame/saves')).savesApi.getDetail(item.saveId, fileId);
            const detail = resp.data;
            setPreviewItem({ saveId: detail.saveId, summaryText: detail.summaryText, createdAt: detail.createdAt });
        } catch (e) {
            console.error('获取存档详情失败:', e);
            toast.error(t('galgame.requestError'));
            // 兜底显示列表项内容
            setPreviewItem(item);
        }
    };

    const handleLoadSave = async (saveId: string) => {
        try {
            if (!fileId) return;
            setIsLoading(true);
            // 进入游戏前清理旧状态
            useGameStore.getState().clearAll();
            // 复用可选 saveId 的 /visual/session/create
            const resp = await createGalgameSessionApi.createGalgameEditSession({ fileId, saveId });
            if (resp.data.success) {
                const sessionId = resp.data.data.session;
                useGameStore.getState().setFileId(fileId);
                useGameStore.getState().setSessionId(sessionId);
                navigate('/galgame', { state: { saveEntry: 'load' } });
                return;
            }
            toast.error(resp.data.message || t('galgame.requestError'));
        } catch (e) {
            console.error('加载存档失败:', e);
            toast.error(t('galgame.requestError'));
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
                    <p>{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.errorContainer}>
                    <p>{t('gameDetail.gameNotExist')}</p>
                    <button onClick={() => navigate('/home')} className={styles.backButton}>
                        {t('gameDetail.backToHome')}
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
                    <button className={styles.backIconButton} onClick={handleBack} aria-label={t('gameDetail.back')}>
                        <IoChevronBack />
                    </button>
                    <div className={styles.topActions}>
                        <button className={styles.topIconButton} onClick={handleShare} aria-label={t('gameDetail.share')}>
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
                                        {game.title || t('gameDetail.unnamedGame')}
                                    </h1>
                                    <div className={styles.headerActions}>
                                        <button
                                            type="button"
                                            className={`${styles.favoriteButton} ${isFavorited ? styles.favorited : ''}`}
                                            onClick={handleFavorite}
                                            disabled={isFavoriteLoading}
                                            aria-label={t('gameDetail.favorite')}
                                            aria-pressed={isFavorited}
                                        >
                                            {isFavorited ? <AiFillStar /> : <AiOutlineStar />}
                                        </button>
                                        <button
                                            className={`${styles.likeButton} ${isLiked ? styles.liked : ''} ${styles.likeInline}`}
                                            onClick={handleLike}
                                            disabled={isLikeLoading}
                                            aria-label={t('gameDetail.like')}
                                        >
                                            <img
                                                src={`${import.meta.env.BASE_URL}data/assets/gameDetail/${isLiked ? '点赞' : '未点赞'}.png`}
                                                alt={t('gameDetail.like')}
                                            />
                                            <span>{likeCount || 0}</span>
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.gameMeta}>
                                    <div className={styles.metaLeft}>
                                        <span className={styles.gameType}>{game.game_tags}</span>
                                        <div className={styles.ratingSection}>
                                            <span className={styles.rating}>
                                                {game.rating_avg ?? DEFAULT_RATING}
                                                <span className={styles.ratingUnit}>{t('gameDetail.ratingUnit')}</span>
                                            </span>
                                        </div>
                                    </div>
                                    {isGalgame && (
                                        <button
                                            type="button"
                                            className={styles.replayMetaButton}
                                            onClick={openReplayDrawer}
                                        >
                                            <span className={styles.replayEntryLabel}>{t('gameDetail.replayHighlights')}</span>
                                            <span className={styles.replayEntryArrow} aria-hidden="true">&gt;</span>
                                        </button>
                                    )}
                                </div>
                                {/* 作者信息放在标题下面 */}
                                <div className={styles.authorSection}>
                                    <div className={styles.authorLeft}>
                                        <img
                                            className={styles.authorAvatar}
                                            src={getImageUrl(game.avatarUrl) || `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`}
                                            alt="作者头像"
                                        />
                                        <span className={styles.authorName}>
                                            {game.author_name || t('gameDetail.unknownAuthor')}
                                        </span>
                                    </div>
                                    {game.groupNo && (
                                        <span className={styles.groupNoTag}>
                                            {t('createGame.qqGroup')}: {game.groupNo}
                                            <button
                                                className={styles.groupNoCopyBtn}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(game.groupNo!).catch(() => {});
                                                    toast.success(t('gameDetail.qqGroupCopied'));
                                                }}
                                                title={t('createGame.copyGroupNo')}
                                            >
                                                <MdContentCopy />
                                            </button>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>


                    <h3 className={styles.detailSectionTitle}>{t('gameDetail.gameIntroduction')}</h3>
                    <div className={styles.descriptionSection}>
                        <p>{normalizeNewlines(game.description || t('gameDetail.noDescription'))}</p>
                    </div>

                    {game.version_notes?.trim() ? (
                        <>
                            <h3 className={styles.detailSectionTitle}>{t('gameDetail.versionNotes')}</h3>
                            <div className={styles.descriptionSection}>
                                <p>{normalizeNewlines(game.version_notes)}</p>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>

            {/* 底部悬浮按钮栏 */}
            <div className={styles.floatingActionBar}>
                <div className={styles.floatingActionInner}>
                    <div className={styles.bottomActionRow}>
                        <button
                            className={styles.startButton}
                            onClick={handleOpenStartOptions}
                            disabled={isStartButtonLoading}
                        >
                            {isStartButtonLoading ? (
                                <div className={styles.loading}>
                                    <span className={styles.loadingDot}></span>
                                    <span className={styles.loadingDot}></span>
                                    <span className={styles.loadingDot}></span>
                                </div>
                            ) : (
                                t('gameDetail.startExperience')
                            )}
                        </button>
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
                title={t('gameDetail.gameUpdated')}
                message={normalizeNewlines(t('gameDetail.gameUpdatedTip'))}
                confirmButtonText={t('gameDetail.continueGame')}
                cancelButtonText={t('common.cancel')}
            />
            <ConfirmModal
                isOpen={isInteractiveVideoRestartConfirmOpen}
                onConfirm={handleConfirmInteractiveVideoRestart}
                onCancel={() => setIsInteractiveVideoRestartConfirmOpen(false)}
                title={t('gameDetail.ivgRestartConfirmTitle')}
                message={t('gameDetail.ivgRestartConfirmMessage')}
                confirmButtonText={t('gameDetail.ivgRestartPlay')}
                cancelButtonText={t('common.cancel')}
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
                loadButtonText={t('gameDetail.startExperience')}
            />
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                onCopyLink={handleCopyLink}
                onShowQRCode={handleShowQRCode}
            />
            <QRCodeModal
                isOpen={isQRCodeModalOpen}
                onClose={() => setIsQRCodeModalOpen(false)}
                url={window.location.href}
            />
            {isReplayDrawerOpen && (
                <div className={`${styles.startOptionsOverlay} ${styles.replayDrawerOverlay}`} onClick={closeReplayDrawer}>
                    <aside
                        className={styles.replayDrawer}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('gameDetail.replayHighlights')}
                    >
                        <div className={styles.startOptionsHeader}>
                            <div className={styles.startOptionsHeaderMain}>
                                <h2 className={styles.startOptionsTitle}>{t('gameDetail.replayHighlights')}</h2>
                            </div>
                            <button
                                className={`${styles.startOptionsClose} ${styles.replayDrawerClose}`}
                                onClick={closeReplayDrawer}
                                aria-label={t('gameDetail.closeReplayHighlights')}
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        {canManageReplayTabs && (
                            <div className={styles.replayDrawerTabs} role="tablist" aria-label={t('createGame.replayVisibilityFilter')}>
                                <button
                                    key={REPLAY_VISIBILITY_TABS_PUBLIC}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeReplayVisibility === REPLAY_VISIBILITY_TABS_PUBLIC}
                                    tabIndex={activeReplayVisibility === REPLAY_VISIBILITY_TABS_PUBLIC ? 0 : -1}
                                    className={`${styles.replayDrawerTab} ${activeReplayVisibility === REPLAY_VISIBILITY_TABS_PUBLIC ? styles.replayDrawerTabActive : ''}`}
                                    onClick={() => setActiveReplayVisibility(REPLAY_VISIBILITY_TABS_PUBLIC)}
                                >
                                    {t('gameDetail.replayVisibility.public')}
                                </button>
                                <button
                                    key={REPLAY_VISIBILITY_TABS_UNLISTED}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeReplayVisibility === REPLAY_VISIBILITY_TABS_UNLISTED}
                                    tabIndex={activeReplayVisibility === REPLAY_VISIBILITY_TABS_UNLISTED ? 0 : -1}
                                    className={`${styles.replayDrawerTab} ${activeReplayVisibility === REPLAY_VISIBILITY_TABS_UNLISTED ? styles.replayDrawerTabActive : ''}`}
                                    onClick={() => setActiveReplayVisibility(REPLAY_VISIBILITY_TABS_UNLISTED)}
                                >
                                    {t('gameDetail.replayVisibility.unlisted')}
                                </button>
                                <button
                                    key={REPLAY_VISIBILITY_TABS_PRIVATE}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeReplayVisibility === REPLAY_VISIBILITY_TABS_PRIVATE}
                                    tabIndex={activeReplayVisibility === REPLAY_VISIBILITY_TABS_PRIVATE ? 0 : -1}
                                    className={`${styles.replayDrawerTab} ${activeReplayVisibility === REPLAY_VISIBILITY_TABS_PRIVATE ? styles.replayDrawerTabActive : ''}`}
                                    onClick={() => setActiveReplayVisibility(REPLAY_VISIBILITY_TABS_PRIVATE)}
                                >
                                    {t('gameDetail.replayVisibility.private')}
                                </button>
                            </div>
                        )}
                        <div className={styles.replayDrawerBody}>
                            {fileId ? (
                                <ReplayList
                                    fileId={fileId}
                                    includeUnlisted={canManageReplayTabs && activeReplayVisibility === 'unlisted'}
                                    showVisibility={canManageReplayTabs}
                                    visibility={canManageReplayTabs ? activeReplayVisibility : 'public'}
                                    currentUserId={replayManagerUserId || undefined}
                                />
                            ) : null}
                        </div>
                    </aside>
                </div>
            )}
            {isStartOptionsOpen && (
                <div className={styles.startOptionsOverlay} onClick={closeStartOptions}>
                    <div
                        className={styles.startOptionsModal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.startOptionsHeader}>
                            <div className={styles.startOptionsHeaderMain}>
                                <h2 className={styles.startOptionsTitle}>{t('gameDetail.selectStartMethod')}</h2>
                            </div>
                            <button
                                className={styles.startOptionsClose}
                                onClick={closeStartOptions}
                                aria-label={t('common.close')}
                            >
                                <img src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`} alt={t('common.close')} />
                            </button>
                        </div>
                        <div className={styles.startOptionsButtons}>
                                <button
                                    className={styles.startOptionsPrimary}
                                    onClick={async () => {
                                        if (isInteractiveVideo) {
                                            await handleContinueInteractiveVideo();
                                            return;
                                        }
                                        closeStartOptions();
                                        await handleStartNewGame();
                                    }}
                                >
                                    {isInteractiveVideo ? t('gameDetail.ivgContinuePlay') : t('gameDetail.newStart')}
                                </button>
                                <button
                                    className={styles.startOptionsSecondary}
                                    disabled={isInteractiveVideo ? false : !playStatus.hasContinueState}
                                    onClick={async () => {
                                        if (isInteractiveVideo) {
                                            handleRequestInteractiveVideoRestart();
                                            return;
                                        }
                                        closeStartOptions();
                                        await handleStartGame();
                                    }}
                                >
                                    {isInteractiveVideo ? t('gameDetail.ivgRestartPlay') : t('gameDetail.continueExperience')}
                                </button>
                                {isInteractiveVideo ? null : isGalgame && (
                                    <button
                                        className={styles.startOptionsGhost}
                                        disabled={!playStatus.hasSave}
                                        onClick={() => {
                                            closeStartOptions();
                                            handleOpenLoadSave();
                                        }}
                                    >
                                        {t('gameDetail.loadSave')}
                                    </button>
                                )}
                                {isInteractiveVideo ? null : isGalgame && (
                                    <button
                                        className={styles.startOptionsGhost}
                                        onClick={openReplayDrawer}
                                    >
                                        {t('gameDetail.replay')}
                                    </button>
                                )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameDetail;
