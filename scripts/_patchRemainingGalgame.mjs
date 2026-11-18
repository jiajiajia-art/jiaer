import fs from 'node:fs';

function patch(path, replacements) {
  let s = fs.readFileSync(path, 'utf8');
  let n = 0;
  for (const [from, to] of replacements) {
    if (!s.includes(from)) {
      console.log('MISS', path, from.slice(0, 60));
      continue;
    }
    const parts = s.split(from);
    s = parts.join(to);
    n += parts.length - 1;
  }
  fs.writeFileSync(path, s);
  console.log(path, 'replacements', n);
}

patch('src/components/Galgame/panels/SystemsPanel.tsx', [
  [
    'toast.error(`最多 ${GAME_START_LIMITS.avoidWordsMax} 个`);',
    "toast.error(t('galgameUi.common.maxCount', { max: GAME_START_LIMITS.avoidWordsMax }));",
  ],
  [
    '`织梦豆不足（需要 ${textBillingPreview.chargedUnits}，当前 ${latestPoints}）`',
    "t('galgameUi.currency.insufficientDreamBeans', { need: textBillingPreview.chargedUnits, current: latestPoints })",
  ],
  [
    'toast.success(`已切换路线：${selected.title}`);',
    "toast.success(t('galgameUi.route.switchedToast', { title: selected.title }));",
  ],
  [
    "{ id: 'worldBook' as const, icon: '书', title: t('galgameUi.systems.nav.worldBook'), desc: t('galgameUi.systems.nav.worldBookDesc') },",
    "{ id: 'worldBook' as const, icon: '書', title: t('galgameUi.systems.nav.worldBook'), desc: t('galgameUi.systems.nav.worldBookDesc') },",
  ],
  // keep icons as single CJK glyphs intentionally (visual), leave them
  [
    "<div className={shell.empty}>暂无世界书条目，可新增或导入</div>",
    "<div className={shell.empty}>{t('galgameUi.systems.actions.emptyWorldBook')}</div>",
  ],
  [
    '触发关键词：{item.keywords.length ? item.keywords.join(\'、\') : t(\'galgameUi.common.none\')}',
    "{t('galgameUi.systems.actions.keywordsPrefix')}{item.keywords.length ? item.keywords.join('、') : t('galgameUi.common.none')}",
  ],
  [
    "{item.constant ? ' · 常驻' : ''}",
    "{item.constant ? ` ${t('galgameUi.common.constantTrigger')}` : ''}",
  ],
  [
    '<span className={styles.badge}>已装载</span>',
    "<span className={styles.badge}>{t('galgameUi.systems.actions.loaded')}</span>",
  ],
  ['>取消</button>', ">{t('common.cancel')}</button>"],
  ["{saving ? '保存中…' : '保存'}", "{saving ? t('createGame.saving') : t('common.save')}"],
  [
    '<div className={shell.empty}>加载我的世界书…</div>',
    "<div className={shell.empty}>{t('galgameUi.systems.form.loadingMyWorldBook')}</div>",
  ],
  [
    `仓库里还没有世界书。可先去「我的资源 → 我的世界书」创建，或改用粘贴/模板导入。`,
    `{t('galgameUi.systems.form.noWorldBookInWarehouse')}`,
  ],
  [
    "(book.description || '').trim() || `${entryCount} 条设定`",
    "(book.description || '').trim() || t('galgameUi.common.entrySettingsCount', { count: entryCount })",
  ],
  [
    "entryCount > 0 ? ` · ${entryCount} 条` : ''",
    "entryCount > 0 ? t('galgameUi.common.entryCountBadge', { count: entryCount }) : ''",
  ],
  [
    '<span className={styles.labelRow}>粘贴世界书内容（JSON 或纯文本）</span>',
    "<span className={styles.labelRow}>{t('galgameUi.systems.form.pasteWorldBookLabel')}</span>",
  ],
  [
    "aria-label={`删除 ${w}`}",
    "aria-label={t('galgameUi.common.deleteAria', { word: w })}",
  ],
  [
    '<span className={styles.labelRow}>当前立场</span>',
    "<span className={styles.labelRow}>{t('galgameUi.systems.form.traits')}</span>",
  ],
  [
    "`AI生成 · ${textChargeText}`",
    "t('galgameUi.common.aiGenerate', { charge: textChargeText })",
  ],
  [
    'title={`确认生成${positionAiConfirm ? POSITION_AI_LABEL[positionAiConfirm] : \'\'}`}',
    "title={t('galgameUi.systems.toast.confirmGeneratePositionTitle', { field: positionAiConfirm ? POSITION_AI_LABEL[positionAiConfirm] : '' })}",
  ],
  [
    'message={`将扣除 ${textChargeText} 生成「${positionAiConfirm ? POSITION_AI_LABEL[positionAiConfirm] : \'\'}」，是否继续？`}',
    "message={t('galgameUi.systems.toast.confirmGeneratePositionMessage', { charge: textChargeText, field: positionAiConfirm ? POSITION_AI_LABEL[positionAiConfirm] : '' })}",
  ],
  ['cancelText="取消"', "cancelText={t('common.cancel')}"],
  [
    'return GAME_START_UE_COPY.currentRouteSection;',
    "return t('galgameUi.route.currentSection');",
  ],
  [
    'if (view === \'route\') return GAME_START_UE_COPY.currentRouteHint;',
    "if (view === 'route') return t('galgameUi.route.currentHint');",
  ],
  [
    "title: GAME_START_UE_COPY.currentRouteSection,",
    "title: t('galgameUi.route.currentSection'),",
  ],
  [
    'title={GAME_START_UE_COPY.changeRouteConfirmTitle}',
    "title={t('galgameUi.route.confirmSwitchTitle')}",
  ],
  [
    'confirmText={saving ? t(\'galgameUi.common.changingRoute\') : GAME_START_UE_COPY.changeRouteConfirmOk}',
    "confirmText={saving ? t('galgameUi.common.changingRoute') : t('galgameUi.common.confirmChangeRoute')}",
  ],
]);

patch('src/components/Galgame/panels/PlayerArchiveSection.tsx', [
  [
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
  ],
  [
    `function genderText(g?: string | null) {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  return '其他';
}`,
    `function genderText(g: string | null | undefined, t: (key: string) => string) {
  if (g === 'male') return t('galgameUi.playerArchive.gender.male');
  if (g === 'female') return t('galgameUi.playerArchive.gender.female');
  return t('galgameUi.playerArchive.gender.other');
}`,
  ],
  [
    '`织梦豆不足（需要 ${avatarBillingPreview.chargedUnits}，当前 ${latestPoints}）`',
    "t('galgameUi.currency.insufficientDreamBeans', { need: avatarBillingPreview.chargedUnits, current: latestPoints })",
  ],
  [
    '`织梦豆不足（需要 ${textBillingPreview.chargedUnits}，当前 ${latestPoints}）`',
    "t('galgameUi.currency.insufficientDreamBeans', { need: textBillingPreview.chargedUnits, current: latestPoints })",
  ],
  ['cancelText="取消"', "cancelText={t('common.cancel')}"],
  [
    "`AI生成 · ${textChargeText}`",
    "t('galgameUi.common.aiGenerate', { charge: textChargeText })",
  ],
  ["{saving ? '保存中…' : '保存'}", "{saving ? t('createGame.saving') : t('common.save')}"],
  [
    'message={`将扣除 ${textChargeText} 生成「人设」，是否继续？`}',
    "message={t('galgameUi.playerArchive.confirm.personaMessage', { charge: textChargeText })}",
  ],
  [
    'GENDER_LABEL[',
    't(genderLabelKey[',
  ],
]);
