import type { MembershipPlanId } from '../api/account/auth.type';

type LegacyMembershipPlanId = 'month' | 'season' | 'year';

export const planLabelMap: Record<MembershipPlanId | LegacyMembershipPlanId, string> = {
    creator_day: '日卡会员',
    creator_month: '月卡会员',
    creator_season: '季卡会员',
    creator_year: '年卡会员',
    month: '月卡会员',
    season: '季卡会员',
    year: '年卡会员',
};
