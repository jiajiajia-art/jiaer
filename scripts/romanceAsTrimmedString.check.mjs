/**
 * asTrimmedString / sanitize：非字符串不得再触发 .trim is not a function
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('asTrimmedString_对象数字null均可', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/asTrimmedString.ts')).href);
  assert.equal(mod.asTrimmedString('  hi  '), 'hi');
  assert.equal(mod.asTrimmedString(12), '12');
  assert.equal(mod.asTrimmedString({ a: 1 }), '');
  assert.equal(mod.asTrimmedString(null), '');
  assert.equal(mod.asNonEmptyTrimmed(''), undefined);
  assert.equal(mod.asNonEmptyTrimmed('x'), 'x');
});

test('sanitizeWorldGenAiPatch_terms与npc须收成字符串', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const cleaned = gen.sanitizeWorldGenAiPatch('terms', {
    terms: { city: { name: '雾港' }, week: ' 周  ' },
    npcs: [{ id: 'a', name: 7, gender: { v: '女' }, bio: null }],
  });
  assert.deepEqual(cleaned.terms, { week: '周' });
  assert.equal(cleaned.npcs[0].name, '7');
  assert.equal(cleaned.npcs[0].gender, undefined);
  assert.equal(cleaned.npcs[0].bio, '');
});

test('extractContentPatch_非字符串raw不得炸trim', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const patch = gen.extractContentPatch({ content: { rooms: { a: { name: '客栈' } } } });
  assert.equal(patch.rooms.a.name, '客栈');
});

test('ModEditorPanel_渲染路径不得直接对可能非字符串调trim', () => {
  const src = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.doesNotMatch(src, /const nameErr = m\.name\.trim\(\)/);
  assert.doesNotMatch(src, /n\.name\.trim\(\)/);
  assert.doesNotMatch(src, /c\.terms\?\.\[k\]\?\.trim\(\)/);
});
