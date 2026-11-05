/**
 * 统一充值中心：地区默认支付、KK币/会员互切、二次确认与海外收银台。
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

test('RechargeModal_应支持微信与海外支付并在确认后下单', () => {
  assert.match(modal, /startOverseasPay/);
  assert.match(modal, /startWechatPay/);
  assert.match(modal, /pendingPayment\.payMethod === 'wechat'/);
  assert.match(modal, /createOverseasOrder/);
  assert.match(modal, /payWechat/);
  assert.match(modal, /payOverseas/);
  assert.doesNotMatch(modal, /showPayMethodSheet/);
  assert.doesNotMatch(modal, /handleChoosePayMethod/);
  assert.match(modal, /pendingPayment/);
  assert.match(modal, /confirmPayment/);
  assert.match(modal, /confirmationOverlay/);
  assert.match(modal, /cancelPaymentConfirmation/);
});

test('payApi_应提供海外下单接口', () => {
  assert.match(api, /createOverseasOrder/);
  assert.match(api, /\/pay\/overseas\/create/);
  assert.match(api, /returnWebBase/);
  assert.match(api, /window\.location\.origin/);
  assert.match(api, /X-Return-Web-Base/);
});

test('RechargeModal_有payUrl即使缺returnWebBase也须跳转收银台', () => {
  // 功能注释：www.kurangames.cn 曾被后端 sanitize 拒掉，前端硬失败会导致「正在跳转」后立刻报错
  assert.match(modal, /still redirect/);
  assert.match(modal, /window\.location\.assign\(data\.data\.payUrl\)/);
  assert.doesNotMatch(
    modal,
    /if \(!data\.data\.returnWebBase\) \{[\s\S]*?toast\.error\(t\('rechargeModal\.paymentRequestFailed'\)\);[\s\S]*?return;/,
  );
});

test('Create_海外回跳应查单并提示结果', () => {
  const createPage = readFileSync(join(root, 'src/page/Create.tsx'), 'utf8');
  assert.match(createPage, /overseasPay/);
  assert.match(createPage, /resolveOverseasPayReturnStatus/);
  assert.match(createPage, /overseasPaySuccess/);
});

test('i18n_应有支付方式文案', () => {
  assert.match(zh, /"choosePayMethod":\s*"选择支付方式"/);
  assert.match(zh, /"payWechat":\s*"微信支付"/);
  assert.match(zh, /"payOverseas":\s*"海外支付"/);
});

test('RechargeModal_应按IP地区选择默认支付并允许手动切换', () => {
  assert.match(modal, /useGeoRegionStore/);
  assert.match(modal, /region\.defaultPayMethod/);
  assert.match(modal, /region\.payRegion/);
  assert.match(modal, /\(\['wechat', 'overseas'\] as const\)/);
  assert.match(modal, /setSelectedPayMethod\(region\.defaultPayMethod\)/);
  assert.match(modal, /payMethodToggle/);
  const css = readFileSync(join(root, 'src/components/Purchase/RechargeModal.module.css'), 'utf8');
  assert.match(css, /\.payMethodToggle\s*\{/);
});

test('RechargeModal_两个入口只决定初始页签且弹窗内可自由切换', () => {
  assert.match(modal, /className=\{styles\.rechargeTabs\}/);
  assert.match(modal, /setRechargeTab\('diamonds'\)/);
  assert.match(modal, /setRechargeTab\('membership'\)/);
  assert.doesNotMatch(modal, /if \(isOpen && fixedTab && rechargeTab !== fixedTab\)/);
  assert.match(modal, /setRechargeTab\('diamonds'\);[^]*handleFixedAmountClick\(rechargePlans\[0\]\)/);
});

test('RechargeModal_会员卡应能选择海外支付并复用统一下单函数', () => {
  assert.match(modal, /orderType:\s*'subscription'/);
  assert.match(modal, /selectedPayMethod/);
  assert.match(modal, /startOverseasPay\(confirmed\.orderData\)/);
  assert.match(modal, /startWechatPay\(confirmed\.orderData\)/);
});

test('RechargeModal_应展示地区、订单摘要并适配移动端确认层', () => {
  assert.match(modal, /currentPaymentRegion/);
  assert.match(modal, /orderSummary/);
  const css = readFileSync(join(root, 'src/components/Purchase/RechargeModal.module.css'), 'utf8');
  assert.match(css, /\.regionSummary\s*\{/);
  assert.match(css, /\.rechargeTabs\s*\{/);
  assert.match(css, /\.orderSummary\s*\{/);
  assert.match(css, /\.confirmationOverlay\s*\{/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[^]*\.confirmationPanel/s);
});
