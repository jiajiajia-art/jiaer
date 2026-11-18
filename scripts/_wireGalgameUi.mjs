/**
 * 用 galgame.zh.json 反查，仅在组件函数体内替换硬编码中文为 t('galgameUi...')
 */
import fs from 'node:fs';

const dict = JSON.parse(fs.readFileSync('scripts/i18n-parts/galgame.zh.json', 'utf8'));

function flatten(obj, prefix = '', acc = []) {
  if (typeof obj === 'string') {
    acc.push([prefix, obj]);
    return acc;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, acc);
    }
  }
  return acc;
}

const leaves = flatten(dict).sort((a, b) => b[1].length - a[1].length);
const exactMap = new Map();
for (const [key, text] of leaves) {
  if (!exactMap.has(text)) exactMap.set(text, key);
}

const INTERP_RULES = [
  {
    re: /`已导入 \$\{([^}]+)\} 条，可继续编辑`/g,
    to: (_m, expr) => `t('galgameUi.systems.toast.importedCount', { count: ${expr} })`,
  },
  {
    re: /`\$\{([^}]+)\}（下一句起按新身份）`/g,
    to: (_m, expr) => `t('galgameUi.playerArchive.toast.identityChangeNextLine', { content: ${expr} })`,
  },
  {
    re: /`人设已生成（-\$\{([^}]+)\}）`/g,
    to: (_m, expr) => `t('galgameUi.playerArchive.toast.personaGenerated', { billing: ${expr} })`,
  },
  {
    re: /`\$\{([^}]+)\}已生成（-\$\{([^}]+)\}）`/g,
    to: (_m, field, billing) =>
      `t('galgameUi.systems.toast.positionGenerated', { field: ${field}, billing: ${billing} })`,
  },
  {
    re: /将扣除 \{\{\s*charge\s*\}\} 生成 AI 头像，是否继续？/,
    // noop marker
  },
];

function ensureImport(src) {
  if (src.includes("from 'react-i18next'") || src.includes('from "react-i18next"')) return src;
  if (src.includes("from 'react';")) {
    return src.replace("from 'react';", "from 'react';\nimport { useTranslation } from 'react-i18next';");
  }
  return `import { useTranslation } from 'react-i18next';\n${src}`;
}

function findComponentStart(src, marker) {
  const idx = src.indexOf(marker);
  if (idx < 0) return -1;
  const brace = src.indexOf('=> {', idx);
  return brace >= 0 ? brace + 4 : -1;
}

function replaceExactInRange(src, start, end) {
  let head = src.slice(0, start);
  let body = src.slice(start, end);
  const tail = src.slice(end);
  let count = 0;
  for (const [text, key] of exactMap) {
    if (!text || text.length < 1) continue;
    if (!/[\u4e00-\u9fff]/.test(text)) continue;
    // 单字太短易误伤时仍替换（女/男/今 等在 UI 中需要）
    for (const q of [`'${text}'`, `"${text}"`]) {
      if (!body.includes(q)) continue;
      const parts = body.split(q);
      body = parts.join(`t('${key}')`);
      count += parts.length - 1;
    }
  }
  return { out: head + body + tail, count };
}

function applyInterpInRange(src, start, end) {
  let head = src.slice(0, start);
  let body = src.slice(start, end);
  const tail = src.slice(end);
  let count = 0;
  for (const rule of INTERP_RULES) {
    if (!rule.to) continue;
    body = body.replace(rule.re, (...args) => {
      count += 1;
      return rule.to(...args);
    });
  }
  return { out: head + body + tail, count };
}

function processFile(path, marker) {
  let src = fs.readFileSync(path, 'utf8');
  src = ensureImport(src);
  const start = findComponentStart(src, marker);
  if (start < 0) {
    console.error('component start not found', path, marker);
    return;
  }
  // 插入 hook（若无）
  if (!/const\s*\{\s*t\s*\}\s*=\s*useTranslation\s*\(/.test(src.slice(start, start + 400))) {
    src = `${src.slice(0, start)}\n  const { t } = useTranslation();${src.slice(start)}`;
  }
  const start2 = findComponentStart(src, marker);
  const end = src.length;
  let r = applyInterpInRange(src, start2, end);
  src = r.out;
  const interp = r.count;
  r = replaceExactInRange(src, start2, src.length);
  src = r.out;
  fs.writeFileSync(path, src);
  console.log(path, 'interp', interp, 'exact', r.count);
}

processFile('src/components/Galgame/panels/SystemsPanel.tsx', 'const SystemsPanel');
processFile('src/components/Galgame/panels/PlayerArchiveSection.tsx', 'const PlayerArchiveSection');
