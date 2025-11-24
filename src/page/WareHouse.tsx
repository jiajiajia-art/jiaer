import React, { useState, useEffect } from 'react';
import styles from './WareHouse.module.css';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import GameGrid from '../components/GameGrid';
import GameDetailModal from '../components/GameDetailModal';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore } from '../store/useAuthStore';
import FooterArea from '../components/Layout/FooterArea';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';

const WareHouse: React.FC = () => {
    const [games, setGames] = useState<UserGameData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showGameModal, setShowGameModal] = useState(false);
    const [selectedGame, setSelectedGame] = useState<UserGameData | null>(null);
    const { user } = useAuthStore();

    // 获取游戏数据
    useEffect(() => {
        const loadGames = async () => {
            setIsLoading(true);
            try {
                const response = await libraryDataApi.getGameData({
                    userId: String(user?.user.id) || ''
                });

                if (response.data.success && response.data.data) {
                    setGames(response.data.data);
                } else {
                    console.error('获取游戏列表失败:', response.data);
                    setGames([]);
                }
            } catch (error) {
                console.error('获取游戏列表错误:', error);
                setGames([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadGames();
    }, [user?.user.id]);

    // 显示游戏详情
    const showGameDetail = (game: UserGameData) => {
        setSelectedGame(game);
        setShowGameModal(true);
    };

    // 关闭弹窗
    const closeModal = () => {
        setShowGameModal(false);
        setSelectedGame(null);
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

    const renderGameActions = (game: UserGameData) => {
        return (
            <button
                onClick={() => {
                    if (!game.file_id) return;
                    setSelectedGame(game);
                    setShowGameModal(true);
                }}
            >
                开始游戏
            </button>
        );
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.mainContent}>
                <div className={styles.main}>
                    {isLoading ? (
                        <GameGridSkeleton count={8} />
                    ) : (
                        <GameGrid
                            games={games}
                            showSpecialPrice={false}
                            onGameClick={showGameDetail}
                            renderActions={renderGameActions}
                        />
                    )}
                </div>
            </div>

            <FooterArea />

            {selectedGame && (
                <GameDetailModal
                    isOpen={showGameModal}
                    game={selectedGame}
                    onClose={closeModal}
                />
            )}

            <MobileBottomNav />
        </div>
    );
};

export default WareHouse;

