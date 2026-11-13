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
import { consumeShelfResumeOnce, readGameDetailPreview, readShelfResume } from '../utils/gameDetailNavigation';
import { recordBrowsingHistory } from '../utils/browsingHistory';
import { MdContentCopy, MdOutlineHistory } from 'react-icons/md';
import AuthModal from '../components/AuthModal';
import LoadSaveListModal from '../components/CreateGame/LoadSaveListModal';
import SavePreviewModal from '../components/CreateGame/SavePreviewModal';
import ShareModal from '../components/CommonModal/ShareModal';
import ReportSheet from '../components/Report/ReportSheet';
import QRCodeModal from '../components/CommonModal/QRCodeModal';
import { savesApi, type SaveSummaryItem } from '../api/galgame/saves';
import novelApi, { type DerivedNovelSummary } from '../api/galgame/novel';
import { useTrackingStore } from '../store/trackingStore';
import { trackingApi } from '../api/statistics/trackingApi';
import gamePromotionApi from '../api/promotion/gamePromotionApi';
import { getOrCreatePromoAnonId } from '../utils/promoAnonId';
import { copyTextToClipboard } from '../utils/clipboard';
import GameRating from '../components/GameRating/GameRating';
import { resolveRatingDisplay } from '../utils/ratingDisplay';
import {
    GameIssueFeedbackModal,
    GameRatingModal,
    GameUpdateLogModal,
} from '../components/GameDetail/GameDetailExtraModals';
import gameDetailExtrasApi, { type GameUpdateLogItem } from '../api/gameDetailExtrasApi';
import { useDailyTaskStore } from '../store/dailyTaskStore';
import { useTranslation } from 'react-i18next';
import { getGameTypeLabelFromMeta } from '../utils/gameTypeLabel';
import { buildNovelReadPath, buildSourceGameDetailPath } from '../utils/novelGame';
import { prefetchGalgameDocument } from '../lib/galgame/galgameDocumentCache';

import {
    DetailHeartIcon,
    DetailRateIcon,
    DetailShareIcon,
    DetailStarIcon,
} from '../components/GameDetailStatIcons';
import accountSocialApi from '../api/account/accountSocialApi';
import { getApiErrorMessage } from '../utils/error';
import { resolvePublicListingState } from '../utils/gameListingAccess';


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
    descriptionNeedsExpand,
    formatDetailStatCount,
    resolveGameDetailTags,
} from '../lib/gameDetailView';
import { resolveCreatorUserCode, resolveGameCardAuthor } from '../lib/gameCardAuthor';
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
const DEFAULT_AVATAR_PATH = 'data/assets/defaultAvatar.png';
const DEFAULT_PLAY_STATUS = {
    hasContinueState: true,
    hasSave: true,
};

/** sessionStorage：未登录用户从 ?promo= 进详情页时暂存 code，登录后 consumePending 提交 */
const PENDING_PROMO_STORAGE_KEY = 'pending_game_promotion_code';
/** sessionStorage：未登录点赞/收藏/评分意图，登录后回页续跑 */
const PENDING_DETAIL_INTENT_KEY = 'pending_game_detail_intent';

type PendingDetailIntent = 'like' | 'favorite' | 'rate';

const rememberPendingDetailIntent = (fileId: string, intent: PendingDetailIntent) => {
    try {
        sessionStorage.setItem(PENDING_DETAIL_INTENT_KEY, JSON.stringify({ fileId, intent }));
    } catch {
        // ignore
    }
};

const consumePendingDetailIntent = (fileId: string): PendingDetailIntent | null => {
    try {
        const raw = sessionStorage.getItem(PENDING_DETAIL_INTENT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { fileId?: string; intent?: PendingDetailIntent };
        if (String(parsed.fileId || '') !== String(fileId)) return null;
        sessionStorage.removeItem(PENDING_DETAIL_INTENT_KEY);
        if (parsed.intent === 'like' || parsed.intent === 'favorite' || parsed.intent === 'rate') {
            return parsed.intent;
        }
        return null;
    } catch {
        return null;
    }
};

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
const checkIsLiked = (reaction: string | number | boolean | null | undefined): boolean => {
    if (reaction === null || reaction === undefined) return false;
    if (typeof reaction === 'boolean') return reaction;
    if (typeof reaction === 'string') {
        const normalized = reaction.trim().toLowerCase();
        return normalized === 'like' || normalized === 'liked' || normalized === '1' || normalized === 'true';
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
    if (normalizedEngine === 'ROMANCE') return 'ROMANCE' as const;
    if (normalizedEngine === 'TXT' || normalizedEngine === 'AVG' || normalizedEngine === 'RPG') return normalizedEngine;

    const normalizedTags = normalizeRaw(gameTags);
    if (normalizedTags === 'CUSTOM') return 'customif' as const;
    if (normalizedTags === 'IVG') return 'interactive-video' as const;
    if (normalizedTags === 'NOVEL') return 'NOVEL' as const;
    if (normalizedTags === 'ROMANCE') return 'ROMANCE' as const;
    if (normalizedTags === 'TXT' || normalizedTags === 'AVG' || normalizedTags === 'RPG') return normalizedTags;

    return '';
};

const normalizePlaybackOrientation = (value?: string | null) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'landscape' || normalized === 'portrait' ? normalized : null;
};

/** 功能注释：后端错误 code / 英文 message → i18n key（gameDetail.ivgErrors.*），文案见 locales */
const INTERACTIVE_VIDEO_UNLOCK_ERROR_KEYS: Record<string, string> = {
    INSUFFICIENT_POINTS: 'insufficientPoints',
    'Insufficient points': 'insufficientPoints',
    INSUFFICIENT_DIAMONDS: 'insufficientDiamonds',
    'Insufficient diamonds': 'insufficientDiamonds',
    PAYMENT_METHOD_UNAVAILABLE: 'paymentUnavailable',
    'Payment method is unavailable': 'paymentUnavailable',
    BUYOUT_NOT_FOR_SALE: 'buyoutNotForSale',
    'Buyout is not for sale': 'buyoutNotForSale',
    DIRECTORY_NOT_FOR_SALE: 'directoryNotForSale',
    'Directory is not for sale': 'directoryNotForSale',
    FREE_UNLOCK_UNAVAILABLE: 'freeUnlockUnavailable',
    'Free unlock is unavailable': 'freeUnlockUnavailable',
    INVALID_CURRENCY: 'invalidCurrency',
    'Invalid currency': 'invalidCurrency',
    INVALID_PURCHASE_TYPE: 'invalidPurchaseType',
    'Invalid purchase type': 'invalidPurchaseType',
    INVALID_PARAM: 'invalidParam',
    INVALID_PURCHASE_PARAM: 'invalidParam',
    'Invalid purchase parameter': 'invalidParam',
    AUTH_REQUIRED: 'authRequired',
    'Authentication token required': 'authRequired',
    NOT_FOUND: 'notFound',
    'Game not found': 'notFound',
    FORBIDDEN: 'forbidden',
    Forbidden: 'forbidden',
    MONETIZATION_ERROR: 'unlockFailed',
    'Interactive video monetization error': 'unlockFailed',
};

const getInteractiveVideoUnlockErrorMessage = (
    t: (key: string) => string,
    code?: string | null,
    message?: string | null,
) => {
    const normalizedCode = String(code || '').trim();
    const normalizedMessage = String(message || '').trim();
    const key = INTERACTIVE_VIDEO_UNLOCK_ERROR_KEYS[normalizedCode]
        || INTERACTIVE_VIDEO_UNLOCK_ERROR_KEYS[normalizedMessage];
    if (key) return t(`gameDetail.ivgErrors.${key}`);
    // 功能注释：后端已给出本地化（非英文）文案时直接展示
    if (normalizedMessage && !/[A-Za-z]/.test(normalizedMessage)) return normalizedMessage;
    return t('gameDetail.ivgErrors.unlockFailed');
};

const GameDetail: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { fileId: fileIdParam } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // Hooks
    const { user, isAuthenticated } = useAuthStore();
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
    /** 功能注释：每次点亮点赞自增，用作 key 重播心形弹跳动画 */
    const [likePopKey, setLikePopKey] = useState(0);
    const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
    const [isUpdateWarningModalOpen, setIsUpdateWarningModalOpen] = useState(false);
    const [isLoadSaveOpen, setIsLoadSaveOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<SaveSummaryItem | null>(null);
    const [isStartOptionsOpen, setIsStartOptionsOpen] = useState(false);
    const [isDerivedNovelDrawerOpen, setIsDerivedNovelDrawerOpen] = useState(false);
    const [isInteractiveVideoRestartConfirmOpen, setIsInteractiveVideoRestartConfirmOpen] = useState(false);
    const [isPlayStatusLoading, setIsPlayStatusLoading] = useState(false);
    /** 功能注释：读档进行中；只做轻提示 + 防重复，不再用 isLoading 把整页换成转圈 */
    const [isSaveLoading, setIsSaveLoading] = useState(false);
    const [playStatus, setPlayStatus] = useState(DEFAULT_PLAY_STATUS);
    // 功能注释：已有云端进度时，「开始游戏」先确认会覆盖自动存档
    const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
    const [derivedNovels, setDerivedNovels] = useState<DerivedNovelSummary[]>([]);
    const [derivedNovelsLoading, setDerivedNovelsLoading] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
    const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
    /** 功能注释：剧情简介折叠，默认约 4 行可展开 */
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [isUpdateLogModalOpen, setIsUpdateLogModalOpen] = useState(false);
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
    const [updateLogs, setUpdateLogs] = useState<GameUpdateLogItem[]>([]);
    const [latestUpdateLog, setLatestUpdateLog] = useState<GameUpdateLogItem | null>(null);
    const [myRatingValue, setMyRatingValue] = useState<number | null>(null);
    const [myRatingComment, setMyRatingComment] = useState('');
    const [myRatingEditCount, setMyRatingEditCount] = useState(0);
    /** 功能注释：五星制平均分 + 评分人数；展示时由 resolveRatingDisplay 换算十分制 */
    const [ratingStats, setRatingStats] = useState<{ average: number | null; count: number } | null>(null);
    /** 功能注释：评分弹窗提交后刷新评论区列表（复用同一数据源） */
    const [commentsRefreshKey, setCommentsRefreshKey] = useState(0);
    const [isInteractiveVideoAccessLoading, setIsInteractiveVideoAccessLoading] = useState(false);
    const [isInteractiveVideoBuyoutConfirmOpen, setIsInteractiveVideoBuyoutConfirmOpen] = useState(false);
    const [isInteractiveVideoBuyoutUnlocking, setIsInteractiveVideoBuyoutUnlocking] = useState(false);
    const [interactiveVideoAccessInfo, setInteractiveVideoAccessInfo] = useState<{
        config: InteractiveVideoPricingConfig;
        access: InteractiveVideoAccess;
    } | null>(null);
    /** 功能注释：关注写操作忙碌态；关系态来自详情 info 字段 */
    const [followBusy, setFollowBusy] = useState(false);
    /** 功能注释：列表预览无关注态，等详情接口落地后再展示按钮，避免先闪「关注」 */
    const [creatorRelationReady, setCreatorRelationReady] = useState(false);
    /** 功能注释：已按哪个登录用户拿到点赞/收藏态；登录后续跑意图须等它就绪，否则会按游客态把状态切反 */
    const [interactionStateUserId, setInteractionStateUserId] = useState<string | number | null>(null);

    // Refs
    const likeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const likeBaselineRef = useRef<{ liked: boolean; count: number } | null>(null);
    const favoriteDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const favoriteBaselineRef = useRef<{ favorited: boolean; count: number } | null>(null);
    const hasRecordedViewRef = useRef(false);
    
    const lastTrackedLocationKeyRef = useRef<string | null>(null);
    const relationSyncSeqRef = useRef(0);

    // 计算值
    const userId = useMemo(() => user?.user?.id, [user?.user?.id]);
    /** 与首次渲染的 userId 对齐，避免已登录冷启动再补拉一次 */
    const prevDetailUserIdRef = useRef(userId);
    const fileId = useMemo(() => fileIdParam || game?.file_id || game?.id, [fileIdParam, game]);
    const isStartButtonLoading = isLoading || isPlayStatusLoading || isInteractiveVideoAccessLoading || isInteractiveVideoBuyoutUnlocking;
    const normalizedGameMode = useMemo(
        () => normalizeGameMode(game?.engine, game?.game_tags),
        [game?.engine, game?.game_tags],
    );
    const listingState = useMemo(() => resolvePublicListingState(game), [game]);
    /** 功能注释：门禁文案按 code 走 i18n，util 的中文 message 仅作兜底 */
    const listingMessage = listingState.canEnter
        ? ''
        : t(`gameDetail.listing.${listingState.code}`, { defaultValue: listingState.message || t('gameDetail.notListed') });
    const isGalgame = normalizedGameMode === 'TXT';
    const isNovel = normalizedGameMode === 'NOVEL';
    const isInteractiveVideo = normalizedGameMode === 'interactive-video';
    /** 功能注释：支持存档的作品拆成「开始游戏 / 读取存档」两个入口，自动存档放进存档列表 */
    const useSaveSplitActions = isGalgame && !isNovel && !isInteractiveVideo;
    const isInteractiveVideoOwner = useMemo(
        () => isInteractiveVideoOwnerUser(game?.creator_user_id, user?.user),
        [game?.creator_user_id, user?.user],
    );
    const startButtonText = useMemo(() => {
        if (isNovel) return t('gameDetail.startReading');
        const fallbackLabel = playStatus.hasContinueState
            ? t('gameDetail.continueExperience')
            : t('gameDetail.startExperience');
        if (!isInteractiveVideo) return fallbackLabel;
        return getInteractiveVideoStartButtonLabel({
            config: interactiveVideoAccessInfo?.config,
            access: interactiveVideoAccessInfo?.access,
            isOwner: isInteractiveVideoOwner,
            fallbackLabel,
        });
    }, [
        interactiveVideoAccessInfo,
        isInteractiveVideo,
        isInteractiveVideoOwner,
        isNovel,
        playStatus.hasContinueState,
        t,
    ]);
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
    /** 功能注释：效果图作者行只显示昵称；头像与列表卡片同源 */
    const heroAuthor = useMemo(() => {
        if (!game) {
            return {
                name: t('gameDetail.unknownAuthor'),
                avatarUrl: `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`,
                userCode: '',
                hasNamedAuthor: false,
            };
        }
        const author = resolveGameCardAuthor(game, {
            unknownAuthor: t('gameDetail.unknownAuthor'),
        });
        return {
            ...author,
            avatarUrl:
                getImageUrl(author.avatarUrl)
                || `${import.meta.env.BASE_URL}${DEFAULT_AVATAR_PATH}`,
        };
    }, [game, t]);
    const heroAuthorAvatarSrc = heroAuthor.avatarUrl;
    const heroAuthorName = heroAuthor.name;
    /** 功能注释：题材标签；封面角标单独用 gameTypeLabel（如 AI文游），避免与下方题材重复 */
    const themeTags = useMemo(
        () => heroTags.filter((tag) => tag && tag !== gameTypeLabel),
        [heroTags, gameTypeLabel],
    );
    const creatorUserCode = useMemo(() => resolveCreatorUserCode(game), [game]);
    /** 功能注释：创作者关系态优先用详情 info；列表预览缺字段时本地兜底本人判断 */
    const isCreatorSelf = Boolean(
        game?.isCreatorSelf
        || (user?.user?.userCode && creatorUserCode && user.user.userCode === creatorUserCode)
        || (userId != null && game?.creator_user_id != null && String(userId) === String(game.creator_user_id)),
    );
    const isFollowingCreator = Boolean(game?.isFollowingCreator);
    const isCreatorBlocked = Boolean(game?.isCreatorBlocked);
    const isCreatorBlockedBy = Boolean(game?.isCreatorBlockedBy);
    const canShowCreatorFollowSlot = Boolean(heroAuthorName && creatorUserCode && !isCreatorSelf);
    const showCreatorFollowBtn = canShowCreatorFollowSlot && creatorRelationReady;
    const creatorFollowActionable = showCreatorFollowBtn && !isCreatorBlocked && !isCreatorBlockedBy;

    const handleOpenCreatorHomepage = () => {
        // 功能注释：未登录先弹登录
        if (!checkAuth()) return;
        if (!creatorUserCode) {
            toast.error(t('create.previewHomepageNoCode'));
            return;
        }
        navigate(`/account/${encodeURIComponent(creatorUserCode)}`);
    };

    const favoriteCountDisplay = useMemo(
        () => formatDetailStatCount(game?.favorite_count),
        [game?.favorite_count],
    );
    const likeCountDisplay = useMemo(() => formatDetailStatCount(likeCount), [likeCount]);
    const sourceAuthorName = game?.source_author_name || '';
    const sourceFileId = game?.source_file_id || '';
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
            } else {
                // 功能注释：小程序内不弹登录框，至少提示一下，避免点击毫无反应
                toast(t('report.loginRequired'));
            }
            return false;
        }
        return true;
    };

    const handleToggleCreatorFollow = async () => {
        if (!checkAuth() || !creatorUserCode || followBusy || !creatorFollowActionable) return;

        const wasFollowing = isFollowingCreator;
        setFollowBusy(true);
        try {
            const response = wasFollowing
                ? await accountSocialApi.unfollowOrRemove(creatorUserCode, 'unfollow')
                : await accountSocialApi.follow(creatorUserCode);
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            const { isFollowing } = response.data.data;
            setGame((prev) => (
                prev
                    ? { ...prev, isFollowingCreator: isFollowing }
                    : prev
            ));
            toast.success(
                isFollowing
                    ? t('create.socialFollowSuccess')
                    : t('create.socialUnfollowSuccess'),
            );
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setFollowBusy(false);
        }
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
            if (gameData.rating_avg != null && String(gameData.rating_avg).trim()) {
                setRatingStats({ average: Number(gameData.rating_avg), count: Number(gameData.rating_count) || 0 });
            }
            setGameDetailToStore(gameData);
        };

        setCreatorRelationReady(false);

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
                    setCreatorRelationReady(true);
                    setInteractionStateUserId(prevDetailUserIdRef.current ?? null);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [fileIdParam, location.key, location.state, navigate, setGameDetailToStore, t]);

    // 仅「本页从游客变为登录 / 切换账号」时补拉关系态；冷启动已登录只靠主加载一次
    useEffect(() => {
        const prevUserId = prevDetailUserIdRef.current;
        prevDetailUserIdRef.current = userId;

        if (!fileIdParam || !userId) return;
        if (prevUserId === userId) return;

        const seq = ++relationSyncSeqRef.current;
        let cancelled = false;
        const syncCreatorRelation = async () => {
            try {
                const response = await getGameDataApi.getGameDetail({ fileId: fileIdParam });
                if (cancelled || seq !== relationSyncSeqRef.current || !response.data?.data) return;
                const data = response.data.data;
                setGame((prev) => (
                    prev
                        ? {
                            ...prev,
                            isCreatorSelf: data.isCreatorSelf,
                            isFollowingCreator: data.isFollowingCreator,
                            isCreatorBlocked: data.isCreatorBlocked,
                            isCreatorBlockedBy: data.isCreatorBlockedBy,
                            isFavorited: data.isFavorited,
                            reaction: data.reaction,
                            like_count: data.like_count,
                            favorite_count: data.favorite_count,
                        }
                        : data
                ));
                setIsLiked(checkIsLiked(data.reaction));
                setIsFavorited(Boolean(data.isFavorited));
                setLikeCount(data.like_count || 0);
                setInteractionStateUserId(userId);
            } catch (error) {
                console.warn('[GameDetail] sync creator relation failed:', error);
            }
        };
        void syncCreatorRelation();
        return () => {
            cancelled = true;
        };
    }, [fileIdParam, userId]);

    // 浏览统计：详情加载完成且已登录后只记一次
    useEffect(() => {
        if (!userId || !fileId || !game) return;
        if (String(game.file_id || game.id) !== String(fileId)) return;
        recordBrowsingHistory(userId, game);
    }, [fileId, userId, game]);

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

        // 功能注释：Romance 进局读已发布包；参数约定 play=1&fileId
        if (normalized === 'ROMANCE') {
            useGameStore.getState().clearAll();
            navigate(`/romance/?play=1&fileId=${encodeURIComponent(fileId)}`);
            return;
        }

        toast.error(t('gameDetail.unknownGameType'));
    };

    // 处理开始游戏（检查是否需要显示更新提示）
    const handleStartGame = async () => {
        if (!listingState.canEnter) {
            toast.error(listingMessage);
            return;
        }
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
                toast.error(t('gameDetail.ivgAccessFailed'));
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
                toast.error(t('gameDetail.ivgNoPaymentMethod'));
                return;
            }
        }

        // CUSTOM/ST/ROMANCE：直接开始（Romance 本地/发布包进局，不走 TXT 云存档弹窗）
        if (
            normalizedGameMode === 'customif' ||
            normalizedGameMode === 'st' ||
            normalizedGameMode === 'ROMANCE'
        ) {
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
                toast.success(response.data.data?.alreadyOwned ? t('gameDetail.ivgAlreadyOwned') : t('gameDetail.ivgUnlockSuccess'));
                await startInteractiveVideo(false);
                return;
            }

            toast.error(getInteractiveVideoUnlockErrorMessage(
                t,
                (response.data as { code?: string })?.code,
                response.data?.message,
            ));
        } catch (error) {
            const errorData = (error as { response?: { data?: { code?: string; message?: string } } }).response?.data;
            toast.error(getInteractiveVideoUnlockErrorMessage(t, errorData?.code, errorData?.message));
        } finally {
            setIsInteractiveVideoBuyoutUnlocking(false);
        }
    };

    const handleLike = () => {
        if (!fileId) return;
        if (!checkAuth()) {
            rememberPendingDetailIntent(String(fileId), 'like');
            return;
        }
        if (isLikeLoading) return;

        // 功能注释：点赞接口是切换式；防抖窗口内记下点击前的服务端状态，连点回到原状态则取消请求
        if (likeDebounceTimerRef.current) {
            clearTimeout(likeDebounceTimerRef.current);
            likeDebounceTimerRef.current = null;
        } else {
            likeBaselineRef.current = { liked: isLiked, count: likeCount };
        }

        // 功能注释：乐观更新——点击即变色、数字±1；防抖后以服务端结果为准，失败回滚并提示，禁止静默无反应
        const baseline = likeBaselineRef.current ?? { liked: isLiked, count: likeCount };
        const prevLiked = baseline.liked;
        const prevCount = baseline.count;
        const optimisticLiked = !isLiked;
        setIsLiked(optimisticLiked);
        if (optimisticLiked) setLikePopKey((key) => key + 1);
        setLikeCount(Math.max(0, prevCount + (optimisticLiked === prevLiked ? 0 : optimisticLiked ? 1 : -1)));
        if (optimisticLiked === prevLiked) {
            likeBaselineRef.current = null;
            return;
        }

        likeDebounceTimerRef.current = setTimeout(async () => {
            if (!fileId) return;

            setIsLikeLoading(true);
            try {
                const response = await GameAction.gameLike({
                    fileId,
                });
                const data = response.data?.data;
                if (!response.data?.success || !data) {
                    throw new Error(response.data?.message || 'like failed');
                }
                const nextLiked = typeof data.isLiked === 'boolean' ? data.isLiked : optimisticLiked;
                const nextCount = typeof data.likeCount === 'number'
                    ? data.likeCount
                    : Math.max(0, prevCount + (nextLiked ? 1 : -1));
                setIsLiked(nextLiked);
                setLikeCount(nextCount);
                setGame((current) => (current
                    ? { ...current, reaction: nextLiked ? 'like' : '0', like_count: nextCount }
                    : current));
                toast.success(nextLiked ? t('gameDetail.likeAdded') : t('gameDetail.likeRemoved'));
            } catch (error) {
                console.error('点赞失败:', error);
                setIsLiked(prevLiked);
                setLikeCount(prevCount);
                toast.error(t('gameDetail.likeFailed'));
            } finally {
                setIsLikeLoading(false);
                likeDebounceTimerRef.current = null;
                likeBaselineRef.current = null;
            }
        }, LIKE_DEBOUNCE_DELAY);
    };

    const handleFavorite = () => {
        if (!fileId) return;
        if (!checkAuth()) {
            rememberPendingDetailIntent(String(fileId), 'favorite');
            return;
        }
        if (isFavoriteLoading) return;

        // 功能注释：与点赞一致——乐观切换+计数，防抖内连点回到原状态则不发请求；失败回滚
        if (favoriteDebounceTimerRef.current) {
            clearTimeout(favoriteDebounceTimerRef.current);
            favoriteDebounceTimerRef.current = null;
        } else {
            favoriteBaselineRef.current = { favorited: isFavorited, count: Number(game?.favorite_count) || 0 };
        }
        const baseline = favoriteBaselineRef.current ?? { favorited: isFavorited, count: Number(game?.favorite_count) || 0 };
        const optimisticFavorited = !isFavorited;
        const optimisticCount = Math.max(0, baseline.count + (optimisticFavorited === baseline.favorited ? 0 : optimisticFavorited ? 1 : -1));
        setIsFavorited(optimisticFavorited);
        setGame((current) => (current ? { ...current, isFavorited: optimisticFavorited, favorite_count: optimisticCount } : current));
        if (optimisticFavorited === baseline.favorited) {
            favoriteBaselineRef.current = null;
            return;
        }

        favoriteDebounceTimerRef.current = setTimeout(async () => {
            if (!fileId) return;

            setIsFavoriteLoading(true);
            try {
                const response = await favoriteApi.toggle({ fileId });
                const data = response.data?.data;
                if (!response.data?.success || !data) {
                    throw new Error(response.data?.message || 'favorite failed');
                }
                const nextFavorited = typeof data.isFavorited === 'boolean' ? data.isFavorited : optimisticFavorited;
                const nextCount = typeof data.favoriteCount === 'number' ? data.favoriteCount : optimisticCount;
                setIsFavorited(nextFavorited);
                setGame((current) => (current ? { ...current, isFavorited: nextFavorited, favorite_count: nextCount } : current));
                toast.success(nextFavorited ? t('gameDetail.favoriteAdded') : t('gameDetail.favoriteRemoved'));
            } catch (error) {
                console.error('收藏操作失败:', error);
                setIsFavorited(baseline.favorited);
                setGame((current) => (current ? { ...current, isFavorited: baseline.favorited, favorite_count: baseline.count } : current));
                toast.error(t('gameDetail.favoriteFailed'));
            } finally {
                setIsFavoriteLoading(false);
                favoriteDebounceTimerRef.current = null;
                favoriteBaselineRef.current = null;
            }
        }, FAVORITE_DEBOUNCE_DELAY);
    };

    /** 功能注释：打开评分弹窗；未登录先登录并保留意图 */
    const handleOpenRating = () => {
        if (!fileId) return;
        if (!checkAuth()) {
            rememberPendingDetailIntent(String(fileId), 'rate');
            return;
        }
        setIsRatingModalOpen(true);
    };

    const canEditMyRating = myRatingValue == null || myRatingEditCount < 1;

    const applyUserRatingFromComments = useCallback((ur: {
        rating_value?: number;
        comment_content?: string;
        edit_count?: number;
    } | null) => {
        if (ur && ur.rating_value != null) {
            setMyRatingValue(Number(ur.rating_value) || null);
            setMyRatingComment(ur.comment_content || '');
            setMyRatingEditCount(Number(ur.edit_count || 0));
            return;
        }
        setMyRatingValue(null);
        setMyRatingComment('');
        setMyRatingEditCount(0);
    }, []);

    const loadUpdateLogs = useCallback(async (targetFileId: string) => {
        try {
            const res = await gameDetailExtrasApi.listUpdateLogs(targetFileId);
            if (!res.data.success || !res.data.data) return;
            setUpdateLogs(res.data.data.list || []);
            setLatestUpdateLog(res.data.data.latest || null);
        } catch (error) {
            console.warn('[GameDetail] loadUpdateLogs failed', error);
            // 功能注释：接口失败时回落作品 version_notes，避免空白
            setUpdateLogs([]);
            setLatestUpdateLog(null);
        }
    }, []);

    // 功能注释：更新日志独立接口；我的评分复用评论区 getRatings，禁止再打一遍
    useEffect(() => {
        if (!fileIdParam || !game) return;
        void loadUpdateLogs(String(fileIdParam));
    }, [fileIdParam, game?.file_id, loadUpdateLogs]);

    // 功能注释：登录后回页续跑点赞/收藏/评分意图
    useEffect(() => {
        if (!userId || !fileIdParam || !game) return;
        if (interactionStateUserId !== userId) return;
        const intent = consumePendingDetailIntent(String(fileIdParam));
        if (!intent) return;
        if (intent === 'like') handleLike();
        else if (intent === 'favorite') handleFavorite();
        else if (intent === 'rate') setIsRatingModalOpen(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, fileIdParam, game?.file_id, interactionStateUserId]);

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
            await copyTextToClipboard(window.location.href);
            await reportShareEvent('copy_link');
            toast.success(t('gameDetail.linkCopied'));
        } catch {
            toast.error(t('copyFailed'));
        }
    };

    const handleShowQRCode = () => {
        setIsShareModalOpen(false);
        setIsQRCodeModalOpen(true);
    };

    // ===== 存档读取（列表 → 预览 → 加载） =====
    const handleOpenLoadSave = async () => {
        if (!checkAuth()) return;
        // 先拉游玩状态，决定是否置顶云端自动存档位
        const status = await fetchPlayStatus();
        setPlayStatus(status);
        setIsLoadSaveOpen(true);
    };

    /** 开始游戏：直接新开一局，不再弹「新的开始/继续/读档」三选一 */
    const handleStartFreshGame = async () => {
        if (!listingState.canEnter) {
            toast.error(listingMessage);
            return;
        }
        if (!checkAuth()) return;
        const status = await fetchPlayStatus();
        setPlayStatus(status);
        if (status.hasContinueState) {
            setIsRestartConfirmOpen(true);
            return;
        }
        await handleStartNewGame();
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

    /** 读档进入游戏；返回是否成功。silent 时失败不弹通用 toast，由调用方给出具体原因（书架续玩） */
    const handleLoadSave = async (saveId: string, opts: { silent?: boolean } = {}): Promise<boolean> => {
        if (!fileId || isSaveLoading) return false;
        const toastId = toast.loading(t('common.loading'));
        try {
            setIsSaveLoading(true);
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
                return true;
            }
            if (!opts.silent) toast.error(resp.data.message || t('galgame.requestError'));
        } catch (e) {
            console.error('加载存档失败:', e);
            if (!opts.silent) toast.error(t('galgame.requestError'));
        } finally {
            toast.dismiss(toastId);
            setIsSaveLoading(false);
            setIsLoadSaveOpen(false);
            setPreviewItem(null);
        }
        return false;
    };

    // 书架「继续游玩」：详情加载完成后自动续玩 / 读档一次（走详情页同一套登录、更新提示、付费校验）；
    // 读档失败时打开存档列表让玩家改选，不自动清档重开
    useEffect(() => {
        const intent = readShelfResume(location.state, fileIdParam);
        if (!intent || !game || isLoading) return;
        if (!consumeShelfResumeOnce(location.key)) return;
        void (async () => {
            if (!checkAuth()) return;
            if (intent.saveId) {
                const ok = await handleLoadSave(intent.saveId, { silent: true });
                if (!ok) {
                    toast.error(t('gameDetail.shelfSaveLoadFailed'));
                    setIsLoadSaveOpen(true);
                }
                return;
            }
            if (isNovel || isInteractiveVideo) {
                await handleOpenStartOptions();
                return;
            }
            await handleStartGame();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game, isLoading, location.key, location.state, fileIdParam]);

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

    // 功能注释：草稿/待审/驳回/下架 — 公开链接只显示说明，不进入作品
    if (!listingState.canEnter) {
        return (
            <div className={styles.pageContainer} data-listing-gate={listingState.code}>
                <div className={styles.topBar}>
                    <div className={styles.topBarContent}>
                        <button className={styles.backIconButton} onClick={handleBack} aria-label={t('gameDetail.back')}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M15 6L9 12L15 18" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className={styles.errorContainer}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{listingMessage}</p>
                    <p style={{ opacity: 0.75, marginTop: 8 }}>
                        {game.title ? `「${game.title}」` : ''}{t('gameDetail.notListedHint')}
                    </p>
                    <button onClick={() => navigate('/home')} className={styles.backButton}>
                        {t('gameDetail.backToHome')}
                    </button>
                </div>
            </div>
        );
    }

    const ratingDisplay = resolveRatingDisplay(
        ratingStats?.average ?? game.rating_avg,
        ratingStats?.count ?? game.rating_count,
    );
    const fallbackUpdateNote = game.version_notes?.trim() || '';
    const latestNote = latestUpdateLog?.note || fallbackUpdateNote;
    const latestNoteAt = latestUpdateLog?.createdAt || game.updated_at;
    const latestNoteDateLabel = latestNoteAt
        ? new Date(latestNoteAt).toLocaleDateString(i18n.language || undefined)
        : '';

    const rawDescription = game.description || t('gameDetail.noDescription');
    const isHtmlDescription = looksLikeHtml(rawDescription);
    const plainDescription = normalizeNewlines(descriptionToPlainText(rawDescription) || rawDescription);
    const needsExpandDescription = !isHtmlDescription && descriptionNeedsExpand(plainDescription);
    const showCollapsedDescription = needsExpandDescription && !isDescriptionExpanded;

    return (
        <div className={styles.pageContainer} data-layout="game-detail-v2">
            {/* 顶栏：返回 + 作品详情 + 分享 */}
            <div className={styles.topBar}>
                <div className={`${styles.topBarContent} ${styles.topBarContentSplit}`}>
                    <button className={styles.backIconButton} onClick={handleBack} aria-label={t('gameDetail.back')}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M15 6L9 12L15 18" />
                        </svg>
                    </button>
                    <h1 className={styles.pageTitle}>{t('gameDetail.pageTitle')}</h1>
                    <button
                        type="button"
                        className={styles.topIconButton}
                        onClick={handleShare}
                        aria-label={t('gameDetail.share')}
                    >
                        <DetailShareIcon />
                    </button>
                </div>
            </div>

            {/* 封面大图 + 类型角标（如 AI文游） */}
            <div className={`${styles.heroSection} ${styles.heroSectionCoverOnly}`} style={heroStyle}>
                {gameTypeLabel ? (
                    <span className={styles.coverTypeBadge}>{gameTypeLabel}</span>
                ) : null}
            </div>

            <div className={`${styles.contentSection} ${styles.contentSectionFlow}`}>
                <div className={styles.contentWrapper}>
                    {/* 标题区：作品名+星级、作者行+关注、题材标签 */}
                    <div className={styles.titleBlock}>
                        <div className={styles.heroTitleRow}>
                            <h2 className={styles.heroGameTitle}>
                                {game.title || t('gameDetail.unnamedGame')}
                            </h2>
                            {ratingDisplay.hasScore ? (
                                <span
                                    className={styles.ratingBadge}
                                    aria-label={t('gameDetail.ratingScoreAria', { score: ratingDisplay.score, count: ratingDisplay.count })}
                                >
                                    <span className={styles.ratingBadgeStar} aria-hidden="true">★</span>
                                    {ratingDisplay.score}
                                    <span className={styles.ratingBadgeCount}>
                                        {t('gameDetail.ratingCount', { count: ratingDisplay.count })}
                                    </span>
                                </span>
                            ) : (
                                <span className={`${styles.ratingBadge} ${styles.ratingBadgeEmpty}`}>
                                    {t('gameDetail.ratingNone')}
                                </span>
                            )}
                        </div>
                        {heroAuthorName ? (
                            <div className={styles.heroMetaActions}>
                                <button
                                    type="button"
                                    className={`${styles.heroMetaRow} ${styles.heroMetaRowClickable}`}
                                    onClick={handleOpenCreatorHomepage}
                                    aria-label={t('gameDetail.openCreatorHomepage')}
                                >
                                    <img
                                        className={styles.heroAuthorAvatar}
                                        src={heroAuthorAvatarSrc}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <p className={styles.heroMeta}>{heroAuthorName}</p>
                                </button>
                                {canShowCreatorFollowSlot ? (
                                    showCreatorFollowBtn ? (
                                        <button
                                            type="button"
                                            className={`${styles.followBtn} ${
                                                isCreatorBlocked || isCreatorBlockedBy
                                                    ? styles.followBtnMuted
                                                    : isFollowingCreator
                                                        ? styles.followBtnActive
                                                        : styles.followBtnIdle
                                            }`}
                                            disabled={followBusy || !creatorFollowActionable}
                                            onClick={() => void handleToggleCreatorFollow()}
                                        >
                                            {isCreatorBlocked
                                                ? t('create.socialBlockedBtn')
                                                : isCreatorBlockedBy
                                                    ? t('create.socialCannotFollowBtn')
                                                    : isFollowingCreator
                                                        ? t('create.socialFollowingBtn')
                                                        : t('create.socialFollowBtn')}
                                        </button>
                                    ) : (
                                        <span className={styles.followBtnPlaceholder} aria-hidden="true" />
                                    )
                                ) : null}
                            </div>
                        ) : null}
                        {themeTags.length > 0 ? (
                            <div className={styles.heroTags}>
                                {themeTags.map((tag) => (
                                    <span key={tag} className={styles.heroTag}>{tag}</span>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    {/* 互动行：描边三钮「点赞 N / 收藏 N / 评分」 */}
                    <div className={styles.statsBar} role="group" aria-label={t('gameDetail.stats')}>
                        <button
                            type="button"
                            className={`${styles.statsItem} ${isLiked ? styles.statsItemActive : ''}`}
                            onClick={handleLike}
                            aria-busy={isLikeLoading}
                            aria-label={t('gameDetail.like')}
                            aria-pressed={isLiked}
                        >
                            <DetailHeartIcon
                                key={likePopKey}
                                className={`${styles.statsIcon} ${likePopKey > 0 && isLiked ? styles.statsIconPop : ''}`}
                            />
                            <span className={styles.statsText}>
                                <span className={styles.statsLabel}>{t('gameDetail.like')}</span>
                                <span className={styles.statsValue}>{likeCountDisplay}</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statsItem} ${isFavorited ? styles.statsItemActive : ''}`}
                            onClick={handleFavorite}
                            aria-busy={isFavoriteLoading}
                            aria-label={t('gameDetail.favorite')}
                            aria-pressed={isFavorited}
                        >
                            <DetailStarIcon className={styles.statsIcon} />
                            <span className={styles.statsText}>
                                <span className={styles.statsLabel}>{t('gameDetail.favorite')}</span>
                                <span className={styles.statsValue}>{favoriteCountDisplay}</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.statsItem} ${myRatingValue != null ? styles.statsItemActive : ''}`}
                            onClick={handleOpenRating}
                            aria-label={t('gameDetail.rate')}
                        >
                            <DetailRateIcon className={styles.statsIcon} />
                            <span className={styles.statsText}>
                                <span className={styles.statsLabel}>{t('gameDetail.rate')}</span>
                                {myRatingValue != null ? (
                                    <span className={styles.statsValue}>{myRatingValue.toFixed(1)}</span>
                                ) : null}
                            </span>
                        </button>
                    </div>

                    {/* 剧情简介 */}
                    <section className={styles.sectionBlock} aria-label={t('gameDetail.plotSynopsis')}>
                        <div className={styles.synopsisHeader}>
                            <h3 className={styles.synopsisTitle}>{t('gameDetail.plotSynopsis')}</h3>
                        </div>
                        <div className={styles.descriptionSection}>
                            {isHtmlDescription ? (
                                <div
                                    className={styles.descriptionHtml}
                                    dangerouslySetInnerHTML={{
                                        __html: hydrateDescriptionHtmlForDisplay(rawDescription, getImageUrl),
                                    }}
                                />
                            ) : (
                                <p className={showCollapsedDescription ? styles.descriptionCollapsed : undefined}>
                                    {plainDescription}
                                </p>
                            )}
                        </div>
                        {needsExpandDescription ? (
                            <button
                                type="button"
                                className={styles.readMoreButton}
                                onClick={() => setIsDescriptionExpanded((v) => !v)}
                            >
                                {isDescriptionExpanded ? t('gameDetail.readLess') : t('gameDetail.readMore')}
                            </button>
                        ) : null}
                    </section>

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
                                onClick={async () => {
                                    try {
                                        await copyTextToClipboard(game.groupNo!);
                                        toast.success(t('gameDetail.qqGroupCopied'));
                                    } catch {
                                        toast.error(t('copyFailed'));
                                    }
                                }}
                                title={t('createGame.copyGroupNo')}
                            >
                                <MdContentCopy />
                            </button>
                        </span>
                    ) : null}

                    {/* 主次按钮放在简介下方正文流，不双按钮贴底独占 */}
                    <div className={`${styles.bottomActionRow} ${styles.inlineActionRow}`}>
                        <button
                            className={styles.startButton}
                            onClick={useSaveSplitActions ? handleStartFreshGame : handleOpenStartOptions}
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
                                    <span>{useSaveSplitActions ? t('gameDetail.startGame') : startButtonText}</span>
                                </>
                            )}
                        </button>
                        {useSaveSplitActions ? (
                            <button
                                type="button"
                                className={styles.replayButton}
                                onClick={() => { void handleOpenLoadSave(); }}
                            >
                                <MdOutlineHistory className={styles.replayButtonIcon} aria-hidden="true" />
                                <span>{t('gameDetail.loadSave')}</span>
                            </button>
                        ) : null}
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

                    {/* 更新日志：最近卡片 + 查看全部 */}
                    <section className={styles.sectionBlock} aria-label={t('gameDetail.updateLog')}>
                        <div className={styles.synopsisHeader}>
                            <h3 className={styles.synopsisTitle}>{t('gameDetail.updateLog')}</h3>
                        </div>
                        <div className={styles.updateLogCard}>
                            <div className={styles.updateLogCardHeader}>
                                <div className={styles.updateLogCardMeta}>
                                    <span className={styles.updateLogRecentBadge}>
                                        {t('gameDetail.updateLogRecent')}
                                    </span>
                                    {latestNoteDateLabel ? (
                                        <time className={styles.updateLogTime} dateTime={latestNoteAt || undefined}>
                                            {latestNoteDateLabel}
                                        </time>
                                    ) : null}
                                </div>
                                {(updateLogs.length > 0 || latestNote) ? (
                                    <button
                                        type="button"
                                        className={styles.updateLogViewAll}
                                        onClick={() => setIsUpdateLogModalOpen(true)}
                                    >
                                        {t('gameDetail.updateLogViewAll')}
                                    </button>
                                ) : null}
                            </div>
                            {latestNote ? (
                                <p className={styles.updateLogBody}>{normalizeNewlines(latestNote)}</p>
                            ) : (
                                <p className={styles.updateLogEmpty}>{t('gameDetail.updateLogEmpty')}</p>
                            )}
                        </div>

                        <div className={styles.feedbackEntryRow}>
                            <button
                                type="button"
                                className={styles.feedbackEntry}
                                onClick={() => {
                                    if (!checkAuth()) {
                                        return;
                                    }
                                    setIsIssueModalOpen(true);
                                }}
                            >
                                {t('gameDetail.issueFeedbackEntry')}
                            </button>
                        </div>
                    </section>

                    {/* 评论区常驻：真实接口数据，样式对齐效果图 */}
                    {fileId ? (
                        <section className={styles.sectionBlock} aria-label={t('gameRating.commentsSection')}>
                            <GameRating
                                key={`${fileId}-${commentsRefreshKey}`}
                                fileId={fileId}
                                mode="comments"
                                onRatingChange={(summary) => {
                                    // 功能注释：以评论区实时汇总为准（含新提交的评分）
                                    setRatingStats({ average: summary.average, count: summary.total });
                                }}
                                onUserRatingChange={applyUserRatingFromComments}
                            />
                        </section>
                    ) : null}
                </div>
            </div>

            <GameRatingModal
                isOpen={isRatingModalOpen}
                onClose={() => setIsRatingModalOpen(false)}
                fileId={String(fileId || '')}
                gameTitle={game.title || ''}
                initialValue={myRatingValue}
                initialComment={myRatingComment}
                canEdit={canEditMyRating}
                onSubmitted={({ ratingValue, comment }) => {
                    setMyRatingValue(ratingValue);
                    setMyRatingComment(comment);
                    setMyRatingEditCount((prev) => (myRatingValue == null ? 0 : Math.min(1, prev + 1)));
                    setCommentsRefreshKey((k) => k + 1);
                }}
            />
            <GameUpdateLogModal
                isOpen={isUpdateLogModalOpen}
                onClose={() => setIsUpdateLogModalOpen(false)}
                logs={
                    updateLogs.length > 0
                        ? updateLogs
                        : latestNote
                            ? [{
                                id: 0,
                                fileId: String(fileId || ''),
                                note: latestNote,
                                createdBy: null,
                                createdAt: latestNoteAt || new Date().toISOString(),
                            }]
                            : []
                }
            />
            <GameIssueFeedbackModal
                isOpen={isIssueModalOpen}
                onClose={() => setIsIssueModalOpen(false)}
                fileId={String(fileId || '')}
                gameTitle={game.title || ''}
            />

            {/* 模态框 */}
            <ConfirmModal
                isOpen={isRestartConfirmOpen}
                title={t('gameDetail.restartConfirmTitle')}
                message={t('gameDetail.restartConfirmMessage')}
                confirmButtonText={t('gameDetail.startGame')}
                cancelButtonText={t('common.cancel')}
                onConfirm={() => {
                    setIsRestartConfirmOpen(false);
                    void handleStartNewGame();
                }}
                onCancel={() => setIsRestartConfirmOpen(false)}
            />
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
                        aria-label={t('gameDetail.ivgBuyoutTitle')}
                    >
                        <div className={styles.startOptionsHeader}>
                            <div className={styles.startOptionsHeaderMain}>
                                <h2 className={styles.startOptionsTitle}>{t('gameDetail.ivgBuyoutTitle')}</h2>
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
                            {t('gameDetail.ivgBuyoutMessage')}
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
                                        {isInteractiveVideoBuyoutUnlocking ? t('gameDetail.processing') : t('gameDetail.ivgConfirmPay', { label: option.label })}
                                    </button>
                                ))
                            ) : (
                                <p className={styles.interactiveVideoBuyoutMessage}>{t('gameDetail.ivgNoPaymentMethod')}</p>
                            )}
                            <button
                                type="button"
                                className={styles.startOptionsGhost}
                                disabled={isInteractiveVideoBuyoutUnlocking}
                                onClick={() => setIsInteractiveVideoBuyoutConfirmOpen(false)}
                            >
                                {t('common.cancel')}
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
                autoSlot={useSaveSplitActions && playStatus.hasContinueState ? {
                    title: t('gameDetail.autoSaveSlot'),
                    hint: t('gameDetail.autoSaveSlotHint'),
                    actionText: t('createGame.loadSaveList.load'),
                    onSelect: () => {
                        setIsLoadSaveOpen(false);
                        void handleStartGame();
                    },
                } : null}
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
                onReport={
                    !isCreatorSelf && fileId
                        ? () => {
                            if (!isAuthenticated) {
                                setIsAuthModalOpen(true);
                                return;
                            }
                            setIsReportSheetOpen(true);
                        }
                        : undefined
                }
            />
            {fileId ? (
                <ReportSheet
                    isOpen={isReportSheetOpen}
                    onClose={() => setIsReportSheetOpen(false)}
                    targetType="game"
                    targetId={String(fileId)}
                    showPolicyHint
                />
            ) : null}
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
