import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';
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
import { getImageUrl } from '../utils/constants';
import { auth } from '../api/account/authApi';
import announcementApi from '../api/announcement/announcementApi';
import type { AnnouncementRecord } from '../api/announcement/announcement.type';
import AnnouncementModal from '../components/AnnouncementModal';
import bannerApi from '../api/banner/bannerApi';
import type { BannerItem } from '../api/banner/banner.type';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import type { HomePromotionTicker } from '../api/promotion/promotion.type';
import type { FlatThemeTag } from '../utils/themeTags';

type CarouselItem = UserGameData | BannerItem;

const isBannerCarouselItem = (item: CarouselItem): item is BannerItem => 'image_url' in item;
const PROTECTED_PATH_PREFIXES = ['/analytics', '/create', '/createGame', '/warehouse', '/profile', '/promotions', '/admin', '/galgame', '/galgameMap', '/customif'];

const Home: React.FC = () => {
    const navigate = useNavigate();
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
    const [currentSlide, setCurrentSlide] = useState(1);
    const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);
    const { user, isAuthenticated, updateUser } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();
    const carouselIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const hasCheckedInSessionRef = useRef(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
    const isLoadingRef = useRef(false);
    const isLoadingMoreSpecialRef = useRef(false);
    const isLoadingMoreAllRef = useRef(false);
    const lastUserIdRef = useRef<string | number | undefined>(undefined);
    const hasInitializedRef = useRef(false);
    const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
    const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
    const [latestAnnouncement, setLatestAnnouncement] = useState<AnnouncementRecord | null>(null);
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [homeTicker, setHomeTicker] = useState<HomePromotionTicker | null>(null);
    const [isTickerOverflowing, setIsTickerOverflowing] = useState(false);
    const [pendingTickerLink, setPendingTickerLink] = useState<string | null>(null);
    const [themeTags, setThemeTags] = useState<FlatThemeTag[]>([]);
    const [isThemeShowcaseDragging, setIsThemeShowcaseDragging] = useState(false);
    const [carouselRefreshKey, setCarouselRefreshKey] = useState(0);
    const [carouselImageRetryMap, setCarouselImageRetryMap] = useState<Record<string, number>>({});
    const touchStartXRef = useRef<number | null>(null);
    const touchStartYRef = useRef<number | null>(null);
    const touchDeltaXRef = useRef(0);
    const touchDeltaYRef = useRef(0);
    const suppressBannerClickRef = useRef(false);
    const suppressClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingTickerAuthRef = useRef(false);
    const homeTickerViewportRef = useRef<HTMLSpanElement | null>(null);
    const homeTickerMeasureTextRef = useRef<HTMLSpanElement | null>(null);
    const navigateToHomeTickerLinkRef = useRef<(linkUrl: string, allowAuthPrompt?: boolean) => void>(() => undefined);
    const themeShowcaseRef = useRef<HTMLDivElement | null>(null);
    const themeShowcaseDragStateRef = useRef({
        isDragging: false,
        startX: 0,
        startScrollLeft: 0,
        moved: false,
    });
    const hasMultipleCarouselItems = carouselItems.length > 1;
    const carouselRenderItems = hasMultipleCarouselItems
        ? [carouselItems[carouselItems.length - 1], ...carouselItems, carouselItems[0]]
        : carouselItems;
    const currentLogicalSlide = hasMultipleCarouselItems
        ? ((currentSlide - 1 + carouselItems.length) % carouselItems.length)
        : 0;

    const getCarouselSlidePosition = useCallback((slide: number, itemCount: number) => {
        if (itemCount <= 1) return 0;
        if (!Number.isFinite(slide)) return 1;
        const logicalIndex = ((slide - 1) % itemCount + itemCount) % itemCount;
        return logicalIndex + 1;
    }, []);

    const getCarouselImageStateKey = useCallback((item: CarouselItem, index: number) => {
        const imageId = getCarouselItemId(item, index);
        const imageUrl = getCarouselItemImage(item) || '';
        return `${imageId}-${imageUrl}`;
    }, []);

    const getCarouselImageSrc = useCallback((item: CarouselItem, index: number) => {
        const baseUrl = getImageUrl(getCarouselItemImage(item));
        if (!baseUrl) return '';

        const imageStateKey = getCarouselImageStateKey(item, index);
        const retryVersion = carouselImageRetryMap[imageStateKey] || 0;
        const reloadVersion = carouselRefreshKey + retryVersion;

        if (reloadVersion <= 0) {
            return baseUrl;
        }

        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}carouselReload=${reloadVersion}`;
    }, [carouselImageRetryMap, carouselRefreshKey, getCarouselImageStateKey]);

    // 鐩戝惉鐢ㄦ埛鐧诲嚭锛岄噸缃鏌ョ姸鎬?
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
    useEffect(() => {
        const uid = user?.user?.id;
        if (!uid) return;

        const localKey = 'joinGroupModalShown_' + uid;
        const sessionKey = 'joinGroupModalWillShow_' + uid;

        const hasShown = localStorage.getItem(localKey) === 'true';
        const alreadyPlanned = sessionStorage.getItem(sessionKey) === 'true';

        if (!hasShown && !alreadyPlanned) {
            sessionStorage.setItem(sessionKey, 'true'); // 鍛婄煡鍏朵粬 effect锛氭湰娆″厛鏄剧ず鍏ョ兢寮圭獥
            setShowJoinGroupModal(true);
        }
    }, [user?.user?.id]);
    // 鍙湪鐧诲綍鍚庢鏌ヤ竴娆＄鍒板脊绐楋紙浣跨敤 sessionStorage 璁板綍鏈浼氳瘽锛?
    useEffect(() => {
        if (!user?.user?.id || hasCheckedInSessionRef.current || user?.user?.hasSignedIn) {
            return;
        }

        // 濡傛灉鏈浼氳瘽璁″垝鍏堝睍绀哄叆缇ゅ脊绐楋紝鍒欐湰娆′笉寮圭鍒?
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


    // 鍔犺浇闄愭椂浼樻儬鏁版嵁
    const loadSpecialGames = useCallback(async (page: number, isInitial = false, retryCount = 0) => {
        const MAX_RETRIES = 1;
        const RETRY_DELAY = 1000;
        const PAGE_SIZE = 8;
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
                    setSpecialPage(page + 1); // 椤电爜閫掑
                }
            } else {
                throw new Error('鑾峰彇闄愭椂浼樻儬娓告垙鍒楄〃澶辫触');
            }
        } catch (error) {
            console.error('鑾峰彇闄愭椂浼樻儬娓告垙鍒楄〃澶辫触:', error);
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
    }, []);

    // 鍔犺浇鍏ㄩ儴娓告垙鏁版嵁
    const loadAllGames = useCallback(async (page: number, isInitial = false, retryCount = 0) => {
        const MAX_RETRIES = 1;
        const RETRY_DELAY = 1000;
        const PAGE_SIZE = 12;
        const offset = page * PAGE_SIZE;

        if (isInitial) {
            setIsLoadingAll(true);
        } else {
            if (isLoadingMoreAllRef.current) {
                return;
            }
            isLoadingMoreAllRef.current = true;
            setIsLoadingMoreAll(true);
        }

        try {
            const response = await libraryDataApi.getGameData('no-discount', {
                limit: String(PAGE_SIZE),
                offset: String(offset)
            });

            if (response.data.success && response.data.data) {
                const newGames = response.data.data;
                if (isInitial) {
                    setAllGames(newGames);
                } else {
                    setAllGames(prev => [...prev, ...newGames]);
                }
                
                // 濡傛灉杩斿洖鐨勬暟鎹皯浜?PAGE_SIZE锛岃鏄庢病鏈夋洿澶氫簡
                setHasMoreAll(newGames.length === PAGE_SIZE);
                if (newGames.length > 0) {
                    setAllPage(page + 1); // 椤电爜閫掑
                }
            } else {
                throw new Error('鑾峰彇鍏ㄩ儴娓告垙鍒楄〃澶辫触');
            }
        } catch (error) {
            console.error('鑾峰彇鍏ㄩ儴娓告垙鍒楄〃澶辫触:', error);
            if (retryCount < MAX_RETRIES) {
                setTimeout(() => {
                    loadAllGames(page, isInitial, retryCount + 1);
                }, RETRY_DELAY);
            } else if (isInitial) {
                setAllGames([]);
            }
        } finally {
            setIsLoadingAll(false);
            setIsLoadingMoreAll(false);
            isLoadingMoreAllRef.current = false;
        }
    }, []);

    const loadCarouselData = useCallback(async () => {
        try {
            const bannerResponse = await bannerApi.getLatest();
            const bannerItems = bannerResponse.data.data?.banners || [];
            if (bannerResponse.data.success && bannerItems.length > 0) {
                // 瀹炵幇鍙岀缁熶竴璇诲彇杞挱鍥?
                setCarouselItems(bannerItems);
                return;
            }
        } catch (error) {
            console.error('鍔犺浇棣栭〉杞挱鍥惧け璐ワ紝鍑嗗鍥為€€鏃ц疆鎾?', error);
        }

        try {
            const response = await libraryDataApi.getCarouselData();
            if (response.data.success && response.data.data) {
                // 瀹炵幇杞挱鍥惧厹搴曞洖閫€
                setCarouselItems(response.data.data);
                return;
            }
        } catch (error) {
            console.error('鍔犺浇棣栭〉鏃ц疆鎾浘澶辫触:', error);
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
            console.error('鑾峰彇棣栭〉鍏憡澶辫触:', error);
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

    const loadThemeTags = useCallback(async () => {
        try {
            const response = await gameTagsApi.getFeaturedGameTags();
            if (response.data.success) {
                // 实现首页热门题材读取后台配置
                setThemeTags((response.data.data || []).map((tag) => ({
                    id: Number(tag.id),
                    name: String(tag.name || ''),
                    parentName: String(tag.parent_name || ''),
                })).filter((tag) => Number.isFinite(tag.id) && tag.id > 0 && tag.name));
            }
        } catch (error) {
            console.error('鍔犺浇棣栭〉棰樻潗鏍囩澶辫触:', error);
        }
    }, []);

    // 鍒濆鍔犺浇
    const loadLibraryData = useCallback(async () => {
        // 闃叉閲嶅鍔犺浇
        if (isLoadingRef.current) {
            return;
        }
        isLoadingRef.current = true;
        isLoadingMoreSpecialRef.current = false;
        isLoadingMoreAllRef.current = false;

        setSpecialPage(0);
        setAllPage(0);
        setHasMoreSpecial(true);
        setHasMoreAll(true);
        await Promise.allSettled([
            loadSpecialGames(0, true),
            loadAllGames(0, true),
        ]);
        isLoadingRef.current = false;
    }, [loadSpecialGames, loadAllGames]);

    // 鍔犺浇鏇村闄愭椂浼樻儬
    const loadMoreSpecial = useCallback(() => {
        if (!isLoadingMoreSpecialRef.current && !isLoadingMoreSpecial && hasMoreSpecial) {
            loadSpecialGames(specialPage, false);
        }
    }, [isLoadingMoreSpecial, hasMoreSpecial, specialPage, loadSpecialGames]);

    // 鍔犺浇鏇村鍏ㄩ儴娓告垙
    const loadMoreAll = useCallback(() => {
        if (!isLoadingMoreAllRef.current && !isLoadingMoreAll && hasMoreAll) {
            loadAllGames(allPage, false);
        }
    }, [isLoadingMoreAll, hasMoreAll, allPage, loadAllGames]);

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
        loadThemeTags();
    }, [loadThemeTags]);

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
            setIsTransitionEnabled(true);
            setCurrentSlide((prev) => prev + 1);
        }, 5000);
    }, [clearCarouselInterval, hasMultipleCarouselItems]);

    useEffect(() => {
        if (hasMultipleCarouselItems) {
            setIsTransitionEnabled(true);
            setCurrentSlide(1);
        } else {
            setIsTransitionEnabled(true);
            setCurrentSlide(0);
        }
        setCarouselImageRetryMap({});
    }, [hasMultipleCarouselItems, carouselItems.length]);

    // autoplay
    useEffect(() => {
        restartCarouselAutoPlay();
        return () => {
            clearCarouselInterval();
        };
    }, [restartCarouselAutoPlay, clearCarouselInterval]);

    const handleCarouselResume = useCallback(() => {
        // 瀹炵幇 椤甸潰鎭㈠鍚庨噸寤鸿疆鎾姸鎬?
        setIsTransitionEnabled(true);
        setCurrentSlide((prev) => getCarouselSlidePosition(prev, carouselItems.length));
        // 瀹炵幇 杞挱鍥惧浘鐗囧己鍒堕噸杞?
        setCarouselImageRetryMap({});
        setCarouselRefreshKey((prev) => prev + 1);
        void loadCarouselData();
        restartCarouselAutoPlay();
    }, [carouselItems.length, getCarouselSlidePosition, loadCarouselData, restartCarouselAutoPlay]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // 瀹炵幇 椤甸潰闅愯棌鏃舵殏鍋滆嚜鍔ㄨ疆鎾?
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

    // manual switching
    const goToSlide = (logicalIndex: number) => {
        if (!hasMultipleCarouselItems) {
            setCurrentSlide(0);
            return;
        }
        const safeIndex = ((logicalIndex % carouselItems.length) + carouselItems.length) % carouselItems.length;
        setIsTransitionEnabled(true);
        setCurrentSlide(safeIndex + 1);
        restartCarouselAutoPlay();
    };

    const goToPrevSlide = () => {
        if (!hasMultipleCarouselItems) return;
        setIsTransitionEnabled(true);
        setCurrentSlide((prev) => prev - 1);
        restartCarouselAutoPlay();
    };

    const goToNextSlide = () => {
        if (!hasMultipleCarouselItems) return;
        setIsTransitionEnabled(true);
        setCurrentSlide((prev) => prev + 1);
        restartCarouselAutoPlay();
    };

    const handleCarouselTransitionEnd = () => {
        if (!hasMultipleCarouselItems) return;

        if (currentSlide === carouselItems.length + 1) {
            setIsTransitionEnabled(false);
            setCurrentSlide(1);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsTransitionEnabled(true);
                });
            });
            return;
        }

        if (currentSlide === 0) {
            setIsTransitionEnabled(false);
            setCurrentSlide(carouselItems.length);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsTransitionEnabled(true);
                });
            });
            return;
        }

        if (currentSlide < 0 || currentSlide > carouselItems.length + 1) {
            // 瀹炵幇 鎭㈠鍚庤疆鎾储寮曞厹搴?
            setIsTransitionEnabled(false);
            setCurrentSlide(getCarouselSlidePosition(currentSlide, carouselItems.length));
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsTransitionEnabled(true);
                });
            });
        }
    };

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

        if (safeLink.startsWith('http://') || safeLink.startsWith('https://')) {
            window.open(safeLink, '_blank', 'noopener,noreferrer');
            return;
        }

        if (safeLink.startsWith('/')) {
            navigate(safeLink);
        }
    };

    const isProtectedPath = useCallback((linkUrl: string) => (
        PROTECTED_PATH_PREFIXES.some((prefix) => linkUrl === prefix || linkUrl.startsWith(`${prefix}/`) || linkUrl.startsWith(`${prefix}?`))
    ), []);

    const navigateToHomeTickerLink = useCallback((linkUrl: string, allowAuthPrompt = true) => {
        const safeLink = linkUrl.trim();
        if (!safeLink) return;

        if (safeLink.startsWith('http://') || safeLink.startsWith('https://')) {
            window.open(safeLink, '_blank', 'noopener,noreferrer');
            return;
        }

        if (!safeLink.startsWith('/')) {
            return;
        }

        if (allowAuthPrompt && isProtectedPath(safeLink) && !isAuthenticated) {
            // 瀹炵幇鏈櫥褰曞厛鎷夎捣鐧诲綍鍐嶈烦杞?            pendingTickerAuthRef.current = true;
            setPendingTickerLink(safeLink);
            setIsAuthModalOpen(true);
            return;
        }

        navigate(safeLink);
    }, [isAuthenticated, isProtectedPath, navigate, setIsAuthModalOpen]);
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

    const handleCarouselImageError = useCallback((item: CarouselItem, index: number) => {
        const imageStateKey = getCarouselImageStateKey(item, index);

        setCarouselImageRetryMap((prev) => {
            const currentRetryCount = prev[imageStateKey] || 0;
            if (currentRetryCount >= 1) {
                return prev;
            }

            // 瀹炵幇 杞挱鍥惧浘鐗囧け璐ュ悗琛ヤ竴娆￠噸杞?
            return {
                ...prev,
                [imageStateKey]: currentRetryCount + 1,
            };
        });
    }, [getCarouselImageStateKey]);

    const handleThemeClick = (tagId: number) => {
        navigate(`/categories?tagId=${tagId}`);
    };

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

    const handleOpenCategories = () => {
        navigate('/categories');
    };

    useEffect(() => {
        return () => {
            if (suppressClickTimerRef.current) {
                clearTimeout(suppressClickTimerRef.current);
            }
        };
    }, []);

    // 鍏抽棴鍔犲叆缇ゅ脊绐楋紱璁板綍宸插睍绀猴紱蹇呰鏃惰窡杩涘脊绛惧埌
    const handleCloseJoinGroupModal = () => {
        setShowJoinGroupModal(false);
        const uid = user?.user?.id;
        if (!uid) return;
        const localKey = 'joinGroupModalShown_' + uid;
        localStorage.setItem(localKey, 'true');

        // 濡傛灉浠婂ぉ杩樻病绛惧埌锛屼笖鏈細璇濆皻鏈脊杩囩鍒帮紝鍒欒ˉ寮圭鍒?
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
    return (
        <div className={styles.pageRoot}>
            {/* 椤堕儴鍥哄畾瀵艰埅 */}
            <Navbar />

            {/* 涓讳綋 */}
            <div className={styles.mainContent}>
                {/* 鍙充晶鍟嗗煄鍐呭 */}
                <div className={styles.main}>
                    <div className={styles.todayWrap}>
                        <div className={`${styles.carouselContainer} ${styles.carouselContainerPc}`}>
                            {carouselItems.length > 0 ? (
                                <>
                                    <div className={`${styles.carouselWrapper} ${styles.carouselWrapperPc}`}>
                                        <div
                                            className={`${styles.carouselTrack} ${!isTransitionEnabled ? styles.carouselTrackNoTransition : ''}`}
                                            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                                            onTransitionEnd={handleCarouselTransitionEnd}
                                            onTouchStart={handleCarouselTouchStart}
                                            onTouchMove={handleCarouselTouchMove}
                                            onTouchEnd={handleCarouselTouchEnd}
                                            onTouchCancel={resetTouchState}
                                        >
                                            {carouselRenderItems.map((item, idx) => {
                                                const imageId = getCarouselItemId(item, idx);
                                                const canClick = isCarouselItemClickable(item);
                                                const imageStateKey = getCarouselImageStateKey(item, idx);
                                                const retryVersion = carouselImageRetryMap[imageStateKey] || 0;
                                                return (
                                                    <div
                                                        key={`${imageId}-${idx}`}
                                                        className={`${styles.carouselSlide} ${canClick ? styles.carouselSlideClickable : ''}`}
                                                        onClick={(event) => {
                                                            if (suppressBannerClickRef.current) {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                return;
                                                            }
                                                            handleCarouselItemClick(item);
                                                        }}
                                                    >
                                                        <div className={styles.carouselImage}>
                                                            <img
                                                                key={`${imageStateKey}-${carouselRefreshKey}-${retryVersion}`}
                                                                src={getCarouselImageSrc(item, idx)}
                                                                alt={item.title}
                                                                loading="eager"
                                                                decoding="async"
                                                                onError={() => {
                                                                    handleCarouselImageError(item, idx);
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
                                                aria-label="上一张"
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
                                                aria-label="下一张"
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
                                                    className={`${styles.carouselIndicator} ${currentLogicalSlide === index ? styles.carouselIndicatorActive : ''}`}
                                                    onClick={() => goToSlide(index)}
                                                    aria-label={`切换到第 ${index + 1} 张`}
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

                    {/* 实现移动端与 PC 共用热门题材展示 */}
                    {homeTicker?.text?.trim() ? (
                        <button
                            type="button"
                            className={styles.homeTicker}
                            onClick={handleHomeTickerClick}
                            aria-label={`打开首页滚动通知：${homeTicker.text}`}
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
                            <span className={styles.homeTickerAction}>查看</span>
                        </button>
                    ) : null}

                    <div className={styles.themeShowcase}>
                        <div className={styles.themeShowcaseHeader}>
                            <h3>热门题材</h3>
                            <button type="button" onClick={handleOpenCategories}>查看全部</button>
                        </div>
                        <div
                            ref={themeShowcaseRef}
                            className={`${styles.themeShowcaseList} ${isThemeShowcaseDragging ? styles.themeShowcaseListDragging : ''}`}
                            onMouseDown={handleThemeShowcaseMouseDown}
                            onMouseMove={handleThemeShowcaseMouseMove}
                            onMouseUp={stopThemeShowcaseDragging}
                            onMouseLeave={stopThemeShowcaseDragging}
                            onClickCapture={handleThemeShowcaseClickCapture}
                        >
                            {themeTags.slice(0, 12).map((tag) => (
                                <button
                                    key={tag.id}
                                    type="button"
                                    className={styles.themeShowcaseItem}
                                    onClick={() => handleThemeClick(tag.id)}
                                >
                                    {tag.name}
                                </button>
                            ))}
                        </div>
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
                            <GameGridSkeleton count={8} />
                        ) : (
                            <>
                                <GameGrid
                                    games={fileMetas}
                                />
                                {isLoadingMoreSpecial && (
                                    <div style={{ padding: '20px', textAlign: 'center' }}>
                                        <GameGridSkeleton count={8} />
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
                            <GameGridSkeleton count={8} />
                        ) : (
                            <>
                                <GameGrid
                                    games={allGames}
                                />
                                {isLoadingMoreAll && (
                                    <div style={{ padding: '20px', textAlign: 'center' }}>
                                        <GameGridSkeleton count={8} />
                                    </div>
                                )}
                            </>
                        )}
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
            />
            <MobileBottomNav />
        </div>
    );
};

export default Home;



