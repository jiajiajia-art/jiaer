import type { AiBillingModelRoute } from '../api/operator/aiModelCenterApi.ts';
import { decimalToX10000, x10000ToDecimal } from './aiBillingCenter.ts';

export type ImageBillingDraftTier = {
  aspectRatio: string;
  upstreamCost: string;
  userBasePrice: string;
};

export type TextBillingDraftRoute = {
  gatewayRoute: string;
  modelId: string;
  inputPrice: string;
  outputPrice: string;
  cachedInputPrice: string;
  multiplier: string;
};

export type ImageBillingDraftRoute = {
  gatewayRoute: string;
  modelId: string;
  multiplier: string;
  imageTiers: ImageBillingDraftTier[];
};

export const blankTextBillingDraftRoute = (): TextBillingDraftRoute => ({
  gatewayRoute: '',
  modelId: '',
  inputPrice: '',
  outputPrice: '',
  cachedInputPrice: '',
  multiplier: '1',
});

export const blankImageBillingDraftRoute = (): ImageBillingDraftRoute => ({
  gatewayRoute: '',
  modelId: '',
  multiplier: '1',
  imageTiers: [],
});

function routeKey(route: { gatewayRoute: string; modelId: string }): string {
  return `${route.gatewayRoute.trim().toLowerCase()}\u0000${route.modelId.trim().toLowerCase()}`;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`请填写${label}`);
  return normalized;
}

export function splitBillingRoutes(routes: AiBillingModelRoute[]): {
  textRoutes: TextBillingDraftRoute[];
  imageRoutes: ImageBillingDraftRoute[];
} {
  const textRoutes: TextBillingDraftRoute[] = [];
  const imageRoutes: ImageBillingDraftRoute[] = [];

  for (const route of routes) {
    if (route.inputPriceX10000 !== null) {
      textRoutes.push({
        gatewayRoute: route.gatewayRoute,
        modelId: route.modelId,
        inputPrice: x10000ToDecimal(route.inputPriceX10000),
        outputPrice: x10000ToDecimal(route.outputPriceX10000),
        cachedInputPrice: x10000ToDecimal(route.cachedInputPriceX10000),
        multiplier: x10000ToDecimal(route.textMultiplierX10000),
      });
    }
    if (route.imageTiers.length > 0) {
      imageRoutes.push({
        gatewayRoute: route.gatewayRoute,
        modelId: route.modelId,
        multiplier: x10000ToDecimal(route.imageMultiplierX10000),
        imageTiers: route.imageTiers.map((tier) => ({
          aspectRatio: tier.aspectRatio,
          upstreamCost: x10000ToDecimal(tier.upstreamCostYuanX10000),
          userBasePrice: x10000ToDecimal(tier.userBasePriceKkX10000),
        })),
      });
    }
  }

  return { textRoutes, imageRoutes };
}

export function mergeBillingDraftRoutes(
  textRoutes: TextBillingDraftRoute[],
  imageRoutes: ImageBillingDraftRoute[],
): AiBillingModelRoute[] {
  const result = new Map<string, AiBillingModelRoute>();

  for (const route of textRoutes) {
    const gatewayRoute = requiredText(route.gatewayRoute, '生文模型的网关线路');
    const modelId = requiredText(route.modelId, '生文模型 ID');
    const key = routeKey({ gatewayRoute, modelId });
    if (result.has(key)) throw new Error(`生文模型线路重复：${gatewayRoute} / ${modelId}`);
    result.set(key, {
      gatewayRoute,
      modelId,
      inputPriceX10000: decimalToX10000(route.inputPrice),
      outputPriceX10000: decimalToX10000(route.outputPrice),
      cachedInputPriceX10000: decimalToX10000(route.cachedInputPrice),
      textMultiplierX10000: decimalToX10000(route.multiplier || '1'),
      imageMultiplierX10000: 10000,
      imageTiers: [],
    });
  }

  const imageKeys = new Set<string>();
  for (const route of imageRoutes) {
    const gatewayRoute = requiredText(route.gatewayRoute, '生图模型的网关线路');
    const modelId = requiredText(route.modelId, '生图模型 ID');
    if (route.imageTiers.length === 0) throw new Error(`生图模型 ${modelId} 至少添加一个比例档位`);
    const key = routeKey({ gatewayRoute, modelId });
    if (imageKeys.has(key)) throw new Error(`生图模型线路重复：${gatewayRoute} / ${modelId}`);
    imageKeys.add(key);

    const aspectRatios = new Set<string>();
    const imageTiers = route.imageTiers.map((tier) => {
      const aspectRatio = requiredText(tier.aspectRatio, '生图比例');
      const aspectRatioKey = aspectRatio.toLowerCase();
      if (aspectRatios.has(aspectRatioKey)) throw new Error(`生图比例档位重复：${aspectRatio}`);
      aspectRatios.add(aspectRatioKey);
      return {
        aspectRatio,
        upstreamCostYuanX10000: decimalToX10000(tier.upstreamCost),
        userBasePriceKkX10000: decimalToX10000(tier.userBasePrice),
      };
    });

    const existing = result.get(key);
    if (existing) {
      existing.imageMultiplierX10000 = decimalToX10000(route.multiplier || '1');
      existing.imageTiers = imageTiers;
    } else {
      result.set(key, {
        gatewayRoute,
        modelId,
        inputPriceX10000: null,
        outputPriceX10000: null,
        cachedInputPriceX10000: null,
        textMultiplierX10000: 10000,
        imageMultiplierX10000: decimalToX10000(route.multiplier || '1'),
        imageTiers,
      });
    }
  }

  if (result.size === 0) throw new Error('请至少添加一个生文或生图模型');
  return [...result.values()];
}
