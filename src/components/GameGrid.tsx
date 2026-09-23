import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './GameGrid.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { addImageTimestamp } from '../utils/imageCache';
import { resolveGameListCoverUrl } from '../utils/displayCoverUrl';
import { getImageUrl } from '../utils/constants';
import { getGameTypeLabelFromMeta, getGameTypeToneFromMeta } from '../utils/gameTypeLabel';
import { resolveGameTypeToneStyle } from '../utils/gameTypeToneClass';
import { buildGameDetailNavigateState } from '../utils/gameDetailNavigation';
import { resolveGameCardBody } from '../lib/gameCardBody';
import {
  GAME_CARD_DEFAULT_AVATAR_PATH,
  resolveGameCardAuthor,
} from '../lib/gameCardAuthor';
import { CardCoinIcon, CardFlameIcon, CardHeartIcon } from './GameCardStatIcons';

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
    showUnpublishedBadge?: boolean;
}

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
    showUnpublishedBadge = false,
}) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const isWorksLayout = layoutVariant === 'works';
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

    const getIncentiveAmount = (meta: UserGameData, status: 'none' | 'incentive' | 'finished'): number => {
        const pending = (meta as UserGameData & { incentivePendingAmount?: number; incentive_pending_amount?: number }).incentivePendingAmount
            ?? (meta as UserGameData & { incentivePendingAmount?: number; incentive_pending_amount?: number }).incentive_pending_amount;
        const settled = (meta as UserGameData & { incentiveSettledAmount?: number; incentive_settled_amount?: number }).incentiveSettledAmount
            ?? (meta as UserGameData & { incentiveSettledAmount?: number; incentive_settled_amount?: number }).incentive_settled_amount;
        const amount = (meta as UserGameData & { incentiveAmount?: number; incentive_amount?: number }).incentiveAmount
            ?? (meta as UserGameData & { incentiveAmount?: number; incentive_amount?: number }).incentive_amount;

        if (status === 'incentive') {
            if (typeof pending === 'number') return pending;
            if (typeof amount === 'number') return amount;
        }
        if (status === 'finished') {
            if (typeof settled === 'number') return settled;
            if (typeof amount === 'number') return amount;
        }
        return typeof amount === 'number' ? amount : (meta.total_uv_count ?? 0) * 5;
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
                const primaryValue = showIncentive
                    ? getIncentiveAmount(meta, status)
                    : (primaryStat === 'uv' ? (meta.total_uv_count ?? 0) : (meta.total_pv_count ?? 0));
                const typeLabel = getTypeLabel(meta);
                const typeToneStyle = resolveGameTypeToneStyle(getGameTypeToneFromMeta(meta));
                const isUnpublished = Number(meta.is_public) !== 1;
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
                        onClick={() => handleCardClick(meta)}
                    >
                        <div className={styles.goodsImg}>
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

                            {showUnpublishedBadge && isUnpublished && (
                                <div className={styles.unpublishedTag} title={t('favorites.unpublished')}>
                                    {t('favorites.unpublished')}
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
                                        {showIncentive ? (
                                            <CardCoinIcon className={styles.goodsInfoIcon} />
                                        ) : (
                                            <CardFlameIcon className={styles.goodsInfoFlame} />
                                        )}
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
