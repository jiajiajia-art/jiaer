/**
 * 封面生图提示词：仅用户输入，不默认塞字体要求。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoverAiCreativePrompt } from '../src/utils/buildCoverAiCreativePrompt.ts';

test('buildCoverAiCreativePrompt_空草稿返回空串', () => {
  assert.equal(buildCoverAiCreativePrompt({ promptDraft: '' }), '');
  assert.equal(buildCoverAiCreativePrompt({ promptDraft: '  ' }), '');
});

test('buildCoverAiCreativePrompt_有输入原样返回', () => {
  const p = buildCoverAiCreativePrompt({
    promptDraft: '红色描边、字体白色,艺术奶酪体',
  });
  assert.equal(p, '红色描边、字体白色,艺术奶酪体');
});
