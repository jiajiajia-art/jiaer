/**
 * 进游戏不再显示封面开始菜单（标题 + 开始/继续/配置 AI）；默认建角，完成后进开幕。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, 'Romance/src', p), 'utf8');

test('GameContext_默认屏为create_go_cover改走create', () => {
  const ctx = src('store/GameContext.tsx');
  assert.match(ctx, /useState<Screen>\("create"\)/);
  assert.match(ctx, /s === "cover" \? "create" : s/);
  assert.match(ctx, /setScreen\("create"\)/);
  assert.doesNotMatch(ctx, /setScreen\("cover"\)/);
});

test('App_PlayScreens不再挂载Cover开始菜单', () => {
  const app = src('App.tsx');
  assert.doesNotMatch(app, /import Cover from/);
  assert.doesNotMatch(app, /return <Cover/);
  assert.match(app, /screen === "create" \|\| screen === "cover"/);
  assert.match(app, /封面开始菜单/);
  assert.match(app, /回到建角/);
  assert.doesNotMatch(app, /回到封面/);
});

test('CharacterCreate_禁止返回封面文案_作者预览可退出', () => {
  const create = src('components/CharacterCreate.tsx');
  assert.doesNotMatch(create, /返回封面/);
  assert.match(create, /requestAuthorPreviewEnd/);
  assert.match(create, /退出预览/);
  assert.match(create, /读取存档/);
});

test('Ending_再来一局进建角不进封面', () => {
  const ending = src('components/Ending.tsx');
  assert.match(ending, /go\("create"\)/);
  assert.match(ending, /再来一局/);
  assert.doesNotMatch(ending, /返回封面/);
});
