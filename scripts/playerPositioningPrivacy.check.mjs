/**
 * 玩家定位含秘密字段；保存定位不写回人设（源码契约，避免经 gameStartConfig 触发 Node ESM 无扩展名问题）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('gameStartConfig_类型与校验含secret', () => {
  const src = readFileSync(join(root, 'src/lib/galgame/gameStartConfig.ts'), 'utf8');
  assert.match(src, /secret\?: string/);
  assert.match(src, /secret:\s*trimStr\(input\.player\.personaBlocks\.secret\)/);
});

test('SystemsPanel_有秘密编辑位', () => {
  const src = readFileSync(
    join(root, 'src/components/Galgame/panels/SystemsPanel.tsx'),
    'utf8',
  );
  assert.match(src, /secret:\s*positionDraft\.secret/);
  assert.match(src, /不被他人所知道的事/);
  assert.match(src, /玩家本人可读可知/);
  assert.match(src, /NPC 默认不知情/);
});

test('Galgame_保存系统配置保留定位且不把定位拼进人设种子', () => {
  const src = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(src, /patch\.personaBlocks\s*\?\?\s*systemPersonaBlocks/);
  assert.match(src, /定位 personaBlocks 与人设独立/);
  assert.doesNotMatch(
    src,
    /built\.data\.player\.personaBlocks\?\.traits/,
  );
});
