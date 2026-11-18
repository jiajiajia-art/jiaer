import fs from 'node:fs';

const extras = {
  zh: {
    generateFailed: '{{field}}生成失败',
    generated: '{{field}}已生成（-{{billing}}）',
    confirmGenerateTitle: '确认生成{{field}}',
    confirmGenerateMessage: '将扣除 {{charge}}生成「{{field}}」，是否继续？',
    confirmAvatarTitle: '确认生成头像',
    confirmAvatarMessage: '将扣除 {{charge}}生成 AI 头像，是否继续？',
    addCharacter: '添加新角色',
    editPersona: '编辑人设',
  },
  en: {
    generateFailed: 'Failed to generate {{field}}',
    generated: '{{field}} generated (-{{billing}})',
    confirmGenerateTitle: 'Generate {{field}}?',
    confirmGenerateMessage: 'This will cost {{charge}} to generate “{{field}}”. Continue?',
    confirmAvatarTitle: 'Generate avatar?',
    confirmAvatarMessage: 'This will cost {{charge}} to generate an AI avatar. Continue?',
    addCharacter: 'Add character',
    editPersona: 'Edit persona',
  },
  ja: {
    generateFailed: '{{field}}の生成に失敗しました',
    generated: '{{field}}を生成しました（-{{billing}}）',
    confirmGenerateTitle: '{{field}}を生成しますか',
    confirmGenerateMessage: '{{charge}}を消費して「{{field}}」を生成します。続行しますか？',
    confirmAvatarTitle: 'アバターを生成しますか',
    confirmAvatarMessage: '{{charge}}を消費してAIアバターを生成します。続行しますか？',
    addCharacter: 'キャラを追加',
    editPersona: '設定を編集',
  },
};

for (const lang of ['zh', 'en', 'ja']) {
  const p = `src/i18n/locales/${lang}.json`;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const npc = data.galgameUi?.npcProfile || {};
  data.galgameUi = data.galgameUi || {};
  data.galgameUi.npcProfile = { ...npc, ...extras[lang] };
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);

  const part = `scripts/i18n-parts/galgame.${lang}.json`;
  const partData = JSON.parse(fs.readFileSync(part, 'utf8'));
  partData.galgameUi = partData.galgameUi || {};
  partData.galgameUi.npcProfile = {
    ...(partData.galgameUi.npcProfile || {}),
    ...extras[lang],
  };
  fs.writeFileSync(part, `${JSON.stringify(partData, null, 2)}\n`);
}
console.log('npcProfile extras ok');
