import React, { useEffect, useState } from 'react';
import styles from './Create.module.css';
import gameGridStyles from '../components/GameGrid.module.css';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import GameGrid from '../components/GameGrid';
import GameDetailModal from '../components/GameDetailModal';
import PublishSettingsModal from '../components/goodsModal/PublishSettingsModal';
import { useAuthStore } from '../store/useAuthStore';
import getGameDataApi from '../api/home/getGameData';
import GameAction from '../api/game/gameAction';
import type { UserGameData } from '../api/home/getGameData.type';
import { IoIosArrowForward } from 'react-icons/io';
import { IoEye, IoStatsChartSharp, IoWallet } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';

const Create: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [showGameModal, setShowGameModal] = useState(false);
    const [selectedGameMeta, setSelectedGameMeta] = useState<UserGameData | null>(null);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [currentGame, setCurrentGame] = useState<UserGameData | null>(null);
    const [stats, setStats] = useState({
        totalCreated: 0,
        totalViews: 0,
        totalClicks: 0,
        totalRevenue: 0,
    });

    // 加载我的游戏数据
    const loadMyGames = async () => {
        if (!user?.user?.id) {
            return;
        }

        try {
            const response = await getGameDataApi.getUserData(user.user.id, { limit: 100 });
            if (response.data.success && response.data.data) {
                setFileMetas(response.data.data);
                // 计算统计数据
                const games = response.data.data;
                setStats({
                    totalCreated: games.length,
                    totalViews: games.reduce((sum: number, game: UserGameData) => sum + (game.rating_count || 0), 0),
                    totalClicks: games.reduce((sum: number, game: UserGameData) => sum + (game.like_count || 0), 0),
                    totalRevenue: games.reduce((sum: number, game: UserGameData) => sum + ((game.price_amount || 0) * (game.rating_count || 0)), 0),
                });
            }
        } catch (error) {
            console.error('获取我的游戏列表错误:', error);
        }
    };

    useEffect(() => {
        loadMyGames();
    }, [user?.user.id]);

    const showGameDetail = (meta: UserGameData) => {
        setSelectedGameMeta(meta);
        setShowGameModal(true);
    };

    const closeModal = () => {
        setShowGameModal(false);
        setSelectedGameMeta(null);
    };

    // 发布游戏
    const handlePublish = async (price: number | null, isFree: boolean) => {
        if (!currentGame) return;

        try {
            const priceAmount = isFree ? 0 : (price || 0);
            const response = await GameAction.publishGame({
                fileId: currentGame.file_id || '',
                priceAmount: priceAmount,
            });

            if (response.data.success) {
                await loadMyGames();
                setShowPublishModal(false);
                setCurrentGame(null);
            } else {
                console.error('发布游戏失败:', response.data);
            }
        } catch (error) {
            console.error('发布游戏失败:', error);
        }
    };

    // 渲染操作按钮
    const renderGameActions = (game: UserGameData) => {
        // 检查 is_public 的值（0 表示未发布，1 表示已发布）
        const isPublic = game.is_public === 1;
        
        if (!isPublic) {
            // 未发布，显示发布按钮
            return (
                <button
                    className={gameGridStyles.gameDataBtn}
                    onClick={() => {
                        setCurrentGame(game);
                        setShowPublishModal(true);
                    }}
                >
                    发布
                </button>
            );
        } else {
            // 已发布，显示数据按钮，跳转到编辑/数据页面
            return (
                <button
                    className={gameGridStyles.gameDataBtn}
                    onClick={() => {
                        if (!game.file_id) return;
                        navigate(`/createGame?mode=stats&gameId=${game.file_id}`);
                    }}
                >
                    数据
                </button>
            );
        }
    };

    const userAvatar = `${import.meta.env.BASE_URL}/data/assets/defaultAvatar.png`;
    const userName = user?.user?.nickname || user?.user?.name || '未设置';

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.mainContent}>
                <div className={styles.main}>
                    {/* 创作游戏按钮 */}
                    <div className={styles.createGameButton}>
                        <button className={styles.createGameButtonItem} onClick={() => {
                            navigate('/createGame');
                        }}>
                            <HiOutlineLightBulb />
                            <span>创作游戏</span>
                        </button>
                    </div>

                    {/* 用户信息展示区域 */}
                    <div className={styles.userProfileSection}>
                        <div className={styles.userProfileBackground}>
                            <div
                                className={styles.userProfileBlur}
                                style={{
                                    backgroundImage: `url(${userAvatar})`,
                                }}
                            />
                            <div className={styles.userProfileContent}>
                                <img
                                    className={styles.userAvatar}
                                    src={userAvatar}
                                    alt="用户头像"
                                />
                                <div className={styles.userName}>{userName}</div>
                            </div>
                        </div>
                    </div>

                    {/* 我的数据模块 */}
                    <div className={styles.statsSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>我的数据</div>
                            <hr />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                            >
                                每晚12:00更新
                                <IoIosArrowForward />
                            </button>
                        </div>
                        <div className={styles.statsGrid}>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoStatsChartSharp />
                                    <span>创作总数</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalCreated}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoEye />
                                    <span>总浏览量</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalViews}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <TbHandClick />
                                    <span>总点击</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalClicks}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoWallet />
                                    <span>总收益</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalRevenue}</div>
                            </div>
                        </div>
                    </div>

                    {/* 发布作品模块 */}
                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>发布作品</div>
                            <hr />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                            >
                                更多
                                <IoIosArrowForward />
                            </button>
                        </div>
                        <GameGrid
                            games={fileMetas}
                            showSpecialPrice={false}
                            onGameClick={showGameDetail}
                            renderActions={renderGameActions}
                        />
                    </div>

                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>草稿箱</div>
                            <hr />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                            >
                                更多
                                <IoIosArrowForward />
                            </button>
                        </div>
                        <GameGrid
                            games={fileMetas}
                            showSpecialPrice={false}
                            onGameClick={showGameDetail}
                            renderActions={renderGameActions}
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

            {currentGame && (
                <PublishSettingsModal
                    isOpen={showPublishModal}
                    game={currentGame}
                    onClose={() => {
                        setShowPublishModal(false);
                        setCurrentGame(null);
                    }}
                    onPublish={handlePublish}
                />
            )}

        </div>
    );
};

export default Create;
