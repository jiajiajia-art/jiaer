import fs from 'node:fs';

/** 仅替换「标签内纯中文子节点」与少数模板，避免误伤注释 */
function replaceChildren(src, pairs) {
  let out = src;
  let n = 0;
  for (const [zh, expr] of pairs) {
    // >中文</  or >中文\n
    const re = new RegExp(`>(\\s*)${zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*)<`, 'g');
    const next = out.replace(re, `>$1{${expr}}$2<`);
    if (next !== out) {
      const matches = out.match(re);
      n += matches ? matches.length : 0;
      out = next;
    }
  }
  return { out, n };
}

{
  let s = fs.readFileSync('src/components/Galgame/panels/SystemsPanel.tsx', 'utf8');
  // 修复/补全
  const pairs = [
    ['取消', "t('common.cancel')"],
    ['启用', "t('galgameUi.common.enabled')"],
    ['停用', "t('galgameUi.common.disabled')"],
    ['触发关键词', "t('galgameUi.systems.form.triggerKeywords')"],
    ['是否常驻', "t('galgameUi.systems.form.constant')"],
    ['状态', "t('galgameUi.systems.form.status')"],
    ['标题', "t('galgameUi.systems.form.title')"],
    ['内容', "t('galgameUi.systems.form.content')"],
    ['当前身份', "t('galgameUi.systems.form.identity')"],
    ['当前立场', "t('galgameUi.systems.form.traits')"],
    ['编辑避雷', "t('galgameUi.systems.actions.editAvoidWords')"],
    ['编辑定位', "t('galgameUi.systems.actions.editPosition')"],
    ['更换路线', "t('galgameUi.systems.actions.changeRoute')"],
    ['新增条目', "t('galgameUi.systems.actions.addEntry')"],
    ['导入世界书', "t('galgameUi.systems.actions.importWorldBook')"],
    ['节奏', "t('galgameUi.systems.form.pace')"],
    ['避雷词库', "t('galgameUi.systems.form.avoidWordsSection')"],
    ['暂无避雷词', "t('galgameUi.systems.form.noAvoidWords')"],
    ['添加避雷词', "t('galgameUi.systems.form.addAvoidWord')"],
    ['词库为空', "t('galgameUi.systems.form.avoidEmpty')"],
  ];
  const r = replaceChildren(s, pairs);
  s = r.out;
  s = s.replace("{saving ? '保存中…' : t('galgameUi.common.done')}", "{saving ? t('createGame.saving') : t('galgameUi.common.done')}");
  // 路由确认文案若仍引用 GAME_START_UE_COPY.message
  s = s.replace(
    /pendingRoute\s*\n\s*\?\s*`\$\{GAME_START_UE_COPY\.changeRouteConfirmMessage\}\\n「\$\{pendingRoute\.title\}」`\s*\n\s*:\s*GAME_START_UE_COPY\.changeRouteConfirmMessage/,
    `pendingRoute\n            ? \`\${t('galgameUi.route.changeMessage')}\\n「\${pendingRoute.title}」\`\n            : t('galgameUi.route.changeMessage')`,
  );
  fs.writeFileSync('src/components/Galgame/panels/SystemsPanel.tsx', s);
  console.log('SystemsPanel children', r.n);
}

{
  let s = fs.readFileSync('src/components/Galgame/panels/PlayerArchiveSection.tsx', 'utf8');
  // 修语法错误 + gender helpers
  s = s.replace(
    `const GENDER_LABEL: Record<PlayerCardGender, string> = {
  female: '女',
  male: '男',
  other: '其他',
};`,
    `const genderLabelKey: Record<PlayerCardGender, string> = {
  female: 'galgameUi.playerArchive.gender.female',
  male: 'galgameUi.playerArchive.gender.male',
  other: 'galgameUi.playerArchive.gender.other',
};`,
  );
  s = s.replace(
    `function genderText(g?: string | null) {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  return '其他';
}`,
    `function genderText(g: string | null | undefined, translate: (key: string) => string) {
  if (g === 'male') return translate('galgameUi.playerArchive.gender.male');
  if (g === 'female') return translate('galgameUi.playerArchive.gender.female');
  return translate('galgameUi.playerArchive.gender.other');
}`,
  );
  s = s.replaceAll('{t(genderLabelKey[g]}', '{t(genderLabelKey[g])}');
  s = s.replaceAll('genderText(card.gender)', 'genderText(card.gender, t)');
  s = s.replaceAll('genderText(next.gender)', 'genderText(next.gender, t)');
  s = s.replaceAll('genderText(profile?.gender)', 'genderText(profile?.gender, t)');
  s = s.replaceAll('aria-label={`${displayName} 头像`}', "aria-label={`${displayName} ${t('galgameUi.common.avatar')}`}");
  const r = replaceChildren(s, [
    ['取消', "t('common.cancel')"],
    ['人设', "t('galgameUi.playerArchive.edit.persona')"],
    ['我的档案', "t('galgameUi.playerArchive.overview.title')"],
    ['编辑档案', "t('galgameUi.playerArchive.overview.editProfile')"],
    ['导入角色卡', "t('galgameUi.playerArchive.overview.importCard')"],
    ['姓名', "t('galgameUi.playerArchive.edit.name')"],
    ['性别', "t('galgameUi.playerArchive.edit.gender')"],
    ['生成头像', "t('galgameUi.playerArchive.avatar.generateAvatar')"],
    ['重新生成', "t('galgameUi.playerArchive.avatar.regenerateAvatar')"],
    ['返回列表', "t('galgameUi.playerArchive.import.backToList')"],
  ]);
  s = r.out;
  fs.writeFileSync('src/components/Galgame/panels/PlayerArchiveSection.tsx', s);
  console.log('PlayerArchive children', r.n);
}
