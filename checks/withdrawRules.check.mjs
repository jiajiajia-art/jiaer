import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maxWithdrawableDiamonds,
  isValidWithdrawAmount,
  diamondsToCny,
  canWithdrawByRole,
  checkPayoutProfile,
  buildWithdrawCsv,
  shouldShowWithdrawRecordsViewAll,
  normalizeWithdrawListPage,
  clampWithdrawListPageSize,
  withdrawListTotalPages,
  WITHDRAW_DIAMOND_UNIT,
  WITHDRAW_MIN_DIAMONDS,
  WITHDRAW_MODAL_RECORD_LIMIT,
  WITHDRAW_RECORDS_PAGE_SIZE,
  WITHDRAW_LIST_PAGE_SIZE_MAX,
} from '../src/utils/withdrawRules.ts';

test('maxWithdrawableDiamonds floors to unit and respects min 1000', () => {
  assert.equal(maxWithdrawableDiamonds(1001), 1000);
  assert.equal(maxWithdrawableDiamonds(999), 0);
  assert.equal(maxWithdrawableDiamonds(11), 0);
  assert.equal(maxWithdrawableDiamonds(2000), 2000);
});

test('isValidWithdrawAmount enforces min and multiples', () => {
  assert.equal(isValidWithdrawAmount(WITHDRAW_MIN_DIAMONDS), true);
  assert.equal(isValidWithdrawAmount(WITHDRAW_DIAMOND_UNIT), false);
  assert.equal(isValidWithdrawAmount(1001), false);
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

test('shouldShowWithdrawRecordsViewAll_仅当总数超过弹窗上限', () => {
  assert.equal(WITHDRAW_MODAL_RECORD_LIMIT, 5);
  assert.equal(shouldShowWithdrawRecordsViewAll(0), false);
  assert.equal(shouldShowWithdrawRecordsViewAll(5), false);
  assert.equal(shouldShowWithdrawRecordsViewAll(6), true);
  assert.equal(shouldShowWithdrawRecordsViewAll(100), true);
  assert.equal(shouldShowWithdrawRecordsViewAll(NaN), false);
  assert.equal(shouldShowWithdrawRecordsViewAll(-1), false);
});

test('normalizeWithdrawListPage_非法页码回退为1', () => {
  assert.equal(normalizeWithdrawListPage(1), 1);
  assert.equal(normalizeWithdrawListPage(3), 3);
  assert.equal(normalizeWithdrawListPage(0), 1);
  assert.equal(normalizeWithdrawListPage(-2), 1);
  assert.equal(normalizeWithdrawListPage(1.5), 1);
});

test('clampWithdrawListPageSize_默认20且上限100', () => {
  assert.equal(WITHDRAW_RECORDS_PAGE_SIZE, 20);
  assert.equal(WITHDRAW_LIST_PAGE_SIZE_MAX, 100);
  assert.equal(clampWithdrawListPageSize(20), 20);
  assert.equal(clampWithdrawListPageSize(0), 20);
  assert.equal(clampWithdrawListPageSize(999), 100);
  assert.equal(clampWithdrawListPageSize(50), 50);
});

test('withdrawListTotalPages_与分页语义对齐', () => {
  assert.equal(withdrawListTotalPages(0, 20), 1);
  assert.equal(withdrawListTotalPages(10, 20), 1);
  assert.equal(withdrawListTotalPages(21, 20), 2);
  assert.equal(withdrawListTotalPages(100, 20), 5);
  assert.equal(withdrawListTotalPages(101, 20), 6);
});
