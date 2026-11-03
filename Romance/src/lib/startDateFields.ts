/**
 * ① 基础 · 开局日期：固定 YYYY.MM.DD，创作者只选年/月/日数字，禁止自由字符串。
 */

export const START_DATE_RE = /^\d{4}\.\d{2}\.\d{2}$/;
export const START_DATE_YEAR_MIN = 1800;
export const START_DATE_YEAR_MAX = 2200;

export type StartDateParts = { year: number; month: number; day: number };

/** 功能注释：按公历算当月天数，供日下拉收紧，避免 2 月 31 等非法组合 */
export function daysInMonth(year: number, month: number): number {
  const y = Math.floor(year);
  const m = Math.floor(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 31;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 功能注释：把草稿/旧稿里的 2005.01.03 / 2005-01-03 / 2005/01/03 解析成数字三元组 */
export function parseStartDateParts(raw: string | null | undefined): StartDateParts | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < START_DATE_YEAR_MIN || year > START_DATE_YEAR_MAX) return null;
  if (month < 1 || month > 12) return null;
  const dim = daysInMonth(year, month);
  if (day < 1 || day > dim) return null;
  return { year, month, day };
}

/** 功能注释：拼成引擎契约格式 YYYY.MM.DD；非法则返回空串 */
export function formatStartDate(parts: StartDateParts | null | undefined): string {
  if (!parts) return "";
  const year = Math.floor(parts.year);
  const month = Math.floor(parts.month);
  const day = Math.floor(parts.day);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "";
  if (year < START_DATE_YEAR_MIN || year > START_DATE_YEAR_MAX) return "";
  if (month < 1 || month > 12) return "";
  const dim = daysInMonth(year, month);
  if (day < 1 || day > dim) return "";
  return `${String(year).padStart(4, "0")}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

/**
 * 功能注释：改年/月时把日夹到当月合法范围，避免选了 31 再改到 2 月仍残留非法串。
 */
export function clampStartDateParts(parts: Partial<StartDateParts> & { year: number; month: number }): StartDateParts {
  const year = Math.min(START_DATE_YEAR_MAX, Math.max(START_DATE_YEAR_MIN, Math.floor(parts.year) || START_DATE_YEAR_MIN));
  const month = Math.min(12, Math.max(1, Math.floor(parts.month) || 1));
  const dim = daysInMonth(year, month);
  const dayRaw = parts.day != null ? Math.floor(parts.day) : 1;
  const day = Math.min(dim, Math.max(1, Number.isFinite(dayRaw) ? dayRaw : 1));
  return { year, month, day };
}

/** 功能注释：下拉用年份列表（含当前值，避免旧稿年份落在范围外时选不中） */
export function startDateYearOptions(current?: number): number[] {
  const years: number[] = [];
  for (let y = START_DATE_YEAR_MIN; y <= START_DATE_YEAR_MAX; y += 1) years.push(y);
  if (current != null && Number.isFinite(current) && !years.includes(current)) {
    years.push(current);
    years.sort((a, b) => a - b);
  }
  return years;
}
