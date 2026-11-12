/**
 * Create 页：今日可赚织梦豆模块在邀请卡片下方；签到/每日任务/观看广告从原入口迁出。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

// 「今日可赚织梦豆」已从个人中心卡片迁到独立页 /points/earn（签到 / 每日任务在页内），
// 个人中心只保留入口按钮；旧 TodayEarnPointsPanel 组件已无引用
test('Create_赚织梦豆入口跳独立页且功能面板不再挂旧入口', () => {
  const app = read('src/App.tsx');
  const create = read('src/page/Create.tsx');
  const panel = read('src/components/Profile/ProfileFunctionPanel.tsx');
  const earn = read('src/page/EarnPoints.tsx');

  assert.match(app, /path="\/points\/earn"/);
  assert.match(create, /navigate\('\/points\/earn'\)/);
  assert.match(create, /create\.accountEarnPoints/);
  assert.doesNotMatch(create, /<TodayEarnPointsPanel/);
  assert.match(earn, /<DailyTasksModal/);
  assert.doesNotMatch(create, /setIsCheckInModalOpen\(true\)/);
  assert.doesNotMatch(panel, /profile\.dailyTasks/);
  assert.doesNotMatch(panel, /profile\.watchAd/);
  assert.doesNotMatch(panel, /DailyTasksModal|isDailyTaskModalOpen/);
});
