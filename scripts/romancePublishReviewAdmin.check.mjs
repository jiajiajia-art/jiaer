/**
 * Romance 发布审核后台：fileId/引擎展示、预览表单/游戏、结构化驳回、审核标准入口
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('PublishReviewAdminManager_展示fileId引擎并提供预览与标准入口', () => {
  const src = readFileSync(join(root, 'src/components/admin/PublishReviewAdminManager.tsx'), 'utf8');
  assert.match(src, /fileId \/ 引擎/);
  assert.match(src, /预览表单/);
  assert.match(src, /预览游戏/);
  assert.match(src, /reviewPreview=1/);
  assert.match(src, /getRomancePendingReviewContent/);
  assert.match(src, /PUBLISH_REJECT_REASON_OPTIONS/);
  assert.match(src, /work-review-standards/);
  assert.match(src, /只读/);
});

test('adminReportApi_待审Romance正文与结构化驳回', () => {
  const api = readFileSync(join(root, 'src/api/admin/adminReportApi.ts'), 'utf8');
  assert.match(api, /getRomancePendingReviewContent/);
  assert.match(api, /publish-queue\/\$\{encodeURIComponent\(fileId\)\}\/romance-content/);
  assert.match(api, /rejectReasons/);
  assert.match(api, /PUBLISH_REJECT_REASON_OPTIONS/);
  assert.match(api, /世界观不完整/);
  assert.match(api, /背景图不完整/);
  assert.match(api, /无法完整游玩/);
  assert.match(api, /违规或其他/);
  assert.match(api, /engine\?:/);
});

test('LegalDocument_支持创作者协议与审核标准', () => {
  const legal = readFileSync(join(root, 'src/page/LegalDocument.tsx'), 'utf8');
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(legal, /creator-agreement/);
  assert.match(legal, /work-review-standards/);
  assert.match(legal, /creator-agreement-zh\.md/);
  assert.match(legal, /work-review-standards-zh\.md/);
  assert.match(app, /path="\/legal\/creator-agreement"/);
  assert.match(app, /path="\/legal\/work-review-standards"/);
  const agreement = readFileSync(join(root, 'src/content/legal/creator-agreement-zh.md'), 'utf8');
  const standards = readFileSync(join(root, 'src/content/legal/work-review-standards-zh.md'), 'utf8');
  assert.match(agreement, /版本号：1\.0\.0/);
  assert.match(standards, /版本号：1\.0\.0/);
});
