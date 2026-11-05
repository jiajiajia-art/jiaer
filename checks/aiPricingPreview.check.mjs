import test from 'node:test';
import assert from 'node:assert/strict';

const previewModule = await import('../src/lib/aiPricingPreview.ts').catch(() => ({}));

const context = {
  textUserBasePricePer1kX10000: 1_000,
  memberChargePercent: 85,
  kkPerYuan: 10,
  kkMinorScale: 100,
};

const baseInput = {
  inputTokens: '600000',
  outputTokens: '400000',
  cachedInputTokens: '0',
  inputPrice: '1',
  outputPrice: '4',
  cachedInputPrice: '0.02',
  multiplier: '1',
  context,
};

test('核价模块提供精确文本试算与格式化能力', () => {
  assert.equal(typeof previewModule.calculateTextPricingPreview, 'function');
  assert.equal(typeof previewModule.formatKkMinor, 'function');
  assert.equal(typeof previewModule.formatMicroYuan, 'function');
  assert.equal(typeof previewModule.formatMarginTenths, 'function');
});

test('截图示例同时计算普通用户和会员真实毛利', () => {
  const result = previewModule.calculateTextPricingPreview(baseInput);

  assert.equal(result.realCostMicroYuan, 2_200_000n);
  assert.deepEqual(result.regular, {
    userChargeKkMinor: 10_000n,
    revenueMicroYuan: 10_000_000n,
    profitMicroYuan: 7_800_000n,
    marginTenths: 780n,
  });
  assert.deepEqual(result.member, {
    userChargeKkMinor: 8_500n,
    revenueMicroYuan: 8_500_000n,
    profitMicroYuan: 6_300_000n,
    marginTenths: 741n,
  });
  assert.equal(previewModule.formatKkMinor(result.regular.userChargeKkMinor, context.kkMinorScale), '100.00');
  assert.equal(previewModule.formatMicroYuan(result.realCostMicroYuan), '2.20');
  assert.equal(previewModule.formatMarginTenths(result.member.marginTenths), '74.1%');
});

test('缓存成本、价格倍率、会员折扣和最小 KK 单位沿用结算取整', () => {
  const cached = previewModule.calculateTextPricingPreview({
    ...baseInput,
    inputTokens: '0',
    outputTokens: '0',
    cachedInputTokens: '10000',
    multiplier: '1.5',
  });
  assert.equal(cached.realCostMicroYuan, 200n);
  assert.equal(cached.regular.userChargeKkMinor, 150n);
  assert.equal(cached.member.userChargeKkMinor, 128n);

  const minimum = previewModule.calculateTextPricingPreview({
    ...baseInput,
    inputTokens: '1',
    outputTokens: '0',
  });
  assert.equal(minimum.regular.userChargeKkMinor, 1n);
  assert.equal(minimum.member.userChargeKkMinor, 1n);
});

test('零收入不计算毛利率，成本高于收入时保留负毛利', () => {
  const zero = previewModule.calculateTextPricingPreview({
    ...baseInput,
    inputTokens: '0',
    outputTokens: '0',
  });
  assert.equal(zero.regular.marginTenths, null);
  assert.equal(zero.member.marginTenths, null);

  const loss = previewModule.calculateTextPricingPreview({
    ...baseInput,
    inputPrice: '100',
    outputPrice: '400',
  });
  assert.ok(loss.regular.profitMicroYuan < 0n);
  assert.ok(loss.regular.marginTenths < 0n);
});

test('拒绝负数、小数、超大 tokens 与无效成本参数', () => {
  assert.throws(() => previewModule.calculateTextPricingPreview({
    ...baseInput,
    inputTokens: '-1',
  }), /输入 tokens 必须是非负整数/);
  assert.throws(() => previewModule.calculateTextPricingPreview({
    ...baseInput,
    outputTokens: '1.5',
  }), /输出 tokens 必须是非负整数/);
  assert.throws(() => previewModule.calculateTextPricingPreview({
    ...baseInput,
    cachedInputTokens: String(BigInt(Number.MAX_SAFE_INTEGER) + 1n),
  }), /缓存命中 tokens 数值过大/);
  assert.throws(() => previewModule.calculateTextPricingPreview({
    ...baseInput,
    inputPrice: 'abc',
  }), /最多四位小数的非负数/);
});
