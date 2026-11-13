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

test('AdminPanel_应包含 AI 模型中心与兼容路由', () => {
  const panel = readFileSync(join(root, 'src/page/AdminPanel.tsx'), 'utf8');
  // 侧栏文案已抽到 admin-shell/adminNavigation.tsx
  const nav = readFileSync(join(root, 'src/components/admin-shell/adminNavigation.tsx'), 'utf8');
  assert.match(nav, /label: 'AI 模型中心'/);
  assert.match(panel, /aiModelCenter/);
  assert.match(panel, /\/admin\/image-gen/);
  assert.match(panel, /AiModelCenter/);

  const hub = readFileSync(join(root, 'src/components/ModelConfigHub.tsx'), 'utf8');
  assert.match(hub, /role="tablist"/);
  assert.match(hub, /生图配置/);
  assert.match(hub, /生文配置/);
  assert.match(hub, /保存并拉取模型/);
  assert.match(hub, /ModelImportDialog/);
  assert.match(hub, /ModelCatalogCards/);
  assert.doesNotMatch(hub, /toImageGenModelsPayload|handleImageModelChange/);

  const api = readFileSync(join(root, 'src/api/admin/imageGenConfigApi.ts'), 'utf8');
  assert.match(api, /image-gen-config\/models/);
  assert.match(api, /openaiApiKey/);

  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="\/admin\/image-gen"/);

  assert.match(panel, /<AiModelCenter isAdmin \/>/);
});
