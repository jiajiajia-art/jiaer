import fs from 'node:fs';
import path from 'node:path';

const root = 'src/components/GameSettingEditor';
let total = 0;
const files = [];

function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(tsx?)$/.test(ent.name)) {
      const text = fs.readFileSync(p, 'utf8');
      const re = /['"`]([^'"`\n]*[\u4e00-\u9fff]{1,}[^'"`\n]*)['"`]/g;
      const hits = [...text.matchAll(re)]
        .map((m) => m[1])
        .filter((s) => !/功能注释|效果图|eslint|FIXME|TODO|创作界面切图/.test(s));
      if (hits.length) {
        total += hits.length;
        files.push({ f: p.replace(/\\/g, '/'), n: hits.length, samples: hits.slice(0, 3) });
      }
    }
  }
}

walk(root);
files.sort((a, b) => b.n - a.n);
console.log(JSON.stringify({ total, fileCount: files.length, top: files.slice(0, 20) }, null, 2));
