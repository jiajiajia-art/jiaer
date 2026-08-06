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

export type IvgPricingConfigLike = {
    mode?: 'free' | 'buyout' | 'catalog' | 'catalog_buyout' | string;
    buyout?: {
        points?: IvgPaymentOptionLike;
        diamonds?: IvgPaymentOptionLike;
    } | null;
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
