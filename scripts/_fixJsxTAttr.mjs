import fs from 'node:fs';

for (const f of [
  'src/components/Galgame/panels/SystemsPanel.tsx',
  'src/components/Galgame/panels/PlayerArchiveSection.tsx',
]) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  // attr=t('key') -> attr={t('key')}
  s = s.replace(
    /(\b(?:placeholder|title|confirmText|cancelText|message|alt|aria-label|aria-labelledby))=t\((['"])([^'"]+)\2\)/g,
    '$1={t($2$3$2)}',
  );
  fs.writeFileSync(f, s);
  console.log(f, before === s ? 'unchanged' : 'fixed');
}
