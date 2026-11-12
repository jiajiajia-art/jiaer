import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCreatorEarningWithdrawalMessageView,
  resolveMessageListSection,
} from '../src/lib/messageCenterView.ts';

// 展示按本地时区格式化；固定为北京时间，避免在 UTC 的 CI / 沙箱里结果不同
process.env.TZ = 'Asia/Shanghai';

test('creator earning withdrawal notifications belong to system messages', () => {
  assert.equal(resolveMessageListSection('creator_earning_withdrawal'), 'system');
});

test('paid notification shows tax-before earnings and actual payout', () => {
  assert.deepEqual(buildCreatorEarningWithdrawalMessageView({
    notificationType: 'paid',
    grossCents: 46_530,
    payoutCents: 37_224,
    rejectionReason: null,
  }), {
    title: '创作者收益已打款',
    preview: '税前金额 ¥465.30，实际到账 ¥372.24',
    detail: '本次提现税前金额 ¥465.30，扣除个人所得税后实际到账 ¥372.24。',
  });
});

test('rejected notification shows tax-before earnings and rejection reason', () => {
  assert.deepEqual(buildCreatorEarningWithdrawalMessageView({
    notificationType: 'rejected',
    grossCents: 9_999,
    payoutCents: 7_999,
    rejectionReason: '银行卡信息不完整',
  }), {
    title: '创作者收益提现已驳回',
    preview: '税前金额 ¥99.99，原因：银行卡信息不完整',
    detail: '本次提现税前金额 ¥99.99。驳回原因：银行卡信息不完整',
  });
});
