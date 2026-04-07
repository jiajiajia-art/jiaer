import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';
import Navbar from '../components/Layout/Navbar';
import GameGrid from '../components/GameGrid';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';
import FooterArea from '../components/Layout/FooterArea';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';
import CheckInModal from '../components/CheckInModal';
import JoinGroupModal from '../components/JoinGroupModal';
import FloatingJoinGroup from '../components/FloatingJoinGroup';
import { getImageUrl } from '../utils/constants';
import announcementApi from '../api/announcement/announcementApi';
import type { AnnouncementRecord } from '../api/announcement/announcement.type';
import AnnouncementModal from '../components/AnnouncementModal';
import bannerApi from '../api/banner/bannerApi';
import type { BannerItem } from '../api/banner/banner.type';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import type { FlatThemeTag } from '../utils/themeTags';

type CarouselItem = UserGameData | BannerItem;

const isBannerCarouselItem = (item: CarouselItem): item is BannerItem => 'image_url' in item;

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
    const { user } = useAuthStore();
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

    // 监听用户登出，重置检查状态
    useEffect(() => {
        if (!user?.user?.id) {
            hasCheckedInSessionRef.current = false;
            setShowCheckInModal(false);
            sessionStorage.removeItem('checkInModalChecked');
        }
    }, [user?.user?.id]);

    // 首登弹窗：加入用户群（仅首次登录显示一次）
    useEffect(() => {
        const uid = user?.user?.id;
        if (!uid) return;

        const localKey = 'joinGroupModalShown_' + uid;
        const sessionKey = 'joinGroupModalWillShow_' + uid;

        const hasShown = localStorage.getItem(localKey) === 'true';
        const alreadyPlanned = sessionStorage.getItem(sessionKey) === 'true';

        if (!hasShown && !alreadyPlanned) {
            sessionStorage.setItem(sessionKey, 'true'); // 告知其他 effect：本次先显示入群弹窗
            setShowJoinGroupModal(true);
        }
    }, [user?.user?.id]);
    // 只在登录后检查一次签到弹窗（使用 sessionStorage 记录本次会话）
    useEffect(() => {
        if (!user?.user?.id || hasCheckedInSessionRef.current || user?.user?.hasSignedIn) {
            return;
        }

        // 如果本次会话计划先展示入群弹窗，则本次不弹签到
        const joinSessionKey = 'joinGroupModalWillShow_' + (user?.user?.id || '');
        if (sessionStorage.getItem(joinSessionKey) === 'true') {
            return;
        }

        const sessionKey = 'checkInModalChecked';
        const hasCheckedInSession = sessionStorage.getItem(sessionKey);

        if (!hasCheckedInSession) {
            const today = new Date().toDateString();
            const checkInKey = `checkIn_${user.user.id}_${today}`;
            const lastCheckInDate = localStorage.getItem(checkInKey);
            const isCheckedIn = lastCheckInDate === today;

            if (!isCheckedIn) {
                setShowCheckInModal(true);
            }

            sessionStorage.setItem(sessionKey, 'true');
            hasCheckedInSessionRef.current = true;
        }
    }, [user?.user?.id]);


    // 加载限时优惠数据
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
                    setSpecialPage(page + 1); // 页码递增
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
    }, []);

    // 加载全部游戏数据
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
                
                // 如果返回的数据少于 PAGE_SIZE，说明没有更多了
                setHasMoreAll(newGames.length === PAGE_SIZE);
                if (newGames.length > 0) {
                    setAllPage(page + 1); // 页码递增
                }
            } else {
                throw new Error('获取全部游戏列表失败');
            }
        } catch (error) {
            console.error('获取全部游戏列表失败:', error);
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
                // 实现双端统一读取轮播图
                setCarouselItems(bannerItems);
                return;
            }
        } catch (error) {
            console.error('加载首页轮播图失败，准备回退旧轮播:', error);
        }

        try {
            const response = await libraryDataApi.getCarouselData();
            if (response.data.success && response.data.data) {
                // 实现轮播图兜底回退
                setCarouselItems(response.data.data);
                return;
            }
        } catch (error) {
            console.error('加载首页旧轮播图失败:', error);
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
            console.error('获取首页公告失败:', error);
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
            console.error('加载首页题材标签失败:', error);
        }
    }, []);

    // 初始加载
    const loadLibraryData = useCallback(async () => {
        // 防止重复加载
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

    // 加载更多限时优惠
    const loadMoreSpecial = useCallback(() => {
        if (!isLoadingMoreSpecialRef.current && !isLoadingMoreSpecial && hasMoreSpecial) {
            loadSpecialGames(specialPage, false);
        }
    }, [isLoadingMoreSpecial, hasMoreSpecial, specialPage, loadSpecialGames]);

    // 加载更多全部游戏
    const loadMoreAll = useCallback(() => {
        if (!isLoadingMoreAllRef.current && !isLoadingMoreAll && hasMoreAll) {
            loadAllGames(allPage, false);
        }
    }, [isLoadingMoreAll, hasMoreAll, allPage, loadAllGames]);

    // 加载轮播图数据（无论是否登录都加载）
    useEffect(() => {
        loadCarouselData();
    }, [loadCarouselData]);

    useEffect(() => {
        loadLatestAnnouncement();
    }, [loadLatestAnnouncement]);

    useEffect(() => {
        loadThemeTags();
    }, [loadThemeTags]);

    // 使用 libraryDataApi 获取游戏列表数据（无论是否登录都加载）
    useEffect(() => {
        const currentUserId = user?.user?.id;
        // 如果用户ID发生变化，或者首次加载
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

        // 控制同一条公告在当前会话只弹出一次
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

    // 滚动加载更多：使用 Intersection Observer
    useEffect(() => {
        if (!loadMoreTriggerRef.current) return;

        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting) {
                    // 使用 ref 检查，避免闭包问题导致的重复请求
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


    // 自动轮播
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
        // 实现 页面恢复后重建轮播状态
        setIsTransitionEnabled(true);
        setCurrentSlide((prev) => getCarouselSlidePosition(prev, carouselItems.length));
        // 实现 轮播图图片强制重载
        setCarouselImageRetryMap({});
        setCarouselRefreshKey((prev) => prev + 1);
        void loadCarouselData();
        restartCarouselAutoPlay();
    }, [carouselItems.length, getCarouselSlidePosition, loadCarouselData, restartCarouselAutoPlay]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // 实现 页面隐藏时暂停自动轮播
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
            // 实现 恢复后轮播索引兜底
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

            // 实现 轮播图图片失败后补一次重载
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
        // 阻止拖拽时误触题材跳转
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

    // 关闭加入群弹窗；记录已展示；必要时跟进弹签到
    const handleCloseJoinGroupModal = () => {
        setShowJoinGroupModal(false);
        const uid = user?.user?.id;
        if (!uid) return;
        const localKey = 'joinGroupModalShown_' + uid;
        localStorage.setItem(localKey, 'true');

        // 如果今天还没签到，且本会话尚未弹过签到，则补弹签到
        const today = new Date().toDateString();
        const checkInKey = 'checkIn_' + uid + '_' + today;
        const isCheckedIn = localStorage.getItem(checkInKey) === today;
        const checkInSessionKey = 'checkInModalChecked';
        const hasCheckInModalShownThisSession = sessionStorage.getItem(checkInSessionKey);
        if (!isCheckedIn && !hasCheckInModalShownThisSession) {
            sessionStorage.setItem(checkInSessionKey, 'true');
            setShowCheckInModal(true);
        }
    };

    const handleCloseAnnouncementModal = () => {
        if (latestAnnouncement?.id) {
            sessionStorage.setItem(`announcementDismissed_${latestAnnouncement.id}`, 'true');
        }
        setShowAnnouncementModal(false);
    };
    return (
        <div className={styles.pageRoot}>
            {/* 顶部固定导航 */}
            <Navbar />

            {/* 主体 */}
            <div className={styles.mainContent}>
                {/* 右侧商城内容 */}
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
                                                                        src={`${import.meta.env.BASE_URL}data/assets/home/开始游戏.png`}
                                                                        alt="开始游戏" />
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

                    {/* 限时优惠模块 */}
                    {/* <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/限时优惠.png`} alt="限时优惠" />
                            </div>
                            <img src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`} className={styles.sectionDivider} alt="" />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                                onClick={() => {
                                    navigator('/specials');
                                }}
                            >
                                更多
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/箭头.png`} alt="" />
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

                    {/* 全部游戏模块 */}
                    <div className={styles.shopSection}>
                        {/* <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/全部游戏.png`} alt="全部游戏" />
                            </div>
                            <img src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`} className={styles.sectionDivider} alt="" />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                                onClick={() => {
                                    navigator('/library');
                                }}
                            >
                                更多
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/箭头.png`} alt="" />
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

                    {/* 滚动加载触发器 */}
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

            {/* 签到提示弹窗 */}
            {/* 加群提示弹窗（首次登录） */}
            <JoinGroupModal isOpen={showJoinGroupModal} onClose={handleCloseJoinGroupModal} />
            <CheckInModal
                isOpen={showCheckInModal}
                onClose={() => setShowCheckInModal(false)}
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


