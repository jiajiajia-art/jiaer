/**
 * 契约：批量立绘 status 轮询必须 timeout:0（后端在 status 内 await 单张生图）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const editorData = readFileSync(
  join(root, 'src/api/galgame/EditorData.ts'),
  'utf8',
);

test('getGenerateAllImagesJobStatus_须timeout0', () => {
  const fn = editorData.slice(
    editorData.indexOf('getGenerateAllImagesJobStatus:'),
    editorData.indexOf('getGenerateAllImagesJobResult:'),
  );
  assert.ok(fn.length > 40, 'missing getGenerateAllImagesJobStatus');
  assert.match(fn, /timeout:\s*0/);
  assert.match(fn, /generate-images\/jobs\/\$\{jobId\}\/status/);
});
