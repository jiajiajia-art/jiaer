import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const adjustmentModule = await import('../src/utils/adminDiamondAdjustment.ts').catch(() => null);

test('admin diamond adjustment helper exists', () => {
  assert.ok(adjustmentModule, 'expected src/utils/adminDiamondAdjustment.ts to exist');
});

test('validates safe positive integer amounts and prevents negative balances', { skip: !adjustmentModule }, () => {
  assert.equal(adjustmentModule.validateAdminDiamondAmount('25', 'increment', 10), null);
  assert.equal(adjustmentModule.validateAdminDiamondAmount('0', 'increment', 10), 'KK币数量必须为大于 0 的整数');
  assert.equal(adjustmentModule.validateAdminDiamondAmount('1.5', 'increment', 10), 'KK币数量必须为大于 0 的整数');
  assert.equal(
    adjustmentModule.validateAdminDiamondAmount(String(Number.MAX_SAFE_INTEGER + 1), 'increment', 10),
    'KK币数量必须为安全整数',
  );
  assert.equal(
    adjustmentModule.validateAdminDiamondAmount('11', 'decrement', 10),
    '扣减数量不能超过当前余额 10 KK币',
  );
  assert.equal(adjustmentModule.validateAdminDiamondAmount('10', 'decrement', 10), null);
  assert.equal(
    adjustmentModule.validateAdminDiamondAmount('10', 'increment', Number.MAX_SAFE_INTEGER - 5),
    '变更后的KK币余额不能超过安全整数范围',
  );
  assert.equal(adjustmentModule.calculateDiamondBalance(10, 'decrement', 10), 0);
  assert.equal(adjustmentModule.calculateDiamondBalance(10, 'increment', 5), 15);
});

test('admin panel exposes a dedicated KK coin route and manager', () => {
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  const panel = readFileSync(join(root, 'src/page/AdminPanel.tsx'), 'utf8');
  let manager = '';
  try {
    manager = readFileSync(join(root, 'src/components/DiamondAdminManager.tsx'), 'utf8');
  } catch {
    // The RED phase expects this file not to exist yet.
  }

  assert.match(app, /path="\/admin\/diamonds"/);
  assert.match(panel, /DiamondAdminManager/);
  assert.match(panel, />KK币管理</);
  assert.match(manager, /role="dialog"/);
  assert.match(manager, /当前KK币/);
  assert.match(manager, /crypto\.randomUUID/);
});
