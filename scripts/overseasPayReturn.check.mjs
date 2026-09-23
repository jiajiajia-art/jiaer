/**
 * 海外支付回站：解析 URL、映射订单状态、成功应 Toast
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  interpretOverseasPayStatus,
  parseOverseasPayReturnSearch,
  resolveOverseasPayReturnStatus,
} from '../src/lib/overseasPayReturn.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('parseOverseasPayReturnSearch_应识别回站参数并清掉一次性 query', () => {
  const parsed = parseOverseasPayReturnSearch('?overseasPay=1&outTradeNo=ORD9&foo=1');
  assert.equal(parsed.handled, true);
  if (!parsed.handled) return;
  assert.equal(parsed.outTradeNo, 'ORD9');
  assert.equal(parsed.nextSearch, 'foo=1');
  assert.equal(parseOverseasPayReturnSearch('').handled, false);
});

test('interpretOverseasPayStatus_应区分已支付失败与确认中', () => {
  assert.equal(interpretOverseasPayStatus('paid'), 'paid');
  assert.equal(interpretOverseasPayStatus('failed'), 'failed');
  assert.equal(interpretOverseasPayStatus('pending'), 'pending');
  assert.equal(interpretOverseasPayStatus(''), 'pending');
});

test('resolveOverseasPayReturnStatus_应在 notify 滞后时重试到 paid', async () => {
  let n = 0;
  const status = await resolveOverseasPayReturnStatus(
    'ORD1',
    async () => {
      n += 1;
      return n < 3 ? 'pending' : 'paid';
    },
    { retries: 4, delayMs: 1, sleep: async () => {} },
  );
  assert.equal(status, 'paid');
  assert.equal(n, 3);
});

test('Create_海外回跳应查单Toast而不是只打开充值弹窗', () => {
  const createPage = readFileSync(join(root, 'src/page/Create.tsx'), 'utf8');
  const zh = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');
  assert.match(createPage, /resolveOverseasPayReturnStatus/);
  assert.match(createPage, /toast\.success\(t\('rechargeModal\.overseasPaySuccess'\)\)/);
  assert.match(zh, /"overseasPaySuccess":\s*"支付成功，钻石已到账"/);
});
