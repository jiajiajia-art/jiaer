/**
 * 后台生图配置：模型校验与提交 payload 组装。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_IMAGE_GEN_MODEL,
  IMAGE_GEN_MODELS,
  IMAGE_GEN_MODULE_CATALOG,
  isImageGenModel,
  normalizeImageGenModel,
  toImageGenModelsPayload,
} from '../src/lib/imageGenConfig.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('normalizeImageGenModel_非法回落默认', () => {
  assert.equal(normalizeImageGenModel('nano-banana-2'), 'nano-banana-2');
  assert.equal(normalizeImageGenModel('gpt-image-2'), 'gpt-image-2');
  assert.equal(normalizeImageGenModel('nano-banana'), DEFAULT_IMAGE_GEN_MODEL);
  assert.equal(isImageGenModel('gpt-image-2'), true);
  assert.equal(isImageGenModel('foo'), false);
  assert.deepEqual([...IMAGE_GEN_MODELS], ['nano-banana-2', 'gpt-image-2']);
  assert.equal(IMAGE_GEN_MODULE_CATALOG.length, 5);
});

test('toImageGenModelsPayload_应按 key 组装', () => {
  const payload = toImageGenModelsPayload([
    { key: 'visual', model: 'nano-banana-2' },
    { key: 'legacy', model: 'bad' },
    { key: '', model: 'gpt-image-2' },
  ]);
  assert.equal(payload.visual, 'nano-banana-2');
  assert.equal(payload.legacy, DEFAULT_IMAGE_GEN_MODEL);
  assert.equal(Object.keys(payload).includes(''), false);
});

test('AdminPanel_应包含生图配置菜单与路由', () => {
  const panel = readFileSync(join(root, 'src/page/AdminPanel.tsx'), 'utf8');
  assert.match(panel, /生图配置/);
  assert.match(panel, /imageGen/);
  assert.match(panel, /\/admin\/image-gen/);
  assert.match(panel, /ImageGenConfigManager/);

  const imageGenManager = readFileSync(join(root, 'src/components/ImageGenConfigManager.tsx'), 'utf8');
  assert.match(imageGenManager, /文案配置/);
  assert.match(imageGenManager, /\/admin\/text-llm/);

  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="\/admin\/image-gen"/);

  // 功能注释：菜单顺序须在提现与抽奖之间
  const withdrawIdx = panel.indexOf(">提现管理<");
  const imageGenIdx = panel.indexOf(">生图配置<");
  const lotteryIdx = panel.indexOf(">抽奖活动<");
  assert.ok(withdrawIdx > 0 && imageGenIdx > withdrawIdx && lotteryIdx > imageGenIdx);
});
