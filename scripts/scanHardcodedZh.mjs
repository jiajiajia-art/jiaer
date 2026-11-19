/**
 * 扫描 src 下仍硬编码中文的 ts/tsx（排除 locales、注释向字符串）
 */
import fs from 'node:fs';
import path from 'node:path';

const root = 'src';
const byDir = new Map();
const files = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'locales' || ent.name === 'node_modules' || ent.name === 'i18n') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(ent.name)) continue;
    if (/\.(test|spec|check)\./.test(ent.name)) continue;
    const text = fs.readFileSync(p, 'utf8');
    const re = /['"`]([^'"`\n]*[\u4e00-\u9fff]{2,}[^'"`\n]*)['"`]/g;
    const hits = [...text.matchAll(re)]
      .map((m) => m[1])
      .filter((s) => !/功能注释|效果图|eslint|FIXME|TODO/.test(s));
    if (!hits.length) continue;
    const rel = p.replace(/\\/g, '/');
    const top = rel.split('/').slice(0, 3).join('/');
    byDir.set(top, (byDir.get(top) || 0) + hits.length);
    files.push({ file: rel, count: hits.length, samples: hits.slice(0, 5) });
  }
}

walk(root);
files.sort((a, b) => b.count - a.count);
const ranked = [...byDir.entries()].sort((a, b) => b[1] - a[1]);
console.log(JSON.stringify({
  totalFiles: files.length,
  totalHits: files.reduce((n, f) => n + f.count, 0),
  ranked: ranked.slice(0, 25),
  topFiles: files.slice(0, 40).map((f) => ({ file: f.file, count: f.count })),
}, null, 2));

fs.mkdirSync('scripts/i18n-parts', { recursive: true });
fs.writeFileSync('scripts/i18n-parts/_scan.json', JSON.stringify({ ranked, files }, null, 2));
