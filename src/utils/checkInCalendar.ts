export type CheckInViewMode = 'home' | 'profile';

export interface CalendarGridDay {
  date: string;
  weekday: number;
  dayOfMonth: number;
  state: 'signed' | 'made_up' | 'missed' | 'today' | 'upcoming';
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

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

export function getMonthProgress(month: {
  targetDays: number;
  currentConsecutiveDays: number;
  progressDays?: number;
  bonusRewarded: boolean;
}): number {
  if (month.bonusRewarded) return month.targetDays;
  return Math.min(month.targetDays, Math.max(0, month.progressDays ?? month.currentConsecutiveDays));
}

export function getCompletionBehavior(mode: CheckInViewMode): { autoClose: boolean; delayMs: number } {
  void mode;
  return { autoClose: false, delayMs: 0 };
}
