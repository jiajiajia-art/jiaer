/**
 * 玩家定位含秘密字段；保存定位不写回人设；秘密不对玩家 UI 展示
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
  assert.match(src, /normalizeDefaultPersonaBlocks/);
  assert.match(src, /defaultPersonaBlocks/);
});

test('SystemsPanel_秘密不对玩家展示', () => {
  const src = readFileSync(
    join(root, 'src/components/Galgame/panels/SystemsPanel.tsx'),
    'utf8',
  );
  assert.match(src, /secret:\s*personaBlocks\.secret/);
  assert.match(src, /局内不对玩家展示/);
  assert.doesNotMatch(src, /requestPositionAi\('secret'\)/);
  assert.doesNotMatch(src, /玩家本人可读可知/);
  assert.doesNotMatch(src, /positionDraft\.secret/);
});

test('CharactersPanel_创作台有玩家目前定位', () => {
  const src = readFileSync(
    join(root, 'src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx'),
    'utf8',
  );
  assert.match(src, /玩家目前定位/);
  assert.match(src, /positioningSecret/);
  assert.match(src, /positioningTraits/);
  const handlers = readFileSync(
    join(root, 'src/components/GameSettingEditor/CharactersPanel/handlers.ts'),
    'utf8',
  );
  assert.match(handlers, /defaultPersonaBlocks/);
  const utils = readFileSync(
    join(root, 'src/components/GameSettingEditor/CharactersPanel/utils.ts'),
    'utf8',
  );
  assert.match(utils, /extractDefaultPersonaBlocks/);
});

test('Galgame_保存系统配置保留定位且不把定位拼进人设种子', () => {
  const src = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(src, /patch\.personaBlocks\s*\?\?\s*systemPersonaBlocks/);
  assert.match(src, /定位 personaBlocks 与人设独立/);
  assert.match(src, /defaultPersonaBlocks/);
  assert.doesNotMatch(
    src,
    /built\.data\.player\.personaBlocks\?\.traits/,
  );
});
