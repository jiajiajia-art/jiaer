import fs from 'node:fs';

const extra = {
  zh: {
    claimingReward: '任务奖励领取中，请稍候',
    claimRewardFailed: '任务奖励领取失败',
    claimRewardSuccess: '奖励领取成功',
    makeupBusy: '补签卡领取中，请稍候',
    makeupFailed: '补签卡领取失败',
    makeupPlusOne: '补签卡 +1',
    makeupSuccess: '补签卡领取成功',
    makeupIncomplete: '完成今日全部四项每日任务后才可领取',
  },
  en: {
    claimingReward: 'Claiming reward, please wait',
    claimRewardFailed: 'Failed to claim reward',
    claimRewardSuccess: 'Reward claimed',
    makeupBusy: 'Claiming makeup card, please wait',
    makeupFailed: 'Failed to claim makeup card',
    makeupPlusOne: 'Makeup card +1',
    makeupSuccess: 'Makeup card claimed',
    makeupIncomplete: 'Complete all four daily tasks today before claiming',
  },
  ja: {
    claimingReward: '報酬受取処理中です。しばらくお待ちください',
    claimRewardFailed: '報酬の受取に失敗しました',
    claimRewardSuccess: '報酬を受取りました',
    makeupBusy: '補填カード受取処理中です',
    makeupFailed: '補填カードの受取に失敗しました',
    makeupPlusOne: '補填カード +1',
    makeupSuccess: '補填カードを受取りました',
    makeupIncomplete: '本日のデイリータスク4つをすべて完了してから受取れます',
  },
};

for (const lang of ['zh', 'en', 'ja']) {
  const p = `src/i18n/locales/${lang}.json`;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  data.dailyTask = data.dailyTask || {};
  data.dailyTask.errors = { ...(data.dailyTask.errors || {}), ...extra[lang] };
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}
console.log('dailyTask.errors extended');
