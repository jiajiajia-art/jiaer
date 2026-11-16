import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './GameGrid.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { addImageTimestamp } from '../utils/imageCache';
import {
    resolveGameListCoverUrl,
    resolveOriginalCoverUrl,
    coverUrlAfterDisplayCoverError,
} from '../utils/displayCoverUrl';
import { getImageUrl } from '../utils/constants';
import { getGameTypeLabelFromMeta, getGameTypeToneFromMeta } from '../utils/gameTypeLabel';
import { resolveGameTypeToneStyle } from '../utils/gameTypeToneClass';
import { buildGameDetailNavigateState } from '../utils/gameDetailNavigation';
import { resolveGameCardBody } from '../lib/gameCardBody';
import { translateThemeLabel } from '../utils/themeTags';
import {
  GAME_CARD_DEFAULT_AVATAR_PATH,
  resolveGameCardAuthor,
} from '../lib/gameCardAuthor';
import { CardBookmarkIcon, CardFlameIcon, CardHeartIcon } from './GameCardStatIcons';
import { creatorWorkStatusLabel, isDraftSlotWork, resolveCreatorWorkStatus } from '../utils/creatorWorkLifecycle';

type GameGridLayoutVariant = 'default' | 'homeWide' | 'works';

interface GameGridProps {
    games: UserGameData[];
    onGameClick?: (game: UserGameData) => void;
    primaryStat?: 'uv' | 'pv';
    isIncentive?: boolean;
    showIncentiveUI?: boolean;
    selectable?: boolean;
    selectedIds?: string[];
    onToggleSelect?: (game: UserGameData) => void;
    isSelectionMode?: boolean;
    /** 功能注释：管理模式下哪些卡可选；默认草稿槽作品才出勾选。 */
    canSelectGame?: (game: UserGameData) => boolean;
    layoutVariant?: GameGridLayoutVariant;
    emptyText?: string;
    /** 首页推荐：长按 / 右键出屏蔽·举报菜单 */
    enableContentMenu?: boolean;
    onContentMenu?: (game: UserGameData, point: { x: number; y: number }) => void;
    /** 创作者书架显示草稿/审核等生命周期标签；「已发布」不展示（列表已按发布态筛选）。 */
    showWorkStatus?: boolean;
}

const LONG_PRESS_MS = 480;

const GameGrid: React.FC<GameGridProps> = ({
    games,
    onGameClick,
    primaryStat = 'pv',
    showIncentiveUI = false,
    selectable = false,
    selectedIds = [],
    onToggleSelect,
    isSelectionMode = false,
    canSelectGame,
    layoutVariant = 'default',
    emptyText,
    enableContentMenu = false,
    onContentMenu,
    showWorkStatus = false,
}) => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const longPressTimerRef = useRef<number | null>(null);
    const longPressTriggeredRef = useRef(false);
    const isWorksLayout = layoutVariant === 'works';

    const clearLongPress = () => {
        if (longPressTimerRef.current != null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const startLongPress = (game: UserGameData, clientX: number, clientY: number) => {
        if (!enableContentMenu || !onContentMenu || isSelectionMode) return;
        longPressTriggeredRef.current = false;
        clearLongPress();
        longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            onContentMenu(game, { x: clientX, y: clientY });
        }, LONG_PRESS_MS);
    };
    const gridClassName = [
        styles.grid4,
        layoutVariant === 'homeWide' ? styles.gridHomeWide : '',
        isWorksLayout ? styles.gridWorks : '',
    ].filter(Boolean).join(' ');
    const cardClassName = (isSelected: boolean) => [
        styles.goodsCard,
        layoutVariant === 'homeWide' ? styles.goodsCardHomeWide : '',
        isWorksLayout ? styles.goodsCardWorks : '',
        isSelectionMode ? styles.goodsCardSelectable : '',
        isSelected ? styles.goodsCardSelected : '',
    ].filter(Boolean).join(' ');

    const getTypeLabel = (meta: UserGameData): string => {
        return getGameTypeLabelFromMeta(meta);
    };

    const getIncentiveStatus = (meta: UserGameData): 'none' | 'incentive' | 'finished' => {
        const raw = (meta as UserGameData & { incentiveStatus?: string; incentive_status?: string }).incentiveStatus
            || (meta as UserGameData & { incentiveStatus?: string; incentive_status?: string }).incentive_status;
        if (raw) {
            const val = String(raw).toLowerCase();
            if (val === 'incentive') return 'incentive';
            if (val === 'finished') return 'finished';
            return 'none';
        }

        const startStr = (meta as UserGameData & { incentiveStartTime?: string }).incentiveStartTime;
        const endStr = (meta as UserGameData & { incentiveEndTime?: string }).incentiveEndTime;
        if (!startStr) return 'none';

        const now = Date.now();
        const start = Date.parse(startStr);
        const end = endStr ? Date.parse(endStr) : NaN;
        if (isNaN(start)) return 'none';
        if (now > start && (isNaN(end) || now < end)) return 'incentive';
        if (!isNaN(end) && now > end) return 'finished';
        return 'none';
    };

    const getSelectableId = (game: UserGameData) => String(game.file_id || game.id || '');

    const allowSelect = (game: UserGameData) => {
        if (!selectable || !isSelectionMode) return false;
        if (canSelectGame) return canSelectGame(game);
        return isDraftSlotWork(game);
    };

    const handleCardClick = (game: UserGameData) => {
        if (allowSelect(game) && onToggleSelect) {
            onToggleSelect(game);
            return;
        }

        if (onGameClick) {
            onGameClick(game);
            return;
        }

        const gameId = game.file_id || game.id;
        if (!gameId) return;
        navigate(`/game/${gameId}`, {
            state: buildGameDetailNavigateState('main_page', game),
        });
    };

    if (games.length === 0) {
        return (
            <div className={styles.emptyState}>
                {emptyText ? <p className={styles.emptyStateText}>{emptyText}</p> : <p />}
            </div>
        );
    }

    return (
        <div className={gridClassName}>
            {games.map((meta, idx) => {
                const status = getIncentiveStatus(meta);
                const showIncentive = showIncentiveUI && status !== 'none';
                // 功能注释：激励作品仍展示热度（火焰），不再用织梦豆金额替换主指标
                const primaryValue = primaryStat === 'uv'
                    ? (meta.total_uv_count ?? 0)
                    : (meta.total_pv_count ?? 0);
                const typeLabel = getTypeLabel(meta);
                const typeToneStyle = resolveGameTypeToneStyle(getGameTypeToneFromMeta(meta));
                const selectableId = getSelectableId(meta);
                const isSelected = selectableId ? selectedIds.includes(selectableId) : false;
                const body = resolveGameCardBody(meta);
                const author = resolveGameCardAuthor(meta, {
                    unknownAuthor: t('gameDetail.unknownAuthor'),
                });
                const authorAvatarSrc =
                    getImageUrl(author.avatarUrl)
                    || `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;

                return (
                    <div
                        className={cardClassName(isSelected)}
                        key={meta.file_id || meta.id || String(idx)}
                        onClick={() => {
                            if (longPressTriggeredRef.current) {
                                longPressTriggeredRef.current = false;
                                return;
                            }
                            handleCardClick(meta);
                        }}
                        onContextMenu={(event) => {
                            if (!enableContentMenu || !onContentMenu || isSelectionMode) return;
                            event.preventDefault();
                            onContentMenu(meta, { x: event.clientX, y: event.clientY });
                        }}
                        onPointerDown={(event) => {
                            if (event.pointerType === 'mouse' && event.button !== 0) return;
                            startLongPress(meta, event.clientX, event.clientY);
                        }}
                        onPointerUp={clearLongPress}
                        onPointerLeave={clearLongPress}
                        onPointerCancel={clearLongPress}
                    >
                        <div className={styles.goodsImg}>
                            {(() => {
                                // 功能注释：书架角标只提示非发布态（草稿/审核等）；「已发布」与类型标签叠在一起多余，主人/访客均不展示
                                if (!showWorkStatus) return null;
                                const workStatus = resolveCreatorWorkStatus(meta);
                                if (workStatus === 'published') return null;
                                return (
                                    <span className={styles.workStatusTag}>
                                        {creatorWorkStatusLabel(workStatus)}
                                    </span>
                                );
                            })()}
                            {(() => {
                                // 功能注释：列表优先竖版/display-cover；草稿未上传封面时回退默认图，避免空底像「图丢了」
                                const defaultCoverSrc = `${import.meta.env.BASE_URL}data/events/welcome.png`;
                                const displayCoverPath = resolveGameListCoverUrl({
                                    display_cover_url: meta.display_cover_url,
                                    cover_url: meta.cover_url,
                                    portrait_cover_url: meta.portrait_cover_url,
                                    coverUrl: (meta as { coverUrl?: string | null }).coverUrl,
                                    portraitCoverUrl: (meta as { portraitCoverUrl?: string | null }).portraitCoverUrl,
                                });
                                if (!displayCoverPath) {
                                    return (
                                        <img
                                            className={styles.goodsImgDefaultCover}
                                            src={defaultCoverSrc}
                                            alt={meta.title || `剧情${idx + 1}`}
                                        />
                                    );
                                }
                                return (
                                    <img
                                        src={addImageTimestamp(getImageUrl(displayCoverPath))}
                                        alt={meta.title || `剧情${idx + 1}`}
                                        onError={(event) => {
                                            // 功能注释：缺 display-cover → 原图 → 默认图，避免列表裂图/空底
                                            const img = event.currentTarget;
                                            if (img.dataset.coverFallback === '2') return;
                                            if (img.dataset.coverFallback !== '1') {
                                                const fallbackPath = coverUrlAfterDisplayCoverError(
                                                    displayCoverPath,
                                                    resolveOriginalCoverUrl(meta),
                                                );
                                                const next = fallbackPath
                                                    ? addImageTimestamp(getImageUrl(fallbackPath))
                                                    : '';
                                                if (next && img.src !== next) {
                                                    img.dataset.coverFallback = '1';
                                                    img.src = next;
                                                    return;
                                                }
                                            }
                                            img.dataset.coverFallback = '2';
                                            img.classList.add(styles.goodsImgDefaultCover);
                                            img.src = defaultCoverSrc;
                                        }}
                                    />
                                );
                            })()}

                            {allowSelect(meta) && selectableId && (
                                <>
                                    <div className={`${styles.selectionMask} ${isSelected ? styles.selectionMaskActive : ''}`} />
                                    <button
                                        type="button"
                                        className={`${styles.selectionToggle} ${isSelected ? styles.selectionToggleActive : ''}`}
                                        aria-label={isSelected ? '取消选择草稿' : '选择草稿'}
                                        aria-pressed={isSelected}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onToggleSelect?.(meta);
                                        }}
                                    >
                                        <span className={styles.selectionToggleInner} />
                                    </button>
                                </>
                            )}

                            {showIncentive && (
                                <div
                                    className={`${styles.incentiveTag} ${status === 'finished' ? styles.incentiveFinished : ''}`}
                                    title={status === 'finished' ? t('profile.incentiveSettled') : t('profile.incentivePlan')}
                                >
                                    {status === 'finished' ? t('profile.incentiveSettled') : t('profile.incentivePlan')}
                                </div>
                            )}

                            {typeLabel && (
                                <div
                                    className={styles.goodsTypeTag}
                                    style={typeToneStyle}
                                    title={typeLabel}
                                >
                                    {typeLabel}
                                </div>
                            )}

                            {/* 功能注释：题材标签叠在封面左下（数据条上方），不再占正文底部一行 */}
                            {body.tags.length > 0 ? (
                                <div className={styles.goodsCoverTags}>
                                    {body.tags.map((tag) => (
                                        <span key={tag} className={styles.goodsTagPill}>{translateThemeLabel(tag, t, i18n.resolvedLanguage || i18n.language)}</span>
                                    ))}
                                </div>
                            ) : null}

                            {/* 功能注释：封面底栏火焰/心形同套下载 mask + 统一小号，对齐效果图 */}
                            <div className={styles.goodsInfo}>
                                <div className={styles.goodsInfoStats}>
                                    <div className={styles.goodsInfoItem}>
                                        <CardFlameIcon className={styles.goodsInfoFlame} />
                                        <span className={styles.goodsInfoValue} title={String(primaryValue)}>
                                            {primaryValue}
                                        </span>
                                    </div>
                                    <div className={styles.goodsInfoItem}>
                                        <CardHeartIcon className={styles.goodsInfoHeart} />
                                        <span className={styles.goodsInfoValue} title={String(meta.like_count || 0)}>
                                            {meta.like_count || 0}
                                        </span>
                                    </div>
                                </div>
                                {/* 功能注释：收藏数与火焰/心形同一套图标数据，靠右对齐 */}
                                <div className={styles.goodsInfoItem} title={body.collectBadge ?? undefined}>
                                    <CardBookmarkIcon className={styles.goodsInfoBookmark} />
                                    <span className={styles.goodsInfoValue}>
                                        {Math.max(0, Math.floor(Number(meta.favorite_count) || 0))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.goodsBody}>
                            <div className={styles.goodsTitle} title={meta.title || undefined}>
                                {meta.title || `剧情${idx + 1}`}
                            </div>
                            {(() => {
                                // 功能注释：简介与标题相同（含空白差异）时不渲染，避免「标题下再空一行同文案」
                                const titleText = String(meta.title ?? '').replace(/\s+/g, ' ').trim();
                                const subtitleText = String(body.subtitle ?? '').replace(/\s+/g, ' ').trim();
                                const showSubtitle = Boolean(subtitleText) && subtitleText !== titleText;
                                if (isWorksLayout) {
                                    if (!showSubtitle) return null;
                                    return (
                                        <p className={styles.goodsDesc} title={subtitleText}>
                                            {subtitleText}
                                        </p>
                                    );
                                }
                                // 功能注释：首页无简介用空行保卡片等高；有简介且与标题不同才展示真文案
                                return (
                                    <p className={styles.goodsDesc} title={showSubtitle ? subtitleText : undefined}>
                                        {showSubtitle ? subtitleText : '\u00a0'}
                                    </p>
                                );
                            })()}
                            {/* 功能注释：左作者署名、右收藏徽标，同一行左右布局 */}
                            <div className={styles.goodsMetaRow}>
                                <div className={styles.goodsAuthor} title={author.name}>
                                    <img
                                        className={styles.goodsAuthorAvatar}
                                        src={authorAvatarSrc}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <span className={styles.goodsAuthorName}>{author.name}</span>
                                </div>
                                {/* 功能注释：右侧收藏徽标与作者同一行，实心酒红胶囊 */}
                                {body.collectBadge ? (
                                    <span className={styles.goodsCollectBadge}>{body.collectBadge}</span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default GameGrid;
