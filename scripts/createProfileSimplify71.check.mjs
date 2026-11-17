/**
 * 产品 7.1：个人中心精简——去掉更多数据 / 总点赞 / 消费记录入口。
 * 头像下保留「查看主页」进本人创作者主页（/account/:userCode）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_7.1_应去掉更多数据总点赞并保留查看主页', () => {
  const create = read('src/page/Create.tsx');
  assert.doesNotMatch(create, /creatorStatsApi|getCreatorOverviewStats|isStatsExpanded|expandMoreStats/);
  assert.doesNotMatch(create, /creatorStats\.totalLikes|creatorPreviewHomeBtn|handlePreviewHomepage/);
  assert.doesNotMatch(create, /IoEyeOutline|IoChevronDown|formatPlayDuration/);
  assert.match(create, /stats\.totalCreated/);
  assert.match(create, /create\.pointsStat/);
  // 功能注释：头像下方「查看主页」进本人 AccountHomepage
  assert.match(create, /handleOpenOwnHomepage/);
  assert.match(create, /creatorViewHomepageBtn/);
  assert.match(create, /t\('create\.previewHomepage'\)/);
});

test('ProfileFunctionPanel_7.1_应去掉消费记录入口', () => {
  const panel = read('src/components/Profile/ProfileFunctionPanel.tsx');
  assert.doesNotMatch(panel, /purchaseRecords|\/asset\/details|MdOutlineReceiptLong/);
});
