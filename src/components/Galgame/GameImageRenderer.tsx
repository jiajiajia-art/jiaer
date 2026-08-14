/**
 * 游戏级图片渲染组件
 * 使用 Canvas 渲染已解码的 ImageBitmap，实现零延迟切换
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { gameResourceManager } from '../../utils/gameResourceManager';
import { fallbackCharacterPortraitPng } from '../../utils/characterPortraitUrl';
import styles from './GameImageRenderer.module.css';

export interface GameImageRendererProps {
  src: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  useCanvas?: boolean;
  disableMobileGuard?: boolean;
  placeholder?: React.ReactNode;
  errorPlaceholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}
export const GameImageRenderer: React.FC<GameImageRendererProps> = ({
  src,
  className = '',
  style,
  useCanvas = true,
  disableMobileGuard = false,
  placeholder,
  errorPlaceholder,
  onLoad,
  onError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const triedPngFallbackRef = useRef(false);

  useEffect(() => {
    triedPngFallbackRef.current = false;
  }, [src]);

  // 中等屏宽默认改走 img；立绘（disableMobileGuard）必须继续用 Canvas，否则 imgRef 未挂载会渲染失败变透明
  const isMediumScreen = typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth <= 1080;
  const preferImgFallback = !useCanvas || (isMediumScreen && !disableMobileGuard);

  const renderBitmap = useCallback((bitmap: ImageBitmap, targetSrc?: string): boolean => {
    if (preferImgFallback) {
      if (imgRef.current) {
        imgRef.current.src = targetSrc || src || '';
        return true;
      }
      // Canvas 模式下尚未挂载 img：交给调用方切 useFallback，禁止返回 false 后把 canvas 透明度打成 0
      return false;
    }

    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', {
        alpha: true,
        desynchronized: true,
      });

      if (ctx) {
        try {
          const imgWidth = bitmap.width;
          const imgHeight = bitmap.height;
          if (imgWidth === 0 || imgHeight === 0) {
            return false;
          }

          // 获取容器尺寸，如果为 0 则使用图片原始尺寸
          const container = canvas.parentElement;
          const rawContainerWidth = container?.clientWidth || canvas.clientWidth;
          const rawContainerHeight = container?.clientHeight || canvas.clientHeight;

          // 最小尺寸保护，防止 Canvas 变成 0x0 的黑色元素
          const MIN_SIZE = 100;
          const containerWidth = Math.max(rawContainerWidth || imgWidth, MIN_SIZE);
          const containerHeight = Math.max(rawContainerHeight || imgHeight, MIN_SIZE);

          // 设置 Canvas 分辨率为容器尺寸（与 CSS display 尺寸一致）
          canvas.width = containerWidth;
          canvas.height = containerHeight;

          // 实现 object-fit: contain + object-position: bottom 逻辑
          // 图片底部对齐，同时保持比例
          const imgAspect = imgWidth / imgHeight;
          const containerAspect = containerWidth / containerHeight;

          let drawWidth: number;
          let drawHeight: number;

          if (imgAspect > containerAspect) {
            // 图片更宽，以宽度为准
            drawWidth = containerWidth;
            drawHeight = containerWidth / imgAspect;
          } else {
            // 图片更高，以高度为准
            drawHeight = containerHeight;
            drawWidth = containerHeight * imgAspect;
          }

          // 底部对齐：dy 为容器高度减去图片高度
          const dx = (containerWidth - drawWidth) / 2;
          const dy = containerHeight - drawHeight;

          // 填充透明背景（防止 Canvas 默认黑色背景）
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(0, 0, 0, 0)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // 绘制缩放后的图片
          ctx.drawImage(bitmap, dx, dy, drawWidth, drawHeight);

          return true;
        } catch (error) {
          console.error('[GameImageRenderer] Failed to render bitmap:', error);
          return false;
        }
      }
      return false;
    }
    return false;
  }, [preferImgFallback, src]);

  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container || !currentSrc) return;

    const bitmap = gameResourceManager.getBitmap(currentSrc);
    if (bitmap) {
      renderBitmap(bitmap, currentSrc);
    }

    const resizeObserver = new ResizeObserver(() => {
      const currentBitmap = gameResourceManager.getBitmap(currentSrc);
      if (currentBitmap) {
        renderBitmap(currentBitmap, currentSrc);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [currentSrc, renderBitmap]);

  useEffect(() => {
    if (!src || src === 'null' || src === 'undefined' || src.trim() === '') {
      setIsLoading(false);
      setHasError(false);
      setUseFallback(false);
      setCurrentSrc(null);
      return;
    }

        let cancelled = false;

    const loadAndRenderImage = async () => {
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await gameResourceManager.loadImage(src, { decode: true });
      } catch {
        bitmap = await gameResourceManager.loadImage(src, { decode: true });
      }

      if (cancelled) return;

      // fetch 成功但 decode 失败：必须切 <img>，禁止留下透明 canvas
      if (!bitmap) {
        setUseFallback(true);
        setHasError(false);
        setIsLoading(false);
        onError?.(new Error('Image bitmap decode failed'));
        return;
      }

      const isValid = bitmap.width > 0 && bitmap.height > 0;
      if (!isValid) {
        setUseFallback(true);
        setHasError(false);
        setIsLoading(false);
        onError?.(new Error('Invalid bitmap dimensions'));
        return;
      }

      requestAnimationFrame(() => {
        if (cancelled) return;
        const renderSuccess = renderBitmap(bitmap!);
        if (renderSuccess) {
          setIsLoading(false);
          setHasError(false);
          setUseFallback(false);
          onLoad?.();
          return;
        }
        // canvas 未就绪 / 中等屏无 imgRef：改原生 img，避免 hasError 把画面隐掉
        setUseFallback(true);
        setHasError(false);
        setIsLoading(false);
        onLoad?.();
      });
    };

    const loadImage = async () => {
      // 先检查缓存，如果命中则不需要显示加载状态
      const cachedBitmap = gameResourceManager.getBitmap(src);
      if (cachedBitmap) {
        setCurrentSrc(src);

        if (cancelled) return;

        requestAnimationFrame(() => {
          if (cancelled) return;
          const renderSuccess = renderBitmap(cachedBitmap);
          if (renderSuccess) {
            setIsLoading(false);
            setHasError(false);
            setUseFallback(false);
            onLoad?.();
            return;
          }
          setUseFallback(true);
          setHasError(false);
          setIsLoading(false);
          onLoad?.();
        });
        return;
      }

      // 缓存未命中，需要加载
      setIsLoading(true);
      setHasError(false);
      setUseFallback(preferImgFallback);
      setCurrentSrc(src);

      try {
        await loadAndRenderImage();
      } catch (error) {
        if (!cancelled) {
          const png = fallbackCharacterPortraitPng(src);
          if (png && !triedPngFallbackRef.current) {
            triedPngFallbackRef.current = true;
            setHasError(false);
            setIsLoading(true);
            setUseFallback(true);
            setCurrentSrc(png);
            try {
              const bitmap = await gameResourceManager.loadImage(png, { decode: true });
              if (cancelled) return;
              if (bitmap && bitmap.width > 0) {
                requestAnimationFrame(() => {
                  if (cancelled) return;
                  if (renderBitmap(bitmap, png)) {
                    setIsLoading(false);
                    setHasError(false);
                    setUseFallback(false);
                    onLoad?.();
                    return;
                  }
                  setUseFallback(true);
                  setIsLoading(false);
                  onLoad?.();
                });
                return;
              }
            } catch {
              /* fall through to error */
            }
          }
          setUseFallback(true);
          setHasError(false);
          setIsLoading(false);
          const err = error instanceof Error ? error : new Error('Unknown error');
          onError?.(err);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
      if (src) {
        gameResourceManager.releaseBitmap(src);
      }
    };
  }, [src, useCanvas, disableMobileGuard, preferImgFallback, onLoad, onError, style, renderBitmap]);

  // 立绘：canvas 失败时也始终挂载 fallback img（opacity 切换），避免中等屏/解码失败完全空白
  const showFallbackImg = useFallback || preferImgFallback || hasError;

  if (useCanvas) {
    return (
      <div className={`${styles.container} ${disableMobileGuard ? styles.disableMobileGuard : ''} ${className}`} style={style}>
        {isLoading && placeholder && (
          <div className={styles.placeholder}>{placeholder}</div>
        )}
        {hasError && errorPlaceholder && (
          <div className={styles.errorPlaceholder}>{errorPlaceholder}</div>
        )}
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{
            opacity: showFallbackImg || (isLoading && placeholder) ? 0 : 1,
            transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: 'transparent',
            ...style,
          }}
        />
        {showFallbackImg && (currentSrc || src) && (
          <img
            ref={imgRef}
            src={currentSrc || src || undefined}
            alt=""
            className={`${styles.fallbackImage} ${className}`}
            style={{
              ...style,
              objectPosition: style?.objectPosition,
              opacity: isLoading && placeholder ? 0 : 1,
            }}
            onLoad={() => {
              setIsLoading(false);
              onLoad?.();
            }}
            onError={() => {
              const png = fallbackCharacterPortraitPng(currentSrc || src);
              if (png && !triedPngFallbackRef.current) {
                triedPngFallbackRef.current = true;
                setHasError(false);
                setIsLoading(true);
                setCurrentSrc(png);
                return;
              }
              setHasError(true);
              setIsLoading(false);
              onError?.(new Error('Image load failed'));
            }}
          />
        )}
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={currentSrc || undefined}
      className={className}
      style={style}
      alt=""
      onLoad={() => {
        setIsLoading(false);
        onLoad?.();
      }}
      onError={() => {
        const png = fallbackCharacterPortraitPng(currentSrc || src);
        if (png && !triedPngFallbackRef.current) {
          triedPngFallbackRef.current = true;
          setHasError(false);
          setIsLoading(true);
          setCurrentSrc(png);
          return;
        }
        setHasError(true);
        setIsLoading(false);
        onError?.(new Error('Image load failed'));
      }}
    />
  );
};

export default GameImageRenderer;

