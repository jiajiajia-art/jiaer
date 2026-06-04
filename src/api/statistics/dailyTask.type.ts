export const DAILY_TASK_ORDER = ['like_once', 'play_3_unique', 'online_10m', 'online_30m'] as const;

export type CanonicalDailyTaskCode = (typeof DAILY_TASK_ORDER)[number];
export type DailyTaskCode = CanonicalDailyTaskCode | string;
export type DailyTaskClaimType = CanonicalDailyTaskCode;

export interface DailyTaskItem {
    code: DailyTaskCode;
    title: string;
    titleKey?: string;
    rewardPoints: number;
    progress: number;
    target: number;
    completed: boolean;
    claimed: boolean;
    claimable: boolean;
    taskType: DailyTaskClaimType | null;
    statusText: string;
    statusTextKey?: string;
}

export interface DailyTaskSummary {
    platformSeconds: number;
    gameSeconds: number;
    totalSeconds: number;
}

export interface DailyTaskRewardIssue {
    code?: string;
    taskCode?: string;
    points?: number;
    rewardPoints?: number;
    pointsAwarded?: number;
    message?: string;
    [key: string]: unknown;
}

export interface DailyTaskPayload {
    summary?: Record<string, unknown> | null;
    tasks?: unknown[] | null;
    durationTasks?: unknown[] | null;
    behaviorTasks?: unknown[] | null;
    taskList?: unknown[] | null;
    list?: unknown[] | null;
    items?: unknown[] | null;
    rewardsIssued?: DailyTaskRewardIssue[] | null;
    [key: string]: unknown;
}

interface DailyTaskTemplate {
    code: CanonicalDailyTaskCode;
    titleKey: string;
    rewardPoints: number;
    target: number;
    statusTextKey: string;
    claimType: DailyTaskClaimType | null;
}

const DAILY_TASK_TEMPLATES: DailyTaskTemplate[] = [
    {
        code: 'like_once',
        titleKey: 'dailyTask.likeOnce',
        rewardPoints: 5,
        target: 1,
        statusTextKey: 'dailyTask.counting',
        claimType: 'like_once',
    },
    {
        code: 'play_3_unique',
        titleKey: 'dailyTask.play3Unique',
        rewardPoints: 5,
        target: 3,
        statusTextKey: 'dailyTask.counting',
        claimType: 'play_3_unique',
    },
    {
        code: 'online_10m',
        titleKey: 'dailyTask.online10m',
        rewardPoints: 8,
        target: 10 * 60,
        statusTextKey: 'dailyTask.counting',
        claimType: 'online_10m',
    },
    {
        code: 'online_30m',
        titleKey: 'dailyTask.online30m',
        rewardPoints: 28,
        target: 30 * 60,
        statusTextKey: 'dailyTask.counting',
        claimType: 'online_30m',
    },
];

const toRecord = (value: unknown): Record<string, unknown> | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
};

const toFiniteNumber = (...values: unknown[]): number => {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }
    return 0;
};

const toBoolean = (...values: unknown[]): boolean => {
    for (const value of values) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            const lower = value.trim().toLowerCase();
            if (['true', '1', 'yes', 'y'].includes(lower)) return true;
            if (['false', '0', 'no', 'n'].includes(lower)) return false;
        }
        if (typeof value === 'number') {
            if (value === 1) return true;
            if (value === 0) return false;
        }
    }
    return false;
};

const normalizeCode = (rawCode: string): string => rawCode.trim().toLowerCase().replace(/[\s-]+/g, '_');

const normalizeStatus = (rawStatus: unknown): string => String(rawStatus ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export const isDurationTaskCode = (code: string): boolean => code === 'online_10m' || code === 'online_30m';

export const toDailyTaskClaimType = (code: string): DailyTaskClaimType | null => {
    const normalized = normalizeCode(code);
    if (normalized === 'like_once') return 'like_once';
    if (normalized === 'play_3_unique' || normalized === 'play_three_games') return 'play_3_unique';
    if (normalized === 'online_10m') return 'online_10m';
    if (normalized === 'online_30m') return 'online_30m';
    return null;
};

const detectCanonicalCode = (
    rawCode: string,
    rawTitle: string,
    rawTarget: number,
): CanonicalDailyTaskCode | null => {
    const code = normalizeCode(rawCode);
    const title = rawTitle.trim().toLowerCase();

    if (code.includes('like') || code.includes('thumb') || title.includes('点赞') || title.includes('like')) {
        return 'like_once';
    }

    if (
        code.includes('play_3')
        || code.includes('play_three')
        || code.includes('play3')
        || code.includes('unique_play')
        || code.includes('game_entry')
        || code.includes('enter_game')
        || title.includes('游玩')
        || title.includes('开始')
    ) {
        return 'play_3_unique';
    }

    if (
        code.includes('online_30')
        || code.includes('duration_30')
        || code.includes('30m')
        || code.includes('30_min')
        || title.includes('30分钟')
        || rawTarget >= 1800
    ) {
        return 'online_30m';
    }

    if (
        code.includes('online_10')
        || code.includes('duration_10')
        || code.includes('10m')
        || code.includes('10_min')
        || title.includes('10分钟')
        || rawTarget >= 600
    ) {
        return 'online_10m';
    }

    return null;
};

const toDurationSeconds = (code: CanonicalDailyTaskCode, value: number): number => {
    if (!isDurationTaskCode(code)) {
        return value;
    }
    if (value > 0 && value <= 60) {
        // Some APIs use minutes for 10/30 minute tasks.
        return value * 60;
    }
    return value;
};

const buildDefaultTask = (template: DailyTaskTemplate): DailyTaskItem => ({
    code: template.code,
    title: '',
    titleKey: template.titleKey,
    rewardPoints: template.rewardPoints,
    progress: 0,
    target: template.target,
    completed: false,
    claimed: false,
    claimable: false,
    taskType: template.claimType,
    statusText: '',
    statusTextKey: template.statusTextKey,
});

const getTemplateByCode = (code: CanonicalDailyTaskCode): DailyTaskTemplate =>
    DAILY_TASK_TEMPLATES.find((item) => item.code === code)!;

const getRawTaskArray = (payload: DailyTaskPayload): unknown[] => {
    const rawGroups = [payload.tasks, payload.durationTasks, payload.behaviorTasks, payload.taskList, payload.list, payload.items];
    const merged: unknown[] = [];

    rawGroups.forEach((group) => {
        if (Array.isArray(group)) {
            merged.push(...group);
        }
    });

    return merged;
};

const collectRewardsIssued = (payload: DailyTaskPayload): DailyTaskRewardIssue[] => {
    if (Array.isArray(payload.rewardsIssued)) {
        return payload.rewardsIssued.filter((item) => typeof item === 'object' && item !== null);
    }
    const maybeRewards = (toRecord(payload)?.rewardsIssued ?? null) as unknown;
    if (Array.isArray(maybeRewards)) {
        return maybeRewards.filter((item) => typeof item === 'object' && item !== null) as DailyTaskRewardIssue[];
    }
    return [];
};

const resolveTaskProgress = (record: Record<string, unknown>): number => {
    const target = Math.max(
        0,
        Math.floor(
            toFiniteNumber(
                record.target,
                record.goal,
                record.required,
                record.requiredValue,
                record.total,
                record.threshold,
                record.thresholdSeconds,
            ),
        ),
    );

    const progress = Math.max(
        0,
        Math.floor(
            toFiniteNumber(
                record.current,
                record.currentValue,
                record.completedValue,
                record.value,
                record.progress,
                record.currentSeconds,
            ),
        ),
    );
    if (progress > 0) {
        return progress;
    }

    const percent = Math.max(0, Math.floor(toFiniteNumber(record.progressPercent)));
    if (target > 0 && percent > 0) {
        return Math.floor((target * percent) / 100);
    }
    return 0;
};

export interface NormalizedDailyTaskPayload {
    summary: DailyTaskSummary;
    tasks: DailyTaskItem[];
    updatedCodes: CanonicalDailyTaskCode[];
    rewardsIssued: DailyTaskRewardIssue[];
}

export const createDefaultDailyTaskList = (): DailyTaskItem[] =>
    DAILY_TASK_TEMPLATES.map((template) => buildDefaultTask(template));

export const normalizeDailyTaskPayload = (payload: DailyTaskPayload | null | undefined): NormalizedDailyTaskPayload => {
    const defaultTasks = createDefaultDailyTaskList();

    if (!payload || typeof payload !== 'object') {
        return {
            summary: {
                platformSeconds: 0,
                gameSeconds: 0,
                totalSeconds: 0,
            },
            tasks: defaultTasks,
            updatedCodes: [],
            rewardsIssued: [],
        };
    }

    const payloadRecord = toRecord(payload) || {};
    const summaryRecord = toRecord(payloadRecord.summary) || payloadRecord;

    const platformSeconds = Math.max(
        0,
        Math.floor(
            toFiniteNumber(
                summaryRecord.platformSeconds,
                summaryRecord.platformDurationSeconds,
                summaryRecord.platformDuration,
                summaryRecord.platform,
            ),
        ),
    );
    const gameSeconds = Math.max(
        0,
        Math.floor(
            toFiniteNumber(
                summaryRecord.gameSeconds,
                summaryRecord.gameDurationSeconds,
                summaryRecord.gameDuration,
                summaryRecord.game,
            ),
        ),
    );
    const totalSecondsRaw = Math.max(
        0,
        Math.floor(
            toFiniteNumber(
                summaryRecord.totalSeconds,
                summaryRecord.totalDurationSeconds,
                summaryRecord.totalDuration,
                summaryRecord.total,
            ),
        ),
    );
    const totalSeconds = totalSecondsRaw > 0 ? totalSecondsRaw : platformSeconds + gameSeconds;

    const rawTasks = getRawTaskArray(payload);
    const updatedCodeSet = new Set<CanonicalDailyTaskCode>();
    const byCode = new Map<CanonicalDailyTaskCode, DailyTaskItem>();

    rawTasks.forEach((rawTask) => {
        const record = toRecord(rawTask);
        if (!record) return;

        const rawCode = String(
            record.taskCode
            ?? record.code
            ?? record.taskType
            ?? record.type
            ?? record.id
            ?? '',
        );
        const rawTitle = String(record.title ?? record.name ?? record.label ?? record.taskName ?? '');
        const rawTarget = Math.max(
            0,
            Math.floor(
                toFiniteNumber(
                    record.target,
                    record.goal,
                    record.required,
                    record.requiredValue,
                    record.total,
                    record.threshold,
                    record.thresholdSeconds,
                ),
            ),
        );
        const canonicalCode = detectCanonicalCode(rawCode, rawTitle, rawTarget);
        if (!canonicalCode) return;

        const template = getTemplateByCode(canonicalCode);
        const rawProgress = resolveTaskProgress(record);

        const target = Math.max(
            1,
            toDurationSeconds(
                canonicalCode,
                rawTarget > 0 ? rawTarget : template.target,
            ),
        );
        const progress = Math.max(0, toDurationSeconds(canonicalCode, rawProgress));

        const normalizedStatus = normalizeStatus(record.status ?? record.taskStatus ?? record.state);
        const claimedByStatus = normalizedStatus === 'claimed' || normalizedStatus === 'rewarded';
        const claimableByStatus = ['claimable', 'can_claim', 'ready_to_claim', 'pending_claim'].includes(normalizedStatus);
        const completedByStatus = ['completed', 'finish', 'finished', 'done', 'achieved'].includes(normalizedStatus);

        const completed =
            toBoolean(record.completed, record.isCompleted, record.done, record.achieved)
            || completedByStatus
            || progress >= target;

        const rewardPoints = Math.max(
            0,
            Math.floor(
                toFiniteNumber(
                    record.rewardPoints,
                    record.points,
                    record.reward,
                    template.rewardPoints,
                ),
            ),
        );

        const taskType = toDailyTaskClaimType(
            String(record.taskCode ?? record.taskType ?? record.claimType ?? rawCode),
        ) || template.claimType;

        const claimedByField = toBoolean(
            record.rewarded,
            record.isRewarded,
            record.claimed,
            record.isClaimed,
            record.rewardClaimed,
            record.received,
            record.isReceived,
        );

        const claimableByField = toBoolean(
            record.claimable,
            record.canClaim,
            record.canReceiveReward,
            record.receivable,
            record.availableToClaim,
        );

        let claimed = claimedByField || claimedByStatus;
        let claimable = claimableByField || claimableByStatus;

        if (!claimed && completed && !claimable) {
            // All task rewards are manual-claim now.
            claimable = true;
        }

        if (claimed) {
            claimable = false;
        }

        let statusText = String(record.statusText ?? record.description ?? '').trim();
        let statusTextKey: string | undefined;
        if (!statusText) {
            if (claimed) {
                statusText = 'Reward claimed';
                statusTextKey = 'dailyTask.rewardClaimed';
            } else if (claimable) {
                statusText = 'Completed, claim now';
                statusTextKey = 'dailyTask.completed';
            } else if (completed) {
                statusText = taskType ? 'Completed, claim now' : 'Completed';
                statusTextKey = taskType ? 'dailyTask.completed' : 'dailyTask.justCompleted';
            } else if (taskType) {
                statusText = progress > 0 ? `${Math.min(progress, target)}/${target}` : 'Counting...';
                statusTextKey = progress > 0 ? undefined : 'dailyTask.counting';
            } else {
                statusText = `${Math.min(progress, target)}/${target}`;
            }
        }

        byCode.set(canonicalCode, {
            code: canonicalCode,
            title: rawTitle || '',
            titleKey: rawTitle ? undefined : template.titleKey,
            rewardPoints,
            progress,
            target,
            completed,
            claimed,
            claimable,
            taskType,
            statusText,
            statusTextKey,
        });
        updatedCodeSet.add(canonicalCode);
    });

    const tasks = DAILY_TASK_ORDER.map((code) => byCode.get(code) || buildDefaultTask(getTemplateByCode(code)));

    return {
        summary: {
            platformSeconds,
            gameSeconds,
            totalSeconds,
        },
        tasks,
        updatedCodes: Array.from(updatedCodeSet),
        rewardsIssued: collectRewardsIssued(payload),
    };
};
