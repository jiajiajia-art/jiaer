import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maxWithdrawableDiamonds,
  isValidWithdrawAmount,
  diamondsToCny,
  canWithdrawByRole,
  checkPayoutProfile,
  buildWithdrawCsv,
  WITHDRAW_DIAMOND_UNIT,
} from '../src/utils/withdrawRules.ts';

test('maxWithdrawableDiamonds floors to unit', () => {
  assert.equal(maxWithdrawableDiamonds(11), 10);
  assert.equal(maxWithdrawableDiamonds(9), 0);
  assert.equal(maxWithdrawableDiamonds(30), 30);
});

test('isValidWithdrawAmount enforces multiples', () => {
  assert.equal(isValidWithdrawAmount(WITHDRAW_DIAMOND_UNIT), true);
  assert.equal(isValidWithdrawAmount(11), false);
  assert.equal(isValidWithdrawAmount(0), false);
});

test('diamondsToCny and role/profile helpers', () => {
  assert.equal(diamondsToCny(20), 2);
  assert.equal(canWithdrawByRole('creator_verified'), true);
  assert.equal(canWithdrawByRole('creator'), false);
  assert.equal(checkPayoutProfile({ realName: 'a', idCard: 'b', bankCard: 'c', bankBranch: 'd' }).complete, true);
  assert.equal(checkPayoutProfile({ realName: 'a' }).complete, false);
});

test('buildWithdrawCsv includes BOM and plaintext fields', () => {
  const csv = buildWithdrawCsv([
    {
      withdrawNo: 'WD1',
      userId: 'u1',
      nickname: '甲,乙',
      phone: '13800138000',
      amount: 10,
      amountCny: 1,
      bankCard: '6222021234567890123',
      bankBranch: '工行',
      realName: '张三',
      idCard: '110101199001011234',
      status: 'pending',
      createdAt: '2026-07-17',
      processedAt: null,
      remark: '',
    },
  ]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('6222021234567890123'));
  assert.ok(csv.includes('"甲,乙"'));
});
