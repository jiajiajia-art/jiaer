import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Layout/Navbar';
import styles from './CreateGame.module.css';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/useAuthStore';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import GameAction from '../api/rpgGame/gameAction';
import PublishSettingsModal from '../components/CommonModal/PublishSettingsModal';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import GameStatsView from '../components/CreateGame/GameStatsView';
import FooterArea from '../components/Layout/FooterArea';
import toast from 'react-hot-toast';
import PriceAdjustmentModal from '../components/CreateGame/PriceAdjustmentModal';
import { getImageUrl } from '../utils/constants';
import MobileTipModal from '../components/CreateGame/MobileTipModal';
import {
    getMiniProgramCreatorBlockedMessage,
    isMiniProgramEnv,
    MINI_PROGRAM_CREATOR_PC_URL,
    resolveCreatorEngine,
} from '../utils/miniProgram';

const CreateGame: React.FC = () => {
    const [searchParams] = useSearchParams();
    const modeParam = searchParams.get('mode') ?? 'create';
    const gameId = searchParams.get('gameId');
    const isStatsMode = modeParam !== 'create' && !!gameId;




    const [gameDetail, setGameDetail] = useState<UserGameData | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [showMiniProgramTip, setShowMiniProgramTip] = useState(false);
    const [miniProgramTipMessage, setMiniProgramTipMessage] = useState('');

    const defaultHeroCover = `${import.meta.env.BASE_URL}data/events/welcome.png`;
    const heroBackground = gameDetail?.cover_url ? getImageUrl(gameDetail.cover_url) : defaultHeroCover;
    const isPublished = Number(gameDetail?.is_public) === 1;

    const { setFileId, setIsPreset } = useGameStore();
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const handleOpenBindPhoneGuide = () => {
        // 实现跳转到“我的”页并拉起浏览器登录账号设置
        setShowMiniProgramTip(false);
        navigate('/profile?openBrowserLoginAccount=1');
    };


    // 重新获取游戏详情（用于更新价格等数据）
    const refreshGameDetail = useCallback(async () => {
        if (!gameId) return;

        try {
            const response = await getGameDataApi.getGameDetail({
                fileId: gameId,
            });

            if (response.data && response.data.data) {
                const data = response.data.data;
                setGameDetail(data);
            }
        } catch (error) {
            console.error('刷新游戏详情失败:', error);
        }
    }, [gameId]);

    // 根据模式加载游戏详情
    useEffect(() => {
        if (!isStatsMode || !gameId) {
            setGameDetail(null);
            return;
        }

        let isMounted = true;

        const fetchDetail = async () => {
            setIsLoadingDetail(true);
            setDetailError(null);
            try {
                const response = await getGameDataApi.getGameDetail({
                    fileId: gameId,
                });
                if (!isMounted) return;

                if (response.data && response.data.data) {
                    const data = response.data.data;
                    setGameDetail(data);
                } else {
                    setDetailError('未找到游戏详情');
                }
            } catch (error) {
                console.error('加载游戏详情失败:', error);
                if (isMounted) {
                    setDetailError('加载游戏详情失败');
                }
            } finally {
                if (isMounted) {
                    setIsLoadingDetail(false);
                }
            }
        };

        fetchDetail();

        return () => {
            isMounted = false;
        };
    }, [isStatsMode, gameId, user?.user?.id]);

    // 显示删除弹窗
    const handleDeleteGame = () => {
        if (!isStatsMode || !gameId || isDeleting) {
            return;
        }
        setShowDeleteModal(true);
    };

    // 执行删除操作
    const handleConfirmDelete = async () => {
        if (!gameId || isDeleting) {
            return;
        }

        try {
            setIsDeleting(true);
            await GameAction.deleteGame(gameId);
            setShowDeleteModal(false);
            navigate('/create');
        } catch (error) {
            console.error('删除游戏失败:', error);
            alert('删除失败，请稍后重试');
        } finally {
            setIsDeleting(false);
        }
    };

    // 发布游戏：当前不设置积分/价格，统一按免费处理（priceAmount 固定为 0）
    const handlePublishGame = async (description?: string) => {
        if (!gameId) return;
        try {
            const response = await GameAction.publishGame({
                fileId: gameId,
                priceAmount: 0,
                description: description ?? '',
            });

            if (response.data.success) {
                setShowPublishModal(false);
                navigate('/create');
            } else {
                console.error('发布游戏失败:', response.data);
                const errorMessage = response.data.message || '发布游戏失败';
                alert(errorMessage);
            }
        } catch (error: any) {
            console.error('发布游戏失败:', error);
            const errorMessage = error.response?.data?.message || error.message || '发布游戏失败';
            alert(errorMessage);
        }
    };
    // 下架游戏
    const handleUnpublishGame = async (fileId: string) => {
        if (!fileId) return;
        try {
            const response = await GameAction.unpublishGame({ fileId: fileId });
            if (response.data.success) {
                navigate('/create');
            } else {
                toast.error(response.data.message || '下架游戏失败');
            }
        } catch (error) {
            alert('下架游戏失败');
        }
    };

    const editGame = () => {
        const normalizedEngine = resolveCreatorEngine(gameDetail?.engine, gameDetail?.game_tags);
        if (!normalizedEngine || !gameDetail) {
            return;
        }

        if (isMiniProgramEnv() && normalizedEngine !== 'TXT') {
            // 小程序端只能编辑 TXT，已有 AVG / 自定义作品统一引导去 PC 端。
            setMiniProgramTipMessage(getMiniProgramCreatorBlockedMessage(normalizedEngine));
            setShowMiniProgramTip(true);
            return;
        }

        if (normalizedEngine === 'CUSTOM') {
            const appId = gameDetail?.customAppId || gameDetail?.file_id;
            if (!appId) {
                alert('缺少自定义 AppID，无法编辑');
                return;
            }
            // 方案A：跳转到自定义游戏“创建/管理”页面（编辑模式）
            navigate(`/customif/create?appId=${encodeURIComponent(appId)}`);
            return;
        }

        // ST/AVG（自由模式引擎）：跳转到 ST 管理页（编辑模式）
        if (normalizedEngine === 'ST' || normalizedEngine === 'AVG') {
            const appId = (gameDetail as any)?.customAppId || gameDetail?.file_id;
            if (!appId) {
                alert('缺少 AppID，无法编辑');
                return;
            }
            navigate(`/st/create?appId=${encodeURIComponent(appId)}`);
            return;
        }

        // 其他类型按原编辑器处理
        setFileId(gameId);
        setIsPreset(gameDetail?.is_preset == 1);
        navigate(`/gameSettingsEditor`);
    }

    const handleEditGame = () => {
        if (!gameDetail) return;
        editGame();
    };

    const handlePriceAdjust = async (price: number | null, specialPrice: number | null) => {
        try {
            const fileId = gameDetail?.file_id || gameDetail?.id;
            if (!fileId) {
                toast.error('游戏信息错误，请重试');
                return;
            }

            const response = await GameAction.updatePrice({
                fileId,
                price_amount: price,
                special_price_amount: specialPrice,
            });

            if (response.data.success) {
                toast.success('价格更新成功');
                setShowPriceModal(false);
                await refreshGameDetail();
            } else {
                toast.error(response.data.message || '价格更新失败');
            }
        } catch (error) {
            console.error('价格更新失败:', error);
            toast.error('价格更新失败，请稍后重试');
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <div className={styles.gameStatsWrapper}>
                {isStatsMode && (
                    <>
                        {isLoadingDetail ? (
                            <div className={styles.detailLoading}>加载游戏详情中...</div>
                        ) : detailError ? (
                            <div className={styles.detailError}>{detailError}</div>
                        ) : gameDetail ? (
                            <GameStatsView
                                gameDetail={gameDetail}
                                heroBackground={heroBackground}
                                onEdit={handleEditGame}
                                onDelete={handleDeleteGame}
                                isDeleting={isDeleting}
                                onPublish={() => {
                                    if (!isPublished) {
                                        setShowPublishModal(true);
                                    }
                                }}
                                onUnpublish={handleUnpublishGame}
                            />
                        ) : (
                            <div className={styles.detailError}>未找到游戏信息</div>
                        )}
                    </>
                )}
            </div>
            <MobileBottomNav />

            {gameDetail && (
                <PublishSettingsModal
                    isOpen={showPublishModal}
                    onClose={() => setShowPublishModal(false)}
                    onPublish={handlePublishGame}
                    fileId={gameId || undefined}
                    coverUrl={gameDetail?.cover_url}
                    onCoverUploaded={refreshGameDetail}
                />
            )}

            <ConfirmModal
                isOpen={showDeleteModal}
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteModal(false)}
            />

            {gameDetail && (
                <PriceAdjustmentModal
                    isOpen={showPriceModal}
                    onClose={() => setShowPriceModal(false)}
                    currentPrice={gameDetail.price_amount}
                    currentSpecialPrice={gameDetail.special_price_amount}
                    onSave={handlePriceAdjust}
                />
            )}

            <MobileTipModal
                isOpen={showMiniProgramTip}
                onClose={() => setShowMiniProgramTip(false)}
                title="请前往 PC 端操作"
                message={miniProgramTipMessage}
                linkUrl={MINI_PROGRAM_CREATOR_PC_URL}
                bindPhoneActionText="建议先绑定手机号"
                bindPhoneActionHint="绑定后可在小程序端和 PC 端使用同一个账号。"
                onBindPhoneAction={handleOpenBindPhoneGuide}
            />

            <FooterArea />
        </div>
    );
};

export default CreateGame;
