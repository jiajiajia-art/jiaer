/**
 * TXT 模式自由度改版 — 纯逻辑单测（P0 契约 + 校验 + 隔离）
 * 覆盖：角色档案 / 玩家卡导入 / 开局 gate / 私聊隔离
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHARACTER_PROFILE_LIMITS,
  createPlayerNpcProfile,
  mergeCharacterProfilePatch,
  npcLikeToEditableProfile,
  sortEditableNpcProfiles,
  validateCharacterProfileInput,
} from '../src/lib/galgame/characterProfile.ts';
import {
  applyPlayerCardImport,
  filterPlayerCharacterCards,
  previewPlayerCardImportDiff,
  validatePlayerCharacterCardInput,
} from '../src/lib/galgame/playerCharacterCard.ts';
import {
  buildOpeningRoutesFromWorldKeyEvents,
  buildSilentDefaultGameStartConfig,
  canSubmitGameStart,
  GAME_START_UE_COPY,
  isStartAdventureEnabled,
  normalizeGameStartGender,
  resolveOpeningRouteSelection,
  validateGameStartConfig,
} from '../src/lib/galgame/gameStartConfig.ts';
import {
  appendPrivateChatUserMessage,
  assertPrivateChatIsolatedFromNarrative,
  isNarrativeGenerationBusy,
  isPrivateChatNarrativeBusyError,
  resolvePrivateChatBusyMessage,
  sanitizeNarrativeHistoryForPersist,
  shouldWaitPrivateChatForNarrative,
  validatePrivateChatMessage,
} from '../src/lib/galgame/privateChatGate.ts';

// —— 角色档案 ——

test('validateCharacterProfileInput_缺必填应失败', () => {
  assert.equal(validateCharacterProfileInput({}).ok, false);
  assert.equal(
    validateCharacterProfileInput({
      name: '阿宁',
      gender: 'female',
      relationship: '同学',
      summary: '短发女生',
    }).ok,
    false,
  );
});

test('validateCharacterProfileInput_字数边界', () => {
  const ok = validateCharacterProfileInput({
    name: '阿宁',
    gender: 'female',
    relationship: '同学',
    summary: '短发女生',
    attitudeToPlayer: '友善',
  });
  assert.equal(ok.ok, true);

  const overRel = validateCharacterProfileInput({
    name: '阿宁',
    gender: 'female',
    relationship: 'x'.repeat(CHARACTER_PROFILE_LIMITS.relationship.max + 1),
    summary: '短发女生',
    attitudeToPlayer: '友善',
  });
  assert.equal(overRel.ok, false);

  const overSummary = validateCharacterProfileInput({
    name: '阿宁',
    gender: 'female',
    relationship: '同学',
    summary: 'y'.repeat(CHARACTER_PROFILE_LIMITS.summary.max + 1),
    attitudeToPlayer: '友善',
  });
  assert.equal(overSummary.ok, false);

  const overAttitude = validateCharacterProfileInput({
    name: '阿宁',
    gender: 'female',
    relationship: '同学',
    summary: '短发',
    attitudeToPlayer: 'z'.repeat(CHARACTER_PROFILE_LIMITS.attitudeToPlayer.max + 1),
  });
  assert.equal(overAttitude.ok, false);
});

test('validateCharacterProfileInput_非法性别应失败', () => {
  assert.equal(
    validateCharacterProfileInput({
      name: '阿宁',
      gender: 'alien',
      relationship: '同学',
      summary: '短发',
      attitudeToPlayer: '友善',
    }).ok,
    false,
  );
});

test('createPlayerNpcProfile_应为player_created且未出场', () => {
  const created = createPlayerNpcProfile({
    name: '路人甲',
    gender: 'unknown',
    relationship: '路人',
    summary: '第一次见面',
    attitudeToPlayer: '冷淡',
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.profile.source, 'player_created');
  assert.equal(created.profile.encountered, false);
  assert.ok(created.profile.id.startsWith('pc_'));
});

test('mergeCharacterProfilePatch_应保留id与source', () => {
  const base = createPlayerNpcProfile({
    name: '阿宁',
    gender: 'female',
    relationship: '同学',
    summary: '短发',
    attitudeToPlayer: '友善',
  });
  assert.equal(base.ok, true);
  if (!base.ok) return;
  const merged = mergeCharacterProfilePatch(base.profile, {
    attitudeToPlayer: '亲近',
    favorability: 80,
  });
  assert.equal(merged.ok, true);
  if (!merged.ok) return;
  assert.equal(merged.profile.id, base.profile.id);
  assert.equal(merged.profile.source, 'player_created');
  assert.equal(merged.profile.attitudeToPlayer, '亲近');
  assert.equal(merged.profile.favorability, 80);
});

test('npcLikeToEditableProfile_与sort_出场优先', () => {
  const a = npcLikeToEditableProfile({ id: 'n1', name: '乙', job: '同学', description: 'd' });
  const b = npcLikeToEditableProfile(
    { id: 'n2', name: '甲', job: '老师', description: 'd' },
    { encountered: false },
  );
  assert.ok(a && b);
  a.encountered = true;
  const sorted = sortEditableNpcProfiles([b, a]);
  assert.equal(sorted[0].id, 'n1');
});

test('sortEditableNpcProfiles_自定义角色置顶且新建更靠前', () => {
  const preset = npcLikeToEditableProfile({ id: 'n1', name: '甲', job: '同学', description: 'd' });
  assert.ok(preset);
  preset.encountered = true;
  const older = createPlayerNpcProfile(
    {
      name: '旧角',
      gender: 'unknown',
      relationship: '友人',
      summary: '简介一',
      attitudeToPlayer: '友善',
    },
    { id: 'pc_lz0001_aaaa' },
  );
  const newer = createPlayerNpcProfile(
    {
      name: '新角',
      gender: 'unknown',
      relationship: '友人',
      summary: '简介二',
      attitudeToPlayer: '友善',
    },
    { id: 'pc_lz9999_bbbb' },
  );
  assert.equal(older.ok, true);
  assert.equal(newer.ok, true);
  if (!older.ok || !newer.ok) return;
  const sorted = sortEditableNpcProfiles([preset, older.profile, newer.profile]);
  assert.equal(sorted[0].id, newer.profile.id);
  assert.equal(sorted[1].id, older.profile.id);
  assert.equal(sorted[2].id, preset.id);
  assert.equal(sorted[0].source, 'player_created');
});

// —— 玩家卡 ——

test('validatePlayerCharacterCardInput_主路径与非法性别', () => {
  assert.equal(
    validatePlayerCharacterCardInput({
      name: '白茶',
      gender: 'female',
      persona: '安静的观察者',
      attributes: { 容貌: 70, 才艺: 55 },
    }).ok,
    true,
  );
  assert.equal(
    validatePlayerCharacterCardInput({
      name: '白茶',
      gender: 'unknown',
      persona: 'x',
    }).ok,
    false,
  );
});

test('applyPlayerCardImport_覆盖与无权限与空卡', () => {
  const empty = applyPlayerCardImport(null);
  assert.equal(empty.ok, false);
  assert.equal(empty.code, 'empty_card');

  const forbidden = applyPlayerCardImport(
    {
      id: 'c1',
      userId: 'u-other',
      name: '白茶',
      gender: 'female',
      persona: '安静',
      attributes: {},
      createdAt: '',
      updatedAt: '',
    },
    { currentUserId: 'u-me' },
  );
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, 'forbidden');

  const ok = applyPlayerCardImport({
    id: 'c1',
    userId: 'u-me',
    name: '白茶',
    gender: 'female',
    persona: '安静的观察者',
    attributes: { 容貌: 88 },
    createdAt: '',
    updatedAt: '',
  }, { currentUserId: 'u-me' });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.profile.name, '白茶');
  assert.equal(ok.profile.customAttributes['容貌'], 88);
  assert.equal(ok.profile.importedCardId, 'c1');
});

test('previewPlayerCardImportDiff_应标出变化字段', () => {
  const diff = previewPlayerCardImportDiff(
    {
      name: '旧名',
      gender: 'male',
      persona: '旧人设',
      customAttributes: { 容貌: 50 },
    },
    {
      id: 'c1',
      name: '新名',
      gender: 'female',
      persona: '新人设',
      attributes: { 容貌: 90, 才艺: 40 },
    },
  );
  assert.equal(diff.ok, true);
  assert.ok(diff.changedKeys.includes('name'));
  assert.ok(diff.changedKeys.includes('gender'));
  assert.ok(diff.changedKeys.includes('attr:容貌'));
  assert.ok(diff.changedKeys.includes('attr:才艺'));
});

test('filterPlayerCharacterCards_按姓名人设搜索', () => {
  const cards = [
    {
      id: '1',
      userId: 'u',
      name: '白茶',
      gender: 'female',
      persona: '安静',
      attributes: {},
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      userId: 'u',
      name: '墨离',
      gender: 'male',
      persona: '热血少年',
      attributes: {},
      createdAt: '',
      updatedAt: '',
    },
  ];
  assert.equal(filterPlayerCharacterCards(cards, '白').length, 1);
  assert.equal(filterPlayerCharacterCards(cards, '少年').length, 1);
  assert.equal(filterPlayerCharacterCards(cards, '').length, 2);
});

// —— 开局 ——

test('canSubmitGameStart_未选故事线不可提交', () => {
  assert.equal(
    canSubmitGameStart({
      player: { name: '白茶', gender: 'female' },
      openingRouteId: '',
    }),
    false,
  );
  assert.equal(
    isStartAdventureEnabled({
      player: { name: '白茶', gender: 'female' },
      openingRouteId: 'route-1',
    }),
    true,
  );
});

test('buildOpeningRoutes_空列表应给开场路线兜底', () => {
  const routes = buildOpeningRoutesFromWorldKeyEvents([], { initialPlot: '序章' });
  assert.equal(routes.length, 1);
  assert.equal(routes[0].title, GAME_START_UE_COPY.fallbackRouteTitle);
  assert.equal(routes[0].openingMonologue, '序章');
});

test('buildSilentDefaultGameStartConfig_应用创作台玩家与首条线', () => {
  assert.equal(normalizeGameStartGender('女'), 'female');
  assert.equal(normalizeGameStartGender('unknown'), 'other');
  const built = buildSilentDefaultGameStartConfig({
    playerName: '白茶',
    gender: 'female',
    routes: [
      { id: 'a', title: '线A', openingMonologue: '开场A' },
      { id: 'b', title: '线B', openingMonologue: '开场B' },
    ],
  });
  assert.equal(built.ok, true);
  assert.equal(built.data?.player.name, '白茶');
  assert.equal(built.data?.player.gender, 'female');
  assert.equal(built.data?.openingRouteId, 'a');
  assert.deepEqual(built.data?.retainedStorylineIds, ['b']);
});

test('validateGameStartConfig_与方案C路线裁剪', () => {
  const bad = validateGameStartConfig({
    player: { name: '白茶', gender: 'female' },
  });
  assert.equal(bad.ok, false);

  const routes = [
    { id: 'a', title: '线A', openingMonologue: '开场A' },
    { id: 'b', title: '线B', openingMonologue: '开场B' },
  ];
  const sel = resolveOpeningRouteSelection(routes, 'a');
  assert.equal(sel.ok, true);
  assert.equal(sel.openingMonologue, '开场A');
  assert.deepEqual(sel.retainedStorylineIds, ['b']);

  const onlyOne = resolveOpeningRouteSelection([{ id: 'x', title: '唯一' }], 'x');
  assert.deepEqual(onlyOne.retainedStorylineIds, []);

  const ok = validateGameStartConfig({
    player: { name: '白茶', gender: 'female' },
    openingRouteId: sel.openingRouteId,
    openingMonologue: sel.openingMonologue,
    retainedStorylineIds: sel.retainedStorylineIds,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.data.openingRouteId, 'a');
  assert.deepEqual(ok.data.retainedStorylineIds, ['b']);
});

// —— 私聊隔离 ——

test('privateChat_消息校验与追加', () => {
  assert.equal(validatePrivateChatMessage('').ok, false);
  const thread = { sessionId: 's1', npcId: 'n1', messages: [] };
  const next = appendPrivateChatUserMessage(thread, '你好啊');
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.thread.messages.length, 1);
  assert.equal(next.thread.messages[0].role, 'user');
});

test('sanitizeNarrativeHistoryForPersist_应剥离私聊step', () => {
  const cleaned = sanitizeNarrativeHistoryForPersist({
    steps: [
      { type: 'dialogue', content: '主线对白' },
      { type: 'dialogue', content: '私聊内容', privateChat: true },
      { type: 'dialogue', content: '另一条', channel: 'private_chat' },
    ],
  });
  assert.equal(cleaned.steps.length, 1);
  assert.equal(cleaned.steps[0].content, '主线对白');
});

test('assertPrivateChatIsolatedFromNarrative_泄漏应失败', () => {
  const secret = '这是一段足够长的私聊内容ABC';
  const isolated = assertPrivateChatIsolatedFromNarrative(
    {
      sessionId: 's1',
      npcId: 'n1',
      messages: [{ role: 'user', content: secret, createdAt: '' }],
    },
    { steps: [{ content: '完全无关的主线' }] },
  );
  assert.equal(isolated.ok, true);

  const leaked = assertPrivateChatIsolatedFromNarrative(
    {
      sessionId: 's1',
      npcId: 'n1',
      messages: [{ role: 'user', content: secret, createdAt: '' }],
    },
    { steps: [{ content: `旁白引用：${secret}` }] },
  );
  assert.equal(leaked.ok, false);
});

test('resolvePrivateChatBusyMessage_锁冲突文案', () => {
  // 主线忙碌改为加载中等待，不再走 toast 文案
  assert.equal(resolvePrivateChatBusyMessage({ narrativeBusy: true }), null);
  assert.equal(resolvePrivateChatBusyMessage({ privateChatBusy: true }), '私聊回复生成中，请稍候');
  assert.equal(resolvePrivateChatBusyMessage({}), null);
});

test('shouldWaitPrivateChatForNarrative_主线未完成需等待', () => {
  assert.equal(shouldWaitPrivateChatForNarrative(true), true);
  assert.equal(shouldWaitPrivateChatForNarrative(false), false);
  assert.equal(isPrivateChatNarrativeBusyError({ code: 'narrative_busy', message: 'x' }), true);
  assert.equal(isPrivateChatNarrativeBusyError({ message: '主线正在生成，请稍后再私聊' }), true);
  assert.equal(isPrivateChatNarrativeBusyError({ message: '网络错误' }), false);
});

test('isNarrativeGenerationBusy_等玩家选线与打字机不算忙碌', () => {
  // 等选项、前端打字机都不占后端会话锁，不应挡住私聊
  assert.equal(isNarrativeGenerationBusy({}), false);
  assert.equal(isNarrativeGenerationBusy({ streamLoading: true }), true);
  assert.equal(isNarrativeGenerationBusy({ isCompressingContext: true }), true);
  assert.equal(isNarrativeGenerationBusy({ streamLoading: false }), false);
});
