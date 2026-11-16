/**
 * 把 zh 有而 en/ja 缺的叶子键补齐：优先用 en 填 ja；再不行用 zh，保证三语键树一致（运行时仍靠 fallback）。
 */
import fs from 'node:fs';

const paths = {
  zh: 'src/i18n/locales/zh.json',
  en: 'src/i18n/locales/en.json',
  ja: 'src/i18n/locales/ja.json',
};

function leafEntries(obj, prefix = '', acc = []) {
  if (typeof obj === 'string') {
    acc.push([prefix, obj]);
    return acc;
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      leafEntries(v, prefix ? `${prefix}.${k}` : k, acc);
    }
  }
  return acc;
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k = keys[i];
    if (!cur[k] || typeof cur[k] !== 'object' || Array.isArray(cur[k])) cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}

function getPath(obj, path) {
  return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), obj);
}

const zh = JSON.parse(fs.readFileSync(paths.zh, 'utf8'));
const en = JSON.parse(fs.readFileSync(paths.en, 'utf8'));
const ja = JSON.parse(fs.readFileSync(paths.ja, 'utf8'));

const zhLeaves = leafEntries(zh);
let filledEn = 0;
let filledJa = 0;

for (const [path, zhValue] of zhLeaves) {
  if (typeof getPath(en, path) !== 'string') {
    const jaVal = getPath(ja, path);
    setPath(en, path, typeof jaVal === 'string' ? jaVal : zhValue);
    filledEn += 1;
  }
  if (typeof getPath(ja, path) !== 'string') {
    const enVal = getPath(en, path);
    setPath(ja, path, typeof enVal === 'string' ? enVal : zhValue);
    filledJa += 1;
  }
}

fs.writeFileSync(paths.en, `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(paths.ja, `${JSON.stringify(ja, null, 2)}\n`);

const enSet = new Set(leafEntries(en).map(([p]) => p));
const jaSet = new Set(leafEntries(ja).map(([p]) => p));
const zhSet = new Set(zhLeaves.map(([p]) => p));

console.log(JSON.stringify({
  filledEn,
  filledJa,
  leafCounts: { zh: zhSet.size, en: enSet.size, ja: jaSet.size },
  missingEn: [...zhSet].filter((p) => !enSet.has(p)).length,
  missingJa: [...zhSet].filter((p) => !jaSet.has(p)).length,
}, null, 2));
