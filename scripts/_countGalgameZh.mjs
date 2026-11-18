import fs from 'node:fs';
import path from 'node:path';

const scopes = [
  'src/components/Galgame',
  'src/components/GalgameMap',
  'src/hooks/galgame',
  'src/hooks/mapGalgame',
];
const files = [];

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) {
      const t = fs.readFileSync(p, 'utf8');
      const re = /['"`]([^'"`\n]*[\u4e00-\u9fff][^'"`\n]*)['"`]/gu;
      const hits = [...t.matchAll(re)]
        .map((m) => m[1])
        .filter((s) => !/功能注释|eslint|FIXME|创作界面切图|效果图/.test(s));
      if (hits.length) files.push({ file: p.replace(/\\/g, '/'), count: hits.length, hits });
    }
  }
}

for (const s of scopes) walk(s);
const total = files.reduce((n, f) => n + f.count, 0);
console.log(JSON.stringify({ fileCount: files.length, stringCount: total, top: files.sort((a, b) => b.count - a.count).slice(0, 20).map((f) => ({ count: f.count, file: f.file })) }, null, 2));
