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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('normalizeTextLlmModel_非法回落默认豆包', () => {
  assert.equal(normalizeTextLlmModel('DeepSeek-V3.2'), 'DeepSeek-V3.2');
  assert.equal(normalizeTextLlmModel('foo'), DEFAULT_TEXT_LLM_MODEL);
  assert.equal(TEXT_LLM_MODELS.length, 6);
  assert.equal(TEXT_LLM_USAGE_CATALOG.length, 5);
});

test('生图配置页应有文案配置入口与独立路由', () => {
  const imageGen = readFileSync(join(root, 'src/components/ImageGenConfigManager.tsx'), 'utf8');
  assert.match(imageGen, /文案配置/);
  assert.match(imageGen, /\/admin\/text-llm/);

  const textLlm = readFileSync(join(root, 'src/components/TextLlmConfigManager.tsx'), 'utf8');
  assert.match(textLlm, /全站统一文本模型/);
  assert.match(textLlm, /epone\.ggb\.today/);

  const panel = readFileSync(join(root, 'src/page/AdminPanel.tsx'), 'utf8');
  assert.match(panel, /TextLlmConfigManager/);
  assert.match(panel, /\/admin\/text-llm/);

  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="\/admin\/text-llm"/);
});
