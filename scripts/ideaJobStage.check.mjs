/**
 * ideaJobStage 单测：stage key 与 i18n 映射
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatIdeaJobStage,
  isKnownIdeaJobStage,
  IDEA_JOB_STAGE_KEYS,
} from '../src/utils/ideaJobStage.ts';

const mockT = (key) => {
  const map = {
    'createGame.statusProcessing': '处理中',
    'createGame.ideaStageQueued': '排队中',
    'createGame.ideaStageGeneratingWorld': '生成世界观',
    'createGame.ideaStageGeneratingScenes': '生成场景',
    'createGame.ideaStageGeneratingNpcs': '生成角色',
    'createGame.ideaStageGeneratingMorePrompts': '生成补充提示词',
    'createGame.ideaStageWriting': '写入存档',
    'createGame.ideaStageDone': '完成',
  };
  return map[key] || key;
};

test('formatIdeaJobStage maps generating_more_prompts', () => {
  assert.equal(formatIdeaJobStage('generating_more_prompts', mockT), '生成补充提示词');
});

test('formatIdeaJobStage maps all pipeline stages', () => {
  assert.equal(formatIdeaJobStage('generating_world', mockT), '生成世界观');
  assert.equal(formatIdeaJobStage('generating_scenes', mockT), '生成场景');
  assert.equal(formatIdeaJobStage('generating_npcs', mockT), '生成角色');
  assert.equal(formatIdeaJobStage('writing', mockT), '写入存档');
});

test('formatIdeaJobStage falls back for empty stage', () => {
  assert.equal(formatIdeaJobStage('', mockT), '处理中');
  assert.equal(formatIdeaJobStage(undefined, mockT), '处理中');
});

test('formatIdeaJobStage returns raw unknown stage', () => {
  assert.equal(formatIdeaJobStage('custom_stage', mockT), 'custom_stage');
});

test('isKnownIdeaJobStage recognizes pipeline keys', () => {
  for (const key of IDEA_JOB_STAGE_KEYS) {
    assert.equal(isKnownIdeaJobStage(key), true);
  }
  assert.equal(isKnownIdeaJobStage('unknown'), false);
});
