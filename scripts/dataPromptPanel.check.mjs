/**
 * 数据库 Step6 路由与面板解析单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GAME_DATABASE_PANEL,
  GAME_DATABASE_NAV_NUMBER_OFFSET,
  isGameDatabaseActive,
  resolveGameDatabaseRightView,
  resolveGameDatabaseTargetPanel,
  resolveGameDatabasePanelAfterDelete,
} from '../src/utils/dataPromptPanel.ts';
import { buildDataPromptPanelId, DATA_PROMPT_NEW_PANEL } from '../src/utils/dataPromptForms.ts';

test('GAME_DATABASE_PANEL constant is gameDatabase', () => {
  assert.equal(GAME_DATABASE_PANEL, 'gameDatabase');
  assert.equal(GAME_DATABASE_NAV_NUMBER_OFFSET, 6);
});

test('isGameDatabaseActive is true for gameDatabase and dataPrompt panels', () => {
  assert.equal(isGameDatabaseActive('gameDatabase'), true);
  assert.equal(isGameDatabaseActive(DATA_PROMPT_NEW_PANEL), true);
  assert.equal(isGameDatabaseActive(buildDataPromptPanelId('abc')), true);
  assert.equal(isGameDatabaseActive('worldBook'), false);
  assert.equal(isGameDatabaseActive('morePrompt:new'), false);
});

test('resolveGameDatabaseRightView returns form only for dataPrompt panels', () => {
  assert.equal(resolveGameDatabaseRightView('gameDatabase'), 'empty');
  assert.equal(resolveGameDatabaseRightView(DATA_PROMPT_NEW_PANEL), 'form');
  assert.equal(resolveGameDatabaseRightView(buildDataPromptPanelId('x')), 'form');
});

test('resolveGameDatabaseTargetPanel opens first entry when forms exist', () => {
  const forms = [{ id: 'a' }, { id: 'b' }];
  assert.equal(
    resolveGameDatabaseTargetPanel(forms, GAME_DATABASE_PANEL),
    buildDataPromptPanelId('a'),
  );
});

test('resolveGameDatabaseTargetPanel stays on gameDatabase when no forms', () => {
  assert.equal(resolveGameDatabaseTargetPanel([], GAME_DATABASE_PANEL), GAME_DATABASE_PANEL);
});

test('resolveGameDatabasePanelAfterDelete selects first remaining or empty state', () => {
  assert.equal(
    resolveGameDatabasePanelAfterDelete([{ id: 'only' }]),
    buildDataPromptPanelId('only'),
  );
  assert.equal(resolveGameDatabasePanelAfterDelete([]), GAME_DATABASE_PANEL);
});

test('step5 and step6 panel namespaces do not overlap', () => {
  assert.equal(isGameDatabaseActive('morePrompt:abc'), false);
  assert.equal(isGameDatabaseActive('worldBook'), false);
});
