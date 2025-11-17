import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './Home.module.css';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { type SidebarItem } from '../components/Sidebar';
import GameDetailModal from '../components/GameDetailModal';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';

const Home: React.FC = () => {
    const [showGameModal, setShowGameModal] = useState(false);
    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
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

    // 使用 libraryDataApi 获取游戏列表数据（首页显示前4个）
    useEffect(() => {
        const loadLibraryData = async () => {
            try {
                const response = await libraryDataApi.getGameData({ 
                    limit: '4', 
                    userId: String(user?.user.id) || '' });

                if (response.data.success && response.data.data) {
                    setFileMetas(response.data.data);
                } else {
                    console.error('获取游戏列表失败:', response.data);
                    setFileMetas([]);
                }
            } catch (error) {
                console.error('获取游戏列表错误:', error);
                setFileMetas([]);
            }
        };

        loadLibraryData();
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

                    <div className={styles.shopSection}>
                        <div className={styles.shopSectionInner}>
                            <div className={styles.shopSectionContent}>
                                <div className={styles.sectionHeader}>
                                    <div className={styles.sectionTitle}>限时优惠!</div>
                                    <button 
                                        type="button"
                                        className={`${styles.more} ${styles.moreText}`}
                                        onClick={() => {
                                            navigator('/home/library');
                                        }}
                                    >
                                        更多
                                        {'>'}
                                    </button>
                                </div>
                                <div className={styles.grid4}>
                                    {fileMetas.length === 0 ? (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: '#5E4630' }}>
                                            <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>⏳ 加载中...</h2>
                                            <p style={{ fontSize: '16px', opacity: 0.9 }}>正在加载剧情文件信息</p>
                                        </div>
                                    ) : (
                                        fileMetas.map((meta, idx) => (
                                            <div
                                                className={styles.goodsCard}
                                                key={meta.id}
                                                onClick={() => {
                                                    showGameDetail(meta);
                                                }}
                                            >
                                                <div className={styles.goodsImg}>
                                                    <img
                                                        src={meta.cover_url || `${import.meta.env.BASE_URL}data/events/welcome.png`}
                                                        alt={meta.title || `剧情${idx + 1}`}
                                                    />
                                                </div>
                                                <div className={styles.goodsBody}>
                                                    <div className={styles.goodsTitle}>
                                                        {meta.title || `剧情${idx + 1}`}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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


