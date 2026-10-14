/**
 * 前端 API 基址须可由 VITE_API_BASE_URL 驱动（双环境部署）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, '../src/config.ts');

test('config_使用VITE_API_BASE_URL', () => {
  const src = fs.readFileSync(configPath, 'utf8');
  assert.match(src, /VITE_API_BASE_URL/);
  assert.match(src, /resolveHostAddress/);
  // 禁止再默认硬编码 test2 生产误发
  assert.doesNotMatch(src, /export const HOST_ADDRESS = 'https:\/\/api-test2/);
});

test('config_Aliyun同源空基址_应在VITE_RUNTIME为aliyun时回退空串', () => {
  const src = fs.readFileSync(configPath, 'utf8');
  assert.match(src, /VITE_RUNTIME/);
  assert.match(src, /=== 'aliyun'/);
  assert.match(src, /return '';/);
});
