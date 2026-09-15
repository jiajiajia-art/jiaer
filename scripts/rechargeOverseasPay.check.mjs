/**
 * 钻石充值：顶部互切支付方式后直接下单，不再二次弹窗
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modal = readFileSync(join(root, 'src/components/Purchase/RechargeModal.tsx'), 'utf8');
const api = readFileSync(join(root, 'src/api/pay/payApi.ts'), 'utf8');
const zh = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');

test('RechargeModal_应支持微信与海外支付直接下单', () => {
  assert.match(modal, /startOverseasDiamondPay/);
  assert.match(modal, /startWechatDiamondPay/);
  assert.match(modal, /selectedPayMethod === 'wechat'/);
  assert.match(modal, /createOverseasOrder/);
  assert.match(modal, /payWechat/);
  assert.match(modal, /payOverseas/);
  // 功能注释：顶部已选方式后不再二次确认弹窗
  assert.doesNotMatch(modal, /showPayMethodSheet/);
  assert.doesNotMatch(modal, /pendingDiamondOrder/);
  assert.doesNotMatch(modal, /handleChoosePayMethod/);
});

test('payApi_应提供海外下单接口', () => {
  assert.match(api, /createOverseasOrder/);
  assert.match(api, /\/pay\/overseas\/create/);
});

test('i18n_应有支付方式文案', () => {
  assert.match(zh, /"choosePayMethod":\s*"选择支付方式"/);
  assert.match(zh, /"payWechat":\s*"微信支付"/);
  assert.match(zh, /"payOverseas":\s*"海外支付"/);
});

test('RechargeModal_应按区域默认支付并可互切', () => {
  assert.match(modal, /useGeoRegionStore/);
  assert.match(modal, /defaultPayMethod/);
  assert.match(modal, /setSelectedPayMethod\(defaultPayMethod\)/);
  assert.match(modal, /payMethodToggle/);
  const css = readFileSync(join(root, 'src/components/Purchase/RechargeModal.module.css'), 'utf8');
  assert.match(css, /\.payMethodToggle\s*\{/);
});
