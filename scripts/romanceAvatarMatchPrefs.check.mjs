/**
 * 剧本级头像匹配优先级：绑在 avatars.match，编辑器①基础配置，随模组导入导出；
 * 平台仅默认值，不得覆盖已保存剧本设置。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('resolveAvatarMatchPrefs_缺省私人优先且启用通用_显式配置不被默认覆盖', async () => {
  const mod = await import(join(root, 'Romance/src/lib/types.ts'));
  const def = mod.resolveAvatarMatchPrefs(undefined);
  assert.equal(def.prefer, 'private');
  assert.equal(def.allowUniversalFallback, true);
  assert.deepEqual(def.sourceOrder, ['private', 'public', 'system']);

  const emptySlot = mod.resolveAvatarMatchPrefs({});
  assert.equal(emptySlot.prefer, 'private');
  assert.equal(emptySlot.allowUniversalFallback, true);

  const publicFirst = mod.resolveAvatarMatchPrefs({ match: { prefer: 'public' } });
  assert.equal(publicFirst.prefer, 'public');
  assert.deepEqual(publicFirst.sourceOrder, ['public', 'private', 'system']);
  assert.equal(publicFirst.allowUniversalFallback, true);

  const uniOff = mod.resolveAvatarMatchPrefs({ match: { prefer: 'private', allowUniversalFallback: false } });
  assert.equal(uniOff.prefer, 'private');
  assert.equal(uniOff.allowUniversalFallback, false);

  // 功能注释：剧本显式写了 true 也应保留，不能被「缺省」逻辑抹掉
  const uniOn = mod.resolveAvatarMatchPrefs({ match: { allowUniversalFallback: true } });
  assert.equal(uniOn.allowUniversalFallback, true);
});

test('ModEditor_头像库与匹配优先级在②角色_仓库页无全局匹配设置', () => {
  const editor = read('Romance/src/components/ModEditorPanel.tsx');
  const pools = read('Romance/src/components/ModAvatarPoolsEditor.tsx');
  const wizard = read('Romance/src/lib/worldGenWizard.ts');
  const avatarPools = read('Romance/src/game/avatarPools.ts');

  assert.match(editor, /g="role"[\s\S]{0,120}title="头像库与匹配优先级"/);
  assert.match(editor, /ModAvatarPoolsEditor/);
  assert.doesNotMatch(editor, /g="role"[\s\S]{0,80}title="头像池"/);
  assert.match(pools, /匹配优先级/);
  assert.match(pools, /私人库优先|公共库优先/);
  assert.match(pools, /启用「通用」头像作为兜底/);
  assert.match(pools, /match:\s*\{/);
  assert.match(wizard, /id:\s*"avatars",\s*group:\s*"② 角色"/);
  assert.doesNotMatch(wizard, /id:\s*"avatars",\s*group:\s*"① 基础"/);
  assert.match(avatarPools, /resolveAvatarMatchPrefs/);
  assert.match(avatarPools, /prefer === "public"/);
});
