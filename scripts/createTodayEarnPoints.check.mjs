/**
 * Create 页：今日可赚积分模块在邀请卡片下方；签到/每日任务/观看广告从原入口迁出。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_今日可赚积分应在邀请下方且迁出旧入口', () => {
  const create = read('src/page/Create.tsx');
  const panel = read('src/components/Profile/ProfileFunctionPanel.tsx');
  const today = read('src/components/Profile/TodayEarnPointsPanel.tsx');
  const zh = read('src/i18n/locales/zh.json');

  assert.match(create, /<InviteCampaignCard\s*\/>\s*<TodayEarnPointsPanel\s*\/>\s*<ProfileFunctionPanel\s*\/>/);
  assert.doesNotMatch(create, /className=\{styles\.worksSection\}[\s\S]*<ProfileFunctionPanel/);
  assert.match(today, /create\.todayEarnPointsTitle/);
  assert.match(today, /setIsCheckInOpen\(true\)/);
  assert.match(today, /DailyTasksModal/);
  assert.match(today, /profile\.adFeatureDeveloping|handleWatchAd/);
  assert.match(zh, /"todayEarnPointsTitle":\s*"今日可赚积分"/);
  assert.match(zh, /"todayEarnCheckInHint":\s*"每日领积分"/);
  assert.match(zh, /"todayEarnDailyTasksHint":\s*"做任务领积分"/);
  assert.match(zh, /"todayEarnWatchAdHint":\s*"看广告领奖"/);
  assert.match(today, /create\.todayEarnCheckInHint/);

  const todayCss = read('src/components/Profile/TodayEarnPointsPanel.module.css');
  const chevron = todayCss.match(/\.cardChevron\s*\{[^}]*\}/);
  assert.ok(chevron, 'missing .cardChevron');
  assert.doesNotMatch(chevron[0], /border-radius:\s*50%/);
  assert.doesNotMatch(chevron[0], /background:\s*rgba/);
  assert.match(todayCss, /@media \(max-width:\s*768px\)[\s\S]*?\.cardChevron\s*\{[\s\S]*?display:\s*none/);

  assert.doesNotMatch(create, /setIsCheckInModalOpen\(true\)/);
  assert.doesNotMatch(panel, /profile\.dailyTasks/);
  assert.doesNotMatch(panel, /profile\.watchAd/);
  assert.doesNotMatch(panel, /DailyTasksModal|isDailyTaskModalOpen/);
});
