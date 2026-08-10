export type IvgPaymentCurrency = 'points' | 'diamonds';

export type IvgPaymentOptionLike = {
    enabled?: boolean;
    price?: number | null;
};

export type IvgBuyoutPaymentOption = {
    currency: IvgPaymentCurrency;
    amount: number;
    label: string;
};

export type IvgPaidDirectoryLike = {
    directoryId: string;
    targetType?: string;
    scriptId?: string | null;
    nodeId?: string | null;
    scriptIds?: string[];
};

export type IvgPricingConfigLike<TDirectory extends IvgPaidDirectoryLike = IvgPaidDirectoryLike> = {
    mode?: 'free' | 'buyout' | 'catalog' | 'catalog_buyout' | string;
    buyout?: {
        points?: IvgPaymentOptionLike;
        diamonds?: IvgPaymentOptionLike;
    } | null;
    directories?: TDirectory[];
};

export type IvgPlayerTestAccess<TDirectory extends IvgPaidDirectoryLike = IvgPaidDirectoryLike> = {
    hasBuyout: boolean;
    buyoutLocked: boolean;
    unlockedDirectoryIds: string[];
    lockedDirectoryIds: string[];
    lockedDirectories: TDirectory[];
    paidDirectories: TDirectory[];
};

export type IvgPlayerTestAccessOptions = {
    hasBuyout?: boolean;
    unlockedDirectoryIds?: string[];
};

export type IvgAccessLike = {
    hasBuyout?: boolean;
    buyoutLocked?: boolean;
    lockedDirectories?: unknown[];
    lockedDirectoryIds?: unknown[];
    paidDirectories?: unknown[];
};

export type IvgCurrentUserLike = {
    id?: string | number | null;
    userId?: string | number | null;
} | null | undefined;

export const getInteractiveVideoCurrentUserOwnerId = (user: IvgCurrentUserLike) => {
    const rawId = user?.userId ?? user?.id;
    const normalized = String(rawId ?? '').trim();
    return normalized || '';
};

export const isInteractiveVideoOwnerUser = (
    creatorUserId: string | number | null | undefined,
    user: IvgCurrentUserLike,
) => {
    const currentOwnerId = getInteractiveVideoCurrentUserOwnerId(user);
    const normalizedCreatorId = String(creatorUserId ?? '').trim();
    return Boolean(currentOwnerId && normalizedCreatorId && currentOwnerId === normalizedCreatorId);
};

const parseInteractiveVideoPaidTargetId = (targetId?: string | null) => {
    const normalized = String(targetId || '').trim();
    if (normalized.startsWith('script:')) {
        const scriptId = normalized.slice('script:'.length);
        return scriptId ? { targetType: 'script', scriptId, nodeId: '' } : null;
    }
    if (normalized.startsWith('node:')) {
        const rest = normalized.slice('node:'.length);
        const [scriptId, ...nodeParts] = rest.split(':');
        const nodeId = nodeParts.join(':');
        return scriptId && nodeId ? { targetType: 'node', scriptId, nodeId } : null;
    }
    return null;
};

export const getInteractiveVideoPaidTargetType = (item?: IvgPaidDirectoryLike | null) =>
    item?.targetType || parseInteractiveVideoPaidTargetId(item?.directoryId)?.targetType || 'script';

export const getInteractiveVideoPaidTargetScriptId = (item?: IvgPaidDirectoryLike | null) =>
    String(
        item?.scriptId
        || parseInteractiveVideoPaidTargetId(item?.directoryId)?.scriptId
        || item?.scriptIds?.[0]
        || '',
    ).trim();

export const getInteractiveVideoPaidTargetNodeId = (item?: IvgPaidDirectoryLike | null) =>
    String(item?.nodeId || parseInteractiveVideoPaidTargetId(item?.directoryId)?.nodeId || '').trim();

export const getEffectiveInteractiveVideoPlayerTestPaidDirectories = <
    TDirectory extends IvgPaidDirectoryLike,
>(config?: IvgPricingConfigLike<TDirectory> | null) => {
    const mode = String(config?.mode || 'free');
    if (mode !== 'catalog' && mode !== 'catalog_buyout') return [];
    const directories = config?.directories || [];
    const nodeLevelPaidScriptIds = new Set(
        directories
            .filter((directory) => getInteractiveVideoPaidTargetType(directory) === 'node')
            .map((directory) => getInteractiveVideoPaidTargetScriptId(directory))
            .filter(Boolean),
    );
    return directories.filter((directory) => !(
        getInteractiveVideoPaidTargetType(directory) === 'script'
        && nodeLevelPaidScriptIds.has(getInteractiveVideoPaidTargetScriptId(directory))
    ));
};

const getUnlockedInteractiveVideoPaidScriptIds = (directoryIds: string[]) => new Set(
    directoryIds
        .map((directoryId) => parseInteractiveVideoPaidTargetId(directoryId))
        .filter((target) => target?.targetType === 'script')
        .map((target) => target?.scriptId || '')
        .filter(Boolean),
);

const isInteractiveVideoPaidDirectoryUnlocked = (
    directory: IvgPaidDirectoryLike,
    unlockedDirectoryIds: string[],
) => {
    const unlockedSet = new Set(unlockedDirectoryIds);
    if (unlockedSet.has(directory.directoryId)) return true;
    if (getInteractiveVideoPaidTargetType(directory) !== 'node') return false;
    const scriptId = getInteractiveVideoPaidTargetScriptId(directory);
    return Boolean(scriptId && getUnlockedInteractiveVideoPaidScriptIds(unlockedDirectoryIds).has(scriptId));
};

export const buildInteractiveVideoPlayerTestAccess = <
    TDirectory extends IvgPaidDirectoryLike,
>(
    config?: IvgPricingConfigLike<TDirectory> | null,
    options: IvgPlayerTestAccessOptions = {},
): IvgPlayerTestAccess<TDirectory> | null => {
    if (!config) return null;
    const mode = String(config.mode || 'free');
    const hasBuyout = Boolean(options.hasBuyout);
    const unlockedSet = new Set((options.unlockedDirectoryIds || []).map((id) => String(id || '').trim()).filter(Boolean));
    const paidDirectories = getEffectiveInteractiveVideoPlayerTestPaidDirectories(config);
    const buyoutLocked = mode === 'buyout' && !hasBuyout;
    const unlockedDirectoryIds = Array.from(unlockedSet);
    const lockedDirectories = hasBuyout || buyoutLocked
        ? []
        : paidDirectories.filter((directory) => !isInteractiveVideoPaidDirectoryUnlocked(directory, unlockedDirectoryIds));

    return {
        hasBuyout,
        buyoutLocked,
        unlockedDirectoryIds,
        lockedDirectoryIds: lockedDirectories.map((directory) => directory.directoryId),
        lockedDirectories,
        paidDirectories,
    };
};

export const findInteractiveVideoLockedDirectoryByScriptId = <
    TDirectory extends IvgPaidDirectoryLike,
>(lockedDirectories: TDirectory[] = [], scriptId?: string | null) => {
    const normalizedScriptId = String(scriptId || '').trim();
    if (!normalizedScriptId) return null;
    return lockedDirectories.find((directory) => {
        if (getInteractiveVideoPaidTargetType(directory) === 'node') return false;
        const scriptIds = directory.scriptIds?.length
            ? directory.scriptIds
            : [getInteractiveVideoPaidTargetScriptId(directory)];
        return scriptIds.includes(normalizedScriptId);
    }) || null;
};

export const findInteractiveVideoLockedDirectoryByNodeId = <
    TDirectory extends IvgPaidDirectoryLike,
>(lockedDirectories: TDirectory[] = [], scriptId?: string | null, nodeId?: string | null) => {
    const normalizedScriptId = String(scriptId || '').trim();
    const normalizedNodeId = String(nodeId || '').trim();
    if (!normalizedScriptId || !normalizedNodeId) return null;
    return lockedDirectories.find((directory) =>
        getInteractiveVideoPaidTargetType(directory) === 'node'
        && getInteractiveVideoPaidTargetScriptId(directory) === normalizedScriptId
        && getInteractiveVideoPaidTargetNodeId(directory) === normalizedNodeId,
    ) || null;
};

export const findInteractiveVideoLockedDirectoryForRuntimeNode = <
    TDirectory extends IvgPaidDirectoryLike,
>(lockedDirectories: TDirectory[] = [], scriptId?: string | null, nodeId?: string | null) =>
    findInteractiveVideoLockedDirectoryByNodeId(lockedDirectories, scriptId, nodeId)
    || findInteractiveVideoLockedDirectoryByScriptId(lockedDirectories, scriptId);

export const formatIvgCurrencyName = (currency: IvgPaymentCurrency) =>
    currency === 'points' ? '积分' : '钻石';

export const formatIvgUnlockCost = (amount: number, currency: IvgPaymentCurrency) => {
    const normalizedAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return `${normalizedAmount}${formatIvgCurrencyName(currency)}`;
};

const getEnabledPaymentLabel = (option: IvgPaymentOptionLike | undefined, currency: IvgPaymentCurrency) => {
    if (!option?.enabled || option.price == null) return '';
    return formatIvgUnlockCost(Number(option.price || 0), currency);
};

const getEnabledBuyoutPaymentOption = (
    option: IvgPaymentOptionLike | undefined,
    currency: IvgPaymentCurrency,
): IvgBuyoutPaymentOption | null => {
    if (!option?.enabled || option.price == null) return null;
    const amount = Number(option.price || 0);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return { currency, amount, label: formatIvgUnlockCost(amount, currency) };
};

export const getInteractiveVideoBuyoutPaymentOptions = (config?: IvgPricingConfigLike | null) => [
    getEnabledBuyoutPaymentOption(config?.buyout?.points, 'points'),
    getEnabledBuyoutPaymentOption(config?.buyout?.diamonds, 'diamonds'),
].filter((option): option is IvgBuyoutPaymentOption => Boolean(option));

export const getInteractiveVideoBuyoutPriceText = (config?: IvgPricingConfigLike | null) => {
    const labels = [
        getEnabledPaymentLabel(config?.buyout?.points, 'points'),
        getEnabledPaymentLabel(config?.buyout?.diamonds, 'diamonds'),
    ].filter(Boolean);

    return labels.join('/');
};

export const getInteractiveVideoStartPriceLabel = (config?: IvgPricingConfigLike | null) => {
    if (!config) return '';

    const buyoutPriceText = getInteractiveVideoBuyoutPriceText(config);
    if (config.mode === 'buyout') {
        return buyoutPriceText ? `${buyoutPriceText}买断游玩` : '免费开放';
    }

    if (config.mode === 'catalog_buyout') {
        return buyoutPriceText ? `含付费内容，可${buyoutPriceText}买断游玩` : '含付费内容';
    }

    if (config.mode === 'catalog') return '含付费内容';
    return '免费开放';
};

const hasLockedPaidArea = (access?: IvgAccessLike | null) =>
    Boolean((access?.lockedDirectories?.length || 0) > 0 || (access?.lockedDirectoryIds?.length || 0) > 0);

const hasPurchasedAllCatalogAreas = (access?: IvgAccessLike | null) =>
    Boolean((access?.paidDirectories?.length || 0) > 0 && !hasLockedPaidArea(access));

export const getInteractiveVideoStartButtonLabel = ({
    config,
    access,
    isOwner,
    fallbackLabel,
}: {
    config?: IvgPricingConfigLike | null;
    access?: IvgAccessLike | null;
    isOwner?: boolean;
    fallbackLabel: string;
}) => {
    if (isOwner) return '创作者开始游玩';
    if (!config) return fallbackLabel;

    if (access?.hasBuyout || hasPurchasedAllCatalogAreas(access)) {
        return '已购买开始游玩';
    }

    const mode = String(config.mode || 'free');
    if (mode === 'buyout') {
        const buyoutPriceText = getInteractiveVideoBuyoutPriceText(config);
        return buyoutPriceText ? `${buyoutPriceText}买断游玩` : fallbackLabel;
    }

    if ((mode === 'catalog' || mode === 'catalog_buyout') && hasLockedPaidArea(access)) {
        return '开始试玩';
    }

    return fallbackLabel;
};

export const shouldConfirmInteractiveVideoBuyoutBeforeStart = ({
    config,
    access,
    isOwner,
}: {
    config?: IvgPricingConfigLike | null;
    access?: IvgAccessLike | null;
    isOwner?: boolean;
}) => {
    if (isOwner) return false;
    if (String(config?.mode || 'free') !== 'buyout') return false;
    if (access?.hasBuyout) return false;
    return getInteractiveVideoBuyoutPaymentOptions(config).length > 0;
};
