import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Home.module.css';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Layout/Navbar';
import GameGrid from '../components/GameGrid';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';
import FooterArea from '../components/Layout/FooterArea';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';
import CheckInModal from '../components/CheckInModal';
import { getImageUrl } from '../utils/constants';

const Home: React.FC = () => {
    const [, setFileMetas] = useState<UserGameData[]>([]);
    const [allGames, setAllGames] = useState<UserGameData[]>([]);
    const [, setIsLoadingSpecial] = useState(true);
    const [isLoadingAll, setIsLoadingAll] = useState(true);
    const [isLoadingMoreSpecial, setIsLoadingMoreSpecial] = useState(false);
    const [isLoadingMoreAll, setIsLoadingMoreAll] = useState(false);
    const [hasMoreSpecial, setHasMoreSpecial] = useState(true);
    const [hasMoreAll, setHasMoreAll] = useState(true);
    const [specialPage, setSpecialPage] = useState(0);
    const [allPage, setAllPage] = useState(0);
    const [currentSlide, setCurrentSlide] = useState(0);
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
    const navigator = useNavigate();
    const [carouselItems, setCarouselItems] = useState<UserGameData[]>([]);

    // 监听用户登出，重置检查状态
    useEffect(() => {
        if (!user?.user?.id) {
            hasCheckedInSessionRef.current = false;
            setShowCheckInModal(false);
            sessionStorage.removeItem('checkInModalChecked');
        }
    }, [user?.user?.id]);

    // 只在登录后检查一次签到弹窗（使用 sessionStorage 记录本次会话）
    useEffect(() => {
        if (!user?.user?.id || hasCheckedInSessionRef.current || user?.user?.hasSignedIn) {
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

    // 导航到游戏详情页
    const navigateToGameDetail = (game: UserGameData) => {
        const gameId = game.file_id || game.id;
        if (gameId) {
            navigator(`/game/${gameId}`, {
                state: { source: 'main_page' },
            });
        }
    };

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
        const response = await libraryDataApi.getCarouselData();
        if (response.data.success && response.data.data) {
            setCarouselItems(response.data.data);
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
    useEffect(() => {
        if (carouselItems.length > 1) {
            carouselIntervalRef.current = setInterval(() => {
                setCurrentSlide((prev) => (prev + 1) % carouselItems.length);
            }, 5000); // 每5秒切换一次

            return () => {
                if (carouselIntervalRef.current) {
                    clearInterval(carouselIntervalRef.current);
                }
            };
        }
    }, [carouselItems.length]);

    // 手动切换轮播
    const goToSlide = (index: number) => {
        setCurrentSlide(index);
        // 重置自动轮播
        if (carouselIntervalRef.current) {
            clearInterval(carouselIntervalRef.current);
        }
        if (carouselItems.length > 1) {
            carouselIntervalRef.current = setInterval(() => {
                setCurrentSlide((prev) => (prev + 1) % carouselItems.length);
            }, 5000);
        }
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
                        <div className={styles.carouselContainer}>
                            {carouselItems.length > 0 ? (
                                <>
                                    <div className={styles.carouselWrapper}>
                                        <div
                                            className={styles.carouselTrack}
                                            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                                        >
                                            {carouselItems.map((item, idx) => {
                                                const imageId = item.id || `carousel-${idx}`;
                                                return (
                                                    <div key={imageId} className={styles.carouselSlide}>
                                                        <div className={styles.carouselImage}>
                                                            <img
                                                                src={getImageUrl(item.cover_url)}
                                                                alt={item.title}
                                                            />
                                                        </div>
                                                        <div className={styles.carouselContent}>
                                                            <div className={styles.carouselInfo}>
                                                                <h2 className={styles.carouselTitle}>{item.title}</h2>
                                                                <p className={styles.carouselDescription}>{item.description}</p>
                                                                <button
                                                                    className={styles.carouselStartBtn}
                                                                    onClick={() =>
                                                                        navigateToGameDetail(item)
                                                                    }
                                                                >
                                                                    <img
                                                                        src={`${import.meta.env.BASE_URL}data/assets/home/开始游戏.png`}
                                                                        alt="开始游戏" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {carouselItems.length > 1 && (
                                        <div className={styles.carouselIndicators}>
                                            {carouselItems.map((_, index) => (
                                                <button
                                                    key={index}
                                                    className={`${styles.carouselIndicator} ${currentSlide === index ? styles.carouselIndicatorActive : ''}`}
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

            {/* 签到提示弹窗 */}
            <CheckInModal
                isOpen={showCheckInModal}
                onClose={() => setShowCheckInModal(false)}
            />
            <MobileBottomNav />
        </div>
    );
};

export default Home;


