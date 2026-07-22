import type { TrendSeries } from '../api/stats/operatorReportsApi';

export function shiftIsoDate(dateStr: string, dayDelta: number): string {
  const base = new Date(`${dateStr}T12:00:00+08:00`);
  base.setUTCDate(base.getUTCDate() + dayDelta);
  return base.toISOString().slice(0, 10);
}

export function shanghaiTodayIso(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export function buildPresetRange(days: number) {
  const endDate = shanghaiTodayIso();
  const startDate = shiftIsoDate(endDate, -(days - 1));
  return { startDate, endDate };
}

export function mergeSeriesForChart(series: TrendSeries[]) {
  const map = new Map<string, Record<string, string | number>>();
  for (const item of series) {
    for (const point of item.points) {
      const row = map.get(point.bucket) || { bucket: point.bucket };
      row[item.key] = point.value;
      map.set(point.bucket, row);
    }
  }
  return [...map.values()].sort((left, right) => String(left.bucket).localeCompare(String(right.bucket)));
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}
