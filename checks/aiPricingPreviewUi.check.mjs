import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const readOptional = (path) => {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return '';
  }
};

test('文本计费弹窗底部接入运营核价预览且图片模型不渲染', () => {
  const dialog = readOptional('src/components/ai-model-center/ModelPricingDialog.tsx');
  assert.match(dialog, /TextPricingPreview/);
  assert.match(dialog, /model\.capability === 'text'.*lifecycle\?\.previewContext/s);
  assert.match(dialog, /<TextPricingPreview[\s\S]*pricing=\{textForm\}[\s\S]*context=\{lifecycle\.previewContext\}/);
});

test('核价预览位于文本模型版本备注之前', () => {
  const dialog = readOptional('src/components/ai-model-center/ModelPricingDialog.tsx');
  const previewIndex = dialog.indexOf('<TextPricingPreview');
  const remarkIndex = dialog.indexOf('版本备注（备注内容为发布记录留存显示文本）');

  assert.ok(previewIndex >= 0, '应渲染核价预览');
  assert.ok(remarkIndex >= 0, '应渲染文本模型版本备注');
  assert.ok(previewIndex < remarkIndex, '核价预览应位于版本备注之前');
});

test('未来生效时间位于版本备注之前且备注说明发布记录用途', () => {
  const dialog = readOptional('src/components/ai-model-center/ModelPricingDialog.tsx');
  const effectiveAtIndex = dialog.indexOf('未来生效时间（可选）');
  const remarkIndex = dialog.indexOf('版本备注（备注内容为发布记录留存显示文本）');

  assert.ok(effectiveAtIndex >= 0, '应渲染未来生效时间');
  assert.ok(remarkIndex >= 0, '应渲染版本备注用途说明');
  assert.ok(effectiveAtIndex < remarkIndex, '未来生效时间应位于版本备注之前');
  assert.equal(dialog.match(/版本备注（备注内容为发布记录留存显示文本）/g)?.length, 1);
});

test('发布记录使用默认收起的原生折叠区', () => {
  const dialog = readOptional('src/components/ai-model-center/ModelPricingDialog.tsx');
  const detailsTag = dialog.match(/<details\b[^>]*>/)?.[0] ?? '';

  assert.match(detailsTag, /className=\{styles\.historyDisclosure\}/);
  assert.doesNotMatch(detailsTag, /\bopen\b/);
  assert.match(dialog, /<summary className=\{styles\.historySummary\}>/);
  assert.match(dialog, /发布记录/);
  assert.match(dialog, /history\.length/);
});

test('用户价格倍率说明显示在字段名括号内', () => {
  const dialog = readOptional('src/components/ai-model-center/ModelPricingDialog.tsx');

  assert.match(dialog, /用户价格倍率（x1 表示不加价，权益折扣在动态价之后应用）<input/);
  assert.doesNotMatch(dialog, /<span className=\{styles\.helper\}>1 表示不加价，权益折扣在动态价之后应用。<\/span>/);
});

test('核价组件提供三类 token 输入、双视图、错误提示与实时播报', () => {
  const component = readOptional('src/components/ai-model-center/TextPricingPreview.tsx');
  assert.match(component, /运营核价实时预览/);
  assert.match(component, /预计输入 tokens（未缓存）/);
  assert.match(component, /预计输出 tokens/);
  assert.match(component, /预计缓存命中 tokens/);
  assert.match(component, /创作端 \/ 游玩端普通用户/);
  assert.match(component, /游玩端会员折后/);
  assert.match(component, /会员实际扣费/);
  assert.match(component, /折后人民币收入/);
  assert.match(component, /模型真实成本（折扣不影响）/);
  assert.match(component, /折后真实毛利额/);
  assert.match(component, /折后真实毛利率/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /role="alert"/);
  assert.match(component, /calculateTextPricingPreview/);
});

test('普通结果列使用普通标签，会员结果列使用折后标签', () => {
  const component = readOptional('src/components/ai-model-center/TextPricingPreview.tsx');
  const regularColumn = component.match(/<ResultColumn\s+title="创作端 \/ 游玩端普通用户"[\s\S]*?\/>/)?.[0] ?? '';
  const memberColumn = component.match(/<ResultColumn\s+title=\{`游玩端会员折后[\s\S]*?\/>/)?.[0] ?? '';

  assert.doesNotMatch(regularColumn, /\bmember\b/);
  assert.match(memberColumn, /\bmember\b/);
});

test('计费接口类型与响应式样式包含核价上下文和移动端布局', () => {
  const api = readOptional('src/api/operator/aiModelCenterApi.ts');
  const styles = readOptional('src/components/ai-model-center/modelCatalog.module.css');
  assert.match(api, /previewContext: AiTextPricingPreviewContext \| null/);
  assert.match(api, /memberChargePercent/);
  assert.match(styles, /\.pricingPreview/);
  assert.match(styles, /\.previewResults/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.previewResults/);
});
