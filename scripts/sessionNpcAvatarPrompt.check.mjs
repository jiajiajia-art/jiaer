/**
 * 立绘提示词：固定+风格+动态人设外貌+禁止词；不得含态度/详细简介
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionNpcAvatarPrompt,
  buildPlayerArchiveAvatarBasePrompt,
  DEFAULT_AVATAR_STYLE,
  normalizeAvatarStyleId,
} from '../src/lib/galgame/sessionNpcAvatarPrompt.ts';

test('buildSessionNpcAvatarPrompt_不含态度与详细简介_人设进Appearance', () => {
  const prompt = buildSessionNpcAvatarPrompt({
    name: '红红',
    gender: 'male',
    relationship: '导入角色',
    summary: '长棕卷发紫瞳，喜欢洛丽塔',
    attitudeToPlayer: '非常讨厌我，因为他喜欢沈曼',
    detailedBio: '补充经历：其实暗恋沈曼很多年',
  });
  assert.match(prompt, /Name: 红红/);
  assert.match(prompt, /Appearance and role: 长棕卷发紫瞳/);
  assert.match(prompt, /must match the Appearance and role description/);
  assert.doesNotMatch(prompt, /Attitude vibe/i);
  assert.doesNotMatch(prompt, /Extra persona/i);
  assert.doesNotMatch(prompt, /讨厌我/);
  assert.doesNotMatch(prompt, /暗恋沈曼/);
});

test('buildSessionNpcAvatarPrompt_固定风格动态禁止词齐全', () => {
  const prompt = buildSessionNpcAvatarPrompt({
    name: '红红',
    gender: 'male',
  });
  assert.match(prompt, /Create a single full-body character sprite/i);
  assert.match(prompt, /Japanese anime visual novel/i);
  assert.match(prompt, /Gender: male/);
  assert.match(prompt, /gender must strictly remain/i);
  assert.match(prompt, /硬性要求/);
  assert.match(prompt, /Negative prompt:/i);
  assert.equal(DEFAULT_AVATAR_STYLE, 'A');
  assert.equal(normalizeAvatarStyleId('x'), 'A');
});

test('buildPlayerArchiveAvatarBasePrompt_人设进动态Appearance', () => {
  const prompt = buildPlayerArchiveAvatarBasePrompt({
    name: '沈清沅',
    gender: 'female',
    persona: '江南世家嫡女',
    styleId: 'D',
  });
  assert.match(prompt, /Name: 沈清沅/);
  assert.match(prompt, /Gender: female/);
  assert.match(prompt, /Relationship to player: 主角/);
  assert.match(prompt, /Appearance and role: 江南世家嫡女/);
  assert.match(prompt, /ancient Chinese watercolor/i);
});
