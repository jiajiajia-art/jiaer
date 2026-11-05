export function formatKkMinor(value: number): string {
  return (Number(value || 0) / 100).toFixed(2);
}

export function formatPoints(value: number): string {
  return Math.trunc(Number(value || 0)).toLocaleString('zh-CN');
}

export function formatMicroYuan(value: number): string {
  return (Number(value || 0) / 1_000_000).toFixed(4);
}

export function formatModelPriceX10000(value: number | null | undefined): string {
  if (value === null || value === undefined) return '未配置';
  return (Number(value) / 10_000).toLocaleString('zh-CN', {
    maximumFractionDigits: 4,
  });
}

export type UsagePreset = 'today' | '7d' | '30d';

export function resolveUsagePresetRange(
  preset: UsagePreset,
  now: Date = new Date(),
): { from: string; to: string } {
  const dayCount = preset === 'today' ? 1 : preset === '30d' ? 30 : 7;
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - dayCount + 1);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}
