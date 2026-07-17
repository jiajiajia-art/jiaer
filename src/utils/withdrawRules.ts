/** 提现纯规则（与后端 withdrawRules 对齐，供 UI 与单测） */

export const WITHDRAW_DIAMOND_UNIT = 10;

export const WITHDRAW_PENDING_MESSAGE =
  '您的提现申请在审核中，每月15号为结算日，请您耐心等待。';

export function maxWithdrawableDiamonds(balance: number): number {
  const n = Math.floor(Number(balance) || 0);
  if (n < WITHDRAW_DIAMOND_UNIT) return 0;
  return Math.floor(n / WITHDRAW_DIAMOND_UNIT) * WITHDRAW_DIAMOND_UNIT;
}

export function isValidWithdrawAmount(amount: number): boolean {
  const n = Number(amount);
  if (!Number.isInteger(n) || n < WITHDRAW_DIAMOND_UNIT) return false;
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

export type PayoutProfileFields = {
  realName?: string;
  idCard?: string;
  bankCard?: string;
  bankCardNumber?: string;
  bankBranch?: string;
};

export function checkPayoutProfile(profile: PayoutProfileFields = {}) {
  const missing: string[] = [];
  if (!String(profile.realName || '').trim()) missing.push('realName');
  if (!String(profile.idCard || '').trim()) missing.push('idCard');
  if (!String(profile.bankCard || profile.bankCardNumber || '').trim()) missing.push('bankCard');
  if (!String(profile.bankBranch || '').trim()) missing.push('bankBranch');
  return { complete: missing.length === 0, missing };
}

export function buildWithdrawCsv(rows: Array<Record<string, string | number | null | undefined>>): string {
  const header = [
    '单号', '用户ID', '用户名', '手机号', '提现钻石', '折合人民币',
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
