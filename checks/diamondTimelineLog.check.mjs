import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDiamondTimelineLog,
  formatDiamondTimelineTime,
} from '../src/utils/diamondTimelineLog.ts';

test('formatDiamondTimelineLog translates exchange_to_points', () => {
  const text = formatDiamondTimelineLog({
    activityType: 'exchange_to_points',
    diamonds: -2,
    description: JSON.stringify({ exchangeRate: '1:10', diamondsSpent: 2, pointsEarned: 20 }),
  });
  assert.equal(text, '兑换织梦豆（消耗 2 KK币，获得 20 织梦豆）');
});

test('formatDiamondTimelineLog translates revenue_share with settle id', () => {
  const text = formatDiamondTimelineLog({
    activityType: 'revenue_share',
    diamonds: 30,
    description: JSON.stringify({ fileIds: ['a', 'b'] }),
    businessId: 'settle_1782053110448',
  });
  assert.match(text, /创作者收益分成/);
  assert.match(text, /获得 30 钻/);
  assert.match(text, /settle_1782053110448/);
  assert.match(text, /2 个作品/);
});

test('formatDiamondTimelineLog translates custom_if_pay and withdraw', () => {
  assert.match(
    formatDiamondTimelineLog({
      activityType: 'custom_if_pay',
      diamonds: -30,
      description: 'abc',
      businessId: '870185243e27823b39a2a891ca668471',
    }),
    /自定义应用消费/,
  );
  assert.match(
    formatDiamondTimelineLog({
      activityType: 'withdraw_apply',
      diamonds: -10,
      businessId: 'WD123',
    }),
    /提现申请扣减/,
  );
});

test('formatDiamondTimelineTime strips ISO noise', () => {
  assert.equal(formatDiamondTimelineTime('2026-06-17T04:05:23.000Z'), '2026-06-17 04:05:23');
});
