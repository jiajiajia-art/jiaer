import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const FILTER_TITLES = {
    sort: '排序',
    mode: '玩法分类',
    tag: '作品标签',
} as const;

const CHECK_MARK = '✓';

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
    const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);

    const tagOptions = useMemo(() => ([
        {
            value: null as number | null,
            label: '全部',
            title: '全部',
        },
        ...themeTags.map((tag) => ({
            value: Number(tag.id),
            label: tag.name,
            title: tag.pathLabel || tag.name,
        })),
    ]), [themeTags]);

    const selectedSortLabel = useMemo(
        () => HOME_LIST_SORT_OPTIONS.find((option) => option.value === sort)?.label || '最热',
        [sort],
    );
    const selectedModeLabel = useMemo(
        () => HOME_LIST_MODE_OPTIONS.find((option) => option.value === mode)?.label || '全部',
        [mode],
    );
    const selectedTag = useMemo(
        () => tagOptions.find((option) => option.value === tagId) || tagOptions[0],
        [tagId, tagOptions],
    );

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
                    aria-label={`${FILTER_TITLES.sort}，当前${selectedSortLabel}`}
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
                    <div className={styles.menu} role="menu" aria-label="排序选项">
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
                    aria-label={`${FILTER_TITLES.mode}，当前${selectedModeLabel}`}
                    onClick={() => toggleDropdown('mode')}
                >
                    <span className={styles.triggerText}>{selectedModeLabel}</span>
                    <span className={styles.triggerArrow} aria-hidden="true">
                        <svg viewBox="0 0 16 16">
                            <path d="M3.5 5.5L8 10l4.5-4.5" />
                        </svg>
                    </span>
                </button>
                {openDropdown === 'mode' ? (
                    <div className={styles.menu} role="menu" aria-label="玩法分类选项">
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

            <div className={`${styles.group} ${styles.groupWide}`}>
                <button
                    type="button"
                    className={getTriggerClassName('tag')}
                    aria-haspopup="menu"
                    aria-expanded={openDropdown === 'tag'}
                    aria-label={`${FILTER_TITLES.tag}，当前${selectedTag.label}`}
                    onClick={() => toggleDropdown('tag')}
                >
                    <span className={styles.triggerText}>{selectedTag.label}</span>
                    <span className={styles.triggerArrow} aria-hidden="true">
                        <svg viewBox="0 0 16 16">
                            <path d="M3.5 5.5L8 10l4.5-4.5" />
                        </svg>
                    </span>
                </button>
                {openDropdown === 'tag' ? (
                    <div className={`${styles.menu} ${styles.menuWide}`} role="menu" aria-label="作品标签选项">
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
