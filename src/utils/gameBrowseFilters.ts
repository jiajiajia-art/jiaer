export type HomeListMode = 'all' | 'role-playing' | 'custom';
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
    { value: 'all', label: '全部' },
    { value: 'role-playing', label: '角色扮演' },
    { value: 'custom', label: '自定义' },
];

export const HOME_LIST_SORT_OPTIONS: HomeListOption<HomeListSort>[] = [
    { value: 'hot', label: '最热' },
    { value: 'recommended', label: '推荐' },
    { value: 'latest', label: '最新' },
];

export const normalizeHomeListMode = (value: string | null): HomeListMode => {
    if (value === 'role-playing') return 'role-playing';
    if (value === 'custom') return 'custom';
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
