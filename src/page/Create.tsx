import React, { useEffect, useState, useMemo } from 'react';
import styles from './Create.module.css';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import GameGrid from '../components/GameGrid';
import { useAuthStore } from '../store/useAuthStore';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import { IoIosArrowForward } from 'react-icons/io';
import { IoEye, IoStatsChartSharp, IoWallet } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import statisticsApi from '../api/statistics/statisticsApi';

const Create: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [stats, setStats] = useState({
        totalCreated: 0,
        totalViews: 0,
        totalClicks: 0,
        totalAmount: 0,
    });

    // 将游戏数据分类为已发布和未发布
    const { publishedGames, draftGames } = useMemo(() => {
        const published: UserGameData[] = [];
        const drafts: UserGameData[] = [];

        fileMetas.forEach((game) => {
            if (game.is_public === 1) {
                published.push(game);
            } else {
                drafts.push(game);
            }
        });

        return {
            publishedGames: published,
            draftGames: drafts,
        };
    }, [fileMetas]);

    // 加载我的游戏数据
    const loadMyGames = async () => {
        if (!user?.user?.id) {
            return;
        }
        try {
            const response = await getGameDataApi.getUserData({ limit: 100 });
            if (response.data.success && response.data.data) {
                setFileMetas(response.data.data);
            }
        } catch (error) {
            console.error('获取我的游戏列表错误:', error);
        }
    };

    const getGameTotalStats = async () => {
        if (!user?.user?.id) {
            return;
        }
        try {
            const response = await statisticsApi.getALLGameStats();
            if (response.data.success && response.data.data) {
                setStats({
                    totalCreated: response.data.data.Count ?? 0,
                    totalViews: response.data.data.pv ?? 0,
                    totalClicks: response.data.data.uv ?? 0,
                    totalAmount: response.data.data.totalAmount ?? 0,
                });
            }
        } catch (error) {
            console.error('获取我的游戏列表错误:', error);
        }
    };

    useEffect(() => {
        loadMyGames();
        getGameTotalStats();
    }, [user?.user.id]);

    // 渲染操作按钮
    const renderGameActions = (game: UserGameData) => {
        // 检查 is_public 的值（0 表示未发布，1 表示已发布）
        const isPublic = game.is_public === 1;
        
        // 未发布或已发布，都跳转到编辑/数据页面
        return (
            <button
                onClick={() => {
                    if (!game.file_id) return;
                    navigate(`/createGame?mode=stats&gameId=${game.file_id}`);
                }}
            >
                {isPublic ? '查看数据' : '继续编辑'}
            </button>
        );
    };

    const userAvatar = `https://kurangames.com/images/${user?.user?.avatarUrl}` || `${import.meta.env.BASE_URL}/data/assets/defaultAvatar.png`;
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
                        <button className={`${styles.createGameButtonItem} ${styles.payButton}`}>
                            <span>充值</span>
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
                                <div className={styles.statValue}>{stats.totalAmount}</div>
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
                            games={publishedGames}
                            showSpecialPrice={false}
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
                            games={draftGames}
                            showSpecialPrice={false}
                            renderActions={renderGameActions}
                        />
                    </div>
                </div>
            </div>
            <MobileBottomNav />

            <FooterArea />
        </div>
    );
};

export default Create;
