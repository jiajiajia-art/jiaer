export type AdminDiamondChangeType = 'increment' | 'decrement';

export function parseAdminDiamondAmount(value: string): number {
  return Number(String(value || '').trim());
}

export function validateAdminDiamondAmount(
  value: string,
  changeType: AdminDiamondChangeType,
  currentDiamonds: number,
): string | null {
  const amount = parseAdminDiamondAmount(value);
  if (!Number.isInteger(amount) || amount <= 0) {
    return 'KK币数量必须为大于 0 的整数';
  }
  if (!Number.isSafeInteger(amount)) {
    return 'KK币数量必须为安全整数';
  }
  if (
    changeType === 'increment'
    && (!Number.isSafeInteger(currentDiamonds) || currentDiamonds > Number.MAX_SAFE_INTEGER - amount)
  ) {
    return '变更后的KK币余额不能超过安全整数范围';
  }
  if (changeType === 'decrement' && amount > currentDiamonds) {
    return `扣减数量不能超过当前余额 ${currentDiamonds} KK币`;
  }
  return null;
}

export function calculateDiamondBalance(
  currentDiamonds: number,
  changeType: AdminDiamondChangeType,
  amount: number,
): number {
  return changeType === 'increment'
    ? currentDiamonds + amount
    : currentDiamonds - amount;
}
