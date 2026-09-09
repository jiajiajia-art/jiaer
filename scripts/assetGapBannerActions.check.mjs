/**
 * 素材待补齐横幅：当前页已是目标面板时隐藏对应跳转按钮
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function load() {
  return import('../src/lib/galgame/assetGapBannerActions.ts');
}

test('visibleAssetGapActions_角色页应隐藏去生成立绘', async () => {
  const { visibleAssetGapActions } = await load();
  assert.deepEqual(
    visibleAssetGapActions({
      activePanel: 'characters',
      missingPortraits: true,
      missingScenes: false,
      missingCover: true,
    }),
    ['cover'],
  );
});

test('visibleAssetGapActions_非角色页应展示去生成立绘', async () => {
  const { visibleAssetGapActions } = await load();
  assert.deepEqual(
    visibleAssetGapActions({
      activePanel: 'world',
      missingPortraits: true,
      missingScenes: true,
      missingCover: false,
    }),
    ['portraits', 'scenes'],
  );
});

test('visibleAssetGapActions_场景页应隐藏去生成背景', async () => {
  const { visibleAssetGapActions } = await load();
  assert.deepEqual(
    visibleAssetGapActions({
      activePanel: 'scenes',
      missingPortraits: true,
      missingScenes: true,
      missingCover: false,
    }),
    ['portraits'],
  );
});

test('visibleAssetGapActions_世界设定页应隐藏去上传封面', async () => {
  const { visibleAssetGapActions } = await load();
  assert.deepEqual(
    visibleAssetGapActions({
      activePanel: 'world',
      missingPortraits: false,
      missingScenes: false,
      missingCover: true,
    }),
    [],
  );
});

test('AssetGapBanner_应按activePanel隐藏当前页跳转', () => {
  const tsx = readFileSync(
    join(root, 'src/components/GameSettingEditor/AssetGapBanner.tsx'),
    'utf8',
  );
  const editor = readFileSync(join(root, 'src/page/GameSettingsEditor.tsx'), 'utf8');
  assert.match(tsx, /visibleAssetGapActions/);
  assert.match(tsx, /activePanel/);
  assert.match(tsx, /gapActions\.includes\('portraits'\)/);
  assert.match(editor, /activePanel=\{activePanel\}/);
});
