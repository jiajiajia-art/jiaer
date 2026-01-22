import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styles from './Home.module.css';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Layout/Navbar';
import GameDetailModal from '../components/GameDetailModal';
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
    const [showGameModal, setShowGameModal] = useState(false);
    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [allGames, setAllGames] = useState<UserGameData[]>([]);
    const [isLoadingSpecial, setIsLoadingSpecial] = useState(true);
    const [isLoadingAll, setIsLoadingAll] = useState(true);
    const [isLoadingMoreSpecial, setIsLoadingMoreSpecial] = useState(false);
    const [isLoadingMoreAll, setIsLoadingMoreAll] = useState(false);
    const [hasMoreSpecial, setHasMoreSpecial] = useState(true);
    const [hasMoreAll, setHasMoreAll] = useState(true);
    const [specialPage, setSpecialPage] = useState(0);
    const [allPage, setAllPage] = useState(0);
    const [selectedGameMeta, setSelectedGameMeta] = useState<UserGameData | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const { user } = useAuthStore();
    const carouselIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const hasCheckedInSessionRef = useRef(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
    const isLoadingRef = useRef(false);
    const navigator = useNavigate();
    const [carouselItems, setCarouselItems] = useState<UserGameData[]>([]);

    // 轮播数据（使用前3个游戏作为轮播内容）
    // const carouselItems = useMemo(() => {
    //     return fileMetas.slice(0, 3).map(meta => ({
    //         id: meta.file_id || meta.id,
    //         title: meta.title || '未命名游戏',
    //         description: meta.description || '一段精彩的冒险故事等待着你...',
    //         cover: meta.cover_url ? getImageUrl(meta.cover_url) : `${import.meta.env.BASE_URL}data/gameCover/image.png`,
    //         game: meta
    //     }));
    // }, [fileMetas]);

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

    /**
     * 显示游戏详情（从后端数据）
     */
    const showGameDetail = (meta: UserGameData) => {
        setSelectedGameMeta(meta);
        setShowGameModal(true);
    };

    /**
     * 关闭弹窗
     */
    const closeModal = () => {
        setShowGameModal(false);
        setSelectedGameMeta(null);
    };

    // ESC键关闭弹窗
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showGameModal) setShowGameModal(false);
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [showGameModal]);

    // 加载限时优惠数据
    const loadSpecialGames = useCallback(async (page: number, isInitial = false, retryCount = 0) => {
        const MAX_RETRIES = 1;
        const RETRY_DELAY = 1000;
        const PAGE_SIZE = 8;
        const offset = page * PAGE_SIZE;

        if (isInitial) {
            setIsLoadingSpecial(true);
        } else {
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
                
                // 如果返回的数据少于 PAGE_SIZE，说明没有更多了
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

        setSpecialPage(0);
        setAllPage(0);
        setHasMoreSpecial(true);
        setHasMoreAll(true);
        await Promise.allSettled([
            loadCarouselData(),
            loadSpecialGames(0, true),
            loadAllGames(0, true),
        ]);
        isLoadingRef.current = false;
    }, []);

    // 加载更多限时优惠
    const loadMoreSpecial = useCallback(() => {
        if (!isLoadingMoreSpecial && hasMoreSpecial) {
            loadSpecialGames(specialPage, false);
        }
    }, [isLoadingMoreSpecial, hasMoreSpecial, specialPage, loadSpecialGames]);

    // 加载更多全部游戏
    const loadMoreAll = useCallback(() => {
        if (!isLoadingMoreAll && hasMoreAll) {
            loadAllGames(allPage, false);
        }
    }, [isLoadingMoreAll, hasMoreAll, allPage, loadAllGames]);

    // 使用 libraryDataApi 获取游戏列表数据
    useEffect(() => {
        isLoadingRef.current = false;
        loadLibraryData();
    }, [user?.user.id]);

    // 滚动加载更多：使用 Intersection Observer
    useEffect(() => {
        if (!loadMoreTriggerRef.current) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting) {
                    // 优先加载全部游戏（因为它在页面下方）
                    if (hasMoreAll && !isLoadingMoreAll) {
                        loadMoreAll();
                    } else if (hasMoreSpecial && !isLoadingMoreSpecial) {
                        loadMoreSpecial();
                    }
                }
            },
            {
                root: null,
                rootMargin: '200px', // 提前200px开始加载
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

    // 购买后软刷新：只更新本地列表中的对应游戏数据
    const handleGameUpdated = useCallback((updatedGame: UserGameData) => {
        const updatedId = updatedGame.file_id || updatedGame.id;
        if (!updatedId) return;

        const matchById = (game: UserGameData) => {
            const id = game.file_id || game.id;
            return id === updatedId;
        };

        setFileMetas((prev) =>
            prev.map((g) => (matchById(g) ? { ...g, ...updatedGame } : g))
        );
        setAllGames((prev) =>
            prev.map((g) => (matchById(g) ? { ...g, ...updatedGame } : g))
        );
        setSelectedGameMeta((prev) =>
            prev && matchById(prev) ? { ...prev, ...updatedGame } : prev
        );
    }, []);

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
                                                                        showGameDetail(item)
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
                    <div className={styles.shopSection}>
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
                                    onGameClick={showGameDetail}
                                />
                                {isLoadingMoreSpecial && (
                                    <div style={{ padding: '20px', textAlign: 'center' }}>
                                        <GameGridSkeleton count={8} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* 全部游戏模块 */}
                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
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
                        </div>
                        {isLoadingAll ? (
                            <GameGridSkeleton count={8} />
                        ) : (
                            <>
                                <GameGrid
                                    games={allGames}
                                    onGameClick={showGameDetail}
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

            {selectedGameMeta && (
                <GameDetailModal
                    isOpen={showGameModal}
                    game={selectedGameMeta}
                    onClose={closeModal}
                    onGameUpdated={handleGameUpdated}
                />
            )}

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


