/**
 * 功能注释：封面角标。火焰/心形均用下载切图 CSS mask，保证造型一致、尺寸可控、边缘不糊。
 */
import type { CSSProperties } from 'react';
import CurrencyIcon from './CurrencyIcon';

type IconProps = {
  className?: string;
  style?: CSSProperties;
};

const HOME_ICON_BASE = `${import.meta.env.BASE_URL}data/assetsv2/home`;
/** 下载三尖火焰（切图40） */
export const GAME_CARD_FLAME_MASK_URL = `${HOME_ICON_BASE}/icon_flame_pink.webp`;
/** 下载白心（路径-6） */
export const GAME_CARD_HEART_MASK_URL = `${HOME_ICON_BASE}/icon_heart.webp`;

function MaskIcon({
  className,
  style,
  maskUrl,
}: IconProps & { maskUrl: string }) {
  return (
    <span
      className={className}
      style={{
        display: 'block',
        flexShrink: 0,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${maskUrl})`,
        maskImage: `url(${maskUrl})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/** 激励金额：使用统一织梦豆图标。 */
export function CardCoinIcon({ className, style }: IconProps) {
  return <CurrencyIcon currency="points" className={className} style={style} aria-hidden="true" />;
}

/** 功能注释：封面热度——下载三尖火焰 mask */
export function CardFlameIcon({ className, style }: IconProps) {
  return <MaskIcon className={className} style={style} maskUrl={GAME_CARD_FLAME_MASK_URL} />;
}

/** 功能注释：封面点赞——下载心形 mask（与火焰同套尺寸体系，避免矢量心偏大） */
export function CardHeartIcon({ className, style }: IconProps) {
  return <MaskIcon className={className} style={style} maskUrl={GAME_CARD_HEART_MASK_URL} />;
}

/** 功能注释：封面收藏——内联 SVG 书签（实心，currentColor 着色） */
export function CardBookmarkIcon({ className, style }: IconProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 14 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 0h9A2.5 2.5 0 0 1 14 2.5v12.3a1 1 0 0 1-1.6.8L7 11.6l-5.4 4a1 1 0 0 1-1.6-.8V2.5A2.5 2.5 0 0 1 2.5 0Z" />
    </svg>
  );
}
