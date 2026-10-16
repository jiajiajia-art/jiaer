/**
 * 后台文案 LLM 配置：模型校验、网关 URL、路由/UI 接线。
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
  normalizeTextLlmOpenAiBaseUrl,
} from '../src/lib/textLlmConfig.ts';
import { resolveModelConfigPane } from '../src/lib/modelConfigPane.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('normalizeTextLlmModel_非法回落默认豆包', () => {
  assert.equal(normalizeTextLlmModel('deepseek-v3.2'), 'deepseek-v3.2');
  assert.equal(normalizeTextLlmModel('DeepSeek-V4-Flash 0731'), 'deepseek-v4-flash-0731');
  assert.equal(normalizeTextLlmModel('deepseek-v4.1-flash'), 'deepseek-v4.1-flash');
  assert.equal(normalizeTextLlmModel('deepseek-chat'), 'deepseek-chat');
  assert.equal(normalizeTextLlmModel('foo bar'), DEFAULT_TEXT_LLM_MODEL);
  assert.equal(TEXT_LLM_MODELS.length, 7);
  assert.ok(TEXT_LLM_MODELS.includes('deepseek-v4.1-flash'));
  assert.ok(TEXT_LLM_MODELS.every((m) => !/\s/.test(m)));
  assert.equal(TEXT_LLM_USAGE_CATALOG.length, 5);
});

test('normalizeTextLlmOpenAiBaseUrl_剥completions路径', () => {
  assert.equal(
    normalizeTextLlmOpenAiBaseUrl('https://api.deepseek.com/v1/chat/completions'),
    'https://api.deepseek.com',
  );
});

test('resolveModelConfigPane_按路由切换生图与文案', () => {
  assert.equal(resolveModelConfigPane('/admin/image-gen'), 'image');
  assert.equal(resolveModelConfigPane('/funloom/admin/image-gen'), 'image');
  assert.equal(resolveModelConfigPane('/admin/text-llm'), 'text');
  assert.equal(resolveModelConfigPane('/admin/text-llm?x=1'), 'text');
});

test('ModelConfigHub_同页双轨Tab与文案网关设置', () => {
  const hub = readFileSync(join(root, 'src/components/ModelConfigHub.tsx'), 'utf8');
  assert.match(hub, /一处配置，全站文案同模型/);
  assert.match(hub, /文案请求设置/);
  assert.match(hub, /不影响生图 ggb/);
  assert.match(hub, /拉取模型/);
  assert.match(hub, /openaiBaseUrl/);
  assert.match(hub, /listModels/);
  assert.match(hub, /api\.deepseek\.com/);
  assert.match(hub, /与生图网关互不影响/);
  assert.match(hub, /role="radiogroup"/);
  // 功能注释：文案与生图网关 state 必须分离
  assert.match(hub, /imageOpenaiBaseUrl/);
  assert.match(hub, /openaiBaseUrl/);

  assert.match(hub, /role="tablist"/);
  assert.match(hub, /ModelConfigHub\.module\.css/);

  const css = readFileSync(join(root, 'src/components/ModelConfigHub.module.css'), 'utf8');
  assert.match(css, /--mc-coral/);
  assert.match(css, /Noto Serif SC/);
  assert.match(css, /\.presetChip/);
  assert.match(css, /\.fetchBtn/);

  const api = readFileSync(join(root, 'src/api/admin/textLlmConfigApi.ts'), 'utf8');
  assert.match(api, /text-llm-config\/models/);
  assert.match(api, /openaiApiKey/);

  const panel = readFileSync(join(root, 'src/page/AdminPanel.tsx'), 'utf8');
  assert.match(panel, /ModelConfigHub/);
  assert.match(panel, /\/admin\/text-llm/);

  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="\/admin\/text-llm"/);
});

test('textLlmConfig_模型展示标签可读', async () => {
  const mod = await import('../src/lib/textLlmConfig.ts');
  assert.equal(mod.getTextLlmModelLabel('doubao-seed-2-1-lite-260915'), '豆包 Seed 2.1 Lite');
  assert.equal(mod.getTextLlmModelLabel('deepseek-v4.1-flash'), 'DeepSeek V4.1 Flash');
  assert.equal(mod.getTextLlmModelLabel('deepseek-v4-flash-0731'), 'DeepSeek V4 Flash 0731');
  assert.equal(mod.getTextLlmModelVendor('deepseek-v3.2'), 'DeepSeek · OpenAI 兼容');
  assert.ok(mod.isDefaultTextLlmModel(DEFAULT_TEXT_LLM_MODEL));
});
