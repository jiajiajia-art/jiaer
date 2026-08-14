/**
 * 立绘提示词不得含态度/详细简介
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionNpcAvatarPrompt } from '../src/lib/galgame/sessionNpcAvatarPrompt.ts';

test('buildSessionNpcAvatarPrompt_不含态度与详细简介', () => {
  const prompt = buildSessionNpcAvatarPrompt({
    name: '红红',
    gender: 'male',
    relationship: '导入角色',
    summary: '长棕卷发紫瞳，喜欢洛丽塔',
    attitudeToPlayer: '非常讨厌我，因为他喜欢沈曼',
    detailedBio: '补充经历：其实暗恋沈曼很多年',
  });
  assert.match(prompt, /Appearance and role/);
  assert.doesNotMatch(prompt, /Attitude vibe/i);
  assert.doesNotMatch(prompt, /Extra persona/i);
  assert.doesNotMatch(prompt, /讨厌我/);
  assert.doesNotMatch(prompt, /暗恋沈曼/);
});

test('buildSessionNpcAvatarPrompt_仍保留姓名性别简介', () => {
  const prompt = buildSessionNpcAvatarPrompt({
    name: '红红',
    gender: 'male',
    summary: '黑发男生',
  });
  assert.match(prompt, /红红/);
  assert.match(prompt, /\bmale\b/);
  assert.match(prompt, /黑发男生/);
});
