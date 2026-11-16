/**
 * 功能注释：嵌入主站的 Romance 标签标题须为 Funloom 品牌，禁止残留 Figma 演示名「今夜她是主角」。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('resolveRomanceDocumentTitle_生成世界与玩法等场景', async () => {
  const mod = await import(pathToFileURL(join(root, 'src/lib/romanceDocumentTitle.ts')).href);
  assert.equal(mod.resolveRomanceDocumentTitle('?createWorld=1'), '生成世界 · Funloom');
  assert.equal(mod.resolveRomanceDocumentTitle('createWorld=true&draftId=abc'), '生成世界 · Funloom');
  assert.equal(mod.resolveRomanceDocumentTitle('?createPlayMod=1'), '创作玩法 · Funloom');
  assert.equal(mod.resolveRomanceDocumentTitle('?play=1&fileId=x'), '游玩 · Funloom');
  assert.equal(mod.resolveRomanceDocumentTitle('?reviewPreview=1&fileId=x'), '审核预览 · Funloom');
  assert.equal(mod.resolveRomanceDocumentTitle(''), 'Romance · Funloom');
  assert.doesNotMatch(mod.resolveRomanceDocumentTitle('?createWorld=1'), /今夜她是主角/);
});

test('RomanceHost_挂载时写入document_title', () => {
  const src = readFileSync(join(root, 'src/page/RomanceHost.tsx'), 'utf8');
  assert.match(src, /document\.title\s*=\s*resolveRomanceDocumentTitle/);
  assert.match(src, /from '\.\.\/lib\/romanceDocumentTitle'/);
});

test('Romance_standalone站点标题不再用演示作名', () => {
  const vite = readFileSync(join(root, 'Romance/vite.config.ts'), 'utf8');
  assert.match(vite, /title:\s*'Romance · Funloom'/);
  assert.doesNotMatch(vite, /title:\s*'今夜她是主角'/);
});

test('主站vite含romanceShellGuard挡住dist壳', () => {
  const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
  assert.match(vite, /romanceShellGuard/);
  assert.match(vite, /今夜她是主角/);
});
