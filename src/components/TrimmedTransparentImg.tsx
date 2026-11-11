import React, { useEffect, useMemo, useState } from 'react';
import {
  peekTrimTransparentImageCache,
  trimTransparentImageUrl,
  WAREHOUSE_CARD_AVATAR_BUST_ASPECT,
  WAREHOUSE_CARD_AVATAR_UPPER_RATIO,
  type TrimTransparentOptions,
} from '../utils/trimTransparentImage';

type Props = {
  src: string;
  className?: string;
  alt?: string;
  /**
   * bust：卡面/列表头像，按主体顶向下取胸像（宽×比例，避免只剩发顶）；
   * full：去透明后保留全身（默认；游戏立绘勿用本组件，直接用原图）。
   */
  variant?: 'bust' | 'full';
  options?: TrimTransparentOptions;
};

/**
 * 展示抠图立绘：去透明边；bust 再裁上半身头像。
 * 功能注释：等裁切完成再显示，禁止先闪原图再跳胸像（约 1～2s 抖动）。
 */
const TrimmedTransparentImg: React.FC<Props> = ({
  src,
  className,
  alt = '',
  variant = 'full',
  options,
}) => {
  const trimOpts = useMemo((): TrimTransparentOptions => ({
    ...options,
    upperRatio: options?.upperRatio
      ?? (variant === 'bust' ? WAREHOUSE_CARD_AVATAR_UPPER_RATIO : undefined),
    bustAspect: options?.bustAspect
      ?? (variant === 'bust' ? WAREHOUSE_CARD_AVATAR_BUST_ASPECT : undefined),
  }), [options, variant, options?.alphaThreshold, options?.padding, options?.upperRatio, options?.bustAspect]);

  const cached = useMemo(
    () => (src ? peekTrimTransparentImageCache(src, trimOpts) : null),
    [src, trimOpts],
  );
  const [displaySrc, setDisplaySrc] = useState<string>(cached || '');
  const [ready, setReady] = useState<boolean>(Boolean(cached));

  useEffect(() => {
    let cancelled = false;
    const url = String(src || '').trim();
    if (!url) {
      setDisplaySrc('');
      setReady(false);
      return undefined;
    }

    const hit = peekTrimTransparentImageCache(url, trimOpts);
    if (hit) {
      setDisplaySrc(hit);
      setReady(true);
      return undefined;
    }

    // 功能注释：未命中缓存时先不渲染原图，等裁切完成一次到位
    setDisplaySrc('');
    setReady(false);
    void trimTransparentImageUrl(url, trimOpts)
      .then((next) => {
        if (cancelled) return;
        setDisplaySrc(next || url);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDisplaySrc(url);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src, trimOpts]);

  if (!src) return null;
  if (!ready || !displaySrc) {
    return (
      <span
        className={className}
        aria-hidden
        aria-busy="true"
        style={{ display: 'block', width: '100%', height: '100%', visibility: 'hidden' }}
      />
    );
  }
  return <img src={displaySrc} className={className} alt={alt} />;
};

export default TrimmedTransparentImg;
