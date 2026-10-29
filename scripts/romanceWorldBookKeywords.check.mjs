/**
 * 世界书缺关键词时不得对 undefined 调 .some。
 * 连点「下一步」的页面测试见 romanceEditorSteps.check.mjs。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { keywordTexts } from '../Romance/src/lib/worldBookKeywords.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('keywordTexts_缺失或空_返回空数组', () => {
  assert.deepEqual(keywordTexts(undefined), []);
  assert.deepEqual(keywordTexts(null), []);
  assert.deepEqual(keywordTexts(''), []);
  assert.deepEqual(keywordTexts(['', { zh: '' }]), []);
});

test('keywordTexts_对象与字符串_解出可用词', () => {
  assert.deepEqual(keywordTexts([{ zh: '雾港' }, '夜航']), ['雾港', '夜航']);
  assert.deepEqual(keywordTexts('雾港'), ['雾港']);
});

test('世界书调用方_不得再对keywords直接some', () => {
  const pick = read('game/worldbookPick.ts');
  const audit = read('game/refAudit.ts');
  const editor = read('components/ModWorldBookEditor.tsx');
  const rules = read('components/WorldBookRules.tsx');
  for (const src of [pick, audit, editor, rules]) {
    assert.doesNotMatch(src, /keywords\.some\(/);
  }
  assert.match(pick, /keywordTexts\(e\.keywords\)\.length === 0/);
  assert.match(audit, /keywordTexts\(w\.keywords\)\.length === 0/);
  assert.doesNotMatch(editor, /e\.keywords\.length/);
  assert.doesNotMatch(editor, /e\.keywords\.join/);
  assert.doesNotMatch(audit, /w\.title\?\.trim\(/);
  assert.doesNotMatch(audit, /w\.content\?\.trim\(/);
});
