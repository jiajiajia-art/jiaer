/**
 * 后台文案 LLM 配置：模型校验、网关 URL、路由/UI 接线。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_TEXT_LLM_GATEWAY_PRESETS,
  DEFAULT_TEXT_LLM_MODEL,
  TEXT_LLM_MODELS,
  TEXT_LLM_USAGE_CATALOG,
  normalizeTextLlmModel,
  normalizeTextLlmOpenAiBaseUrl,
  resolvePreferredTextLlmGatewayPresetId,
  resolveTextLlmGatewayPresetId,
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
  assert.equal(TEXT_LLM_USAGE_CATALOG.length, 7);
  assert.ok(TEXT_LLM_USAGE_CATALOG.some((row) => row.key === 'romance_world_gen'));
  assert.ok(TEXT_LLM_USAGE_CATALOG.some((row) => row.key === 'romance_play'));
});

test('normalizeTextLlmOpenAiBaseUrl_剥completions路径', () => {
  assert.equal(
    normalizeTextLlmOpenAiBaseUrl('https://api.deepseek.com/v1/chat/completions'),
    'https://api.deepseek.com',
  );
  assert.equal(
    normalizeTextLlmOpenAiBaseUrl('https://tokenhub.tencentmaas.com/v1'),
    'https://tokenhub.tencentmaas.com',
  );
  const tokenhub = DEFAULT_TEXT_LLM_GATEWAY_PRESETS.find((p) => p.id === 'tokenhub');
  assert.equal(tokenhub?.label, 'TokenHub');
  assert.equal(tokenhub?.baseUrl, 'https://tokenhub.tencentmaas.com');
  assert.equal(resolveTextLlmGatewayPresetId('https://api.deepseek.com'), 'deepseek');
  assert.equal(resolveTextLlmGatewayPresetId('https://tokenhub.tencentmaas.com/v1'), 'tokenhub');
});

test('resolvePreferredTextLlmGatewayPresetId_DeepSeek预置走epone_豆包不切', () => {
  assert.equal(resolvePreferredTextLlmGatewayPresetId('deepseek-v4.1-flash'), 'epone');
  assert.equal(resolvePreferredTextLlmGatewayPresetId('deepseek-v4-pro-0813'), 'epone');
  assert.equal(resolvePreferredTextLlmGatewayPresetId('doubao-seed-2-1-lite-260915'), '');
  assert.equal(resolvePreferredTextLlmGatewayPresetId(''), '');
});

test('resolveModelConfigPane_按路由切换生图与文案', () => {
  assert.equal(resolveModelConfigPane('/admin/image-gen'), 'image');
  assert.equal(resolveModelConfigPane('/funloom/admin/image-gen'), 'image');
  assert.equal(resolveModelConfigPane('/admin/text-llm'), 'text');
  assert.equal(resolveModelConfigPane('/admin/text-llm?x=1'), 'text');
});

test('ModelConfigHub_同页双轨配置且模型只能拉取导入', () => {
  const hub = readFileSync(join(root, 'src/components/ModelConfigHub.tsx'), 'utf8');
  assert.match(hub, /全平台统一生文模型/);
  assert.match(hub, /onActivate={pane === 'text'/);
  assert.match(hub, /deactivateModel/);
  assert.match(hub, /模型 ID 不允许手填/);
  assert.match(hub, /保存并拉取模型/);
  assert.match(hub, /baseUrl/);
  assert.match(hub, /listModels/);
  assert.match(hub, /ModelImportDialog/);
  assert.match(hub, /activateModel/);
  assert.match(hub, /type="password"/);
  assert.match(hub, /页面不会回显明文/);
  assert.doesNotMatch(hub, /gatewayKeys|selectPresetTextModel|role="radiogroup"/);
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
  assert.match(panel, /AiModelCenter/);
  assert.match(panel, /\/admin\/text-llm/);

  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="\/admin\/text-llm"/);
});

test('textLlmConfig_模型展示标签可读', async () => {
  const mod = await import('../src/lib/textLlmConfig.ts');
  assert.equal(mod.getTextLlmModelLabel('doubao-seed-2-1-lite-260915'), '豆包 Seed 2.1 Lite');
  assert.equal(mod.getTextLlmModelLabel('deepseek-v4.1-flash'), 'DeepSeek V4.1 Flash');
  assert.equal(mod.getTextLlmModelLabel('deepseek-v4-flash-0731'), 'DeepSeek V4 Flash 0731');
  assert.equal(mod.getTextLlmModelVendor('deepseek-v3.2'), 'DeepSeek · epone / ggb');
  assert.ok(mod.isDefaultTextLlmModel(DEFAULT_TEXT_LLM_MODEL));
});
