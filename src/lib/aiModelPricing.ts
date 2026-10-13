export type AiModelPricingStatus = 'enabled' | 'disabled';
export type AiModelBillingType = 'token' | 'image' | 'video';
export type AiModelPriceScope =
  | 'image_output'
  | 'video_no_reference_output'
  | 'video_reference_input'
  | 'video_reference_output';

export interface AiModelPricingTier {
  scope: AiModelPriceScope;
  resolution: string;
  price: string;
}

export interface AiModelPricingRecord {
  id: number;
  modelCode: string;
  displayName: string;
  billingType: AiModelBillingType;
  inputPrice: string | null;
  outputPrice: string | null;
  cachedInputPrice: string | null;
  tiers: AiModelPricingTier[];
  status: AiModelPricingStatus;
  remark: string;
  createdBy: string | null;
  createdByUser: {
    nickname: string;
    userCode: string;
  } | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelPricingDraft {
  modelCode: string;
  displayName: string;
  billingType: AiModelBillingType;
  inputPrice: string;
  outputPrice: string;
  cachedInputPrice: string;
  tierPrices: Record<string, string>;
  status: AiModelPricingStatus;
  remark: string;
}

export type AiModelPricingField = keyof AiModelPricingDraft;
export type AiModelPricingErrors = Record<string, string | undefined>;

export interface AiModelPricingPayload {
  modelCode: string;
  displayName: string;
  billingType: AiModelBillingType;
  inputPrice: string | null;
  outputPrice: string | null;
  cachedInputPrice: string | null;
  tiers: AiModelPricingTier[];
  status: AiModelPricingStatus;
  remark: string;
  updatedAt?: string;
}

export const AI_MODEL_BILLING_TYPES = [
  { value: 'token', label: '按 Token' },
  { value: 'image', label: '生图' },
  { value: 'video', label: '生视频' },
] as const;

export const AI_IMAGE_RESOLUTIONS = [
  { value: '512_or_below', label: '512 / 1K以下' },
  { value: '1k', label: '1K' },
  { value: '2k', label: '2K' },
  { value: '4k', label: '4K' },
] as const;

export const AI_VIDEO_RESOLUTIONS = [
  { value: '480_540p', label: '480P / 540P' },
  { value: '720_768p', label: '720P / 768P' },
  { value: '1080p', label: '1080P' },
  { value: '2k', label: '2K' },
  { value: '4k', label: '4K' },
] as const;

export const AI_VIDEO_PRICE_SCOPES = [
  { value: 'video_no_reference_output', label: '无参考视频输出' },
  { value: 'video_reference_input', label: '有参考视频输入' },
  { value: 'video_reference_output', label: '有参考视频输出' },
] as const;

const TOKEN_PRICE_FIELDS = ['inputPrice', 'outputPrice', 'cachedInputPrice'] as const;

export function createTierPriceKey(scope: AiModelPriceScope, resolution: string): string {
  return `${scope}:${resolution}`;
}

function validatePrice(value: string, required: boolean): string | undefined {
  const normalized = value.trim();
  if (!normalized) return required ? '启用时必须填写' : undefined;
  if (/^-/.test(normalized)) return '价格必须为非负数字';
  if (/^\d+\.\d{5,}$/.test(normalized)) return '价格最多保留 4 位小数';
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) return '请输入非负数字，最多保留 4 位小数';
  return undefined;
}

function collectTierPrices(draft: AiModelPricingDraft): AiModelPricingTier[] {
  if (draft.billingType === 'token') return [];
  if (draft.billingType === 'image') {
    return AI_IMAGE_RESOLUTIONS.flatMap(({ value: resolution }) => {
      const price = draft.tierPrices[createTierPriceKey('image_output', resolution)]?.trim();
      return price ? [{ scope: 'image_output' as const, resolution, price }] : [];
    });
  }
  return AI_VIDEO_PRICE_SCOPES.flatMap(({ value: scope }) => (
    AI_VIDEO_RESOLUTIONS.flatMap(({ value: resolution }) => {
      const price = draft.tierPrices[createTierPriceKey(scope, resolution)]?.trim();
      return price ? [{ scope, resolution, price }] : [];
    })
  ));
}

export function validateAiModelPricingDraft(draft: AiModelPricingDraft): AiModelPricingErrors {
  const errors: AiModelPricingErrors = {};
  const modelCode = draft.modelCode.trim();
  const displayName = draft.displayName.trim();

  if (!modelCode) errors.modelCode = '必须填写模型标识';
  else if (modelCode.length > 128) errors.modelCode = '模型标识不能超过 128 个字符';
  else if (/[\u0000-\u001f\u007f]/.test(modelCode)) errors.modelCode = '模型标识不能包含控制字符';

  if (!displayName) errors.displayName = '必须填写模型名称';
  else if (displayName.length > 128) errors.displayName = '模型名称不能超过 128 个字符';
  if (draft.remark.trim().length > 500) errors.remark = '备注不能超过 500 个字符';

  if (draft.billingType === 'token') {
    for (const field of TOKEN_PRICE_FIELDS) {
      const error = validatePrice(draft[field], draft.status === 'enabled');
      if (error) errors[field] = error;
    }
    return errors;
  }

  if (draft.billingType === 'image') {
    let populatedCount = 0;
    for (const { value: resolution } of AI_IMAGE_RESOLUTIONS) {
      const key = createTierPriceKey('image_output', resolution);
      const value = draft.tierPrices[key] || '';
      if (value.trim()) populatedCount += 1;
      const error = validatePrice(value, false);
      if (error) errors[key] = error;
    }
    if (draft.status === 'enabled' && populatedCount === 0) {
      errors.tiers = '启用时至少填写一个生图分辨率价格';
    }
    return errors;
  }

  let hasNoReferenceOutput = false;
  let hasReferencePair = false;
  for (const { value: scope } of AI_VIDEO_PRICE_SCOPES) {
    for (const { value: resolution } of AI_VIDEO_RESOLUTIONS) {
      const key = createTierPriceKey(scope, resolution);
      const value = draft.tierPrices[key] || '';
      if (scope === 'video_no_reference_output' && value.trim()) hasNoReferenceOutput = true;
      const error = validatePrice(value, false);
      if (error) errors[key] = error;
    }
  }
  for (const { value: resolution } of AI_VIDEO_RESOLUTIONS) {
    const inputKey = createTierPriceKey('video_reference_input', resolution);
    const outputKey = createTierPriceKey('video_reference_output', resolution);
    const hasInput = Boolean(draft.tierPrices[inputKey]?.trim());
    const hasOutput = Boolean(draft.tierPrices[outputKey]?.trim());
    if (hasInput && !hasOutput) errors[outputKey] = '参考视频输入与输出必须成对填写';
    if (!hasInput && hasOutput) errors[inputKey] = '参考视频输入与输出必须成对填写';
    if (hasInput && hasOutput) hasReferencePair = true;
  }
  if (draft.status === 'enabled' && !hasNoReferenceOutput && !hasReferencePair) {
    errors.tiers = '启用时至少填写一个无参考输出价格，或一组参考视频输入/输出价格';
  }
  return errors;
}

export function toAiModelPricingDraft(record?: AiModelPricingRecord): AiModelPricingDraft {
  if (!record) {
    return {
      modelCode: '',
      displayName: '',
      billingType: 'token',
      inputPrice: '',
      outputPrice: '',
      cachedInputPrice: '',
      tierPrices: {},
      status: 'disabled',
      remark: '',
    };
  }
  const tierPrices = Object.fromEntries(record.tiers.map((tier) => (
    [createTierPriceKey(tier.scope, tier.resolution), tier.price]
  )));
  return {
    modelCode: record.modelCode,
    displayName: record.displayName,
    billingType: record.billingType,
    inputPrice: record.inputPrice || '',
    outputPrice: record.outputPrice || '',
    cachedInputPrice: record.cachedInputPrice || '',
    tierPrices,
    status: record.status,
    remark: record.remark || '',
  };
}

export function toAiModelPricingPayload(
  draft: AiModelPricingDraft,
  updatedAt?: string,
): AiModelPricingPayload {
  const normalizePrice = (value: string): string | null => value.trim() || null;
  const isToken = draft.billingType === 'token';
  const payload: AiModelPricingPayload = {
    modelCode: draft.modelCode.trim(),
    displayName: draft.displayName.trim(),
    billingType: draft.billingType,
    inputPrice: isToken ? normalizePrice(draft.inputPrice) : null,
    outputPrice: isToken ? normalizePrice(draft.outputPrice) : null,
    cachedInputPrice: isToken ? normalizePrice(draft.cachedInputPrice) : null,
    tiers: collectTierPrices(draft),
    status: draft.status,
    remark: draft.remark.trim(),
  };
  if (updatedAt) payload.updatedAt = updatedAt;
  return payload;
}

export function requiresModelCodeConfirmation(originalCode: string, nextCode: string): boolean {
  return originalCode.trim() !== nextCode.trim();
}

export function requiresBillingTypeConfirmation(
  originalType: AiModelBillingType,
  nextType: AiModelBillingType,
): boolean {
  return originalType !== nextType;
}

export function isAiModelPricingIncomplete(record: AiModelPricingRecord): boolean {
  if (record.billingType === 'token') {
    return [record.inputPrice, record.outputPrice, record.cachedInputPrice]
      .some((price) => price === null || !price.trim());
  }
  if (record.billingType === 'image') {
    return !record.tiers.some((tier) => tier.scope === 'image_output' && tier.price.trim());
  }
  let hasNoReferenceOutput = false;
  let hasReferencePair = false;
  for (const { value: resolution } of AI_VIDEO_RESOLUTIONS) {
    const hasInput = record.tiers.some((tier) => (
      tier.scope === 'video_reference_input' && tier.resolution === resolution && tier.price.trim()
    ));
    const hasOutput = record.tiers.some((tier) => (
      tier.scope === 'video_reference_output' && tier.resolution === resolution && tier.price.trim()
    ));
    if (hasInput !== hasOutput) return true;
    if (hasInput && hasOutput) hasReferencePair = true;
    if (record.tiers.some((tier) => (
      tier.scope === 'video_no_reference_output' && tier.resolution === resolution && tier.price.trim()
    ))) hasNoReferenceOutput = true;
  }
  return !hasNoReferenceOutput && !hasReferencePair;
}

export function getAiModelBillingTypeLabel(billingType: AiModelBillingType): string {
  return AI_MODEL_BILLING_TYPES.find((item) => item.value === billingType)?.label || billingType;
}

export function getAiModelPricingSummary(record: AiModelPricingRecord): string[] {
  if (record.billingType === 'token') {
    return [
      `输入 ${record.inputPrice ?? '—'}`,
      `输出 ${record.outputPrice ?? '—'}`,
      `缓存 ${record.cachedInputPrice ?? '—'}`,
    ];
  }
  const resolutionCatalog = record.billingType === 'image'
    ? AI_IMAGE_RESOLUTIONS
    : AI_VIDEO_RESOLUTIONS;
  return record.tiers.map((tier) => {
    const resolution = resolutionCatalog.find((item) => item.value === tier.resolution)?.label
      || tier.resolution;
    if (record.billingType === 'image') return `${resolution} · ${tier.price} 元/张`;
    const scope = AI_VIDEO_PRICE_SCOPES.find((item) => item.value === tier.scope)?.label || tier.scope;
    return `${scope} · ${resolution} · ${tier.price} 元/秒`;
  });
}
