/**
 * 作品栏书名号：预览要能看出《》，编辑器不得再把复选框挤出卡片。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('worksMarkPreview_开则加书名号_关则只留作品名', async () => {
  const { worksMarkPreview } = await import(pathToFileURL(join(romance, 'lib/worksChip.ts')).href);
  assert.equal(worksMarkPreview(['半城烟雨'], false), '《半城烟雨》');
  assert.equal(worksMarkPreview(['半城烟雨'], undefined), '《半城烟雨》');
  assert.equal(worksMarkPreview(['《半城烟雨》'], true), '半城烟雨');
  assert.equal(worksMarkPreview([], false), '《风起南巷》');
  assert.equal(worksMarkPreview('不是数组', true), '风起南巷');
});

test('ModEditorPanel_书名号开关须留在卡片内', () => {
  const src = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(src, /worksMarkPreview\(n\.works, n\.worksPlain\)/);
  assert.match(src, /flex-wrap/);
  assert.match(src, /《书名号》/);
  assert.match(src, /overflow-x-hidden rounded-xl border border-line bg-paper/);
  assert.match(src, /max-w-full resize-y/);
  assert.match(src, /会走动/);
  assert.doesNotMatch(src, /<option value="roam">会走动<\/option>/);
});
