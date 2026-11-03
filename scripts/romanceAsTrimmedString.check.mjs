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
  assert.equal(mod.asTrimmedString({ a: 1 }), '1'); // 单字段对象兜底
  assert.equal(mod.asTrimmedString({ zh: '雾港', en: 'Fog' }), '雾港');
  assert.equal(mod.asTrimmedString({ n: '阿宁' }), '阿宁');
  assert.equal(mod.asTrimmedString({ text: '  hi  ' }), 'hi');
  assert.equal(mod.asTrimmedString({ foo: 1, bar: 2 }), ''); // 多字段无已知键 → 空
  assert.equal(mod.asTrimmedString(null), '');
  assert.equal(mod.asNonEmptyTrimmed(''), undefined);
  assert.equal(mod.asNonEmptyTrimmed('x'), 'x');
});

test('sanitizeModStrings_对象name须解包而非洗成空', async () => {
  const san = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const cleaned = san.sanitizeModStrings({
    id: 'w1',
    name: { zh: '雾港' },
    version: '1.0.0',
    kind: 'world',
    content: {
      npcs: [{ id: 'a', name: { n: '阿宁' }, gender: { g: '女' } }],
      rooms: { inn: { name: { n: '客栈' }, desc: { d: '旧码头' } } },
      fixedEvents: [{ id: 'e1', name: { n: '试镜' }, prompt: { text: '上台' }, chain: { c: 'main' } }],
    },
  });
  assert.equal(cleaned.name, '雾港');
  assert.equal(cleaned.content.npcs[0].name, '阿宁');
  assert.equal(cleaned.content.npcs[0].gender, '女');
  assert.equal(cleaned.content.rooms.inn.name, '客栈');
  assert.equal(cleaned.content.rooms.inn.desc, '旧码头');
  assert.equal(cleaned.content.fixedEvents[0].name, '试镜');
  assert.equal(cleaned.content.fixedEvents[0].prompt, '上台');
  assert.equal(cleaned.content.fixedEvents[0].chain, 'main');
});

test('resolvePhoneApps_对象配置不得map崩', async () => {
  const phone = await import(pathToFileURL(join(romance, 'lib/phoneAppsConfig.ts')).href);
  const san = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  assert.doesNotThrow(() => phone.resolvePhoneApps({ apps: [{ id: 'wechat', label: { zh: '微信' } }] }));
  const cleaned = san.sanitizeModStrings({
    id: 'w1', name: '雾港', version: '1.0.0', kind: 'world',
    content: { phoneAppsCfg: { apps: [{ id: 'wechat', label: { zh: '绿信' } }] }, income: { jobs: [{ id: 'j1', name: { n: '跑堂' } }] } },
  });
  assert.equal(cleaned.content.phoneAppsCfg[0].label, '绿信');
  assert.equal(cleaned.content.income[0].name, '跑堂');
  assert.doesNotThrow(() => phone.resolvePhoneApps(cleaned.content.phoneAppsCfg));
  const bgm = san.sanitizeModStrings({
    id: 'w1', name: '雾港', version: '1.0.0', kind: 'world',
    content: { bgm: { tracks: [{ id: 'b1', name: { zh: '雨' }, src: 'https://example.com/a.mp3' }] } },
  });
  assert.equal(bgm.content.bgm[0].src, 'https://example.com/a.mp3');
  assert.equal(bgm.content.bgm[0].name, '雨');
  assert.equal(typeof bgm.content.bgm[0].src, 'string');
});

test('sanitizeWorldGenAiPatch_terms与npc须收成字符串', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const cleaned = gen.sanitizeWorldGenAiPatch('terms', {
    terms: { city: { name: '雾港' }, week: ' 周  ' },
    npcs: [{ id: 'a', name: 7, gender: { v: '女' }, bio: null }],
  });
  // 功能注释：对象文案须解包保留，不能整键丢弃
  assert.deepEqual(cleaned.terms, { city: '雾港', week: '周' });
  assert.equal(cleaned.npcs[0].name, '7');
  assert.equal(cleaned.npcs[0].gender, '女');
  assert.equal(cleaned.npcs[0].bio, '');
});

test('extractContentPatch_非字符串raw不得炸trim', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const patch = gen.extractContentPatch({ content: { rooms: { a: { name: '客栈' } } } });
  assert.equal(patch.rooms.a.name, '客栈');
});

test('valueSources_缺label或缺name时不得reading_trim', () => {
  const src = readFileSync(join(romance, 'game/valueSources.ts'), 'utf8');
  assert.match(src, /function cellText/);
  assert.doesNotMatch(src, /\.label\.trim\(/);
  assert.doesNotMatch(src, /\.name\.trim\(/);
  assert.doesNotMatch(src, /\.target\.trim\(/);
  assert.match(src, /cellText\(d\?\.label\)/);
  assert.match(src, /cellText\(\(r as \{ name\?: unknown \} \| null\)\?\.name\)/);
  const paths = readFileSync(join(romance, 'components/ModPathsEditor.tsx'), 'utf8');
  // 功能注释：线路 AI 回写人物时用 String(...??"").trim，禁止对可能非字符串直接 .trim()
  assert.match(paths, /String\(n\.name \?\? ""\)\.trim\(\)/);
  assert.match(paths, /String\(n\.name\)\.trim\(\)/);
  assert.doesNotMatch(paths, /n\.trim\(\) && !known/);
  assert.doesNotMatch(paths, /t\.trim\(\) && !npcs/);
});

test('ModEditorPanel_渲染路径不得直接对可能非字符串调trim', () => {
  const src = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.doesNotMatch(src, /const nameErr = m\.name\.trim\(\)/);
  assert.doesNotMatch(src, /n\.name\.trim\(\)/);
  assert.doesNotMatch(src, /c\.terms\?\.\[k\]\?\.trim\(\)/);
});
