/**
 * 世界观 / 前情提要 / 开场白 / 开场剧情 字段职责单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORLD_SETTING_FIELD_ROLES,
  resolveStoryIntroText,
  buildWorldLorePromptLines,
  readWorldPremise,
} from '../src/lib/worldSettingFields.ts';

test('WORLD_SETTING_FIELD_ROLES_maps_keys_to_distinct_acts', () => {
  assert.equal(WORLD_SETTING_FIELD_ROLES.worldview.key, 'background');
  assert.equal(WORLD_SETTING_FIELD_ROLES.premise.key, 'premise');
  assert.equal(WORLD_SETTING_FIELD_ROLES.openingStatement.key, 'preamble');
  assert.equal(WORLD_SETTING_FIELD_ROLES.openingPlot.key, 'initialPlot');

  const acts = Object.values(WORLD_SETTING_FIELD_ROLES).map((role) => role.actsOn);
  assert.equal(new Set(acts).size, acts.length);
});

test('resolveStoryIntroText_prefers_preamble_over_initialPlot', () => {
  assert.equal(
    resolveStoryIntroText({ preamble: '  旁白A  ', initialPlot: '骨架B' }),
    '旁白A',
  );
});

test('resolveStoryIntroText_falls_back_to_initialPlot_when_preamble_empty', () => {
  assert.equal(
    resolveStoryIntroText({ preamble: '   ', initialPlot: '旧档骨架' }),
    '旧档骨架',
  );
  assert.equal(resolveStoryIntroText({ preamble: '', initialPlot: '' }), '');
});

test('buildWorldLorePromptLines_omits_empty_and_labels_roles', () => {
  assert.deepEqual(
    buildWorldLorePromptLines({ background: '学校规则', premise: '哥哥住院' }),
    ['**世界观**：学校规则', '**前情提要**：哥哥住院'],
  );
  assert.deepEqual(
    buildWorldLorePromptLines({ background: '  ', premise: '仅前情' }),
    ['**前情提要**：仅前情'],
  );
  assert.deepEqual(buildWorldLorePromptLines({ background: '', premise: '' }), []);
});

test('readWorldPremise_returns_empty_for_legacy_missing_field', () => {
  assert.equal(readWorldPremise(undefined), '');
  assert.equal(readWorldPremise({}), '');
  assert.equal(readWorldPremise({ premise: '  已发生  ' }), '已发生');
});
