import fs from 'node:fs';

const files = [
  'src/components/Galgame/panels/SystemsPanel.tsx',
  'src/components/Galgame/panels/PlayerArchiveSection.tsx',
  'src/components/Galgame/panels/CharacterProfileForm.tsx',
  'src/page/Bookshelf.tsx',
];

for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\n/);
  console.log('\n====', f);
  for (let i = 0; i < lines.length; i++) {
    const code = lines[i].split('//')[0];
    const withoutT = code.replace(/t\(\s*(['"`])[^'"`]*\1\s*(?:,[^)]*)?\)/g, '');
    const m = [...withoutT.matchAll(/(['"`])([^'"`]*[\u4e00-\u9fff][^'"`]*)\1/g)];
    if (!m.length) continue;
    console.log(`L${i + 1}`, m.map((x) => x[2]).join(' | '));
  }
}
