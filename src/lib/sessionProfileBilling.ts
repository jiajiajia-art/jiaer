export type SessionProfileBillingCurrency = 'kk' | 'points';

export type SessionProfileBilling = {
  currency: SessionProfileBillingCurrency;
  chargedUnits: number;
  remainingBalance: number;
};

export type SessionProfileBillingPreview = Pick<SessionProfileBilling, 'currency' | 'chargedUnits'>;

export function sessionProfileCurrencyLabel(currency: SessionProfileBillingCurrency): string {
  return currency === 'kk' ? 'KK币' : '织梦豆';
}

export function getSessionProfileBillingPreview(
  search: string,
  chargedUnits: number,
  trustedPrice?: { currency?: SessionProfileBillingCurrency; estimatedUnits?: number } | null,
): SessionProfileBillingPreview {
  if (
    (trustedPrice?.currency === 'kk' || trustedPrice?.currency === 'points')
    && Number.isFinite(trustedPrice.estimatedUnits)
    && Number(trustedPrice.estimatedUnits) >= 0
  ) {
    return {
      currency: trustedPrice.currency,
      chargedUnits: Number(trustedPrice.estimatedUnits),
    };
  }
  const params = new URLSearchParams(search);
  const currency: SessionProfileBillingCurrency = params.get('testMode') === 'creator'
    ? 'points'
    : 'kk';
  return {
    currency,
    chargedUnits: Number.isFinite(chargedUnits) && chargedUnits >= 0 ? chargedUnits : 0,
  };
}

export function resolveSessionProfileBalancePatch(
  billing?: SessionProfileBilling | null,
): { diamonds: number } | { points: number } | null {
  if (!billing || !Number.isFinite(billing.remainingBalance) || billing.remainingBalance < 0) {
    return null;
  }
  return billing.currency === 'kk'
    ? { diamonds: billing.remainingBalance }
    : { points: billing.remainingBalance };
}

export function formatSessionProfileCharge(
  billing: Pick<SessionProfileBilling, 'currency' | 'chargedUnits'>,
): string {
  const units = Number.isFinite(billing.chargedUnits) ? billing.chargedUnits : 0;
  return `${units} ${sessionProfileCurrencyLabel(billing.currency)}`;
}
