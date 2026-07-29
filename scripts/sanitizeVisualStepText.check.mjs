/**
 * sanitizeVisualStepText：场景切换控制指令不得泄漏到读者文案
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  processGameTags,
  sanitizeVisualStepText,
} from '../src/utils/textUtils.ts';

test('processGameTags_SCENE_CHANGE应静默丢弃不拼场景切换文案', () => {
  const out = processGameTags('[SCENE_CHANGE: folk_shelter_in_alley]\n[NARRATION: 巷子里很静。]');
  assert.doesNotMatch(out, /场景切换/);
  assert.doesNotMatch(out, /folk_shelter_in_alley/);
  assert.match(out, /巷子里很静/);
});

test('sanitizeVisualStepText_应剥已泄漏的场景切换sceneId行', () => {
  const out = sanitizeVisualStepText(
    '场景切换：folk_shelter_in_alley\n你钻进窄巷，两侧都是低矮的棚屋。',
  );
  assert.doesNotMatch(out, /场景切换/);
  assert.doesNotMatch(out, /folk_shelter/);
  assert.match(out, /窄巷/);
});
