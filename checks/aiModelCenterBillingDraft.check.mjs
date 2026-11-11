import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeBillingDraftRoutes,
  splitBillingRoutes,
} from '../src/lib/aiBillingDraftRoutes.ts';

const mixedRoute = {
  gatewayRoute: 'openai',
  modelId: 'gpt-mixed',
  inputPriceX10000: 12500,
  outputPriceX10000: 50000,
  cachedInputPriceX10000: 6250,
  textMultiplierX10000: 15000,
  imageMultiplierX10000: 12000,
  imageTiers: [{
    aspectRatio: '1:1',
    upstreamCostYuanX10000: 3000,
    userBasePriceKkX10000: 40000,
  }],
};

const textDraft = {
  gatewayRoute: 'openai',
  modelId: 'gpt-mixed',
  inputPrice: '1.25',
  outputPrice: '5',
  cachedInputPrice: '0.625',
  multiplier: '1.5',
};

const imageDraft = {
  gatewayRoute: 'OPENAI',
  modelId: 'GPT-MIXED',
  multiplier: '1.2',
  imageTiers: [{
    aspectRatio: '1:1',
    upstreamCost: '0.3',
    userBasePrice: '4',
  }],
};

test('splits historical mixed model routes into independent text and image drafts', () => {
  const result = splitBillingRoutes([mixedRoute]);

  assert.deepEqual(result.textRoutes, [textDraft]);
  assert.deepEqual(result.imageRoutes, [{ ...imageDraft, gatewayRoute: 'openai', modelId: 'gpt-mixed' }]);
});

test('merges text and image drafts with the same route key into one compatible payload route', () => {
  const result = mergeBillingDraftRoutes([textDraft], [imageDraft]);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], mixedRoute);
});

test('keeps different text and image model ids as separate payload routes', () => {
  const result = mergeBillingDraftRoutes([textDraft], [{
    ...imageDraft,
    modelId: 'gpt-image-1',
  }]);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0].imageTiers, []);
  assert.equal(result[1].inputPriceX10000, null);
  assert.equal(result[1].modelId, 'gpt-image-1');
});

test('rejects image models without a ratio tier', () => {
  assert.throws(
    () => mergeBillingDraftRoutes([], [{ ...imageDraft, imageTiers: [] }]),
    /至少添加一个比例档位/,
  );
});
