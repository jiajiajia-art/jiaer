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
import {
    getImageUrl,
    resolveGameCoverUrl,
    resolveOriginalCoverUrl,
    coverUrlAfterDisplayCoverError,
} from '../utils/constants';
import { readGameDetailPreview } from '../utils/gameDetailNavigation';
import { MdContentCopy } from 'react-icons/md';
import AuthModal from '../components/AuthModal';
import LoadSaveListModal from '../components/CreateGame/LoadSaveListModal';
import SavePreviewModal from '../components/CreateGame/SavePreviewModal';
import ShareModal from '../components/CommonModal/ShareModal';
import QRCodeModal from '../components/CommonModal/QRCodeModal';
import { savesApi, type SaveSummaryItem } from '../api/galgame/saves';
import novelApi, { type DerivedNovelSummary } from '../api/galgame/novel';
import { useTrackingStore } from '../store/trackingStore';
import { trackingApi } from '../api/statistics/trackingApi';
import gamePromotionApi from '../api/promotion/gamePromotionApi';
import { getOrCreatePromoAnonId } from '../utils/promoAnonId';
import GameRating from '../components/GameRating/GameRating';
import { useDailyTaskStore } from '../store/dailyTaskStore';
import { useTranslation } from 'react-i18next';
import { getGameTypeLabelFromMeta } from '../utils/gameTypeLabel';
import { buildNovelReadPath, buildSourceGameDetailPath } from '../utils/novelGame';
import { prefetchGalgameDocument } from '../lib/galgame/galgameDocumentCache';

import { DetailHeartIcon, DetailShareIcon, DetailStarIcon } from '../components/GameDetailStatIcons';

/** 功能注释：详情页操作图标；返回改用分类页同款描边箭头，浅色封面上更清晰 */
const HOME_ICON_BASE = `${import.meta.env.BASE_URL}data/assetsv2/home`;
const ICON_GAMEPAD = `${HOME_ICON_BASE}/icon_gamepad.webp`;
const ICON_FILMSTRIP = `${HOME_ICON_BASE}/icon_filmstrip.webp`;
import {
    looksLikeHtml,
    descriptionToPlainText,
    hydrateDescriptionHtmlForDisplay,
} from '../utils/gameDescriptionHtml';
import {
    buildGameDetailMetaLine,
    descriptionNeedsExpand,
    formatDetailStatCount,
    resolveGameDetailTags,
} from '../lib/gameDetailView';
import { resolveGameCardAuthor } from '../lib/gameCardAuthor';
import {
    getInteractiveVideoAccess,
    unlockInteractiveVideoContent,
    type InteractiveVideoAccess,
    type InteractiveVideoPricingConfig,
} from '../api/interactiveVideo';
import {
    getInteractiveVideoBuyoutPaymentOptions,
    getInteractiveVideoStartButtonLabel,
    shouldConfirmInteractiveVideoBuyoutBeforeStart,
    isInteractiveVideoOwnerUser,
    type IvgBuyoutPaymentOption,
} from '../utils/interactiveVideoPricing';

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

/** sessionStorage：未登录用户从 ?promo= 进详情页时暂存 code，登录后 consumePending 提交 */
const PENDING_PROMO_STORAGE_KEY = 'pending_game_promotion_code';

/** 支持 ?promo= 与 ?promotionCode= 两种 query（分享链与旧链接兼容） */
const readPromoCodeFromLocation = (search: string): string => {
    const params = new URLSearchParams(search);
    return String(params.get('promo') || params.get('promotionCode') || '').trim();
};

const rememberPendingPromoCode = (promotionCode: string) => {
    if (!promotionCode) return;
    try {
        sessionStorage.setItem(PENDING_PROMO_STORAGE_KEY, promotionCode);
    } catch {
        // ignore storage errors
    }
};

const clearPendingPromoCode = () => {
    try {
        sessionStorage.removeItem(PENDING_PROMO_STORAGE_KEY);
    } catch {
        // ignore storage errors
    }
};

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
    if (normalizedEngine === 'NOVEL') return 'NOVEL' as const;
    if (normalizedEngine === 'TXT' || normalizedEngine === 'AVG' || normalizedEngine === 'RPG') return normalizedEngine;

    const normalizedTags = normalizeRaw(gameTags);
    if (normalizedTags === 'CUSTOM') return 'customif' as const;
    if (normalizedTags === 'IVG') return 'interactive-video' as const;
    if (normalizedTags === 'NOVEL') return 'NOVEL' as const;
    if (normalizedTags === 'TXT' || normalizedTags === 'AVG' || normalizedTags === 'RPG') return normalizedTags;

    return '';
};

const normalizePlaybackOrientation = (value?: string | null) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'landscape' || normalized === 'portrait' ? normalized : null;
};

const INTERACTIVE_VIDEO_UNLOCK_ERROR_MESSAGES: Record<string, string> = {
    INSUFFICIENT_POINTS: '织梦豆不足',
    'Insufficient points': '织梦豆不足',
    INSUFFICIENT_DIAMONDS: 'KK币不足',
    'Insufficient diamonds': 'KK币不足',
    PAYMENT_METHOD_UNAVAILABLE: '当前支付方式不可用',
    'Payment method is unavailable': '当前支付方式不可用',
    BUYOUT_NOT_FOR_SALE: '该互动影游暂不支持买断',
    'Buyout is not for sale': '该互动影游暂不支持买断',
    DIRECTORY_NOT_FOR_SALE: '该付费内容暂不可购买',
    'Directory is not for sale': '该付费内容暂不可购买',
    FREE_UNLOCK_UNAVAILABLE: '当前内容暂不支持免费解锁',
    'Free unlock is unavailable': '当前内容暂不支持免费解锁',
    INVALID_CURRENCY: '支付方式无效',
    'Invalid currency': '支付方式无效',
    INVALID_PURCHASE_TYPE: '购买类型无效',
    'Invalid purchase type': '购买类型无效',
    INVALID_PARAM: '支付参数无效，请刷新后重试',
    INVALID_PURCHASE_PARAM: '支付参数无效，请刷新后重试',
    'Invalid purchase parameter': '支付参数无效，请刷新后重试',
    AUTH_REQUIRED: '请先登录后再解锁',
    'Authentication token required': '请先登录后再解锁',
    NOT_FOUND: '互动影游不存在或已下架',
    'Game not found': '互动影游不存在或已下架',
    FORBIDDEN: '暂无权限解锁该互动影游',
    Forbidden: '暂无权限解锁该互动影游',
    MONETIZATION_ERROR: '解锁失败，请稍后重试',
    'Interactive video monetization error': '解锁失败，请稍后重试',
};

const getInteractiveVideoUnlockErrorMessage = (code?: string | null, message?: string | null) => {
    const normalizedCode = String(code || '').trim();
    const normalizedMessage = String(message || '').trim();
    const mappedMessage = INTERACTIVE_VIDEO_UNLOCK_ERROR_MESSAGES[normalizedCode]
        || INTERACTIVE_VIDEO_UNLOCK_ERROR_MESSAGES[normalizedMessage];
    if (mappedMessage) return mappedMessage;
    if (normalizedMessage && !/[A-Za-z]/.test(normalizedMessage)) return normalizedMessage;
    return '解锁失败，请稍后重试';
};

const GameDetail: React.FC = () => {
    const { t } = useTranslation();
    const { fileId: fileIdParam } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // Hooks
    const { user } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();
    const { setGameDetail: setGameDetailToStore } = useGameStore();
    const { setStartedAt } = useTrackingStore();
    const syncDailyTaskPayload = useDailyTaskStore((state) => state.syncFromPayload);

    const initialPreview = readGameDetailPreview(location.state, fileIdParam);

    // 状态：有列表预览时首帧直接出内容，避免整页转圈
    const [isLoading, setIsLoading] = useState(() => !initialPreview);
    const [game, setGame] = useState<UserGameData | null>(() => initialPreview);
    const [isLiked, setIsLiked] = useState(() => checkIsLiked(initialPreview?.reaction));
    const [isFavorited, setIsFavorited] = useState(() => Boolean(initialPreview?.isFavorited));
    const [likeCount, setLikeCount] = useState(() => initialPreview?.like_count || 0);
    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
    const [isUpdateWarningModalOpen, setIsUpdateWarningModalOpen] = useState(false);
    const [isLoadSaveOpen, setIsLoadSaveOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<SaveSummaryItem | null>(null);
    const [isStartOptionsOpen, setIsStartOptionsOpen] = useState(false);
    const [isDerivedNovelDrawerOpen, setIsDerivedNovelDrawerOpen] = useState(false);
    const [isInteractiveVideoRestartConfirmOpen, setIsInteractiveVideoRestartConfirmOpen] = useState(false);
    const [isPlayStatusLoading, setIsPlayStatusLoading] = useState(false);
    const [playStatus, setPlayStatus] = useState(DEFAULT_PLAY_STATUS);
    const [derivedNovels, setDerivedNovels] = useState<DerivedNovelSummary[]>([]);
    const [derivedNovelsLoading, setDerivedNovelsLoading] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<'introduction' | 'reviews'>('introduction');
    /** 功能注释：剧情简介折叠，对齐效果图「阅读更多」 */
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isInteractiveVideoAccessLoading, setIsInteractiveVideoAccessLoading] = useState(false);
    const [isInteractiveVideoBuyoutConfirmOpen, setIsInteractiveVideoBuyoutConfirmOpen] = useState(false);
    const [isInteractiveVideoBuyoutUnlocking, setIsInteractiveVideoBuyoutUnlocking] = useState(false);
    const [interactiveVideoAccessInfo, setInteractiveVideoAccessInfo] = useState<{
        config: InteractiveVideoPricingConfig;
        access: InteractiveVideoAccess;
    } | null>(null);

    // Refs
    const likeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const favoriteDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasRecordedViewRef = useRef(false);
    
    const lastTrackedLocationKeyRef = useRef<string | null>(null);

    // 计算值
    const userId = useMemo(() => user?.user?.id, [user?.user?.id]);
    const fileId = useMemo(() => fileIdParam || game?.file_id || game?.id, [fileIdParam, game]);
    const isStartButtonLoading = isLoading || isPlayStatusLoading || isInteractiveVideoAccessLoading || isInteractiveVideoBuyoutUnlocking;
    const normalizedGameMode = useMemo(
        () => normalizeGameMode(game?.engine, game?.game_tags),
        [game?.engine, game?.game_tags],
    );
    const isGalgame = normalizedGameMode === 'TXT';
    const isNovel = normalizedGameMode === 'NOVEL';
    const isInteractiveVideo = normalizedGameMode === 'interactive-video';
    const isInteractiveVideoOwner = useMemo(
        () => isInteractiveVideoOwnerUser(game?.creator_user_id, user?.user),
        [game?.creator_user_id, user?.user],
    );
    const startButtonText = useMemo(() => {
        if (isNovel) return t('gameDetail.startReading');
        const fallbackLabel = t('gameDetail.startExperience');
        if (!isInteractiveVideo) return fallbackLabel;
        return getInteractiveVideoStartButtonLabel({
            config: interactiveVideoAccessInfo?.config,
            access: interactiveVideoAccessInfo?.access,
            isOwner: isInteractiveVideoOwner,
            fallbackLabel,
        });
    }, [interactiveVideoAccessInfo, isInteractiveVideo, isInteractiveVideoOwner, isNovel, t]);
    const interactiveVideoBuyoutPaymentOptions = useMemo(
        () => getInteractiveVideoBuyoutPaymentOptions(interactiveVideoAccessInfo?.config),
        [interactiveVideoAccessInfo?.config],
    );
    const shouldConfirmInteractiveVideoBuyout = useMemo(
        () => shouldConfirmInteractiveVideoBuyoutBeforeStart({
            config: interactiveVideoAccessInfo?.config,
            access: interactiveVideoAccessInfo?.access,
            isOwner: isInteractiveVideoOwner,
        }),
        [interactiveVideoAccessInfo, isInteractiveVideoOwner],
    );
    const gameTypeLabel = useMemo(
        () => (game ? getGameTypeLabelFromMeta(game) : ''),
        [game],
    );
    const heroTags = useMemo(() => {
        if (!game) return [] as string[];
        const tags = resolveGameDetailTags(game);
        if (tags.length > 0) return tags;
        if (gameTypeLabel) return [gameTypeLabel];
        return [] as string[];
    }, [game, gameTypeLabel]);
    const heroMetaLine = useMemo(() => {
        if (!game) return '';
        return buildGameDetailMetaLine(game, {
            producedBy: (author) => t('gameDetail.producedBy', { author }),
            chapterUnit: t('gameDetail.chapterUnit'),
            minuteUnit: t('gameDetail.minuteUnit'),
        });
    }, [game, t]);
    /** 功能注释：英雄区制作信息左侧展示作者头像，与列表卡片同源字段 avatarUrl */
    const heroAuthorAvatarSrc = useMemo(() => {
        if (!game) return `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`;
        const author = resolveGameCardAuthor(game, {
            unknownAuthor: t('gameDetail.unknownAuthor'),
        });
        return (
            getImageUrl(author.avatarUrl)
            || `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`
        );
    }, [game, t]);
    const shareCountDisplay = useMemo(
        () => formatDetailStatCount(game?.share_count),
        [game?.share_count],
    );
    const favoriteCountDisplay = useMemo(
        () => formatDetailStatCount(game?.favorite_count),
        [game?.favorite_count],
    );
    const likeCountDisplay = useMemo(() => formatDetailStatCount(likeCount), [likeCount]);
    const sourceAuthorName = game?.source_author_name || '';
    const sourceFileId = game?.source_file_id || '';
    const canShowLoadSave = isGalgame && !isNovel && !isInteractiveVideo;
    const canShowStoryReplay = isGalgame && !isNovel;

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

    // 推广链落地：记录点击；已登录则立即 attribute，未登录则等 AuthModal/本页 consumePending
    useEffect(() => {
        const promotionCode = readPromoCodeFromLocation(location.search);
        if (!promotionCode) return;

        rememberPendingPromoCode(promotionCode);
        const anonId = getOrCreatePromoAnonId();
        const clickedAt = new Date().toISOString();

        void gamePromotionApi.recordClick({
            promotionCode,
            anonId,
            clickedAt,
        }).catch((error) => {
            console.warn('[GameDetail] record promotion click failed:', error);
        });

        if (userId) {
            void gamePromotionApi.attribute({
                promotionCode,
                anonId,
                clickedAt,
                isNewUser: false,
            }).then(() => {
                clearPendingPromoCode();
            }).catch((error) => {
                console.warn('[GameDetail] attribute promotion failed:', error);
            });
        }
    }, [location.search, userId]);

    // 任意路径登录后进入详情页时，补消费 pending 推广点击（与 AuthModal 登录分支双保险）
    useEffect(() => {
        if (!userId) return;
        const anonId = getOrCreatePromoAnonId();
        void gamePromotionApi.consumePending(anonId).catch((error) => {
            console.warn('[GameDetail] consume pending promotion failed:', error);
        });
    }, [userId]);

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

    // 加载游戏详情：有首页/列表缓存则先出内容，再后台补点赞/收藏等
    useEffect(() => {
        if (!fileIdParam) {
            return;
        }

        hasRecordedViewRef.current = false;
        let cancelled = false;
        const loadToastIds = {
            missing: 'game-detail-not-exist',
            failed: 'game-detail-load-failed',
        } as const;

        const preview = readGameDetailPreview(location.state, fileIdParam);
        const applyGameData = (gameData: UserGameData) => {
            setGame(gameData);
            setIsLiked(checkIsLiked(gameData.reaction));
            setIsFavorited(Boolean(gameData.isFavorited));
            setLikeCount(gameData.like_count || 0);
            setGameDetailToStore(gameData);
        };

        if (preview) {
            applyGameData(preview);
            setIsLoading(false);
        } else {
            setGame(null);
            setIsLiked(false);
            setIsFavorited(false);
            setLikeCount(0);
            setIsLoading(true);
        }

        const load = async () => {
            try {
                const response = await getGameDataApi.getGameDetail({
                    fileId: fileIdParam,
                });

                if (cancelled) return;

                if (response.data?.data) {
                    applyGameData(response.data.data);
                } else if (!preview) {
                    toast.error(t('gameDetail.gameNotExist'), { id: loadToastIds.missing });
                    navigate('/home');
                } else {
                    console.warn('[GameDetail] refresh failed while showing list preview');
                }
            } catch (error) {
                if (cancelled) return;
                console.error('获取游戏详情失败:', error);
                if (!preview) {
                    toast.error(t('gameDetail.loadGameDetailsFailed'), { id: loadToastIds.failed });
                    navigate('/home');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [fileIdParam, location.key, location.state, navigate, setGameDetailToStore, t]);

    // 浏览统计：详情加载完成且已登录后只记一次
    useEffect(() => {
        if (!RECORD_CONVERSION || !userId || !fileId || !game || hasRecordedViewRef.current) {
            return;
        }
        if (String(game.file_id || game.id) !== String(fileId)) {
            return;
        }
        hasRecordedViewRef.current = true;
        statisticsApi.addView({
            fileId: String(fileId),
            userId: String(userId),
        }).catch((error) => {
            console.error('添加浏览统计失败:', error);
        });
    }, [fileId, userId, game]);

    const fetchInteractiveVideoAccessInfo = useCallback(async () => {
        if (!fileId || !isInteractiveVideo || !userId) {
            setInteractiveVideoAccessInfo(null);
            return null;
        }

        setIsInteractiveVideoAccessLoading(true);
        try {
            const response = await getInteractiveVideoAccess(String(fileId));
            const data = response.data?.data;
            const nextInfo = data ? { config: data.config, access: data.access } : null;
            setInteractiveVideoAccessInfo(nextInfo);
            return nextInfo;
        } catch (error) {
            console.warn('[GameDetail] load IVG access failed:', error);
            setInteractiveVideoAccessInfo(null);
            return null;
        } finally {
            setIsInteractiveVideoAccessLoading(false);
        }
    }, [fileId, isInteractiveVideo, userId]);

    useEffect(() => {
        if (!fileId || !isInteractiveVideo || !userId) {
            setInteractiveVideoAccessInfo(null);
            setIsInteractiveVideoAccessLoading(false);
            return;
        }

        let cancelled = false;
        setIsInteractiveVideoAccessLoading(true);
        getInteractiveVideoAccess(String(fileId))
            .then((response) => {
                if (cancelled) return;
                const data = response.data?.data;
                setInteractiveVideoAccessInfo(data ? { config: data.config, access: data.access } : null);
            })
            .catch((error) => {
                console.warn('[GameDetail] load IVG access failed:', error);
                if (!cancelled) setInteractiveVideoAccessInfo(null);
            })
            .finally(() => {
                if (!cancelled) setIsInteractiveVideoAccessLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [fileId, isInteractiveVideo, userId]);

    // 原作详情：仅拉取已上架衍生视觉小说（草稿对原作者也不可见）
    useEffect(() => {
        if (!fileId || !isGalgame || isNovel) {
            setDerivedNovels([]);
            return;
        }

        let cancelled = false;
        setDerivedNovelsLoading(true);
        novelApi
            .listBySource(String(fileId), 20)
            .then((resp) => {
                if (cancelled) return;
                setDerivedNovels(Array.isArray(resp.data?.items) ? resp.data.items : []);
            })
            .catch((error) => {
                console.error('加载衍生视觉小说失败:', error);
                if (!cancelled) setDerivedNovels([]);
            })
            .finally(() => {
                if (!cancelled) setDerivedNovelsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [fileId, isGalgame, isNovel]);

    // 创建 Galgame 会话（勿用 isLoading 整页挡住详情；「新的开始」会先 navigate 再后台建会话）
    const createGalgameSession = useCallback(async (presetId: string, restart?: boolean): Promise<string | null> => {
        if (!presetId || !userId) {
            return null;
        }

        try {
            const sessionResponse = await createGalgameSessionApi.createGalgamePlaySession({ 
                fileId: presetId,
                source: mapSourceForSession(enterSource),
                restart,
            });
            
            if (sessionResponse.data.success) {
                const startTime = new Date().toISOString();
                setStartedAt(startTime);
                const nextSessionId = sessionResponse.data.data.session.session_id;
                trackingApi.reportGameEntry({
                    gameFileId: presetId,
                    source: 'game_detail',
                })
                    .then((resp) => {
                        syncDailyTaskPayload(resp.data.data);
                    })
                    .catch(() => {});
                return nextSessionId;
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
        }
    }, [userId, enterSource, mapSourceForSession, setStartedAt, syncDailyTaskPayload, t]);

    /** TXT：先进入 /galgame 展示壳层，再后台建 session，避免详情页「加载中…」白屏死等 */
    const launchTxtGalgame = useCallback((opts: { restart?: boolean }) => {
        if (!fileId) {
            toast.error(t('gameDetail.gameIdInvalid'));
            return;
        }
        if (!userId) {
            toast.error(t('gameDetail.createGameFailedRetry'));
            return;
        }

        useGameStore.getState().clearPlayRuntime();
        useGameStore.getState().setFileId(fileId);
        if (game) {
            useGameStore.getState().setIsPreset(game.is_preset == 1);
        }
        prefetchGalgameDocument(fileId);
        navigate('/galgame', {
            state: {
                bootPending: true,
                ...(opts.restart ? { bootNewStart: true } : {}),
            },
        });

        void (async () => {
            try {
                if (!opts.restart) {
                    try {
                        const resp = await betaWhitelistApi.get(fileId);
                        useGameStore.getState().setGalgameBetaAttributes(!!resp.data?.whitelisted);
                    } catch {
                        useGameStore.getState().setGalgameBetaAttributes(false);
                        console.warn('[Beta] whitelist check failed, default disabled');
                    }
                }

                const nextSessionId = await createGalgameSession(fileId, opts.restart);
                if (nextSessionId) {
                    useGameStore.getState().setSessionId(nextSessionId);
                    return;
                }
            } catch (error) {
                console.error('[GameDetail] launchTxtGalgame failed:', error);
            }
            navigate(`/game/${encodeURIComponent(fileId)}`, { replace: true });
        })();
    }, [fileId, userId, game, navigate, t, createGalgameSession]);

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
            launchTxtGalgame({ restart: false });
            return;
        }

        if (normalized === 'AVG') {
            useGameStore.getState().clearPlayRuntime();
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

        if (isNovel) {
            navigate(buildNovelReadPath(fileId));
            return;
        }

        if (isInteractiveVideo) {
            const latestAccessInfo = interactiveVideoAccessInfo ?? await fetchInteractiveVideoAccessInfo();
            if (!latestAccessInfo && !isInteractiveVideoOwner) {
                toast.error('获取付费信息失败，请稍后重试');
                return;
            }

            const paymentOptions = getInteractiveVideoBuyoutPaymentOptions(latestAccessInfo?.config);
            const shouldConfirmBuyout = latestAccessInfo === interactiveVideoAccessInfo
                ? shouldConfirmInteractiveVideoBuyout
                : shouldConfirmInteractiveVideoBuyoutBeforeStart({
                    config: latestAccessInfo?.config,
                    access: latestAccessInfo?.access,
                    isOwner: isInteractiveVideoOwner,
                });

            if (shouldConfirmBuyout) {
                setIsInteractiveVideoBuyoutConfirmOpen(true);
                return;
            }

            if (
                !isInteractiveVideoOwner &&
                String(latestAccessInfo?.config?.mode || 'free') === 'buyout' &&
                !latestAccessInfo?.access?.hasBuyout &&
                paymentOptions.length === 0
            ) {
                toast.error('暂无可用支付方式');
                return;
            }
        }

        // CUSTOM/ST 模式：直接开始，不需要弹窗（IVG 走下方续玩/重开逻辑）
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

        if (normalizedGameMode === 'TXT') {
            launchTxtGalgame({ restart: true });
            return;
        }

        // 清运行时但保留 gameDetail，避免进 /galgame 再打 games/info+封面
        useGameStore.getState().clearPlayRuntime();

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

    const handleConfirmInteractiveVideoBuyout = async (option: IvgBuyoutPaymentOption) => {
        if (!fileId) {
            toast.error(t('gameDetail.gameIdInvalid'));
            return;
        }

        setIsInteractiveVideoBuyoutUnlocking(true);
        try {
            const response = await unlockInteractiveVideoContent(String(fileId), {
                purchaseType: 'buyout',
                currency: option.currency,
            });

            if (response.data?.success) {
                const nextAccess = response.data.data?.access;
                if (nextAccess) {
                    setInteractiveVideoAccessInfo((current) => current ? { ...current, access: nextAccess } : current);
                }
                await fetchInteractiveVideoAccessInfo();
                setIsInteractiveVideoBuyoutConfirmOpen(false);
                toast.success(response.data.data?.alreadyOwned ? '已购买，可直接游玩' : '解锁成功');
                await startInteractiveVideo(false);
                return;
            }

            toast.error(getInteractiveVideoUnlockErrorMessage(
                (response.data as { code?: string })?.code,
                response.data?.message,
            ));
        } catch (error) {
            const errorData = (error as { response?: { data?: { code?: string; message?: string } } }).response?.data;
            toast.error(getInteractiveVideoUnlockErrorMessage(errorData?.code, errorData?.message));
        } finally {
            setIsInteractiveVideoBuyoutUnlocking(false);
        }
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

    // 功能注释：hero 优先 display-cover；OSS 缺图时回退 cover_url，避免详情顶栏空白 + 控制台 404
    const [heroCoverAbs, setHeroCoverAbs] = useState('');
    useEffect(() => {
        const displayPath = resolveGameCoverUrl(game);
        if (!displayPath) {
            setHeroCoverAbs('');
            return;
        }
        const preferred = getImageUrl(displayPath);
        const originalPath = resolveOriginalCoverUrl(game);
        const fallbackPath = coverUrlAfterDisplayCoverError(displayPath, originalPath);
        const fallbackAbs = fallbackPath ? getImageUrl(fallbackPath) : '';
        let cancelled = false;
        setHeroCoverAbs(preferred);
        const probe = new Image();
        probe.onload = () => {
            if (!cancelled) setHeroCoverAbs(preferred);
        };
        probe.onerror = () => {
            if (cancelled) return;
            if (fallbackAbs && fallbackAbs !== preferred) {
                setHeroCoverAbs(fallbackAbs);
            } else {
                setHeroCoverAbs('');
            }
        };
        probe.src = preferred;
        return () => {
            cancelled = true;
        };
    }, [game]);

    const heroStyle = useMemo(() => {
        if (!heroCoverAbs) return {};
        return {
            backgroundImage: `url(${heroCoverAbs})`,
        };
    }, [heroCoverAbs]);

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

    const reportShareEvent = useCallback(async (shareChannel: 'copy_link' | 'native_share') => {
        if (!fileId) return;
        try {
            await trackingApi.reportGameShare({
                gameFileId: fileId,
                shareChannel,
                source: 'game_detail',
            });
        } catch (error) {
            console.error('[GameDetail] reportGameShare failed', error);
        }
    }, [fileId]);

    const handleShare = () => {
        setIsShareModalOpen(true);
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            await reportShareEvent('copy_link');
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
                await reportShareEvent('copy_link');
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

    const openDerivedNovelDrawer = useCallback(() => {
        setIsStartOptionsOpen(false);
        setIsDerivedNovelDrawerOpen(true);
    }, []);

    const closeDerivedNovelDrawer = useCallback(() => {
        setIsDerivedNovelDrawerOpen(false);
    }, []);

    useEffect(() => {
        if (!isDerivedNovelDrawerOpen) return;

        const previousOverflow = document.body.style.overflow;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeDerivedNovelDrawer();
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [closeDerivedNovelDrawer, isDerivedNovelDrawerOpen]);

    const handlePreviewSave = async (item: SaveSummaryItem) => {
        // 加载详情并展示在 TEXT 区域
        try {
            if (!fileId) return;
            const resp = await savesApi.getDetail(item.saveId, fileId);
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
            // 进入游戏前清理运行时（保留详情，便于分享/RouteReporter）
            useGameStore.getState().clearPlayRuntime();
            prefetchGalgameDocument(fileId);
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
            {/* 顶部：仅保留返回，无顶栏底与标题 */}
            <div className={styles.topBar}>
                <div className={styles.topBarContent}>
                    <button className={styles.backIconButton} onClick={handleBack} aria-label={t('gameDetail.back')}>
                        {/* 功能注释：与分类页同一描边 chevron，浅色封面更清晰 */}
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M15 6L9 12L15 18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* 英雄区：封面 + 标签 / 标题 / 评分 / 制作信息 */}
            <div className={styles.heroSection} style={heroStyle}>
                <div className={styles.heroContent}>
                    {heroTags.length > 0 ? (
                        <div className={styles.heroTags}>
                            {heroTags.map((tag) => (
                                <span key={tag} className={styles.heroTag}>{tag}</span>
                            ))}
                        </div>
                    ) : null}
                    <div className={styles.heroTitleRow}>
                        <h2 className={styles.heroGameTitle}>
                            {game.title || t('gameDetail.unnamedGame')}
                        </h2>
                        <span className={styles.ratingBadge}>
                            {game.rating_avg ?? DEFAULT_RATING}
                            <span className={styles.ratingBadgeUnit}>{t('gameDetail.ratingUnit')}</span>
                        </span>
                    </div>
                    {heroMetaLine ? (
                        <div className={styles.heroMetaRow}>
                            <img
                                className={styles.heroAuthorAvatar}
                                src={heroAuthorAvatarSrc}
                                alt=""
                                loading="lazy"
                                decoding="async"
                            />
                            <p className={styles.heroMeta}>{heroMetaLine}</p>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* 内容区域 */}
            <div className={styles.contentSection}>
                <div className={styles.contentWrapper}>
                    <div className={styles.statsBar} role="group" aria-label={t('gameDetail.stats')}>
                        <button type="button" className={styles.statsItem} onClick={handleShare} aria-label={t('gameDetail.share')}>
                            <span className={styles.statsIconWrap} aria-hidden="true">
                                <DetailShareIcon className={styles.statsIcon} />
                            </span>
                            <span className={styles.statsText}>
                                <span className={styles.statsValue}>{shareCountDisplay}</span>
                                <span className={styles.statsLabel}>{t('gameDetail.share')}</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statsItem} ${isLiked ? styles.statsItemActive : ''}`}
                            onClick={handleLike}
                            disabled={isLikeLoading}
                            aria-label={t('gameDetail.like')}
                            aria-pressed={isLiked}
                        >
                            <span className={styles.statsIconWrap} aria-hidden="true">
                                <DetailHeartIcon className={styles.statsIcon} />
                            </span>
                            <span className={styles.statsText}>
                                <span className={styles.statsValue}>{likeCountDisplay}</span>
                                <span className={styles.statsLabel}>{t('gameDetail.like')}</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statsItem} ${isFavorited ? styles.statsItemActive : ''}`}
                            onClick={handleFavorite}
                            disabled={isFavoriteLoading}
                            aria-label={t('gameDetail.favorite')}
                            aria-pressed={isFavorited}
                        >
                            <span className={styles.statsIconWrap} aria-hidden="true">
                                <DetailStarIcon className={styles.statsIcon} />
                            </span>
                            <span className={styles.statsText}>
                                <span className={styles.statsValue}>{favoriteCountDisplay}</span>
                                <span className={styles.statsLabel}>{t('gameDetail.favorite')}</span>
                            </span>
                        </button>
                    </div>

                    {activeSection === 'introduction' && (() => {
                        const raw = game.description || t('gameDetail.noDescription');
                        const isHtml = looksLikeHtml(raw);
                        const plain = normalizeNewlines(descriptionToPlainText(raw) || raw);
                        const needsExpand = !isHtml && descriptionNeedsExpand(plain);
                        const showCollapsed = needsExpand && !isDescriptionExpanded;
                        return (
                            <>
                                <div className={styles.synopsisHeader}>
                                    <h3 className={styles.synopsisTitle}>{t('gameDetail.plotSynopsis')}</h3>
                                    {canShowLoadSave ? (
                                        <button type="button" className={styles.loadSaveBadge} onClick={handleOpenLoadSave}>
                                            {t('gameDetail.loadSave')}
                                        </button>
                                    ) : null}
                                    <div className={styles.synopsisHeaderSpacer} />
                                    {user?.user.role === 'admin' && user?.user.userId === '96e89940badf1f67' ? (
                                        <button
                                            type="button"
                                            className={styles.reviewsTabLink}
                                            onClick={() => setActiveSection('reviews')}
                                        >
                                            {t('gameDetail.playerReviews')}
                                        </button>
                                    ) : null}
                                </div>
                                <div className={styles.descriptionSection}>
                                    {isHtml ? (
                                        <div
                                            className={styles.descriptionHtml}
                                            dangerouslySetInnerHTML={{
                                                __html: hydrateDescriptionHtmlForDisplay(raw, getImageUrl),
                                            }}
                                        />
                                    ) : (
                                        <p className={showCollapsed ? styles.descriptionCollapsed : undefined}>{plain}</p>
                                    )}
                                </div>
                                {needsExpand ? (
                                    <button
                                        type="button"
                                        className={styles.readMoreButton}
                                        onClick={() => setIsDescriptionExpanded((v) => !v)}
                                    >
                                        {isDescriptionExpanded ? t('gameDetail.readLess') : t('gameDetail.readMore')}
                                    </button>
                                ) : null}

                                {isNovel && sourceFileId && sourceAuthorName ? (
                                    <button
                                        type="button"
                                        className={styles.sourceAuthorLink}
                                        onClick={() => navigate(buildSourceGameDetailPath(sourceFileId))}
                                    >
                                        {t('gameDetail.originalAuthor')}: {sourceAuthorName}
                                    </button>
                                ) : null}
                                {game.groupNo ? (
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
                                ) : null}

                                {game.version_notes?.trim() ? (
                                    <>
                                        <h3 className={styles.detailSectionTitle}>{t('gameDetail.versionNotes')}</h3>
                                        <div className={styles.descriptionSection}>
                                            <p>{normalizeNewlines(game.version_notes)}</p>
                                        </div>
                                    </>
                                ) : null}
                            </>
                        );
                    })()}

                    {activeSection === 'reviews' && fileId && (
                        <>
                            <div className={styles.synopsisHeader}>
                                <h3 className={styles.synopsisTitle}>{t('gameDetail.playerReviews')}</h3>
                                <div className={styles.synopsisHeaderSpacer} />
                                <button
                                    type="button"
                                    className={`${styles.reviewsTabLink} ${styles.reviewsTabLinkActive}`}
                                    onClick={() => setActiveSection('introduction')}
                                >
                                    {t('gameDetail.plotSynopsis')}
                                </button>
                            </div>
                            <GameRating fileId={fileId} onRatingChange={() => {}} />
                        </>
                    )}

                </div>
            </div>

            {/* 底部悬浮：开始体验 + 视觉小说 */}
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
                                <>
                                    <img src={ICON_GAMEPAD} alt="" className={styles.startButtonIcon} />
                                    <span>{startButtonText}</span>
                                </>
                            )}
                        </button>
                        {canShowStoryReplay ? (
                            <button
                                type="button"
                                className={styles.replayButton}
                                onClick={openDerivedNovelDrawer}
                            >
                                <img src={ICON_FILMSTRIP} alt="" className={styles.replayButtonIcon} />
                                <span>{t('gameDetail.storyReplay')}</span>
                            </button>
                        ) : null}
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
            {isInteractiveVideoBuyoutConfirmOpen && (
                <div
                    className={styles.startOptionsOverlay}
                    onClick={() => {
                        if (!isInteractiveVideoBuyoutUnlocking) {
                            setIsInteractiveVideoBuyoutConfirmOpen(false);
                        }
                    }}
                >
                    <div
                        className={styles.startOptionsModal}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="确认买断游玩"
                    >
                        <div className={styles.startOptionsHeader}>
                            <div className={styles.startOptionsHeaderMain}>
                                <h2 className={styles.startOptionsTitle}>确认买断游玩</h2>
                            </div>
                            <button
                                type="button"
                                className={styles.startOptionsClose}
                                onClick={() => setIsInteractiveVideoBuyoutConfirmOpen(false)}
                                disabled={isInteractiveVideoBuyoutUnlocking}
                                aria-label={t('common.close')}
                            >
                                <img src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`} alt={t('common.close')} />
                            </button>
                        </div>
                        <p className={styles.interactiveVideoBuyoutMessage}>
                            解锁后将永久绑定当前账号，请确认支付后进入游戏。
                        </p>
                        <div className={styles.startOptionsButtons}>
                            {interactiveVideoBuyoutPaymentOptions.length > 0 ? (
                                interactiveVideoBuyoutPaymentOptions.map((option) => (
                                    <button
                                        key={option.currency}
                                        type="button"
                                        className={styles.startOptionsPrimary}
                                        disabled={isInteractiveVideoBuyoutUnlocking}
                                        onClick={() => handleConfirmInteractiveVideoBuyout(option)}
                                    >
                                        {isInteractiveVideoBuyoutUnlocking ? '处理中...' : `确认支付${option.label}`}
                                    </button>
                                ))
                            ) : (
                                <p className={styles.interactiveVideoBuyoutMessage}>暂无可用支付方式</p>
                            )}
                            <button
                                type="button"
                                className={styles.startOptionsGhost}
                                disabled={isInteractiveVideoBuyoutUnlocking}
                                onClick={() => setIsInteractiveVideoBuyoutConfirmOpen(false)}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
            {isDerivedNovelDrawerOpen && (
                <div className={`${styles.startOptionsOverlay} ${styles.replayDrawerOverlay}`} onClick={closeDerivedNovelDrawer}>
                    <aside
                        className={styles.replayDrawer}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('gameDetail.visualNovels')}
                    >
                        <div className={styles.startOptionsHeader}>
                            <div className={styles.startOptionsHeaderMain}>
                                <h2 className={styles.startOptionsTitle}>{t('gameDetail.visualNovels')}</h2>
                            </div>
                            <button
                                className={`${styles.startOptionsClose} ${styles.replayDrawerClose}`}
                                onClick={closeDerivedNovelDrawer}
                                aria-label={t('gameDetail.closeVisualNovels')}
                            >
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div className={styles.replayDrawerBody}>
                            {derivedNovelsLoading ? (
                                <div className={styles.derivedNovelsLoading}>{t('common.loading')}</div>
                            ) : derivedNovels.length === 0 ? (
                                <div className={styles.derivedNovelsEmpty}>{t('gameDetail.derivedNovelsEmpty')}</div>
                            ) : (
                                <ul className={styles.derivedNovelsList}>
                                    {derivedNovels.map((item) => (
                                        <li key={item.fileId}>
                                            <button
                                                type="button"
                                                className={styles.derivedNovelCard}
                                                onClick={() => {
                                                    closeDerivedNovelDrawer();
                                                    navigate(`/game/${encodeURIComponent(item.fileId)}`);
                                                }}
                                            >
                                                <img
                                                    className={styles.derivedNovelCover}
                                                    src={getImageUrl(item.coverUrl) || `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`}
                                                    alt=""
                                                />
                                                <div className={styles.derivedNovelMeta}>
                                                    <div className={styles.derivedNovelName}>{item.title}</div>
                                                    <div className={styles.derivedNovelAuthor}>
                                                        {item.authorName || t('gameDetail.unknownAuthor')}
                                                    </div>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
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
                                {isInteractiveVideo || isNovel ? null : isGalgame && (
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameDetail;
