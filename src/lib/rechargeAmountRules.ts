/**
 * 功能注释：充值金额校验随支付方式变化（微信整数元 / 海外两位小数）。
 */
import type { DefaultPayMethod } from './geoRegionPolicy.ts';
import { calcOverseasCustomDiamonds, calcWechatCustomDiamonds } from './geoRegionPolicy.ts';

export const WECHAT_MIN_AMOUNT = 0.1;
export const OVERSEAS_MIN_AMOUNT = 0.01;

export function getPayMethodMinAmount(method: DefaultPayMethod): number {
  return method === 'overseas' ? OVERSEAS_MIN_AMOUNT : WECHAT_MIN_AMOUNT;
}

export function getPayMethodCurrencySymbol(method: DefaultPayMethod): string {
  return method === 'overseas' ? '$' : '¥';
}

export function getPayMethodMaxDecimals(method: DefaultPayMethod): number {
  return method === 'overseas' ? 2 : method === 'alipay' ? 0 : 1;
}

/** 功能注释：过滤输入；返回规范化字符串或 null（拒绝本次按键） */
export function sanitizeAmountInput(
  raw: string,
  method: DefaultPayMethod,
): string | null {
  let value = raw.replace(/[^\d.]/g, '');
  const parts = value.split('.');
  if (parts.length > 2) return null;
  const maxDecimals = getPayMethodMaxDecimals(method);
  if (parts.length === 2 && parts[1].length > maxDecimals) return null;
  // 微信历史体验：0.1 仍可输入（最低一角）
  if (method === 'wechat' && parts.length === 2 && parts[0] === '0' && parts[1] === '1') {
    value = '0.1';
  }
  return value;
}

export type AmountValidation =
  | { ok: true }
  | { ok: false; reason: 'tooLow' | 'notInteger' | 'tooManyDecimals' };

export function validateRechargeAmount(
  amount: number,
  method: DefaultPayMethod,
): AmountValidation {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'tooLow' };
  }
  const min = getPayMethodMinAmount(method);
  if (amount < min) {
    return { ok: false, reason: 'tooLow' };
  }
  if (method !== 'overseas') {
    if (!Number.isInteger(amount)) {
      return { ok: false, reason: 'notInteger' };
    }
    return { ok: true };
  }
  const scaled = amount * 100;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    return { ok: false, reason: 'tooManyDecimals' };
  }
  return { ok: true };
}

export function calcDiamondsForPayMethod(
  amount: number,
  method: DefaultPayMethod,
  isFixedPlan: boolean,
): number {
  if (isFixedPlan) {
    return Math.floor(amount * 10);
  }
  return method === 'overseas'
    ? calcOverseasCustomDiamonds(amount)
    : calcWechatCustomDiamonds(amount);
}

export function isAmountReadyToPay(
  amount: number | null,
  method: DefaultPayMethod,
): boolean {
  if (amount == null) return false;
  return validateRechargeAmount(amount, method).ok;
}
