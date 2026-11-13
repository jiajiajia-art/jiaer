/**
 * 今日可赚织梦豆：组件契约保留；Create 精简后不再挂载该面板（入口迁出/下线）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_今日可赚织梦豆应在邀请下方且迁出旧入口', () => {
  const create = read('src/page/Create.tsx');
  const panel = read('src/components/Profile/ProfileFunctionPanel.tsx');
  const zh = read('src/i18n/locales/zh.json');

  // 功能注释：个人中心精简后 Create 不再挂 TodayEarnPointsPanel
  assert.doesNotMatch(create, /TodayEarnPointsPanel/);
  assert.match(create, /<InviteCampaignCard\s*\/>\s*<ProfileFunctionPanel\s*\/>/);
  assert.doesNotMatch(create, /className=\{styles\.worksSection\}[\s\S]*<ProfileFunctionPanel/);
  assert.doesNotMatch(create, /setIsCheckInModalOpen\(true\)/);
  assert.doesNotMatch(panel, /profile\.dailyTasks/);
  assert.doesNotMatch(panel, /profile\.watchAd/);
  assert.doesNotMatch(panel, /DailyTasksModal|isDailyTaskModalOpen/);

  // 功能注释：若组件文件仍在仓库，保留文案与样式契约，避免回归成旧入口
  const todayPath = join(root, 'src/components/Profile/TodayEarnPointsPanel.tsx');
  if (existsSync(todayPath)) {
    const today = read('src/components/Profile/TodayEarnPointsPanel.tsx');
    const todayCss = read('src/components/Profile/TodayEarnPointsPanel.module.css');
    assert.match(today, /create\.todayEarnPointsTitle/);
    assert.match(zh, /"todayEarnPointsTitle":\s*"今日可赚织梦豆"/);
    assert.match(todayCss, /\.cardChevron\s*\{/);
  }
});
