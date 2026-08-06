import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './Home.module.css';
import HomeThemePreviewRail from '../components/HomeThemePreviewRail';
import Navbar from '../components/Layout/Navbar';
import GameGrid from '../components/GameGrid';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import promotionApi from '../api/promotion/promotionApi';
import { authModalStore, useAuthStore } from '../store/useAuthStore';
import FooterArea from '../components/Layout/FooterArea';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';
import CheckInModal from '../components/CheckInModal';
import JoinGroupModal from '../components/JoinGroupModal';
import FloatingJoinGroup from '../components/FloatingJoinGroup';
import HomeGameFilterBar from '../components/HomeGameFilterBar';
import { getImageUrl } from '../utils/constants';
import { auth } from '../api/account/authApi';
import announcementApi from '../api/announcement/announcementApi';
import type { AnnouncementRecord } from '../api/announcement/announcement.type';
import AnnouncementModal from '../components/AnnouncementModal';
import bannerApi from '../api/banner/bannerApi';
import type { BannerItem } from '../api/banner/banner.type';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import specialThemeTagsApi from '../api/specialThemeTags/specialThemeTagsApi';
import type { HomePromotionTicker } from '../api/promotion/promotion.type';
import { flattenThemeTags, type FlatThemeTag } from '../utils/themeTags';
import type { SpecialThemeAutoSort, SpecialThemeTagRecord } from '../api/specialThemeTags/specialThemeTagsApi.type';
import {
    DEFAULT_HOME_LIST_FILTERS,
    getHomeListFilterKey,
    HOME_LIST_MODE_OPTIONS,
    type HomeListFilters,
    type HomeListMode,
    type HomeListSort,
} from '../utils/gameBrowseFilters';
import { resolveHomeFiltersForNovelThemeConflict } from '../utils/homeFilterNovelTheme';
import { openConfiguredLink } from '../utils/promotionNavigation';
import { useExternalLinkCopyModal } from '../hooks/useExternalLinkCopyModal';

type CarouselItem = UserGameData | BannerItem;

const isBannerCarouselItem = (item: CarouselItem): item is BannerItem => 'image_url' in item;
const PROTECTED_PATH_PREFIXES = ['/analytics', '/create', '/createGame', '/warehouse', '/profile', '/promotions', '/admin', '/galgame', '/galgameMap', '/customif', '/interactive-video'];
const DESKTOP_CAROUSEL_BREAKPOINT = 768;
const MOBILE_NAVBAR_HEIGHT = 60;
const DESKTOP_CAROUSEL_RATIO = 9 / 5;
const CAROUSEL_AUTOPLAY_INTERVAL = 7000;

type DesktopCarouselMetrics = {
    isDesktop: boolean;
    viewportWidth: number;
    slideWidth: number;
    slideGap: number;
};

type CarouselNavAction =
    | { type: 'next' }
    | { type: 'prev' }
    | { type: 'slide'; logicalIndex: number };

type HomeShowcaseTag = {
    key: string;
    id: number;
    kind: 'special' | 'featured';
    name: string;
    code?: string;
    configMode?: 'manual' | 'auto';
    autoSort?: SpecialThemeAutoSort | null;
};

const HOME_PAGE_DEFAULT_FILTERS: HomeListFilters = {
    ...DEFAULT_HOME_LIST_FILTERS,
};

const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const normalizeShowcaseTagName = (name: string) => String(name || '').trim().toLowerCase();
const getShowcaseTagI18nCode = (code: string | undefined): string | undefined =>
    code ? `home.specialThemeTagCodes.${code}` : undefined;
const getGameUniqueKey = (game: UserGameData, fallbackIndex?: number): string => {
    const fileId = String(game.file_id || '').trim();
    if (fileId) return `file:${fileId}`;

    const id = String(game.id || '').trim();
    if (id) return `id:${id}`;

    return `fallback:${fallbackIndex ?? 0}`;
};
// 实现 PC 端轮播环形索引
const getLoopCarouselIndex = (index: number, itemCount: number) => {
    if (itemCount <= 1) return 0;
    return ((index % itemCount) + itemCount) % itemCount;
};
// 实现 PC 端相邻卡片状态计算
const getCircularCarouselDistance = (currentIndex: number, targetIndex: number, itemCount: number) => {
    if (itemCount <= 1) return 0;
    const forwardDistance = (targetIndex - currentIndex + itemCount) % itemCount;
    const backwardDistance = forwardDistance - itemCount;
    return Math.abs(forwardDistance) <= Math.abs(backwardDistance)
        ? forwardDistance
        : backwardDistance;
};

const Home: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { requestCopy, modal: externalLinkCopyModal } = useExternalLinkCopyModal();
    const SWIPE_THRESHOLD = 40;
    const SWIPE_CLICK_SUPPRESS_MS = 250;
    //const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [,setFileMetas] = useState<UserGameData[]>([]);
    const [allGames, setAllGames] = useState<UserGameData[]>([]);
    //const [isLoadingSpecial, setIsLoadingSpecial] = useState(true);
    const [,setIsLoadingSpecial] = useState(true);
    const [isLoadingAll, setIsLoadingAll] = useState(true);
    const [isLoadingMoreSpecial, setIsLoadingMoreSpecial] = useState(false);
    const [isLoadingMoreAll, setIsLoadingMoreAll] = useState(false);
    const [hasMoreSpecial, setHasMoreSpecial] = useState(true);
    const [hasMoreAll, setHasMoreAll] = useState(true);
    const [specialPage, setSpecialPage] = useState(0);
    const [allPage, setAllPage] = useState(0);
    const [allGamesFilters, setAllGamesFilters] = useState<HomeListFilters>(HOME_PAGE_DEFAULT_FILTERS);
    const [currentSlide, setCurrentSlide] = useState(1);
    const [desktopCurrentSlide, setDesktopCurrentSlide] = useState(0);
    const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);
    const { user, isAuthenticated, updateUser } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();
    const carouselIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const carouselTrackRef = useRef<HTMLDivElement | null>(null);
    const isCarouselResettingRef = useRef(false);
    const pendingCarouselNavRef = useRef<CarouselNavAction | null>(null);
    const mainContentRef = useRef<HTMLDivElement | null>(null);
    const todayWrapRef = useRef<HTMLDivElement | null>(null);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const hasCheckedInSessionRef = useRef(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
    const isLoadingRef = useRef(false);
    const isLoadingMoreSpecialRef = useRef(false);
    const isLoadingMoreAllRef = useRef(false);
    const lastUserIdRef = useRef<string | number | undefined>(undefined);
    const hasInitializedRef = useRef(false);
    const latestAllGamesRequestIdRef = useRef(0);
    const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
    const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
    const [latestAnnouncement, setLatestAnnouncement] = useState<AnnouncementRecord | null>(null);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [homeTicker, setHomeTicker] = useState<HomePromotionTicker | null>(null);
    const [isTickerOverflowing, setIsTickerOverflowing] = useState(false);
    const [pendingTickerLink, setPendingTickerLink] = useState<string | null>(null);
    const [featuredThemeTags, setFeaturedThemeTags] = useState<FlatThemeTag[]>([]);
    const [allThemeTags, setAllThemeTags] = useState<FlatThemeTag[]>([]);
    const [specialThemeTags, setSpecialThemeTags] = useState<SpecialThemeTagRecord[]>([]);
    const [hasLoadedHomeShowcaseTags, setHasLoadedHomeShowcaseTags] = useState(false);
    const [activeShowcaseTagKey, setActiveShowcaseTagKey] = useState<string | null>(null);
    const [showcaseGamesCache, setShowcaseGamesCache] = useState<Record<string, UserGameData[]>>({});
    const [showcaseLoadingKey, setShowcaseLoadingKey] = useState<string | null>(null);
    const [isThemeShowcaseDragging, setIsThemeShowcaseDragging] = useState(false);
    const [carouselImageRetryMap, setCarouselImageRetryMap] = useState<Record<string, number>>({});
    const [carouselImageLoadedMap, setCarouselImageLoadedMap] = useState<Record<string, boolean>>({});
    const touchStartXRef = useRef<number | null>(null);
    const touchStartYRef = useRef<number | null>(null);
    const touchDeltaXRef = useRef(0);
    const touchDeltaYRef = useRef(0);
    const suppressBannerClickRef = useRef(false);
    const suppressClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const carouselImagePreloadRef = useRef<Set<string>>(new Set());
    const carouselImageLoadedMapRef = useRef<Record<string, boolean>>({});
    const carouselImageRetryMapRef = useRef<Record<string, number>>({});
    const carouselImagePreloadPromiseRef = useRef<Map<string, Promise<boolean>>>(new Map());
    const pendingMobileCarouselNavRef = useRef<{ token: number; action: CarouselNavAction } | null>(null);
    const queuedMobileCarouselActionRef = useRef<CarouselNavAction | null>(null);
    const mobileCarouselNavTokenRef = useRef(0);
    const isMobileCarouselTransitioningRef = useRef(false);
    const requestCarouselNavActionRef = useRef<(action: CarouselNavAction) => void>(() => undefined);
    const pendingTickerAuthRef = useRef(false);
    const homeTickerViewportRef = useRef<HTMLSpanElement | null>(null);
    const homeTickerMeasureTextRef = useRef<HTMLSpanElement | null>(null);
    const navigateToHomeTickerLinkRef = useRef<(linkUrl: string, allowAuthPrompt?: boolean) => void>(() => undefined);
    const themeShowcaseRef = useRef<HTMLDivElement | null>(null);
    const carouselViewportRef = useRef<HTMLDivElement | null>(null);
    const hasInitializedShowcaseDefaultRef = useRef(false);
    const wasDesktopCarouselRef = useRef(false);
    const themeShowcaseDragStateRef = useRef({
        isDragging: false,
        startX: 0,
        startScrollLeft: 0,
        moved: false,
    });
    const [desktopCarouselMetrics, setDesktopCarouselMetrics] = useState<DesktopCarouselMetrics>({
        isDesktop: false,
        viewportWidth: 0,
        slideWidth: 0,
        slideGap: 0,
    });
    const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth <= DESKTOP_CAROUSEL_BREAKPOINT);
    const [isMobileHomeNavbarScrolled, setIsMobileHomeNavbarScrolled] = useState(false);
    const hasMultipleCarouselItems = carouselItems.length > 1;
    const isDesktopCarousel = desktopCarouselMetrics.isDesktop && desktopCarouselMetrics.slideWidth > 0;
    const mobileCarouselRenderItems = hasMultipleCarouselItems
        ? [carouselItems[carouselItems.length - 1], ...carouselItems, carouselItems[0]]
        : carouselItems;
    const carouselRenderItems = isDesktopCarousel ? carouselItems : mobileCarouselRenderItems;
    const currentLogicalSlide = hasMultipleCarouselItems
        ? ((currentSlide - 1 + carouselItems.length) % carouselItems.length)
        : 0;
    const activeCarouselSlide = isDesktopCarousel
        ? getLoopCarouselIndex(desktopCurrentSlide, carouselItems.length)
        : currentLogicalSlide;
    const homeShowcaseTags = useMemo<HomeShowcaseTag[]>(() => {
        const specialTags = specialThemeTags.map((tag) => ({
            key: `special-${tag.id}`,
            id: Number(tag.id),
            kind: 'special' as const,
            name: String(tag.name || ''),
            code: String(tag.code || ''),
            configMode: tag.config_mode,
            autoSort: tag.auto_sort,
        })).filter((tag) => tag.name);
        const featuredTags = featuredThemeTags.map((tag) => ({
            key: `featured-${tag.id}`,
            id: Number(tag.id),
            kind: 'featured' as const,
            name: String(tag.name || ''),
        })).filter((tag) => tag.name);

        const usedNames = new Set<string>();
        const mergedTags: HomeShowcaseTag[] = [];

        // 实现首页标签去重，特殊标签优先展示
        [...specialTags, ...featuredTags].forEach((tag) => {
            const normalizedName = normalizeShowcaseTagName(tag.name);
            if (!normalizedName || usedNames.has(normalizedName)) return;

            usedNames.add(normalizedName);
            mergedTags.push(tag);
        });

        return mergedTags;
    }, [featuredThemeTags, specialThemeTags]);
    const activeShowcaseTag = useMemo(
        () => homeShowcaseTags.find((tag) => tag.key === activeShowcaseTagKey) || null,
        [activeShowcaseTagKey, homeShowcaseTags],
    );
    const activeShowcaseGames = activeShowcaseTag
        ? (showcaseGamesCache[activeShowcaseTag.key] || [])
        : [];
    const themePreviewResetKey = `${activeShowcaseTagKey || 'none'}-${showcaseLoadingKey === activeShowcaseTagKey ? 'loading' : 'ready'}`;
    const allGamesFilterKey = useMemo(
        () => getHomeListFilterKey(allGamesFilters),
        [allGamesFilters],
    );
    const allGamesEmptyText = useMemo(() => {
        if (allGamesFilters.mode !== 'all' && allGamesFilters.tagId != null) {
            const modeOption = HOME_LIST_MODE_OPTIONS.find((option) => option.value === allGamesFilters.mode);
            const modeLabel = modeOption?.labelKey ? t(modeOption.labelKey) : (modeOption?.label || allGamesFilters.mode);
            const themeLabel = allThemeTags.find((tag) => Number(tag.id) === Number(allGamesFilters.tagId))?.name
                || t('gameBrowse.theme');
            return t('home.noMatchingWorksModeTheme', { mode: modeLabel, theme: themeLabel });
        }
        return t('home.noMatchingWorks');
    }, [allGamesFilters.mode, allGamesFilters.tagId, allThemeTags, t]);

    useEffect(() => {
        carouselImageLoadedMapRef.current = carouselImageLoadedMap;
    }, [carouselImageLoadedMap]);

    useEffect(() => {
        carouselImageRetryMapRef.current = carouselImageRetryMap;
    }, [carouselImageRetryMap]);

    const getCarouselSlidePosition = useCallback((slide: number, itemCount: number) => {
        if (itemCount <= 1) return 0;
        if (!Number.isFinite(slide)) return 1;
        const logicalIndex = ((slide - 1) % itemCount + itemCount) % itemCount;
        return logicalIndex + 1;
    }, []);

    const updateDesktopCarouselMetrics = useCallback(() => {
        const viewport = carouselViewportRef.current;
        if (!viewport) return;

        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;

        if (viewportWidth <= DESKTOP_CAROUSEL_BREAKPOINT || viewportHeight === 0) {
            setDesktopCarouselMetrics((prev) => (
                prev.isDesktop || prev.viewportWidth !== 0 || prev.slideWidth !== 0 || prev.slideGap !== 0
                    ? { isDesktop: false, viewportWidth: 0, slideWidth: 0, slideGap: 0 }
                    : prev
            ));
            return;
        }

        const slideGap = Math.round(clampValue(viewportWidth * 0.024, 20, 32));
        const sidePeek = clampValue(viewportWidth * 0.12, 56, 180);
        const maxSlideWidth = Math.max(viewportWidth - sidePeek * 2, 320);
        const preferredSlideWidth = Math.min(
            viewportHeight * DESKTOP_CAROUSEL_RATIO,
            viewportWidth * 0.72,
            maxSlideWidth,
        );
        const slideWidth = Math.round(Math.max(preferredSlideWidth, 320));

        setDesktopCarouselMetrics((prev) => {
            const nextMetrics: DesktopCarouselMetrics = {
                isDesktop: true,
                viewportWidth,
                slideWidth,
                slideGap,
            };

            if (
                prev.isDesktop === nextMetrics.isDesktop
                && prev.viewportWidth === nextMetrics.viewportWidth
                && prev.slideWidth === nextMetrics.slideWidth
                && prev.slideGap === nextMetrics.slideGap
            ) {
                return prev;
            }

            return nextMetrics;
        });
    }, []);

    const updateMobileHomeNavbarState = useCallback(() => {
        const nextIsMobileViewport = window.innerWidth <= DESKTOP_CAROUSEL_BREAKPOINT;
        setIsMobileViewport((prev) => (prev === nextIsMobileViewport ? prev : nextIsMobileViewport));

        if (!nextIsMobileViewport) {
            setIsMobileHomeNavbarScrolled(false);
            return;
        }

        const scrollTop = mainContentRef.current?.scrollTop ?? 0;
        const bannerHeight = todayWrapRef.current?.offsetHeight ?? 0;
        const overlayThreshold = Math.max(bannerHeight - MOBILE_NAVBAR_HEIGHT, 0);
        const nextIsScrolled = scrollTop > overlayThreshold;

        setIsMobileHomeNavbarScrolled((prev) => (prev === nextIsScrolled ? prev : nextIsScrolled));
    }, []);

    useEffect(() => {
        updateDesktopCarouselMetrics();

        const viewport = carouselViewportRef.current;
        if (!viewport || typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateDesktopCarouselMetrics);
            return () => {
                window.removeEventListener('resize', updateDesktopCarouselMetrics);
            };
        }

        // 实现桌面端轮播尺寸监听
        const resizeObserver = new ResizeObserver(() => {
            updateDesktopCarouselMetrics();
        });

        resizeObserver.observe(viewport);
        window.addEventListener('resize', updateDesktopCarouselMetrics);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateDesktopCarouselMetrics);
        };
    }, [carouselItems.length, updateDesktopCarouselMetrics]);

    useEffect(() => {
        updateMobileHomeNavbarState();

        const handleResize = () => {
            updateMobileHomeNavbarState();
        };

        const mainContentElement = mainContentRef.current;
        const todayWrapElement = todayWrapRef.current;

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', handleResize);
            return () => {
                window.removeEventListener('resize', handleResize);
            };
        }

        const resizeObserver = new ResizeObserver(() => {
            updateMobileHomeNavbarState();
        });

        if (mainContentElement) {
            resizeObserver.observe(mainContentElement);
        }

        if (todayWrapElement) {
            resizeObserver.observe(todayWrapElement);
        }

        window.addEventListener('resize', handleResize);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [carouselItems.length, updateMobileHomeNavbarState]);

    const handleMainContentScroll = useCallback(() => {
        if (!isMobileViewport) return;
        updateMobileHomeNavbarState();
    }, [isMobileViewport, updateMobileHomeNavbarState]);

    const getDesktopCarouselDistance = useCallback((itemIndex: number) => (
        getCircularCarouselDistance(
            getLoopCarouselIndex(desktopCurrentSlide, carouselItems.length),
            itemIndex,
            carouselItems.length,
        )
    ), [carouselItems.length, desktopCurrentSlide]);

    const getDesktopCarouselSlideStyle = useCallback((itemIndex: number): React.CSSProperties | undefined => {
        if (!isDesktopCarousel) return undefined;

        // 实现首尾无缝衔接
        const distance = getDesktopCarouselDistance(itemIndex);
        const absDistance = Math.abs(distance);
        const step = desktopCarouselMetrics.slideWidth + desktopCarouselMetrics.slideGap;
        const scale = absDistance === 0 ? 1 : absDistance === 1 ? 0.92 : 0.84;

        return {
            width: `${desktopCarouselMetrics.slideWidth}px`,
            left: '50%',
            top: '50%',
            zIndex: Math.max(1, 20 - absDistance),
            transform: `translate3d(-50%, -50%, 0) translate3d(${Math.round(distance * step)}px, 0, 0) scale(${scale})`,
        };
    }, [desktopCarouselMetrics.slideGap, desktopCarouselMetrics.slideWidth, getDesktopCarouselDistance, isDesktopCarousel]);

    const getCarouselSlideStateClass = useCallback((renderIndex: number) => {
        if (isDesktopCarousel) {
            const renderDistance = Math.abs(getDesktopCarouselDistance(renderIndex));

            if (renderDistance === 0) return styles.carouselSlideCurrent;
            if (renderDistance === 1) return styles.carouselSlideAdjacent;
            return styles.carouselSlideFar;
        }

        const renderDistance = Math.abs(renderIndex - currentSlide);

        if (renderDistance === 0) return styles.carouselSlideCurrent;
        if (renderDistance === 1) return styles.carouselSlideAdjacent;
        return styles.carouselSlideFar;
    }, [currentSlide, getDesktopCarouselDistance, isDesktopCarousel]);

    const getCarouselImageStateKey = useCallback((item: CarouselItem) => {
        // 实现图片资源稳定标识
        const imageUrl = isBannerCarouselItem(item) ? item.image_url || '' : item.cover_url || '';
        const stableItemId = isBannerCarouselItem(item)
            ? item.id || item.link_url || item.title || imageUrl
            : item.file_id || item.id || item.title || imageUrl;
        return `${stableItemId}-${imageUrl}`;
    }, []);

    const buildCarouselImageSrc = useCallback((item: CarouselItem, retryVersion: number) => {
        const baseUrl = getImageUrl(getCarouselItemImage(item));
        if (!baseUrl) return '';

        if (retryVersion <= 0) {
            return baseUrl;
        }

        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}carouselReload=${retryVersion}`;
    }, []);

    const getCarouselImageSrc = useCallback((item: CarouselItem) => {
        const imageStateKey = getCarouselImageStateKey(item);
        return buildCarouselImageSrc(item, carouselImageRetryMap[imageStateKey] || 0);
    }, [buildCarouselImageSrc, carouselImageRetryMap, getCarouselImageStateKey]);

    const markCarouselImageLoaded = useCallback((imageStateKey: string) => {
        setCarouselImageLoadedMap((prev) => {
            if (prev[imageStateKey]) {
                return prev;
            }

            const nextMap = { ...prev, [imageStateKey]: true };
            carouselImageLoadedMapRef.current = nextMap;
            return nextMap;
        });
    }, []);

    const preloadCarouselImage = useCallback((item: CarouselItem): Promise<boolean> => {
        if (isDesktopCarousel) {
            return Promise.resolve(true);
        }

        const imageStateKey = getCarouselImageStateKey(item);
        if (carouselImageLoadedMapRef.current[imageStateKey]) {
            return Promise.resolve(true);
        }

        const retryVersion = carouselImageRetryMapRef.current[imageStateKey] || 0;
        const imageSrc = buildCarouselImageSrc(item, retryVersion);
        if (!imageSrc) {
            return Promise.resolve(false);
        }

        const preloadTaskKey = `${imageStateKey}-${retryVersion}`;
        const existingPromise = carouselImagePreloadPromiseRef.current.get(preloadTaskKey);
        if (existingPromise) {
            return existingPromise;
        }

        // 实现移动端 banner 图片预加载
        const preloadPromise = new Promise<boolean>((resolve) => {
            carouselImagePreloadRef.current.add(imageSrc);
            const image = new Image();
            image.decoding = 'async';

            const clearPreloadState = () => {
                carouselImagePreloadRef.current.delete(imageSrc);
                carouselImagePreloadPromiseRef.current.delete(preloadTaskKey);
            };

            const resolveLoaded = () => {
                clearPreloadState();
                markCarouselImageLoaded(imageStateKey);
                resolve(true);
            };

            image.onload = () => {
                if (typeof image.decode === 'function') {
                    image.decode().catch(() => undefined).finally(resolveLoaded);
                    return;
                }
                resolveLoaded();
            };

            image.onerror = () => {
                clearPreloadState();

                setCarouselImageRetryMap((prev) => {
                    const currentRetryCount = prev[imageStateKey] || 0;
                    if (currentRetryCount >= 1) {
                        return prev;
                    }

                    const nextMap = { ...prev, [imageStateKey]: currentRetryCount + 1 };
                    carouselImageRetryMapRef.current = nextMap;
                    return nextMap;
                });

                resolve(false);
            };

            image.src = imageSrc;

            if (image.complete) {
                if (typeof image.decode === 'function') {
                    image.decode().catch(() => undefined).finally(resolveLoaded);
                    return;
                }
                resolveLoaded();
            }
        });

        carouselImagePreloadPromiseRef.current.set(preloadTaskKey, preloadPromise);
        return preloadPromise;
    }, [buildCarouselImageSrc, getCarouselImageStateKey, isDesktopCarousel, markCarouselImageLoaded]);

    const waitForCarouselImageReady = useCallback(async (item: CarouselItem) => {
        if (isDesktopCarousel) {
            return true;
        }

        const imageStateKey = getCarouselImageStateKey(item);
        if (carouselImageLoadedMapRef.current[imageStateKey]) {
            return true;
        }

        const firstAttemptReady = await preloadCarouselImage(item);
        if (firstAttemptReady) {
            return true;
        }

        // 实现移动端目标图片就绪后再切换
        return preloadCarouselImage(item);
    }, [getCarouselImageStateKey, isDesktopCarousel, preloadCarouselImage]);

    // 监听用户登出，重置检查状态
    useEffect(() => {
        if (!user?.user?.id) {
            hasCheckedInSessionRef.current = false;
            setShowCheckInModal(false);
            sessionStorage.removeItem('checkInModalChecked');
        }
    }, [user?.user?.id]);

    const checkShouldShowCheckInModal = useCallback(async (): Promise<boolean> => {
        try {
            const response = await auth.getSignInStatus();
            if (response.data.success && response.data.data) {
                const signedInToday = response.data.data.signedInToday;
                updateUser({ hasSignedIn: signedInToday });
                return !signedInToday;
            }
        } catch (error) {
            console.error('获取签到状态失败:', error);
        }

        return !(user?.user?.hasSignedIn ?? false);
    }, [updateUser, user?.user?.hasSignedIn]);

    // 首登弹窗：加入用户群（仅首次登录显示一次）
    // useEffect(() => {
    //     const uid = user?.user?.id;
    //     if (!uid) return;

    //     const localKey = 'joinGroupModalShown_' + uid;
    //     const sessionKey = 'joinGroupModalWillShow_' + uid;

    //     const hasShown = localStorage.getItem(localKey) === 'true';
    //     const alreadyPlanned = sessionStorage.getItem(sessionKey) === 'true';

    //     if (!hasShown && !alreadyPlanned) {
    //         sessionStorage.setItem(sessionKey, 'true'); // 通知其他 effect：本次先显示加群弹窗
    //         setShowJoinGroupModal(true);
    //     }
    // }, [user?.user?.id]);
    // 用户登录时，检查是否显示签到弹窗
    useEffect(() => {
        if (!user?.user?.id || hasCheckedInSessionRef.current || user?.user?.hasSignedIn) {
            return;
        }

        // 如果用户已经显示过签到弹窗，则不显示
        const joinSessionKey = 'joinGroupModalWillShow_' + (user?.user?.id || '');
        if (sessionStorage.getItem(joinSessionKey) === 'true') {
            return;
        }

        const sessionKey = 'checkInModalChecked';
        const hasCheckedInSession = sessionStorage.getItem(sessionKey);

        if (!hasCheckedInSession) {
            sessionStorage.setItem(sessionKey, 'true');
            hasCheckedInSessionRef.current = true;
            void (async () => {
                const shouldShowCheckInModal = await checkShouldShowCheckInModal();
                if (shouldShowCheckInModal) {
                    setShowCheckInModal(true);
                }
            })();
        }
    }, [checkShouldShowCheckInModal, user?.user?.id]);


    // 加载限时优惠数据
    const loadSpecialGames = useCallback(async (page: number, isInitial = false, retryCount = 0) => {
        const MAX_RETRIES = 1;
        const RETRY_DELAY = 1000;
        const PAGE_SIZE = 10;
        const offset = page * PAGE_SIZE;

        if (isInitial) {
            setIsLoadingSpecial(true);
        } else {
            if (isLoadingMoreSpecialRef.current) {
                return;
            }
            isLoadingMoreSpecialRef.current = true;
            setIsLoadingMoreSpecial(true);
        }

        try {
            const response = await libraryDataApi.getGameData('with-discount', {
                limit: String(PAGE_SIZE),
                offset: String(offset)
            });

            if (response.data.success && response.data.data) {
                const newGames = response.data.data;
                if (isInitial) {
                    setFileMetas(newGames);
                } else {
                    setFileMetas(prev => [...prev, ...newGames]);
                }
                
                setHasMoreSpecial(newGames.length === PAGE_SIZE);
                if (newGames.length > 0) {
                    setSpecialPage(page + 1); // 设置限时优惠分页
                }
            } else {
                throw new Error('获取限时优惠游戏列表失败');
            }
        } catch (error) {
            console.error('获取限时优惠游戏列表失败:', error);
            if (retryCount < MAX_RETRIES) {
                setTimeout(() => {
                    loadSpecialGames(page, isInitial, retryCount + 1);
                }, RETRY_DELAY);
            } else if (isInitial) {
                setFileMetas([]);
            }
        } finally {
            setIsLoadingSpecial(false);
            setIsLoadingMoreSpecial(false);
            isLoadingMoreSpecialRef.current = false;
        }

        return [];
    }, []);

    // 加载全部游戏数据
    const loadAllGames = useCallback(async (
        page: number,
        filters: HomeListFilters,
        isInitial = false,
    ) => {
        const pageSize = 10;
        const offset = page * pageSize;
        const requestId = ++latestAllGamesRequestIdRef.current;

        if (isInitial) {
            setIsLoadingAll(true);
        } else {
            if (isLoadingMoreAllRef.current) {
                return [];
            }
            isLoadingMoreAllRef.current = true;
            setIsLoadingMoreAll(true);
        }

        try {
            const response = await libraryDataApi.getGameData('no-discount', {
                limit: String(pageSize),
                offset: String(offset),
                mode: filters.mode,
                sort: filters.sort,
                tagId: filters.tagId ? String(filters.tagId) : 'all',
            });

            if (requestId !== latestAllGamesRequestIdRef.current) {
                return [];
            }

            if (response.data.success && response.data.data) {
                const nextGames = response.data.data;
                if (isInitial) {
                    setAllGames(nextGames);
                } else {
                    setAllGames((prev) => {
                        const uniqueGames = new Map<string, UserGameData>();
                        [...prev, ...nextGames].forEach((game, index) => {
                            uniqueGames.set(getGameUniqueKey(game, index), game);
                        });
                        return Array.from(uniqueGames.values());
                    });
                }
                
                // 如果返回的游戏数量等于PAGE_SIZE，则设置为有更多
                setHasMoreAll(nextGames.length === pageSize);
                setAllPage(nextGames.length > 0 ? page + 1 : page);
                return nextGames;
            } else {
                throw new Error('获取全部游戏列表失败');
            }
        } catch (error) {
            if (requestId !== latestAllGamesRequestIdRef.current) {
                return [];
            }

            console.error('获取首页全部游戏列表失败:', error);
            if (isInitial) {
                setAllGames([]);
            }
            setHasMoreAll(false);
        } finally {
            if (requestId === latestAllGamesRequestIdRef.current) {
                setIsLoadingAll(false);
                setIsLoadingMoreAll(false);
                isLoadingMoreAllRef.current = false;
            }
        }

        return [];
    }, []);

    const loadCarouselData = useCallback(async () => {
        try {
            const bannerResponse = await bannerApi.getLatest();
            const bannerItems = bannerResponse.data.data?.banners || [];
            if (bannerResponse.data.success && bannerItems.length > 0) {
                // 实现加载首页轮播图
                setCarouselItems(bannerItems);
                return;
            }
        } catch (error) {
            console.error('加载首页轮播图失败:', error);
        }

        try {
            const response = await libraryDataApi.getCarouselData();
            if (response.data.success && response.data.data) {
                // 实现加载首页轮播图
                setCarouselItems(response.data.data);
                return;
            }
        } catch (error) {
            console.error('加载首页轮播图失败:', error);
        }

        setCarouselItems([]);
    }, []);

    const loadLatestAnnouncement = useCallback(async () => {
        try {
            const response = await announcementApi.getLatest();
            if (response.data.success) {
                setLatestAnnouncement(response.data.data);
            }
        } catch (error) {
            console.error('加载最新公告失败:', error);
        }
    }, []);

    const loadHomeTicker = useCallback(async () => {
        try {
            const response = await promotionApi.getHomeTicker();
            if (response.data.success) {
                // 实现首页滚动通知读取
                setHomeTicker(response.data.data);
            }
        } catch (error) {
            console.error('加载首页滚动通知失败:', error);
        }
    }, []);

    const loadFeaturedThemeTags = useCallback(async (): Promise<FlatThemeTag[]> => {
        try {
            const response = await gameTagsApi.getFeaturedGameTags();
            if (response.data.success) {
                // 实现首页热门题材读取后台配置
                return (response.data.data || []).map((tag) => ({
                    id: Number(tag.id),
                    name: String(tag.name || ''),
                    parentName: String(tag.parent_name || ''),
                })).filter((tag) => Number.isFinite(tag.id) && tag.id > 0 && tag.name);
            }
        } catch (error) {
            console.error('加载首页热门题材失败:', error);
        }
        return [];
    }, []);

    // 加载全部题材标签
    const loadAllThemeTags = useCallback(async (): Promise<FlatThemeTag[]> => {
        try {
            const response = await gameTagsApi.getGameTagsTree();
            if (response.data.success) {
                return flattenThemeTags(response.data.data || []);
            }
        } catch (error) {
            console.error('加载首页作品标签失败:', error);
        }
        return [];
    }, []);

    const loadSpecialThemeTags = useCallback(async (): Promise<SpecialThemeTagRecord[]> => {
        try {
            const response = await specialThemeTagsApi.getPublicTags();
            if (response.data.success) {
                // 实现加载首页特殊标签
                return (response.data.data || []).filter((tag) => Number(tag.id) > 0 && String(tag.name || '').trim());
            }
        } catch (error) {
            console.error('加载首页特殊标签失败:', error);
        }
        return [];
    }, []);

    const loadHomeShowcaseTags = useCallback(async () => {
        setHasLoadedHomeShowcaseTags(false);
        /*

        // 实现首页展示标签并发初始化
        const [featuredResult, specialResult] = await Promise.allSettled([
        // 实现首页展示标签并发初始化
        const [featuredResult, specialResult] = await Promise.allSettled([
        const [featuredResult, specialResult] = await Promise.allSettled([ // 实现首页展示标签并发初始化
            loadThemeTags(),
            loadThemeTags(),
            loadSpecialThemeTags(),
        ]);

        */
        const [featuredResult, specialResult] = await Promise.allSettled([
            loadFeaturedThemeTags(),
            loadSpecialThemeTags(),
        ]);

        let nextFeaturedThemeTags: FlatThemeTag[] = [];
        let nextSpecialThemeTags: SpecialThemeTagRecord[] = [];

        if (featuredResult.status === 'fulfilled') {
            nextFeaturedThemeTags = featuredResult.value;
        } else {
            console.error('加载首页热门题材失败:', featuredResult.reason);
        }

        if (specialResult.status === 'fulfilled') {
            nextSpecialThemeTags = specialResult.value;
        } else {
            console.error('加载首页特殊标签失败:', specialResult.reason);
        }

        setFeaturedThemeTags(nextFeaturedThemeTags);
        setSpecialThemeTags(nextSpecialThemeTags);
        setHasLoadedHomeShowcaseTags(true);
    }, [loadFeaturedThemeTags, loadSpecialThemeTags]);

    const loadShowcaseGames = useCallback(async (showcaseTag: HomeShowcaseTag) => {
        if (!showcaseTag) return;
        if (Object.prototype.hasOwnProperty.call(showcaseGamesCache, showcaseTag.key)) return;

        setShowcaseLoadingKey(showcaseTag.key);

        try {
            let games: UserGameData[] = [];
        if (showcaseTag.kind === 'special') {
            const response = await specialThemeTagsApi.getPublicTagGames(showcaseTag.id, 12);
            if (response.data.success) {
                // 实现加载普通热门题材剧本预览
                games = response.data.data || [];
            }
        } else {
                const response = await libraryDataApi.getGameData('no-discount', {
                    limit: '12',
                    offset: '0',
                    mode: 'all',
                    sort: 'hot',
                    tagId: String(showcaseTag.id),
                });
                if (response.data.success) {
                    // 实现普通热门题材剧本预览读取
                    games = response.data.data || [];
                }
                if (response.data.success) {
                    // 实现普通热门题材剧本预览读取
                    games = response.data.data || [];
                }
            }

            setShowcaseGamesCache((prev) => ({
                ...prev,
                [showcaseTag.key]: games.slice(0, 12),
            }));
        } catch (error) {
            console.error('加载首页题材预览失败:', error);
            setShowcaseGamesCache((prev) => ({
                ...prev,
                [showcaseTag.key]: [],
            }));
        } finally {
            setShowcaseLoadingKey((prev) => (prev === showcaseTag.key ? null : prev));
        }
    }, [showcaseGamesCache]);

    const updateAllGamesFilters = useCallback((updater: (prev: HomeListFilters) => HomeListFilters) => {
        setAllGamesFilters((prev) => {
            const next = updater(prev);
            return getHomeListFilterKey(prev) === getHomeListFilterKey(next) ? prev : next;
        });
    }, []);
    const loadLibraryData = useCallback(() => undefined, []);

    // 鍔犺浇鏇村闄愭椂浼樻儬
    const loadMoreSpecial = useCallback(() => {
        if (!isLoadingMoreSpecialRef.current && !isLoadingMoreSpecial && hasMoreSpecial) {
            loadSpecialGames(specialPage, false);
        }
    }, [isLoadingMoreSpecial, hasMoreSpecial, specialPage, loadSpecialGames]);

    // 鍔犺浇鏇村鍏ㄩ儴娓告垙
    const loadMoreAll = useCallback(() => {
        if (!isLoadingAll && !isLoadingMoreAllRef.current && !isLoadingMoreAll && hasMoreAll) {
            void loadAllGames(allPage, allGamesFilters, false);
        }
    }, [allGamesFilters, allPage, hasMoreAll, isLoadingAll, isLoadingMoreAll, loadAllGames]);

    // 鍔犺浇杞挱鍥炬暟鎹紙鏃犺鏄惁鐧诲綍閮藉姞杞斤級
    useEffect(() => {
        loadCarouselData();
    }, [loadCarouselData]);

    useEffect(() => {
        loadLatestAnnouncement();
    }, [loadLatestAnnouncement]);

    useEffect(() => {
        loadHomeTicker();
    }, [loadHomeTicker]);

    useEffect(() => {
        void loadHomeShowcaseTags();
    }, [loadHomeShowcaseTags]);

    useEffect(() => {
        let cancelled = false;

        const syncAllThemeTags = async () => {
            const tags = await loadAllThemeTags();
            if (!cancelled) {
                setAllThemeTags(tags);
            }
        };

        void syncAllThemeTags();

        return () => {
            cancelled = true;
        };
    }, [loadAllThemeTags]);

    /*

    useEffect(() => {
        if (!hasLoadedHomeShowcaseTags) return;

        if (homeShowcaseTags.length === 0) {
            setActiveShowcaseTagKey(null);
            setActiveShowcaseTagKey(homeShowcaseTags[0].key);
            // * /
            setActiveShowcaseTagKey(homeShowcaseTags[0].key);
            hasInitializedShowcaseDefaultRef.current = true;
            return;
        }

        if (!hasInitializedShowcaseDefaultRef.current) {
            /*
            // 实现首页默认标签初始化锁定
            hasInitializedShowcaseDefaultRef.current = true;
            // 实现首页默认标签初始化锁定
            hasInitializedShowcaseDefaultRef.current = true;
            setActiveShowcaseTagKey(homeShowcaseTags[0].key);
            hasInitializedShowcaseDefaultRef.current = true; // 实现首页默认标签初始化锁定
            setActiveShowcaseTagKey(homeShowcaseTags[0].key);
            return;
        }

        setActiveShowcaseTagKey((prev) => (
            prev && homeShowcaseTags.some((tag) => tag.key === prev)
                ? prev
                : homeShowcaseTags[0].key
        ));
    }, [hasLoadedHomeShowcaseTags, homeShowcaseTags]);

    */

    useEffect(() => {
        if (!hasLoadedHomeShowcaseTags) return;

        if (homeShowcaseTags.length === 0) {
            setActiveShowcaseTagKey(null);
            return;
        }

        if (!hasInitializedShowcaseDefaultRef.current) {
            setActiveShowcaseTagKey(homeShowcaseTags[0].key);
            hasInitializedShowcaseDefaultRef.current = true;
            return;
        }

        setActiveShowcaseTagKey((prev) => (
            prev && homeShowcaseTags.some((tag) => tag.key === prev)
                ? prev
                : homeShowcaseTags[0].key
        ));
    }, [hasLoadedHomeShowcaseTags, homeShowcaseTags]);

    useEffect(() => {
        if (!activeShowcaseTag) return;
        void loadShowcaseGames(activeShowcaseTag);
    }, [activeShowcaseTag, loadShowcaseGames]);

    const measureTickerOverflow = useCallback(() => {
        const tickerText = homeTicker?.text?.trim();
        const viewportElement = homeTickerViewportRef.current;
        const textElement = homeTickerMeasureTextRef.current;

        if (!tickerText || !viewportElement || !textElement) {
            setIsTickerOverflowing(false);
            return;
        }

        // 实现首页滚动通知溢出判断
        const viewportWidth = Math.ceil(viewportElement.clientWidth);
        const textWidth = Math.ceil(textElement.scrollWidth);
        const nextOverflowing = textWidth > viewportWidth + 1;

        setIsTickerOverflowing((prev) => (prev === nextOverflowing ? prev : nextOverflowing));
    }, [homeTicker?.text]);

    useEffect(() => {
        if (!homeTicker?.text?.trim()) {
            setIsTickerOverflowing(false);
            return;
        }

        let animationFrameId: number | null = null;
        const requestMeasure = () => {
            if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
            }

            animationFrameId = window.requestAnimationFrame(() => {
                measureTickerOverflow();
                animationFrameId = null;
            });
        };

        requestMeasure();

        const viewportElement = homeTickerViewportRef.current;
        const textElement = homeTickerMeasureTextRef.current;

        if (document.fonts?.ready) {
            document.fonts.ready.then(() => {
                requestMeasure();
            }).catch(() => undefined);
        }

        if (typeof ResizeObserver === 'function' && viewportElement && textElement) {
            const resizeObserver = new ResizeObserver(() => {
                requestMeasure();
            });

            resizeObserver.observe(viewportElement);
            resizeObserver.observe(textElement);

            return () => {
                if (animationFrameId !== null) {
                    window.cancelAnimationFrame(animationFrameId);
                }
                resizeObserver.disconnect();
            };
        }

        window.addEventListener('resize', requestMeasure);

        return () => {
            if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
            }
            window.removeEventListener('resize', requestMeasure);
        };
    }, [homeTicker?.text, isTickerOverflowing, measureTickerOverflow]);

    // 浣跨敤 libraryDataApi 鑾峰彇娓告垙鍒楄〃鏁版嵁锛堟棤璁烘槸鍚︾櫥褰曢兘鍔犺浇锛?
    useEffect(() => {
        const currentUserId = user?.user?.id;
        // 濡傛灉鐢ㄦ埛ID鍙戠敓鍙樺寲锛屾垨鑰呴娆″姞杞?
        if (currentUserId !== lastUserIdRef.current || !hasInitializedRef.current) {
            lastUserIdRef.current = currentUserId;
            hasInitializedRef.current = true;
            isLoadingRef.current = false;
            loadLibraryData();
        }
    }, [user?.user?.id, loadLibraryData]);

    useEffect(() => {
        isLoadingMoreSpecialRef.current = false;
        setSpecialPage(0);
        setHasMoreSpecial(true);
        void loadSpecialGames(0, true);
    }, [loadSpecialGames, user?.user?.id]);

    useEffect(() => {
        latestAllGamesRequestIdRef.current += 1;
        isLoadingMoreAllRef.current = false;
        setIsLoadingMoreAll(false);
        setAllGames([]);
        setAllPage(0);
        setHasMoreAll(true);
        void loadAllGames(0, allGamesFilters, true);
    }, [allGamesFilterKey, loadAllGames, user?.user?.id]);

    useEffect(() => {
        if (!latestAnnouncement?.id) {
            setShowAnnouncementModal(false);
            return;
        }

        // 鎺у埗鍚屼竴鏉″叕鍛婂湪褰撳墠浼氳瘽鍙脊鍑轰竴娆?
        const dismissKey = `announcementDismissed_${latestAnnouncement.id}`;
        const dismissedInSession = sessionStorage.getItem(dismissKey) === 'true';

        if (dismissedInSession || showJoinGroupModal || showCheckInModal) {
            if (dismissedInSession) {
                setShowAnnouncementModal(false);
            }
            return;
        }

        setShowAnnouncementModal(true);
    }, [latestAnnouncement?.id, showJoinGroupModal, showCheckInModal]);

    // 实现登录后继续处理通知跳转
    useEffect(() => {
        if (!isAuthenticated || !pendingTickerLink) {
            return;
        }

        const targetLink = pendingTickerLink;
        pendingTickerAuthRef.current = false;
        setPendingTickerLink(null);
        // 实现登录成功后继续跳转
        navigateToHomeTickerLinkRef.current(targetLink, false);
    }, [isAuthenticated, pendingTickerLink]);

    useEffect(() => {
        if (!pendingTickerAuthRef.current) {
            return;
        }

        if (!isAuthModalOpen && !isAuthenticated) {
            pendingTickerAuthRef.current = false;
            setPendingTickerLink(null);
        }
    }, [isAuthModalOpen, isAuthenticated]);

    useEffect(() => {
        if (!loadMoreTriggerRef.current) return;

        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting) {
                    // 浣跨敤 ref 妫€鏌ワ紝閬垮厤闂寘闂瀵艰嚧鐨勯噸澶嶈姹?
                    if (hasMoreAll && !isLoadingMoreAllRef.current && !isLoadingMoreAll) {
                        loadMoreAll();
                    } else if (hasMoreSpecial && !isLoadingMoreSpecialRef.current && !isLoadingMoreSpecial) {
                        loadMoreSpecial();
                    }
                }
            },
            {
                root: null,
                rootMargin: '200px',
                threshold: 0.1
            }
        );

        observerRef.current.observe(loadMoreTriggerRef.current);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [hasMoreAll, hasMoreSpecial, isLoadingMoreAll, isLoadingMoreSpecial, loadMoreAll, loadMoreSpecial]);


    // 鑷姩杞挱
    const clearCarouselInterval = useCallback(() => {
        if (carouselIntervalRef.current) {
            clearInterval(carouselIntervalRef.current);
            carouselIntervalRef.current = null;
        }
    }, []);

    const restartCarouselAutoPlay = useCallback(() => {
        clearCarouselInterval();
        if (!hasMultipleCarouselItems) return;

        carouselIntervalRef.current = setInterval(() => {
            if (isDesktopCarousel) {
                // 实现自动播放切换
                setIsTransitionEnabled(true);
                setDesktopCurrentSlide((prev) => getLoopCarouselIndex(prev + 1, carouselItems.length));
                return;
            }

            // 实现移动端待执行切换
            clearCarouselInterval();
            requestCarouselNavActionRef.current({ type: 'next' });
        }, CAROUSEL_AUTOPLAY_INTERVAL);
    }, [carouselItems.length, clearCarouselInterval, hasMultipleCarouselItems, isDesktopCarousel]);

    useEffect(() => {
        if (hasMultipleCarouselItems) {
            setIsTransitionEnabled(true);
            setCurrentSlide(1);
            setDesktopCurrentSlide(0);
        } else {
            setIsTransitionEnabled(true);
            setCurrentSlide(0);
            setDesktopCurrentSlide(0);
        }
        isCarouselResettingRef.current = false;
        isMobileCarouselTransitioningRef.current = false;
        pendingCarouselNavRef.current = null;
        pendingMobileCarouselNavRef.current = null;
        queuedMobileCarouselActionRef.current = null;
        mobileCarouselNavTokenRef.current = 0;
        carouselImagePreloadRef.current.clear();
        carouselImagePreloadPromiseRef.current.clear();
        setCarouselImageRetryMap({});
        setCarouselImageLoadedMap({});
        carouselImageRetryMapRef.current = {};
        carouselImageLoadedMapRef.current = {};
    }, [hasMultipleCarouselItems, carouselItems.length]);

    useEffect(() => {
        if (isDesktopCarousel || carouselItems.length === 0) {
            return;
        }

        // 实现移动端相邻图片预热
        const targetIndexes = hasMultipleCarouselItems
            ? [currentLogicalSlide, currentLogicalSlide - 1, currentLogicalSlide + 1]
            : [0];
        const uniqueIndexes = [...new Set(
            targetIndexes.map((index) => getLoopCarouselIndex(index, carouselItems.length)),
        )];

        uniqueIndexes.forEach((index) => {
            const item = carouselItems[index];
            if (item) {
                preloadCarouselImage(item);
            }
        });
    }, [carouselItems, currentLogicalSlide, hasMultipleCarouselItems, isDesktopCarousel, preloadCarouselImage]);

    const getMobileCarouselTargetIndex = useCallback((action: CarouselNavAction) => {
        if (carouselItems.length <= 1) {
            return 0;
        }

        if (action.type === 'slide') {
            return getLoopCarouselIndex(action.logicalIndex, carouselItems.length);
        }

        if (action.type === 'prev') {
            return getLoopCarouselIndex(currentLogicalSlide - 1, carouselItems.length);
        }

        return getLoopCarouselIndex(currentLogicalSlide + 1, carouselItems.length);
    }, [carouselItems.length, currentLogicalSlide]);

    useEffect(() => {
        const wasDesktopCarousel = wasDesktopCarouselRef.current;
        if (wasDesktopCarousel === isDesktopCarousel) {
            return;
        }

        isMobileCarouselTransitioningRef.current = false;
        pendingCarouselNavRef.current = null;
        pendingMobileCarouselNavRef.current = null;
        queuedMobileCarouselActionRef.current = null;
        mobileCarouselNavTokenRef.current = 0;

        if (isDesktopCarousel) {
            setDesktopCurrentSlide(hasMultipleCarouselItems ? currentLogicalSlide : 0);
        } else {
            setCurrentSlide(hasMultipleCarouselItems ? desktopCurrentSlide + 1 : 0);
        }

        wasDesktopCarouselRef.current = isDesktopCarousel;
    }, [currentLogicalSlide, desktopCurrentSlide, hasMultipleCarouselItems, isDesktopCarousel]);

    // autoplay
    useEffect(() => {
        restartCarouselAutoPlay();
        return () => {
            clearCarouselInterval();
        };
    }, [restartCarouselAutoPlay, clearCarouselInterval]);

    const handleCarouselResume = useCallback(() => {
        // 实现页面恢复后继续轮播，不强制刷新图片
        isMobileCarouselTransitioningRef.current = false;
        pendingCarouselNavRef.current = null;
        pendingMobileCarouselNavRef.current = null;
        queuedMobileCarouselActionRef.current = null;
        mobileCarouselNavTokenRef.current += 1;
        setIsTransitionEnabled(true);
        if (isDesktopCarousel) {
            setDesktopCurrentSlide((prev) => getLoopCarouselIndex(prev, carouselItems.length));
        } else {
            setCurrentSlide((prev) => getCarouselSlidePosition(prev, carouselItems.length));
        }
        restartCarouselAutoPlay();
    }, [carouselItems.length, getCarouselSlidePosition, isDesktopCarousel, restartCarouselAutoPlay]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // 实现 页面隐藏时暂停自动播放
                clearCarouselInterval();
                return;
            }

            handleCarouselResume();
        };

        const handlePageShow = () => {
            handleCarouselResume();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pageshow', handlePageShow);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pageshow', handlePageShow);
        };
    }, [clearCarouselInterval, handleCarouselResume]);

    const preloadMobileCarouselActionTarget = useCallback((action: CarouselNavAction) => {
        if (isDesktopCarousel || carouselItems.length === 0) {
            return;
        }

        const targetLogicalIndex = getMobileCarouselTargetIndex(action);
        const targetItem = carouselItems[targetLogicalIndex];
        if (!targetItem) {
            return;
        }

        // 实现目标图片预热
        void waitForCarouselImageReady(targetItem);
    }, [carouselItems, getMobileCarouselTargetIndex, isDesktopCarousel, waitForCarouselImageReady]);

    const queueLatestMobileCarouselAction = useCallback((action: CarouselNavAction) => {
        pendingMobileCarouselNavRef.current = null;
        mobileCarouselNavTokenRef.current += 1;
        // 缓存最后一次滑动
        queuedMobileCarouselActionRef.current = action;
        preloadMobileCarouselActionTarget(action);
    }, [preloadMobileCarouselActionTarget]);

    const flushQueuedMobileCarouselAction = useCallback(() => {
        const queuedAction = queuedMobileCarouselActionRef.current;
        const pendingAction = pendingCarouselNavRef.current;
        queuedMobileCarouselActionRef.current = null;
        pendingCarouselNavRef.current = null;

        const nextAction = queuedAction ?? pendingAction;
        if (nextAction) {
            // 实现边界复位后继续执行
            requestCarouselNavActionRef.current(nextAction);
        }
    }, []);

    const performCarouselNavAction = useCallback((action: CarouselNavAction) => {
        if (!hasMultipleCarouselItems) {
            setCurrentSlide(0);
            setDesktopCurrentSlide(0);
            return;
        }

        setIsTransitionEnabled(true);

        if (isDesktopCarousel) {
            if (action.type === 'slide') {
                setDesktopCurrentSlide(getLoopCarouselIndex(action.logicalIndex, carouselItems.length));
            } else if (action.type === 'prev') {
                setDesktopCurrentSlide((prev) => getLoopCarouselIndex(prev - 1, carouselItems.length));
            } else {
                setDesktopCurrentSlide((prev) => getLoopCarouselIndex(prev + 1, carouselItems.length));
            }

            // 实现手动切换后重置自动播放
            restartCarouselAutoPlay();
            return;
        }

        const maxMobileSlide = carouselItems.length + 1;
        let nextSlide = currentSlide;

        if (action.type === 'slide') {
            const safeIndex = ((action.logicalIndex % carouselItems.length) + carouselItems.length) % carouselItems.length;
            nextSlide = safeIndex + 1;
        } else if (action.type === 'prev') {
            nextSlide = Math.max(0, currentSlide - 1);
        } else {
            nextSlide = Math.min(maxMobileSlide, currentSlide + 1);
        }

        if (nextSlide !== currentSlide) {
            // 实现移动端过渡锁
            isMobileCarouselTransitioningRef.current = true;
            setCurrentSlide(nextSlide);
        }

        restartCarouselAutoPlay();
    }, [carouselItems.length, currentSlide, hasMultipleCarouselItems, isDesktopCarousel, restartCarouselAutoPlay]);

    const queueMobileCarouselNavAction = useCallback((action: CarouselNavAction) => {
        if (carouselItems.length === 0) {
            restartCarouselAutoPlay();
            return;
        }

        pendingMobileCarouselNavRef.current = null;
        mobileCarouselNavTokenRef.current += 1;

        const targetLogicalIndex = getMobileCarouselTargetIndex(action);
        const targetItem = carouselItems[targetLogicalIndex];
        if (!targetItem) {
            restartCarouselAutoPlay();
            return;
        }

        // 实现移动端待执行切换
        const imageStateKey = getCarouselImageStateKey(targetItem);
        if (carouselImageLoadedMapRef.current[imageStateKey]) {
            if (isCarouselResettingRef.current || isMobileCarouselTransitioningRef.current) {
                queueLatestMobileCarouselAction(action);
                return;
            }

            performCarouselNavAction(action);
            return;
        }

        const token = mobileCarouselNavTokenRef.current;
        pendingMobileCarouselNavRef.current = { token, action };

        void waitForCarouselImageReady(targetItem).then((isReady) => {
            const pendingMobileAction = pendingMobileCarouselNavRef.current;
            if (!pendingMobileAction || pendingMobileAction.token !== token) {
                return;
            }

            pendingMobileCarouselNavRef.current = null;

            if (!isReady) {
                restartCarouselAutoPlay();
                return;
            }

            if (isCarouselResettingRef.current || isMobileCarouselTransitioningRef.current) {
                queueLatestMobileCarouselAction(action);
                return;
            }

            // 实现移动端目标图片就绪后再切换
            performCarouselNavAction(action);
        });
    }, [carouselItems, getCarouselImageStateKey, getMobileCarouselTargetIndex, performCarouselNavAction, queueLatestMobileCarouselAction, restartCarouselAutoPlay, waitForCarouselImageReady]);

    const requestCarouselNavAction = useCallback((action: CarouselNavAction) => {
        if (!hasMultipleCarouselItems) {
            setCurrentSlide(0);
            setDesktopCurrentSlide(0);
            return;
        }

        if (isDesktopCarousel) {
            performCarouselNavAction(action);
            return;
        }

        clearCarouselInterval();

        if (isCarouselResettingRef.current || isMobileCarouselTransitioningRef.current) {
            // 缓存过渡阶段最后一次滑动
            queueLatestMobileCarouselAction(action);
            return;
        }

        queueMobileCarouselNavAction(action);
    }, [clearCarouselInterval, hasMultipleCarouselItems, isDesktopCarousel, performCarouselNavAction, queueLatestMobileCarouselAction, queueMobileCarouselNavAction]);
    requestCarouselNavActionRef.current = requestCarouselNavAction;

    const restoreCarouselAfterReset = useCallback((targetSlide: number) => {
        isCarouselResettingRef.current = true;

        flushSync(() => {
            setIsTransitionEnabled(false);
            setCurrentSlide(targetSlide);
        });

        // 实现轮播边界无感复位
        void carouselTrackRef.current?.offsetHeight;

        flushSync(() => {
            setIsTransitionEnabled(true);
        });

        isCarouselResettingRef.current = false;
        isMobileCarouselTransitioningRef.current = false;
        flushQueuedMobileCarouselAction();
    }, [flushQueuedMobileCarouselAction]);

    // manual switching
    const goToSlide = (logicalIndex: number) => {
        requestCarouselNavAction({ type: 'slide', logicalIndex });
    };

    const goToPrevSlide = () => {
        requestCarouselNavAction({ type: 'prev' });
    };

    const goToNextSlide = () => {
        requestCarouselNavAction({ type: 'next' });
    };

    const handleCarouselTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
        if (!hasMultipleCarouselItems) return;
        if (isDesktopCarousel) return;
        if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
            // 只处理轮播轨道自身的位移动画结束
            return;
        }

        if (currentSlide === carouselItems.length + 1) {
            restoreCarouselAfterReset(1);
            return;
        }

        if (currentSlide === 0) {
            restoreCarouselAfterReset(carouselItems.length);
            return;
        }

        if (currentSlide < 0 || currentSlide > carouselItems.length + 1) {
            // 瀹炵幇 鎭㈠鍚庤疆鎾储寮曞厹搴?
            restoreCarouselAfterReset(getCarouselSlidePosition(currentSlide, carouselItems.length));
            return;
        }

        isMobileCarouselTransitioningRef.current = false;
        flushQueuedMobileCarouselAction();
    }, [carouselItems.length, currentSlide, flushQueuedMobileCarouselAction, getCarouselSlidePosition, hasMultipleCarouselItems, isDesktopCarousel, restoreCarouselAfterReset]);

    const handleCarouselTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchStartXRef.current = touch.clientX;
        touchStartYRef.current = touch.clientY;
        touchDeltaXRef.current = 0;
        touchDeltaYRef.current = 0;
        suppressBannerClickRef.current = false;
    };

    const handleCarouselTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (touchStartXRef.current === null || touchStartYRef.current === null || e.touches.length !== 1) {
            return;
        }
        const touch = e.touches[0];
        touchDeltaXRef.current = touch.clientX - touchStartXRef.current;
        touchDeltaYRef.current = touch.clientY - touchStartYRef.current;
    };

    const resetTouchState = () => {
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        touchDeltaXRef.current = 0;
        touchDeltaYRef.current = 0;
    };

    const handleCarouselTouchEnd = () => {
        const absX = Math.abs(touchDeltaXRef.current);
        const absY = Math.abs(touchDeltaYRef.current);
        const isValidSwipe = absX >= SWIPE_THRESHOLD && absX > absY;

        if (isValidSwipe && hasMultipleCarouselItems) {
            suppressBannerClickRef.current = true;
            if (suppressClickTimerRef.current) {
                clearTimeout(suppressClickTimerRef.current);
            }
            suppressClickTimerRef.current = setTimeout(() => {
                suppressBannerClickRef.current = false;
                suppressClickTimerRef.current = null;
            }, SWIPE_CLICK_SUPPRESS_MS);

            if (touchDeltaXRef.current > 0) {
                goToPrevSlide();
            } else {
                goToNextSlide();
            }
        }

        resetTouchState();
    };

    const navigateToGameDetail = (item: UserGameData) => {
        const gameId = item.file_id || item.id;
        if (!gameId) return;

        navigate(`/game/${gameId}`, {
            state: { source: 'main_page' },
        });
    };

    const navigateToBannerLink = (linkUrl: string) => {
        const safeLink = linkUrl.trim();
        if (!safeLink) return;

        openConfiguredLink(safeLink, {
            navigate,
            onExternalLinkCopy: requestCopy,
        });
    };

    const isProtectedPath = useCallback((linkUrl: string) => {
        const pathOnly = linkUrl.split('#')[0].split('?')[0];
        return PROTECTED_PATH_PREFIXES.some((prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`));
    }, []);

    const navigateToHomeTickerLink = useCallback((linkUrl: string, allowAuthPrompt = true) => {
        const safeLink = linkUrl.trim();
        if (!safeLink) return;

        if (safeLink.startsWith('http://') || safeLink.startsWith('https://')) {
            openConfiguredLink(safeLink, {
                navigate,
                onExternalLinkCopy: requestCopy,
            });
            return;
        }

        if (!safeLink.startsWith('/')) {
            return;
        }

        const pathOnly = safeLink.split('#')[0].split('?')[0];
        if (allowAuthPrompt && isProtectedPath(pathOnly) && !isAuthenticated) {
            pendingTickerAuthRef.current = true;
            setPendingTickerLink(safeLink);
            setIsAuthModalOpen(true);
            return;
        }

        navigate(safeLink);
    }, [isAuthenticated, isProtectedPath, navigate, requestCopy, setIsAuthModalOpen]);
    navigateToHomeTickerLinkRef.current = navigateToHomeTickerLink;

    const handleHomeTickerClick = useCallback(() => {
        if (!homeTicker?.linkUrl) return;
        navigateToHomeTickerLink(homeTicker.linkUrl);
    }, [homeTicker?.linkUrl, navigateToHomeTickerLink]);

    const handleCarouselItemClick = (item: CarouselItem) => {
        if (isBannerCarouselItem(item)) {
            navigateToBannerLink(item.link_url || '');
            return;
        }
        navigateToGameDetail(item);
    };

    const getCarouselItemId = (item: CarouselItem, index: number) => (
        isBannerCarouselItem(item)
            ? item.id || `banner-${index}`
            : item.file_id || item.id || `carousel-${index}`
    );

    const getCarouselItemImage = (item: CarouselItem) => (
        isBannerCarouselItem(item) ? item.image_url : item.cover_url
    );

    const isCarouselItemClickable = (item: CarouselItem) => (
        isBannerCarouselItem(item) ? Boolean(item.link_url?.trim()) : Boolean(item.file_id || item.id)
    );

    const handleCarouselImageLoad = useCallback((item: CarouselItem) => {
        const imageStateKey = getCarouselImageStateKey(item);
        markCarouselImageLoaded(imageStateKey);
    }, [getCarouselImageStateKey, markCarouselImageLoaded]);

    const handleCarouselImageError = useCallback((item: CarouselItem) => {
        const imageStateKey = getCarouselImageStateKey(item);

        setCarouselImageRetryMap((prev) => {
            const currentRetryCount = prev[imageStateKey] || 0;
            if (currentRetryCount >= 1) {
                return prev;
            }

            // 瀹炵幇 杞挱鍥惧浘鐗囧け璐ュ悗琛ヤ竴娆￠噸杞?
            const nextMap = {
                ...prev,
                [imageStateKey]: currentRetryCount + 1,
            };
            carouselImageRetryMapRef.current = nextMap;
            return nextMap;
        });
    }, [getCarouselImageStateKey]);

    const handleThemeClick = useCallback((tag: HomeShowcaseTag) => {
        // 实现首页标签切换时刷新横向预览区
        setActiveShowcaseTagKey(tag.key);
    }, []);

    const handleThemeShowcaseMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button !== 0 || !themeShowcaseRef.current) return;
        // 实现首页热门题材拖拽横滑
        themeShowcaseDragStateRef.current = {
            isDragging: true,
            startX: event.clientX,
            startScrollLeft: themeShowcaseRef.current.scrollLeft,
            moved: false,
        };
        setIsThemeShowcaseDragging(true);
    }, []);

    const handleThemeShowcaseMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!themeShowcaseDragStateRef.current.isDragging || !themeShowcaseRef.current) return;
        const deltaX = event.clientX - themeShowcaseDragStateRef.current.startX;
        if (Math.abs(deltaX) > 6) {
            themeShowcaseDragStateRef.current.moved = true;
        }
        themeShowcaseRef.current.scrollLeft = themeShowcaseDragStateRef.current.startScrollLeft - deltaX;
    }, []);

    const stopThemeShowcaseDragging = useCallback(() => {
        if (!themeShowcaseDragStateRef.current.isDragging) return;
        themeShowcaseDragStateRef.current.isDragging = false;
        window.setTimeout(() => {
            themeShowcaseDragStateRef.current.moved = false;
        }, 0);
        setIsThemeShowcaseDragging(false);
    }, []);

    const handleThemeShowcaseClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!themeShowcaseDragStateRef.current.moved) return;
        // 闃绘鎷栨嫿鏃惰瑙﹂鏉愯烦杞?
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const handleThemeShowcaseWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        if (!themeShowcaseRef.current || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

        // 实现标签条滚轮横向滚动
        themeShowcaseRef.current.scrollLeft += event.deltaY;
        event.preventDefault();
    }, []);

    const handleShowcaseMoreClick = useCallback(() => {
        if (!activeShowcaseTag) return;

        const searchParams = new URLSearchParams({
            mode: 'all',
            sort: 'latest',
            tagId: 'all',
        });

        if (activeShowcaseTag.kind === 'featured') {
            searchParams.set('sort', 'hot');
            searchParams.set('tagId', String(activeShowcaseTag.id));
        } else if (activeShowcaseTag.configMode === 'auto') {
            searchParams.set('sort', activeShowcaseTag.autoSort || 'hot');
        } else {
            searchParams.set('sort', 'recommended');
        }

        navigate(`/categories?${searchParams.toString()}`);
    }, [activeShowcaseTag, navigate]);

    const handleAllGamesSortChange = useCallback((sort: HomeListSort) => {
        updateAllGamesFilters((prev) => ({
            ...prev,
            sort,
        }));
    }, [updateAllGamesFilters]);

    const handleAllGamesModeChange = useCallback((mode: HomeListMode) => {
        updateAllGamesFilters((prev) => resolveHomeFiltersForNovelThemeConflict(prev, { mode }));
    }, [updateAllGamesFilters]);

    const handleAllGamesTagChange = useCallback((tagId: number | null) => {
        updateAllGamesFilters((prev) => resolveHomeFiltersForNovelThemeConflict(prev, { tagId }));
    }, [updateAllGamesFilters]);

    useEffect(() => {
        return () => {
            if (suppressClickTimerRef.current) {
                clearTimeout(suppressClickTimerRef.current);
            }
        };
    }, []);

    // 实现关闭加入群组弹窗
    const handleCloseJoinGroupModal = () => {
        setShowJoinGroupModal(false);
        const uid = user?.user?.id;
        if (!uid) return;
        const localKey = 'joinGroupModalShown_' + uid;
        localStorage.setItem(localKey, 'true');

        // 如果用户今天已经签到过，则不显示签到弹窗
        const today = new Date().toDateString();
        const checkInKey = 'checkIn_' + uid + '_' + today;
        const isCheckedIn = localStorage.getItem(checkInKey) === today;
        const checkInSessionKey = 'checkInModalChecked';
        const hasCheckInModalShownThisSession = sessionStorage.getItem(checkInSessionKey);
        if (!isCheckedIn && !hasCheckInModalShownThisSession) {
            sessionStorage.setItem(checkInSessionKey, 'true');
            void (async () => {
                const shouldShowCheckInModal = await checkShouldShowCheckInModal();
                if (shouldShowCheckInModal) {
                    setShowCheckInModal(true);
                }
            })();
        }
    };

    const handleHomeCheckInSuccess = useCallback(() => {
        updateUser({ hasSignedIn: true });
    }, [updateUser]);

    const handleCloseAnnouncementModal = () => {
        if (latestAnnouncement?.id) {
            sessionStorage.setItem(`announcementDismissed_${latestAnnouncement.id}`, 'true');
        }
        setShowAnnouncementModal(false);
    };

    const handleAnnouncementLinkNavigate = useCallback((path: string) => {
        if (latestAnnouncement?.id) {
            sessionStorage.setItem(`announcementDismissed_${latestAnnouncement.id}`, 'true');
        }
        setShowAnnouncementModal(false);
        navigateToHomeTickerLink(path);
    }, [latestAnnouncement?.id, navigateToHomeTickerLink]);

    const desktopCarouselStyle = isDesktopCarousel
        ? ({
            '--desktop-slide-width': `${desktopCarouselMetrics.slideWidth}px`,
            '--desktop-slide-gap': `${desktopCarouselMetrics.slideGap}px`,
        } as React.CSSProperties)
        : undefined;

    const carouselTrackStyle: React.CSSProperties = isDesktopCarousel
        ? {
            position: 'relative',
            width: '100%',
            height: '100%',
        }
        : {
            transform: `translate3d(-${currentSlide * 100}%, 0, 0)`,
        };

    return (
        <div className={styles.pageRoot}>
            {/* 椤堕儴鍥哄畾瀵艰埅 */}
            <Navbar mobileVariant="home-overlay" mobileOverlayScrolled={isMobileHomeNavbarScrolled} />

            {/* 涓讳綋 */}
            <div
                ref={mainContentRef}
                className={styles.mainContent}
                onScroll={handleMainContentScroll}
            >
                {/* 鍙充晶鍟嗗煄鍐呭 */}
                <div className={styles.main}>
                    <div ref={todayWrapRef} className={styles.todayWrap}>
                        <div
                            className={`${styles.carouselContainer} ${styles.carouselContainerPc}`}
                            style={desktopCarouselStyle}
                        >
                            {carouselItems.length > 0 ? (
                                <>
                                    <div
                                        ref={carouselViewportRef}
                                        className={`${styles.carouselWrapper} ${styles.carouselWrapperPc}`}
                                    >
                                        <div
                                            ref={carouselTrackRef}
                                            className={`${styles.carouselTrack} ${!isTransitionEnabled ? styles.carouselTrackNoTransition : ''}`}
                                            style={carouselTrackStyle}
                                            onTransitionEnd={isDesktopCarousel ? undefined : handleCarouselTransitionEnd}
                                            onTouchStart={handleCarouselTouchStart}
                                            onTouchMove={handleCarouselTouchMove}
                                            onTouchEnd={handleCarouselTouchEnd}
                                            onTouchCancel={resetTouchState}
                                        >
                                            {carouselRenderItems.map((item, idx) => {
                                                const imageId = getCarouselItemId(item, idx);
                                                const canClick = isCarouselItemClickable(item);
                                                const imageStateKey = getCarouselImageStateKey(item);
                                                const retryVersion = carouselImageRetryMap[imageStateKey] || 0;
                                                const isImageLoaded = Boolean(carouselImageLoadedMap[imageStateKey]);
                                                return (
                                                    <div
                                                        key={`${imageId}-${idx}`}
                                                        className={`${styles.carouselSlide} ${getCarouselSlideStateClass(idx)} ${canClick ? styles.carouselSlideClickable : ''}`}
                                                        style={getDesktopCarouselSlideStyle(idx)}
                                                        onClick={(event) => {
                                                            if (suppressBannerClickRef.current) {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                return;
                                                            }
                                                            handleCarouselItemClick(item);
                                                        }}
                                                    >
                                                        <div
                                                            className={`${styles.carouselImage} ${!isDesktopCarousel && isImageLoaded ? styles.carouselImageLoaded : ''}`}
                                                        >
                                                            <img
                                                                key={`${imageStateKey}-${retryVersion}`}
                                                                src={getCarouselImageSrc(item)}
                                                                alt={item.title}
                                                                loading="eager"
                                                                decoding="async"
                                                                onLoad={() => {
                                                                    handleCarouselImageLoad(item);
                                                                }}
                                                                onError={() => {
                                                                    handleCarouselImageError(item);
                                                                }}
                                                            />
                                                        </div>
                                                        <div className={styles.carouselContent}>
                                                            <div className={styles.carouselInfo}>
                                                                <h2 className={styles.carouselTitle}>{item.title}</h2>
                                                                <p className={styles.carouselDescription}>{item.description}</p>
                                                                {/* <button
                                                                    className={styles.carouselStartBtn}
                                                                    onClick={() =>
                                                                        navigateToGameDetail(item)
                                                                    }
                                                                >
                                                                    <img
                                                                        src={`${import.meta.env.BASE_URL}data/assets/home/寮€濮嬫父鎴?png`}
                                                                        alt="寮€濮嬫父鎴? />
                                                                </button> */}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {hasMultipleCarouselItems && (
                                        <>
                                            <button
                                                type="button"
                                                className={`${styles.carouselNavButton} ${styles.carouselNavButtonLeft}`}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    goToPrevSlide();
                                                }}
                                                aria-label={t('home.carousel.prev')}
                                            >
                                                <span className={styles.carouselNavIcon} aria-hidden="true">
                                                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M15 4L7 12L15 20" />
                                                    </svg>
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.carouselNavButton} ${styles.carouselNavButtonRight}`}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    goToNextSlide();
                                                }}
                                                aria-label={t('home.carousel.next')}
                                            >
                                                <span className={styles.carouselNavIcon} aria-hidden="true">
                                                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M9 4L17 12L9 20" />
                                                    </svg>
                                                </span>
                                            </button>
                                        </>
                                    )}
                                    {hasMultipleCarouselItems && (
                                        <div className={styles.carouselIndicators}>
                                            {carouselItems.map((_, index) => (
                                                <button
                                                    key={index}
                                                    className={`${styles.carouselIndicator} ${activeCarouselSlide === index ? styles.carouselIndicatorActive : ''}`}
                                                    onClick={() => goToSlide(index)}
                                                    aria-label={t('home.carousel.goTo', { index: index + 1 })}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className={styles.carouselEmpty} />
                            )}
                        </div>
                    </div>

                    <div className={styles.homeWideSections}>
                        {/* 实现移动端与 PC 共用热门题材展示 */}
                        {homeTicker?.text?.trim() ? (
                            <button
                                type="button"
                                className={styles.homeTicker}
                                onClick={handleHomeTickerClick}
                                aria-label={t('home.carousel.openTicker', { text: homeTicker.text })}
                            >
                                <span className={styles.homeTickerIcon} aria-hidden="true">
                                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 10V14H7L12 18V6L7 10H4Z" />
                                        <path d="M16 9C17.2 10.2 17.2 13.8 16 15" />
                                        <path d="M18.5 6.5C21 9 21 15 18.5 17.5" />
                                    </svg>
                                </span>
                                <span ref={homeTickerViewportRef} className={styles.homeTickerViewport}>
                                    {isTickerOverflowing ? (
                                        <span className={`${styles.homeTickerTrack} ${styles.homeTickerTrackScrolling}`}>
                                            <span className={styles.homeTickerGroup}>
                                                <span ref={homeTickerMeasureTextRef} className={styles.homeTickerText}>{homeTicker.text}</span>
                                                <span className={styles.homeTickerDot} aria-hidden="true" />
                                            </span>
                                            <span className={styles.homeTickerGroup} aria-hidden="true">
                                                <span className={styles.homeTickerText}>{homeTicker.text}</span>
                                                <span className={styles.homeTickerDot} aria-hidden="true" />
                                            </span>
                                        </span>
                                    ) : (
                                        <span
                                            ref={homeTickerMeasureTextRef}
                                            className={`${styles.homeTickerText} ${styles.homeTickerTextStatic}`}
                                        >
                                            {homeTicker.text}
                                        </span>
                                    )}
                                </span>
                                <span className={styles.homeTickerAction}>{t('home.view')}</span>
                            </button>
                        ) : null}

                        <div className={styles.themeShowcase}>{/*
                                <h3>{t('home.hotThemes')}</h3>
                                <button type="button" onClick={handleOpenCategories}>{t('home.viewAll')}</button>
                            </div>
                            */}<div
                                ref={themeShowcaseRef}
                                className={`${styles.themeShowcaseList} ${isThemeShowcaseDragging ? styles.themeShowcaseListDragging : ''}`}
                                onMouseDown={handleThemeShowcaseMouseDown}
                                onMouseMove={handleThemeShowcaseMouseMove}
                                onMouseUp={stopThemeShowcaseDragging}
                                onMouseLeave={stopThemeShowcaseDragging}
                                onClickCapture={handleThemeShowcaseClickCapture}
                                onWheel={handleThemeShowcaseWheel}
                            >
                                {homeShowcaseTags.map((tag) => (
                                    <button
                                        key={tag.key}
                                        type="button"
                                        className={`${styles.themeShowcaseItem} ${activeShowcaseTagKey === tag.key ? styles.themeShowcaseItemActive : ''}`}
                                        onClick={() => handleThemeClick(tag)}
                                    >
                                        {tag.code ? t(getShowcaseTagI18nCode(tag.code)!) || tag.name : tag.name}
                                    </button>
                                ))}
                            </div>
                            {homeShowcaseTags.length > 0 ? (
                                <div className={styles.themeShowcaseTitleRow}>
                                    <div className={styles.themeShowcaseTitleGroup}>
                                        <span className={styles.themeShowcaseTitleMarker} aria-hidden="true" />
                                        <h3 className={styles.themeShowcaseTitle}>
                                            {activeShowcaseTag?.code
                                                ? t(getShowcaseTagI18nCode(activeShowcaseTag.code)!) || activeShowcaseTag.name
                                                : activeShowcaseTag?.name || ''}
                                        </h3>
                                    </div>
                                    {activeShowcaseTag ? (
                                        <button
                                            type="button"
                                            aria-label={t('home.viewMore')}
                                            className={styles.themeShowcaseMoreLink}
                                            onClick={handleShowcaseMoreClick}
                                        >
                                            <span>{t('home.viewMore')}</span>
                                            <span className={styles.themeShowcaseMoreArrow} aria-hidden="true">›</span>
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                            <div className={styles.themeShowcasePreview}>
                                <HomeThemePreviewRail
                                    games={activeShowcaseGames}
                                    onMoreClick={handleShowcaseMoreClick}
                                    resetKey={themePreviewResetKey}
                                    emptyText={showcaseLoadingKey === activeShowcaseTag?.key ? t('home.loadingScripts') : t('home.noScriptsForTag')}
                                />
                            </div>
                            {/* 实现首页移动端加群入口 */}
                        </div>
                        {!isMobileViewport ? (
                            <HomeGameFilterBar
                                sort={allGamesFilters.sort}
                                mode={allGamesFilters.mode}
                                tagId={allGamesFilters.tagId}
                                themeTags={allThemeTags}
                                onSortChange={handleAllGamesSortChange}
                                onModeChange={handleAllGamesModeChange}
                                onTagChange={handleAllGamesTagChange}
                            />
                        ) : null}
                        <div className={styles.mobileJoinGroupSection}>
                            <button
                                type="button"
                                className={styles.mobileJoinGroupCard}
                                onClick={() => setShowJoinGroupModal(true)}
                                aria-label={t('home.joinGroup.openQr')}
                            >
                                <span className={styles.mobileJoinGroupIcon} aria-hidden="true">
                                    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M217.9 356.5c-14.1 0-25.5 11.4-25.5 25.5s11.4 25.5 25.5 25.5 25.5-11.4 25.5-25.5-11.4-25.5-25.5-25.5zM217.4 433.7c-11.2 0-20.4 9.2-20.4 20.4v174.4c0 11.2 9.2 20.4 20.4 20.4s20.4-9.2 20.4-20.4V454.1c0-11.2-9.2-20.4-20.4-20.4z" />
                                        <path d="M878.7 379.5v-86c0-96.3-57.5-153.7-153.7-153.7H218c-96.3 0-153.7 57.5-153.7 153.7v320.7C64.3 710.5 121.8 768 218 768h45.8v120.4L449.9 768h11.2c17.2 11.3 39 17.5 64.6 17.5h161.6l130.7 85v-85.1h33.5c66.6 0 107.9-41.3 107.9-107.9V484.8c-0.1-56.9-30.3-95.3-80.7-105.3zM417.8 484.8v192.8c0 16.2 2.5 31 7.2 44l-106.1 70.1v-74.9h-101c-67.7-0.3-102.2-34.8-102.5-102.5V293.5c0.3-67.7 34.8-102.2 102.5-102.5H725c67.7 0.3 102.2 34.8 102.5 102.5v83.3H525.7c-66.5 0.1-107.9 41.4-107.9 108z m490.4 192.7c-0.2 38.6-18.2 56.6-56.7 56.7h-87.2v40.3l-61-40.3H525.7c-38.5-0.2-56.6-18.2-56.7-56.7V484.8c0.2-38.6 18.2-56.6 56.7-56.7h325.7c38.5 0.2 56.6 18.2 56.7 56.7v192.7z" />
                                        <path d="M851.4 428.1H525.7c-38.5 0.2-56.6 18.2-56.7 56.7v192.8c0.2 38.5 18.2 56.6 56.7 56.7h177.5l61 40.3v-40.3h87.2c38.5-0.2 56.6-18.2 56.7-56.7V484.8c-0.1-38.6-18.1-56.6-56.7-56.7zM567 627.4c-21.1 0-38.3-17.2-38.3-38.3 0-21.1 17.2-38.3 38.3-38.3 21.1 0 38.3 17.2 38.3 38.3 0 21.1-17.2 38.3-38.3 38.3z m122.2 0c-21.1 0-38.3-17.2-38.3-38.3 0-21.1 17.2-38.3 38.3-38.3 21.1 0 38.3 17.2 38.3 38.3 0 21.1-17.2 38.3-38.3 38.3z m122.3 0c-21.1 0-38.3-17.2-38.3-38.3 0-21.1 17.2-38.3 38.3-38.3 21.1 0 38.3 17.2 38.3 38.3 0 21.1-17.2 38.3-38.3 38.3z" />
                                    </svg>
                                </span>
                                <span className={styles.mobileJoinGroupContent}>
                                    <span className={styles.mobileJoinGroupTitle}>{t('home.joinGroup.title')}</span>
                                    <span className={styles.mobileJoinGroupDesc}>{t('home.joinGroup.desc')}</span>
                                </span>
                                    <span className={styles.mobileJoinGroupAction}>
                                    {t('home.joinGroup.joinNow')}
                                </span>
                            </button>
                            {isMobileViewport ? (
                                <HomeGameFilterBar
                                    sort={allGamesFilters.sort}
                                    mode={allGamesFilters.mode}
                                    tagId={allGamesFilters.tagId}
                                    themeTags={allThemeTags}
                                    onSortChange={handleAllGamesSortChange}
                                    onModeChange={handleAllGamesModeChange}
                                    onTagChange={handleAllGamesTagChange}
                                />
                            ) : null}
                        </div>

                        {/* 闄愭椂浼樻儬妯″潡 */}
                        {/* <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/闄愭椂浼樻儬.png`} alt="闄愭椂浼樻儬" />
                            </div>
                            <img src={`${import.meta.env.BASE_URL}data/assets/home/鍒嗙晫绾?png`} className={styles.sectionDivider} alt="" />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                                onClick={() => {
                                    navigator('/specials');
                                }}
                            >
                                鏇村
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/绠ご.png`} alt="" />
                            </button>
                        </div>
                            {isLoadingSpecial ? (
                                <GameGridSkeleton count={10} layoutVariant="homeWide" />
                        ) : (
                            <>
                                <GameGrid
                                    games={fileMetas}
                                    layoutVariant="homeWide"
                                />
                                {isLoadingMoreSpecial && (
                                    <div style={{ padding: '20px', textAlign: 'center' }}>
                                        <GameGridSkeleton count={8} layoutVariant="homeWide" />
                                    </div>
                                )}
                            </>
                        )}
                    </div> */}

                        {/* 鍏ㄩ儴娓告垙妯″潡 */}
                        <div className={styles.shopSection}>
                        {/* <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/鍏ㄩ儴娓告垙.png`} alt="鍏ㄩ儴娓告垙" />
                            </div>
                            <img src={`${import.meta.env.BASE_URL}data/assets/home/鍒嗙晫绾?png`} className={styles.sectionDivider} alt="" />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                                onClick={() => {
                                    navigator('/library');
                                }}
                            >
                                鏇村
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/绠ご.png`} alt="" />
                            </button>
                        </div> */}
                            {isLoadingAll ? (
                                <GameGridSkeleton count={10} layoutVariant="homeWide" />
                            ) : (
                                <>
                                    <GameGrid
                                        games={allGames}
                                        layoutVariant="homeWide"
                                        emptyText={allGamesEmptyText}
                                    />
                                    {isLoadingMoreAll && (
                                        <div style={{ padding: '20px', textAlign: 'center' }}>
                                            <GameGridSkeleton count={10} layoutVariant="homeWide" />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* 婊氬姩鍔犺浇瑙﹀彂鍣?*/}
                    <div
                        ref={loadMoreTriggerRef}
                        style={{
                            height: '1px',
                            marginTop: '20px',
                            visibility: (hasMoreSpecial || hasMoreAll) ? 'visible' : 'hidden'
                        }}
                    />
                </div>
            </div>

            <FooterArea />
            <FloatingJoinGroup />

            {/* 绛惧埌鎻愮ず寮圭獥 */}
            {/* 鍔犵兢鎻愮ず寮圭獥锛堥娆＄櫥褰曪級 */}
            <JoinGroupModal isOpen={showJoinGroupModal} onClose={handleCloseJoinGroupModal} />
            <CheckInModal
                isOpen={showCheckInModal}
                onClose={() => setShowCheckInModal(false)}
                onSignInSuccess={handleHomeCheckInSuccess}
            />
            <AnnouncementModal
                announcement={latestAnnouncement}
                isOpen={showAnnouncementModal}
                onClose={handleCloseAnnouncementModal}
                onNavigateLink={handleAnnouncementLinkNavigate}
            />
            <MobileBottomNav />
            {externalLinkCopyModal}
        </div>
    );
};

export default Home;



