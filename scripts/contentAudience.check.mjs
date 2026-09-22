/**
 * 作品分类单选工具与发布弹窗接线契约
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONTENT_AUDIENCE_OPTIONS,
  isValidContentAudience,
  normalizeContentAudience,
  selectContentAudience,
} from '../src/utils/contentAudience.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('normalizes content audience to male/female/all only', () => {
  assert.equal(normalizeContentAudience('male'), 'male');
  assert.equal(normalizeContentAudience('FEMALE'), 'female');
  assert.equal(normalizeContentAudience('all'), 'all');
  assert.equal(normalizeContentAudience('other'), null);
  assert.equal(isValidContentAudience('male'), true);
  assert.equal(isValidContentAudience(null), false);
  assert.deepEqual([...CONTENT_AUDIENCE_OPTIONS], ['male', 'female', 'all']);
});

test('selectContentAudience always keeps a single selected value', () => {
  assert.equal(selectContentAudience(null, 'male'), 'male');
  assert.equal(selectContentAudience('male', 'female'), 'female');
  assert.equal(selectContentAudience('female', 'all'), 'all');
});

test('PublishSettingsModal renders audience field before theme tags and persists it', () => {
  const tsx = read('src/components/CommonModal/PublishSettingsModal.tsx');
  assert.match(tsx, /ContentAudienceField/);
  assert.match(tsx, /audienceType: selectedAudienceType/);
  assert.match(tsx, /audienceType: selectedAudienceType/);
  assert.match(tsx, /setGameTagsForGame\(\{[\s\S]*audienceType/);
  assert.match(tsx, /isValidContentAudience\(selectedAudienceType\)/);
  // 作品分类必须出现在作品标签面板之前
  const audienceIdx = tsx.indexOf('<ContentAudienceField');
  const tagsIdx = tsx.indexOf('styles.themeTagsPanel');
  assert.ok(audienceIdx > 0 && tagsIdx > audienceIdx);
});

test('WorldSettingForm places content audience before game tags', () => {
  const tsx = read('src/components/GameSettingEditor/WorldPanel/WorldSettingForm.tsx');
  const audienceIdx = tsx.indexOf('<ContentAudienceField');
  const tagsIdx = tsx.indexOf("createGame.gameTags");
  assert.ok(audienceIdx > 0 && tagsIdx > audienceIdx);
});
