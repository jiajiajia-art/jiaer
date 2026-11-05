import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  try {
    return readFileSync(join(root, relativePath), 'utf8');
  } catch {
    return '';
  }
}

const source = read('src/api/creatorEarnings/operatorCreatorEarningsApi.ts');

test('operator creator earnings API exposes withdrawal list and detail contracts', () => {
  assert.match(source, /listWithdrawals\s*:/);
  assert.match(source, /getWithdrawal\s*:/);
  assert.match(source, /\/operator\/creator-earnings\/withdrawals/);
  assert.match(source, /status\?:\s*CreatorEarningWithdrawalStatus/);
  assert.match(source, /limit\?:\s*number/);
  assert.match(source, /offset\?:\s*number/);
  assert.match(source, /items:\s*CreatorEarningWithdrawalItem\[\]/);
});

test('operator withdrawal list and detail types match backend-mapped creator identity fields', () => {
  const item = source.match(/export interface CreatorEarningOperatorWithdrawal\s*\{[\s\S]*?\n\}/)?.[0] || '';
  for (const field of [
    'creatorUserId', 'creatorUserCode', 'creatorNickname', 'phoneNumber', 'realName', 'idCard',
    'grossCents', 'grossYuan', 'payoutCents', 'payoutYuan',
    'incomeTaxCents', 'incomeTaxYuan', 'createdAt', 'updatedAt', 'status', 'remark',
  ]) assert.match(item, new RegExp(`${field}\\s*:`), field);

  const detailItem = source.match(/export interface CreatorEarningWithdrawalItem\s*\{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(detailItem, /fileId:\s*string/);
  assert.match(detailItem, /gameType\?:\s*string\s*\|\s*null/);
  assert.match(detailItem, /gameTitle\?:\s*string\s*\|\s*null/);
  assert.match(detailItem, /grossMicroYuan:\s*string/);
  assert.match(detailItem, /grossYuan:\s*string/);
});

test('operator withdrawal actions send the backend-specific remark and reason payloads', () => {
  assert.match(source, /approveWithdrawal\s*:/);
  assert.match(source, /rejectWithdrawal\s*:/);
  assert.match(source, /markWithdrawalPaid\s*:/);
  assert.match(source, /\/approve['"]?,\s*\{\s*remark\s*\}/);
  assert.match(source, /\/reject['"]?,\s*\{\s*reason\s*\}/);
  assert.match(source, /\/paid['"]?,\s*\{\s*remark\s*\}/);
});

test('operator API uses shared axios client and preserves AxiosResponse envelope', () => {
  assert.match(source, /import\s+\{\s*api\s*\}\s+from\s+['"]\.\.\/base['"]/);
  assert.match(source, /api\.get<ApiResponse<CreatorEarningOperatorWithdrawal\[\]>>/);
  assert.match(source, /api\.post<ApiResponse<unknown>>/);
});
