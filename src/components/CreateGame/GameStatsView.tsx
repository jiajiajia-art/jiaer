import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    IoChatbubbleEllipses,
    IoEye,
    IoGameControllerOutline,
    IoShareSocial,
    IoStatsChartSharp,
    IoTime,
} from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import { PiCurrencyCnyBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import type { UserGameData } from '../../api/home/getGameData.type';
import styles from './GameStatsView.module.css';
import { useAuthStore, authModalStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/gameStore';
import createGalgameSessionApi from '../../api/galgame/createGalgameSession';
import GameAction from '../../api/rpgGame/gameAction';
import type { GameStatsResponse } from '../../api/rpgGame/gameAction.Api';
import creatorStatsApi, { type CreatorWorkDetail } from '../../api/stats/creatorStatsApi';
import CreatorWorkDetailSections from '../stats/CreatorWorkDetailSections';
import createWorldSessionApi from '../../api/worldInteraction/createWorldSession';
import { getImageUrl } from '../../utils/constants';
import { addImageTimestamp } from '../../utils/imageCache';
import LoadSaveListModal from './LoadSaveListModal';
import SavePreviewModal from './SavePreviewModal';
import type { SaveSummaryItem } from '../../api/galgame/saves';
import { isMiniProgramEnv } from '../../utils/miniProgram';
import { prefetchGalgameDocument } from '../../lib/galgame/galgameDocumentCache';
import {
    buildCreatorPlaySessionRequest,
    normalizeCreatorPlayMode,
    parseOpticalPlaySessionId,
    shouldOpenCreatorStartOptions,
    type CreatorPlayIntent,
} from '../../utils/creatorContinuePlay';
import { buildNovelReadPath } from '../../utils/novelGame';
import {
    buildGameDetailMetaLine,
    formatCreatorOverviewCount,
    resolveGameDetailTags,
} from '../../lib/gameDetailView';
import { useTranslation } from 'react-i18next';
import getGameDataApi from '../../api/home/getGameData';

const DEFAULT_PLAY_STATUS = {
    hasContinueState: false,
    hasSave: false,
};

const formatPlayDuration = (seconds: number) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

interface GameStatsViewProps {
    gameDetail: UserGameData;
    heroBackground: string;
    onEdit: () => void;
    onDelete: () => void;
    isDeleting: boolean;
    onPublish: () => void;
    onUnpublish: (fileId: string) => void;
    isNovel?: boolean;
    sourceFileId?: string;
    /** 编辑修改续玩中：禁用按钮防重复点击 */
    isEditContinuing?: boolean;
}

const GameStatsView: React.FC<GameStatsViewProps> = ({
    gameDetail,
    heroBackground,
    onEdit,
    onDelete,
    isDeleting,
    onPublish,
    onUnpublish,
    isNovel = false,
    sourceFileId: _sourceFileId = '',
    isEditContinuing = false,
}) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const { setFileId, setSessionId, setIsPreset } = useGameStore();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [gameStats, setGameStats] = useState<GameStatsResponse>();
    const [workDetail, setWorkDetail] = useState<CreatorWorkDetail | null>(null);
    const [isStatsLoading, setIsStatsLoading] = useState(true);
    const [isLoadSaveOpen, setIsLoadSaveOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState<SaveSummaryItem | null>(null);
    const [isStartOptionsOpen, setIsStartOptionsOpen] = useState(false);
    const [isPlayStatusLoading, setIsPlayStatusLoading] = useState(false);
    const [playStatus, setPlayStatus] = useState(DEFAULT_PLAY_STATUS);
    const [showAllStats, setShowAllStats] = useState(false);

    const isPublished = Number(gameDetail.is_public) === 1;
    const heroTags = useMemo(() => resolveGameDetailTags(gameDetail), [gameDetail]);
    const heroMetaLine = useMemo(
        // 功能注释：创作者看自己的作品不展示「由 xxx 制作」，仅保留章节/时长等客观信息
        () => buildGameDetailMetaLine(
            {
                title: gameDetail.title,
                subtitle: gameDetail.subtitle,
                chapter_count: (gameDetail as { chapter_count?: unknown }).chapter_count,
                duration_minutes: (gameDetail as { duration_minutes?: unknown }).duration_minutes,
            },
            {
                producedBy: (author) => t('gameDetail.producedBy', { author }),
                chapterUnit: t('gameDetail.chapterUnit'),
                minuteUnit: t('gameDetail.minuteUnit'),
            },
        ),
        [gameDetail, t],
    );
    const ratingText = `${(Number(gameDetail.rating_avg ?? 0)).toFixed(1)}${t('gameDetail.ratingUnit')}`;
    const commentText = t('createGame.reviewsCount', {
        count: (gameDetail.rating_count || 0).toLocaleString(),
    });

    /**
     * 创建会话（按引擎类型分发）。
     * - TXT「新的开始」：optical + restart
     * - TXT「继续体验」：optical 续玩（restart=false）
     * - NOVEL「开始测试」进入小说阅读页（不进原作 AI 文游）
     * - customif：不在此处创建会话，直接跳转到 /customif/:appId，由宿主页创建。
     */
    const createSession = async (
        fileId: string,
        intent: CreatorPlayIntent = 'start-test',
    ): Promise<{ sessionId: string | null; redirectUrl: string }> => {
        if (!fileId) {
            console.error('没有 fileId，无法创建 session');
            return { sessionId: null, redirectUrl: '' };
        }

        if (!user?.user?.userId || !user?.user?.id) {
            toast.error(t('createGame.userInfoError'));
            return { sessionId: null, redirectUrl: '' };
        }

        setIsLoading(true);
        try {
            const normalized = normalizeCreatorPlayMode(gameDetail?.engine, gameDetail?.game_tags);
            if (!normalized) {
                toast.error(t('createGame.unknownGameType'));
                return { sessionId: null, redirectUrl: '' };
            }

            if (normalized === 'customif') {
                const appId = gameDetail?.customAppId || gameDetail?.file_id;
                if (!appId) {
                    toast.error(t('createGame.missingCustomAppIdStart'));
                    return { sessionId: null, redirectUrl: '' };
                }
                return { sessionId: null, redirectUrl: `/customif/${appId}` };
            }

            if (normalized === 'st') {
                return { sessionId: null, redirectUrl: `/st/${fileId}` };
            }

            if (normalized === 'interactive-video') {
                return { sessionId: null, redirectUrl: `/interactive-video/${fileId}` };
            }

            if (normalized === 'TXT') {
                const payload = buildCreatorPlaySessionRequest({
                    intent,
                    fileId,
                    source: 'other',
                });
                const response = await createGalgameSessionApi.createGalgamePlaySession(payload);
                if (response.data.success) {
                    const sessionId = parseOpticalPlaySessionId(response.data.data);
                    return { sessionId, redirectUrl: '/galgame' };
                }
                toast.error(response.data.message || t('createGame.createGameFailed'));
                return { sessionId: null, redirectUrl: '' };
            }

            if (normalized === 'NOVEL') {
                // 视觉小说测玩 = 阅读本作品，不再跳转原作 /galgame
                return { sessionId: null, redirectUrl: buildNovelReadPath(fileId) };
            }

            if (normalized === 'AVG') {
                const response = await createWorldSessionApi.createWorldEditSession({ fileId });
                if (response.data.success) {
                    const sessionId = response.data.session.sessionId;
                    return { sessionId, redirectUrl: '/galgameMap' };
                }
                toast.error(response.data.message || t('createGame.createGameFailed'));
                return { sessionId: null, redirectUrl: '' };
            }

            toast.error(t('createGame.unknownGameType'));
            return { sessionId: null, redirectUrl: '' };
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            toast.error(t('createGame.createGameFailedRetry'));
            return { sessionId: null, redirectUrl: '' };
        } finally {
            setIsLoading(false);
        }
    };

    const enterGameWithIntent = async (intent: CreatorPlayIntent) => {
        if (!user?.user.userId || !user?.user.id) {
            if (!isMiniProgramEnv()) {
                authModalStore.getState().setIsAuthModalOpen(true);
            }
            return;
        }

        const fileId = gameDetail?.file_id || gameDetail?.id;
        if (!fileId) {
            toast.error(t('createGame.gameInfoError'));
            return;
        }

        useGameStore.getState().clearPlayRuntime();
        setFileId(fileId);
        setIsPreset(gameDetail?.is_preset == 1);
        if (gameDetail) {
            useGameStore.getState().setGameDetail(gameDetail);
        }
        prefetchGalgameDocument(fileId);

        const { sessionId, redirectUrl } = await createSession(fileId, intent);
        if (redirectUrl) {
            if (sessionId) setSessionId(sessionId);
            navigate(redirectUrl);
        }
    };

    const fetchPlayStatus = async () => {
        const fileId = gameDetail?.file_id || gameDetail?.id;
        if (!fileId) {
            return DEFAULT_PLAY_STATUS;
        }

        try {
            const response = await getGameDataApi.getPlayStatus(fileId);
            if (response.data?.success && response.data?.data) {
                return {
                    hasContinueState: !!response.data.data.hasContinueState,
                    hasSave: !!response.data.data.hasSave,
                };
            }
            toast.error(response.data?.message || t('gameDetail.getPlayStatusFailed'));
        } catch (error) {
            console.error('获取游玩状态失败:', error);
            toast.error(t('gameDetail.getPlayStatusFailed'));
        }

        return DEFAULT_PLAY_STATUS;
    };

    /**
     * AI文游：弹出与详情页一致的开始方式；其它类型仍直接开始测试。
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
            toast.error(t('createGame.gameInfoError'));
            return;
        }

        if (shouldOpenCreatorStartOptions(gameDetail?.engine, gameDetail?.game_tags)) {
            setIsPlayStatusLoading(true);
            try {
                const status = await fetchPlayStatus();
                setPlayStatus(status);
                setIsStartOptionsOpen(true);
            } finally {
                setIsPlayStatusLoading(false);
            }
            return;
        }

        await enterGameWithIntent('start-test');
    };

    const closeStartOptions = () => setIsStartOptionsOpen(false);

    const handleStartNewFromOptions = async () => {
        closeStartOptions();
        await enterGameWithIntent('start-test');
    };

    const handleContinueFromOptions = async () => {
        closeStartOptions();
        await enterGameWithIntent('continue-play');
    };

    const handleOpenLoadSaveFromOptions = () => {
        closeStartOptions();
        setIsLoadSaveOpen(true);
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
            // 进入游戏前清理旧状态；必须同时写回 fileId + sessionId，否则 Galgame 会卡在「正在获取数据」
            useGameStore.getState().clearAll();
            prefetchGalgameDocument(fileId);
            const resp = await createGalgameSessionApi.createGalgameEditSession({ fileId, saveId });
            if (resp.data.success) {
                const sessionId = resp.data.data.session;
                setFileId(fileId);
                setSessionId(sessionId);
                setIsPreset(gameDetail?.is_preset == 1);
                navigate('/galgame', { state: { saveEntry: 'load' } });
                return;
            }
            toast.error(resp.data.message || t('createGame.loadSaveFailed'));
        } catch (e) {
            console.error('加载存档失败:', e);
            toast.error(t('createGame.loadSaveFailedRetry'));
        } finally {
            setIsLoading(false);
            setIsLoadSaveOpen(false);
            setPreviewItem(null);
        }
    };

    const loadWorkStats = async () => {
        const fileId = gameDetail.file_id || gameDetail.id;
        if (!fileId) return;

        setIsStatsLoading(true);
        try {
            const [legacyResp, detailResp] = await Promise.all([
                GameAction.getGameStats(fileId),
                creatorStatsApi.getWorkDetail(fileId, { commentLimit: 30 }),
            ]);
            if (legacyResp.data.success) {
                setGameStats(legacyResp.data.data ?? undefined);
            }
            if (detailResp.data.success) {
                setWorkDetail(detailResp.data.data);
            }
        } catch (error) {
            console.error('[GameStatsView] load stats failed', error);
        } finally {
            setIsStatsLoading(false);
        }
    };

    useEffect(() => {
        void loadWorkStats();
    }, [gameDetail.file_id, gameDetail.id]);

    return (
        <div className={styles.statsModeWrapper}>
            <div
                className={styles.heroBanner}
                style={{ backgroundImage: `url(${addImageTimestamp(getImageUrl(heroBackground))})` }}
            >
                <div className={styles.heroOverlay}>
                    <div className={styles.heroContent}>
                        {heroTags.length > 0 ? (
                            <div className={styles.heroTags}>
                                {heroTags.map((tag) => (
                                    <span key={tag} className={styles.heroTag}>{tag}</span>
                                ))}
                            </div>
                        ) : null}
                        <div className={styles.heroTitleRow}>
                            <h1 className={styles.heroTitle}>{gameDetail.title || t('createGame.untitledScript')}</h1>
                            <span className={styles.ratingBadge}>{ratingText}</span>
                        </div>
                        {heroMetaLine ? <p className={styles.heroMetaLine}>{heroMetaLine}</p> : null}
                        <p className={styles.heroComments}>{commentText}</p>
                    </div>
                </div>
            </div>

            <div className={styles.bodyShell}>
                <button
                    type="button"
                    className={styles.primaryStartBtn}
                    onClick={() => void handleStartGame()}
                    disabled={isLoading || isPlayStatusLoading}
                >
                    <IoGameControllerOutline aria-hidden="true" />
                    <span>
                        {isLoading || isPlayStatusLoading ? t('createGame.loading') : t('createGame.startPlaying')}
                    </span>
                </button>

                <div className={styles.secondaryActions}>
                    <button
                        type="button"
                        className={styles.secondaryActionBtn}
                        onClick={onEdit}
                        disabled={isLoading || isEditContinuing || isDeleting}
                    >
                        {isEditContinuing ? t('createGame.loading') : t('createGame.edit')}
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryActionBtn}
                        onClick={onDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? t('createGame.deleting') : t('createGame.delete')}
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryActionBtn}
                        onClick={() => onUnpublish(gameDetail.file_id)}
                        disabled={isLoading || !isPublished}
                    >
                        {isNovel ? t('createGame.unlistFromShelf') : t('createGame.unpublish')}
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryActionBtn}
                        onClick={onPublish}
                        disabled={isLoading}
                    >
                        {isNovel && !isPublished ? t('createGame.listOnShelf') : t('createGame.publishWork')}
                    </button>
                </div>

                <section className={styles.overviewCard}>
                    <div className={styles.overviewHeader}>
                        <div className={styles.overviewTitleBlock}>
                            <h2 className={styles.overviewTitle}>{t('createGame.dataOverview')}</h2>
                            <span className={styles.overviewHint}>({t('createGame.statsUpdateDaily')})</span>
                        </div>
                        <button
                            type="button"
                            className={styles.overviewViewAll}
                            onClick={() => setShowAllStats((prev) => !prev)}
                        >
                            {showAllStats ? t('createGame.myData') : t('createGame.viewAllStats')}
                            <span aria-hidden="true"> ›</span>
                        </button>
                    </div>

                    {isStatsLoading ? (
                        <div className={styles.statsLoading}>{t('creatorStats.loading')}</div>
                    ) : (
                        <div className={styles.overviewGrid}>
                            <div className={styles.overviewItem}>
                                <span className={styles.overviewIcon}><IoStatsChartSharp /></span>
                                <span className={styles.overviewLabel}>{t('createGame.playVolume')}</span>
                                <span className={styles.overviewValue}>
                                    {formatCreatorOverviewCount(workDetail?.playCount ?? 0)}
                                </span>
                            </div>
                            <div className={styles.overviewDivider} aria-hidden="true" />
                            <div className={styles.overviewItem}>
                                <span className={styles.overviewIcon}><IoEye /></span>
                                <span className={styles.overviewLabel}>{t('createGame.clickVolume')}</span>
                                <span className={styles.overviewValue}>
                                    {formatCreatorOverviewCount(workDetail?.pv ?? gameStats?.pv ?? 0)}
                                </span>
                            </div>
                            <div className={styles.overviewDivider} aria-hidden="true" />
                            <div className={styles.overviewItem}>
                                <span className={styles.overviewIcon}><PiCurrencyCnyBold /></span>
                                <span className={styles.overviewLabel}>{t('createGame.earnings')}</span>
                                <span className={styles.overviewValue}>
                                    {formatCreatorOverviewCount(gameStats?.count ?? workDetail?.spendPoints ?? 0)}
                                </span>
                            </div>
                            <div className={styles.overviewDivider} aria-hidden="true" />
                            <div className={styles.overviewItem}>
                                <span className={styles.overviewIcon}><IoShareSocial /></span>
                                <span className={styles.overviewLabel}>{t('createGame.shareVolume')}</span>
                                <span className={styles.overviewValue}>
                                    {formatCreatorOverviewCount(workDetail?.shareCount ?? 0)}
                                </span>
                            </div>
                        </div>
                    )}
                </section>

                {showAllStats && !isStatsLoading ? (
                    <div className={styles.statsSection}>
                        <div className={styles.statsGrid}>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoEye />
                                    <span>{t('creatorStats.totalViews')}</span>
                                </div>
                                <div className={styles.statValue}>{workDetail?.pv ?? gameStats?.pv ?? 0}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <TbHandClick />
                                    <span>{t('creatorStats.totalVisitors')}</span>
                                </div>
                                <div className={styles.statValue}>{workDetail?.uv ?? 0}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <TbHandClick />
                                    <span>{t('creatorStats.totalLikes')}</span>
                                </div>
                                <div className={styles.statValue}>{workDetail?.likeCount ?? 0}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoStatsChartSharp />
                                    <span>{t('creatorStats.playCount')}</span>
                                </div>
                                <div className={styles.statValue}>{workDetail?.playCount ?? 0}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoTime />
                                    <span>{t('creatorStats.playDuration')}</span>
                                </div>
                                <div className={styles.statValue}>
                                    {formatPlayDuration(workDetail?.playDurationSeconds ?? 0)}
                                </div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoShareSocial />
                                    <span>{t('creatorStats.shareCount')}</span>
                                </div>
                                <div className={styles.statValue}>{workDetail?.shareCount ?? 0}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoChatbubbleEllipses />
                                    <span>{t('creatorStats.commentCount')}</span>
                                </div>
                                <div className={styles.statValue}>{workDetail?.commentCount ?? 0}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <PiCurrencyCnyBold />
                                    <span>{t('creatorStats.spendPoints')}</span>
                                </div>
                                <div className={styles.statValue}>{workDetail?.spendPoints ?? 0}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <PiCurrencyCnyBold />
                                    <span>{t('createGame.earnings')}</span>
                                </div>
                                <div className={styles.statValue}>{gameStats?.count ?? 0}</div>
                            </div>
                        </div>
                        {workDetail ? <CreatorWorkDetailSections detail={workDetail} /> : null}
                    </div>
                ) : null}
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

            {isStartOptionsOpen
                ? createPortal(
                    <div className={styles.startOptionsOverlay} onClick={closeStartOptions}>
                        <div
                            className={styles.startOptionsModal}
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-label={t('gameDetail.selectStartMethod')}
                        >
                            <div className={styles.startOptionsHeader}>
                                <h2 className={styles.startOptionsTitle}>{t('gameDetail.selectStartMethod')}</h2>
                                <button
                                    type="button"
                                    className={styles.startOptionsClose}
                                    onClick={closeStartOptions}
                                    aria-label={t('common.close')}
                                >
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div className={styles.startOptionsButtons}>
                                <button
                                    type="button"
                                    className={styles.startOptionsPrimary}
                                    onClick={() => void handleStartNewFromOptions()}
                                    disabled={isLoading}
                                >
                                    {t('gameDetail.newStart')}
                                </button>
                                <button
                                    type="button"
                                    className={styles.startOptionsSecondary}
                                    disabled={isLoading || !playStatus.hasContinueState}
                                    onClick={() => void handleContinueFromOptions()}
                                >
                                    {t('gameDetail.continueExperience')}
                                </button>
                                <button
                                    type="button"
                                    className={styles.startOptionsGhost}
                                    disabled={isLoading || !playStatus.hasSave}
                                    onClick={handleOpenLoadSaveFromOptions}
                                >
                                    {t('gameDetail.loadSave')}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )
                : null}
        </div>
    );
};

export default GameStatsView;
