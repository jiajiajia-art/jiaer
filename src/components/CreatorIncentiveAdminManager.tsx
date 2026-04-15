import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import incentiveApi from '../api/incentive/incentiveApi';
import type {
    AdminIncentiveAuthorInfo,
    AdminIncentiveGameRecord,
    AdminIncentiveLookupMode,
    AdminIncentivePagination,
    AdminUpdateIncentiveGamePayload,
} from '../api/incentive/incentive.type';
import Pagination from './Pagination';
import styles from './CreatorIncentiveAdminManager.module.css';

const DEFAULT_AUTHOR_PAGE_SIZE = 200;
const DEFAULT_GAME_PAGE_SIZE = 10;

const emptyPagination: AdminIncentivePagination = {
    page: 1,
    pageSize: DEFAULT_GAME_PAGE_SIZE,
    total: 0,
    totalPages: 1,
};

const formatTime = (value?: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = error as { response?: { data?: { message?: string; error?: string } } };
        return response.response?.data?.message || response.response?.data?.error || fallback;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const toDateTimeLocalValue = (iso?: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 16);
};

const toIsoDateTime = (localDateTime: string): string => {
    if (!localDateTime) return '';
    const date = new Date(localDateTime);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
};

const getAuthorDisplayName = (author: AdminIncentiveAuthorInfo): string => author.nickname || author.userCode || author.phoneNumber || author.userId;

const isAuthorIncentive = (author: AdminIncentiveAuthorInfo): boolean => {
    if (typeof author.incentiveEnabled === 'boolean') return author.incentiveEnabled;
    return author.userSegment === 'incentive';
};

const getGameStatusLabel = (status: AdminIncentiveGameRecord['incentiveStatus']): string => {
    if (status === 'incentive') return '激励中';
    if (status === 'finished') return '已结束';
    return '未加入';
};

const normalizeAuthorListPayload = (payload: unknown): { list: AdminIncentiveAuthorInfo[]; pagination: AdminIncentivePagination } => {
    if (Array.isArray(payload)) {
        return {
            list: payload as AdminIncentiveAuthorInfo[],
            pagination: {
                page: 1,
                pageSize: payload.length,
                total: payload.length,
                totalPages: 1,
            },
        };
    }

    if (!payload || typeof payload !== 'object') {
        return { list: [], pagination: emptyPagination };
    }

    const record = payload as {
        list?: unknown;
        rows?: unknown;
        items?: unknown;
        data?: unknown;
        pagination?: Partial<AdminIncentivePagination>;
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
    };

    const candidate = record.list ?? record.rows ?? record.items ?? record.data;
    const list = Array.isArray(candidate) ? (candidate as AdminIncentiveAuthorInfo[]) : [];

    const resolvedPageSize = record.pagination?.pageSize ?? record.pageSize ?? list.length;
    const pageSize = Number(resolvedPageSize || DEFAULT_AUTHOR_PAGE_SIZE);
    const total = Number(record.pagination?.total ?? record.total ?? list.length);
    const totalPages = Number(record.pagination?.totalPages ?? record.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))));

    return {
        list,
        pagination: {
            page: Number(record.pagination?.page ?? record.page ?? 1),
            pageSize,
            total,
            totalPages,
        },
    };
};

const CreatorIncentiveAdminManager: React.FC = () => {
    const [authorFilter, setAuthorFilter] = useState<'all' | 'joined' | 'notJoined'>('joined');

    const [authors, setAuthors] = useState<AdminIncentiveAuthorInfo[]>([]);
    const [authorPagination, setAuthorPagination] = useState<AdminIncentivePagination>(emptyPagination);
    const [isLoadingAuthors, setIsLoadingAuthors] = useState(true);

    const [searchMode, setSearchMode] = useState<AdminIncentiveLookupMode>('userCode');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [isSearchingAuthor, setIsSearchingAuthor] = useState(false);
    const [searchedAuthor, setSearchedAuthor] = useState<AdminIncentiveAuthorInfo | null>(null);

    const [selectedAuthor, setSelectedAuthor] = useState<AdminIncentiveAuthorInfo | null>(null);
    const [isUpdatingAuthor, setIsUpdatingAuthor] = useState(false);

    const [games, setGames] = useState<AdminIncentiveGameRecord[]>([]);
    const [gamePagination, setGamePagination] = useState<AdminIncentivePagination>(emptyPagination);
    const [isLoadingGames, setIsLoadingGames] = useState(false);
    const [gamePage, setGamePage] = useState(1);
    const [gameKeywordInput, setGameKeywordInput] = useState('');
    const [gameKeyword, setGameKeyword] = useState('');

    const [editingGame, setEditingGame] = useState<AdminIncentiveGameRecord | null>(null);
    const [gameEnabled, setGameEnabled] = useState(true);
    const [startLocalValue, setStartLocalValue] = useState('');
    const [endLocalValue, setEndLocalValue] = useState('');
    const [settledAmountInput, setSettledAmountInput] = useState('');
    const [isUpdatingGame, setIsUpdatingGame] = useState(false);

    const isSearchView = useMemo(() => Boolean(searchKeyword.trim()) && Boolean(searchedAuthor), [searchKeyword, searchedAuthor]);

    const resolvedAuthors = useMemo(() => {
        if (isSearchView && searchedAuthor) return [searchedAuthor];
        return authors;
    }, [authors, isSearchView, searchedAuthor]);

    const loadAuthors = useCallback(async () => {
        try {
            setIsLoadingAuthors(true);

            let enabled: boolean | undefined;
            if (authorFilter === 'joined') enabled = true;
            if (authorFilter === 'notJoined') enabled = false;

            const response = await incentiveApi.listAdminIncentiveAuthors({
                page: 1,
                pageSize: DEFAULT_AUTHOR_PAGE_SIZE,
                enabled,
            });

            const normalized = normalizeAuthorListPayload(response.data.data);
            setAuthors(normalized.list);
            setAuthorPagination({
                page: normalized.pagination.page,
                pageSize: normalized.pagination.pageSize,
                total: normalized.pagination.total,
                totalPages: normalized.pagination.totalPages,
            });

            if (!isSearchView) {
                setSelectedAuthor((prev) => {
                    if (!prev) return normalized.list[0] || null;
                    const keep = normalized.list.find((author) => author.userId === prev.userId);
                    return keep || normalized.list[0] || null;
                });
            }
        } catch (error) {
            toast.error(getErrorMessage(error, '作者列表加载失败'));
            setAuthors([]);
            setAuthorPagination(emptyPagination);
            if (!isSearchView) {
                setSelectedAuthor(null);
            }
        } finally {
            setIsLoadingAuthors(false);
        }
    }, [authorFilter, isSearchView]);

    const loadGames = useCallback(async (userId: string, page: number, keyword: string) => {
        try {
            setIsLoadingGames(true);
            const response = await incentiveApi.getAdminIncentiveAuthorGames(userId, {
                page,
                pageSize: DEFAULT_GAME_PAGE_SIZE,
                keyword: keyword || undefined,
            });
            const payload = response.data.data;
            setGames(payload?.list || []);
            setGamePagination(payload?.pagination || emptyPagination);

            if (payload?.author) {
                setSelectedAuthor(payload.author);
                setSearchedAuthor((prev) => {
                    if (prev && prev.userId === payload.author.userId) return payload.author;
                    return prev;
                });
                setAuthors((prev) => prev.map((author) => (author.userId === payload.author.userId ? payload.author : author)));
            }
        } catch (error) {
            toast.error(getErrorMessage(error, '作者作品列表加载失败'));
            setGames([]);
            setGamePagination(emptyPagination);
        } finally {
            setIsLoadingGames(false);
        }
    }, []);

    useEffect(() => {
        void loadAuthors();
    }, [loadAuthors]);

    useEffect(() => {
        if (!selectedAuthor?.userId) {
            setGames([]);
            setGamePagination(emptyPagination);
            return;
        }
        void loadGames(selectedAuthor.userId, gamePage, gameKeyword);
    }, [selectedAuthor?.userId, gamePage, gameKeyword, loadGames]);

    useEffect(() => {
        if (isSearchView) return;
        setSelectedAuthor((prev) => {
            if (prev && authors.some((author) => author.userId === prev.userId)) {
                return authors.find((author) => author.userId === prev.userId) || null;
            }
            return authors[0] || null;
        });
    }, [authors, isSearchView]);

    const handleSearchAuthor = async () => {
        const keyword = searchKeyword.trim();
        if (!keyword) {
            toast.error(searchMode === 'userCode' ? '请输入作者 Kuran 号' : '请输入作者手机号');
            return;
        }

        try {
            setIsSearchingAuthor(true);
            const response = await incentiveApi.lookupAdminIncentiveAuthor(searchMode, keyword);
            const author = response.data.data;
            if (!author) {
                toast.error('未找到作者');
                setSearchedAuthor(null);
                return;
            }
            setSearchedAuthor(author);
            setSelectedAuthor(author);
            setGamePage(1);
            setGameKeyword('');
            setGameKeywordInput('');
            toast.success('作者查询成功');
        } catch (error) {
            setSearchedAuthor(null);
            toast.error(getErrorMessage(error, '作者查询失败'));
        } finally {
            setIsSearchingAuthor(false);
        }
    };

    const handleClearSearch = () => {
        setSearchKeyword('');
        setSearchedAuthor(null);
        setSelectedAuthor((prev) => {
            if (prev && authors.some((author) => author.userId === prev.userId)) {
                return authors.find((author) => author.userId === prev.userId) || null;
            }
            return authors[0] || null;
        });
    };

    const handleSelectAuthor = (author: AdminIncentiveAuthorInfo) => {
        setSelectedAuthor(author);
        setGamePage(1);
        setGameKeyword('');
        setGameKeywordInput('');
    };

    const handleToggleAuthorIncentive = async () => {
        if (!selectedAuthor) {
            toast.error('请先选择作者');
            return;
        }

        try {
            setIsUpdatingAuthor(true);
            const nextEnabled = !isAuthorIncentive(selectedAuthor);
            const response = await incentiveApi.updateAdminIncentiveAuthor(selectedAuthor.userId, { enabled: nextEnabled });
            const updated = response.data.data;
            if (!updated) {
                toast.error('作者激励状态更新失败');
                return;
            }

            setSelectedAuthor(updated);
            setSearchedAuthor((prev) => {
                if (prev && prev.userId === updated.userId) return updated;
                return prev;
            });
            setAuthors((prev) => prev.map((author) => (author.userId === updated.userId ? updated : author)));

            toast.success(nextEnabled ? '作者已加入激励计划' : '作者已退出激励计划');
            await loadAuthors();
        } catch (error) {
            toast.error(getErrorMessage(error, '作者激励状态更新失败'));
        } finally {
            setIsUpdatingAuthor(false);
        }
    };

    const handleSearchGames = () => {
        setGamePage(1);
        setGameKeyword(gameKeywordInput.trim());
    };

    const handleClearGameSearch = () => {
        setGameKeywordInput('');
        setGameKeyword('');
        setGamePage(1);
    };

    const handleOpenGameModal = (game: AdminIncentiveGameRecord) => {
        const enabled = game.incentiveStatus !== 'none' || Boolean(game.incentiveStartTime);
        setEditingGame(game);
        setGameEnabled(enabled);
        setStartLocalValue(toDateTimeLocalValue(game.incentiveStartTime));
        setEndLocalValue(toDateTimeLocalValue(game.incentiveEndTime));
        setSettledAmountInput(String(Number(game.incentiveSettledAmount || 0)));
    };

    const handleCloseGameModal = () => {
        if (isUpdatingGame) return;
        setEditingGame(null);
        setStartLocalValue('');
        setEndLocalValue('');
        setSettledAmountInput('');
    };

    const handleSubmitGameModal = async () => {
        if (!selectedAuthor || !editingGame) {
            toast.error('请先选择作品');
            return;
        }

        if (gameEnabled && !startLocalValue) {
            toast.error('开启激励时必须填写开始时间');
            return;
        }

        const startIso = gameEnabled ? toIsoDateTime(startLocalValue) : '';
        const endIso = gameEnabled && endLocalValue ? toIsoDateTime(endLocalValue) : null;

        if (gameEnabled && !startIso) {
            toast.error('激励开始时间格式不正确');
            return;
        }

        if (gameEnabled && endIso && new Date(startIso).getTime() > new Date(endIso).getTime()) {
            toast.error('激励开始时间不能晚于结束时间');
            return;
        }

        let settledAmount: number | undefined;
        if (settledAmountInput.trim()) {
            const parsed = Number(settledAmountInput);
            if (!Number.isInteger(parsed) || parsed < 0) {
                toast.error('已结算金额必须为大于等于 0 的整数');
                return;
            }
            settledAmount = parsed;
        }

        const payload: AdminUpdateIncentiveGamePayload = { enabled: gameEnabled };
        if (gameEnabled) {
            payload.incentiveStartTime = startIso;
            payload.incentiveEndTime = endIso;
        }
        if (typeof settledAmount === 'number') {
            payload.incentiveSettledAmount = settledAmount;
        }

        try {
            setIsUpdatingGame(true);
            await incentiveApi.updateAdminIncentiveAuthorGame(selectedAuthor.userId, editingGame.fileId, payload);
            toast.success('作品激励配置已更新');
            handleCloseGameModal();
            await loadGames(selectedAuthor.userId, gamePage, gameKeyword);
        } catch (error) {
            toast.error(getErrorMessage(error, '作品激励配置更新失败'));
        } finally {
            setIsUpdatingGame(false);
        }
    };

    return (
        <>
            <div className={styles.panelStack}>
                <section className={styles.heroCard}>
                    <div className={styles.heroMain}>
                        <div className={styles.sectionBadge}>创作者激励计划</div>
                        <h2 className={styles.heroTitle}>作者筛选、搜索与作品激励配置统一管理</h2>
                        <p className={styles.heroDesc}>默认展示已加入激励计划作者；搜索仅用于临时定位作者，不会写入左侧默认列表。</p>
                    </div>
                    <div className={styles.heroStats}>
                        <div className={styles.statItem}>
                            <span>当前列表人数</span>
                            <strong>{resolvedAuthors.length}</strong>
                        </div>
                    </div>
                </section>

                <div className={styles.grid}>
                    <section className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3 className={styles.cardTitle}>作者列表</h3>
                                <p className={styles.cardDesc}>左侧列表来自作者列表接口与筛选条件；搜索时左侧只显示命中的作者。</p>
                            </div>
                        </div>

                        <div className={styles.authorFilterBar}>
                            <select className={styles.select} value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value as 'all' | 'joined' | 'notJoined')}>
                                <option value="joined">已加入激励计划</option>
                                <option value="notJoined">未加入激励计划</option>
                                <option value="all">全部作者</option>
                            </select>
                        </div>

                        <div className={styles.filterBar}>
                            <input
                                className={styles.textInput}
                                value={searchKeyword}
                                onChange={(event) => setSearchKeyword(event.target.value)}
                                placeholder={searchMode === 'userCode' ? '输入作者 Kuran 号' : '输入作者手机号'}
                            />
                            <select className={styles.select} value={searchMode} onChange={(event) => setSearchMode(event.target.value as AdminIncentiveLookupMode)}>
                                <option value="userCode">按 Kuran 号</option>
                                <option value="phoneNumber">按手机号</option>
                            </select>
                        </div>
                        <div className={styles.actionRow}>
                            <button type="button" className={styles.primaryButton} onClick={() => void handleSearchAuthor()} disabled={isSearchingAuthor}>
                                {isSearchingAuthor ? '搜索中...' : '搜索作者'}
                            </button>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={handleClearSearch}
                                disabled={!searchKeyword && !searchedAuthor}
                            >
                                清空搜索
                            </button>
                            <button type="button" className={styles.secondaryButton} onClick={() => void loadAuthors()} disabled={isLoadingAuthors}>
                                刷新列表
                            </button>
                        </div>

                        <div className={styles.remarkLine}>
                            {isSearchView
                                ? `当前为搜索视图：仅显示 ${searchedAuthor ? getAuthorDisplayName(searchedAuthor) : '-'}。清空搜索后恢复默认列表。`
                                : `当前列表总量：${authorPagination.total}（按当前筛选条件）`}
                        </div>

                        <div className={styles.list}>
                            {isLoadingAuthors ? <div className={styles.emptyState}>作者列表加载中...</div> : null}
                            {!isLoadingAuthors && resolvedAuthors.length === 0 ? <div className={styles.emptyState}>当前条件下暂无作者。</div> : null}
                            {!isLoadingAuthors && resolvedAuthors.map((author) => {
                                const active = selectedAuthor?.userId === author.userId;
                                const joined = isAuthorIncentive(author);
                                return (
                                    <article key={author.userId} className={`${styles.itemCard} ${active ? styles.itemCardActive : ''}`}>
                                        <button type="button" className={styles.itemMainButton} onClick={() => handleSelectAuthor(author)}>
                                            <div className={styles.itemHeader}>
                                                <div className={styles.itemTitle}>{getAuthorDisplayName(author)}</div>
                                                <span className={`${styles.statusTag} ${joined ? styles.statusJoined : styles.statusNone}`}>
                                                    {joined ? '已加入' : '未加入'}
                                                </span>
                                            </div>
                                            <div className={styles.itemMeta}>Kuran 号：{author.userCode || '-'}</div>
                                            <div className={styles.itemMeta}>手机号：{author.phoneNumber || '-'}</div>
                                            <div className={styles.itemMeta}>用户ID：{author.userId}</div>
                                        </button>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    <section className={styles.card}>
                        {!selectedAuthor ? (
                            <div className={styles.emptyState}>请先在左侧选择作者。</div>
                        ) : (
                            <>
                                <div className={styles.cardHeader}>
                                    <div>
                                        <h3 className={styles.cardTitle}>作者详情与作品管理</h3>
                                        <p className={styles.cardDesc}>支持作者加入/退出激励计划，并管理该作者每个作品的激励配置。</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={isAuthorIncentive(selectedAuthor) ? styles.dangerButton : styles.primaryButton}
                                        onClick={() => void handleToggleAuthorIncentive()}
                                        disabled={isUpdatingAuthor}
                                    >
                                        {isUpdatingAuthor
                                            ? '提交中...'
                                            : isAuthorIncentive(selectedAuthor)
                                                ? '切换为普通作者'
                                                : '加入激励计划'}
                                    </button>
                                </div>

                                <div className={styles.filterBar}>
                                    <input
                                        className={styles.textInput}
                                        value={gameKeywordInput}
                                        onChange={(event) => setGameKeywordInput(event.target.value)}
                                        placeholder="按作品标题搜索"
                                    />
                                    <button type="button" className={styles.secondaryButton} onClick={handleSearchGames}>搜索作品</button>
                                </div>
                                <div className={styles.actionRow}>
                                    <button type="button" className={styles.secondaryButton} onClick={handleClearGameSearch} disabled={!gameKeywordInput && !gameKeyword}>
                                        清空作品搜索
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => {
                                            if (selectedAuthor.userId) {
                                                void loadGames(selectedAuthor.userId, gamePage, gameKeyword);
                                            }
                                        }}
                                        disabled={isLoadingGames}
                                    >
                                        刷新作品
                                    </button>
                                </div>

                                <div className={styles.list}>
                                    {isLoadingGames ? <div className={styles.emptyState}>作品列表加载中...</div> : null}
                                    {!isLoadingGames && games.length === 0 ? <div className={styles.emptyState}>该作者暂无作品或无匹配结果。</div> : null}
                                    {!isLoadingGames && games.map((game) => (
                                        <article key={game.fileId} className={styles.itemCard}>
                                            <div className={styles.itemHeader}>
                                                <div className={styles.itemTitle}>{game.title}</div>
                                                <span
                                                    className={`${styles.statusTag} ${game.incentiveStatus === 'incentive'
                                                        ? styles.statusJoined
                                                        : game.incentiveStatus === 'finished'
                                                            ? styles.statusFinished
                                                            : styles.statusNone}`}
                                                >
                                                    {getGameStatusLabel(game.incentiveStatus)}
                                                </span>
                                            </div>
                                            <div className={styles.metaGrid}>
                                                <span className={styles.itemMeta}>激励开始：{formatTime(game.incentiveStartTime)}</span>
                                                <span className={styles.itemMeta}>激励结束：{formatTime(game.incentiveEndTime)}</span>
                                                <span className={styles.itemMeta}>已结算金额：{game.incentiveSettledAmount ?? 0}</span>
                                                <span className={styles.itemMeta}>更新时间：{formatTime(game.updatedAt)}</span>
                                            </div>
                                            <div className={styles.actionRow}>
                                                <button type="button" className={styles.primaryButton} onClick={() => handleOpenGameModal(game)}>
                                                    {game.incentiveStatus === 'none' ? '加入激励并配置' : '编辑激励配置'}
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </div>

                                <Pagination
                                    className={styles.paginationBar}
                                    currentPage={gamePagination.page}
                                    totalPages={gamePagination.totalPages}
                                    onPageChange={setGamePage}
                                    disabled={isLoadingGames || isUpdatingGame}
                                    summary={`第 ${gamePagination.page} 页，共 ${gamePagination.totalPages} 页，共 ${gamePagination.total} 条记录`}
                                />
                            </>
                        )}
                    </section>
                </div>
            </div>

            {editingGame ? (
                <div className={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) handleCloseGameModal(); }}>
                    <div className={styles.modalCard} role="dialog" aria-modal="true" aria-label="编辑作品激励配置">
                        <div className={styles.cardHeader}>
                            <div>
                                <h3 className={styles.cardTitle}>编辑作品激励配置</h3>
                                <p className={styles.cardDesc}>作品：{editingGame.title}</p>
                            </div>
                            <button type="button" className={styles.secondaryButton} onClick={handleCloseGameModal} disabled={isUpdatingGame}>关闭</button>
                        </div>

                        <div className={styles.formArea}>
                            <label className={styles.fieldLabel}>
                                是否加入激励
                                <select
                                    className={styles.select}
                                    value={gameEnabled ? '1' : '0'}
                                    onChange={(event) => setGameEnabled(event.target.value === '1')}
                                    disabled={isUpdatingGame}
                                >
                                    <option value="1">加入激励</option>
                                    <option value="0">退出激励</option>
                                </select>
                            </label>

                            {gameEnabled ? (
                                <div className={styles.formGrid}>
                                    <label className={styles.fieldLabel}>
                                        激励开始时间
                                        <input
                                            className={styles.textInput}
                                            type="datetime-local"
                                            value={startLocalValue}
                                            onChange={(event) => setStartLocalValue(event.target.value)}
                                            disabled={isUpdatingGame}
                                        />
                                    </label>
                                    <label className={styles.fieldLabel}>
                                        激励结束时间
                                        <input
                                            className={styles.textInput}
                                            type="datetime-local"
                                            value={endLocalValue}
                                            onChange={(event) => setEndLocalValue(event.target.value)}
                                            disabled={isUpdatingGame}
                                        />
                                    </label>
                                </div>
                            ) : null}

                            <label className={styles.fieldLabel}>
                                已结算金额（可选）
                                <input
                                    className={styles.textInput}
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={settledAmountInput}
                                    onChange={(event) => setSettledAmountInput(event.target.value)}
                                    placeholder="不填则保持后端当前值"
                                    disabled={isUpdatingGame}
                                />
                            </label>

                            <div className={styles.actionRow}>
                                <button type="button" className={styles.secondaryButton} onClick={handleCloseGameModal} disabled={isUpdatingGame}>
                                    取消
                                </button>
                                <button type="button" className={styles.primaryButton} onClick={() => void handleSubmitGameModal()} disabled={isUpdatingGame}>
                                    {isUpdatingGame ? '保存中...' : '保存配置'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
};

export default CreatorIncentiveAdminManager;

