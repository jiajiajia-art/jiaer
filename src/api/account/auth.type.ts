export type MembershipPlanId = 'week' | 'month_v2';

export interface KkBalance {
  total: number;
  permanent: number;
  limited: number;
  recharge: number;
  gift: number;
  nextExpiryAt: string | null;
  nextExpiryAmount: number;
}

export interface MembershipPlanState {
  active: true;
  planId: MembershipPlanId;
  startAt: string;
  endAt: string;
}

export interface MembershipState {
  week: MembershipPlanState | null;
  month: MembershipPlanState | null;
  publishedPlayDiscountPercent: number | null;
}

export interface InviteStats {
  inviteCount: number;
  rewardedLimitedKk: number;
}

export interface PlatformBenefits {
  inviteRewardKk: number;
  registrationRewardKk: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface KkRechargePlan {
  id: string;
  price: number;
  baseDiamonds: number;
  firstBonusDiamonds: number;
  firstTotalDiamonds: number;
  firstChargeEligible: boolean;
  label: string;
  /** 后台为该档位配置的海外倍率（海外价 = 人民币价 × 倍率），未配置则用默认倍率 */
  overseasMultiplier?: number;
}

/** 后台配置：海外价格 = 人民币价格 × 倍率 */
export interface OverseasPricing {
  currency: 'USD';
  /** 默认倍率（档位未单独配置时使用） */
  rate: number;
}

export interface MembershipKkReward {
  planId: MembershipPlanId;
  amount: number;
  rewardDate?: string;
}

export type StackedPlanStatus = 'active' | 'paused' | 'expired' | string;

export interface StackedPlan {
    planId: MembershipPlanId;
    status: StackedPlanStatus;
    stackOrder: number;
    endAt?: string | null;
    remainingDays?: number | null;
}

export type Currency = import('../common/currency').Currency;
export type CurrencyWithAll = import('../common/currency').CurrencyWithAll;

export type SignInDayState = 'signed' | 'made_up' | 'missed' | 'today' | 'upcoming';

export interface SignInRewardBreakdown {
  basePoints: number;
  weeklyBonusPoints: number;
  monthlyBonusPoints: number;
  totalPoints: number;
}

export interface SignInCalendarDay {
  date: string;
  weekday: number;
  dayOfMonth: number;
  state: SignInDayState;
  canMakeup?: boolean;
}

export interface SignInWeekDay extends SignInCalendarDay {
  basePoints: number;
  weeklyBonusPoints: number;
  totalPoints: number;
}

export interface SignInWeekStatus {
  startDate: string;
  endDate: string;
  consecutiveDays: number;
  signedDays: number;
  bonusEligible: boolean;
  days: SignInWeekDay[];
}

export interface SignInMonthStatus {
  monthKey: string;
  daysInMonth: number;
  targetDays: number;
  currentConsecutiveDays: number;
  bestConsecutiveDays: number;
  progressDays: number;
  bonusPoints: number;
  bonusRewarded: boolean;
  days: SignInCalendarDay[];
}

export interface MembershipSignInStatus {
  serverDate: string;
  serverTime: string;
  timeZone: 'UTC' | 'UTC+8';
  signedInToday: boolean;
  canClaim: boolean;
  makeupCardCount: number;
  todayReward: SignInRewardBreakdown;
  week: SignInWeekStatus;
  month: SignInMonthStatus;
  streakDay: number;
  nextStreakDay: number;
  planId: MembershipPlanId | null;
  tierRank: number | null;
  basePoints: number;
  bonusPoints: number;
  totalPointsToday: number;
  baseSchedule: number[];
  bonusSchedule: number[];
  displaySchedule: number[];
  signedDaysThisMonth: string[];
  daysInMonth: number;
  perfectAttendance: {
    enabled: boolean;
    reward: number;
    achieved: boolean;
    rewarded: boolean;
    canClaim: boolean;
  };
}

export interface CheckInResponse {
  alreadySigned: boolean;
  signedIn: boolean;
  pointsAdded: number;
  remainingPoints: number;
  rewardBreakdown: SignInRewardBreakdown;
  status: MembershipSignInStatus;
  rewardPoints?: number;
  signInStatus?: MembershipSignInStatus | null;
  activePlanId?: MembershipPlanId | null;
  tierRank?: number | null;
  cycleDay?: number;
  cycleLength?: number;
  signedToday?: boolean;
  todayBonusPoints?: number;
  signinBonusSchedule?: number[] | null;
  endAt?: string | null;
  membershipRewards?: MembershipKkReward[];
}

export interface SignInMakeupResponse {
  madeUp: boolean;
  alreadyMadeUp: boolean;
  errorCode: string | null;
  pointsAdded: number;
  remainingPoints: number;
  makeupCardCount: number;
  rewardBreakdown: SignInRewardBreakdown;
  status: MembershipSignInStatus;
  membershipRewards?: MembershipKkReward[];
}

export type UserGender = 'male' | 'female';

// 用户信息
export interface User {
  name: string;
  id: number;
  userId: string;
  userCode: string;
  debugToken?: string;
  phoneNumber: string;
  role: string;
  userSegment?: 'normal' | 'incentive' | 'all_incentive' | string;
  createTime: string;
  lastLoginTime: string | null;
  email: string;
  nickname: string;
  avatarUrl: string;
  gender?: UserGender | null;
  preferredTagIds?: number[];
  profileCompleted?: boolean;
  points: number;
  diamonds?: number;
  kkBalance?: KkBalance;
  kkRechargePlans?: KkRechargePlan[];
  overseasPricing?: OverseasPricing;
  membership?: MembershipState;
  inviteCode: string;
  inviteStats?: InviteStats;
  platformBenefits?: PlatformBenefits;
  hasSignedIn: boolean;
  firstChargePlans?: Record<string, boolean>;
  isMember?: boolean;
  memberPlan?: MembershipPlanId | null;
  memberEndAt?: string | null;
  stackedPlans?: StackedPlan[];
  /** 禁发截止（P0；来自 user_punishment.publish_blocked_until） */
  publishBanUntil?: string | null;
  /** 主页对外隐藏（P0.5） */
  homeHidden?: boolean;
  /** 新作先审后发（P0.5；来自 publish_need_review） */
  publishNeedReview?: boolean;
  /** 创作者身份冻结（P0.5；来自 creator_frozen） */
  creatorFrozen?: boolean;
  /** 观察期截止（P0.5；用户侧可选展示） */
  observationUntil?: string | null;
}

// 注册请求
export interface SignupRequest {
  phoneNumber: string;
  password: string;
  code: string;
  inviteCode?: string;
  agreementAccepted: boolean;
  requestId: string;
  // email: string;
  avatarUrl: string;
  nickname: string;
  /** 未登录点击推广链时的匿名 ID，注册时带给后端以归因 invitee（见 promoAnonId.ts / GameDetail） */
  promoAnonId?: string;
  // code: string;
}

export interface SaveProfilePreferencesRequest {
  gender: UserGender;
  tagIds: number[];
}

export interface SaveProfilePreferencesResponse {
  gender: UserGender;
  preferredTagIds: number[];
  profileCompleted: boolean;
  user: User;
}

// 登录请求
export interface BindAccountRequest {
  phoneNumber: string;
  password: string;
}

export interface LoginRequest {
  phoneNumber: string;
  password: string;
  agreementAccepted: true;
  userAgreementVersion: string;
  privacyPolicyVersion: string;
}

export interface GoogleLoginRequest {
  idToken: string;
  agreementAccepted: true;
  userAgreementVersion: string;
  privacyPolicyVersion: string;
}

// 登录响应
export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresAt: number; // 绝对过期时间戳（秒）
  expiresIn: number; // 相对过期秒数
  user: User;
}

// 发送验证码请求
export interface SendCodeRequest {
  phoneNumber: string;
  purpose?: 'register' | 'password_reset';
}

// 重置密码请求
export interface ResetPasswordRequest {
  phoneNumber: string;
  code: string;
  newPassword: string;
  confirmNewPassword: string;
}

// 结算奖励
export interface SettlePointsResponse {
  userId: string;
  pointsSettled: number;
  diamondsSettled?: number;
  totalFileCount?: number;
  settlementTime: string;
}

export interface SubscriptionRedeemResult {
  planId: MembershipPlanId;
  tierRank: number;
  startAt: string;
  endAt: string;
  remainingDays: number;
}

export interface InviteCodeUseResult {
  diamondsAdded: number;
  remainingDiamonds: number;
  inviterName: string;
}

// 积分活动查询
export type PointsActivityDirection = 'all' | 'income' | 'expense';
export type PointsActivityCurrency = CurrencyWithAll | 'wallet';
export type KkActivityFilter = 'all' | 'recharge' | 'gift' | 'consume' | 'expired' | 'refund';
export type KkValidityFilter = 'all' | 'permanent' | 'limited';
export type KkAssetCategoryFilter = 'all' | 'recharge' | 'gift';
export type KkEventTypeFilter = 'all' | 'income' | 'consume' | 'expired' | 'refund';

export interface GetPointsActivitiesParams {
  currency?: PointsActivityCurrency;
  direction?: PointsActivityDirection;
  year?: number;
  month?: number;
  page?: number;
  pageSize?: number;
  kkFilter?: KkActivityFilter;
  validityType?: KkValidityFilter;
  assetCategory?: KkAssetCategoryFilter;
  eventType?: KkEventTypeFilter;
}

export interface PointsActivityItem {
  currency: Currency;
  activityType: string;
  amount: number;
  originalAmount?: number;
  discountPercent?: number;
  direction: 'income' | 'expense';
  occurredAt: string;
  id: number;
  title: string;
  subtitle: string;
  assetCategory?: 'recharge' | 'gift' | null;
  validityType?: 'permanent' | 'limited' | null;
  expiresAt?: string | null;
  eventStatus?: 'completed' | 'expired' | string;
  relatedActivityId?: number | null;
}

export interface PointsActivitiesResponse {
  points: number;
  diamonds: number;
  kkBalance?: KkBalance;
  items: PointsActivityItem[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

// 钻石兑换积分
export interface ExchangeDiamondsRequest {
  points: number;
}

export interface ExchangeDiamondsResponse {
  diamondsSpent: number;
  pointsEarned: number;
  remainingDiamonds: number;
  remainingPoints: number;
}

export interface ExchangeDiamondsErrorResponse {
    currentDiamonds: number;
    diamondsNeeded: number;
}
