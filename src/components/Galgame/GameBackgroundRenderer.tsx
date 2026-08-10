/**
 * 游戏级背景图渲染组件
 * 使用 Canvas 渲染背景，实现零延迟场景切换
 */

import { useEffect, useRef, useState } from 'react';
import { gameResourceManager } from '../../utils/gameResourceManager';
import styles from './GameBackgroundRenderer.module.css';

export interface GameBackgroundRendererProps {
  src: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
  useCanvas?: boolean;
  transitionDuration?: number;
}
export const GameBackgroundRenderer: React.FC<GameBackgroundRendererProps> = ({
  src,
  className = '',
  style,
  useCanvas = true,
  transitionDuration = 300,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  /** Canvas 已解码成功；失败时才走 CSS url 兜底，避免加载中双下 */
  const [cssFallbackSrc, setCssFallbackSrc] = useState<string | null>(null);
  const previousBitmapRef = useRef<ImageBitmap | null>(null);
  const currentBitmapRef = useRef<ImageBitmap | null>(null);

  useEffect(() => {
    if (!src || src === 'null' || src === 'undefined' || src.trim() === '') {
      setCurrentSrc(null);
      setCssFallbackSrc(null);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      return;
    }

    if (currentSrc === src) {
      return;
    }

    let cancelled = false;

    const loadAndRender = async () => {
      setIsTransitioning(true);
      // 加载中绝不挂 CSS url，否则会与 fetch 双请求
      setCssFallbackSrc(null);

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
          if (currentBitmapRef.current && currentBitmapRef.current !== previousBitmapRef.current) {
            previousBitmapRef.current = currentBitmapRef.current;
          }
          currentBitmapRef.current = bitmap;
          setCurrentSrc(src);
          setCssFallbackSrc(null);
          
          requestAnimationFrame(() => {
            if (!cancelled && canvasRef.current) {
              try {
                const testWidth = bitmap.width;
                const testHeight = bitmap.height;
                if (testWidth > 0 && testHeight > 0) {
                  renderBackground(bitmap);
                  
                  if (transitionDuration > 0 && containerRef.current) {
                    containerRef.current.style.opacity = '0';
                    requestAnimationFrame(() => {
                      if (containerRef.current && !cancelled) {
                        containerRef.current.style.transition = `opacity ${transitionDuration}ms ease-in-out`;
                        containerRef.current.style.opacity = '1';
                      }
                    });

                    setTimeout(() => {
                      if (!cancelled) {
                        setIsTransitioning(false);
                      }
                    }, transitionDuration);
                  } else {
                    setIsTransitioning(false);
                  }
                } else {
                  setIsTransitioning(false);
                }
              } catch (error) {
                console.error('[GameBackgroundRenderer] Bitmap check failed:', error);
                setIsTransitioning(false);
              }
            }
          });
        } else {
          // bitmap 为 null：仅此时 CSS url 兜底（单通道，不再与 canvas fetch 并行）
          setCurrentSrc(src);
          setCssFallbackSrc(src);
          setIsTransitioning(false);
        }
      } catch (error) {
        console.error('[GameBackgroundRenderer] Failed to load background:', error);
        setCurrentSrc(src);
        setCssFallbackSrc(src);
        setIsTransitioning(false);
      }
    };

    const renderBackground = (bitmap: ImageBitmap) => {
      if (!canvasRef.current) return;

      try {
        const width = bitmap.width;
        const height = bitmap.height;
        if (width === 0 || height === 0) {
          return;
        }
      } catch (error) {
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', {
        alpha: true,
        desynchronized: true,
      });

      if (!ctx) return;

      const container = containerRef.current || canvas.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width || bitmap.width;
        canvas.height = rect.height || bitmap.height;
      } else {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const scale = Math.max(
        canvas.width / bitmap.width,
        canvas.height / bitmap.height
      );
      const scaledWidth = bitmap.width * scale;
      const scaledHeight = bitmap.height * scale;
      const x = (canvas.width - scaledWidth) / 2;
      const y = (canvas.height - scaledHeight) / 2;

      try {
        ctx.drawImage(bitmap, x, y, scaledWidth, scaledHeight);
      } catch (error) {
        console.error('[GameBackgroundRenderer] Failed to draw image:', error);
      }
    };

    loadAndRender();

    return () => {
      cancelled = true;
      if (currentSrc) {
        gameResourceManager.releaseBitmap(currentSrc);
      }
    };
  }, [src, useCanvas, transitionDuration]);

  useEffect(() => {
    const handleResize = () => {
      if (currentBitmapRef.current && canvasRef.current) {
        const bitmap = currentBitmapRef.current;
        
        try {
          const width = bitmap.width;
          const height = bitmap.height;
          if (width === 0 || height === 0) {
            return;
          }
        } catch (error) {
          if (currentSrc) {
            gameResourceManager.releaseBitmap(currentSrc);
            gameResourceManager.loadImage(currentSrc, { decode: true }).then((newBitmap) => {
              if (newBitmap && canvasRef.current) {
                currentBitmapRef.current = newBitmap;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const container = containerRef.current || canvas.parentElement;
                  if (container) {
                    const rect = container.getBoundingClientRect();
                    canvas.width = rect.width || newBitmap.width;
                    canvas.height = rect.height || newBitmap.height;
                  }
                  const scale = Math.max(
                    canvas.width / newBitmap.width,
                    canvas.height / newBitmap.height
                  );
                  const scaledWidth = newBitmap.width * scale;
                  const scaledHeight = newBitmap.height * scale;
                  const x = (canvas.width - scaledWidth) / 2;
                  const y = (canvas.height - scaledHeight) / 2;
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(newBitmap, x, y, scaledWidth, scaledHeight);
                }
              }
            });
          }
          return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          const container = containerRef.current || canvas.parentElement;
          if (container) {
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width || bitmap.width;
            canvas.height = rect.height || bitmap.height;
          }

          const scale = Math.max(
            canvas.width / bitmap.width,
            canvas.height / bitmap.height
          );
          const scaledWidth = bitmap.width * scale;
          const scaledHeight = bitmap.height * scale;
          const x = (canvas.width - scaledWidth) / 2;
          const y = (canvas.height - scaledHeight) / 2;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          try {
            ctx.drawImage(bitmap, x, y, scaledWidth, scaledHeight);
          } catch (error) {
            if (currentSrc) {
              gameResourceManager.loadImage(currentSrc, { decode: true }).then((newBitmap) => {
                if (newBitmap) {
                  currentBitmapRef.current = newBitmap;
                }
              });
            }
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentSrc]);

  if (!useCanvas) {
    return (
      <div
        ref={containerRef}
        className={`${styles.container} ${className}`}
        style={{
          backgroundImage: src ? `url(${src})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transition: `opacity ${transitionDuration}ms ease-in-out`,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className}`}
      style={{
        // 仅 Canvas 失败时挂 CSS；成功路径只走 gameResourceManager 单通道
        backgroundImage: cssFallbackSrc ? `url(${cssFallbackSrc})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        ...style,
        opacity: isTransitioning ? 0 : 1,
      }}
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};

export default GameBackgroundRenderer;

