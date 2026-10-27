export type CreatorWithdrawAction = 'profile' | 'status' | 'withdraw' | 'exchange';
export type CreatorTrendSeries = 'editor' | 'custom' | 'sdk';

export function resolveCreatorWithdrawAction(input: {
    profileComplete: boolean;
    activeStatus?: string | null;
    availableCents: number;
}): CreatorWithdrawAction {
    if (input.activeStatus === 'pending' || input.activeStatus === 'approved') return 'status';
    if (!input.profileComplete) return 'profile';
    return input.availableCents >= 10_000 ? 'withdraw' : 'exchange';
}

export function formatYuan(value: string | number | null | undefined): string {
    const amount = Number(value);
    return `¥${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

export function maskBankAccount(value: string | null | undefined, bankName = '中国银行卡'): string {
    const digits = String(value || '').replace(/\D/g, '');
    const suffix = digits.slice(-4).padStart(4, '*');
    return `${bankName || '银行卡'}（尾号 ${suffix}）`;
}

export function mergeCreatorWorkEarnings<
    TAccount extends { fileId: string },
    TWork extends { file_id?: string | null; title?: string | null },
>(accounts: TAccount[], works: TWork[]): Array<TAccount & { title: string }> {
    const titleById = new Map(
        works
            .filter((work) => work.file_id)
            .map((work) => [String(work.file_id), String(work.title || '').trim()]),
    );
    return accounts.map((account) => ({
        ...account,
        title: titleById.get(account.fileId) || '未命名作品',
    }));
}

export function visibleTrendSeries(rows: Array<{
    editorGrossYuan: string;
    customGrossYuan: string;
    sdkGrossYuan: string;
}>): CreatorTrendSeries[] {
    return (['editor', 'custom', 'sdk'] as const).filter((key) => (
        rows.some((row) => Number(row[`${key}GrossYuan`]) !== 0)
    ));
}

export function buildCreatorEarningsQuery(params: Record<string, unknown>): string {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        query.set(key, String(value));
    });
    return query.toString();
}

export function ensureCreatorEarningIdempotencyKey(
    current: string | null | undefined,
    factory: () => string = () => crypto.randomUUID(),
): string {
    return current || factory();
}
