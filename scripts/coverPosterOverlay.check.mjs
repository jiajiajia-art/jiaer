/**
 * 封面标题：model 臂不叠字；treatment 臂客户端叠原文。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCoverPosterOverlay } from '../src/utils/coverPosterOverlay.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('resolveCoverPosterOverlay_优先作品标题原文_treatment叠字', () => {
  const r = resolveCoverPosterOverlay({
    workTitle: '大学毕业第一份工作：送外卖',
    serverPosterTitle: '大学毕业第一份工作:送外卖',
    needsTitleOverlay: true,
    abArm: 'treatment',
    titleMode: 'overlay',
  });
  assert.equal(r.overlayTitle, '大学毕业第一份工作：送外卖');
  assert.equal(r.shouldOverlay, true);
});

test('resolveCoverPosterOverlay_model臂不叠字留给AI海报字', () => {
  const r = resolveCoverPosterOverlay({
    workTitle: '同桌的你',
    abArm: 'control',
    titleMode: 'model',
    needsTitleOverlay: false,
  });
  assert.equal(r.shouldOverlay, false);
  assert.equal(r.overlayTitle, '同桌的你');
});

test('resolveCoverPosterOverlay_无标题不叠字', () => {
  const r = resolveCoverPosterOverlay({ workTitle: '  ', serverPosterTitle: '' });
  assert.equal(r.shouldOverlay, false);
  assert.equal(r.overlayTitle, '');
});

test('CoverUpload_强制control模型画标题', () => {
  const tsx = read('src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx');
  assert.match(tsx, /abArm:\s*'control'/);
  assert.match(tsx, /buildCoverAiCreativePrompt/);
  assert.match(tsx, /resolveCoverPosterOverlay/);
});
