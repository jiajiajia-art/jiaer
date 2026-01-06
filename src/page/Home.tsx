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
    const [selectedGameMeta, setSelectedGameMeta] = useState<UserGameData | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const { user } = useAuthStore();
    const carouselIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const hasCheckedInSessionRef = useRef(false);

    const navigator = useNavigate();

    // 轮播数据（使用前3个游戏作为轮播内容）
    const carouselItems = useMemo(() => {
        return fileMetas.slice(0, 3).map(meta => ({
            id: meta.file_id || meta.id,
            title: meta.title || '未命名游戏',
            description: meta.description || '一段精彩的冒险故事等待着你...',
            cover: meta.cover_url ? getImageUrl(meta.cover_url) : `${import.meta.env.BASE_URL}data/gameCover/image.png`,
            game: meta
        }));
    }, [fileMetas]);

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

    // 加载游戏列表数据
    const loadLibraryData = useCallback(async () => {
        try {
            // 获取限时优惠游戏（前8个，有特殊价格的）
            setIsLoadingSpecial(true);
            const specialResponse = await libraryDataApi.getGameData('with-discount', {
                limit: '8',
            });

            if (specialResponse.data.success && specialResponse.data.data) {
                setFileMetas(specialResponse.data.data);
            } else {
                console.error('获取限时优惠游戏列表失败:', specialResponse.data);
                setFileMetas([]);
            }
            setIsLoadingSpecial(false);

            // 获取全部游戏（更多数据，用于全部游戏模块）
            setIsLoadingAll(true);
            const allResponse = await libraryDataApi.getGameData('no-discount', {
                limit: '40',
            });

            if (allResponse.data.success && allResponse.data.data) {
                setAllGames(allResponse.data.data);
            } else {
                console.error('获取全部游戏列表失败:', allResponse.data);
                setAllGames([]);
            }
            setIsLoadingAll(false);
        } catch (error) {
            console.error('获取游戏列表错误:', error);
            setFileMetas([]);
            setAllGames([]);
            setIsLoadingSpecial(false);
            setIsLoadingAll(false);
        }
    }, []);

    // 使用 libraryDataApi 获取游戏列表数据
    useEffect(() => {
        loadLibraryData();
    }, [user?.user.id, loadLibraryData]);

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
                                                                src={getImageUrl(item.cover)}
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
                                                                        showGameDetail(item.game)
                                                                    }
                                                                >
                                                                    <img 
                                                                    src={`${import.meta.env.BASE_URL}data/assets/home/开始游戏.png`} 
                                                                    alt="开始游戏"  />
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
                            <GameGrid
                                games={fileMetas}
                                onGameClick={showGameDetail}
                            />
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
                            <GameGrid
                                games={allGames}
                                onGameClick={showGameDetail}
                            />
                        )}
                    </div>
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


