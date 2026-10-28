/**
 * 模组编辑器 · 底栏页签实时预览 + 顺序/显隐/超长提示契约
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('ModEditorPanel_底栏页签应挂载NavTabsModEditor实时预览', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(panel, /title="底栏页签"/);
  assert.match(panel, /NavTabsModEditor/);
  assert.match(panel, /navTabs=\{c\.navTabs\}/);
  assert.match(panel, /navSize=\{c\.navSize\}/);
});

test('NavTabsModEditor_应置顶实机同款预览并支持拖拽与显隐', () => {
  const ed = readFileSync(join(romance, 'components/NavTabsModEditor.tsx'), 'utf8');
  assert.match(ed, /底栏实时预览/);
  assert.match(ed, /NavGlyph/);
  assert.match(ed, /draggable/);
  assert.match(ed, /显示|隐藏/);
  assert.match(ed, /NAV_MAX_LABEL/);
  assert.match(ed, /navConfigWarnings/);
  assert.match(ed, /完整试玩请用编辑器顶部「预览」/);
  // 预览区块须排在可拖拽列表（cursor-grab）之前
  const previewIdx = ed.indexOf('底栏实时预览');
  const listIdx = ed.indexOf('cursor-grab');
  assert.ok(previewIdx >= 0 && listIdx > previewIdx, '实时预览应在拖拽列表上方');
});

test('navTabsConfig_解析与警告契约', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/navTabsConfig.ts')).href);
  const pool = mod.buildNavPool({ industryTab: true, phone: true, imageCrisis: true });
  assert.ok(pool.some((p) => p.id === 'home'));
  assert.ok(pool.some((p) => p.id === 'phone'));

  const slots = mod.resolveNavSlots(pool, [
    { id: 'home', on: true },
    { id: 'phone', label: '灵犀', on: true },
    { id: 'actions', on: false },
  ], 4);
  assert.equal(slots[0].id, 'home');
  assert.ok(slots.some((s) => s.id === 'phone' && s.label === '灵犀'));
  assert.ok(!slots.some((s) => s.id === 'actions'));

  const warns = mod.navConfigWarnings(
    [
      { id: 'home', label: '世界', on: true },
      { id: 'phone', label: '超级长名字', on: true },
      { id: 'npc', label: '', on: true },
      { id: 'sim', label: '', on: true },
      { id: 'image', label: '', on: true },
    ],
    4,
    pool.length,
  );
  assert.ok(warns.some((w) => w.includes('超过') || w.includes('超')));
  assert.ok(warns.some((w) => w.includes('容量') || w.includes('格')));

  const terms = mod.termsFromNavTabs([{ id: 'phone', label: '灵犀', on: true }]);
  assert.equal(terms.tabPhone, '灵犀');

  const packed = mod.compactNavConfig(
    [
      { id: 'home', on: true },
      { id: 'actions', on: true },
      { id: 'npc', on: true },
      { id: 'phone', on: true },
    ],
    4,
    pool.length,
  );
  assert.equal(packed.navTabs, undefined);
  assert.equal(packed.navSize, undefined);
});

test('MudChrome_resolveNav应委托navTabsConfig', () => {
  const chrome = readFileSync(join(romance, 'components/MudChrome.tsx'), 'utf8');
  assert.match(chrome, /resolveNavSlots/);
  assert.match(chrome, /navSizesFor/);
});

test('newGame_应从模组写入navTabs', () => {
  const store = readFileSync(join(romance, 'lib/store.ts'), 'utf8');
  assert.match(store, /worldNav\.navTabs/);
  assert.match(store, /navSize: worldNav\.navSize/);
});
