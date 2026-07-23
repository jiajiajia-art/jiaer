/**
 * 创作台续玩 / 开始测试会话策略单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCreatorPlaySessionRequest,
  buildGalgameContinueNavigate,
  normalizeCreatorPlayMode,
  parseOpticalPlaySessionId,
  resolveContinuePlayFileId,
  shouldContinuePlayOnEdit,
  shouldRestartPlaySession,
  shouldReuseExistingPlaySession,
} from '../src/utils/creatorContinuePlay.ts';

test('normalizeCreatorPlayMode maps TXT / NOVEL / AVG / custom', () => {
  assert.equal(normalizeCreatorPlayMode('TXT', null), 'TXT');
  assert.equal(normalizeCreatorPlayMode('RPG', null), 'TXT');
  assert.equal(normalizeCreatorPlayMode('NOVEL', 'NOVEL'), 'NOVEL');
  assert.equal(normalizeCreatorPlayMode(null, 'NOVEL'), 'NOVEL');
  assert.equal(normalizeCreatorPlayMode('AVG', null), 'AVG');
  assert.equal(normalizeCreatorPlayMode('CUSTOM', null), 'customif');
  assert.equal(normalizeCreatorPlayMode('ST', null), 'st');
  assert.equal(normalizeCreatorPlayMode('IVG', null), 'interactive-video');
  assert.equal(normalizeCreatorPlayMode('', ''), '');
});

test('shouldContinuePlayOnEdit only for NOVEL (AI文游 TXT goes to settings editor)', () => {
  assert.equal(shouldContinuePlayOnEdit('TXT', 'TXT'), false);
  assert.equal(shouldContinuePlayOnEdit('NOVEL', 'NOVEL'), true);
  assert.equal(shouldContinuePlayOnEdit('AVG', 'AVG'), false);
  assert.equal(shouldContinuePlayOnEdit('CUSTOM', null), false);
  assert.equal(shouldContinuePlayOnEdit('ST', null), false);
});

test('NOVEL start-test should not reuse optical session (reader path is separate)', () => {
  // 开始测试仍对 TXT 要求 restart；小说测玩已改为阅读页，不再走本请求体
  assert.equal(shouldRestartPlaySession('start-test'), true);
  assert.equal(
    shouldReuseExistingPlaySession({
      hasExisting: true,
      restart: shouldRestartPlaySession('start-test'),
    }),
    false,
  );
});

test('resolveContinuePlayFileId uses source for novel and self for TXT', () => {
  assert.equal(
    resolveContinuePlayFileId({
      engine: 'NOVEL',
      gameTags: 'NOVEL',
      fileId: 'novel-meta',
      sourceFileId: 'origin-txt',
    }),
    'origin-txt',
  );
  assert.equal(
    resolveContinuePlayFileId({
      engine: 'NOVEL',
      gameTags: 'NOVEL',
      fileId: 'novel-meta',
      sourceFileId: '',
    }),
    '',
  );
  assert.equal(
    resolveContinuePlayFileId({
      engine: 'TXT',
      fileId: 'txt-1',
      id: 'fallback',
    }),
    'txt-1',
  );
});

test('shouldRestartPlaySession: start-test yes, edit-continue no', () => {
  assert.equal(shouldRestartPlaySession('start-test'), true);
  assert.equal(shouldRestartPlaySession('edit-continue'), false);
});

test('buildCreatorPlaySessionRequest sets restart by intent', () => {
  assert.deepEqual(buildCreatorPlaySessionRequest({ intent: 'start-test', fileId: 'f1' }), {
    fileId: 'f1',
    restart: true,
    source: 'other',
  });
  assert.deepEqual(
    buildCreatorPlaySessionRequest({ intent: 'edit-continue', fileId: 'f2', source: 'game_detail' }),
    {
      fileId: 'f2',
      restart: false,
      source: 'game_detail',
    },
  );
});

test('parseOpticalPlaySessionId accepts object and string session', () => {
  assert.equal(
    parseOpticalPlaySessionId({ session: { session_id: 'sid-1' } }),
    'sid-1',
  );
  assert.equal(
    parseOpticalPlaySessionId({ session: { sessionId: 'sid-2' } }),
    'sid-2',
  );
  assert.equal(parseOpticalPlaySessionId({ session: 'sid-3' }), 'sid-3');
  assert.equal(parseOpticalPlaySessionId({ session: { id: 1 } }), null);
  assert.equal(parseOpticalPlaySessionId(null), null);
});

test('buildGalgameContinueNavigate never auto-opens history', () => {
  const nav = buildGalgameContinueNavigate();
  assert.equal(nav.path, '/galgame');
  assert.equal(nav.state.from, 'creator-edit-continue');
  assert.equal(nav.state.openHistory, false);
});

test('shouldReuseExistingPlaySession mirrors optical backend rule', () => {
  assert.equal(shouldReuseExistingPlaySession({ hasExisting: true, restart: false }), true);
  assert.equal(shouldReuseExistingPlaySession({ hasExisting: true, restart: true }), false);
  assert.equal(shouldReuseExistingPlaySession({ hasExisting: false, restart: false }), false);
  assert.equal(shouldReuseExistingPlaySession({ hasExisting: true }), true);
});

test('edit-continue + existing session → reuse; start-test never reuses', () => {
  const editReq = buildCreatorPlaySessionRequest({ intent: 'edit-continue', fileId: 'f' });
  assert.equal(
    shouldReuseExistingPlaySession({ hasExisting: true, restart: editReq.restart }),
    true,
  );
  const startReq = buildCreatorPlaySessionRequest({ intent: 'start-test', fileId: 'f' });
  assert.equal(
    shouldReuseExistingPlaySession({ hasExisting: true, restart: startReq.restart }),
    false,
  );
});
