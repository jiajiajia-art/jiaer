export type RechargeReceipt =
    | { kind: 'diamonds'; amount: number; diamonds: number }
    | {
        kind: 'membership';
        planId: 'week' | 'month_v2';
        amount: number;
        durationDays: number;
        dailyReward: number;
        finalDayReward: number;
        totalReward: number;
    };

export interface RechargeReceiptRecord {
    version: 1;
    outTradeNo: string;
    userId: string;
    createdAt: number;
    receipt: RechargeReceipt;
}

export const rechargeReceiptStorageKey = (userId: string, outTradeNo: string) =>
    `funloom:recharge-receipt:v1:${userId}:${outTradeNo}`;

const RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function createDiamondReceipt(amount: number, diamonds: number): RechargeReceipt {
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(diamonds) || diamonds <= 0) {
        throw new Error('Invalid diamond receipt');
    }
    return { kind: 'diamonds', amount, diamonds };
}

export function createMembershipReceipt(
    planId: 'week' | 'month_v2',
    amount: number,
): RechargeReceipt {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid membership receipt');
    return planId === 'week'
        ? { kind: 'membership', planId, amount, durationDays: 7, dailyReward: 77, finalDayReward: 78, totalReward: 540 }
        : { kind: 'membership', planId, amount, durationDays: 30, dailyReward: 66, finalDayReward: 86, totalReward: 2000 };
}

export function createRechargeReceiptRecord(
    outTradeNo: string,
    userId: string,
    receipt: RechargeReceipt,
    createdAt = Date.now(),
): RechargeReceiptRecord {
    if (!outTradeNo.trim() || !userId.trim() || !Number.isFinite(createdAt) || createdAt <= 0) {
        throw new Error('Invalid recharge receipt record');
    }
    return { version: 1, outTradeNo, userId, createdAt, receipt };
}

export function normalizeRechargeReceipt(value: unknown): RechargeReceipt | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<RechargeReceipt>;
    try {
        if (candidate.kind === 'diamonds') return createDiamondReceipt(candidate.amount!, candidate.diamonds!);
        if (candidate.kind === 'membership'
            && (candidate.planId === 'week' || candidate.planId === 'month_v2')) {
            return createMembershipReceipt(candidate.planId, candidate.amount!);
        }
        return null;
    } catch {
        return null;
    }
}

export function readRechargeReceiptRecord(
    raw: string | null,
    outTradeNo: string,
    userId: string,
    now = Date.now(),
): RechargeReceiptRecord | null {
    try {
        const value = JSON.parse(raw || 'null') as RechargeReceiptRecord | null;
        if (!value || value.version !== 1 || value.outTradeNo !== outTradeNo || value.userId !== userId
            || !Number.isFinite(value.createdAt) || value.createdAt <= 0 || value.createdAt > now
            || now - value.createdAt > RECEIPT_MAX_AGE_MS) return null;
        const receipt = normalizeRechargeReceipt(value.receipt);
        if (!receipt) return null;
        return { version: 1, outTradeNo, userId, createdAt: value.createdAt, receipt };
    } catch {
        return null;
    }
}

type ReceiptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function saveRechargeReceiptToStorage(
    storage: ReceiptStorage,
    userId: string,
    outTradeNo: string,
    receipt: RechargeReceipt,
    createdAt = Date.now(),
): boolean {
    try {
        const record = createRechargeReceiptRecord(outTradeNo, userId, receipt, createdAt);
        storage.setItem(rechargeReceiptStorageKey(userId, outTradeNo), JSON.stringify(record));
        return true;
    } catch {
        return false;
    }
}

export function readRechargeReceiptFromStorage(
    storage: ReceiptStorage,
    userId: string,
    outTradeNo: string,
    now = Date.now(),
): RechargeReceiptRecord | null {
    try {
        return readRechargeReceiptRecord(
            storage.getItem(rechargeReceiptStorageKey(userId, outTradeNo)),
            outTradeNo,
            userId,
            now,
        );
    } catch {
        return null;
    }
}

export function clearRechargeReceiptFromStorage(storage: ReceiptStorage, userId: string, outTradeNo: string): void {
    try { storage.removeItem(rechargeReceiptStorageKey(userId, outTradeNo)); } catch { /* Receipt cleanup is best-effort. */ }
}
