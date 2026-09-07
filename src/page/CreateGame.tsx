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
import PublishSettingsModal, { type PublishSubmitPayload } from '../components/CommonModal/PublishSettingsModal';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import GameStatsView from '../components/CreateGame/GameStatsView';
import FooterArea from '../components/Layout/FooterArea';
import toast from 'react-hot-toast';
import PriceAdjustmentModal from '../components/CreateGame/PriceAdjustmentModal';
import { getImageUrl } from '../utils/constants';
import { resolveGameCoverUrl } from '../utils/displayCoverUrl';
import MobileTipModal from '../components/CreateGame/MobileTipModal';
import {
    getMiniProgramCreatorBlockedMessage,
    isMiniProgramEnv,
    MINI_PROGRAM_CREATOR_PC_URL,
    resolveCreatorEngine,
} from '../utils/miniProgram';
import { isNovelEngine, getNovelSourceFileId, resolvePublishButtonAction } from '../utils/novelGame';
import {
    buildCreatorPlaySessionRequest,
    buildGalgameContinueNavigate,
    parseOpticalPlaySessionId,
    resolveContinuePlayFileId,
    shouldContinuePlayOnEdit,
} from '../utils/creatorContinuePlay';
import createGalgameSessionApi from '../api/galgame/createGalgameSession';
import { useTranslation } from 'react-i18next';
const CreateGame: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const modeParam = searchParams.get('mode') ?? 'create';
    const gameId = searchParams.get('gameId');
    const isStatsMode = modeParam !== 'create' && !!gameId;




    const [gameDetail, setGameDetail] = useState<UserGameData | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishModalMode, setPublishModalMode] = useState<'publish' | 'novel-edit'>('publish');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [showMiniProgramTip, setShowMiniProgramTip] = useState(false);
    const [miniProgramTipMessage, setMiniProgramTipMessage] = useState('');

    const defaultHeroCover = `${import.meta.env.BASE_URL}data/events/welcome.png`;
    // 功能注释：详情/创建页 hero 背景统一走 display-cover/cover.webp，禁止直接加载 cover.png 原图
    const heroCoverPath = resolveGameCoverUrl({
        display_cover_url: gameDetail?.display_cover_url,
        cover_url: gameDetail?.cover_url,
    });
    const heroBackground = heroCoverPath ? getImageUrl(heroCoverPath) : defaultHeroCover;
    const isPublished = Number(gameDetail?.is_public) === 1;

    const { setFileId, setSessionId, setIsPreset } = useGameStore();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [isContinueLoading, setIsContinueLoading] = useState(false);

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
                    const currentUserId = user?.user?.userId;
                    if (
                        currentUserId != null &&
                        String(data.creator_user_id) !== String(currentUserId)
                    ) {
                        navigate(`/game/${encodeURIComponent(gameId)}`);
                        return;
                    }
                    setGameDetail(data);
                } else {
                    setDetailError(t('createGame.gameNotFound'));
                }
            } catch (error: any) {
                console.error('加载游戏详情失败:', error);
                if (isMounted) {
                    const status = error?.response?.status;
                    if (status === 403 || status === 401) {
                        toast.error(t('createGame.gameNotPublic'));
                    } else {
                        setDetailError(t('createGame.loadGameDetailsFailed'));
                    }
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
            toast.error(t('createGame.deleteFailed'));
        } finally {
            setIsDeleting(false);
        }
    };

    // 发布游戏：当前不设置积分/价格，统一按免费处理（priceAmount 固定为 0）
    const handlePublishGame = async (payload: PublishSubmitPayload) => {
        if (!gameId) return;
        try {
            const response = await GameAction.publishGame({
                fileId: gameId,
                priceAmount: 0,
                description: payload.description ?? '',
                shareType: payload.shareType,
                versionNotes: payload.versionNotes,
                notifyFavoritedUsers: payload.notifyFavoritedUsers,
            });

            if (response.data.success) {
                setShowPublishModal(false);
                navigate('/create');
            } else {
                console.error('发布游戏失败:', response.data);
                const errorMessage = response.data.message || t('createGame.publishFailed');
                setNoticeMessage(errorMessage);
            }
        } catch (error: any) {
            console.error('发布游戏失败:', error);
            const errorMessage = error.response?.data?.message || error.message || t('createGame.publishFailed');
            setNoticeMessage(errorMessage);
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
                toast.error(response.data.message || t('createGame.unpublishFailed'));
            }
        } catch (error) {
            toast.error(t('createGame.unpublishFailed'));
        }
    };

    /**
     * 视觉小说「编辑修改」：optical 续玩进 /galgame，载入历史接着玩（不弹历史面板）。
     */
    const continueCreatorPlaytest = async () => {
        if (!gameDetail) return;

        if (!user?.user?.userId || !user?.user?.id) {
            toast.error(t('createGame.userInfoError'));
            return;
        }

        const playFileId = resolveContinuePlayFileId({
            engine: gameDetail.engine,
            gameTags: gameDetail.game_tags,
            fileId: gameDetail.file_id || gameDetail.id,
            id: gameDetail.id,
            sourceFileId: getNovelSourceFileId(gameDetail) || undefined,
        });
        if (!playFileId) {
            toast.error(
                isNovelEngine(gameDetail.engine, gameDetail.game_tags)
                    ? t('createGame.sourceGameMissing')
                    : t('createGame.gameInfoError'),
            );
            return;
        }

        setIsContinueLoading(true);
        try {
            useGameStore.getState().clearAll();
            setFileId(playFileId);
            setIsPreset(gameDetail.is_preset == 1);

            const payload = buildCreatorPlaySessionRequest({
                intent: 'edit-continue',
                fileId: playFileId,
                source: 'other',
            });
            const response = await createGalgameSessionApi.createGalgamePlaySession(payload);
            if (!response.data?.success) {
                toast.error(response.data?.message || t('createGame.createGameFailed'));
                return;
            }
            const sessionId = parseOpticalPlaySessionId(response.data.data);
            if (!sessionId) {
                toast.error(t('createGame.createGameFailed'));
                return;
            }
            setSessionId(sessionId);
            const nav = buildGalgameContinueNavigate();
            navigate(nav.path, { state: nav.state });
        } catch (error) {
            console.error('创作台续玩失败:', error);
            toast.error(t('createGame.createGameFailedRetry'));
        } finally {
            setIsContinueLoading(false);
        }
    };

    /** AI文游 / 非小说：进各引擎编辑页（设定/宿主/影片等）。 */
    const editGameSettingsOrHost = () => {
        if (!gameDetail) {
            return;
        }

        const normalizedEngine = resolveCreatorEngine(gameDetail.engine, gameDetail.game_tags);
        if (!normalizedEngine) {
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
                toast.error(t('createGame.missingCustomAppId'));
                return;
            }
            navigate(`/customif/create?appId=${encodeURIComponent(appId)}`);
            return;
        }

        if (normalizedEngine === 'ST' || normalizedEngine === 'AVG') {
            const appId = (gameDetail as any)?.customAppId || gameDetail?.file_id;
            if (!appId) {
                toast.error(t('createGame.missingAppId'));
                return;
            }
            navigate(`/st/create?appId=${encodeURIComponent(appId)}`);
            return;
        }

        if (normalizedEngine === 'IVG') {
            const fileId = gameDetail?.file_id || gameDetail?.id;
            if (fileId) {
                navigate(`/interactive-video/edit/${encodeURIComponent(fileId)}`);
            }
            return;
        }

        setFileId(gameId);
        setIsPreset(gameDetail?.is_preset == 1);
        navigate(`/gameSettingsEditor`);
    };

    const handleEditGame = () => {
        if (!gameDetail || isContinueLoading) return;
        if (shouldContinuePlayOnEdit(gameDetail.engine, gameDetail.game_tags)) {
            void continueCreatorPlaytest();
            return;
        }
        editGameSettingsOrHost();
    };

    const handlePriceAdjust = async (price: number | null, specialPrice: number | null) => {
        try {
            const fileId = gameDetail?.file_id || gameDetail?.id;
            if (!fileId) {
                toast.error(t('createGame.gameInfoError'));
                return;
            }

            const response = await GameAction.updatePrice({
                fileId,
                price_amount: price,
                special_price_amount: specialPrice,
            });

            if (response.data.success) {
                toast.success(t('createGame.priceUpdateSuccess'));
                setShowPriceModal(false);
                await refreshGameDetail();
            } else {
                toast.error(response.data.message || t('createGame.priceUpdateFailed'));
            }
        } catch (error) {
            console.error('价格更新失败:', error);
                toast.error(t('createGame.priceUpdateFailed'));
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <div className={styles.gameStatsWrapper}>
                {isStatsMode && (
                    <>
                        {isLoadingDetail ? (
                            <div className={styles.detailLoading}>{t('createGame.loadingGameDetails')}</div>
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
                                    // 功能注释：已发布也要打开上架设置；旧逻辑 if (!isPublished) 会导致点击无反应
                                    const action = resolvePublishButtonAction({
                                        isNovel: isNovelEngine(gameDetail.engine, gameDetail.game_tags),
                                        isPublished,
                                    });
                                    setPublishModalMode(action.mode);
                                    setShowPublishModal(true);
                                }}
                                onUnpublish={handleUnpublishGame}
                                isNovel={isNovelEngine(gameDetail.engine, gameDetail.game_tags)}
                                sourceFileId={getNovelSourceFileId(gameDetail)}
                                isEditContinuing={isContinueLoading}
                            />
                        ) : (
                            <div className={styles.detailError}>{t('createGame.gameNotFound')}</div>
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
                    mode={publishModalMode}
                    isNovel={isNovelEngine(gameDetail.engine, gameDetail.game_tags)}
                    onCoverUploaded={refreshGameDetail}
                    onSaved={refreshGameDetail}
                    gameTags={gameDetail?.game_tags}
                    engine={gameDetail?.engine}
                />
            )}

            <ConfirmModal
                isOpen={showDeleteModal}
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteModal(false)}
            />

            <ConfirmModal
                variant="alert"
                isOpen={Boolean(noticeMessage)}
                title={t('common.noticeTitle')}
                message={noticeMessage || ''}
                confirmButtonText={t('common.gotIt')}
                onConfirm={() => setNoticeMessage(null)}
                onCancel={() => setNoticeMessage(null)}
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
                title={t('createGame.redirectToPC')}
                message={miniProgramTipMessage}
                linkUrl={MINI_PROGRAM_CREATOR_PC_URL}
                bindPhoneActionText={t('createGame.bindPhoneFirst')}
                bindPhoneActionHint={t('createGame.bindPhoneTip')}
                onBindPhoneAction={handleOpenBindPhoneGuide}
            />

            <FooterArea />
        </div>
    );
};

export default CreateGame;
