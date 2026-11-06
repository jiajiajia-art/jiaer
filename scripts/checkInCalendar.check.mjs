import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const calendarModule = await import('../src/utils/checkInCalendar.ts').catch(() => null);
const modalSource = readFileSync(join(root, 'src/components/CheckInModal.tsx'), 'utf8');
const modalStyles = readFileSync(join(root, 'src/components/CheckInModal.module.css'), 'utf8');
const profileSource = readFileSync(join(root, 'src/components/Profile/TodayEarnPointsPanel.tsx'), 'utf8');
const dailyTasksSource = readFileSync(join(root, 'src/components/Profile/DailyTasksModal.tsx'), 'utf8');
const dailyTasksStyles = readFileSync(join(root, 'src/page/Profile.module.css'), 'utf8');
const dailyTaskStoreSource = readFileSync(join(root, 'src/store/dailyTaskStore.ts'), 'utf8');
const authApiSource = readFileSync(join(root, 'src/api/account/authApi.ts'), 'utf8');
const dailyTaskApiSource = readFileSync(join(root, 'src/api/statistics/dailyTaskApi.ts'), 'utf8');
const assetDetailsSource = readFileSync(join(root, 'src/page/AssetDetails.tsx'), 'utf8');
const zhLocale = JSON.parse(readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8'));
const enLocale = JSON.parse(readFileSync(join(root, 'src/i18n/locales/en.json'), 'utf8'));

test('签到日历工具模块已建立', () => {
  assert.ok(calendarModule, 'src/utils/checkInCalendar.ts 尚未实现');
});

test('周一到周日直接使用后端 UTC 星期，不做浏览器本地日期推算', { skip: !calendarModule }, () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map(calendarModule.getWeekdayKey),
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  );
  assert.equal(calendarModule.formatUtcMonthDay('2026-10-08'), '10.08');
});

test('月历按周一为首列补空格，并保留后端状态', { skip: !calendarModule }, () => {
  const days = [
    { date: '2026-10-01', weekday: 4, dayOfMonth: 1, state: 'signed' },
    { date: '2026-10-02', weekday: 5, dayOfMonth: 2, state: 'missed' },
  ];
  const grid = calendarModule.buildMonthGrid(days);
  assert.equal(grid.length, 5);
  assert.deepEqual(grid.slice(0, 3), [null, null, null]);
  assert.equal(grid[3].state, 'signed');
  assert.equal(grid[4].state, 'missed');
});

test('月奖励进度达标后锁定为门槛，未达标使用当前连续天数', { skip: !calendarModule }, () => {
  assert.equal(calendarModule.getMonthProgress({
    targetDays: 30,
    currentConsecutiveDays: 18,
    progressDays: 18,
    bonusRewarded: false,
  }), 18);
  assert.equal(calendarModule.getMonthProgress({
    targetDays: 28,
    currentConsecutiveDays: 0,
    progressDays: 28,
    bonusRewarded: true,
  }), 28);
});

test('首页与个人中心签到成功后均保持打开等待用户手动关闭', { skip: !calendarModule }, () => {
  assert.deepEqual(calendarModule.getCompletionBehavior('home'), { autoClose: false, delayMs: 0 });
  assert.deepEqual(calendarModule.getCompletionBehavior('profile'), { autoClose: false, delayMs: 0 });
  assert.doesNotMatch(modalSource, /scheduleAutoClose|closeTimerRef|setTimeout\(onClose/);
});

test('共享弹窗包含模式、可访问性与错误重试约束', () => {
  assert.match(modalSource, /mode\s*=\s*['"]home['"]/);
  assert.match(modalSource, /role=\{isEmbedded \? 'region' : 'dialog'\}/);
  assert.match(modalSource, /aria-modal=\{isEmbedded \? undefined : true\}/);
  assert.match(modalSource, /aria-expanded=/);
  assert.match(modalSource, /requestFailed/);
  assert.match(modalSource, /fetchSignInStatus/);
  assert.match(profileSource, /mode=["']profile["']/);
});

test('展开月历延长周历同一容器，不渲染第二个独立卡框', () => {
  const weekRuleIndex = modalSource.indexOf('className={styles.weekRule}');
  const expandButtonIndex = modalSource.indexOf('className={styles.expandButton}');
  const monthSectionIndex = modalSource.indexOf('className={styles.monthSection}');
  const monthRewardIndex = modalSource.indexOf('className={styles.monthReward}');
  assert.ok(weekRuleIndex > -1 && expandButtonIndex > weekRuleIndex);
  assert.ok(monthSectionIndex > expandButtonIndex && monthRewardIndex > monthSectionIndex);
  assert.doesNotMatch(modalSource.slice(weekRuleIndex, expandButtonIndex), /<\/section>/);

  const monthSectionRule = modalStyles.match(/\.monthSection\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.doesNotMatch(monthSectionRule, /\bborder:\s*1px/);
  assert.doesNotMatch(monthSectionRule, /\bbackground:/);
  assert.match(monthSectionRule, /border-top:/);
});

test('PC 与移动端均为七列且不依赖横向滚动', () => {
  assert.match(modalStyles, /grid-template-columns:\s*repeat\(7,/);
  assert.match(modalStyles, /@media\s*\(max-width:\s*600px\)/);
  assert.doesNotMatch(modalStyles, /overflow-x:\s*(auto|scroll)/);
  assert.match(modalStyles, /prefers-reduced-motion/);
});

test('签到弹窗在 PC 与移动端均保持视口居中', () => {
  const overlayRule = modalStyles.match(/\.overlay\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const mobileStart = modalStyles.indexOf('@media (max-width: 600px)');
  const mobileEnd = modalStyles.indexOf('@media (prefers-reduced-motion: reduce)');
  const mobileStyles = modalStyles.slice(mobileStart, mobileEnd);
  const mobileOverlayRule = mobileStyles.match(/\.overlay\s*\{([\s\S]*?)\}/)?.[1] ?? '';

  assert.match(overlayRule, /place-items:\s*center/);
  assert.doesNotMatch(mobileOverlayRule, /align-items:\s*end/);
});

test('签到界面隐藏实现术语，只展示奖励规则', () => {
  assert.doesNotMatch(modalSource, /checkIn\.utcCalendar|<span>UTC<\/span>/);
  assert.doesNotMatch(modalSource, /checkIn\.bonusEligible|checkIn\.bonusMissed/);
  assert.doesNotMatch(zhLocale.checkIn.weekRule, /UTC|自然周/);
  assert.match(zhLocale.checkIn.weekRule, /前 6 天.*5 织梦豆/);
  assert.match(zhLocale.checkIn.weekRule, /第 7 天.*15 织梦豆/);
  assert.doesNotMatch(zhLocale.checkIn.weekRule, /25 织梦豆/);
  assert.doesNotMatch(enLocale.checkIn.weekRule, /UTC|calendar week/i);
});

test('月奖励提示使用后端返回的奖励数量', () => {
  assert.match(modalSource, /monthRewarded',\s*\{\s*points:\s*status\.month\.bonusPoints,?\s*\}/);
  assert.match(modalSource, /monthRewardRule',[\s\S]*?points:\s*status\.month\.bonusPoints/);
  assert.match(zhLocale.checkIn.monthRewardRule, /\{\{points\}\}/);
  assert.match(zhLocale.checkIn.monthRewarded, /\{\{points\}\}/);
  assert.match(enLocale.checkIn.monthRewardRule, /\{\{points\}\}/);
  assert.match(enLocale.checkIn.monthRewarded, /\{\{points\}\}/);
  assert.doesNotMatch(zhLocale.checkIn.monthRewardRule, /100/);
  assert.doesNotMatch(enLocale.checkIn.monthRewardRule, /100/);
});

test('关闭按钮无外圆框且保留可访问点击区域', () => {
  const closeButtonRule = modalStyles.match(/\.closeButton\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const closeButtonHoverRule = modalStyles.match(/\.closeButton:hover\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const closeButtonFocusRule = modalStyles.match(
    /\.closeButton:focus(?:,\s*\n?\s*\.closeButton:focus-visible)?(?:,\s*\n?\s*\.closeButton:active)?\s*\{([\s\S]*?)\}/,
  )?.[1] ?? '';

  assert.match(closeButtonRule, /width:\s*44px/);
  assert.match(closeButtonRule, /height:\s*44px/);
  assert.match(closeButtonRule, /border:\s*(?:0|none)/);
  assert.match(closeButtonRule, /outline:\s*none/);
  assert.match(closeButtonRule, /background:\s*transparent/);
  assert.doesNotMatch(closeButtonRule, /border-radius:/);
  assert.doesNotMatch(closeButtonHoverRule, /background:/);
  // 功能注释：关闭钮任何焦点态都不得出现粉框（含 focus-visible）
  assert.match(closeButtonFocusRule, /outline:\s*none/);
  assert.match(
    modalStyles,
    /\.closeButton:focus,\s*\n\s*\.closeButton:focus-visible,\s*\n\s*\.closeButton:active\s*\{[\s\S]*?outline:\s*none/,
  );
  assert.doesNotMatch(
    modalStyles,
    /\.closeButton:focus-visible,\s*\n\s*\.secondaryButton:focus-visible/,
  );
  assert.match(modalSource, /modalRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(modalSource, /closeButtonRef\.current\?\.focus\(\)/);
});

test('签到弹窗展示补签卡数量并支持本周与本月补签', () => {
  assert.match(modalSource, /makeupCardCount/);
  assert.match(modalSource, /canMakeup/);
  assert.match(modalSource, /made_up/);
  assert.match(modalSource, /handleMakeup/);
  assert.match(modalSource, /makeUpSignIn/);
  assert.match(authApiSource, /\/auth\/user\/signin\/makeup/);
});

test('补签包含确认、无卡去获得与奖励明细反馈且不自动关闭', () => {
  assert.match(modalSource, /makeupConfirm/);
  assert.match(modalSource, /makeupSuccess/);
  assert.match(modalSource, /onGoToDailyTasks/);
  assert.match(modalSource, /MAKEUP_CARD_UNAVAILABLE/);
  assert.match(profileSource, /setIsDailyTasksOpen\(true\)/);
  assert.match(modalStyles, /\.makeupDialog/);
});

test('签到与每日任务对话框接管焦点并阻止键盘穿透', () => {
  assert.match(modalSource, /modalRef/);
  assert.match(modalSource, /makeupDialogRef/);
  assert.match(modalSource, /event\.key === ['"]Tab['"]/);
  assert.match(modalSource, /suppressRestoreFocusRef/);
  assert.match(dailyTasksSource, /role=["']dialog["']/);
  assert.match(dailyTasksSource, /aria-modal=["']true["']/);
  assert.match(dailyTasksSource, /dailyTaskModalRef/);
  assert.match(dailyTasksSource, /event\.key (?:===|!==) ['"]Tab['"]/);
});

test('每日任务底部常驻补签卡 0\/4 进度领取区', () => {
  assert.match(dailyTasksSource, /makeupCardReward/);
  assert.match(dailyTasksSource, /claimMakeupCard/);
  assert.match(dailyTaskStoreSource, /claimMakeupCard/);
  assert.match(dailyTaskApiSource, /daily\/makeup-card\/claim/);
  assert.match(dailyTasksStyles, /\.makeupCardReward/);
  assert.match(dailyTasksStyles, /\.makeupCardProgress/);
});

test('补签卡重复领取使用后端结果文案且异常后刷新校准', () => {
  assert.match(dailyTasksSource, /toast\.success\(result\.message/);
  assert.doesNotMatch(dailyTasksSource, /toast\.success\(t\(['"]profile\.makeupCardClaimSuccess['"]\)\)/);
  const claimAction = dailyTaskStoreSource.slice(dailyTaskStoreSource.indexOf('claimMakeupCard: async'));
  assert.match(claimAction, /catch[\s\S]*refreshDailyTasks\(\{ silent: true \}\)/);
  assert.match(claimAction, /makeupCardReward\.claimed/);
});

test('统一资产流水的全部标签只请求织梦豆和 KK 币', () => {
  assert.match(assetDetailsSource, /return ['"]wallet['"]/);
  assert.doesNotMatch(assetDetailsSource, /return ['"]fenghua['"]/);
});
