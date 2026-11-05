import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildModelPublishPayload,
  serializeImagePricingDraft,
  serializeTextPricingDraft,
  toModelCatalogCards,
} from '../src/lib/aiModelCatalog.ts';

const textCatalog = {
  id: 12,
  capability: 'text',
  sourceGatewayKey: 'epone',
  sourceGatewayLabel: 'epone / ggb',
  sourceBaseUrl: 'https://epone.example',
  modelId: 'deepseek-v4-pro-0813',
  displayName: 'DeepSeek V4 Pro',
  sourceKind: 'preset',
  selectable: true,
  active: true,
  pricingStatus: 'draft',
  activePricingVersionId: null,
  scheduledPricingVersionId: null,
  draftPricingVersionId: 31,
};

test('目录行转换为能力分组卡片且运行状态与计费状态互不覆盖', () => {
  const result = toModelCatalogCards([
    textCatalog,
    {
      ...textCatalog,
      id: 13,
      capability: 'image',
      modelId: 'gpt-image-2',
      displayName: 'GPT Image 2',
      active: false,
      pricingStatus: 'active',
      activePricingVersionId: 41,
      draftPricingVersionId: null,
    },
  ]);

  assert.equal(result.text.length, 1);
  assert.equal(result.image.length, 1);
  assert.equal(result.text[0].active, true);
  assert.equal(result.text[0].pricingStatus, 'draft');
  assert.equal(result.image[0].active, false);
  assert.equal(result.image[0].pricingStatus, 'active');
});

test('生文表单只序列化三项真实成本、倍率与备注，不包含线路字段', () => {
  const result = serializeTextPricingDraft({
    inputPrice: '1.25',
    outputPrice: '5',
    cachedInputPrice: '0.0625',
    multiplier: '1.2',
    remark: 'new cost',
  });

  assert.deepEqual(result, {
    text: {
      inputPriceX10000: 12500,
      outputPriceX10000: 50000,
      cachedInputPriceX10000: 625,
      multiplierX10000: 12000,
    },
    remark: 'new cost',
  });
  assert.equal('gatewayRoute' in result, false);
  assert.equal('modelId' in result, false);
});

test('生图表单序列化倍率和比例档位并拒绝重复比例', () => {
  const result = serializeImagePricingDraft({
    multiplier: '1.1',
    remark: '',
    tiers: [
      { aspectRatio: '1:1', upstreamCost: '0.3', userBasePrice: '4.5' },
      { aspectRatio: '16:9', upstreamCost: '0.5', userBasePrice: '6' },
    ],
  });

  assert.deepEqual(result.image, {
    multiplierX10000: 11000,
    tiers: [
      { aspectRatio: '1:1', upstreamCostYuanX10000: 3000, userBasePriceKkX10000: 45000 },
      { aspectRatio: '16:9', upstreamCostYuanX10000: 5000, userBasePriceKkX10000: 60000 },
    ],
  });

  assert.throws(() => serializeImagePricingDraft({
    multiplier: '1',
    remark: '',
    tiers: [
      { aspectRatio: '1:1', upstreamCost: '0.3', userBasePrice: '4' },
      { aspectRatio: ' 1:1 ', upstreamCost: '0.4', userBasePrice: '5' },
    ],
  }), /比例档位不能重复/);
});

test('已有待生效版本时发布必须显式确认替换', () => {
  assert.throws(
    () => buildModelPublishPayload({
      effectiveAt: '2026-10-24T00:00:00.000Z',
      hasScheduledVersion: true,
      replaceScheduled: false,
    }),
    /确认替换待生效版本/,
  );

  assert.deepEqual(buildModelPublishPayload({
    effectiveAt: '2026-10-24T00:00:00.000Z',
    hasScheduledVersion: true,
    replaceScheduled: true,
  }), {
    effectiveAt: '2026-10-24T00:00:00.000Z',
    replaceScheduled: true,
  });
});
