import type { ComponentPropsWithoutRef } from 'react';

export type CurrencyType = 'points' | 'diamonds';

export const CURRENCY_ICON_SOURCES: Record<CurrencyType, string> = {
    points: `${import.meta.env.BASE_URL}data/assets/currency/dream-bean.png`,
    diamonds: `${import.meta.env.BASE_URL}data/assets/currency/kk-coin.png`,
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
