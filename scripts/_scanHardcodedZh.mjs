import fs from 'node:fs';
import path from 'node:path';

const roots = [
  'src/page',
  'src/components/Galgame',
  'src/components/Layout',
  'src/components/Profile',
  'src/components/Purchase',
  'src/components/AuthModal.tsx',
  'src/components/GameGrid.tsx',
  'src/components/GameDetail',
  'src/components/CreateGame',
  'src/components/Create',
  'src/components/AiRoute',
  'src/components/CommonModal',
  'src/components/GameSettingEditor',
  'src/components/GameRating',
  'src/components/GalgameMap',
  'src/components/MembershipRecordsPanel.tsx',
  'src/components/MembershipSignInResultModal.tsx',
  'src/utils/gameTypeLabel.ts',
  'src/utils/planLabels.ts',
  'src/utils/gameBrowseFilters.ts',
  'src/lib/messageCenterView.ts',
  'src/store/dailyTaskStore.ts',
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const st = fs.statSync(dir);
  if (st.isFile()) {
    if (/\.(tsx|ts)$/.test(dir)) acc.push(dir);
    return acc;
  }
  for (const f of fs.readdirSync(dir)) {
    if (f === 'node_modules' || f.startsWith('.')) continue;
    walk(path.join(dir, f), acc);
  }
  return acc;
}

const zhRe = /[\u4e00-\u9fff]/;
const files = roots.flatMap((r) => walk(r));
const hits = [];

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const codePart = line.split('//')[0];
    if (!zhRe.test(codePart)) continue;
    const trimmed = codePart.trim();
    if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('import ')) continue;
    const withoutT = codePart.replace(/t\(\s*(['"`])[^'"`]*\1\s*(?:,[^)]*)?\)/g, '');
    if (!zhRe.test(withoutT)) continue;
    const m = [...withoutT.matchAll(/(['"`])([^'"`]*[\u4e00-\u9fff][^'"`]*)\1/g)];
    if (!m.length) continue;
    hits.push({
      file: file.replace(/\\/g, '/'),
      line: i + 1,
      text: trimmed.slice(0, 160),
      samples: m.map((x) => x[2]).slice(0, 3),
    });
  }
}

const byFile = {};
for (const h of hits) byFile[h.file] = (byFile[h.file] || 0) + 1;
const top = Object.entries(byFile).sort((a, b) => b[1] - a[1]);
console.log('hits', hits.length, 'files', top.length);
console.log(top.map(([f, c]) => `${c}\t${f}`).join('\n'));
console.log('\n--- top file samples ---');
for (const [f] of top.slice(0, 12)) {
  console.log('\n#' + f);
  for (const h of hits.filter((x) => x.file === f).slice(0, 8)) {
    console.log(`  L${h.line}: ${h.samples.join(' | ')}`);
  }
}
