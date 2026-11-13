/**
 * 产品 7.1：个人中心精简——去掉更多数据 / 总点赞 / 预览主页 / 消费记录入口。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_7.1_应去掉更多数据总点赞与预览主页', () => {
  const create = read('src/page/Create.tsx');
  assert.doesNotMatch(create, /creatorStatsApi|getCreatorOverviewStats|isStatsExpanded|expandMoreStats/);
  assert.doesNotMatch(create, /creatorStats\.totalLikes|creatorPreviewHomeBtn|handlePreviewHomepage|t\('create\.previewHomepage'\)/);
  assert.doesNotMatch(create, /IoEyeOutline|IoChevronDown|formatPlayDuration/);
  assert.match(create, /stats\.totalCreated/);
  assert.match(create, /create\.pointsStat/);
});

test('ProfileFunctionPanel_7.1_应去掉消费记录入口', () => {
  const panel = read('src/components/Profile/ProfileFunctionPanel.tsx');
  assert.doesNotMatch(panel, /purchaseRecords|\/asset\/details|MdOutlineReceiptLong/);
});
