/**
 * Romance 系统头像库对接平台 avatar-library 的契约检查
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('romance_系统头像库_对接平台API与分组', async () => {
  const lib = await import(pathToFileURL(join(root, 'Romance/src/lib/platformAvatarLibrary.ts')).href);
  const picker = readFileSync(join(root, 'Romance/src/components/AvatarLibraryPicker.tsx'), 'utf8');
  const pools = readFileSync(join(root, 'Romance/src/game/avatarPools.ts'), 'utf8');
  const editor = readFileSync(join(root, 'Romance/src/components/ModAvatarPoolsEditor.tsx'), 'utf8');

  assert.match(picker, /fetchPlatformSystemAvatarPools/);
  assert.match(picker, /fetchPlatformStylePackOptions|styleFilter|风格包/);
  assert.match(picker, /setPlatformSystemPoolsCache/);
  assert.doesNotMatch(picker, /占位图|images\.unsplash\.com/i);
  assert.match(pools, /setPlatformSystemPoolsCache|platformSystemPoolsLoaded/);
  assert.match(pools, /禁止 Unsplash|avatar-library/);
  assert.doesNotMatch(pools, /images\.unsplash\.com/);
  // 未加载时 systemPools 必须返回空数组，禁止假数据兜底
  assert.match(pools, /if \(!platformSystemPoolsLoaded\) return \[\]/);
  assert.doesNotMatch(editor, /c\.images\.slice/);
  assert.match(editor, /官方风格库/);
  assert.match(editor, /stylePacks/);
  assert.doesNotMatch(editor, /PUBLIC_AVATAR_CATS/);
  assert.match(editor, /图源平台入库/);

  const items = [
    {
      id: '1',
      gender: 'female',
      ageGroup: 'adult',
      backgroundType: 'modern',
      stylePack: 'anime',
      imageUrl: '/public/a.webp',
      kind: 'system',
    },
    {
      id: '2',
      gender: 'male',
      ageGroup: 'adult',
      backgroundType: 'modern',
      stylePack: 'realistic',
      imageUrl: '/public/b.webp',
      kind: 'public',
    },
    {
      id: '3',
      gender: '',
      ageGroup: '',
      backgroundType: '',
      imageUrl: '/public/c.webp',
      kind: 'system',
    },
  ];
  const grouped = lib.groupPlatformAvatars(items);
  assert.ok(grouped.some((g) => g.name === '青年女性' && g.images.length === 1));
  assert.ok(grouped.some((g) => g.name === '青年男性' && g.images.length === 1));
  assert.ok(grouped.some((g) => g.name === '未分类' && g.images.length === 1));
  const animeOnly = lib.groupPlatformAvatars(items, { stylePack: 'anime' });
  assert.ok(animeOnly.some((g) => g.name === '青年女性' && g.images.length === 1));
  assert.equal(animeOnly.some((g) => g.name === '青年男性'), false);
  const both = lib.groupPlatformAvatars(items, { stylePacks: ['anime', 'realistic'] });
  assert.equal(both.filter((g) => g.name === '青年女性' || g.name === '青年男性').length, 2);
  const none = lib.groupPlatformAvatars(items, { stylePacks: [] });
  assert.equal(none.length, 0);
  assert.equal(lib.PLATFORM_AVATAR_GROUPS.length >= 4, true);
  assert.equal(typeof lib.fetchPlatformStylePackOptions, 'function');
  assert.equal(typeof lib.regroupCachedPlatformAvatarPools, 'function');
  assert.match(String(lib.resolvePlatformAvatarUrl('/public/x.webp')), /\/public\/x\.webp$/);
  assert.equal(typeof lib.readFunloomAuthorLabel, 'function');
  assert.equal(typeof lib.readFunloomAuthorLabel(), 'string');
});
