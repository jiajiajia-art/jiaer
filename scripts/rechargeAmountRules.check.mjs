/**
 * 充值金额规则：微信整数元 / 海外两位小数与最低 0.01
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OVERSEAS_MIN_AMOUNT,
  WECHAT_MIN_AMOUNT,
  calcDiamondsForPayMethod,
  getPayMethodCurrencySymbol,
  sanitizeAmountInput,
  validateRechargeAmount,
} from '../src/lib/rechargeAmountRules.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('validateRechargeAmount_微信应要求整数元', () => {
  assert.equal(validateRechargeAmount(1, 'wechat').ok, true);
  assert.equal(validateRechargeAmount(0.01, 'wechat').ok, false);
  assert.equal(validateRechargeAmount(0.5, 'wechat').reason, 'notInteger');
  assert.equal(WECHAT_MIN_AMOUNT, 0.1);
});

test('validateRechargeAmount_海外应允许0.01两位小数', () => {
  assert.equal(validateRechargeAmount(0.01, 'overseas').ok, true);
  assert.equal(validateRechargeAmount(1.99, 'overseas').ok, true);
  assert.equal(validateRechargeAmount(0.009, 'overseas').ok, false);
  assert.equal(validateRechargeAmount(1.001, 'overseas').reason, 'tooManyDecimals');
  assert.equal(OVERSEAS_MIN_AMOUNT, 0.01);
});

test('sanitizeAmountInput_海外最多两位小数', () => {
  assert.equal(sanitizeAmountInput('1.23', 'overseas'), '1.23');
  assert.equal(sanitizeAmountInput('1.234', 'overseas'), null);
  assert.equal(sanitizeAmountInput('1.2', 'wechat'), '1.2');
});

test('calcDiamondsForPayMethod_海外自定义最低一钻', () => {
  assert.equal(calcDiamondsForPayMethod(0.01, 'overseas', false), 1);
  assert.equal(calcDiamondsForPayMethod(6, 'overseas', true), 60);
  assert.equal(getPayMethodCurrencySymbol('overseas'), '$');
  assert.equal(getPayMethodCurrencySymbol('wechat'), '¥');
});

test('RechargeModal_应按支付方式切换符号与校验', () => {
  const modal = read('src/components/Purchase/RechargeModal.tsx');
  const zh = read('src/i18n/locales/zh.json');
  const en = read('src/i18n/locales/en.json');
  assert.match(modal, /selectedPayMethod/);
  assert.match(modal, /\(\['wechat', 'overseas'\] as const\)/);
  assert.match(modal, /payMethodToggle/);
  assert.match(modal, /currencySymbol/);
  assert.match(modal, /amountMaxTwoDecimals/);
  assert.match(zh, /"payNow":\s*"\{\{symbol\}\}\{\{amount\}\}立即支付"/);
  assert.match(en, /"payNow":\s*"\{\{symbol\}\}\{\{amount\}\} Pay Now"/);
  assert.match(zh, /amountMaxTwoDecimals/);
  assert.match(en, /amountMaxTwoDecimals/);
});
