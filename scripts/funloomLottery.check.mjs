/**
 * Funloom 抽奖前端闸门 / 转盘角 / 收货校验
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateClientDrawGate,
  formatShanghaiDrawDate,
  isCampaignActive,
  resolveWheelTargetDegrees,
  validateShippingForm,
} from '../src/activities/funloom-lottery-20260731/lib/lotteryClient.ts';

const campaign = {
  id: 1,
  slug: 'funloom-lottery-20260731',
  title: 'Funloom限定抽奖日！100%中奖',
  startsAt: '2026-07-26T16:00:00.000Z',
  endsAt: '2026-08-03T15:59:59.999Z',
  drawLimitType: 'once_per_activity',
  status: 'published',
  onsiteClaimHint: '现场领取',
};

test('formatShanghaiDrawDate_与后端日界一致', () => {
  assert.equal(formatShanghaiDrawDate('2026-07-30T16:30:00.000Z'), '2026-07-31');
});

test('isCampaignActive_活动窗外应 false', () => {
  assert.equal(isCampaignActive(campaign, '2026-07-26T15:00:00.000Z'), false);
  assert.equal(isCampaignActive(campaign, '2026-07-31T04:00:00.000Z'), true);
});

test('evaluateClientDrawGate_未登录应要求登录', () => {
  const gate = evaluateClientDrawGate({
    isLoggedIn: false,
    campaign,
    canDrawFromServer: true,
    now: '2026-07-31T04:00:00.000Z',
  });
  assert.equal(gate.ok, false);
  if (!gate.ok) assert.equal(gate.code, 'login_required');
});

test('evaluateClientDrawGate_活动期内已抽应禁止', () => {
  const gate = evaluateClientDrawGate({
    isLoggedIn: true,
    campaign,
    myDraw: {
      id: 1,
      campaignId: 1,
      userId: 'u1',
      drawDate: '2026-07-31',
      prizeKey: 'points_300',
      fulfillment: 'points',
      pointsAmount: 300,
      pointsGrantStatus: 'granted',
      createdAt: '2026-07-31T04:00:00.000Z',
    },
    now: '2026-08-01T04:00:00.000Z',
  });
  assert.equal(gate.ok, false);
  if (!gate.ok) assert.equal(gate.code, 'already_drawn');
});

test('evaluateClientDrawGate_可抽主路径', () => {
  const gate = evaluateClientDrawGate({
    isLoggedIn: true,
    campaign,
    canDrawFromServer: true,
    myTodayDraw: null,
    myDraw: null,
    now: '2026-07-31T04:00:00.000Z',
  });
  assert.equal(gate.ok, true);
});

test('validateShippingForm_非法手机号应失败', () => {
  assert.equal(
    validateShippingForm({
      recipientName: '张三',
      phone: '12345',
      address: '地址足够长',
    }).ok,
    false,
  );
  assert.equal(
    validateShippingForm({
      recipientName: '张三',
      phone: '13800138000',
      address: '上海市某某路',
    }).ok,
    true,
  );
});

test('resolveWheelTargetDegrees_未知奖回退积分扇区', () => {
  const unknown = resolveWheelTargetDegrees('nope', { spins: 0 });
  const points = resolveWheelTargetDegrees('points_300', { spins: 0 });
  assert.equal(unknown, points);
});

test('resolveWheelTargetDegrees_扇区中线与指针顶部对齐约定', () => {
  // 5 等分：第 0 扇中线 36°，停在指针下需转 360-36=324
  assert.equal(resolveWheelTargetDegrees('console', { spins: 0 }), 324);
  // 第 1 扇中线 108° → 252
  assert.equal(resolveWheelTargetDegrees('mini_handheld', { spins: 0 }), 252);
});

test('readCssRotationDegrees_解析rotate与matrix', async () => {
  const {
    readCssRotationDegrees,
  } = await import('../src/activities/funloom-lottery-20260731/lib/lotteryClient.ts');
  assert.equal(readCssRotationDegrees('none'), 0);
  assert.equal(readCssRotationDegrees('rotate(90deg)'), 90);
  // matrix(cos, sin, -sin, cos, tx, ty) for 90deg: cos0≈0 sin1
  const deg = readCssRotationDegrees('matrix(0, 1, -1, 0, 0, 0)');
  assert.ok(Math.abs(deg - 90) < 0.001);
});

test('resolveLandingRotationFromCurrent_应在当前角基础上再转并落到扇区', async () => {
  const {
    resolveLandingRotationFromCurrent,
    resolveWheelTargetDegrees,
  } = await import('../src/activities/funloom-lottery-20260731/lib/lotteryClient.ts');
  const landMod = resolveWheelTargetDegrees('badge', { spins: 0 });
  const next = resolveLandingRotationFromCurrent(10, 'badge', { spins: 2 });
  assert.ok(next > 10 + 720 - 1);
  assert.equal(((next % 360) + 360) % 360, ((landMod % 360) + 360) % 360);
});

test('resolveRecentWinnersMarqueeSeconds_不足2条不轮播', async () => {
  const { resolveRecentWinnersMarqueeSeconds } = await import(
    '../src/activities/funloom-lottery-20260731/lib/recentWinnersMarquee.ts'
  );
  assert.equal(resolveRecentWinnersMarqueeSeconds(0), null);
  assert.equal(resolveRecentWinnersMarqueeSeconds(1), null);
  assert.equal(resolveRecentWinnersMarqueeSeconds(2), 10);
  assert.equal(resolveRecentWinnersMarqueeSeconds(20), 44);
});
