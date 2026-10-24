import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('用户端应通过统一接口读取业务场景生图价格且不以固定 6 兜底', () => {
  const api = readFileSync(join(root, 'src/api/imageBusinessPricingApi.ts'), 'utf8');
  const hook = readFileSync(join(root, 'src/hooks/useImageBusinessPrice.ts'), 'utf8');
  assert.match(api, /\/ai-image\/business-prices/);
  assert.match(hook, /priceUnavailable/);
  assert.match(hook, /maxRequiredPoints/);
  assert.doesNotMatch(hook, /\?\?\s*6|\|\|\s*6/);
});

test('平台可见场景不使用固定价格，旧世界互动保留专用固定价格', () => {
  const constants = readFileSync(join(root, 'src/utils/constants.ts'), 'utf8');
  assert.match(constants, /LEGACY_WORLD_CHARACTER_GENERATION_COST/);
  assert.match(constants, /LEGACY_WORLD_SCENE_GENERATION_COST/);
  assert.match(constants, /LEGACY_WORLD_ABILITY_NODE_GENERATION_COST/);
  assert.match(constants, /LEGACY_WORLD_OBJECT_BATCH_GENERATION_COST/);

  const consumers = [
    'src/components/Galgame/panels/CharacterProfileForm.tsx',
    'src/components/Galgame/panels/PlayerArchiveSection.tsx',
    'src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx',
    'src/components/GameSettingEditor/FunctionalNPCsPanel/FunctionalNPCDetail.tsx',
    'src/components/GameSettingEditor/FunctionalNPCsPanel/FunctionalNPCsPanel.tsx',
    'src/components/GameSettingEditor/ObjectsPanel/ObjectDetail.tsx',
    'src/components/GameSettingEditor/ScenesPanel/SceneDetailForm.tsx',
    'src/components/GameSettingEditor/ScenesPanel/ScenesPanel.tsx',
    'src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx',
    'src/page/Galgame.tsx',
    'src/page/warehouse/WarehouseCardAvatarField.tsx',
    'src/page/warehouse/WarehouseCharacterCards.tsx',
    'src/page/warehouse/WarehousePersonaCards.tsx',
  ];
  for (const file of consumers) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.doesNotMatch(source, /\bCHARACTER_GENERATION_COST\b|\bSCENE_GENERATION_COST\b/, file);
  }
});

test('人物基础立绘与差分立绘应读取独立业务价格，旧世界人物不读取动态配置', () => {
  const source = readFileSync(join(root, 'src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx'), 'utf8');
  assert.match(source, /'visual_character'/);
  assert.match(source, /'visual_character_variant'/);
  assert.match(source, /variantPrice/);
  assert.doesNotMatch(source, /'world_npc'/);
  assert.match(source, /LEGACY_WORLD_CHARACTER_GENERATION_COST/);
});

test('价格不可用时平台动态生图入口应阻止提交', () => {
  const expectations = new Map([
    ['src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx', /characterPrice == null/],
    ['src/page/warehouse/WarehouseCardAvatarField.tsx', /estimatedPoints == null/],
  ]);
  for (const [file, pattern] of expectations) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.match(source, pattern, file);
  }
});
