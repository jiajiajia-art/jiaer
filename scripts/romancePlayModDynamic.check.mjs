/**
 * 玩法 Mod：编辑器按已安装动态显示；禁止硬编码永久挂死通告/孕育等入口
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panel = readFileSync(join(root, 'Romance/src/components/ModEditorPanel.tsx'), 'utf8');
const catalog = readFileSync(join(root, 'Romance/src/mods/playModCatalog.ts'), 'utf8');

test('ModEditorPanel_玩法面板须按 showPlay 动态挂载', () => {
  assert.match(panel, /showPlay\("gigs"\)/);
  assert.match(panel, /showPlay\("pregnancy"\)/);
  assert.match(panel, /showPlay\("cars"\)/);
  assert.match(panel, /showPlay\("travel"\)/);
  assert.match(panel, /添加玩法/);
  assert.match(panel, /playModInstalls/);
  assert.match(panel, /AddPlayModModal/);
  assert.match(panel, /title="已添加的玩法"/);
  assert.doesNotMatch(panel, /label: "⑤ 玩法 Mod"/);
  assert.doesNotMatch(panel, /label: "⑦ 功能扩展"/);
});

test('playModCatalog_开放配置白名单不含底层规则字段', () => {
  assert.match(catalog, /pickPlayModOpenConfig/);
  assert.match(catalog, /resolveInstalledEditorPanels/);
  assert.doesNotMatch(catalog, /gigs:\s*\[/);
});

test('playModCatalog_须含出行与交通玩法且默认不进世界页', () => {
  assert.match(catalog, /slug: "pack-transport"/);
  assert.match(catalog, /editorPanels: \["travel"\]/);
  assert.doesNotMatch(panel, /title="开局天气"/);
  assert.match(panel, /本剧已保存出行配置/);
});

test('playModCatalog_依赖链应可读并按序安装', async () => {
  const { pathToFileURL } = await import('node:url');
  const cat = await import(pathToFileURL(join(root, 'Romance/src/mods/playModCatalog.ts')).href);
  const cars = cat.catalogBySlug('pack-cars');
  const names = cat.missingPlayModDepNames(cars, []);
  assert.deepEqual(names, ['出行与交通']);
  const chain = cat.resolvePlayModInstallChain(cars, []);
  assert.deepEqual(chain.map((x) => x.slug), ['pack-transport', 'pack-cars']);
});
