/**
 * 补齐 misc.en/ja（自 misc.zh）与 lib.ja（自 lib.en），经 MyMemory 机翻。
 */
import fs from 'node:fs';

async function translateText(text, pair) {
  if (!text || !/[A-Za-z\u4e00-\u9fff]/.test(text)) return text;
  // 保留插值占位
  const tokens = [];
  const masked = text.replace(/\{\{[^}]+\}\}/g, (m) => {
    tokens.push(m);
    return `<${tokens.length - 1}/>`;
  });
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(masked.slice(0, 450))}&langpair=${pair}&de=dev@funloom.app`;
  const res = await fetch(url);
  const data = await res.json();
  let out = data?.responseData?.translatedText || text;
  tokens.forEach((tok, i) => {
    out = out.replace(`<${i}/>`, tok).replace(`&lt;${i}/&gt;`, tok);
  });
  return out;
}

async function mapTree(node, pair, cache) {
  if (typeof node === 'string') {
    if (cache.has(node)) return cache.get(node);
    const translated = await translateText(node, pair);
    cache.set(node, translated);
    await new Promise((r) => setTimeout(r, 120));
    return translated;
  }
  if (Array.isArray(node)) {
    const next = [];
    for (const item of node) next.push(await mapTree(item, pair, cache));
    return next;
  }
  if (node && typeof node === 'object') {
    const next = {};
    for (const [k, v] of Object.entries(node)) {
      next[k] = await mapTree(v, pair, cache);
      process.stdout.write('.');
    }
    return next;
  }
  return node;
}

const miscZh = JSON.parse(fs.readFileSync('scripts/i18n-parts/misc.zh.json', 'utf8'));
const libEn = JSON.parse(fs.readFileSync('scripts/i18n-parts/lib.en.json', 'utf8'));

console.log('\ntranslating misc zh->en');
const miscEn = await mapTree(miscZh, 'zh-CN|en', new Map());
fs.writeFileSync('scripts/i18n-parts/misc.en.json', `${JSON.stringify(miscEn, null, 2)}\n`);

console.log('\ntranslating misc zh->ja');
const miscJa = await mapTree(miscZh, 'zh-CN|ja', new Map());
fs.writeFileSync('scripts/i18n-parts/misc.ja.json', `${JSON.stringify(miscJa, null, 2)}\n`);

console.log('\ntranslating lib en->ja');
const libJa = await mapTree(libEn, 'en|ja', new Map());
fs.writeFileSync('scripts/i18n-parts/lib.ja.json', `${JSON.stringify(libJa, null, 2)}\n`);

console.log('\ndone');
