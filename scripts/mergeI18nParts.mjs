/**
 * 合并 scripts/i18n-parts/*.zh.json|*.en.json|*.ja.json 进主 locales
 * 部件文件顶层 key 为命名空间（如 admin、galgameEditor），会 deep-merge 进主文件
 */
import fs from 'node:fs';
import path from 'node:path';

const partsDir = 'scripts/i18n-parts';
const locales = {
  zh: 'src/i18n/locales/zh.json',
  en: 'src/i18n/locales/en.json',
  ja: 'src/i18n/locales/ja.json',
};

function deepMerge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
  const out = { ...(target && typeof target === 'object' && !Array.isArray(target) ? target : {}) };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function leafPaths(obj, prefix = '', acc = []) {
  if (typeof obj === 'string') {
    acc.push(prefix);
    return acc;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      leafPaths(v, prefix ? `${prefix}.${k}` : k, acc);
    }
  }
  return acc;
}

const mains = {
  zh: JSON.parse(fs.readFileSync(locales.zh, 'utf8')),
  en: JSON.parse(fs.readFileSync(locales.en, 'utf8')),
  ja: JSON.parse(fs.readFileSync(locales.ja, 'utf8')),
};

const files = fs.existsSync(partsDir)
  ? fs.readdirSync(partsDir).filter((f) => /\.(zh|en|ja)\.json$/.test(f) && !f.startsWith('_'))
  : [];

let mergedParts = 0;
for (const f of files) {
  const lang = f.endsWith('.zh.json') ? 'zh' : f.endsWith('.en.json') ? 'en' : 'ja';
  const data = JSON.parse(fs.readFileSync(path.join(partsDir, f), 'utf8'));
  mains[lang] = deepMerge(mains[lang], data);
  mergedParts += 1;
}

for (const [lang, file] of Object.entries(locales)) {
  fs.writeFileSync(file, `${JSON.stringify(mains[lang], null, 2)}\n`);
}

const zhLeaves = new Set(leafPaths(mains.zh));
const enLeaves = new Set(leafPaths(mains.en));
const jaLeaves = new Set(leafPaths(mains.ja));
const missingEn = [...zhLeaves].filter((p) => !enLeaves.has(p)).slice(0, 30);
const missingJa = [...zhLeaves].filter((p) => !jaLeaves.has(p)).slice(0, 30);

console.log(JSON.stringify({
  mergedParts,
  leafCounts: { zh: zhLeaves.size, en: enLeaves.size, ja: jaLeaves.size },
  missingEnSample: missingEn,
  missingJaSample: missingJa,
}, null, 2));
