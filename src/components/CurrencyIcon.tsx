import type { ComponentPropsWithoutRef } from 'react';

export type CurrencyType = 'points' | 'diamonds';

/** 功能注释：与每日签到/资产页共用同一套货币图，禁止各处各写一条路径 */
const ASSET_BASE = `${import.meta.env.BASE_URL}data/assets`;
const ASSET_V2_HOME = `${import.meta.env.BASE_URL}data/assetsv2/home`;

export const CURRENCY_ICON_SOURCES: Record<CurrencyType, string> = {
    // 织梦豆：专用豆图；KK币：复用签到同款金币图
    points: `${ASSET_BASE}/currency/dream-bean.png`,
    diamonds: `${ASSET_V2_HOME}/icon_coin.webp`,
};

type CurrencyIconProps = Omit<ComponentPropsWithoutRef<'img'>, 'src'> & {
    currency: CurrencyType;
};

export default function CurrencyIcon({
    currency,
    alt = '',
    ...props
}: CurrencyIconProps) {
    return <img {...props} src={CURRENCY_ICON_SOURCES[currency]} alt={alt} />;
}
