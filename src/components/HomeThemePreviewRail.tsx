import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiOutlineLike } from 'react-icons/ai';
import { IoGameControllerOutline } from 'react-icons/io5';
import styles from './HomeThemePreviewRail.module.css';
import type { UserGameData } from '../api/home/getGameData.type';
import { addImageTimestamp } from '../utils/imageCache';

interface HomeThemePreviewRailProps {
    games: UserGameData[];
    onMoreClick: () => void;
    resetKey: string;
    emptyText?: string;
}

const EMPTY_TEXT = '\u5F53\u524D\u6807\u7B7E\u6682\u672A\u914D\u7F6E\u5267\u672C';
const LOADING_TEXT = '\u6B63\u5728\u52A0\u8F7D\u5267\u672C...';
const MORE_GAMES_TEXT = '\u67E5\u770B\u66F4\u591A\u6E38\u620F';
const DESKTOP_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const DESKTOP_DRAG_THRESHOLD = 8;

type DragState = {
    pointerId: number | null;
    isDragging: boolean;
    hasCaptured: boolean;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
};

const createInitialDragState = (): DragState => ({
    pointerId: null,
    isDragging: false,
    hasCaptured: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
});

const HomeThemePreviewRail: React.FC<HomeThemePreviewRailProps> = ({
    games,
    onMoreClick,
    resetKey,
    emptyText = EMPTY_TEXT,
}) => {
    const navigate = useNavigate();
    const railRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<DragState>(createInitialDragState());
    const [isDesktopInteraction, setIsDesktopInteraction] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const visibleGames = useMemo(() => games.slice(0, 12), [games]);
    const resolvedEmptyText = emptyText.includes('...') ? LOADING_TEXT : EMPTY_TEXT;

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
        const syncDesktopInteraction = () => {
            setIsDesktopInteraction(mediaQuery.matches);
        };

        syncDesktopInteraction();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', syncDesktopInteraction);
            return () => {
                mediaQuery.removeEventListener('change', syncDesktopInteraction);
            };
        }

        mediaQuery.addListener(syncDesktopInteraction);
        return () => {
            mediaQuery.removeListener(syncDesktopInteraction);
        };
    }, []);

    useLayoutEffect(() => {
        if (!railRef.current) return;

        // Reset the rail position when the active home theme changes.
        railRef.current.scrollLeft = 0;
        dragStateRef.current = createInitialDragState();
        setIsDragging(false);
    }, [resetKey]);

    useEffect(() => {
        const rail = railRef.current;
        if (!rail) return undefined;

        const handleWheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

            const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
            if (maxScrollLeft <= 0) return;

            const nextScrollLeft = Math.max(0, Math.min(rail.scrollLeft + event.deltaY, maxScrollLeft));
            if (nextScrollLeft === rail.scrollLeft) return;

            rail.scrollLeft = nextScrollLeft;
            event.preventDefault();
        };

        rail.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            rail.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const formatMetric = (value: number | string | null | undefined): string => {
        const numericValue = Number(value ?? 0);
        if (!Number.isFinite(numericValue)) return '0';
        return numericValue.toLocaleString('zh-CN');
    };

    const getTypeLabel = (game: UserGameData): string => {
        const rawType = String(game.game_tags || game.engine || '').trim().toUpperCase();
        switch (rawType) {
            case 'TXT':
                return '\u6587\u5B57\u4E92\u52A8';
            case 'AVG':
                return '\u4E16\u754C\u4E92\u52A8';
            case 'RPG':
                return '\u5267\u60C5\u5192\u9669';
            case 'CUSTOM':
                return '\u81EA\u5B9A\u4E49';
            default:
                return rawType;
        }
    };

    const getThemeLabels = (game: UserGameData): string[] => {
        const tagNames = Array.isArray(game.theme_tag_names) ? game.theme_tag_names : [];
        return tagNames
            .map((name) => String(name || '').trim())
            .filter((name) => name && name !== '\u5168\u90E8')
            .slice(0, 2);
    };

    const handleCardNavigate = (game: UserGameData) => {
        const gameId = String(game.file_id || game.id || '').trim();
        if (!gameId) return;

        navigate(`/game/${gameId}`, {
            state: { source: 'home_theme_preview' },
        });
    };

    const finishDragging = (currentTarget?: HTMLDivElement, pointerId?: number) => {
        const activePointerId = pointerId ?? dragStateRef.current.pointerId;
        const hadCaptured = dragStateRef.current.hasCaptured;

        if (!dragStateRef.current.isDragging && dragStateRef.current.pointerId === null) {
            return;
        }

        dragStateRef.current.isDragging = false;
        dragStateRef.current.pointerId = null;
        dragStateRef.current.hasCaptured = false;
        window.setTimeout(() => {
            dragStateRef.current.moved = false;
        }, 0);
        setIsDragging(false);

        if (hadCaptured && activePointerId !== null && currentTarget?.hasPointerCapture(activePointerId)) {
            currentTarget.releasePointerCapture(activePointerId);
        }
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktopInteraction || event.pointerType !== 'mouse' || event.button !== 0 || !railRef.current) {
            return;
        }

        dragStateRef.current = {
            pointerId: event.pointerId,
            isDragging: true,
            hasCaptured: false,
            startX: event.clientX,
            startScrollLeft: railRef.current.scrollLeft,
            moved: false,
        };
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (
            !isDesktopInteraction ||
            dragStateRef.current.pointerId !== event.pointerId ||
            !dragStateRef.current.isDragging ||
            !railRef.current
        ) {
            return;
        }

        const deltaX = event.clientX - dragStateRef.current.startX;
        if (Math.abs(deltaX) >= DESKTOP_DRAG_THRESHOLD) {
            dragStateRef.current.moved = true;
            setIsDragging(true);
            if (!dragStateRef.current.hasCaptured) {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragStateRef.current.hasCaptured = true;
            }
        }

        if (!dragStateRef.current.moved) {
            return;
        }

        railRef.current.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktopInteraction || dragStateRef.current.pointerId !== event.pointerId) {
            return;
        }

        finishDragging(event.currentTarget, event.pointerId);
    };

    const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktopInteraction || dragStateRef.current.pointerId !== event.pointerId) {
            return;
        }

        finishDragging(event.currentTarget, event.pointerId);
    };

    const handleLostPointerCapture = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDesktopInteraction || dragStateRef.current.pointerId !== event.pointerId) {
            return;
        }

        finishDragging();
    };

    const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!dragStateRef.current.moved) return;

        event.preventDefault();
        event.stopPropagation();
    };

    const handleCardButtonClick = (event: React.MouseEvent<HTMLButtonElement>, game: UserGameData) => {
        if (!isDesktopInteraction || event.detail === 0 || event.detail >= 2) {
            handleCardNavigate(game);
        }
    };

    return (
        <div
            ref={railRef}
            className={`${styles.rail} ${isDragging ? styles.railDragging : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handleLostPointerCapture}
            onClickCapture={handleClickCapture}
            onDoubleClickCapture={handleClickCapture}
        >
            {visibleGames.length === 0 ? (
                <div className={`${styles.cardShell} ${styles.emptyCardShell}`}>
                    <div className={`${styles.card} ${styles.emptyCard}`}>
                        <div className={styles.emptyText}>{resolvedEmptyText}</div>
                    </div>
                </div>
            ) : (
                visibleGames.map((game, index) => {
                    const typeLabel = getTypeLabel(game);
                    const themeLabels = getThemeLabels(game);
                    const coverUrl = game.display_cover_url || game.cover_url;

                    return (
                        <button
                            key={game.file_id || game.id || String(index)}
                            type="button"
                            className={styles.cardButton}
                            onClick={(event) => handleCardButtonClick(event, game)}
                        >
                            <div className={styles.cardShell}>
                                <article className={styles.card}>
                                    <div className={styles.coverWrap}>
                                        <img
                                            src={coverUrl
                                                ? addImageTimestamp(coverUrl)
                                                : `${import.meta.env.BASE_URL}data/events/welcome.png`}
                                            alt={game.title || `\u5267\u672C ${index + 1}`}
                                            className={styles.coverImage}
                                            draggable={false}
                                        />
                                        <div className={styles.coverTopRow}>
                                            <div className={styles.badgeGroup}>
                                                {themeLabels.map((label) => (
                                                    <span
                                                        key={`${game.file_id || game.id || index}-${label}`}
                                                        className={styles.themeBadge}
                                                        title={label}
                                                    >
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>
                                            {typeLabel ? (
                                                <div className={styles.typeTag} title={typeLabel}>
                                                    {typeLabel}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className={styles.coverBottomRow}>
                                            <div className={styles.cardCopy}>
                                                <div className={styles.title} title={game.title || ''}>
                                                    {game.title || `\u5267\u672C ${index + 1}`}
                                                </div>
                                                {game.subtitle ? (
                                                    <div className={styles.subtitle} title={game.subtitle}>
                                                        {game.subtitle}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className={styles.statsRow}>
                                                <span className={styles.statItem}>
                                                    <IoGameControllerOutline />
                                                    <span>{formatMetric(game.total_pv_count ?? 0)}</span>
                                                </span>
                                                <span className={styles.statItem}>
                                                    <AiOutlineLike />
                                                    <span>{formatMetric(game.like_count || 0)}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            </div>
                        </button>
                    );
                })
            )}

            <button
                type="button"
                className={`${styles.cardButton} ${styles.moreCardButton}`}
                onClick={onMoreClick}
                aria-label={MORE_GAMES_TEXT}
            >
                <div className={`${styles.cardShell} ${styles.moreCardShell}`}>
                    <article className={`${styles.card} ${styles.moreCard}`}>
                        <div className={styles.moreInner}>
                            <div className={styles.moreTitle}>{MORE_GAMES_TEXT}</div>
                            <div className={styles.moreArrow} aria-hidden="true">{'\u2192'}</div>
                        </div>
                    </article>
                </div>
            </button>
        </div>
    );
};

export default HomeThemePreviewRail;
