/**
 * 功能注释：本地联调只改 devApiPresets.ts 的 ACTIVE_DEV_API；含 gogo/neo/qqq
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  ACTIVE_DEV_API,
  DEV_API_PRESET_KEYS,
  buildViteDevProxy,
  getDevApiPreset,
  resolveDevApiPresetKey,
} from '../devApiPresets.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const presetsSrc = readFileSync(join(root, 'devApiPresets.ts'), 'utf8');

test('devApiPresets_应含正式测试同事三套与cf-local', () => {
  const expected = [
    'cf-test2',
    'cn-gogo',
    'cn-neo',
    'cn-prod',
    'cn-qqq',
    'cn-test',
    'local',
  ].sort();
  assert.deepEqual([...DEV_API_PRESET_KEYS].sort(), expected);
});

test('ACTIVE_DEV_API_须在文件顶部可改且能解析', () => {
  assert.match(presetsSrc, /export const ACTIVE_DEV_API/);
  assert.ok(DEV_API_PRESET_KEYS.includes(ACTIVE_DEV_API), ACTIVE_DEV_API);
  assert.equal(resolveDevApiPresetKey(), ACTIVE_DEV_API);
});

test('buildViteDevProxy_cn-test应rewrite到cn-test-api', () => {
  const p = buildViteDevProxy(getDevApiPreset('cn-test'));
  assert.equal(p['/api'].target, 'https://kurangames.cn');
  assert.equal(p['/api'].rewrite('/api/health'), '/cn-test-api/api/health');
});

test('buildViteDevProxy_须代理uploads与avatar避免本地404', () => {
  const p = buildViteDevProxy(getDevApiPreset('cf-test2'));
  assert.equal(p['/uploads'].target, 'https://api-test2.kurangames.com');
  assert.equal(
    p['/interactive-fiction-game-avatar'].target,
    'https://api-test2.kurangames.com',
  );
  assert.equal(p['/public'].target, 'https://api-test2.kurangames.com');
});

test('buildViteDevProxy_同事子域同源api无prefix', () => {
  for (const key of ['cn-gogo', 'cn-neo', 'cn-qqq']) {
    const p = buildViteDevProxy(getDevApiPreset(key));
    assert.match(p['/api'].target, /kurangames\.cn$/);
    assert.equal(p['/api'].rewrite, undefined);
  }
});

test('vite日志指引须指向单一文件ACTIVE_DEV_API', () => {
  const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
  assert.match(vite, /ACTIVE_DEV_API/);
  assert.match(vite, /devApiPresets\.ts/);
  assert.doesNotMatch(vite, /改 \.env\.development 的 VITE_DEV_API/);
});
