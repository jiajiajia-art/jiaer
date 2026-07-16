export type HomeListMode = 'all' | 'role-playing' | 'world' | 'custom' | 'interactive-video' | 'novel';
export type HomeListSort = 'hot' | 'recommended' | 'latest';

export type HomeListOption<T extends string | number | null> = {
    value: T;
    label: string;
    labelKey?: string;
};

export type HomeListFilters = {
    mode: HomeListMode;
    sort: HomeListSort;
    tagId: number | null;
};

export const DEFAULT_HOME_LIST_MODE: HomeListMode = 'all';
export const DEFAULT_HOME_LIST_SORT: HomeListSort = 'hot';

export const DEFAULT_HOME_LIST_FILTERS: HomeListFilters = {
    mode: DEFAULT_HOME_LIST_MODE,
    sort: DEFAULT_HOME_LIST_SORT,
    tagId: null,
};

/** 首页模式下拉选项（小说单独入口展示，不在此列表） */
export const HOME_LIST_MODE_OPTIONS: HomeListOption<HomeListMode>[] = [
    { value: 'all', label: '全部', labelKey: 'gameBrowse.modes.all' },
    { value: 'role-playing', label: 'AI文游', labelKey: 'gameBrowse.modes.rolePlaying' },
    { value: 'world', label: '酒馆卡', labelKey: 'gameBrowse.modes.world' },
    { value: 'custom', label: '自定义', labelKey: 'gameBrowse.modes.custom' },
    { value: 'interactive-video', label: '互动影游', labelKey: 'gameBrowse.modes.interactiveVideo' },
];

export const HOME_NOVEL_QUICK_FILTER_MODE: HomeListMode = 'novel';

export const HOME_LIST_SORT_OPTIONS: HomeListOption<HomeListSort>[] = [
    { value: 'hot', label: '最热', labelKey: 'gameBrowse.sorts.hot' },
    { value: 'recommended', label: '推荐', labelKey: 'gameBrowse.sorts.recommended' },
    { value: 'latest', label: '最新', labelKey: 'gameBrowse.sorts.latest' },
];

export const normalizeHomeListMode = (value: string | null): HomeListMode => {
    if (value === 'role-playing') return 'role-playing';
    if (value === 'world' || value === 'avg') return 'world';
    if (value === 'custom') return 'custom';
    if (value === 'interactive-video' || value === 'ivg') return 'interactive-video';
    if (value === 'novel') return 'novel';
    return DEFAULT_HOME_LIST_MODE;
};

export const normalizeHomeListSort = (value: string | null): HomeListSort => {
    if (value === 'recommended') return 'recommended';
    if (value === 'latest') return 'latest';
    return DEFAULT_HOME_LIST_SORT;
};

export const normalizeHomeListTagId = (value: string | null): number | null => {
    if (!value || value === 'all') return null;

    const parsedTagId = Number(value);
    return Number.isInteger(parsedTagId) && parsedTagId > 0 ? parsedTagId : null;
};

export const getHomeListFilterKey = (filters: HomeListFilters): string => (
    `${filters.mode}|${filters.sort}|${filters.tagId ?? 'all'}`
);
