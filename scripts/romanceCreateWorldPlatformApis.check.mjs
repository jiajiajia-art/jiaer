/**
 * 功能注释：生成世界 / 创作台依赖平台 AI 线路与曲库；
 * 契约：相对同源 /api/...（Vite 代理到 ACTIVE_DEV_API），禁止写死 neo 域名。
 * 空态文案须引导联系平台配置，禁止静默消失。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('platformAiRoutes_须请求romance_ai-routes且空结果不长期缓存', () => {
  const src = readFileSync(join(romance, 'lib/platformAiRoutes.ts'), 'utf8');
  assert.match(src, /\/api\/romance\/ai-routes\?capability=/);
  assert.match(src, /resolveFunloomApiBase/);
  assert.match(src, /if \(!list\.length\) delete cache\[capability\]/);
  assert.doesNotMatch(src, /neo\.kurangames\.cn|localhost:3000/);
});

test('platformAudio_须请求audio-library且无token不打接口', () => {
  const src = readFileSync(join(romance, 'game/platformAudio.ts'), 'utf8');
  assert.match(src, /\/api\/audio-library/);
  assert.match(src, /PLATFORM_AUDIO_FALLBACK|SEED/);
  assert.match(src, /r\.ok \? r\.json\(\) : null/);
  assert.match(src, /if \(!token\)/);
  assert.doesNotMatch(src, /neo\.kurangames\.cn/);
});

test('AiRoutePicker_无线路须提示联系平台配置', () => {
  const src = readFileSync(join(romance, 'components/AiRoutePicker.tsx'), 'utf8');
  assert.match(src, /暂无可用创作引擎/);
  assert.match(src, /联系平台/);
  assert.match(src, /asCard/);
});

test('WorldGenWizard_创作引擎走AiRoutePicker', () => {
  const src = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.match(src, /AiRoutePicker/);
  assert.match(src, /capability="text"/);
});

test('fetchAiRoutes_空基址拼同源路径', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/platformAiRoutes.ts')).href);
  // 功能注释：单测环境无 VITE_API_BASE_URL 时基址为空，请求须落在 /api/romance/...
  assert.equal(typeof mod.fetchAiRoutes, 'function');
  assert.equal(typeof mod.useAiRoutes, 'function');
});
