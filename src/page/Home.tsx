import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './Home.module.css';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Layout/Navbar';
import { type SidebarItem } from '../components/Sidebar';
import GameDetailModal from '../components/GameDetailModal';
import GameGrid from '../components/GameGrid';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';
import { IoIosArrowForward } from 'react-icons/io';
import FooterArea from '../components/Layout/FooterArea';

const Home: React.FC = () => {
    const [showGameModal, setShowGameModal] = useState(false);
    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [allGames, setAllGames] = useState<UserGameData[]>([]);
    const [selectedGameMeta, setSelectedGameMeta] = useState<UserGameData | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const { user } = useAuthStore();
    const carouselIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const navigator = useNavigate();
    
    // 轮播数据（使用前3个游戏作为轮播内容）
    const carouselItems = useMemo(() => {
        return fileMetas.slice(0, 3).map(meta => ({
            id: meta.file_id || meta.id,
            title: meta.title || '未命名游戏',
            description: meta.description || '一段精彩的冒险故事等待着你...',
            cover: meta.cover_url || `${import.meta.env.BASE_URL}data/gameCover/image.png`,
            game: meta
        }));
    }, [fileMetas]);

    const sidebarItems = useMemo<SidebarItem[]>(() => [
        {
            id: 'home',
            label: '首页',
            icon: 'data/asset/首页/homeIcon.png',
            route: '/home',
        },
        {
            id: 'library',
            label: '全部',
            route: '/home/library',
        },
    ], []);

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

    // 使用 libraryDataApi 获取游戏列表数据
    useEffect(() => {
        const loadLibraryData = async () => {
            try {
                // 获取限时优惠游戏（前8个，有特殊价格的）
                const specialResponse = await libraryDataApi.getGameData({ 
                    limit: '8', 
                    userId: String(user?.user.id) || '' });

                if (specialResponse.data.success && specialResponse.data.data) {
                    setFileMetas(specialResponse.data.data);
                } else {
                    console.error('获取限时优惠游戏列表失败:', specialResponse.data);
                    setFileMetas([]);
                }

                // 获取全部游戏（更多数据，用于全部游戏模块）
                const allResponse = await libraryDataApi.getGameData({ 
                    userId: String(user?.user.id) || '' });

                if (allResponse.data.success && allResponse.data.data) {
                    setAllGames(allResponse.data.data);
                } else {
                    console.error('获取全部游戏列表失败:', allResponse.data);
                    setAllGames([]);
                }
            } catch (error) {
                console.error('获取游戏列表错误:', error);
                setFileMetas([]);
                setAllGames([]);
            }
        };

        loadLibraryData();
    }, [user?.user.id]);

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
    // console.log(fileMetas);
    
    return (
        <div className={styles.pageRoot}>
            {/* 顶部固定导航 */}
            <Navbar />
            <MobileTopNav items={sidebarItems} />

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
                                            {carouselItems.map((item) => (
                                                <div key={item.id} className={styles.carouselSlide}>
                                                    <div className={styles.carouselImage}>
                                                        <img src={item.cover} alt={item.title} />
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
                                                                开始游戏
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
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
                                <div className={styles.carouselPlaceholder}>
                                    <img src={`${import.meta.env.BASE_URL}data/gameCover/image.png`} alt="今日推荐" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 限时优惠模块 */}
                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>限时优惠</div>
                            <hr />
                            <button 
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                                onClick={() => {
                                    navigator('/home/library');
                                }}
                            >
                                更多
                                <IoIosArrowForward />
                            </button>
                        </div>
                        <GameGrid 
                            games={fileMetas} 
                            showSpecialPrice={true}
                            onGameClick={showGameDetail}
                        />
                    </div>

                    {/* 全部游戏模块 */}
                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>全部游戏</div>
                            <hr />
                            <button 
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                                onClick={() => {
                                    navigator('/home/library');
                                }}
                            >
                                更多
                                <IoIosArrowForward />
                            </button>
                        </div>
                        <GameGrid 
                            games={allGames} 
                            showSpecialPrice={false}
                            onGameClick={showGameDetail}
                        />
                    </div>
                </div>
            </div>

            <FooterArea />

            {selectedGameMeta && (
                <GameDetailModal
                    isOpen={showGameModal}
                    game={selectedGameMeta}
                    onClose={closeModal}
                />
            )}
            <MobileBottomNav />
        </div>
    );
};

export default Home;


