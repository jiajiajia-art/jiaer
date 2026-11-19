/**
 * 功能注释：运行配置「请求设置」多网关书签——把预置网关 + 当前自定义地址收成可切换 Tab，
 * 并生成「当前使用哪家」提示文案；纯函数便于单测，不依赖 React。
 */

export type GatewayPresetLike = {
  id: string;
  label: string;
  baseUrl: string;
};

export type GatewayTabItem = {
  id: string;
  label: string;
  baseUrl: string;
  isCustom: boolean;
};

export type GatewayKeyStateLike = {
  keySet?: boolean;
  keyHint?: string;
};

const CUSTOM_TAB_PREFIX = 'custom:';

/**
 * 功能注释：自定义书签 id——有 URL 时按规范化地址幂等；空草稿用调用方传入的 seed，避免 Date.now 抖动。
 */
export function makeCustomGatewayTabId(
  baseUrl: string,
  normalizeBaseUrl: (value: unknown) => string,
  seed = '',
): string {
  const normalized = normalizeBaseUrl(baseUrl) || String(baseUrl || '').trim();
  if (normalized) return `${CUSTOM_TAB_PREFIX}${normalized}`;
  const stable = String(seed || '').trim() || `draft-${Date.now()}`;
  return `${CUSTOM_TAB_PREFIX}${stable}`;
}

export function isCustomGatewayTabId(tabId: string): boolean {
  return String(tabId || '').startsWith(CUSTOM_TAB_PREFIX);
}

/** 功能注释：从 API 地址提取短标签（host），自定义书签展示用。 */
export function labelForCustomGateway(baseUrl: string, fallback = '自定义网关'): string {
  const raw = String(baseUrl || '').trim();
  if (!raw) return fallback;
  try {
    const host = new URL(raw).host;
    return host || fallback;
  } catch {
    return fallback;
  }
}

/**
 * 功能注释：组装书签列表——先放预置，再把「当前生效但不在预置里」的地址追加为自定义 Tab；
 * extraCustoms 保留运营本轮「+ 新增」但尚未保存的草稿书签。
 */
export function buildGatewayTabs(input: {
  presets: readonly GatewayPresetLike[];
  activeBaseUrl: string;
  extraCustoms?: readonly GatewayTabItem[];
  normalizeBaseUrl: (value: unknown) => string;
  customFallbackLabel?: string;
}): GatewayTabItem[] {
  const normalize = input.normalizeBaseUrl;
  const activeNormalized = normalize(input.activeBaseUrl);
  const tabs: GatewayTabItem[] = input.presets.map((preset) => ({
    id: String(preset.id),
    label: String(preset.label || preset.id),
    baseUrl: String(preset.baseUrl || ''),
    isCustom: false,
  }));

  const presetUrls = new Set(
    tabs.map((tab) => normalize(tab.baseUrl)).filter(Boolean),
  );

  if (activeNormalized && !presetUrls.has(activeNormalized)) {
    tabs.push({
      id: makeCustomGatewayTabId(activeNormalized, normalize),
      label: labelForCustomGateway(activeNormalized, input.customFallbackLabel),
      baseUrl: activeNormalized,
      isCustom: true,
    });
  }

  for (const extra of input.extraCustoms || []) {
    if (!extra?.id) continue;
    if (tabs.some((tab) => tab.id === extra.id)) continue;
    const normalized = normalize(extra.baseUrl);
    if (normalized && presetUrls.has(normalized)) continue;
    if (normalized && tabs.some((tab) => normalize(tab.baseUrl) === normalized)) continue;
    tabs.push({
      id: String(extra.id),
      label: String(extra.label || labelForCustomGateway(extra.baseUrl, input.customFallbackLabel)),
      baseUrl: String(extra.baseUrl || ''),
      isCustom: true,
    });
  }

  return tabs;
}

/** 功能注释：按当前生效 / 编辑中的 baseUrl 选中书签；优先精确匹配预置，否则自定义。 */
export function resolveGatewayTabId(
  baseUrl: string,
  tabs: readonly GatewayTabItem[],
  normalizeBaseUrl: (value: unknown) => string,
): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized) {
    const hit = tabs.find((tab) => normalizeBaseUrl(tab.baseUrl) === normalized);
    if (hit) return hit.id;
  }
  const emptyCustom = tabs.find((tab) => tab.isCustom && !String(tab.baseUrl || '').trim());
  if (emptyCustom && !String(baseUrl || '').trim()) return emptyCustom.id;
  return tabs[0]?.id || '';
}

/**
 * 功能注释：新增按钮旁的「当前使用」文案——网关厂家 + 可选已启用模型名。
 */
export function formatActiveGatewayUsageHint(input: {
  gatewayLabel: string;
  modelName?: string;
}): { gatewayLabel: string; modelName: string; textParts: { gateway: string; model: string } } {
  const gatewayLabel = String(input.gatewayLabel || '').trim() || '未配置';
  const modelName = String(input.modelName || '').trim();
  return {
    gatewayLabel,
    modelName,
    textParts: {
      gateway: gatewayLabel,
      model: modelName,
    },
  };
}

/** 功能注释：从书签 / 预置反查当前生效网关的展示名。 */
export function resolveGatewayLabelForBaseUrl(
  baseUrl: string,
  tabs: readonly GatewayTabItem[],
  normalizeBaseUrl: (value: unknown) => string,
  fallback = '未配置',
): string {
  const tabId = resolveGatewayTabId(baseUrl, tabs, normalizeBaseUrl);
  const tab = tabs.find((item) => item.id === tabId);
  if (tab?.label) return tab.label;
  const labeled = labelForCustomGateway(baseUrl, '');
  return labeled || fallback;
}

export function draftFromKeyState(
  baseUrl: string,
  keyState?: GatewayKeyStateLike | null,
): {
  baseUrl: string;
  apiKey: string;
  apiKeySet: boolean;
  apiKeyHint: string;
  clearApiKey: boolean;
} {
  return {
    baseUrl: String(baseUrl || ''),
    apiKey: '',
    apiKeySet: Boolean(keyState?.keySet),
    apiKeyHint: String(keyState?.keyHint || ''),
    clearApiKey: false,
  };
}
