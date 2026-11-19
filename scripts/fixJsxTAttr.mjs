/**
 * 修复错误 JSX：attr=t('...') → attr={t('...')}
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
    const matches = text.match(/\b[A-Za-z_:][\w:-]*=t\(/g) || [];
    text = text.replace(/(\b[A-Za-z_:][\w:-]*)=t\(/g, '$1={t(');
    text = text.replace(/=\{\{t\(/g, '={t(');
    if (text !== before) {
      fs.writeFileSync(p, text);
      files += 1;
      fixes += matches.length;
      changed.push(`${p.replace(/\\/g, '/')}:${matches.length}`);
    }
  }
}

walk(root);
console.log(JSON.stringify({ files, fixes, changed }, null, 2));
