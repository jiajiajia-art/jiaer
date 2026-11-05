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
import {
  GAME_CARD_DEFAULT_AVATAR_PATH,
  resolveGameCardAuthor,
} from '../lib/gameCardAuthor';
import { CardFlameIcon, CardHeartIcon } from './GameCardStatIcons';
import { creatorWorkStatusLabel, resolveCreatorWorkStatus } from '../utils/creatorWorkLifecycle';

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
    layoutVariant?: GameGridLayoutVariant;
    emptyText?: string;
    /** 首页推荐：长按 / 右键出屏蔽·举报菜单 */
    enableContentMenu?: boolean;
    onContentMenu?: (game: UserGameData, point: { x: number; y: number }) => void;
    /** 创作者书架显示草稿/审核/发布生命周期标签。 */
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
    layoutVariant = 'default',
    emptyText,
    enableContentMenu = false,
    onContentMenu,
    showWorkStatus = false,
}) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
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

    const handleCardClick = (game: UserGameData) => {
        if (selectable && isSelectionMode && onToggleSelect) {
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
                            {showWorkStatus ? (
                                <span className={styles.workStatusTag}>
                                    {creatorWorkStatusLabel(resolveCreatorWorkStatus(meta))}
                                </span>
                            ) : null}
                            {(() => {
                                // 功能注释：列表封面统一走 display-cover；无封面时用暗色占位，避免 welcome 白底破暗色
                                const displayCoverPath = resolveGameListCoverUrl({
                                    display_cover_url: meta.display_cover_url,
                                    cover_url: meta.cover_url,
                                    portrait_cover_url: meta.portrait_cover_url,
                                });
                                if (!displayCoverPath) {
                                    return <div className={styles.goodsImgPlaceholder} aria-hidden="true" />;
                                }
                                return (
                                    <img
                                        src={addImageTimestamp(getImageUrl(displayCoverPath))}
                                        alt={meta.title || `剧情${idx + 1}`}
                                        onError={(event) => {
                                            // 功能注释：缺 display-cover 时回退原图，避免列表裂图
                                            const img = event.currentTarget;
                                            const fallbackPath = coverUrlAfterDisplayCoverError(
                                                displayCoverPath,
                                                resolveOriginalCoverUrl(meta),
                                            );
                                            if (!fallbackPath) return;
                                            const next = addImageTimestamp(getImageUrl(fallbackPath));
                                            if (!next || img.src === next || img.dataset.coverFallback === '1') return;
                                            img.dataset.coverFallback = '1';
                                            img.src = next;
                                        }}
                                    />
                                );
                            })()}

                            {selectable && isSelectionMode && selectableId && (
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
                            </div>
                        </div>

                        <div className={styles.goodsBody}>
                            <div className={styles.goodsTitle} title={meta.title || undefined}>
                                {meta.title || `剧情${idx + 1}`}
                            </div>
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
                                {body.collectBadge ? (
                                    <span className={styles.goodsCollectBadge}>{body.collectBadge}</span>
                                ) : null}
                            </div>
                            {body.tags.length > 0 ? (
                                <div className={styles.goodsTagRow}>
                                    {body.tags.map((tag) => (
                                        <span key={tag} className={styles.goodsTagPill}>{tag}</span>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default GameGrid;
