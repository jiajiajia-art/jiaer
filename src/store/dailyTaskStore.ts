import type { AxiosError } from 'axios';
import { create } from 'zustand';
import dailyTaskApi from '../api/statistics/dailyTaskApi';
import {
    createDefaultDailyTaskList,
    normalizeDailyTaskPayload,
    type CanonicalDailyTaskCode,
    type DailyTaskClaimType,
    type DailyTaskItem,
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
    updatedCodes: CanonicalDailyTaskCode[];
    rewardsIssued: DailyTaskRewardIssue[];
    lastRewardDigest: string;
    pendingPlatformSeconds: number;
    pendingGameSeconds: number;
    flushInFlight: number;
    claimingTaskMap: Record<DailyTaskClaimType, boolean>;
    setPendingSeconds: (kind: 'platform' | 'game', value: number) => void;
    addPendingSeconds: (kind: 'platform' | 'game', delta: number) => void;
    clearPendingSeconds: (kind: 'platform' | 'game') => void;
    markFlushStarted: () => void;
    markFlushSettled: () => void;
    getDisplayTotalSeconds: () => number;
    syncFromPayload: (payload: DailyTaskPayload | null | undefined) => boolean;
    refreshDailyTasks: (options?: { silent?: boolean }) => Promise<void>;
    claimDailyTask: (taskCode: DailyTaskClaimType) => Promise<{ success: boolean; message: string }>;
    consumeRewardsIssued: () => DailyTaskRewardIssue[];
    reset: () => void;
}

const defaultSummary: DailyTaskSummary = {
    platformSeconds: 0,
    gameSeconds: 0,
    totalSeconds: 0,
};

const defaultTasks = createDefaultDailyTaskList();
const defaultClaimingTaskMap: Record<DailyTaskClaimType, boolean> = {
    like_once: false,
    play_3_unique: false,
    online_10m: false,
    online_30m: false,
};

const createRewardDigest = (items: DailyTaskRewardIssue[]): string =>
    JSON.stringify(
        items.map((item) => ({
            code: String(item.taskCode ?? item.code ?? ''),
            points: Number(item.points ?? item.rewardPoints ?? item.pointsAwarded ?? 0),
            message: String(item.message ?? ''),
        })),
    );

const claimErrorMessageMap: Record<string, string> = {
    INVALID_TASK_CODE: '任务类型无效',
    TASK_ALREADY_REWARDED: '今日该任务奖励已领取',
    TASK_NOT_COMPLETED: '任务未达成，暂不可领取',
};

const resolveClaimErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError<{ message?: string; errorCode?: string }>;
        const data = axiosError.response?.data;
        if (data?.errorCode && claimErrorMessageMap[data.errorCode]) {
            return claimErrorMessageMap[data.errorCode];
        }
        if (data?.message) {
            return data.message;
        }
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return '浠诲姟濂栧姳棰嗗彇澶辫触';
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

const mergeTasksByUpdatedCodes = (
    prevTasks: DailyTaskItem[],
    nextTasks: DailyTaskItem[],
    updatedCodes: CanonicalDailyTaskCode[],
): DailyTaskItem[] => {
    if (!updatedCodes.length) {
        return prevTasks;
    }
    const updatedCodeSet = new Set(updatedCodes);
    const nextTaskMap = new Map(nextTasks.map((task) => [task.code, task]));
    return prevTasks.map((task) => {
        if (!updatedCodeSet.has(task.code as CanonicalDailyTaskCode)) {
            return task;
        }
        return nextTaskMap.get(task.code) ?? task;
    });
};

export const useDailyTaskStore = create<DailyTaskState>((set, get) => ({
    isLoading: false,
    isLoadedOnce: false,
    isRefreshing: false,
    errorMessage: '',
    lastSyncedAt: null,
    summary: defaultSummary,
    tasks: defaultTasks,
    updatedCodes: [],
    rewardsIssued: [],
    lastRewardDigest: '',
    pendingPlatformSeconds: 0,
    pendingGameSeconds: 0,
    flushInFlight: 0,
    claimingTaskMap: defaultClaimingTaskMap,

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
            tasks: mergeTasksByUpdatedCodes(prev.tasks, normalized.tasks, normalized.updatedCodes),
            updatedCodes: normalized.updatedCodes,
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
                throw new Error(response.data.message || '浠诲姟鏁版嵁鍔犺浇澶辫触');
            }
            const payload = normalizeDailyTaskPayload(response.data.data);
            const nextDigest = createRewardDigest(payload.rewardsIssued);
            const rewardsChanged = nextDigest !== get().lastRewardDigest;

            set((prev) => ({
                ...prev,
                isLoadedOnce: true,
                isLoading: false,
                isRefreshing: false,
                errorMessage: '',
                lastSyncedAt: Date.now(),
                summary: payload.summary,
                tasks: payload.tasks,
                updatedCodes: payload.updatedCodes,
                rewardsIssued: rewardsChanged ? payload.rewardsIssued : [],
                lastRewardDigest: nextDigest,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : '浠诲姟鏁版嵁鍔犺浇澶辫触';
            set((prev) => ({
                ...prev,
                isRefreshing: false,
                isLoading: false,
                errorMessage: message,
            }));
        }
    },

    claimDailyTask: async (taskCode) => {
        const state = get();
        if (state.claimingTaskMap[taskCode]) {
            return {
                success: false,
                message: '任务奖励领取中，请稍候',
            };
        }

        set((prev) => ({
            ...prev,
            claimingTaskMap: {
                ...prev.claimingTaskMap,
                [taskCode]: true,
            },
        }));

        try {
            const response = await dailyTaskApi.claimDailyTask(taskCode);
            if (!response.data.success) {
                throw new Error(response.data.message || '浠诲姟濂栧姳棰嗗彇澶辫触');
            }

            if (response.data.data) {
                get().syncFromPayload(response.data.data);
            }
            await get().refreshDailyTasks({ silent: true });

            return {
                success: true,
                message: response.data.message || '濂栧姳棰嗗彇鎴愬姛',
            };
        } catch (error) {
            return {
                success: false,
                message: resolveClaimErrorMessage(error),
            };
        } finally {
            set((prev) => ({
                ...prev,
                claimingTaskMap: {
                    ...prev.claimingTaskMap,
                    [taskCode]: false,
                },
            }));
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
            updatedCodes: [],
            rewardsIssued: [],
            lastRewardDigest: '',
            pendingPlatformSeconds: 0,
            pendingGameSeconds: 0,
            flushInFlight: 0,
            claimingTaskMap: defaultClaimingTaskMap,
        }),
}));

