import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('normalizeSquareCropRect_选区内居中取方_不贴左上角偏移', async () => {
  const { normalizeSquareCropRect } = await import(join(root, 'src/lib/galgame/squareAvatarPrep.ts'));
  // 宽 120 高 100 的框 → 边长 100，水平居中 +10
  const square = normalizeSquareCropRect(
    { left: 50, top: 20, width: 120, height: 100 },
    400,
    300,
  );
  assert.equal(square.width, 100);
  assert.equal(square.height, 100);
  assert.equal(square.left, 60);
  assert.equal(square.top, 20);
});

test('normalizeSquareCropRect_钳制在原图内_禁止越界', async () => {
  const { normalizeSquareCropRect } = await import(join(root, 'src/lib/galgame/squareAvatarPrep.ts'));
  const square = normalizeSquareCropRect(
    { left: 350, top: 250, width: 100, height: 100 },
    400,
    300,
  );
  assert.equal(square.width, 50);
  assert.equal(square.height, 50);
  assert.ok(square.left + square.width <= 400);
  assert.ok(square.top + square.height <= 300);
});

test('resolveLibraryAvatarDisplayUrl_禁止优先头顶thumb', async () => {
  const { resolveLibraryAvatarDisplayUrl } = await import(join(root, 'src/lib/galgame/squareAvatarPrep.ts'));
  assert.equal(
    resolveLibraryAvatarDisplayUrl({
      imageUrl: '/a/full.webp',
      thumbUrl: '/a/full.150.webp',
      originalUrl: '/a/orig.webp',
    }),
    '/a/full.webp',
  );
  assert.equal(
    resolveLibraryAvatarDisplayUrl({
      imageUrl: '',
      thumbUrl: '/only-thumb.webp',
      originalUrl: '/orig.webp',
    }),
    '/orig.webp',
  );
  assert.equal(resolveLibraryAvatarDisplayUrl({ thumbUrl: '/t.webp' }), '');
});

test('头像库展示链路_禁止bust与thumb优先', () => {
  const frame = readFileSync(join(root, 'src/components/Avatar/AvatarFrame.tsx'), 'utf8');
  const page = readFileSync(join(root, 'src/page/warehouse/WarehouseAvatarLibrary.tsx'), 'utf8');
  const admin = readFileSync(join(root, 'src/components/admin/AdminPublicAvatarManager.tsx'), 'utf8');
  const gate = readFileSync(join(root, 'src/components/Avatar/SquareAvatarCropGate.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/components/Avatar/AvatarFrame.module.css'), 'utf8');

  assert.doesNotMatch(frame, /TrimmedTransparentImg|variant=["']bust["']/);
  assert.match(frame, /<img\s/);
  assert.match(css, /object-position:\s*center/);
  assert.doesNotMatch(css, /object-position:\s*top/);
  assert.match(page, /resolveLibraryAvatarDisplayUrl/);
  assert.doesNotMatch(page, /thumbUrl\s*\|\|\s*item\.imageUrl/);
  assert.match(admin, /resolveLibraryAvatarDisplayUrl/);
  assert.doesNotMatch(admin, /thumbUrl\s*\|\|\s*item\.imageUrl/);
  assert.match(gate, /normalizeSquareCropRect/);
});
