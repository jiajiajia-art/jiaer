/**
 * 简介与详细简介分离；导入不得复制 persona 进详细简介
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDuplicateDetailedBio,
  resolveDistinctDetailedBio,
  validateCharacterProfileInput,
} from '../src/lib/galgame/characterProfile.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('resolveDistinctDetailedBio_相同文案清空', () => {
  const text = '身高168，体重50kg，长棕卷发紫瞳';
  assert.equal(isDuplicateDetailedBio(text, text), true);
  assert.equal(resolveDistinctDetailedBio(text, text), '');
});

test('validateCharacterProfileInput_保存时去掉重复详细简介', () => {
  const text = '身高168，体重50kg，看起来像女生，长棕卷发。';
  const res = validateCharacterProfileInput({
    name: '红红',
    gender: 'male',
    relationship: '导入角色',
    summary: text,
    attitudeToPlayer: '讨厌我',
    detailedBio: text,
  });
  assert.equal(res.ok, true);
  assert.equal(res.data?.detailedBio, undefined);
});

test('CharactersPanel_导入卡persona只进简介', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/components/Galgame/panels/CharactersPanel.tsx'), 'utf8');
  assert.match(src, /详细简介必须分离/);
  assert.match(src, /detailedBio:\s*''/);
  assert.doesNotMatch(src, /detailedBio:\s*String\(card\.persona/);
});
