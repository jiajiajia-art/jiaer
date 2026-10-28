/**
 * 建角改名须同步人物描述（模板重填 / 旧名替换）；锁定描述时不改文案
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('CharacterCreate_改名应走setPlayerName同步描述', () => {
  const src = readFileSync(join(romance, 'components/CharacterCreate.tsx'), 'utf8');
  assert.match(src, /syncPlayerNameChange/);
  assert.match(src, /setPlayerName/);
  assert.match(src, /onClick=\{\(\) => setPlayerName\(genName/);
  assert.match(src, /onPick=\{\(n\) => setPlayerName\(n\)\}/);
  assert.match(src, /onChange=\{\(e\) => setPlayerName\(e\.target\.value\)\}/);
  // 禁止姓名「换一个」只改 name 不同步描述
  assert.doesNotMatch(src, /onClick=\{\(\) => upd\(\{ name: genName/);
});

test('syncNameInDescription_模板与旧名替换', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/syncPlayerName.ts')).href);
  const tpl = '{name}，清甜灵气的新人。';
  assert.equal(
    mod.syncNameInDescription('冯舒窈', '李想', '{name}，清甜灵气的新人。'.replace('{name}', '冯舒窈'), tpl),
    '李想，清甜灵气的新人。',
  );
  assert.equal(
    mod.syncNameInDescription('冯舒窈', '李想', '冯舒窈出身科班，梦想登台。', ''),
    '李想出身科班，梦想登台。',
  );
  assert.equal(
    mod.syncNameInDescription('冯舒窈', '李想', '完全手写、不含姓名的描述', tpl),
    '完全手写、不含姓名的描述',
  );
  const locked = mod.syncPlayerNameChange(
    { name: '冯舒窈', description: '冯舒窈，演员。' },
    '李想',
    { descLocked: true, seedDescription: tpl },
  );
  assert.equal(locked.name, '李想');
  assert.equal(locked.description, '冯舒窈，演员。');
});
