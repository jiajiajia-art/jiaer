/**
 * 抽奖后台配置辅助：上海时间转换与一等奖概率文案（供 Admin UI / 单测共用）。
 */

export const ADMIN_DRAWS_PAGE_SIZE = 50;

/** 功能注释：ISO → 上海墙钟 datetime-local 值，供运营编辑活动档期。 */
export function toShanghaiDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** 功能注释：把上海墙钟 datetime-local 转成 UTC ISO，提交后台配置。 */
export function fromShanghaiDatetimeLocal(local: string): string {
  const trimmed = String(local || '').trim();
  if (!trimmed) return '';
  const withSeconds = /:\d{2}$/.test(trimmed) ? trimmed : `${trimmed}:00`;
  const date = new Date(`${withSeconds}+08:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

/** 功能注释：权重相对总分母约 3000，用于运营预览一等奖概率文案。 */
export function formatFirstPrizeOddsHint(weight: number): string {
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0) return '未配置 / 0：一等奖永远抽不中';
  const denom = Math.max(1, Math.round(3000 / w));
  return `约 1/${denom}（权重 ${Math.floor(w)} / 总分母约 3000）`;
}

/** 功能注释：1-based 页码 → offset。 */
export function resolveAdminDrawsOffset(
  page: number,
  pageSize: number = ADMIN_DRAWS_PAGE_SIZE,
): number {
  const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : ADMIN_DRAWS_PAGE_SIZE;
  return (p - 1) * size;
}

/** 功能注释：总条数 → 总页数（至少 1，便于空表展示）。 */
export function resolveAdminDrawsTotalPages(
  total: number,
  pageSize: number = ADMIN_DRAWS_PAGE_SIZE,
): number {
  const t = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : ADMIN_DRAWS_PAGE_SIZE;
  if (t <= 0) return 1;
  return Math.ceil(t / size);
}

/** 功能注释：导出成功提示文案。 */
export function formatAdminExportSuccessMessage(exportRows: number, exportTotal?: number): string {
  const rows = Number(exportRows) || 0;
  const total = exportTotal == null || Number.isNaN(Number(exportTotal))
    ? null
    : Number(exportTotal);
  if (total != null && total !== rows) {
    return `已导出 ${rows} 条（服务端统计 ${total} 条，请核对）`;
  }
  return `已导出全部 ${rows} 条记录`;
}
