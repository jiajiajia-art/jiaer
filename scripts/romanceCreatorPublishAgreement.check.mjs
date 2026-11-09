/**
 * 发布前协议弹窗：两份 md、默认不勾、版本号可落库
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('CreatorPublishAgreementModal_双勾选与版本号', () => {
  const src = readFileSync(
    join(root, 'src/components/creator/CreatorPublishAgreementModal.tsx'),
    'utf8',
  );
  assert.match(src, /CREATOR_AGREEMENT_VERSION = '1\.0\.0'/);
  assert.match(src, /WORK_REVIEW_STANDARDS_VERSION = '1\.0\.0'/);
  assert.match(src, /agreeCreator/);
  assert.match(src, /agreeStandards/);
  assert.match(src, /legal\/creator-agreement/);
  assert.match(src, /legal\/work-review-standards/);
  assert.match(src, /同意并提交/);
  assert.match(src, /请先勾选/);
  assert.match(src, /useState\(false\)/);
});
