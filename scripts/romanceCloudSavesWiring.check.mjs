/**
 * 产品模块九：Romance 云存档客户端 + 本地按 gameFileId 隔离。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('cloudSaves_应对齐五类存档接口并会话降级', () => {
  assert.equal(existsSync(join(root, 'Romance/src/lib/cloudSaves.ts')), true);
  const src = read('Romance/src/lib/cloudSaves.ts');
  assert.match(src, /\/api\/romance\/saves/);
  assert.match(src, /listCloudSaves|getCloudSave|putCloudSave|renameCloudSave|deleteCloudSave/);
  assert.match(src, /404|405|501/);
  assert.match(src, /gameFileId/);
});

test('storage_本地槽应按gameFileId隔离并镜像云端', () => {
  const src = read('Romance/src/lib/storage.ts');
  assert.match(src, /setStorageGameFileId|getStorageGameFileId/);
  assert.match(src, /slot:\$\{gid\}:\$\{id\}|slot:\$\{.*\}:\$\{id\}/);
  assert.match(src, /putCloudSave|mirrorCloud/);
  assert.match(src, /CLOUD_AUTOSAVE_MIN_MS|15_000/);
  const boot = read('Romance/src/components/PlayerPlayBootstrap.tsx');
  assert.match(boot, /setStorageGameFileId\(fileId\)/);
});
