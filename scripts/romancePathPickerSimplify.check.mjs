/**
 * 人物线路简化：编辑器去掉玩家可见/路径选择/卡片显示开关；
 * 开局按开放路径条数决定是否弹窗；弹窗只露路径名+开局处境。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');

test('ModPathsEditor_去掉玩家可见路径选择与卡片显示开关', () => {
  const paths = read('components/ModPathsEditor.tsx');
  assert.match(paths, /AI 生成/);
  assert.match(paths, /还没有路径。用上面的 AI 生成，或在下面添加路径。/);
  assert.match(paths, /＋ 添加路径/);
  assert.doesNotMatch(paths, /开局弹窗 · 玩家自选/);
  assert.doesNotMatch(paths, /不显示 · 直接用第一条开放路径/);
  assert.doesNotMatch(paths, /CARD_PARTS/);
  assert.doesNotMatch(paths, /pathHide/);
  assert.doesNotMatch(paths, /pathPicker/);
  assert.doesNotMatch(paths, />卡片显示</);
  assert.doesNotMatch(paths, />路径选择</);
  assert.doesNotMatch(paths, />玩家可见</);
});

test('CharacterCreate_多路径弹窗_单路径直进_卡片只露名与处境', () => {
  const create = read('components/CharacterCreate.tsx');
  assert.match(create, /shouldShowPathPicker/);
  assert.match(create, /lib\/pathPicker/);
  assert.match(create, /多条开放路径时弹窗；卡片只展示路径名 \+ 开局处境/);
  assert.doesNotMatch(create, /pathPicker !== "off"/);
  assert.doesNotMatch(create, /cc\.pathHide/);
  assert.doesNotMatch(create, /可自由决定/);
  assert.doesNotMatch(create, /固定 · 不可更改/);
  assert.doesNotMatch(create, /▌开局人际/);
  assert.doesNotMatch(create, /RoutePerks/);
  assert.match(create, /p\.about/);
});

test('shouldShowPathPicker_按开放条数决定', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/pathPicker.ts')).href);
  assert.equal(mod.shouldShowPathPicker([]), false);
  assert.equal(mod.shouldShowPathPicker([{ open: true }]), false);
  assert.equal(mod.shouldShowPathPicker([{ open: true }, { open: true }]), true);
  assert.equal(mod.shouldShowPathPicker([{ open: true }, { open: false }]), false);
  assert.equal(mod.shouldShowPathPicker(null), false);
});
