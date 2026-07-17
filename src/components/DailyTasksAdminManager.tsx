import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmModal from './CommonModal/ConfirmModal';
import dailyTasksApi, {
    type AdminDailyTaskConfig,
    type AdminDailyTaskPayload,
    type AdminDailyTaskStatus,
    type AdminDailyTaskKind,
} from '../api/admin/dailyTasksApi';
import { getApiErrorMessage } from '../utils/error';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import styles from './DailyTasksAdminManager.module.css';

const SEARCH_DEBOUNCE_MS = 300;
const GAME_SEARCH_PAGE_SIZE = 20;

type DailyTaskFormState = {
    title: string;
    description: string;
    rewardPoints: string;
    gameFileId: string;
    selectedGameTitle: string;
    startAt: string;
    endAt: string;
    status: AdminDailyTaskStatus;
    sortOrder: string;
    taskKind: AdminDailyTaskKind;
    targetCount: string;
    targetSeconds: string;
};

const createEmptyForm = (): DailyTaskFormState => ({
    title: '',
    description: '',
    rewardPoints: '12',
    gameFileId: '',
    selectedGameTitle: '',
    startAt: '',
    endAt: '',
    status: 'draft',
    sortOrder: '1',
    taskKind: 'play_specific_game',
    targetCount: '1',
    targetSeconds: '1800',
});

const statusLabelMap: Record<AdminDailyTaskStatus, string> = {
    draft: '草稿',
    published: '已发布',
};

const taskKindLabelMap: Record<AdminDailyTaskKind, string> = {
    play_specific_game: '游玩次数任务',
    play_specific_game_duration: '游玩时长任务',
    game_promotion: '游戏推广任务', // targetCount = 需完成推广的有效访问人数
};

const formatTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const toDateTimeLocalValue = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60_000);
    return localDate.toISOString().slice(0, 16);
};

const toIsoDateTime = (value: string) => {
    if (!value.trim()) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

const toFormState = (task: AdminDailyTaskConfig): DailyTaskFormState => ({
    title: task.title || '',
    description: task.description || '',
    rewardPoints: String(task.rewardPoints || 12),
    gameFileId: task.gameFileId || '',
    selectedGameTitle: task.gameTitle || '',
    startAt: toDateTimeLocalValue(task.startAt),
    endAt: toDateTimeLocalValue(task.endAt),
    status: task.status,
    sortOrder: String(task.sortOrder ?? 1),
    taskKind: task.taskKind,
    targetCount: String(task.targetCount ?? 1),
    targetSeconds: task.targetSeconds != null ? String(task.targetSeconds) : '1800',
});

const DailyTasksAdminManager: React.FC = () => {
    const [tasks, setTasks] = useState<AdminDailyTaskConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
    const [form, setForm] = useState<DailyTaskFormState>(createEmptyForm());
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<AdminDailyTaskConfig | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Game search state
    const [gameSearchKeyword, setGameSearchKeyword] = useState('');
    const [gameSearchResults, setGameSearchResults] = useState<UserGameData[]>([]);
    const [isSearchingGames, setIsSearchingGames] = useState(false);
    const [showGameDropdown, setShowGameDropdown] = useState(false);
    const gameSearchTimerRef = useRef<number | null>(null);
    const gameDropdownRef = useRef<HTMLDivElement | null>(null);

    const loadTasks = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await dailyTasksApi.list();
            const list = Array.isArray(response.data.data) ? response.data.data : [];
            const sortedList = [...list].sort((a, b) => {
                const sortA = Number(a.sortOrder ?? 0);
                const sortB = Number(b.sortOrder ?? 0);
                if (sortA !== sortB) return sortA - sortB;
                return Number(a.id) - Number(b.id);
            });
            setTasks(sortedList);
        } catch (error) {
            toast.error(getApiErrorMessage(error, '每日任务列表加载失败'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadTasks();
    }, [loadTasks]);

    // Debounced game search
    useEffect(() => {
        if (!showGameDropdown) return;

        if (gameSearchTimerRef.current) {
            window.clearTimeout(gameSearchTimerRef.current);
        }

        gameSearchTimerRef.current = window.setTimeout(async () => {
            try {
                setIsSearchingGames(true);
                const response = await getGameDataApi.searchPublicGames({
                    q: gameSearchKeyword,
                    page: 1,
                    pageSize: GAME_SEARCH_PAGE_SIZE,
                });
                setGameSearchResults(response.data.data || []);
            } catch {
                setGameSearchResults([]);
            } finally {
                setIsSearchingGames(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            if (gameSearchTimerRef.current) {
                window.clearTimeout(gameSearchTimerRef.current);
            }
        };
    }, [gameSearchKeyword, showGameDropdown]);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest(`[data-game-search]`)) {
                setShowGameDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const publishedCount = useMemo(
        () => tasks.filter((task) => task.status === 'published').length,
        [tasks],
    );
    const draftCount = useMemo(
        () => tasks.filter((task) => task.status === 'draft').length,
        [tasks],
    );

    const getSelectedGameTitle = (): string => {
        if (form.selectedGameTitle) return form.selectedGameTitle;
        if (!form.gameFileId) return '';
        const found = gameSearchResults.find((g) => g.file_id === form.gameFileId);
        if (found) return found.title;
        return form.gameFileId;
    };

    const handleSelectGame = (game: UserGameData) => {
        setForm((prev) => ({
            ...prev,
            gameFileId: game.file_id,
            selectedGameTitle: game.title || game.file_id,
        }));
        setGameSearchKeyword('');
        setGameSearchResults([]);
        setShowGameDropdown(false);
    };

    const handleClearGame = () => {
        updateForm('gameFileId', '');
        updateForm('selectedGameTitle', '');
        setGameSearchKeyword('');
        setGameSearchResults([]);
        setShowGameDropdown(false);
    };

    const resetModalState = () => {
        setEditingTaskId(null);
        setForm(createEmptyForm());
        setFormError('');
        setIsSubmitting(false);
    };

    const openCreateModal = () => {
        resetModalState();
        setIsModalOpen(true);
    };

    const openEditModal = (task: AdminDailyTaskConfig) => {
        setEditingTaskId(task.id);
        setForm(toFormState(task));
        setFormError('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        resetModalState();
    };

    const updateForm = <K extends keyof DailyTaskFormState>(key: K, value: DailyTaskFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const buildPayload = (): AdminDailyTaskPayload | null => {
        const rewardPoints = Number(form.rewardPoints);
        const sortOrder = Number(form.sortOrder);
        const startAt = toIsoDateTime(form.startAt);
        const endAt = toIsoDateTime(form.endAt);

        if (!form.title.trim()) {
            setFormError('任务标题不能为空');
            return null;
        }
        if (!form.description.trim()) {
            setFormError('任务描述不能为空');
            return null;
        }
        if (!form.gameFileId.trim()) {
            setFormError('请先搜索并选择要绑定的作品');
            return null;
        }
        // 游玩次数与推广任务共用 targetCount；时长任务用 targetSeconds
        if (form.taskKind === 'play_specific_game' || form.taskKind === 'game_promotion') {
            const targetCount = Number(form.targetCount);
            if (!Number.isInteger(targetCount) || targetCount <= 0) {
                setFormError(form.taskKind === 'game_promotion' ? '推广次数必须是大于 0 的整数' : '目标次数必须是大于 0 的整数');
                return null;
            }
        }
        if (form.taskKind === 'play_specific_game_duration') {
            const targetSeconds = Number(form.targetSeconds);
            if (!Number.isInteger(targetSeconds) || targetSeconds <= 0) {
                setFormError('目标时长必须是大于 0 的整数（单位：秒）');
                return null;
            }
        }
        if (!Number.isInteger(rewardPoints) || rewardPoints <= 0) {
            setFormError('奖励积分必须是大于 0 的整数');
            return null;
        }
        if (form.startAt.trim() && startAt === null) {
            setFormError('开始时间格式不正确');
            return null;
        }
        if (form.endAt.trim() && endAt === null) {
            setFormError('结束时间格式不正确');
            return null;
        }
        if (startAt && endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
            setFormError('结束时间不能早于开始时间');
            return null;
        }
        if (form.sortOrder.trim() && (!Number.isFinite(sortOrder) || sortOrder < 0)) {
            setFormError('排序值不能为负数');
            return null;
        }

        setFormError('');
        const payload: AdminDailyTaskPayload = {
            title: form.title.trim(),
            description: form.description.trim(),
            taskKind: form.taskKind,
            rewardPoints,
            gameFileId: form.gameFileId.trim(),
            startAt: startAt || undefined,
            endAt: endAt || undefined,
            status: form.status,
            sortOrder: form.sortOrder.trim() ? sortOrder : undefined,
        };

        // 游玩次数与推广任务共用 targetCount；时长任务用 targetSeconds
        if (form.taskKind === 'play_specific_game' || form.taskKind === 'game_promotion') {
            payload.targetCount = Number(form.targetCount);
        } else {
            payload.targetSeconds = Number(form.targetSeconds);
        }

        return payload;
    };

    const handleSubmit = async () => {
        const payload = buildPayload();
        if (!payload) return;

        try {
            setIsSubmitting(true);
            if (editingTaskId === null) {
                await dailyTasksApi.create(payload);
                toast.success('每日任务创建成功');
            } else {
                await dailyTasksApi.update(editingTaskId, payload);
                toast.success('每日任务更新成功');
            }
            setIsModalOpen(false);
            resetModalState();
            await loadTasks();
        } catch (error) {
            toast.error(getApiErrorMessage(error, editingTaskId === null ? '每日任务创建失败' : '每日任务更新失败'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleQuickStatusChange = async (task: AdminDailyTaskConfig, status: AdminDailyTaskStatus) => {
        if (task.status === status) return;
        try {
            await dailyTasksApi.update(task.id, {
                title: task.title,
                description: task.description,
                taskKind: task.taskKind,
                rewardPoints: task.rewardPoints,
                targetCount: task.targetCount,
                targetSeconds: task.targetSeconds,
                gameFileId: task.gameFileId,
                startAt: task.startAt || undefined,
                endAt: task.endAt || undefined,
                status,
                sortOrder: task.sortOrder ?? undefined,
            });
            toast.success(`任务已切换为${statusLabelMap[status]}`);
            await loadTasks();
        } catch (error) {
            toast.error(getApiErrorMessage(error, '任务状态切换失败'));
        }
    };

    const handleDeleteTask = async () => {
        if (!taskToDelete) return;

        try {
            setIsDeleting(true);
            await dailyTasksApi.remove(taskToDelete.id);
            toast.success('每日任务删除成功');
            setTaskToDelete(null);
            await loadTasks();
        } catch (error) {
            toast.error(getApiErrorMessage(error, '每日任务删除失败'));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className={styles.panelStack}>
            <section className={styles.heroCard}>
                <div>
                    <div className={styles.sectionBadge}>每日任务管理</div>
                    <h2 className={styles.heroTitle}>管理动态每日任务配置与发布状态</h2>
                    <p className={styles.heroDesc}>
                        当前管理的是按作品绑定的动态每日任务。支持列表查看、新建任务、编辑任务，以及在草稿、已发布、已下线之间快速切换。
                    </p>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.toolbar}>
                    <div className={styles.toolbarMeta}>
                        <span className={styles.metaPill}>总任务 {tasks.length}</span>
                        <span className={styles.metaPill}>已发布 {publishedCount}</span>
                        <span className={styles.metaPill}>草稿 {draftCount}</span>
                    </div>
                    <button type="button" className={styles.primaryButton} onClick={openCreateModal}>
                        新增每日任务
                    </button>
                </div>

                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.cardTitle}>任务配置列表</h3>
                        <div className={styles.cardDesc}>可在这里查看、编辑和切换任务状态。</div>
                    </div>
                </div>

                {isLoading ? (
                    <div className={styles.emptyState}>正在加载每日任务配置...</div>
                ) : tasks.length === 0 ? (
                    <div className={styles.emptyState}>当前还没有每日任务配置，先创建一条任务吧。</div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>任务信息</th>
                                    <th>类型</th>
                                    <th>目标</th>
                                    <th>作品</th>
                                    <th>奖励</th>
                                    <th>时间范围</th>
                                    <th>状态</th>
                                    <th>排序</th>
                                    <th>更新时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task) => (
                                    <tr key={task.id}>
                                        <td>
                                            <div className={styles.taskTitle}>
                                                <div className={styles.taskTitleMain}>{task.title}</div>
                                                <div className={styles.taskTitleSub}>{task.description}</div>
                                            </div>
                                        </td>
                                        <td>{taskKindLabelMap[task.taskKind] || task.taskKind}</td>
                                        <td>
                                            {task.taskKind === 'play_specific_game'
                                                ? `${task.targetCount ?? '-'} 次`
                                                : task.taskKind === 'game_promotion'
                                                  ? `${task.targetCount ?? '-'} 人` // 推广有效访问人数目标
                                                  : task.targetSeconds
                                                    ? `${task.targetSeconds} 秒`
                                                    : '-'}
                                        </td>
                                        <td>
                                            <div className={styles.gameCell}>
                                                <span>{task.gameTitle || '-'}</span>
                                                <code className={styles.gameCode}>{task.gameFileId}</code>
                                            </div>
                                        </td>
                                        <td>{task.rewardPoints} 积分</td>
                                        <td>
                                            <div>{formatTime(task.startAt)}</div>
                                            <div>{formatTime(task.endAt)}</div>
                                        </td>
                                        <td>
                                            <span
                                                className={`${styles.statusTag} ${
                                                    task.status === 'published'
                                                        ? styles.statusPublished
                                                        : styles.statusDraft
                                                }`}
                                            >
                                                {statusLabelMap[task.status] ?? task.status}
                                            </span>
                                        </td>
                                        <td>{task.sortOrder ?? '-'}</td>
                                        <td>{formatTime(task.updatedAt)}</td>
                                        <td>
                                            <div className={styles.actionRow}>
                                                <button type="button" className={styles.secondaryButton} onClick={() => openEditModal(task)}>
                                                    编辑
                                                </button>
                                                {task.status !== 'published' && (
                                                    <button
                                                        type="button"
                                                        className={styles.primaryButton}
                                                        onClick={() => void handleQuickStatusChange(task, 'published')}
                                                    >
                                                        发布
                                                    </button>
                                                )}
                                                {task.status !== 'draft' && (
                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        onClick={() => void handleQuickStatusChange(task, 'draft')}
                                                    >
                                                        设为草稿
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className={styles.dangerButton}
                                                    onClick={() => setTaskToDelete(task)}
                                                >
                                                    删除
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
                    <div className={styles.modalCard} role="dialog" aria-modal="true" aria-label={editingTaskId === null ? '新增每日任务' : '编辑每日任务'}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3 className={styles.cardTitle}>{editingTaskId === null ? '新增每日任务' : '编辑每日任务'}</h3>
                                <div className={styles.cardDesc}>填写任务信息后即可保存。</div>
                            </div>
                            <button type="button" className={styles.secondaryButton} onClick={closeModal} disabled={isSubmitting}>
                                关闭
                            </button>
                        </div>

                        <div className={styles.formGrid}>
                            <label className={styles.fieldLabel}>
                                任务状态
                                <select
                                    className={styles.select}
                                    value={form.status}
                                    onChange={(event) => updateForm('status', event.target.value as AdminDailyTaskStatus)}
                                >
                                    <option value="draft">草稿</option>
                                    <option value="published">已发布</option>
                                </select>
                            </label>

                            <label className={styles.fieldLabel}>
                                任务类型
                                <select
                                    className={styles.select}
                                    value={form.taskKind}
                                    onChange={(event) => updateForm('taskKind', event.target.value as AdminDailyTaskKind)}
                                >
                                    {Object.entries(taskKindLabelMap).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                                任务标题
                                <input
                                    className={styles.textInput}
                                    value={form.title}
                                    onChange={(event) => updateForm('title', event.target.value)}
                                    placeholder="例如：游玩指定作品"
                                />
                            </label>

                            <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                                任务描述
                                <textarea
                                    className={styles.textArea}
                                    value={form.description}
                                    onChange={(event) => updateForm('description', event.target.value)}
                                    placeholder="例如：游玩《作品A》1次"
                                />
                            </label>

                            {form.taskKind === 'play_specific_game' || form.taskKind === 'game_promotion' ? (
                                <label className={styles.fieldLabel}>
                                    {form.taskKind === 'game_promotion' ? '推广次数' : '目标次数'}
                                    <input
                                        className={styles.textInput}
                                        type="number"
                                        min={1}
                                        value={form.targetCount}
                                        onChange={(event) => updateForm('targetCount', event.target.value)}
                                    />
                                </label>
                            ) : (
                                <label className={styles.fieldLabel}>
                                    目标时长（秒）
                                    <input
                                        className={styles.textInput}
                                        type="number"
                                        min={1}
                                        value={form.targetSeconds}
                                        onChange={(event) => updateForm('targetSeconds', event.target.value)}
                                    />
                                </label>
                            )}

                            <label className={styles.fieldLabel}>
                                奖励积分
                                <input
                                    className={styles.textInput}
                                    type="number"
                                    min={1}
                                    value={form.rewardPoints}
                                    onChange={(event) => updateForm('rewardPoints', event.target.value)}
                                />
                            </label>

                            <label className={styles.fieldLabel}>
                                排序值
                                <input
                                    className={styles.textInput}
                                    type="number"
                                    min={0}
                                    value={form.sortOrder}
                                    onChange={(event) => updateForm('sortOrder', event.target.value)}
                                />
                            </label>

                            <label className={`${styles.fieldLabel} ${styles.fullWidth}`} data-game-search="">
                                绑定作品
                                <div className={styles.gameSearchWrapper}>
                                    {form.gameFileId ? (
                                        <div className={styles.gameSearchSelected}>
                                            <span className={styles.gameSearchSelectedTitle}>{getSelectedGameTitle()}</span>
                                            <code className={styles.gameSearchSelectedId}>{form.gameFileId}</code>
                                            <button
                                                type="button"
                                                className={styles.gameSearchClearBtn}
                                                onClick={handleClearGame}
                                                title="清除选择"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={styles.gameSearchInputRow}>
                                                <input
                                                    className={styles.textInput}
                                                    value={gameSearchKeyword}
                                                    onChange={(event) => {
                                                        setGameSearchKeyword(event.target.value);
                                                        setShowGameDropdown(true);
                                                    }}
                                                    onFocus={() => setShowGameDropdown(true)}
                                                    placeholder="输入作品标题搜索并选择..."
                                                    autoComplete="off"
                                                />
                                            </div>
                                            {showGameDropdown && (
                                                <div className={styles.gameSearchDropdown} ref={gameDropdownRef}>
                                                    {isSearchingGames ? (
                                                        <div className={styles.gameSearchItem}>搜索中...</div>
                                                    ) : gameSearchResults.length === 0 ? (
                                                        <div className={styles.gameSearchItem}>未找到匹配的作品</div>
                                                    ) : (
                                                        gameSearchResults.map((game) => (
                                                            <div
                                                                key={game.file_id}
                                                                className={`${styles.gameSearchItem} ${game.file_id === form.gameFileId ? styles.gameSearchItemSelected : ''}`}
                                                                onMouseDown={(event) => {
                                                                    event.preventDefault();
                                                                    handleSelectGame(game);
                                                                }}
                                                            >
                                                                <span className={styles.gameSearchItemTitle}>{game.title || game.file_id}</span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <span className={styles.fieldHint}>搜索并选择作品后，作品的 fileId 将自动填入</span>
                            </label>

                            <label className={styles.fieldLabel}>
                                开始时间
                                <input
                                    className={styles.textInput}
                                    type="datetime-local"
                                    value={form.startAt}
                                    onChange={(event) => updateForm('startAt', event.target.value)}
                                />
                            </label>

                            <label className={styles.fieldLabel}>
                                结束时间
                                <input
                                    className={styles.textInput}
                                    type="datetime-local"
                                    value={form.endAt}
                                    onChange={(event) => updateForm('endAt', event.target.value)}
                                />
                            </label>
                        </div>

                        {formError ? <div className={styles.fieldError}>{formError}</div> : null}

                        <div className={styles.modalFooter}>
                            <button type="button" className={styles.secondaryButton} onClick={closeModal} disabled={isSubmitting}>
                                取消
                            </button>
                            <button type="button" className={styles.primaryButton} onClick={() => void handleSubmit()} disabled={isSubmitting}>
                                {isSubmitting ? '提交中...' : editingTaskId === null ? '创建任务' : '保存修改'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={Boolean(taskToDelete)}
                onConfirm={() => {
                    void handleDeleteTask();
                }}
                onCancel={() => {
                    if (isDeleting) return;
                    setTaskToDelete(null);
                }}
                title="删除每日任务"
                message={taskToDelete ? `确定要删除任务“${taskToDelete.title || '未命名任务'}”吗？删除后不可恢复。` : '确定要删除这条每日任务吗？删除后不可恢复。'}
                confirmButtonText={isDeleting ? '删除中...' : '确认删除'}
                cancelButtonText="取消"
            />
        </div>
    );
};

export default DailyTasksAdminManager;
