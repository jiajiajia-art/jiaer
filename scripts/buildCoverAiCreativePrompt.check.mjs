/**
 * 封面生图提示词：示例样式并入 AI prompt。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoverAiCreativePrompt } from '../src/utils/buildCoverAiCreativePrompt.ts';

test('buildCoverAiCreativePrompt_空草稿用作品标题加示例样式', () => {
  const p = buildCoverAiCreativePrompt({
    promptDraft: '',
    styleId: 'cheeseNeon',
    workTitle: '同桌的你',
  });
  assert.match(p, /同桌的你/);
  assert.match(p, /奶酪|黄油/);
});

test('buildCoverAiCreativePrompt_用户已写字体则不重复示例', () => {
  const p = buildCoverAiCreativePrompt({
    promptDraft: '红色描边、字体白色,艺术奶酪体',
    styleId: 'classic',
    workTitle: '同桌的你',
  });
  assert.match(p, /红色描边/);
  assert.doesNotMatch(p, /经典白色宋体/);
});
