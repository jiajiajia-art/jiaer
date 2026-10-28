export type CreatorAuthorType = 'regular' | 'contracted' | 'special';
export type CreatorLevelMetricType = 'play_round' | 'pv';
export type CreatorBenefitMode = 'all' | 'role-playing' | 'world' | 'custom' | 'interactive-video' | 'novel';

const CREATOR_BENEFIT_MODE_ENGINES: Record<Exclude<CreatorBenefitMode, 'all'>, Set<string>> = {
  'role-playing': new Set(['TXT', 'RPG', 'ROLE-PLAYING', '文字互动']),
  world: new Set(['AVG', 'ST', 'WORLD', '世界互动']),
  custom: new Set(['CUSTOM', '自定义']),
  'interactive-video': new Set(['IVG']),
  novel: new Set(['NOVEL', '小说', '视觉小说']),
};

export function metricLabel(work: { levelMetricType?: CreatorLevelMetricType | null }): string {
  return work.levelMetricType === 'play_round' ? '游玩轮次' : 'PV';
}

export function authorTypeLabel(authorType: CreatorAuthorType): string {
  if (authorType === 'contracted') return '签约作者';
  if (authorType === 'special') return '特邀作者';
  return '普通作者';
}

function formatShanghaiDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${read('year')}.${read('month')}.${read('day')}`;
}

export function formatCreatorQuarterRange(
  periodStart?: string | null,
  periodEnd?: string | null,
): string {
  if (!periodStart || !periodEnd) return '—';
  const endTimestamp = Date.parse(periodEnd);
  if (!Number.isFinite(Date.parse(periodStart)) || !Number.isFinite(endTimestamp)) return '—';
  return `${formatShanghaiDate(periodStart)} - ${formatShanghaiDate(endTimestamp - 1)}`;
}

export function creatorLevelProgress(input: {
  progressPv?: number | null;
  requiredPv?: number | null;
  progressPercent?: number | null;
}): { current: number; target: number; percent: number } {
  const current = Math.max(0, Math.floor(Number(input.progressPv) || 0));
  const target = Math.max(0, Math.floor(Number(input.requiredPv) || 0));
  const percent = Math.max(0, Math.min(100, Number(input.progressPercent) || 0));
  return { current, target, percent };
}

export function formatCreatorProgressPercent(value: number): string {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  const fractionDigits = percent > 0 && percent < 0.1 ? 3 : 2;
  return `${Number(percent.toFixed(fractionDigits))}%`;
}

export function filterCreatorBenefitWorksByMode<T extends { engine?: string | null }>(
  works: T[],
  mode: CreatorBenefitMode,
): T[] {
  if (mode === 'all') return works;
  const engines = CREATOR_BENEFIT_MODE_ENGINES[mode];
  return works.filter((work) => engines.has(String(work.engine || '').trim().toUpperCase()));
}

export function sortCreatorBenefitWorksByContribution<T extends { quarterMetricCount?: number | null }>(
  works: readonly T[],
): T[] {
  return [...works].sort(
    (left, right) => (Number(right.quarterMetricCount) || 0) - (Number(left.quarterMetricCount) || 0),
  );
}
