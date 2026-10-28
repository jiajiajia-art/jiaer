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

export function formatCreatorShareRatio(value: number | null | undefined): string {
    const percent = Number(value) * 100;
    if (!Number.isFinite(percent)) return '—';
    return `${Number(percent.toFixed(2))}%`;
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

export function buildCreatorTrendTicks(
    buckets: string[],
    period: '7d' | '30d' | '1y' | 'all',
): string[] {
    if (buckets.length <= 1 || period === '7d') return buckets;
    if (period === '30d') {
        const targetCount = Math.min(7, buckets.length);
        return Array.from(new Set(Array.from({ length: targetCount }, (_, index) => (
            buckets[Math.round((index * (buckets.length - 1)) / (targetCount - 1))]
        ))));
    }
    const firstByMonth = new Map<string, string>();
    buckets.forEach((bucket) => {
        const month = bucket.slice(0, 7);
        if (!firstByMonth.has(month)) firstByMonth.set(month, bucket);
    });
    const ticks = [...firstByMonth.values()];
    const last = buckets.at(-1);
    if (last && !ticks.includes(last)) ticks.push(last);
    return ticks;
}

export function formatCreatorTrendAxisDate(
    bucket: string,
    period: '7d' | '30d' | '1y' | 'all',
): string {
    if (period === '7d' || period === '30d') return bucket.slice(5).replace('-', '/');
    return bucket.slice(0, 7).replace('-', '/');
}

export function formatCreatorTrendTooltipDate(bucket: string): string {
    const [year, month, day] = bucket.split('-');
    return year && month && day ? `${year}年${month}月${day}日` : bucket;
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
