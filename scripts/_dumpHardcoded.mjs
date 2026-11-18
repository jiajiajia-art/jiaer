import fs from 'node:fs';

const files = [
  'src/components/Galgame/panels/SystemsPanel.tsx',
  'src/components/Galgame/panels/PlayerArchiveSection.tsx',
  'src/components/Galgame/panels/CharacterProfileForm.tsx',
  'src/components/Galgame/panels/PrivateChatPanel.tsx',
  'src/components/Galgame/panels/CharactersPanel.tsx',
  'src/page/Home.tsx',
  'src/page/Bookshelf.tsx',
  'src/components/Purchase/RechargeModal.tsx',
  'src/store/dailyTaskStore.ts',
  'src/utils/gameTypeLabel.ts',
  'src/page/warehouse/warehouseNav.ts',
];

const zhRe = /[\u4e00-\u9fff]/;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\n/);
  console.log('\n====', f);
  let hard = 0;
  let tCalls = 0;
  for (let i = 0; i < lines.length; i++) {
    const code = lines[i].split('//')[0];
    if (/t\(\s*['"`]/.test(code)) tCalls += 1;
    const withoutT = code.replace(/t\(\s*(['"`])[^'"`]*\1\s*(?:,[^)]*)?\)/g, '');
    const m = [...withoutT.matchAll(/(['"`])([^'"`]*[\u4e00-\u9fff][^'"`]*)\1/g)];
    if (!m.length) continue;
    hard += 1;
    if (hard <= 12) console.log(`L${i + 1}`, m.map((x) => x[2]).join(' | '));
  }
  console.log('hard=', hard, 'tCalls=', tCalls);
}
