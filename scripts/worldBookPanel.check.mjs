/**
 * 世界书 Step5 路由与面板解析单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORLD_BOOK_PANEL,
  WORLD_BOOK_NAV_NUMBER_OFFSET,
  isWorldBookActive,
  resolveWorldBookRightView,
  resolveWorldBookTargetPanel,
  resolveWorldBookPanelAfterDelete,
} from '../src/utils/worldBookPanel.ts';
import { buildMorePromptPanelId, MORE_PROMPT_NEW_PANEL } from '../src/utils/morePromptForms.ts';

test('WORLD_BOOK_PANEL constant is worldBook', () => {
  assert.equal(WORLD_BOOK_PANEL, 'worldBook');
  assert.equal(WORLD_BOOK_NAV_NUMBER_OFFSET, 5);
});

test('isWorldBookActive is true for worldBook and morePrompt panels', () => {
  assert.equal(isWorldBookActive('worldBook'), true);
  assert.equal(isWorldBookActive(MORE_PROMPT_NEW_PANEL), true);
  assert.equal(isWorldBookActive(buildMorePromptPanelId('abc')), true);
  assert.equal(isWorldBookActive('scenes'), false);
  assert.equal(isWorldBookActive('world'), false);
});

test('resolveWorldBookRightView returns form only for morePrompt panels', () => {
  assert.equal(resolveWorldBookRightView('worldBook'), 'empty');
  assert.equal(resolveWorldBookRightView(MORE_PROMPT_NEW_PANEL), 'form');
  assert.equal(resolveWorldBookRightView(buildMorePromptPanelId('x')), 'form');
  assert.equal(resolveWorldBookRightView('characters'), 'empty');
});

test('resolveWorldBookTargetPanel opens first entry when forms exist', () => {
  const forms = [{ id: 'a' }, { id: 'b' }];
  assert.equal(
    resolveWorldBookTargetPanel(forms, WORLD_BOOK_PANEL),
    buildMorePromptPanelId('a'),
  );
});

test('resolveWorldBookTargetPanel stays on worldBook when no forms', () => {
  assert.equal(resolveWorldBookTargetPanel([], WORLD_BOOK_PANEL), WORLD_BOOK_PANEL);
});

test('resolveWorldBookTargetPanel passes through morePrompt panel ids', () => {
  const forms = [{ id: 'a' }];
  assert.equal(
    resolveWorldBookTargetPanel(forms, MORE_PROMPT_NEW_PANEL),
    MORE_PROMPT_NEW_PANEL,
  );
  assert.equal(
    resolveWorldBookTargetPanel(forms, buildMorePromptPanelId('b')),
    buildMorePromptPanelId('b'),
  );
});

test('resolveWorldBookPanelAfterDelete selects first remaining or empty state', () => {
  assert.equal(
    resolveWorldBookPanelAfterDelete([{ id: 'only' }]),
    buildMorePromptPanelId('only'),
  );
  assert.equal(resolveWorldBookPanelAfterDelete([]), WORLD_BOOK_PANEL);
});

test('resolveWorldBookTargetPanel uses first form order not arbitrary id sort', () => {
  const forms = [{ id: 'zzz' }, { id: 'aaa' }];
  assert.equal(
    resolveWorldBookTargetPanel(forms, WORLD_BOOK_PANEL),
    buildMorePromptPanelId('zzz'),
  );
});
