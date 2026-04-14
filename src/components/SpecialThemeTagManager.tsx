import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import bannerApi from '../api/banner/bannerApi';
import type { BannerGameOption } from '../api/banner/banner.type';
import specialThemeTagsApi from '../api/specialThemeTags/specialThemeTagsApi';
import type {
    AdminSpecialThemeTagRecord,
    SpecialThemeAutoSort,
    SpecialThemeConfigMode,
    SpecialThemeSelectedGame,
} from '../api/specialThemeTags/specialThemeTagsApi.type';
import styles from './SpecialThemeTagManager.module.css';

const AUTO_SORT_OPTIONS: Array<{ value: SpecialThemeAutoSort; label: string }> = [
    { value: 'hot', label: '最热' },
    { value: 'recommended', label: '推荐' },
    { value: 'latest', label: '最新' },
];

const CONFIG_MODE_OPTIONS: Array<{ value: SpecialThemeConfigMode; label: string }> = [
    { value: 'manual', label: '手动配置' },
    { value: 'auto', label: '自动配置' },
];

const moveByKey = <T, K extends string | number>(
    list: T[],
    fromKey: K,
    toKey: K,
    getKey: (item: T) => K,
): T[] => {
    const fromIndex = list.findIndex((item) => getKey(item) === fromKey);
    const toIndex = list.findIndex((item) => getKey(item) === toKey);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;

    const nextList = [...list];
    const [movedItem] = nextList.splice(fromIndex, 1);
    nextList.splice(toIndex, 0, movedItem);
    return nextList;
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const responseError = error as { response?: { data?: { message?: string; error?: string } } };
        return responseError.response?.data?.message || responseError.response?.data?.error || fallback;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};

const mapBannerGameToSelected = (game: BannerGameOption, sortOrder: number): SpecialThemeSelectedGame => ({
    file_id: game.file_id,
    title: game.title,
    description: game.description,
    cover_url: game.cover_url,
    link_url: game.link_url || `/game/${game.file_id}`,
    updated_at: game.updated_at,
    is_public: 1,
    sort_order: sortOrder,
});

const SpecialThemeTagManager: React.FC = () => {
    const [specialTags, setSpecialTags] = useState<AdminSpecialThemeTagRecord[]>([]);
    const [manualLimit, setManualLimit] = useState(12);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [activeTagId, setActiveTagId] = useState<number | null>(null);
    const [newTagName, setNewTagName] = useState('');
    const [newTagMode, setNewTagMode] = useState<SpecialThemeConfigMode>('manual');
    const [newTagAutoSort, setNewTagAutoSort] = useState<SpecialThemeAutoSort>('hot');
    const [editorName, setEditorName] = useState('');
    const [editorMode, setEditorMode] = useState<SpecialThemeConfigMode>('manual');
    const [editorAutoSort, setEditorAutoSort] = useState<SpecialThemeAutoSort>('hot');
    const [editorGames, setEditorGames] = useState<SpecialThemeSelectedGame[]>([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<BannerGameOption[]>([]);
    const [draggingTagId, setDraggingTagId] = useState<number | null>(null);
    const [draggingGameFileId, setDraggingGameFileId] = useState<string | null>(null);
    const [hasTagOrderChanges, setHasTagOrderChanges] = useState(false);

    const activeTag = useMemo(
        () => specialTags.find((tag) => tag.id === activeTagId) || null,
        [activeTagId, specialTags],
    );

    const loadSpecialTags = useCallback(async (focusId?: number | null) => {
        try {
            setIsLoading(true);
            const response = await specialThemeTagsApi.getAdminTags();
            const nextTags = response.data.data?.tags || [];

            setSpecialTags(nextTags);
            setManualLimit(response.data.data?.manualLimit || 12);
            setHasTagOrderChanges(false);
            setActiveTagId((previousId) => {
                if (typeof focusId === 'number' && nextTags.some((tag) => tag.id === focusId)) {
                    return focusId;
                }
                if (previousId !== null && nextTags.some((tag) => tag.id === previousId)) {
                    return previousId;
                }
                return nextTags[0]?.id ?? null;
            });
        } catch (error) {
            toast.error(extractErrorMessage(error, '特殊标签列表加载失败'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSpecialTags();
    }, [loadSpecialTags]);

    useEffect(() => {
        if (!activeTag) {
            setEditorName('');
            setEditorMode('manual');
            setEditorAutoSort('hot');
            setEditorGames([]);
            setSearchKeyword('');
            setSearchResults([]);
            return;
        }

        setEditorName(activeTag.name);
        setEditorMode(activeTag.config_mode);
        setEditorAutoSort(activeTag.auto_sort || 'hot');
        setEditorGames(activeTag.selected_games || []);
        setSearchKeyword('');
        setSearchResults([]);
    }, [activeTag]);

    useEffect(() => {
        if (editorMode !== 'manual') {
            setSearchResults([]);
            return;
        }

        const trimmedKeyword = searchKeyword.trim();
        if (!trimmedKeyword) {
            setSearchResults([]);
            return;
        }

        const timer = window.setTimeout(async () => {
            try {
                setIsSearching(true);
                const response = await bannerApi.getGameOptions(trimmedKeyword);
                setSearchResults(response.data.data || []);
            } catch (error) {
                toast.error(extractErrorMessage(error, '剧本搜索失败'));
            } finally {
                setIsSearching(false);
            }
        }, 250);

        return () => window.clearTimeout(timer);
    }, [editorMode, searchKeyword]);

    const handleCreateTag = async () => {
        const trimmedName = newTagName.trim();
        if (!trimmedName) {
            toast.error('请先填写特殊标签名称');
            return;
        }

        try {
            setIsSaving(true);
            const response = await specialThemeTagsApi.createAdminTag({
                name: trimmedName,
                configMode: newTagMode,
                autoSort: newTagMode === 'auto' ? newTagAutoSort : null,
            });
            const createdTagId = typeof response.data.data === 'object' && response.data.data && 'id' in response.data.data
                ? Number(response.data.data.id)
                : null;

            setNewTagName('');
            setNewTagMode('manual');
            setNewTagAutoSort('hot');
            await loadSpecialTags(createdTagId);
            toast.success('特殊标签创建成功');
        } catch (error) {
            toast.error(extractErrorMessage(error, '特殊标签创建失败'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveCurrentTag = async () => {
        if (!activeTag) return;

        const trimmedName = editorName.trim();
        if (!trimmedName) {
            toast.error('特殊标签名称不能为空');
            return;
        }

        if (editorMode === 'manual' && editorGames.length > manualLimit) {
            toast.error(`手动模式最多只能配置 ${manualLimit} 个剧本`);
            return;
        }

        try {
            setIsSaving(true);
            // 实现特殊标签基础配置保存
            await specialThemeTagsApi.updateAdminTag({
                id: activeTag.id,
                name: trimmedName,
                configMode: editorMode,
                autoSort: editorMode === 'auto' ? editorAutoSort : null,
            });

            if (editorMode === 'manual') {
                // 实现手动模式剧本排序保存
                await specialThemeTagsApi.saveAdminTagGames(activeTag.id, {
                    fileIds: editorGames.map((game) => game.file_id),
                });
            }

            await loadSpecialTags(activeTag.id);
            toast.success('特殊标签已保存');
        } catch (error) {
            toast.error(extractErrorMessage(error, '特殊标签保存失败'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCurrentTag = async () => {
        if (!activeTag) return;
        if (!window.confirm(`确认删除特殊标签“${activeTag.name}”吗？`)) return;

        try {
            setIsSaving(true);
            await specialThemeTagsApi.deleteAdminTag(activeTag.id);
            await loadSpecialTags();
            toast.success('特殊标签删除成功');
        } catch (error) {
            toast.error(extractErrorMessage(error, '特殊标签删除失败'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTagOrder = useCallback(async () => {
        if (!hasTagOrderChanges) return;

        try {
            setIsSaving(true);
            await specialThemeTagsApi.reorderAdminTags(specialTags.map((tag) => tag.id));
            await loadSpecialTags(activeTagId);
            toast.success('特殊标签排序已保存');
        } catch (error) {
            toast.error(extractErrorMessage(error, '特殊标签排序保存失败'));
        } finally {
            setIsSaving(false);
        }
    }, [activeTagId, hasTagOrderChanges, loadSpecialTags, specialTags]);

    const handleAddGame = (game: BannerGameOption) => {
        setEditorGames((previousGames) => {
            if (previousGames.some((item) => item.file_id === game.file_id)) {
                toast.error('该剧本已加入当前特殊标签');
                return previousGames;
            }

            if (previousGames.length >= manualLimit) {
                toast.error(`手动模式最多只能配置 ${manualLimit} 个剧本`);
                return previousGames;
            }

            return [...previousGames, mapBannerGameToSelected(game, previousGames.length)];
        });

        setSearchKeyword('');
        setSearchResults([]);
    };

    const handleRemoveGame = (fileId: string) => {
        setEditorGames((previousGames) => previousGames
            .filter((game) => game.file_id !== fileId)
            .map((game, index) => ({
                ...game,
                sort_order: index,
            })));
    };

    const handleTagDragStart = (tagId: number) => {
        setDraggingTagId(tagId);
    };

    const handleTagDragOver = (event: React.DragEvent<HTMLButtonElement>, targetId: number) => {
        if (draggingTagId === null || draggingTagId === targetId) return;

        event.preventDefault();
        setSpecialTags((previousTags) => moveByKey(previousTags, draggingTagId, targetId, (tag) => tag.id).map((tag, index) => ({
            ...tag,
            sort_order: index,
        })));
        setHasTagOrderChanges(true);
    };

    const handleGameDragStart = (fileId: string) => {
        setDraggingGameFileId(fileId);
    };

    const handleGameDragOver = (event: React.DragEvent<HTMLDivElement>, targetFileId: string) => {
        if (!draggingGameFileId || draggingGameFileId === targetFileId) return;

        event.preventDefault();
        setEditorGames((previousGames) => moveByKey(previousGames, draggingGameFileId, targetFileId, (game) => game.file_id).map((game, index) => ({
            ...game,
            sort_order: index,
        })));
    };

    useEffect(() => {
        if (draggingTagId !== null || !hasTagOrderChanges || isSaving) return;
        void handleSaveTagOrder();
    }, [draggingTagId, handleSaveTagOrder, hasTagOrderChanges, isSaving]);

    return (
        <section className={styles.manager}>
            <div className={styles.sectionBadge}>特殊标签管理</div>

            <div className={styles.headerRow}>
                <div>
                    <h3 className={styles.title}>管理首页特殊标签</h3>
                </div>
                <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => void loadSpecialTags(activeTagId)}
                    disabled={isLoading || isSaving}
                >
                    刷新特殊标签
                </button>
            </div>

            <div className={styles.createCard}>
                <label className={styles.field}>
                    特殊标签名称
                    <input
                        className={styles.input}
                        value={newTagName}
                        onChange={(event) => setNewTagName(event.target.value)}
                        placeholder="例如：编辑部精选"
                    />
                </label>

                <label className={styles.field}>
                    配置模式
                    <select
                        className={styles.select}
                        value={newTagMode}
                        onChange={(event) => setNewTagMode(event.target.value as SpecialThemeConfigMode)}
                    >
                        {CONFIG_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                {newTagMode === 'auto' ? (
                    <label className={styles.field}>
                        自动排序
                        <select
                            className={styles.select}
                            value={newTagAutoSort}
                            onChange={(event) => setNewTagAutoSort(event.target.value as SpecialThemeAutoSort)}
                        >
                            {AUTO_SORT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : (
                    <div />
                )}

                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleCreateTag()}
                    disabled={isSaving}
                >
                    创建特殊标签
                </button>
            </div>

            <div className={styles.workspace}>
                <div className={styles.listCard}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardTitle}>特殊标签排序</div>
                    </div>

                    <div className={styles.tagList}>
                        {isLoading ? <div className={styles.emptyState}>特殊标签加载中...</div> : null}
                        {!isLoading && specialTags.length === 0 ? (
                            <div className={styles.emptyState}>当前还没有特殊标签。</div>
                        ) : null}
                        {!isLoading && specialTags.map((tag, index) => (
                            <button
                                key={tag.id}
                                type="button"
                                draggable={!isSaving}
                                className={`${styles.tagItem} ${activeTagId === tag.id ? styles.tagItemActive : ''}`}
                                onClick={() => setActiveTagId(tag.id)}
                                onDragStart={() => handleTagDragStart(tag.id)}
                                onDragOver={(event) => handleTagDragOver(event, tag.id)}
                                onDragEnd={() => setDraggingTagId(null)}
                            >
                                <span className={styles.tagOrder}>{index + 1}</span>
                                <span className={styles.tagInfo}>
                                    <span className={styles.tagName}>{tag.name}</span>
                                    <span className={styles.tagMode}>
                                        {tag.config_mode === 'manual'
                                            ? `手动配置 · ${tag.selected_game_count} / ${manualLimit}`
                                            : `自动配置 · ${AUTO_SORT_OPTIONS.find((option) => option.value === tag.auto_sort)?.label || '最热'}`}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.editorCard}>
                    {!activeTag ? (
                        <div className={styles.emptyState}>请选择一个特殊标签开始编辑。</div>
                    ) : (
                        <>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardTitle}>编辑特殊标签</div>
                            </div>

                            <div className={styles.editorForm}>
                                <label className={styles.field}>
                                    特殊标签名称
                                    <input
                                        className={styles.input}
                                        value={editorName}
                                        onChange={(event) => setEditorName(event.target.value)}
                                    />
                                </label>

                                <label className={styles.field}>
                                    配置模式
                                    <select
                                        className={styles.select}
                                        value={editorMode}
                                        onChange={(event) => setEditorMode(event.target.value as SpecialThemeConfigMode)}
                                    >
                                        {CONFIG_MODE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {editorMode === 'auto' ? (
                                    <label className={styles.field}>
                                        自动排序
                                        <select
                                            className={styles.select}
                                            value={editorAutoSort}
                                            onChange={(event) => setEditorAutoSort(event.target.value as SpecialThemeAutoSort)}
                                        >
                                            {AUTO_SORT_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ) : (
                                    <div />
                                )}
                            </div>

                            {editorMode === 'manual' ? (
                                <div className={styles.manualPanel}>
                                    <div className={styles.manualHeader}>
                                        <div className={styles.cardTitle}>手动剧本配置</div>
                                        <div className={styles.limitText}>{editorGames.length} / {manualLimit}</div>
                                    </div>

                                    <label className={styles.field}>
                                        搜索公开剧本
                                        <input
                                            className={styles.input}
                                            value={searchKeyword}
                                            onChange={(event) => setSearchKeyword(event.target.value)}
                                            placeholder="输入剧本标题、ID 或简介关键词"
                                        />
                                    </label>

                                    {searchKeyword.trim() ? (
                                        <div className={styles.searchPanel}>
                                            {isSearching ? <div className={styles.searchEmpty}>剧本搜索中...</div> : null}
                                            {!isSearching && searchResults.length === 0 ? (
                                                <div className={styles.searchEmpty}>没有找到匹配的公开剧本</div>
                                            ) : null}
                                            {!isSearching && searchResults.map((game) => (
                                                <button
                                                    key={game.file_id}
                                                    type="button"
                                                    className={styles.searchItem}
                                                    onClick={() => handleAddGame(game)}
                                                >
                                                    <span className={styles.searchItemTitle}>{game.title}</span>
                                                    <span className={styles.searchItemMeta}>{game.file_id}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                    <div className={styles.selectedGameList}>
                                        {editorGames.length === 0 ? (
                                            <div className={styles.emptyState}>当前还没有配置手动剧本。</div>
                                        ) : (
                                            editorGames.map((game, index) => (
                                                <div
                                                    key={game.file_id}
                                                    draggable
                                                    className={styles.selectedGameItem}
                                                    onDragStart={() => handleGameDragStart(game.file_id)}
                                                    onDragOver={(event) => handleGameDragOver(event, game.file_id)}
                                                    onDragEnd={() => setDraggingGameFileId(null)}
                                                >
                                                    <div className={styles.selectedGameOrder}>{index + 1}</div>
                                                    <div className={styles.selectedGameInfo}>
                                                        <div className={styles.selectedGameTitle}>{game.title || game.file_id}</div>
                                                        <div className={styles.selectedGameMeta}>{game.file_id}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={styles.dangerButton}
                                                        onClick={() => handleRemoveGame(game.file_id)}
                                                    >
                                                        移除
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            <div className={styles.actionRow}>
                                <button
                                    type="button"
                                    className={styles.primaryButton}
                                    onClick={() => void handleSaveCurrentTag()}
                                    disabled={isSaving}
                                >
                                    保存特殊标签
                                </button>
                                <button
                                    type="button"
                                    className={styles.dangerButton}
                                    onClick={() => void handleDeleteCurrentTag()}
                                    disabled={isSaving}
                                >
                                    删除特殊标签
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
};

export default SpecialThemeTagManager;
