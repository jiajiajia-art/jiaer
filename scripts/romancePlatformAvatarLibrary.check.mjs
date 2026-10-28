/**
 * Romance 系统头像库对接平台 avatar-library 的契约检查
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('romance_系统头像库_对接平台API与分组', async () => {
  const lib = await import(join(root, 'Romance/src/lib/platformAvatarLibrary.ts'));
  const picker = readFileSync(join(root, 'Romance/src/components/AvatarLibraryPicker.tsx'), 'utf8');
  const pools = readFileSync(join(root, 'Romance/src/game/avatarPools.ts'), 'utf8');
  const editor = readFileSync(join(root, 'Romance/src/components/ModAvatarPoolsEditor.tsx'), 'utf8');

  assert.match(picker, /fetchPlatformSystemAvatarPools/);
  assert.match(picker, /setPlatformSystemPoolsCache/);
  assert.doesNotMatch(picker, /占位图|images\.unsplash\.com/i);
  assert.match(pools, /setPlatformSystemPoolsCache|platformSystemPoolsLoaded/);
  assert.match(pools, /禁止 Unsplash|avatar-library/);
  assert.doesNotMatch(pools, /images\.unsplash\.com/);
  // 未加载时 systemPools 必须返回空数组，禁止假数据兜底
  assert.match(pools, /if \(!platformSystemPoolsLoaded\) return \[\]/);
  assert.doesNotMatch(editor, /c\.images\.slice/);
  assert.match(editor, /图源平台入库/);

  const grouped = lib.groupPlatformAvatars([
    {
      id: '1',
      gender: 'female',
      ageGroup: 'adult',
      backgroundType: 'modern',
      imageUrl: '/public/a.webp',
      kind: 'system',
    },
    {
      id: '2',
      gender: 'male',
      ageGroup: 'adult',
      backgroundType: 'modern',
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
  ]);
  assert.ok(grouped.some((g) => g.name === '青年女性' && g.images.length === 1));
  assert.ok(grouped.some((g) => g.name === '青年男性' && g.images.length === 1));
  assert.ok(grouped.some((g) => g.name === '未分类' && g.images.length === 1));
  assert.equal(lib.PLATFORM_AVATAR_GROUPS.length >= 4, true);
  assert.match(String(lib.resolvePlatformAvatarUrl('/public/x.webp')), /\/public\/x\.webp$/);
});
