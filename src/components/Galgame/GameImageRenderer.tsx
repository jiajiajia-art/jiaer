/**
 * 游戏级图片渲染组件
 * 使用 Canvas 渲染已解码的 ImageBitmap，实现零延迟切换
 */

import { useEffect, useRef, useState } from 'react';
import { gameResourceManager } from '../../utils/gameResourceManager';
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
  const [useFallback, setUseFallback] = useState(false); // 标记是否使用 <img> 标签兜底
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src || src === 'null' || src === 'undefined' || src.trim() === '') {
      setIsLoading(false);
      setHasError(false);
      setUseFallback(false);
      setCurrentSrc(null);
      return;
    }

    let cancelled = false;

    const loadImage = async () => {
      setIsLoading(true);
      setHasError(false);
      setUseFallback(false); // 重置兜底标记
      setCurrentSrc(src);

      try {
        let bitmap: ImageBitmap | null = null;
        
        const cachedBitmap = gameResourceManager.getBitmap(src);
        if (cachedBitmap) {
          bitmap = gameResourceManager.useBitmap(src);
        } else {
          bitmap = await gameResourceManager.loadImage(src, { decode: true });
        }

        if (cancelled) {
          return;
        }

        if (bitmap) {
          try {
            const testWidth = bitmap.width;
            const testHeight = bitmap.height;
            if (testWidth > 0 && testHeight > 0) {
              requestAnimationFrame(() => {
                if (!cancelled && canvasRef.current) {
                  const renderSuccess = renderBitmap(bitmap);
                  if (renderSuccess) {
                    setIsLoading(false);
                    setHasError(false);
                    onLoad?.();
                  } else {
                    setHasError(true);
                    setIsLoading(false);
                    if (imgRef.current && src) {
                      imgRef.current.src = src;
                    }
                  }
                } else if (!cancelled) {
                  setHasError(true);
                  setIsLoading(false);
                  if (imgRef.current && src) {
                    imgRef.current.src = src;
                  }
                }
              });
            } else {
              setHasError(true);
              setIsLoading(false);
              onError?.(new Error('Invalid bitmap dimensions'));
            }
          } catch (error) {
            const newBitmap = await gameResourceManager.loadImage(src, { decode: true });
            if (newBitmap && !cancelled) {
              requestAnimationFrame(() => {
                if (!cancelled && canvasRef.current) {
                  const renderSuccess = renderBitmap(newBitmap);
                  if (renderSuccess) {
                    setIsLoading(false);
                    setHasError(false);
                    onLoad?.();
                  } else {
                    setHasError(true);
                    setIsLoading(false);
                  }
                }
              });
            } else {
              setHasError(true);
              setIsLoading(false);
              onError?.(new Error('Failed to reload image'));
            }
          }
        } else {
          // bitmap 为 null，说明图片加载失败或 CORS 不允许 Canvas 渲染
          // 回退到 <img> 标签显示（至少能显示图片，虽然不能用于 Canvas）
          // 注意：currentSrc 在开始时就已经设置了，这里只需要设置错误状态和兜底标记
          setUseFallback(true); // 标记使用 <img> 标签兜底
          setHasError(true);
          setIsLoading(false);
          // 不调用 onError，因为图片实际上可能已经加载成功了（只是不能用于 Canvas）
          // onError?.(new Error('Failed to load image'));
        }
      } catch (error) {
        if (!cancelled) {
          // 出错时设置错误状态，让 <img> 标签能显示
          // 注意：currentSrc 在开始时就已经设置了
          setUseFallback(true); // 标记使用 <img> 标签兜底
          setHasError(true);
          setIsLoading(false);
          const err = error instanceof Error ? error : new Error('Unknown error');
          onError?.(err);
        }
      }
    };

    const renderBitmap = (bitmap: ImageBitmap): boolean => {
      if (useCanvas && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', {
          alpha: true,
          desynchronized: true,
        });

        if (ctx) {
          try {
            const width = bitmap.width;
            const height = bitmap.height;
            if (width === 0 || height === 0) {
              return false;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0);
            canvas.style.display = 'block';
            canvas.style.visibility = 'visible';
            
            return true;
          } catch (error) {
            console.error('[GameImageRenderer] Failed to render bitmap:', error);
            return false;
          }
        }
        return false;
      } else if (imgRef.current) {
        const img = imgRef.current;
        img.src = src || '';
        return true;
      }
      return false;
    };

    loadImage();

    return () => {
      cancelled = true;
      if (src) {
        gameResourceManager.releaseBitmap(src);
      }
    };
  }, [src, useCanvas, onLoad, onError, style]);

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
            display: (!isLoading && !hasError && !useFallback) ? 'block' : 'none',
            visibility: (!isLoading && !hasError && !useFallback) ? 'visible' : 'hidden',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            ...style,
          }}
        />
        {useFallback && (currentSrc || src) && (
          <img
            ref={imgRef}
            src={currentSrc || src || undefined}
            alt=""
            className={`${styles.fallbackImage} ${className}`}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              ...style,
            }}
            onLoad={() => {
              setIsLoading(false);
              // 使用兜底时，不要清除 useFallback，保持 <img> 标签显示
              // setHasError(false); // 不设置，保持 useFallback 为 true
              onLoad?.();
            }}
            onError={() => {
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
        setHasError(true);
        setIsLoading(false);
        onError?.(new Error('Image load failed'));
      }}
    />
  );
};

export default GameImageRenderer;

