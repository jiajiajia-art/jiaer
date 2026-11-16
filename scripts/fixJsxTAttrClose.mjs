/**
 * 修复 attr={t('key') 缺少闭合 } 的情况 → attr={t('key')}
 */
import fs from 'node:fs';
import path from 'node:path';

const root = 'src';
let files = 0;
let fixes = 0;
const changed = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'locales') continue;
      walk(p);
      continue;
    }
    if (!/\.(tsx|jsx)$/.test(ent.name)) continue;
    let text = fs.readFileSync(p, 'utf8');
    const before = text;
    // {t('...') followed by whitespace then another attr / > / />  and NOT already }
    text = text.replace(/\{t\('([^']+)'\)(?!\})/g, (m, key, offset, src) => {
      const after = src.slice(offset + m.length);
      // already has } after optional space? handled by (?!\})
      // only close when next meaningful is JSX boundary or next prop
      if (/^\s*[/>A-Za-z_*]/.test(after) || /^\s*$/.test(after.slice(0, 20))) {
        fixes += 1;
        return `{t('${key}')}`;
      }
      return m;
    });
    // also double-quote keys
    text = text.replace(/\{t\("([^"]+)"\)(?!\})/g, (m, key, offset, src) => {
      const after = src.slice(offset + m.length);
      if (/^\s*[/>A-Za-z_*]/.test(after)) {
        fixes += 1;
        return `{t("${key}")}`;
      }
      return m;
    });
    if (text !== before) {
      fs.writeFileSync(p, text);
      files += 1;
      changed.push(p.replace(/\\/g, '/'));
    }
  }
}

walk(root);
console.log(JSON.stringify({ files, fixes, changed }, null, 2));
