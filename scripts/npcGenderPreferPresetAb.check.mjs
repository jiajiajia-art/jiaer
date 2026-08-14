/**
 * 局内性别合并：A/B 未手改跟创作台
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNpcGender,
  resolveEditableNpcGender,
} from '../src/lib/galgame/characterProfile.ts';

test('normalizeNpcGender_认中文男', () => {
  assert.equal(normalizeNpcGender('男'), 'male');
  assert.equal(normalizeNpcGender('女'), 'female');
});

test('resolveEditableNpcGender_实验组未手改跟预设男', () => {
  assert.equal(
    resolveEditableNpcGender({
      preferPresetGender: true,
      presetGender: '男',
      localGender: 'female',
      genderManuallySet: false,
    }),
    'male',
  );
});

test('resolveEditableNpcGender_实验组手改保留局内女', () => {
  assert.equal(
    resolveEditableNpcGender({
      preferPresetGender: true,
      presetGender: '男',
      localGender: 'female',
      genderManuallySet: true,
    }),
    'female',
  );
});

test('resolveEditableNpcGender_默认prefer跟创作台', () => {
  assert.equal(
    resolveEditableNpcGender({
      preferPresetGender: true,
      presetGender: '男',
      localGender: 'female',
    }),
    'male',
  );
});

test('resolveEditableNpcGender_对照组局内覆盖预设', () => {
  assert.equal(
    resolveEditableNpcGender({
      preferPresetGender: false,
      presetGender: '男',
      localGender: 'female',
      genderManuallySet: false,
    }),
    'female',
  );
});

test('playUi_缺npcGenderPreferPreset字段不写成false', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/api/galgame/playUi.ts'), 'utf8');
  assert.doesNotMatch(
    src,
    /npcGenderPreferPreset:\s*!!\(json\.data\.ab/,
    '缺字段时 !! 会强制 false，盖掉前端默认跟创作台',
  );
  assert.match(
    src,
    /typeof raw\.npcGenderPreferPreset === 'boolean'/,
    '仅当服务端显式布尔时才下发 npcGenderPreferPreset',
  );
});
