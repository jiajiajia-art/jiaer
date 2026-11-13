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

test('history API exposes separate point and diamond endpoints with page size ten', () => {
  const source = read('src/api/admin/adminManualAdjustmentsApi.ts');
  assert.match(source, /ADMIN_MANUAL_ADJUSTMENT_PAGE_SIZE\s*=\s*10/);
  assert.match(source, /\/admin\/points\/manual-adjustments/);
  assert.match(source, /\/admin\/diamonds\/manual-adjustments/);
});

test('shared history table renders exactly the requested five columns and paging controls', () => {
  const source = read('src/components/AdminManualAdjustmentHistory.tsx');
  // 已改用 antd Table + Pagination：列定义里的 title 顺序即表头
  const headers = [...source.matchAll(/title:\s*'([^']+)'/g)].map((match) => match[1].trim());
  assert.deepEqual(headers, ['操作人', '变更用户', '变更情况', '备注', '操作时间']);
  assert.match(source, /<Pagination/);
  assert.match(source, /重新加载/);
  assert.match(source, /emptyText:\s*'暂无特殊变更记录'/);
});

test('both managers mount the shared history and refresh it after successful adjustment', () => {
  const pointManager = read('src/components/PointsAdminManager.tsx');
  const diamondManager = read('src/components/DiamondAdminManager.tsx');

  for (const [source, currency] of [[pointManager, 'points'], [diamondManager, 'diamonds']]) {
    assert.match(source, /AdminManualAdjustmentHistory/);
    assert.match(source, new RegExp(`currency="${currency}"`));
    assert.match(source, /setHistoryRefreshKey\(\(value\)\s*=>\s*value\s*\+\s*1\)/);
  }
});
