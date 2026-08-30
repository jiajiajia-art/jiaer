/**
 * 后台文案 LLM 配置：模型校验与路由/UI 接线。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_TEXT_LLM_MODEL,
  TEXT_LLM_MODELS,
  TEXT_LLM_USAGE_CATALOG,
  normalizeTextLlmModel,
} from '../src/lib/textLlmConfig.ts';
import { resolveModelConfigPane } from '../src/lib/modelConfigPane.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('normalizeTextLlmModel_非法回落默认豆包', () => {
  assert.equal(normalizeTextLlmModel('DeepSeek-V3.2'), 'DeepSeek-V3.2');
  assert.equal(normalizeTextLlmModel('foo'), DEFAULT_TEXT_LLM_MODEL);
  assert.equal(TEXT_LLM_MODELS.length, 6);
  assert.equal(TEXT_LLM_USAGE_CATALOG.length, 5);
});

test('resolveModelConfigPane_按路由切换生图与文案', () => {
  assert.equal(resolveModelConfigPane('/admin/image-gen'), 'image');
  assert.equal(resolveModelConfigPane('/funloom/admin/image-gen'), 'image');
  assert.equal(resolveModelConfigPane('/admin/text-llm'), 'text');
  assert.equal(resolveModelConfigPane('/admin/text-llm?x=1'), 'text');
});

test('ModelConfigHub_同页双轨Tab与文案内容', () => {
  const hub = readFileSync(join(root, 'src/components/ModelConfigHub.tsx'), 'utf8');
  assert.match(hub, /一处配置，全站文案同模型/);
  assert.match(hub, /epone\.ggb\.today/);
  assert.match(hub, /role="radiogroup"/);
  assert.match(hub, /role="tablist"/);
  assert.match(hub, /ModelConfigHub\.module\.css/);

  const css = readFileSync(join(root, 'src/components/ModelConfigHub.module.css'), 'utf8');
  assert.match(css, /--mc-coral/);
  assert.match(css, /Noto Serif SC/);
  assert.match(css, /\.railThumb/);

  const panel = readFileSync(join(root, 'src/page/AdminPanel.tsx'), 'utf8');
  assert.match(panel, /ModelConfigHub/);
  assert.match(panel, /\/admin\/text-llm/);

  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="\/admin\/text-llm"/);
});

test('textLlmConfig_模型展示标签可读', async () => {
  const mod = await import('../src/lib/textLlmConfig.ts');
  assert.equal(mod.getTextLlmModelLabel('doubao-seed-1-8-251228'), '豆包 Seed 1.8');
  assert.equal(mod.getTextLlmModelVendor('DeepSeek-V3.2'), 'DeepSeek · epone');
  assert.ok(mod.isDefaultTextLlmModel(DEFAULT_TEXT_LLM_MODEL));
});
