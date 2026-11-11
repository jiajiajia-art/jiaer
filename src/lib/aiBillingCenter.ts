export function decimalToX10000(value: string | number): number {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d+)(?:\.(\d{0,4}))?$/);
  if (!match) throw new Error('请输入最多四位小数的非负数');
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] || '').padEnd(4, '0'));
  const result = whole * 10000n + fraction;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('数值过大');
  return Number(result);
}

export function x10000ToDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const amount = BigInt(value);
  const whole = amount / 10000n;
  const fraction = String(amount % 10000n).padStart(4, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function getBillingVersionDisplayStatus(
  version: {
    status: 'draft' | 'published';
    activationMode: 'immediate' | 'scheduled' | null;
    effectiveAt: string | null;
  },
  now = new Date(),
): 'draft' | 'scheduled' | 'published' {
  if (version.status === 'draft') return 'draft';
  if (
    version.activationMode === 'scheduled'
    && version.effectiveAt
    && Date.parse(version.effectiveAt) > now.getTime()
  ) return 'scheduled';
  return 'published';
}
