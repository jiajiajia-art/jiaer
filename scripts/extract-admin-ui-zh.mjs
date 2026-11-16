import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const scope = [
  'components/admin',
  'components/admin-shell',
  'page/AdminPanel.tsx',
  'components/PromotionAdminManager.tsx',
  'components/WithdrawAdminManager.tsx',
  'components/CreatorIncentiveAdminManager.tsx',
  'components/DailyTasksAdminManager.tsx',
  'components/SubscriptionAdminManager.tsx',
  'components/ActivityBannerManager.tsx',
  'components/AdminBannerManager.tsx',
  'components/CreatorEarnings',
];

function collectFiles() {
  const out = [];
  for (const s of scope) {
    const p = path.join(root, s);
    if (!fs.existsSync(p)) continue;
    const stat = fs.statSync(p);
    if (stat.isFile()) {
      if (/\.(tsx|ts)$/.test(p) && !/adminTheme|navigationBadges/.test(p)) out.push(p);
      continue;
    }
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(fp);
        else if (/\.(tsx|ts)$/.test(fp) && !/adminTheme|navigationBadges|\.module\./.test(fp)) out.push(fp);
      }
    };
    walk(p);
  }
  return out;
}

const re =
  /'([^'\n]*[\u4e00-\u9fff][^'\n]*)'|"([^"\n]*[\u4e00-\u9fff][^"\n]*)"|`([^`\n]*[\u4e00-\u9fff][^`\n]*)`/g;

const files = collectFiles();
let total = 0;
const entries = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (/功能注释/.test(line)) continue;
    for (const m of line.matchAll(re)) {
      const s = m[1] ?? m[2] ?? m[3];
      if (!s || /eslint|FIXME|TODO/.test(s)) continue;
      entries.push({ file: file.replace(/\\/g, '/'), line: i + 1, text: s });
      total++;
    }
  }
}

const unique = [...new Map(entries.map((e) => [e.text, e])).keys()];
console.log(
  JSON.stringify(
    { fileCount: files.length, totalHits: total, uniqueStrings: unique.length },
    null,
    2,
  ),
);
