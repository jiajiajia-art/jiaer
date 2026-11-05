import type { CreatorEarningOperatorWithdrawal } from '../api/creatorEarnings/operatorCreatorEarningsApi';

const statusLabel: Record<CreatorEarningOperatorWithdrawal['status'], string> = {
  pending: '待审核',
  approved: '待打款',
  paid: '已打款',
  rejected: '已驳回',
};

const escapeCsvCell = (value: string | number): string => {
  const text = String(value);
  const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};

export function buildCreatorEarningsCsv(rows: CreatorEarningOperatorWithdrawal[]): string {
  const records: Array<Array<string | number>> = [
    ['申请单号', '用户名（Kuran号）', '税前金额', '个税', '实付金额', '开户行', '银行卡号', '状态', '申请时间'],
    ...rows.map((row) => [
      row.requestNo,
      `${row.creatorNickname || '未设置昵称'}（${row.creatorUserCode || '—'}）`,
      row.grossYuan,
      row.incomeTaxYuan,
      row.payoutYuan,
      row.bankBranch,
      row.bankCardNumber,
      statusLabel[row.status],
      row.createdAt,
    ]),
  ];
  return `\uFEFF${records.map((record) => record.map(escapeCsvCell).join(',')).join('\r\n')}`;
}
