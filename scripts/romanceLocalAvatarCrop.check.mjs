/**
 * Romance 游玩端「从本地上传」须走裁切+预览，禁止 FileReader 直出原图。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('romance_本地上传头像_裁切与预览已挂载', () => {
  const ui = readFileSync(join(romance, 'components/ui.tsx'), 'utf8');
  const flow = readFileSync(join(romance, 'components/LocalAvatarCropFlow.tsx'), 'utf8');
  const lib = readFileSync(join(romance, 'lib/squareAvatarLocal.ts'), 'utf8');
  const picker = readFileSync(join(romance, 'components/AvatarLibraryPicker.tsx'), 'utf8');

  assert.match(ui, /LocalAvatarCropFlow/);
  assert.match(ui, /setLocalFile|localFile/);
  assert.doesNotMatch(ui, /r\.readAsDataURL\(f\)/);
  assert.match(flow, /裁切并预览|使用此头像|重新裁切/);
  assert.match(flow, /allowClose|须完成裁切/);
  assert.match(lib, /exportSquareDataUrl|isApproxSquare|LOCAL_AVATAR_TARGET_SIDE/);
  assert.match(picker, /从本地上传/);
  assert.match(picker, /保存/);
  assert.match(picker, /标签筛选|genderFilter|ageFilter/);
  assert.match(picker, /setSelected|selected/);
  // 点图只高亮，须点保存才 onPick
  assert.match(picker, /onClick=\{\(\) => setSelected\(url\)\}/);
  assert.doesNotMatch(picker, /onClick=\{\(\) => onPick\(url\)\}/);
  // 标签区只保留性别/年龄 chip，禁止重复的「青年女性 女·成年·N张」快捷条与分区 h4
  assert.doesNotMatch(picker, /快捷分类/);
  assert.doesNotMatch(picker, /<h4[\s\S]*?p\.hint/);
});

test('romance_squareAvatarLocal_分类与方图判定', async () => {
  const mod = await import(join(romance, 'lib/squareAvatarLocal.ts'));
  assert.equal(mod.isApproxSquare(512, 512), true);
  assert.equal(mod.isApproxSquare(512, 768), false);
  assert.ok(mod.assertMinSide(200, 200));
  assert.equal(mod.assertMinSide(300, 300), null);
  assert.equal(mod.LOCAL_AVATAR_FILL, '#1c1c1e');
});
