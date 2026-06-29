import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AiOutlineLike } from 'react-icons/ai';
import { IoGameControllerOutline } from 'react-icons/io5';
import { RiMoneyCnyCircleLine } from 'react-icons/ri';
import styles from './GameGrid.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { addImageTimestamp } from '../utils/imageCache';
import { getGameTypeLabelFromMeta } from '../utils/gameTypeLabel';

type GameGridLayoutVariant = 'default' | 'homeWide';

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
    const gridClassName = [
        styles.grid4,
        layoutVariant === 'homeWide' ? styles.gridHomeWide : '',
    ].filter(Boolean).join(' ');
    const cardClassName = (isSelected: boolean) => [
        styles.goodsCard,
        layoutVariant === 'homeWide' ? styles.goodsCardHomeWide : '',
        isSelectionMode ? styles.goodsCardSelectable : '',
        isSelected ? styles.goodsCardSelected : '',
    ].filter(Boolean).join(' ');

    const getTypeLabel = (meta: UserGameData): string => {
        return getGameTypeLabelFromMeta(meta);

        const rawSource = String(meta.game_tags || (meta as { engine?: string }).engine || '').trim();
        const normalizedRaw = rawSource
            .replace(/^\[\s*/, '')
            .replace(/\s*\]$/, '')
            .replace(/^["']|["']$/g, '')
            .trim();
        if (
            normalizedRaw === '\u6587\u5b57\u4e92\u52a8'
            || normalizedRaw.toUpperCase() === 'ROLE-PLAYING'
        ) {
            return 'Role-Playing';
        }
        const raw = normalizedRaw.toUpperCase();
        switch (raw) {
            case 'TXT':
                return 'Role-Playing';
            case 'AVG':
                return 'World';
            case 'RPG':
                return 'Story';
            case 'CUSTOM':
                return '自定义';
            default:
                return raw || '';
        }
    };

    const getThemeLabel = (meta: UserGameData): string => {
        const names = Array.isArray(meta.theme_tag_names) ? meta.theme_tag_names.filter(Boolean) : [];
        const specificNames = names
            .map((name) => String(name).trim())
            .filter((name) => name && name !== '全部');
        if (specificNames.length === 0) return '';
        return specificNames.slice(0, 2).join(' | ');
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
        navigate(`/game/${gameId}`, { state: { source: 'main_page' } });
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
                const PrimaryIcon = showIncentive ? RiMoneyCnyCircleLine : IoGameControllerOutline;
                const typeLabel = getTypeLabel(meta);
                const themeLabel = getThemeLabel(meta);
                const isUnpublished = Number(meta.is_public) !== 1;
                const selectableId = getSelectableId(meta);
                const isSelected = selectableId ? selectedIds.includes(selectableId) : false;

                return (
                    <div
                        className={cardClassName(isSelected)}
                        key={meta.file_id || meta.id || String(idx)}
                        onClick={() => handleCardClick(meta)}
                    >
                        <div className={styles.goodsImg}>
                            <img
                                src={meta.display_cover_url || meta.cover_url
                                    ? addImageTimestamp(meta.display_cover_url || meta.cover_url)
                                    : `${import.meta.env.BASE_URL}data/events/welcome.png`}
                                alt={meta.title || `剧情${idx + 1}`}
                            />

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
                                        {/* 实现草稿批量选择 */}
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
                                <div className={styles.goodsTypeTag} title={typeLabel}>
                                    {typeLabel}
                                </div>
                            )}

                            <div className={styles.goodsInfo}>
                                {themeLabel && (
                                    <div className={styles.goodsTheme} title={themeLabel}>
                                        {themeLabel}
                                    </div>
                                )}
                                <div className={styles.goodsInfoRight}>
                                    <div className={styles.goodsInfoItem}>
                                        <PrimaryIcon />
                                        <span className={styles.goodsInfoValue} title={String(primaryValue)}>
                                            {primaryValue}
                                        </span>
                                    </div>
                                    <div className={styles.goodsInfoItem}>
                                        <AiOutlineLike />
                                        <span className={styles.goodsInfoValue} title={String(meta.like_count || 0)}>
                                            {meta.like_count || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.goodsBody}>
                            <div className={styles.goodsTitleWrap}>
                                <div className={styles.goodsTitle}>
                                    {meta.title || `剧情${idx + 1}`}
                                </div>
                                {meta.subtitle && (
                                    <div className={styles.goodsSubtitle}>{meta.subtitle}</div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default GameGrid;
