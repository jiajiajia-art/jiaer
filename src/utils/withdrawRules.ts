/** 提现纯规则（与后端 withdrawRules 对齐，供 UI 与单测） */

export const WITHDRAW_DIAMOND_UNIT = 10;
/** 单笔最低提现钻石数（≥1000 钻 ≈ ¥100），与后端对齐 */
export const WITHDRAW_MIN_DIAMONDS = 1000;

/** 弹窗内「我的提现记录」默认最多展示条数；超过则显示「查看更多」进入独立页 */
export const WITHDRAW_MODAL_RECORD_LIMIT = 5;

/** 独立提现记录页默认每页条数 */
export const WITHDRAW_RECORDS_PAGE_SIZE = 20;

/** 用户侧提现列表单页上限（与后端 listWithdrawRequests 一致） */
export const WITHDRAW_LIST_PAGE_SIZE_MAX = 100;

export const WITHDRAW_PENDING_MESSAGE =
  '您的提现申请在审核中，每月15号为结算日，请您耐心等待。';

/**
 * 可提现上限：余额向下取整到 10 的倍数；不足最低门槛则返回 0
 */
export function maxWithdrawableDiamonds(balance: number): number {
  const n = Math.floor(Number(balance) || 0);
  if (n < WITHDRAW_MIN_DIAMONDS) return 0;
  return Math.floor(n / WITHDRAW_DIAMOND_UNIT) * WITHDRAW_DIAMOND_UNIT;
}

/** 单笔金额是否合法：≥1000 且为 10 的倍数 */
export function isValidWithdrawAmount(amount: number): boolean {
  const n = Number(amount);
  if (!Number.isInteger(n) || n < WITHDRAW_MIN_DIAMONDS) return false;
  return n % WITHDRAW_DIAMOND_UNIT === 0;
}

export function diamondsToCny(amount: number): number {
  const n = Number(amount) || 0;
  return Math.round((n / WITHDRAW_DIAMOND_UNIT) * 100) / 100;
}

export function canWithdrawByRole(role?: string | null): boolean {
  const value = String(role || '').trim();
  return value === 'creator_verified' || value === 'admin';
}

/**
 * 弹窗记录超过上限时展示「查看更多」，进入独立分页页。
 * total 为接口 pagination.total（全量条数，不是当前页 list.length）。
 */
export function shouldShowWithdrawRecordsViewAll(total: number): boolean {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) return false;
  return n > WITHDRAW_MODAL_RECORD_LIMIT;
}

/** 规范化列表页码（非法或小于 1 时回退为 1） */
export function normalizeWithdrawListPage(page: number): number {
  const n = Number(page);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

/**
 * 规范化列表 pageSize：非法回退 defaultSize，并钳制到 max。
 * 与后端 listWithdrawRequests 的钳制语义对齐，便于前后端单测共用口径。
 */
export function clampWithdrawListPageSize(
  pageSize: number,
  defaultSize: number = WITHDRAW_RECORDS_PAGE_SIZE,
  max: number = WITHDRAW_LIST_PAGE_SIZE_MAX,
): number {
  const n = Number(pageSize);
  if (!Number.isInteger(n) || n < 1) return defaultSize;
  return Math.min(n, max);
}

/** 由 total + pageSize 计算总页数（至少 1 页，与后端 pagination.totalPages 对齐） */
export function withdrawListTotalPages(total: number, pageSize: number): number {
  const t = Math.max(0, Number(total) || 0);
  const size = clampWithdrawListPageSize(pageSize);
  if (t <= 0) return 1;
  return Math.ceil(t / size);
}

export type PayoutProfileFields = {
  phoneNumber?: string;
  realName?: string;
  idCard?: string;
  bankCard?: string;
  bankCardNumber?: string;
  bankBranch?: string;
};

export function checkPayoutProfile(profile: PayoutProfileFields = {}) {
  const missing: string[] = [];
  if (!String(profile.phoneNumber || '').trim()) missing.push('phoneNumber');
  if (!String(profile.realName || '').trim()) missing.push('realName');
  if (!String(profile.idCard || '').trim()) missing.push('idCard');
  if (!String(profile.bankCard || profile.bankCardNumber || '').trim()) missing.push('bankCard');
  if (!String(profile.bankBranch || '').trim()) missing.push('bankBranch');
  return { complete: missing.length === 0, missing };
}

export function buildWithdrawCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  const header = [
    '单号', '用户ID', '用户名', '手机号', '提现KK币', '折合人民币',
    '银行卡号', '开户银行', '真实姓名', '身份证号', '状态', '申请时间', '审核时间', '备注',
  ];
  const escape = (value: string | number | null | undefined) => {
    const text = String(value ?? '');
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      row.withdrawNo,
      row.userId,
      row.nickname,
      row.phone,
      row.amount,
      row.amountCny,
      row.bankCard,
      row.bankBranch,
      row.realName,
      row.idCard,
      row.status,
      row.createdAt,
      row.processedAt,
      row.remark,
    ].map(escape).join(','));
  }
  return `\uFEFF${lines.join('\n')}`;
}
