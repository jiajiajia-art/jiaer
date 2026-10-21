export type AdminDiamondChangeType = 'increment' | 'decrement';
export type KkValidityType = 'permanent' | 'limited';

export function parseAdminDiamondAmount(value: string): number {
  return Number(String(value || '').trim());
}

export function validateAdminDiamondAmount(
  value: string,
  changeType: AdminDiamondChangeType,
  currentDiamonds: number,
): string | null {
  const amount = parseAdminDiamondAmount(value);
  const normalized = String(value || '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || amount <= 0) {
    return 'KK币数量必须大于 0 且最多保留两位小数';
  }
  const amountMinor = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountMinor)) {
    return 'KK币数量超过可处理范围';
  }
  const currentMinor = Math.round(Number(currentDiamonds) * 100);
  if (
    changeType === 'increment'
    && (!Number.isSafeInteger(currentMinor) || currentMinor > Number.MAX_SAFE_INTEGER - amountMinor)
  ) {
    return '变更后的KK币余额不能超过安全整数范围';
  }
  if (changeType === 'decrement' && amount > currentDiamonds) {
    return `扣减数量不能超过当前余额 ${currentDiamonds} KK币`;
  }
  return null;
}

export function validateAdminKkValidity(
  validityType: KkValidityType,
  validDays?: number,
): string | null {
  if (validityType === 'permanent') return null;
  if (!Number.isInteger(validDays) || Number(validDays) < 1 || Number(validDays) > 3650) {
    return '限时KK币有效期必须为 1 至 3650 天';
  }
  return null;
}

export function calculateDiamondBalance(
  currentDiamonds: number,
  changeType: AdminDiamondChangeType,
  amount: number,
): number {
  const currentMinor = Math.round(currentDiamonds * 100);
  const amountMinor = Math.round(amount * 100);
  return (changeType === 'increment'
    ? currentMinor + amountMinor
    : currentMinor - amountMinor) / 100;
}
