import type { MembershipPlanState, MembershipState } from '../api/account/auth.type';

export type MembershipPlanDisplayStatus = 'active' | 'expired' | 'inactive';

const parseMembershipTime = (value?: string | null): number | null => {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
};

export const resolveMembershipPlanStatus = (
    plan: MembershipPlanState | null | undefined,
    now: number = Date.now(),
): MembershipPlanDisplayStatus => {
    if (!plan) return 'inactive';
    const endAt = parseMembershipTime(plan.endAt);
    return endAt !== null && endAt > now ? 'active' : 'expired';
};

export const hasActiveVip = (
    membership: MembershipState | null | undefined,
    now: number = Date.now(),
): boolean => (
    resolveMembershipPlanStatus(membership?.week, now) === 'active'
    || resolveMembershipPlanStatus(membership?.month, now) === 'active'
);

export const formatRemainingMembershipTime = (
    endAtValue?: string | null,
    now: number = Date.now(),
): string => {
    const endAt = parseMembershipTime(endAtValue);
    if (endAt === null || endAt <= now) return '0天0小时';

    const remainingMs = endAt - now;
    const days = Math.floor(remainingMs / 86_400_000);
    const hours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
    if (days === 0 && hours === 0) return '不足1小时';
    return `${days}天${hours}小时`;
};

export const formatMembershipDateTime = (value?: string | null): string => {
    const timestamp = parseMembershipTime(value);
    if (timestamp === null) return '—';
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(timestamp));
};
