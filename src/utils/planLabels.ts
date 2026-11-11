import type { MembershipPlanId, StackedPlan } from '../api/account/auth.type';

type LegacyMembershipPlanId = 'month' | 'season' | 'year';

export const planLabelMap: Record<MembershipPlanId | LegacyMembershipPlanId, string> = {
    week: '周卡会员',
    month_v2: '月卡会员',
    month: '月卡会员',
    season: '季卡会员',
    year: '年卡会员',
};

/**
 * 从堆叠的会员套餐中挑出"当前生效"的那一条：
 * - 只看 status === 'active'
 * - 取 stackOrder 最大的（即最上层、最新的）
 * - 没找到返回 undefined
 */
export const getActiveStackedPlan = (plans?: StackedPlan[] | null): StackedPlan | undefined => {
    if (!plans || plans.length === 0) return undefined;
    return plans
        .filter((p) => p?.status === 'active')
        .reduce<StackedPlan | undefined>((top, cur) => {
            if (!top) return cur;
            return (cur.stackOrder ?? 0) > (top.stackOrder ?? 0) ? cur : top;
        }, undefined);
};

/**
 * 用于徽标区域的"展示用到期时间"：
 * 1) 优先 stackedPlans 中 stackOrder 最大的 active 条目的 endAt
 * 2) 兜底用 memberEndAt
 * 3) 都为空返回 undefined，调用方按 undefined 处理（不渲染到期日）
 */
export const resolveMemberDisplayEndAt = (
    stackedPlans: StackedPlan[] | null | undefined,
    memberEndAt: string | null | undefined
): string | undefined => {
    const active = getActiveStackedPlan(stackedPlans);
    return active?.endAt ?? memberEndAt ?? undefined;
};
