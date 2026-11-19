import type {
  MembershipSignInStatus,
  SignInCalendarDay,
  SignInDayState,
  SignInRewardBreakdown,
  SignInWeekDay,
  SignInWeekStatus,
  SignInMonthStatus,
} from '../api/account/auth.type';

export type CheckInViewMode = 'home' | 'profile';

export interface CalendarGridDay {
  date: string;
  weekday: number;
  dayOfMonth: number;
  state: SignInDayState;
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
const DEFAULT_BASE_POINTS = 5;
const DEFAULT_WEEKLY_BONUS_ON_DAY7 = 10;
const DEFAULT_MONTHLY_BONUS_POINTS = 20;

export function getWeekdayKey(weekday: number): typeof WEEKDAY_KEYS[number] {
  return WEEKDAY_KEYS[Math.min(7, Math.max(1, weekday)) - 1];
}

export function formatUtcMonthDay(date: string): string {
  const [, month = '', day = ''] = date.split('-');
  return `${month}.${day}`;
}

export function buildMonthGrid<T extends CalendarGridDay>(days: T[]): Array<T | null> {
  if (days.length === 0) return [];
  const leadingCells = Math.min(6, Math.max(0, days[0].weekday - 1));
  return [...Array.from({ length: leadingCells }, () => null), ...days];
}

export function getMonthProgress(month?: {
  targetDays: number;
  currentConsecutiveDays: number;
  progressDays?: number;
  bonusRewarded: boolean;
} | null): number {
  if (!month) return 0;
  if (month.bonusRewarded) return month.targetDays;
  return Math.min(month.targetDays, Math.max(0, month.progressDays ?? month.currentConsecutiveDays));
}

export function getCompletionBehavior(mode: CheckInViewMode): { autoClose: boolean; delayMs: number } {
  void mode;
  return { autoClose: false, delayMs: 0 };
}

function toValidDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 功能注释：业务日历按 UTC+8 取 YYYY-MM-DD，与后端 signin 服务一致 */
function dateKeyUtc8(date: Date): string {
  return new Date(date.getTime() + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(value: string | Date, amount: number): Date {
  const date = typeof value === 'string' ? dateFromKey(value) : new Date(value.getTime());
  date.setUTCDate(date.getUTCDate() + amount);
  return date;
}

function utcWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function resolveTodayKey(raw: Partial<MembershipSignInStatus>): string {
  if (typeof raw.serverDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.serverDate)) {
    return raw.serverDate;
  }
  const fromServerTime = toValidDate(raw.serverTime);
  if (fromServerTime) return dateKeyUtc8(fromServerTime);
  return dateKeyUtc8(new Date());
}

function dayState(dayKey: string, todayKey: string, signedDates: Set<string>): SignInDayState {
  if (signedDates.has(dayKey)) return 'signed';
  if (dayKey === todayKey) return 'today';
  return dayKey < todayKey ? 'missed' : 'upcoming';
}

function trailingStreak(signedDates: Set<string>, startKey: string, lowerBoundKey: string): number {
  let cursor = dateFromKey(startKey);
  let count = 0;
  while (dateKeyUtc8(cursor) >= lowerBoundKey && signedDates.has(dateKeyUtc8(cursor))) {
    count += 1;
    cursor = addUtcDays(cursor, -1);
  }
  return count;
}

function bestMonthStreak(signedDates: Set<string>, monthStartKey: string, monthEndKey: string): number {
  let current = 0;
  let best = 0;
  for (let cursor = dateFromKey(monthStartKey); dateKeyUtc8(cursor) <= monthEndKey; cursor = addUtcDays(cursor, 1)) {
    if (signedDates.has(dateKeyUtc8(cursor))) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function buildTodayReward(raw: Partial<MembershipSignInStatus>): SignInRewardBreakdown {
  if (raw.todayReward && typeof raw.todayReward === 'object') {
    return {
      basePoints: Number(raw.todayReward.basePoints || 0),
      weeklyBonusPoints: Number(raw.todayReward.weeklyBonusPoints || 0),
      monthlyBonusPoints: Number(raw.todayReward.monthlyBonusPoints || 0),
      totalPoints: Number(raw.todayReward.totalPoints || 0),
    };
  }
  const basePoints = Number(raw.basePoints ?? DEFAULT_BASE_POINTS);
  const bonusPoints = Number(raw.bonusPoints ?? 0);
  const totalPoints = Number(raw.totalPointsToday ?? basePoints + bonusPoints);
  return {
    basePoints,
    weeklyBonusPoints: Math.max(0, bonusPoints),
    monthlyBonusPoints: 0,
    totalPoints,
  };
}

function buildWeekFromSignedDays(
  todayKey: string,
  signedDates: Set<string>,
  schedules?: { base?: number[]; display?: number[] },
): SignInWeekStatus {
  const today = dateFromKey(todayKey);
  const weekStart = addUtcDays(today, 1 - utcWeekday(today));
  const weekKeys = Array.from({ length: 7 }, (_, index) => dateKeyUtc8(addUtcDays(weekStart, index)));
  const baseSchedule = schedules?.base?.length === 7 ? schedules.base : Array(7).fill(DEFAULT_BASE_POINTS);
  const displaySchedule = schedules?.display?.length === 7
    ? schedules.display
    : [5, 5, 5, 5, 5, 5, 15];

  let consecutiveDays = 0;
  for (const key of weekKeys) {
    if (!signedDates.has(key)) break;
    consecutiveDays += 1;
  }

  const days: SignInWeekDay[] = weekKeys.map((value, index) => {
    const weekday = index + 1;
    const state = dayState(value, todayKey, signedDates);
    const basePoints = Number(baseSchedule[index] ?? DEFAULT_BASE_POINTS);
    const displayPoints = Number(displaySchedule[index] ?? basePoints);
    const weeklyBonusPoints = Math.max(0, displayPoints - basePoints);
    return {
      date: value,
      weekday,
      dayOfMonth: Number(value.slice(-2)),
      state,
      canMakeup: state === 'missed' && value.startsWith(todayKey.slice(0, 7)),
      basePoints,
      weeklyBonusPoints,
      totalPoints: basePoints + weeklyBonusPoints,
    };
  });

  return {
    startDate: weekKeys[0],
    endDate: weekKeys[6],
    consecutiveDays,
    signedDays: weekKeys.filter((key) => signedDates.has(key)).length,
    bonusEligible: weekKeys.slice(0, utcWeekday(today) - 1).every((key) => signedDates.has(key)),
    days,
  };
}

function buildMonthFromSignedDays(
  todayKey: string,
  signedDates: Set<string>,
  raw: Partial<MembershipSignInStatus>,
): SignInMonthStatus {
  const today = dateFromKey(todayKey);
  const monthKey = todayKey.slice(0, 7);
  const monthStartKey = `${monthKey}-01`;
  const daysInMonth = Math.max(
    1,
    Number(raw.daysInMonth || new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate()),
  );
  const monthEndKey = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;
  const targetDays = today.getUTCMonth() === 1 ? 28 : 30;
  const completedThroughKey = signedDates.has(todayKey) ? todayKey : dateKeyUtc8(addUtcDays(today, -1));
  const currentConsecutiveDays = signedDates.has(completedThroughKey)
    ? trailingStreak(signedDates, completedThroughKey, monthStartKey)
    : 0;
  const bestConsecutiveDays = bestMonthStreak(signedDates, monthStartKey, monthEndKey);
  const bonusRewarded = Boolean(raw.perfectAttendance?.rewarded);
  const bonusPoints = Number(raw.perfectAttendance?.reward ?? DEFAULT_MONTHLY_BONUS_POINTS);
  const progressDays = bonusRewarded
    ? targetDays
    : Math.min(targetDays, currentConsecutiveDays);

  const days: SignInCalendarDay[] = [];
  for (let cursor = dateFromKey(monthStartKey); dateKeyUtc8(cursor) <= monthEndKey; cursor = addUtcDays(cursor, 1)) {
    const value = dateKeyUtc8(cursor);
    const state = dayState(value, todayKey, signedDates);
    days.push({
      date: value,
      weekday: utcWeekday(cursor),
      dayOfMonth: cursor.getUTCDate(),
      state,
      canMakeup: state === 'missed',
    });
  }

  return {
    monthKey,
    daysInMonth,
    targetDays,
    currentConsecutiveDays,
    bestConsecutiveDays,
    progressDays,
    bonusPoints,
    bonusRewarded,
    days,
  };
}

/**
 * 功能注释：测试环境旧签到接口可能只回 signedDaysThisMonth 等扁平字段；
 * 这里补齐 week/month/todayReward，避免日历整块消失。
 */
export function normalizeMembershipSignInStatus(
  raw: MembershipSignInStatus | null | undefined,
): MembershipSignInStatus | null {
  if (!raw || typeof raw !== 'object') return null;

  const todayKey = resolveTodayKey(raw);
  const signedDates = new Set(
    (Array.isArray(raw.signedDaysThisMonth) ? raw.signedDaysThisMonth : [])
      .map((value) => String(value || '').trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
  );
  // 功能注释：旧接口有时只标 signedInToday，不把今天写进 signedDaysThisMonth
  if (raw.signedInToday) signedDates.add(todayKey);

  const todayReward = buildTodayReward(raw);
  const week = raw.week?.days?.length
    ? raw.week
    : buildWeekFromSignedDays(todayKey, signedDates, {
      base: raw.baseSchedule,
      display: raw.displaySchedule,
    });
  const month = raw.month?.days?.length
    ? raw.month
    : buildMonthFromSignedDays(todayKey, signedDates, raw);

  return {
    ...raw,
    serverDate: raw.serverDate || todayKey,
    serverTime: raw.serverTime || new Date().toISOString(),
    timeZone: raw.timeZone || 'UTC+8',
    signedInToday: Boolean(raw.signedInToday),
    canClaim: Boolean(raw.canClaim),
    makeupCardCount: Math.max(0, Number(raw.makeupCardCount || 0)),
    todayReward,
    week,
    month,
    streakDay: Number(raw.streakDay || week.days.find((day) => day.date === todayKey)?.weekday || 1),
    nextStreakDay: Number(raw.nextStreakDay || 1),
    planId: raw.planId ?? null,
    tierRank: raw.tierRank ?? null,
    basePoints: Number(raw.basePoints ?? todayReward.basePoints),
    bonusPoints: Number(raw.bonusPoints ?? todayReward.weeklyBonusPoints + todayReward.monthlyBonusPoints),
    totalPointsToday: Number(raw.totalPointsToday ?? todayReward.totalPoints),
    baseSchedule: Array.isArray(raw.baseSchedule) ? raw.baseSchedule : [5, 5, 5, 5, 5, 5, 5],
    bonusSchedule: Array.isArray(raw.bonusSchedule) ? raw.bonusSchedule : [0, 0, 0, 0, 0, 0, DEFAULT_WEEKLY_BONUS_ON_DAY7],
    displaySchedule: Array.isArray(raw.displaySchedule) ? raw.displaySchedule : [5, 5, 5, 5, 5, 5, 15],
    signedDaysThisMonth: [...signedDates].sort(),
    daysInMonth: Number(raw.daysInMonth || month.daysInMonth),
    perfectAttendance: raw.perfectAttendance || {
      enabled: true,
      reward: DEFAULT_MONTHLY_BONUS_POINTS,
      achieved: false,
      rewarded: false,
      canClaim: false,
    },
  };
}
