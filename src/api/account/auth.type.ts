export type MembershipPlanId = 'month' | 'season' | 'year';

export interface MembershipSignInStatus {
  signedInToday: boolean;
  canClaim: boolean;
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
}

export interface CheckInResponse {
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
}

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
  points: number;
  diamonds?: number;
  inviteCode: string;
  hasSignedIn: boolean;
  firstCharge?: boolean;
  isMember?: boolean;
  memberPlan?: MembershipPlanId | null;
  memberEndAt?: string | null;
}

// 注册请求
export interface SignupRequest {
  phoneNumber: string;
  password: string;
  // email: string;
  avatarUrl: string;
  nickname: string;
  // code: string;
}

// 登录请求
export interface BindAccountRequest {
  phoneNumber: string;
  password: string;
}

export interface LoginRequest {
  phoneNumber: string;
  password: string;
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
}

// 重置密码请求
export interface ResetPasswordRequest {
  code: string;
  newPassword: string;
  confirmNewPassword: string;
}

// 结算奖励
export interface SettlePointsResponse {
  userId: string;
  pointsSettled: number;
  diamondsSettled?: number;
  pointsFileCount?: number;
  diamondFileCount?: number;
  settlementTime: string;
  lastSettlementTime: string | null;
}

export interface SubscriptionRedeemResult {
  planId: MembershipPlanId;
  tierRank: number;
  startAt: string;
  endAt: string;
  remainingDays: number;
}

// 邀请奖励
export interface InviteRewardItem {
  threshold: number;
  points: number;
  claimed: boolean;
  claimable: boolean;
  isDynamic?: boolean;
}

export interface InviteStats {
  inviteCount: number;
  rewards: InviteRewardItem[];
}

export interface InviteClaimResult {
  threshold: number;
  pointsAwarded: number;
  remainingPoints: number;
}

// 积分活动查询
export type PointsActivityDirection = 'all' | 'income' | 'expense';
export type PointsActivityCurrency = 'all' | 'points' | 'diamonds';

export interface GetPointsActivitiesParams {
  currency?: PointsActivityCurrency;
  direction?: PointsActivityDirection;
  year?: number;
  month?: number;
  page?: number;
  pageSize?: number;
}

export interface PointsActivityItem {
  currency: 'points' | 'diamonds';
  activityType: string;
  amount: number;
  direction: 'income' | 'expense';
  occurredAt: string;
  id: number;
  title: string;
  subtitle: string;
}

export interface PointsActivitiesResponse {
  points: number;
  diamonds: number;
  items: PointsActivityItem[];
}

// 钻石兑换积分
export interface ExchangeDiamondsRequest {
  diamonds: number;
}

export interface ExchangeDiamondsResponse {
  diamondsSpent: number;
  pointsEarned: number;
  remainingDiamonds: number;
  remainingPoints: number;
}
