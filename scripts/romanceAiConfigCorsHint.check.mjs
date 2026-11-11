/**
 * Romance AI 配置：浏览器直连第三方时常见 CORS；模型须可手填，并提示 /v1 与跨域。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('AIConfigPanel_模型应可手填并带datalist', () => {
  const tsx = read('Romance/src/components/AIConfigPanel.tsx');
  assert.match(tsx, /list="romance-ai-model-list"/);
  assert.match(tsx, /<datalist id="romance-ai-model-list">/);
  assert.match(tsx, /手填模型 id/);
  assert.doesNotMatch(tsx, /（点击右侧获取模型列表）/);
});

test('AIConfigPanel_应提示TokenHub需v1与CORS限制', () => {
  const tsx = read('Romance/src/components/AIConfigPanel.tsx');
  assert.match(tsx, /tokenhub\.tencentmaas\.com\/v1/);
  assert.match(tsx, /跨域|CORS/);
});

test('aiFetch_跨域失败应提示CORS而非笼统Failed to fetch', () => {
  const src = read('Romance/src/lib/ai.ts');
  assert.match(src, /未允许网页跨域访问（CORS）/);
  assert.match(src, /\/v1/);
});
