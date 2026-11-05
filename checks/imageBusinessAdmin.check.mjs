import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('生图运行配置应提供逐业务场景模型选择并隐藏 legacy', () => {
  const panel = readFileSync(join(root, 'src/components/ImageBusinessConfigPanel.tsx'), 'utf8');
  const pricingApi = readFileSync(join(root, 'src/api/imageBusinessPricingApi.ts'), 'utf8');
  assert.match(panel, /availableModels/);
  assert.match(panel, /primaryAspectRatioKey/);
  assert.match(panel, /expectedUpdatedAt/);
  assert.match(panel, /resolutions\.map/);
  assert.doesNotMatch(panel, /legacy 生图服务/);
  assert.match(panel, /请选择兼容模型/);
  assert.match(panel, /业务配置已保存/);
  assert.doesNotMatch(panel, /Select a compatible model|Business configuration saved/);
  assert.match(panel, /AI 文游创作/);
  assert.match(panel, /AI 文游游玩/);
  assert.match(panel, /平台/);
  assert.match(panel, /groupedItems/);
  for (const scenarioKey of [
    'visual_character',
    'visual_character_variant',
    'visual_scene',
    'session_avatar_control',
    'visual_cover_landscape',
    'visual_cover_portrait',
    'warehouse_card',
  ]) {
    assert.match(pricingApi, new RegExp(`'${scenarioKey}'`));
  }
  assert.doesNotMatch(pricingApi, /screenwriter_|session_avatar_treatment|world_npc|world_scene|world_subscene|world_ability_node|world_map/);

  const hub = readFileSync(join(root, 'src/components/ModelConfigHub.tsx'), 'utf8');
  assert.match(hub, /ImageBusinessConfigPanel/);
  assert.match(hub, /pane === 'image'/);
  assert.doesNotMatch(hub, /全平台仅启用一个生图模型/);
});

test('业务场景模型下拉应过滤缺少固定比例档位的模型', () => {
  const panel = readFileSync(join(root, 'src/components/ImageBusinessConfigPanel.tsx'), 'utf8');
  assert.match(panel, /isModelCompatible/);
  assert.match(panel, /requiredRatios/);
  assert.match(panel, /imageTiers/);
});

test('生图模型价格与业务场景价格统一展示为织梦豆每张', () => {
  const dialog = readFileSync(join(root, 'src/components/ai-model-center/ModelPricingDialog.tsx'), 'utf8');
  const panel = readFileSync(join(root, 'src/components/ImageBusinessConfigPanel.tsx'), 'utf8');
  assert.match(dialog, /用户价格（织梦豆 \/ 张）/);
  assert.doesNotMatch(dialog, /用户价格（KK \/ 张）/);
  assert.match(panel, /织梦豆\/张/);
  assert.doesNotMatch(panel, /points\/image/);
});

test('旧世界互动能力节点继续使用固定价格且不读取动态业务配置', () => {
  const objectsPanel = readFileSync(join(root, 'src/components/GameSettingEditor/ObjectsPanel/ObjectsPanel.tsx'), 'utf8');
  assert.doesNotMatch(objectsPanel, /useImageBusinessPrice\('world_ability_node'/);
  assert.match(objectsPanel, /LEGACY_WORLD_OBJECT_BATCH_GENERATION_COST/);
});

test('运行配置中的生图模型按业务场景选择，不再提供全局启用动作', () => {
  const hub = readFileSync(join(root, 'src/components/ModelConfigHub.tsx'), 'utf8');
  const center = readFileSync(join(root, 'src/components/AiModelCenter.tsx'), 'utf8');
  assert.match(hub, /pane === 'text' \? \(model\) => void handleActivate\(model\) : undefined/);
  assert.match(hub, /deactivateModel/);
  assert.match(hub, /onDeactivate/);
  assert.match(center, /items={grouped\.image}[\s\S]*showRuntimeActive={false}/);
});
