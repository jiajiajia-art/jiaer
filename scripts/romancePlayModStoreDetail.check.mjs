/**
 * 玩法 Mod 商店：列表点进详情；详情含作者/下载量/说明/预览图；上传上架契约
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const modal = readFileSync(join(romance, 'components/AddPlayModModal.tsx'), 'utf8');
const catalogSrc = readFileSync(join(romance, 'mods/playModCatalog.ts'), 'utf8');
const admin = readFileSync(join(root, 'src/components/admin/AdminPlayModManager.tsx'), 'utf8');
const api = readFileSync(join(root, 'src/api/playMod/playModApi.ts'), 'utf8');

test('AddPlayModModal_点条目进详情且添加按钮含依赖文案', () => {
  assert.match(modal, /setDetailSlug/);
  assert.match(modal, /play-mod-detail/);
  assert.match(modal, /添加（含依赖）/);
  assert.match(modal, /返回列表/);
  // 点行进详情，添加按钮 stopPropagation 避免误开详情
  assert.match(modal, /e\.stopPropagation\(\)/);
  assert.match(modal, /作者/);
  assert.match(modal, /下载/);
  assert.match(modal, /预览图/);
  assert.match(modal, /detailDescription|玩法说明/);
  // 列表行用 li+role=button，添加用独立 button + stopPropagation
  assert.match(modal, /role="button"/);
  assert.match(modal, /aria-label=\{`查看「\$\{item\.name\}」详情`\}/);
});

test('playModCatalog_每项须有作者下载量详细说明与预览图', async () => {
  assert.match(catalogSrc, /authorName/);
  assert.match(catalogSrc, /downloadCount/);
  assert.match(catalogSrc, /detailDescription/);
  assert.match(catalogSrc, /previewImages/);
  assert.match(catalogSrc, /withStoreDetail/);
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  assert.ok(cat.LOCAL_PLAY_MOD_CATALOG.length >= 7);
  for (const item of cat.LOCAL_PLAY_MOD_CATALOG) {
    assert.ok(String(item.authorName || '').trim(), `${item.slug} 缺作者`);
    assert.ok(Number(item.downloadCount) >= 0, `${item.slug} 缺下载量`);
    assert.ok(String(item.detailDescription || '').trim().length >= 8, `${item.slug} 详细说明过短`);
    assert.ok(Array.isArray(item.previewImages) && item.previewImages.length >= 1, `${item.slug} 缺预览图`);
  }
  const cars = cat.catalogBySlug('pack-cars');
  assert.deepEqual(cat.missingPlayModDepNames(cars, []), ['出行与交通']);
});

test('Admin与API_上架契约含详细说明预览图与价格', () => {
  assert.match(admin, /玩法详细说明/);
  assert.match(admin, /预览图 URL/);
  assert.match(admin, /上架须至少 1 张预览图/);
  assert.match(admin, /0=免费/);
  assert.match(api, /detailMd/);
  assert.match(api, /previewImages/);
  assert.match(api, /getDetail/);
  assert.match(api, /authorDisplayName/);
});

test('玩法Mod边界_目录不得收录档案人脉设置登录', () => {
  assert.match(catalogSrc, /存档结构、登录、档案、人脉、设置/);
  assert.doesNotMatch(catalogSrc, /slug:\s*["'](archive|contacts|settings|login|save)["']/);
});
