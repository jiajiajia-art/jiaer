import type { AxiosError } from 'axios';
import { create } from 'zustand';
import dailyTaskApi from '../api/statistics/dailyTaskApi';
import {
    createDefaultDailyTaskList,
    normalizeDailyTaskPayload,
    type DailyTaskClaimRequest,
    type DailyTaskItem,
    type DailyTaskMakeupCardReward,
    type DailyTaskPayload,
    type DailyTaskRewardIssue,
    type DailyTaskSummary,
} from '../api/statistics/dailyTask.type';

interface DailyTaskState {
    isLoading: boolean;
    isLoadedOnce: boolean;
    isRefreshing: boolean;
    errorMessage: string;
    lastSyncedAt: number | null;
    summary: DailyTaskSummary;
    tasks: DailyTaskItem[];
    makeupCardReward: DailyTaskMakeupCardReward;
    makeupCardCount: number;
    isClaimingMakeupCard: boolean;
    updatedTaskKeys: string[];
    rewardsIssued: DailyTaskRewardIssue[];
    lastRewardDigest: string;
    pendingPlatformSeconds: number;
    pendingGameSeconds: number;
    flushInFlight: number;
    taskActionLoadingMap: Record<string, boolean>;
    setPendingSeconds: (kind: 'platform' | 'game', value: number) => void;
    addPendingSeconds: (kind: 'platform' | 'game', delta: number) => void;
    clearPendingSeconds: (kind: 'platform' | 'game') => void;
    markFlushStarted: () => void;
    markFlushSettled: () => void;
    getDisplayTotalSeconds: () => number;
    syncFromPayload: (payload: DailyTaskPayload | null | undefined) => boolean;
    refreshDailyTasks: (options?: { silent?: boolean }) => Promise<void>;
    acceptDailyTask: (task: Pick<DailyTaskItem, 'key' | 'taskId'>) => Promise<{ success: boolean; message: string }>;
    claimDailyTask: (
        task: Pick<DailyTaskItem, 'key' | 'claimRequest'>,
    ) => Promise<{ success: boolean; message: string }>;
    claimMakeupCard: () => Promise<{ success: boolean; message: string }>;
    consumeRewardsIssued: () => DailyTaskRewardIssue[];
    reset: () => void;
}

const defaultSummary: DailyTaskSummary = {
    platformSeconds: 0,
    gameSeconds: 0,
    totalSeconds: 0,
};

const defaultMakeupCardReward: DailyTaskMakeupCardReward = {
    current: 0,
    target: 4,
    completed: false,
    claimable: false,
    claimed: false,
};

const createDefaultTaskActionLoadingMap = (): Record<string, boolean> => ({});

const createRewardDigest = (items: DailyTaskRewardIssue[]): string =>
    JSON.stringify(
        items.map((item) => ({
            code: String(item.taskCode ?? item.code ?? item.taskId ?? ''),
            points: Number(item.points ?? item.rewardPoints ?? item.pointsAwarded ?? 0),
            message: String(item.message ?? ''),
        })),
    );

const claimErrorMessageMap: Record<string, string> = {
    INVALID_TASK_CODE: '任务类型无效',
    TASK_ALREADY_REWARDED: '今日该任务奖励已领取',
    TASK_NOT_COMPLETED: '任务未达成，暂不可领取',
    TASK_NOT_ACCEPTED: '请先领取任务',
};

const acceptErrorMessageMap: Record<string, string> = {
    TASK_NOT_FOUND: '任务不存在或未发布',
    TASK_NOT_ACTIVE: '任务当前不在有效期内',
};

const resolveActionErrorMessage = (
    error: unknown,
    fallbackMessage: string,
    errorMessageMap?: Record<string, string>,
): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError<{ message?: string; errorCode?: string }>;
        const data = axiosError.response?.data;
        if (data?.errorCode && errorMessageMap?.[data.errorCode]) {
            return errorMessageMap[data.errorCode];
        }
        if (data?.message) {
            return data.message;
        }
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallbackMessage;
};

const hasSummaryInPayload = (payload: DailyTaskPayload): boolean => {
    const summaryRecord = (payload.summary && typeof payload.summary === 'object' && !Array.isArray(payload.summary))
        ? payload.summary as Record<string, unknown>
        : payload as Record<string, unknown>;

    const summaryKeys = [
        'platformSeconds',
        'platformDurationSeconds',
        'platformDuration',
        'platform',
        'gameSeconds',
        'gameDurationSeconds',
        'gameDuration',
        'game',
        'totalSeconds',
        'totalDurationSeconds',
        'totalDuration',
        'total',
    ];

    return summaryKeys.some((key) => summaryRecord[key] !== undefined && summaryRecord[key] !== null);
};

const isActiveDynamicTask = (task: DailyTaskItem): boolean =>
    !!task.isDynamic;

const mergeTasksByUpdatedKeys = (
    prevTasks: DailyTaskItem[],
    nextTasks: DailyTaskItem[],
    updatedTaskKeys: string[],
): DailyTaskItem[] => {
    const mergedTaskMap = new Map<string, DailyTaskItem>();

    if (updatedTaskKeys.length) {
        const updatedKeySet = new Set(updatedTaskKeys);
        prevTasks.forEach((task) => {
            if (!updatedKeySet.has(task.key)) {
                mergedTaskMap.set(task.key, task);
            }
        });
    } else {
        prevTasks.forEach((task) => {
            mergedTaskMap.set(task.key, task);
        });
    }

    nextTasks.forEach((task) => {
        mergedTaskMap.set(task.key, task);
    });

    const fixedTasks = nextTasks.filter((task) => !task.isDynamic);
    const mergedDynamicTasks = Array.from(mergedTaskMap.values()).filter(isActiveDynamicTask);

    return [...fixedTasks, ...mergedDynamicTasks];
};

const setTaskActionLoading = (
    prevMap: Record<string, boolean>,
    taskKey: string,
    loading: boolean,
): Record<string, boolean> => {
    if (!taskKey) return prevMap;
    if (loading) {
        return {
            ...prevMap,
            [taskKey]: true,
        };
    }
    const nextMap = { ...prevMap };
    delete nextMap[taskKey];
    return nextMap;
};

const hasValidClaimRequest = (claimRequest: DailyTaskClaimRequest | null | undefined): claimRequest is DailyTaskClaimRequest =>
    Boolean(claimRequest && (
        (typeof claimRequest.taskCode === 'string' && claimRequest.taskCode.trim())
        || typeof claimRequest.taskId === 'number'
    ));

export const useDailyTaskStore = create<DailyTaskState>((set, get) => ({
    isLoading: false,
    isLoadedOnce: false,
    isRefreshing: false,
    errorMessage: '',
    lastSyncedAt: null,
    summary: defaultSummary,
    tasks: createDefaultDailyTaskList(),
    makeupCardReward: defaultMakeupCardReward,
    makeupCardCount: 0,
    isClaimingMakeupCard: false,
    updatedTaskKeys: [],
    rewardsIssued: [],
    lastRewardDigest: '',
    pendingPlatformSeconds: 0,
    pendingGameSeconds: 0,
    flushInFlight: 0,
    taskActionLoadingMap: createDefaultTaskActionLoadingMap(),

    setPendingSeconds: (kind, value) =>
        set((state) => {
            const safeValue = Math.max(0, Math.floor(value));
            if (kind === 'platform') {
                return { ...state, pendingPlatformSeconds: safeValue };
            }
            return { ...state, pendingGameSeconds: safeValue };
        }),

    addPendingSeconds: (kind, delta) =>
        set((state) => {
            const safeDelta = Math.max(0, Math.floor(delta));
            if (!safeDelta) return state;
            if (kind === 'platform') {
                return { ...state, pendingPlatformSeconds: state.pendingPlatformSeconds + safeDelta };
            }
            return { ...state, pendingGameSeconds: state.pendingGameSeconds + safeDelta };
        }),

    clearPendingSeconds: (kind) =>
        set((state) => {
            if (kind === 'platform') {
                return { ...state, pendingPlatformSeconds: 0 };
            }
            return { ...state, pendingGameSeconds: 0 };
        }),

    markFlushStarted: () =>
        set((state) => ({
            ...state,
            flushInFlight: state.flushInFlight + 1,
        })),

    markFlushSettled: () =>
        set((state) => ({
            ...state,
            flushInFlight: Math.max(0, state.flushInFlight - 1),
        })),

    getDisplayTotalSeconds: () => {
        const state = get();
        return Math.max(
            0,
            Math.floor(state.summary.totalSeconds + state.pendingPlatformSeconds + state.pendingGameSeconds),
        );
    },

    syncFromPayload: (payload) => {
        if (!payload || typeof payload !== 'object') {
            return false;
        }

        const normalized = normalizeDailyTaskPayload(payload);
        const payloadHasSummary = hasSummaryInPayload(payload);
        const previousDigest = get().lastRewardDigest;
        const nextDigest = createRewardDigest(normalized.rewardsIssued);
        const hasNewReward = normalized.rewardsIssued.length > 0 && nextDigest !== previousDigest;

        set((prev) => ({
            ...prev,
            isLoadedOnce: true,
            errorMessage: '',
            lastSyncedAt: Date.now(),
            summary: payloadHasSummary ? normalized.summary : prev.summary,
            tasks: mergeTasksByUpdatedKeys(prev.tasks, normalized.tasks, normalized.updatedTaskKeys),
            makeupCardReward: normalized.makeupCardReward,
            makeupCardCount: normalized.makeupCardCount,
            updatedTaskKeys: normalized.updatedTaskKeys,
            rewardsIssued: hasNewReward ? normalized.rewardsIssued : [],
            lastRewardDigest: nextDigest,
        }));

        return hasNewReward;
    },

    refreshDailyTasks: async (options) => {
        const silent = Boolean(options?.silent);
        const state = get();

        if (state.isRefreshing) {
            return;
        }

        set((prev) => ({
            ...prev,
            isRefreshing: true,
            isLoading: silent ? prev.isLoading : !prev.isLoadedOnce,
            errorMessage: silent ? prev.errorMessage : '',
        }));

        try {
            const response = await dailyTaskApi.getDailyTasks();
            if (!response.data.success) {
                throw new Error(response.data.message || '任务数据加载失败');
            }
            const payload = normalizeDailyTaskPayload(response.data.data);
            const nextDigest = createRewardDigest(payload.rewardsIssued);
            const rewardsChanged = nextDigest !== get().lastRewardDigest;

            const currentTasks = get().tasks;
            const mergedTasks = mergeTasksByUpdatedKeys(
                currentTasks,
                payload.tasks,
                [], // no specific keys to track — preserve all active dynamic tasks
            );

            set((prev) => ({
                ...prev,
                isLoadedOnce: true,
                isLoading: false,
                isRefreshing: false,
                errorMessage: '',
                lastSyncedAt: Date.now(),
                summary: payload.summary,
                tasks: mergedTasks,
                makeupCardReward: payload.makeupCardReward,
                makeupCardCount: payload.makeupCardCount,
                updatedTaskKeys: payload.updatedTaskKeys,
                rewardsIssued: rewardsChanged ? payload.rewardsIssued : [],
                lastRewardDigest: nextDigest,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : '任务数据加载失败';
            set((prev) => ({
                ...prev,
                isRefreshing: false,
                isLoading: false,
                errorMessage: message,
            }));
        }
    },

    acceptDailyTask: async (task) => {
        const taskKey = task.key;
        const taskId = task.taskId;
        const state = get();

        if (!taskKey || typeof taskId !== 'number') {
            return {
                success: false,
                message: '任务参数缺失',
            };
        }

        if (state.taskActionLoadingMap[taskKey]) {
            return {
                success: false,
                message: '任务处理中，请稍候',
            };
        }

        set((prev) => ({
            ...prev,
            taskActionLoadingMap: setTaskActionLoading(prev.taskActionLoadingMap, taskKey, true),
        }));

        try {
            const response = await dailyTaskApi.acceptDailyTask(taskId);
            if (!response.data.success) {
                throw new Error(response.data.message || '任务领取失败');
            }

            await get().refreshDailyTasks({ silent: true });

            return {
                success: true,
                message: response.data.message || '任务领取成功',
            };
        } catch (error) {
            return {
                success: false,
                message: resolveActionErrorMessage(error, '任务领取失败', acceptErrorMessageMap),
            };
        } finally {
            set((prev) => ({
                ...prev,
                taskActionLoadingMap: setTaskActionLoading(prev.taskActionLoadingMap, taskKey, false),
            }));
        }
    },

    claimDailyTask: async (task) => {
        const taskKey = task.key;
        const claimRequest = task.claimRequest;
        const state = get();

        if (!taskKey || !hasValidClaimRequest(claimRequest)) {
            return {
                success: false,
                message: '任务参数缺失',
            };
        }

        if (state.taskActionLoadingMap[taskKey]) {
            return {
                success: false,
                message: '任务奖励领取中，请稍候',
            };
        }

        set((prev) => ({
            ...prev,
            taskActionLoadingMap: setTaskActionLoading(prev.taskActionLoadingMap, taskKey, true),
        }));

        try {
            const response = await dailyTaskApi.claimDailyTask(claimRequest);
            if (!response.data.success) {
                throw new Error(response.data.message || '任务奖励领取失败');
            }

            if (response.data.data) {
                get().syncFromPayload(response.data.data);
            }
            await get().refreshDailyTasks({ silent: true });

            return {
                success: true,
                message: response.data.message || '奖励领取成功',
            };
        } catch (error) {
            return {
                success: false,
                message: resolveActionErrorMessage(error, '任务奖励领取失败', claimErrorMessageMap),
            };
        } finally {
            set((prev) => ({
                ...prev,
                taskActionLoadingMap: setTaskActionLoading(prev.taskActionLoadingMap, taskKey, false),
            }));
        }
    },

    claimMakeupCard: async () => {
        if (get().isClaimingMakeupCard) {
            return { success: false, message: '补签卡领取中，请稍候' };
        }

        const wasClaimed = get().makeupCardReward.claimed;
        set((state) => ({ ...state, isClaimingMakeupCard: true }));
        try {
            const response = await dailyTaskApi.claimMakeupCard();
            if (!response.data.success) {
                throw new Error(response.data.message || '补签卡领取失败');
            }
            if (response.data.data) {
                const normalized = normalizeDailyTaskPayload(response.data.data);
                set((state) => ({
                    ...state,
                    makeupCardReward: normalized.makeupCardReward,
                    makeupCardCount: normalized.makeupCardCount,
                }));
            }
            await get().refreshDailyTasks({ silent: true });
            return { success: true, message: response.data.message || '补签卡 +1' };
        } catch (error) {
            await get().refreshDailyTasks({ silent: true });
            if (!wasClaimed && get().makeupCardReward.claimed) {
                return { success: true, message: '补签卡领取成功' };
            }
            return {
                success: false,
                message: resolveActionErrorMessage(error, '补签卡领取失败', {
                    DAILY_TASKS_INCOMPLETE: '完成今日全部四项每日任务后才可领取',
                }),
            };
        } finally {
            set((state) => ({ ...state, isClaimingMakeupCard: false }));
        }
    },

    consumeRewardsIssued: () => {
        const { rewardsIssued } = get();
        if (!rewardsIssued.length) return [];

        set((state) => ({
            ...state,
            rewardsIssued: [],
        }));
        return rewardsIssued;
    },

    reset: () =>
        set({
            isLoading: false,
            isLoadedOnce: false,
            isRefreshing: false,
            errorMessage: '',
            lastSyncedAt: null,
            summary: defaultSummary,
            tasks: createDefaultDailyTaskList(),
            makeupCardReward: defaultMakeupCardReward,
            makeupCardCount: 0,
            isClaimingMakeupCard: false,
            updatedTaskKeys: [],
            rewardsIssued: [],
            lastRewardDigest: '',
            pendingPlatformSeconds: 0,
            pendingGameSeconds: 0,
            flushInFlight: 0,
            taskActionLoadingMap: createDefaultTaskActionLoadingMap(),
        }),
}));
