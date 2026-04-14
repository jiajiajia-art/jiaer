import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './HomeGameFilterBar.module.css';
import type { FlatThemeTag } from '../utils/themeTags';
import {
    HOME_LIST_MODE_OPTIONS,
    HOME_LIST_SORT_OPTIONS,
    type HomeListMode,
    type HomeListSort,
} from '../utils/gameBrowseFilters';

type DropdownKey = 'sort' | 'mode' | 'tag' | null;

type HomeGameFilterBarProps = {
    sort: HomeListSort;
    mode: HomeListMode;
    tagId: number | null;
    themeTags: FlatThemeTag[];
    onSortChange: (sort: HomeListSort) => void;
    onModeChange: (mode: HomeListMode) => void;
    onTagChange: (tagId: number | null) => void;
};

const ALL_LABEL = '\u5168\u90e8';
const FILTER_TITLES = {
    sort: '\u6392\u5e8f',
    mode: '\u6a21\u5f0f',
    tag: '\u9898\u6750',
} as const;
const CHECK_MARK = '\u2713';
const MOBILE_BREAKPOINT = 768;
const MOBILE_SAFE_MARGIN = 16;
const DESKTOP_SAFE_MARGIN = 24;

const HomeGameFilterBar: React.FC<HomeGameFilterBarProps> = ({
    sort,
    mode,
    tagId,
    themeTags,
    onSortChange,
    onModeChange,
    onTagChange,
}) => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const tagGroupRef = useRef<HTMLDivElement | null>(null);
    const tagTriggerRef = useRef<HTMLButtonElement | null>(null);
    const tagMenuRef = useRef<HTMLDivElement | null>(null);
    const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
    const [tagMenuStyle, setTagMenuStyle] = useState<React.CSSProperties | undefined>(undefined);

    const tagOptions = useMemo(() => ([
        {
            value: null as number | null,
            label: ALL_LABEL,
            title: ALL_LABEL,
        },
        ...themeTags.map((tag) => ({
            value: Number(tag.id),
            label: tag.name,
            title: tag.pathLabel || tag.name,
        })),
    ]), [themeTags]);

    const selectedSortLabel = useMemo(
        () => HOME_LIST_SORT_OPTIONS.find((option) => option.value === sort)?.label || HOME_LIST_SORT_OPTIONS[0]?.label || FILTER_TITLES.sort,
        [sort],
    );
    const selectedModeOption = useMemo(
        () => HOME_LIST_MODE_OPTIONS.find((option) => option.value === mode) || null,
        [mode],
    );
    const selectedModeValueLabel = selectedModeOption?.label || ALL_LABEL;
    const selectedModeTriggerLabel = mode === 'all' ? FILTER_TITLES.mode : selectedModeValueLabel;
    const selectedTag = useMemo(
        () => tagOptions.find((option) => option.value === tagId) || tagOptions[0],
        [tagId, tagOptions],
    );
    const selectedTagValueLabel = selectedTag?.label || ALL_LABEL;
    const selectedTagTriggerLabel = tagId === null ? FILTER_TITLES.tag : selectedTagValueLabel;

    useEffect(() => {
        if (!openDropdown) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpenDropdown(null);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [openDropdown]);

    const updateTagMenuPosition = useCallback(() => {
        const tagGroup = tagGroupRef.current;
        const tagTrigger = tagTriggerRef.current;
        const tagMenu = tagMenuRef.current;

        if (!tagGroup || !tagTrigger || !tagMenu) return;

        const viewportWidth = window.innerWidth;
        const safeMargin = viewportWidth <= MOBILE_BREAKPOINT ? MOBILE_SAFE_MARGIN : DESKTOP_SAFE_MARGIN;
        const tagGroupRect = tagGroup.getBoundingClientRect();
        const tagTriggerRect = tagTrigger.getBoundingClientRect();
        const menuWidth = tagMenu.getBoundingClientRect().width || tagMenu.offsetWidth;
        const minLeft = safeMargin - tagGroupRect.left;
        const maxLeft = viewportWidth - safeMargin - tagGroupRect.left - menuWidth;
        const preferredLeft = tagTriggerRect.left - tagGroupRect.left;
        const nextLeft = Math.min(Math.max(preferredLeft, minLeft), Math.max(minLeft, maxLeft));
        const nextLeftValue = `${Math.round(nextLeft)}px`;
        const nextMaxWidth = `${Math.round(Math.max(168, viewportWidth - safeMargin * 2))}px`;

        setTagMenuStyle((previousStyle) => {
            if (
                previousStyle?.left === nextLeftValue
                && previousStyle?.right === 'auto'
                && previousStyle?.maxWidth === nextMaxWidth
            ) {
                return previousStyle;
            }

            return {
                left: nextLeftValue,
                right: 'auto',
                maxWidth: nextMaxWidth,
            };
        });
    }, []);

    useLayoutEffect(() => {
        if (openDropdown !== 'tag') {
            setTagMenuStyle(undefined);
            return;
        }

        // Keep the tag dropdown aligned with its trigger on narrow screens.
        updateTagMenuPosition();

        const handleViewportChange = () => {
            updateTagMenuPosition();
        };

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [openDropdown, updateTagMenuPosition, tagOptions.length]);

    const toggleDropdown = (key: Exclude<DropdownKey, null>) => {
        setOpenDropdown((prev) => (prev === key ? null : key));
    };

    const handleSortSelect = (value: HomeListSort) => {
        onSortChange(value);
        setOpenDropdown(null);
    };

    const handleModeSelect = (value: HomeListMode) => {
        onModeChange(value);
        setOpenDropdown(null);
    };

    const handleTagSelect = (value: number | null) => {
        onTagChange(value);
        setOpenDropdown(null);
    };

    const getTriggerClassName = (key: Exclude<DropdownKey, null>) => ([
        styles.trigger,
        openDropdown === key ? styles.triggerOpen : '',
    ].filter(Boolean).join(' '));

    return (
        <div ref={rootRef} className={styles.bar}>
            <div className={styles.group}>
                <button
                    type="button"
                    className={getTriggerClassName('sort')}
                    aria-haspopup="menu"
                    aria-expanded={openDropdown === 'sort'}
                    aria-label={`${FILTER_TITLES.sort}\uff0c\u5f53\u524d${selectedSortLabel}`}
                    onClick={() => toggleDropdown('sort')}
                >
                    <span className={styles.triggerText}>{selectedSortLabel}</span>
                    <span className={styles.triggerArrow} aria-hidden="true">
                        <svg viewBox="0 0 16 16">
                            <path d="M3.5 5.5L8 10l4.5-4.5" />
                        </svg>
                    </span>
                </button>
                {openDropdown === 'sort' ? (
                    <div className={styles.menu} role="menu" aria-label="\u6392\u5e8f\u9009\u9879">
                        {HOME_LIST_SORT_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={sort === option.value}
                                className={`${styles.menuItem} ${sort === option.value ? styles.menuItemActive : ''}`}
                                onClick={() => handleSortSelect(option.value)}
                            >
                                <span className={styles.menuItemLabel}>{option.label}</span>
                                {sort === option.value ? <span className={styles.menuItemCheck}>{CHECK_MARK}</span> : null}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            <div className={styles.divider} aria-hidden="true" />

            <div className={styles.group}>
                <button
                    type="button"
                    className={getTriggerClassName('mode')}
                    aria-haspopup="menu"
                    aria-expanded={openDropdown === 'mode'}
                    aria-label={`${FILTER_TITLES.mode}\uff0c\u5f53\u524d${selectedModeValueLabel}`}
                    onClick={() => toggleDropdown('mode')}
                >
                    <span className={styles.triggerText}>{selectedModeTriggerLabel}</span>
                    <span className={styles.triggerArrow} aria-hidden="true">
                        <svg viewBox="0 0 16 16">
                            <path d="M3.5 5.5L8 10l4.5-4.5" />
                        </svg>
                    </span>
                </button>
                {openDropdown === 'mode' ? (
                    <div className={styles.menu} role="menu" aria-label="\u6a21\u5f0f\u9009\u9879">
                        {HOME_LIST_MODE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={mode === option.value}
                                className={`${styles.menuItem} ${mode === option.value ? styles.menuItemActive : ''}`}
                                onClick={() => handleModeSelect(option.value)}
                            >
                                <span className={styles.menuItemLabel}>{option.label}</span>
                                {mode === option.value ? <span className={styles.menuItemCheck}>{CHECK_MARK}</span> : null}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            <div className={styles.divider} aria-hidden="true" />

            <div ref={tagGroupRef} className={`${styles.group} ${styles.groupWide}`}>
                <button
                    ref={tagTriggerRef}
                    type="button"
                    className={getTriggerClassName('tag')}
                    aria-haspopup="menu"
                    aria-expanded={openDropdown === 'tag'}
                    aria-label={`${FILTER_TITLES.tag}\uff0c\u5f53\u524d${selectedTagValueLabel}`}
                    onClick={() => toggleDropdown('tag')}
                >
                    <span className={styles.triggerText}>{selectedTagTriggerLabel}</span>
                    <span className={styles.triggerArrow} aria-hidden="true">
                        <svg viewBox="0 0 16 16">
                            <path d="M3.5 5.5L8 10l4.5-4.5" />
                        </svg>
                    </span>
                </button>
                {openDropdown === 'tag' ? (
                    <div
                        ref={tagMenuRef}
                        className={`${styles.menu} ${styles.menuWide}`}
                        role="menu"
                        aria-label="\u9898\u6750\u9009\u9879"
                        style={tagMenuStyle}
                    >
                        {tagOptions.map((option) => (
                            <button
                                key={String(option.value ?? 'all')}
                                type="button"
                                role="menuitemradio"
                                aria-checked={tagId === option.value}
                                className={`${styles.menuItem} ${tagId === option.value ? styles.menuItemActive : ''}`}
                                onClick={() => handleTagSelect(option.value)}
                                title={option.title}
                            >
                                <span className={styles.menuItemLabel}>{option.label}</span>
                                {tagId === option.value ? <span className={styles.menuItemCheck}>{CHECK_MARK}</span> : null}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default HomeGameFilterBar;
