/**
 * C0.3 官方玩法 / 官方应用适用题材种子。
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('officialTheme_官方包与应用都有至少1个适用语义', async () => {
  const theme = await import(pathToFileURL(join(romance, 'lib/officialThemeApplicability.ts')).href);
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const phone = await import(pathToFileURL(join(romance, 'lib/phoneAppsConfig.ts')).href);

  for (const slug of [
    'pack-career', 'pack-image', 'pack-paper', 'pack-transport', 'pack-cars',
    'pack-pregnancy', 'pack-living', 'pack-titles', 'pack-relations',
  ]) {
    const codes = theme.OFFICIAL_PLAY_MOD_THEME_CODES[slug];
    assert.ok(codes?.length, slug);
    const item = cat.LOCAL_PLAY_MOD_CATALOG.find((x) => x.slug === slug);
    assert.ok(item, slug);
    assert.ok(item.applicableThemeCodes.length >= 1, slug);
  }

  for (const id of phone.OFFICIAL_PLATFORM_APP_IDS) {
    assert.ok(phone.officialAppThemeCodes(id).length >= 1, id);
  }

  const tags = [
    { id: 1, name: '现代' },
    { id: 2, name: '古代' },
    { id: 3, name: '仙侠' },
  ];
  assert.deepEqual(theme.resolveApplicableThemeTagIds(['universal'], tags), [1, 2, 3]);
  assert.deepEqual(theme.resolveApplicableThemeTagIds(['modern'], tags), [1]);
  assert.equal(theme.resolveApplicableThemeTagIds(['modern'], []), null);
  assert.equal(theme.shouldWarnThemeMismatch(2, [1]), true);
  assert.equal(theme.shouldWarnThemeMismatch(1, [1, 2]), false);
});
