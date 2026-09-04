/**
 * 功能注释：封面角标。火焰/心形均用下载切图 CSS mask，保证造型一致、尺寸可控、边缘不糊。
 */
import type { CSSProperties } from 'react';

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

/** 激励金额：细线币标 */
export function CardCoinIcon({ className, style }: IconProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        fill="currentColor"
        d="M8.9 4.4H7.2v1.1H5.8v1.1h1.4v.7H5.8v1.1h1.4V11h1.7V8.4h1.3V7.3H8.9v-.7h1.3V5.5H8.9V4.4z"
      />
    </svg>
  );
}

/** 功能注释：封面热度——下载三尖火焰 mask */
export function CardFlameIcon({ className, style }: IconProps) {
  return <MaskIcon className={className} style={style} maskUrl={GAME_CARD_FLAME_MASK_URL} />;
}

/** 功能注释：封面点赞——下载心形 mask（与火焰同套尺寸体系，避免矢量心偏大） */
export function CardHeartIcon({ className, style }: IconProps) {
  return <MaskIcon className={className} style={style} maskUrl={GAME_CARD_HEART_MASK_URL} />;
}
