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
  placeholder,
  errorPlaceholder,
  onLoad,
  onError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src || src === 'null' || src === 'undefined' || src.trim() === '') {
      setIsLoading(false);
      setHasError(false);
      setCurrentSrc(null);
      return;
    }

    let cancelled = false;

    const loadImage = async () => {
      setIsLoading(true);
      setHasError(false);
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
          setHasError(true);
          setIsLoading(false);
          onError?.(new Error('Failed to load image'));
        }
      } catch (error) {
        if (!cancelled) {
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
      <div className={`${styles.container} ${className}`} style={style}>
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
            display: (!isLoading && !hasError) ? 'block' : 'none',
            visibility: (!isLoading && !hasError) ? 'visible' : 'hidden',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            ...style,
          }}
        />
        {hasError && currentSrc && (
          <img
            ref={imgRef}
            src={currentSrc}
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
              setHasError(false);
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

