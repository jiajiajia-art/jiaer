/**
 * 功能注释：Linux 部署区分大小写；MetricSummary 必须从 Admin/ 引入，禁止 admin/。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('OperatorPanel_MetricSummary应从Admin目录引入', () => {
  const src = readFileSync(
    join(root, 'src/page/operator/OperatorPanel.tsx'),
    'utf8',
  );
  assert.match(src, /components\/Admin\/MetricSummary\.module\.css/);
  assert.doesNotMatch(src, /components\/admin\/MetricSummary\.module\.css/);
});

test('InteractWithNpcModal_CSS模块大小写与文件名一致', () => {
  const src = readFileSync(
    join(
      root,
      'src/components/GalgameMap/interaction/InteractWithNpcModal.tsx',
    ),
    'utf8',
  );
  assert.match(src, /from '\.\/InteractWithNpc\.module\.css'/);
  assert.doesNotMatch(src, /from '\.\/interactWithNpc\.module\.css'/);
});
