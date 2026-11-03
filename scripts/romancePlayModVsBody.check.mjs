/**
 * 本体 vs 玩法 Mod：作者态隐藏模组底座依赖；玩法目录不含世界观骨架。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const catalogSrc = readFileSync(join(romance, 'mods/playModCatalog.ts'), 'utf8');
const modal = readFileSync(join(romance, 'components/AddPlayModModal.tsx'), 'utf8');

test('作者态_隐藏模组底座依赖并清空world底座', () => {
  assert.doesNotMatch(panel, /高级设置 · 模组底座依赖/);
  assert.doesNotMatch(panel, /收起 · 高级：模组底座依赖/);
  assert.doesNotMatch(panel, /showModDepsAdvanced/);
  assert.doesNotMatch(panel, /当前底座依赖/);
  assert.match(panel, /authorSimplify && out\.kind === "world"\) out\.dependencies = \[\]/);
  assert.match(panel, /本剧本体/);
  assert.match(panel, /娱乐圈 \/ 校园等世界观底子不是玩法/);
});

test('玩法目录_只有可选玩法不含骨架与头衔扩展底子', async () => {
  const cat = await import(pathToFileURL(join(romance, 'mods/playModCatalog.ts')).href);
  const names = cat.LOCAL_PLAY_MOD_CATALOG.map((x) => x.name).join('|');
  assert.doesNotMatch(names, /星光|娱乐圈·|青藤校园|头衔扩展/);
  assert.match(names, /头衔包/);
  assert.match(names, /孕育包/);
  assert.match(names, /出行与交通/);
  assert.match(names, /座驾包/);
  assert.match(catalogSrc, /禁止把娱乐圈骨架/);
  assert.match(modal, /也不含娱乐圈\/校园等世界观骨架/);
});
