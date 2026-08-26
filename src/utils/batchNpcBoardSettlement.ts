/**
 * 功能注释：角色批量看板终态 / 卡住 / 重试 CTA（与后端 job.status 解耦）。
 */

export const BATCH_NPC_TERMINAL_STAGES = new Set([
    'item_done',
    'rembg_done',
    'generate_fail',
    'rembg_fail',
]);

/** 与后端硬超时 120s / 治愈 130s 对齐：前端 90s 起可操作重试 */
export const BATCH_STUCK_GENERATE_SECONDS = 90;
export const BATCH_STUCK_REMBG_SECONDS = 90;

export type BatchNpcBoardItemLike = {
    stage?: string | null;
    stageElapsedSeconds?: number | null;
    id?: string | null;
    name?: string | null;
    index?: number | null;
};

export function isBatchNpcBoardSettled(
    items: BatchNpcBoardItemLike[] | null | undefined,
    totalCount: number,
): boolean {
    const total = Math.max(0, Number(totalCount) || 0);
    const list = Array.isArray(items) ? items : [];
    if (total <= 0 || list.length === 0) return false;

    let settledCount = 0;
    for (const item of list) {
        const stage = String(item?.stage || '');
        if (BATCH_NPC_TERMINAL_STAGES.has(stage)) {
            settledCount += 1;
            continue;
        }
        if (
            stage === 'pending'
            || stage === 'generate_start'
            || stage === 'generate_done'
            || stage === 'rembg_start'
            || stage === ''
        ) {
            return false;
        }
    }
    return settledCount >= total;
}

/** 场景批量成功终态：无抠图，generate_done / item_done 均算成功 */
const SCENE_SUCCESS_STAGES = new Set(['item_done', 'generate_done']);

/**
 * 场景看板是否已全部成功（用于完成弹窗：隐藏「请勿离开」、同步结果）。
 * 与 shouldShowRetry… 互斥：有失败时不算 allSuccess。
 */
export function isBatchSceneBoardAllSuccess(
    items: BatchNpcBoardItemLike[] | null | undefined,
    totalCount: number,
): boolean {
    const total = Math.max(0, Number(totalCount) || 0);
    const list = Array.isArray(items) ? items : [];
    if (total <= 0 || list.length < total) return false;
    if (countBatchNpcBoardFailures(list) > 0) return false;
    let success = 0;
    for (const item of list) {
        const stage = String(item?.stage || '');
        if (SCENE_SUCCESS_STAGES.has(stage)) {
            success += 1;
            continue;
        }
        return false;
    }
    return success >= total;
}

export function countBatchNpcBoardFailures(
    items: BatchNpcBoardItemLike[] | null | undefined,
): number {
    const list = Array.isArray(items) ? items : [];
    return list.filter((item) => {
        const stage = String(item?.stage || '');
        return stage === 'generate_fail' || stage === 'rembg_fail';
    }).length;
}

export function isBatchNpcBoardItemStuck(item: BatchNpcBoardItemLike | null | undefined): boolean {
    if (!item) return false;
    const stage = String(item.stage || '');
    const elapsed = Math.max(0, Number(item.stageElapsedSeconds) || 0);
    if (stage === 'generate_start') return elapsed >= BATCH_STUCK_GENERATE_SECONDS;
    if (stage === 'rembg_start') return elapsed >= BATCH_STUCK_REMBG_SECONDS;
    return false;
}

export function listBatchNpcBoardStuckItems(
    items: BatchNpcBoardItemLike[] | null | undefined,
): BatchNpcBoardItemLike[] {
    const list = Array.isArray(items) ? items : [];
    return list.filter((item) => isBatchNpcBoardItemStuck(item));
}

/**
 * 展示「重新生成未完成任务」：
 * - 全终态且有失败
 * - 或仍有卡住/失败项（即使别人还在排队）
 * 注意：轮询停不停由 isBatchNpcBoardSettled 决定，不能用本函数停轮询。
 */
export function shouldShowRetryIncompleteBatchTasks(
    items: BatchNpcBoardItemLike[] | null | undefined,
    totalCount: number,
): boolean {
    const list = Array.isArray(items) ? items : [];
    const failures = countBatchNpcBoardFailures(list);
    const stuck = listBatchNpcBoardStuckItems(list);
    if (failures === 0 && stuck.length === 0) return false;
    if (isBatchNpcBoardSettled(list, totalCount)) return failures > 0;
    return list.some((item) => {
        const stage = String(item?.stage || '');
        return stage === 'item_done'
            || stage === 'rembg_done'
            || stage === 'generate_fail'
            || stage === 'rembg_fail'
            || isBatchNpcBoardItemStuck(item);
    });
}

/** 重试目标：失败项 + 卡住项 */
export function listBatchNpcRetryTargetItems(
    items: BatchNpcBoardItemLike[] | null | undefined,
): BatchNpcBoardItemLike[] {
    const list = Array.isArray(items) ? items : [];
    return list.filter((item) => {
        const stage = String(item?.stage || '');
        if (stage === 'generate_fail' || stage === 'rembg_fail') return true;
        return isBatchNpcBoardItemStuck(item);
    });
}

/**
 * 批量进度遮罩是否展示。
 * 积分确认 / 结果弹窗打开时必须隐藏，否则 z-index 会压住 ConfirmModal（表现为「重新生成」无反应）。
 */
export function shouldShowBatchProgressOverlay(input: {
    batchJobActive: boolean;
    costModalOpen?: boolean;
    resultModalOpen?: boolean;
}): boolean {
    if (!input.batchJobActive) return false;
    if (input.costModalOpen) return false;
    if (input.resultModalOpen) return false;
    return true;
}

/** 从重试看板解析要重跑的角色 id（含 rembg_fail / generate_fail / 卡住） */
export function resolveRetryCharacterIdsFromBoard(
    items: BatchNpcBoardItemLike[] | null | undefined,
    nameToId?: (name: string) => string | undefined,
): string[] {
    const targets = listBatchNpcRetryTargetItems(items);
    const ids: string[] = [];
    for (const item of targets) {
        if (item.id) {
            ids.push(String(item.id));
            continue;
        }
        const name = String(item.name || '').trim();
        if (name && nameToId) {
            const byName = nameToId(name);
            if (byName) ids.push(byName);
        }
    }
    return [...new Set(ids.filter(Boolean))];
}

const IN_FLIGHT_NPC_STAGES = new Set([
    'generate_start',
    'generate_done',
    'rembg_start',
    'rembg_done',
]);

/**
 * 功能注释：status 长轮询（单张约 60s）返回前，把下一张 pending 乐观标为生图中，
 * 避免看板长时间停在「排队 N / 进行中 0」。
 */
export function markNextPendingNpcAsGenerating<T extends {
    items?: BatchNpcBoardItemLike[] | null;
    stageStats?: {
        generateActive?: number;
        generateDone?: number;
        rembgActive?: number;
        rembgDone?: number;
        failed?: number;
        pending?: number;
        total?: number;
    } | null;
}>(status: T | null | undefined): T | null | undefined {
    if (!status || !Array.isArray(status.items) || status.items.length === 0) {
        return status;
    }
    const items = status.items;
    if (items.some((row) => IN_FLIGHT_NPC_STAGES.has(String(row?.stage || '')))) {
        return status;
    }
    const nextIndex = items.findIndex((row) => {
        const stage = String(row?.stage || 'pending');
        return stage === 'pending' || stage === '';
    });
    if (nextIndex < 0) return status;

    const nextItems = items.map((row, i) => (
        i === nextIndex
            ? { ...row, stage: 'generate_start' }
            : row
    ));
    const pending = nextItems.filter((row) => {
        const stage = String(row?.stage || 'pending');
        return stage === 'pending' || stage === '';
    }).length;
    const prevStats = status.stageStats || {};
    return {
        ...status,
        items: nextItems,
        stageStats: {
            ...prevStats,
            generateActive: 1,
            pending,
            total: Number(prevStats.total) || nextItems.length,
        },
    };
}

