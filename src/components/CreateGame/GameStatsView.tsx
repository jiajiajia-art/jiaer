import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoEye } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import type { UserGameData } from '../../api/home/getGameData.type';
import styles from './GameStatsView.module.css';
import { useAuthStore, authModalStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/gameStore';
import createGalgameSessionApi from '../../api/galgame/createGalgameSession';
import GameAction from '../../api/rpgGame/gameAction';
import type { GameStatsResponse } from '../../api/rpgGame/gameAction.Api';
import createWorldSessionApi from '../../api/worldInteraction/createWorldSession';
import { getImageUrl } from '../../utils/constants';
import { addImageTimestamp } from '../../utils/imageCache';
import LoadSaveListModal from './LoadSaveListModal';
import SavePreviewModal from './SavePreviewModal';
import type { SaveSummaryItem } from '../../api/galgame/saves';
import { isMiniProgramEnv } from '../../utils/miniProgram';
import { useTranslation } from 'react-i18next';

const normalizeGameMode = (engine?: string | null, gameTags?: string | null) => {
    const normalizeRaw = (value?: string | null) => {
        if (!value) return '';
        return String(value)
            .trim()
            .replace(/^\[\s*/, '')
            .replace(/\s*\]$/, '')
            .split(',')[0]
            .replace(/^["']|["']$/g, '')
            .trim()
            .toUpperCase();
    };

    const normalizedEngine = normalizeRaw(engine);
    if (normalizedEngine === 'CUSTOM') return 'customif' as const;
    if (normalizedEngine === 'ST') return 'st' as const;
    if (normalizedEngine === 'IVG') return 'interactive-video' as const;
    if (normalizedEngine === 'TXT' || normalizedEngine === 'AVG' || normalizedEngine === 'RPG') return normalizedEngine;

    const normalizedTags = normalizeRaw(gameTags);
    if (normalizedTags === 'CUSTOM') return 'customif' as const;
    if (normalizedTags === 'IVG') return 'interactive-video' as const;
    if (normalizedTags === 'TXT' || normalizedTags === 'AVG' || normalizedTags === 'RPG') return normalizedTags;

    return '';
};

interface GameStatsViewProps {
    gameDetail: UserGameData;
    heroBackground: string;
    onEdit: () => void;
    onDelete: () => void;
    isDeleting: boolean;
    onPublish: () => void;
    onUnpublish: (fileId: string) => void;
}

const GameStatsView: React.FC<GameStatsViewProps> = ({
    gameDetail,
    heroBackground,
    onEdit,
    onDelete,
    isDeleting,
    onPublish,
    onUnpublish,
}) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const { setFileId, setSessionId, setIsPreset } = useGameStore();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [gameStats, setGameStats] = useState<GameStatsResponse>();
    const [isLoadSaveOpen, setIsLoadSaveOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<SaveSummaryItem | null>(null);

    /**
     * 创建会话（按引擎类型分发）。
     * customif：不在此处创建会话，直接跳转到 /customif/:appId，由宿主页创建。
     */
    const createSession = async (fileId: string): Promise<{ sessionId: string | null; redirectUrl: string }> => {
        if (!fileId) {
            console.error('没有 fileId，无法创建 session');
            return { sessionId: null, redirectUrl: '' };
        }

        if (!user?.user?.userId || !user?.user?.id) {
            alert(t('createGame.userInfoError'));
            return { sessionId: null, redirectUrl: '' };
        }

        setIsLoading(true);
        try {
            const normalized = normalizeGameMode(gameDetail?.engine, gameDetail?.game_tags);
            if (!normalized) {
                alert(t('createGame.unknownGameType'));
                return { sessionId: null, redirectUrl: '' };
            }

            if (normalized === 'customif') {
                const appId = gameDetail?.customAppId || gameDetail?.file_id;
                if (!appId) {
                    alert(t('createGame.missingCustomAppIdStart'));
                    return { sessionId: null, redirectUrl: '' };
                }
                // 不创建 session，直接跳转宿主页
                return { sessionId: null, redirectUrl: `/customif/${appId}` };
            }

            if (normalized === 'st') {
                return { sessionId: null, redirectUrl: `/st/${fileId}` };
            }

            if (normalized === 'interactive-video') {
                return { sessionId: null, redirectUrl: `/interactive-video/${fileId}` };
            }

            if (normalized === 'TXT') {
                const response = await createGalgameSessionApi.createGalgameEditSession({ fileId });
                if (response.data.success) {
                    const sessionId = response.data.data.session;
                    return { sessionId, redirectUrl: '/galgame' };
                }
                alert(response.data.message || t('createGame.createGameFailed'));
                return { sessionId: null, redirectUrl: '' };
            }

            if (normalized === 'AVG') {
                const response = await createWorldSessionApi.createWorldEditSession({ fileId });
                if (response.data.success) {
                    const sessionId = response.data.session.sessionId;
                    return { sessionId, redirectUrl: '/galgameMap' };
                }
                alert(response.data.message || t('createGame.createGameFailed'));
                return { sessionId: null, redirectUrl: '' };
            }

            alert(t('createGame.unknownGameType'));
            return { sessionId: null, redirectUrl: '' };
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            alert(t('createGame.createGameFailedRetry'));
            return { sessionId: null, redirectUrl: '' };
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 处理开始游戏按钮点击
     */
    const handleStartGame = async () => {
        if (!user?.user.userId || !user?.user.id) {
            if (!isMiniProgramEnv()) {
                authModalStore.getState().setIsAuthModalOpen(true);
            }
            return;
        }

        const fileId = gameDetail?.file_id || gameDetail?.id;
        if (!fileId) {
            alert(t('createGame.gameInfoError'));
            return;
        }

        // 进入游戏前清理旧状态
        useGameStore.getState().clearAll();

        // 更新 store
        setFileId(fileId);
        setIsPreset(gameDetail?.is_preset == 1);

        // 创建会话
        const { sessionId, redirectUrl } = await createSession(fileId);
        if (redirectUrl) {
            if (sessionId) setSessionId(sessionId);
            navigate(redirectUrl);
        }
    };

    // 读取存档：选择一项后预览
    const handlePreview = (item: SaveSummaryItem) => {
        setPreviewItem(item);
    };

    // 从存档开始游戏
    const handleLoadSave = async (saveId: string) => {
        try {
            const fileId = gameDetail?.file_id || gameDetail?.id;
            if (!fileId) return;
            setIsLoading(true);
            // 进入游戏前清理旧状态
            useGameStore.getState().clearAll();
            const resp = await createGalgameSessionApi.createGalgameEditSession({ fileId, saveId });
            if (resp.data.success) {
                const sessionId = resp.data.data.session;
                setSessionId(sessionId);
                navigate('/galgame', { state: { saveEntry: 'load' } });
                return;
            }
            alert(resp.data.message || t('createGame.loadSaveFailed'));
        } catch (e) {
            console.error('加载存档失败:', e);
            alert(t('createGame.loadSaveFailedRetry'));
        } finally {
            setIsLoading(false);
            setIsLoadSaveOpen(false);
            setPreviewItem(null);
        }
    };

    const getGameStats = async () => {
        const response = await GameAction.getGameStats(gameDetail.file_id);
        if (response.data.success) {
            setGameStats(response.data.data ?? undefined);
        }
    };

    useEffect(() => {
        getGameStats();
    }, [gameDetail.file_id]);

    return (
        <div className={styles.statsModeWrapper}>
            <div
                className={styles.heroBanner}
                style={{ backgroundImage: `url(${addImageTimestamp(getImageUrl(heroBackground))})` }}
            >
                <div className={styles.heroOverlay}>
                    <div className={styles.heroContent}>
                        <div className={styles.heroTitle}>{gameDetail.title || t('createGame.untitledScript')}</div>
                        <div className={styles.heroMeta}>
                            <span className={styles.heroRating}>
                                {(Number(gameDetail.rating_avg ?? 0)).toFixed(1)}
                            </span>
                            <span className={styles.heroMetaLabel}>
                                {(gameDetail.rating_count || 0).toLocaleString()} {t('createGame.reviews')}
                            </span>
                        </div>
                        <div className={styles.heroPrimaryActions}>
                            <button
                                className={`${styles.primaryActionBtn} ${styles.startGameBtn}`}
                                onClick={handleStartGame}
                                disabled={isLoading}
                            >
                                {isLoading ? t('createGame.loading') : t('createGame.startTesting')}
                            </button>

                            {
                                gameDetail.is_public == 0 ?
                                    <button
                                        className={`${styles.primaryActionBtn} ${styles.publishGameBtn}`}
                                        onClick={onPublish}
                                        disabled={isLoading}
                                    >
                                        {t('createGame.publish')}
                                    </button>
                                    : <button
                                        className={`${styles.primaryActionBtn} ${styles.publishGameBtn}`}
                                        onClick={() => onUnpublish(gameDetail.file_id)}
                                        disabled={isLoading}
                                    >
                                        {t('createGame.unpublish')}
                                    </button>
                            }

                            {/* {gameDetail.is_public == 1 && onPriceAdjust && (
                                <button 
                                    className={`${styles.primaryActionBtn} ${styles.publishGameBtn}`} 
                                    onClick={onPriceAdjust}
                                >
                                    价格调整
                                </button>
                            )} */}
                        </div>
                    </div>
                </div>
            </div>
            <div className={styles.heroStatsWrapper}>
                <div className={styles.statsSection}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>
                            <img src={`${import.meta.env.BASE_URL}${t('create.images.myData')}`} alt={t('createGame.myData')} />
                        </div>
                        <img className={styles.sectionDividerDesktop} src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`} alt={t('createGame.divider')} />
                        <button
                            type="button"
                            className={`${styles.more} ${styles.moreText}`}
                        >
                            {t('createGame.statsUpdateDaily')}
                            <img src={`${import.meta.env.BASE_URL}data/assets/home/箭头.png`} alt={t('createGame.arrow')} />
                        </button>
                    </div>
                    <div className={styles.statsGrid}>
                        <div className={styles.statBox}>
                            <div className={styles.statLabel}>
                                <IoEye />
                                <span>{t('createGame.views')}</span>
                            </div>
                            <div className={styles.statValue}>{gameStats?.pv || 0}</div>
                        </div>
                        <div className={styles.statBox}>
                            <div className={styles.statLabel}>
                                <TbHandClick />
                                <span>{t('createGame.clicks')}</span>
                            </div>
                            <div className={styles.statValue}>{gameStats?.pv || 0}</div>
                        </div>
                        <div className={styles.statBox}>
                            <div className={styles.statLabel}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                <span>{t('createGame.earnings')}</span>
                            </div>
                            <div className={styles.statValue}>{gameStats?.count || 0}</div>
                        </div>
                    </div>
                </div>

                <div className={styles.heroActionGroup}>
                    <button
                        className={styles.editGameBtn}
                        onClick={onEdit}
                    >
                        {t('createGame.editGame')}
                    </button>

                    <button
                        className={styles.deleteGameBtn}
                        onClick={onDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? t('createGame.deleting') : t('createGame.deleteGame')}
                    </button>
                </div>
            </div>

            {/* 读取存档 → 列表 → 预览 → 加载 */}
            <LoadSaveListModal
                isOpen={isLoadSaveOpen}
                onClose={() => setIsLoadSaveOpen(false)}
                fileId={gameDetail?.file_id || gameDetail?.id || null}
                onPreview={handlePreview}
            />
            <SavePreviewModal
                isOpen={!!previewItem}
                onClose={() => setPreviewItem(null)}
                item={previewItem}
                onLoad={handleLoadSave}
            />
        </div>
    );
};

export default GameStatsView;
