export type HomeListMode = 'all' | 'role-playing' | 'world' | 'custom' | 'interactive-video';
export type HomeListSort = 'hot' | 'recommended' | 'latest';

export type HomeListOption<T extends string | number | null> = {
    value: T;
    label: string;
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

export const HOME_LIST_MODE_OPTIONS: HomeListOption<HomeListMode>[] = [
    { value: 'all', label: '\u5168\u90E8' },
    { value: 'role-playing', label: '\u89D2\u8272\u626E\u6F14' },
    { value: 'world', label: 'World' },
    { value: 'custom', label: '\u81EA\u5B9A\u4E49' },
    { value: 'interactive-video', label: '\u4E92\u52A8\u5F71\u6E38' },
];

export const HOME_LIST_SORT_OPTIONS: HomeListOption<HomeListSort>[] = [
    { value: 'hot', label: '\u6700\u70ED' },
    { value: 'recommended', label: '\u63A8\u8350' },
    { value: 'latest', label: '\u6700\u65B0' },
];

export const normalizeHomeListMode = (value: string | null): HomeListMode => {
    if (value === 'role-playing') return 'role-playing';
    if (value === 'world' || value === 'avg') return 'world';
    if (value === 'custom') return 'custom';
    if (value === 'interactive-video' || value === 'ivg') return 'interactive-video';
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
