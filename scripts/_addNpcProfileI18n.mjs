import fs from 'node:fs';

const npcProfileZh = {
  fields: {
    relationship: '关系',
    summary: '简介',
    attitudeToPlayer: '对你的态度',
    detailedBio: '详细简介',
    name: '姓名',
    gender: '性别',
    importance: '重要程度',
    survival: '存活状态',
  },
  gender: {
    male: '男',
    female: '女',
    other: '其他',
    unknown: '未知',
  },
  importance: {
    major: '重要',
    minor: '次要',
    extra: '路人',
  },
  survival: {
    alive: '存活',
    dead: '死亡',
    unknown: '未知',
  },
};

const npcProfileEn = {
  fields: {
    relationship: 'Relationship',
    summary: 'Summary',
    attitudeToPlayer: 'Attitude toward you',
    detailedBio: 'Detailed bio',
    name: 'Name',
    gender: 'Gender',
    importance: 'Importance',
    survival: 'Survival',
  },
  gender: {
    male: 'Male',
    female: 'Female',
    other: 'Other',
    unknown: 'Unknown',
  },
  importance: {
    major: 'Major',
    minor: 'Minor',
    extra: 'Extra',
  },
  survival: {
    alive: 'Alive',
    dead: 'Dead',
    unknown: 'Unknown',
  },
};

const npcProfileJa = {
  fields: {
    relationship: '関係',
    summary: '紹介',
    attitudeToPlayer: 'あなたへの態度',
    detailedBio: '詳細紹介',
    name: '名前',
    gender: '性別',
    importance: '重要度',
    survival: '生存状態',
  },
  gender: {
    male: '男',
    female: '女',
    other: 'その他',
    unknown: '不明',
  },
  importance: {
    major: '重要',
    minor: '脇役',
    extra: '通行人',
  },
  survival: {
    alive: '生存',
    dead: '死亡',
    unknown: '不明',
  },
};

function patchGalgame(file, npc) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.galgameUi = data.galgameUi || {};
  data.galgameUi.npcProfile = npc;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

patchGalgame('scripts/i18n-parts/galgame.zh.json', npcProfileZh);
patchGalgame('scripts/i18n-parts/galgame.en.json', npcProfileEn);
patchGalgame('scripts/i18n-parts/galgame.ja.json', npcProfileJa);

// also patch main locales without full merge (fill may be writing)
for (const [lang, npc] of [
  ['zh', npcProfileZh],
  ['en', npcProfileEn],
  ['ja', npcProfileJa],
]) {
  const p = `src/i18n/locales/${lang}.json`;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  data.galgameUi = data.galgameUi || {};
  data.galgameUi.npcProfile = npc;
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}

// dailyTask errors
const dailyZh = {
  invalidTaskCode: '任务类型无效',
  alreadyRewarded: '今日该任务奖励已领取',
  notCompleted: '任务未达成，暂不可领取',
  notAccepted: '请先领取任务',
  notFound: '任务不存在或未发布',
  notActive: '任务当前不在有效期内',
  loadFailed: '任务数据加载失败',
  missingParams: '任务参数缺失',
  processing: '任务处理中，请稍候',
  acceptFailed: '任务领取失败',
  acceptSuccess: '任务领取成功',
  claimFailed: '奖励领取失败',
  claimSuccess: '奖励领取成功',
};
const dailyEn = {
  invalidTaskCode: 'Invalid task type',
  alreadyRewarded: 'Reward already claimed today',
  notCompleted: 'Task not completed yet',
  notAccepted: 'Accept the task first',
  notFound: 'Task not found or unpublished',
  notActive: 'Task is outside its valid period',
  loadFailed: 'Failed to load tasks',
  missingParams: 'Missing task parameters',
  processing: 'Task is processing, please wait',
  acceptFailed: 'Failed to accept task',
  acceptSuccess: 'Task accepted',
  claimFailed: 'Failed to claim reward',
  claimSuccess: 'Reward claimed',
};
const dailyJa = {
  invalidTaskCode: 'タスク種別が無効です',
  alreadyRewarded: '本日の報酬は受取済みです',
  notCompleted: 'タスク未達成のため受取れません',
  notAccepted: '先にタスクを受注してください',
  notFound: 'タスクが存在しないか未公開です',
  notActive: 'タスクの有効期間外です',
  loadFailed: 'タスクの読み込みに失敗しました',
  missingParams: 'タスクパラメータが不足しています',
  processing: '処理中です。しばらくお待ちください',
  acceptFailed: 'タスク受注に失敗しました',
  acceptSuccess: 'タスクを受注しました',
  claimFailed: '報酬の受取に失敗しました',
  claimSuccess: '報酬を受取りました',
};

for (const [lang, block] of [
  ['zh', dailyZh],
  ['en', dailyEn],
  ['ja', dailyJa],
]) {
  const p = `src/i18n/locales/${lang}.json`;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  data.dailyTask = { ...(data.dailyTask || {}), errors: block };
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}

console.log('npcProfile + dailyTask.errors added');
