import { decimalToX10000 } from './aiBillingCenter.ts';

export type AiModelCapability = 'text' | 'image';
export type AiModelPricingStatus = 'active' | 'scheduled' | 'draft' | 'unpriced';

export interface AiModelCatalogCard {
  id: number;
  capability: AiModelCapability;
  sourceGatewayKey: string;
  sourceGatewayLabel: string;
  sourceBaseUrl: string;
  modelId: string;
  displayName: string;
  sourceKind: 'preset' | 'fetched';
  selectable: boolean;
  active: boolean;
  pricingStatus: AiModelPricingStatus;
  activePricingVersionId: number | null;
  scheduledPricingVersionId: number | null;
  draftPricingVersionId: number | null;
}

export interface TextPricingDraftForm {
  inputPrice: string;
  outputPrice: string;
  cachedInputPrice: string;
  multiplier: string;
  remark: string;
}

export interface ImagePricingTierForm {
  aspectRatio: string;
  upstreamCost: string;
  userBasePrice: string;
}

export interface ImagePricingDraftForm {
  multiplier: string;
  remark: string;
  tiers: ImagePricingTierForm[];
}

export function toModelCatalogCards(rows: AiModelCatalogCard[]) {
  return rows.reduce<{ text: AiModelCatalogCard[]; image: AiModelCatalogCard[] }>((groups, row) => {
    groups[row.capability].push({ ...row });
    return groups;
  }, { text: [], image: [] });
}

export function serializeTextPricingDraft(form: TextPricingDraftForm) {
  return {
    text: {
      inputPriceX10000: decimalToX10000(form.inputPrice),
      outputPriceX10000: decimalToX10000(form.outputPrice),
      cachedInputPriceX10000: decimalToX10000(form.cachedInputPrice),
      multiplierX10000: decimalToX10000(form.multiplier),
    },
    remark: form.remark.trim(),
  };
}

export function serializeImagePricingDraft(form: ImagePricingDraftForm) {
  if (form.tiers.length === 0) throw new Error('至少添加一个比例档位');
  const seen = new Set<string>();
  const tiers = form.tiers.map((tier) => {
    const aspectRatio = tier.aspectRatio.trim();
    if (!aspectRatio) throw new Error('比例档位不能为空');
    const key = aspectRatio.toLowerCase();
    if (seen.has(key)) throw new Error('比例档位不能重复');
    seen.add(key);
    return {
      aspectRatio,
      upstreamCostYuanX10000: decimalToX10000(tier.upstreamCost),
      userBasePriceKkX10000: decimalToX10000(tier.userBasePrice),
    };
  });
  return {
    image: {
      multiplierX10000: decimalToX10000(form.multiplier),
      tiers,
    },
    remark: form.remark.trim(),
  };
}

export function buildModelPublishPayload(input: {
  effectiveAt?: string | null;
  hasScheduledVersion: boolean;
  replaceScheduled: boolean;
}) {
  if (input.hasScheduledVersion && !input.replaceScheduled) {
    throw new Error('请先确认替换待生效版本');
  }
  return {
    effectiveAt: input.effectiveAt || null,
    replaceScheduled: input.replaceScheduled,
  };
}
