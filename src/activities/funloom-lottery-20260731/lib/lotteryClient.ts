/**
 * Funloom 抽奖活动前端：类型、闸门、转盘角、奖品展示配置。
 * 与后端 services/lottery/lotteryLogic.js 对齐。
 */

export const LOTTERY_SLUG = 'funloom-lottery-20260731';
export const LOTTERY_ROUTE_PATH = `/activity/${LOTTERY_SLUG}`;

export const PRIZE_KEYS = [
  'console',
  'mini_handheld',
  'badge',
  'poke_ball',
  'points_300',
] as const;

export type PrizeKey = (typeof PRIZE_KEYS)[number];

export type PrizeFulfillment = 'shipping' | 'onsite' | 'points';

export interface LotteryCampaign {
  id: number;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  drawLimitType: string;
  status: string;
  onsiteClaimHint: string;
  /** 后台是否已配置一等奖；未配置时权重为 0 */
  firstPrizeConfigured?: boolean;
  firstPrizeWeight?: number;
}

export interface LotteryPrizePublic {
  prizeKey: PrizeKey | string;
  name: string;
  fulfillment: PrizeFulfillment | string;
  pointsAmount: number;
  inStock: boolean;
  requiresShipping: boolean;
}

export interface LotteryDraw {
  id: number;
  campaignId: number;
  userId: string;
  drawDate: string;
  prizeKey: string;
  fulfillment: string;
  pointsAmount: number;
  pointsGrantStatus: string;
  createdAt: string;
}

export interface DrawResultPrize {
  prizeKey: string;
  name: string;
  fulfillment: string;
  pointsAmount: number;
  requiresShipping: boolean;
}

/** 功能注释：上海自然日 YYYY-MM-DD，与后端抽奖日界一致。 */
export function formatShanghaiDrawDate(now: Date | string | number = new Date()): string {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('invalid_now');
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isCampaignActive(
  campaign: Pick<LotteryCampaign, 'startsAt' | 'endsAt'>,
  now: Date | string | number = new Date(),
): boolean {
  const t = (now instanceof Date ? now : new Date(now)).getTime();
  const start = new Date(campaign.startsAt).getTime();
  const end = new Date(campaign.endsAt).getTime();
  if (Number.isNaN(t) || Number.isNaN(start) || Number.isNaN(end)) return false;
  return t >= start && t <= end;
}

/**
 * 功能注释：前端抽奖按钮闸门（最终以后端为准；此处避免无效请求）。
 * once_per_activity：活动期内任一抽奖记录即禁止再抽。
 * once_per_day：仅当日记录禁止。
 */
export function evaluateClientDrawGate(input: {
  isLoggedIn: boolean;
  campaign: LotteryCampaign | null;
  canDrawFromServer?: boolean;
  myTodayDraw?: LotteryDraw | null;
  myDraw?: LotteryDraw | null;
  now?: Date | string | number;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.isLoggedIn) {
    return { ok: false, code: 'login_required', message: '请先登录后再抽奖' };
  }
  if (!input.campaign) {
    return { ok: false, code: 'no_campaign', message: '活动加载中' };
  }
  if (input.campaign.status !== 'published') {
    return { ok: false, code: 'campaign_unavailable', message: '活动未开放' };
  }
  if (!isCampaignActive(input.campaign, input.now)) {
    return { ok: false, code: 'campaign_closed', message: '不在活动时间内' };
  }
  const limitType = input.campaign.drawLimitType || 'once_per_day';
  if (limitType === 'once_per_activity' && input.myDraw) {
    return { ok: false, code: 'already_drawn', message: '本活动你已抽过奖' };
  }
  if (limitType === 'once_per_day' && input.myTodayDraw) {
    return { ok: false, code: 'already_drawn_today', message: '今日已抽过，明天再来' };
  }
  if (input.canDrawFromServer === false) {
    return {
      ok: false,
      code: 'cannot_draw',
      message: limitType === 'once_per_activity' ? '本活动你已抽过奖或活动未开放' : '今日已抽过或活动未开放',
    };
  }
  return { ok: true };
}

/**
 * 功能注释：大转盘目标角度；扇区按 PRIZE_KEYS 等分，指针在顶部。
 */
export function resolveWheelTargetDegrees(
  prizeKey: string,
  opts: { spins?: number; pointerOffsetDeg?: number } = {},
): number {
  const index = PRIZE_KEYS.indexOf(prizeKey as PrizeKey);
  const safeIndex = index >= 0 ? index : PRIZE_KEYS.indexOf('points_300');
  const sector = 360 / PRIZE_KEYS.length;
  const spins = Number.isFinite(opts.spins) ? Number(opts.spins) : 5;
  const pointerOffsetDeg = Number.isFinite(opts.pointerOffsetDeg)
    ? Number(opts.pointerOffsetDeg)
    : 0;
  const centerAngle = safeIndex * sector + sector / 2;
  return spins * 360 + (360 - centerAngle) + pointerOffsetDeg;
}

export function validateShippingForm(input: {
  recipientName: string;
  phone: string;
  address: string;
}): { ok: true; data: { recipientName: string; phone: string; address: string } } | { ok: false; message: string } {
  const recipientName = String(input.recipientName || '').trim();
  const phone = String(input.phone || '').trim();
  const address = String(input.address || '').trim();
  if (!recipientName || recipientName.length > 40) {
    return { ok: false, message: '请填写正确的收货人姓名' };
  }
  if (!address || address.length > 200) {
    return { ok: false, message: '请填写正确的收货地址' };
  }
  const normalizedPhone = phone.replace(/^\+86/, '').replace(/\s|-/g, '');
  if (!/^1\d{10}$/.test(normalizedPhone)) {
    return { ok: false, message: '请填写正确的手机号' };
  }
  return { ok: true, data: { recipientName, phone: normalizedPhone, address } };
}

/** 功能注释：页面仅展示奖品名与扇区配色；概率逻辑在后端。配色拉开对比，避免邻区糊成一片。 */
export const PRIZE_DISPLAY: Record<PrizeKey, { label: string; color: string }> = {
  console: {
    label: 'Switch2游戏机',
    color: '#5c6bc0',
  },
  mini_handheld: {
    label: '迷你掌机',
    color: '#ec407a',
  },
  badge: {
    label: '吧唧',
    color: '#42a5f5',
  },
  poke_ball: {
    label: '精灵球',
    color: '#ab47bc',
  },
  points_300: {
    label: '300积分券',
    color: '#7e57c2',
  },
};

/** 功能注释：奖池预览 / 中奖弹窗共用的领取方式文案（每奖独立）。 */
export const PRIZE_CLAIM_INFO: Record<
  PrizeKey,
  { fulfillment: 'shipping' | 'onsite' | 'points'; method: string; detail: string }
> = {
  console: {
    fulfillment: 'shipping',
    method: '邮寄领取',
    detail: '中奖后请填写收货人、地址与手机号，我们将安排寄送。',
  },
  poke_ball: {
    fulfillment: 'shipping',
    method: '邮寄领取',
    detail: '中奖后请填写收货人、地址与手机号，我们将安排寄送。',
  },
  mini_handheld: {
    fulfillment: 'onsite',
    method: '现场领取',
    detail: '请凭中奖记录到Chinajoy场馆N2-G207现场工作人员处领取。',
  },
  badge: {
    fulfillment: 'onsite',
    method: '现场领取',
    detail: '请凭中奖记录到Chinajoy场馆N2-G207现场工作人员处领取。',
  },
  points_300: {
    fulfillment: 'points',
    method: '自动发放',
    detail: '中奖后 300 游戏积分直接到账，无需额外操作。',
  },
};
