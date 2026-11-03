/**
 * 回归：AI 脏封面 css/kicker 等不得再炸 t.trim is not a function（开局封面预览必经路径）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('sanitizeModStrings_须丢掉对象型cover.css并收成可预览封面', async () => {
  const { sanitizeModStrings } = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const dirty = {
    id: 'w1',
    name: '雾港',
    version: '1.0.0',
    kind: 'world',
    content: {
      cover: {
        title: { t: '封' },
        subtitle: { s: '副' },
        kicker: 1,
        cta: { t: '开始' },
        css: { color: 'red' },
        bgPrompt: { p: '雨夜' },
        style: { css: { nested: true }, titleColor: 'gold' },
      },
    },
  };
  const clean = sanitizeModStrings(dirty);
  // 功能注释：css 必须是字符串；对象禁止解包成 "red"（会污染 DIY 样式）
  assert.equal(clean.content.cover.css, undefined);
  assert.equal(clean.content.cover.kicker, '1'); // 数字收成字符串，CoverView 可 .trim
  // 功能注释：文案包装字段（t/s/p…）按 asTrimmedString 解出，避免必填被洗空
  assert.equal(clean.content.cover.cta, '开始');
  assert.equal(clean.content.cover.bgPrompt, '雨夜');
  assert.equal(clean.content.cover.title, '封');
  assert.equal(clean.content.cover.subtitle, '副');
  assert.equal(clean.content.cover.style?.css, undefined);
  assert.equal(clean.content.cover.style?.titleColor, 'gold');
});

test('withAuthorStyle_对象型css不得抛trim', async () => {
  const { withAuthorStyle, toDiy, fromDiy } = await import(pathToFileURL(join(romance, 'lib/coverAi.ts')).href);
  const { sanitizeModStrings } = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);

  // 功能注释：未清洗前的脏 style 也必须可安全合并（防御编辑器漏洗）
  assert.doesNotThrow(() => {
    const merged = withAuthorStyle({ css: { color: 'red' } }, { css: 12, title: 'x' });
    assert.equal(merged.css, undefined);
    assert.equal(merged.title, 'x');
  });

  const dirty = {
    id: 'w1',
    name: '雾港',
    version: '1.0.0',
    kind: 'world',
    content: {
      cover: {
        title: '旅店',
        style: { css: { bad: 1 }, labels: { start: { n: '开' } } },
        css: { top: true },
      },
    },
  };
  const clean = sanitizeModStrings(dirty);
  assert.doesNotThrow(() => {
    const diy = toDiy(clean.content.cover);
    const preview = fromDiy(clean.content.cover, diy);
    const merged = withAuthorStyle(preview.style, diy);
    if (merged.css != null) assert.equal(typeof merged.css, 'string');
  });
});

test('coverAi与Cover_源码禁止对css直接可选链trim', () => {
  const coverAi = readFileSync(join(romance, 'lib/coverAi.ts'), 'utf8');
  const cover = readFileSync(join(romance, 'components/Cover.tsx'), 'utf8');
  assert.doesNotMatch(coverAi, /filter\(\(x\)\s*=>\s*x\?\.trim\(\)\)/);
  assert.match(coverAi, /typeof x === \"string\"/);
  assert.doesNotMatch(cover, /d\.css\?\.trim\(\)/);
  assert.match(cover, /typeof d\.css === \"string\"/);
});
