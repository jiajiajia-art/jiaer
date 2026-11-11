/**
 * 游戏级资源管理器
 * 使用 createImageBitmap 提前解码图片，纹理缓存常驻内存
 */

import { fallbackCharacterPortraitPng } from './characterPortraitUrl';

export interface ResourceLoadOptions {
  decode?: boolean;
}

export interface ResourceInfo {
  url: string;
  bitmap: ImageBitmap | null;
  status: 'pending' | 'loading' | 'loaded' | 'error';
  error?: string;
  loadedAt?: number;
  refCount?: number;
}

class GameResourceManager {
  private textureCache = new Map<string, ResourceInfo>();
  private loadingPromises = new Map<string, Promise<ImageBitmap | null>>();
  private maxCacheSize = 500;

  /**
   * 获取缓存键：移除查询参数中的时间戳/缓存破坏参数
   * 这样带不同时间戳的同一资源 URL 可以命中同一缓存
   */
  private getCacheKey(url: string): string {
    // 移除常见的时间戳/缓存破坏参数
    return url.replace(/[?&](t|cb)=[\d]+/g, '').split('?')[0];
  }

  async loadImage(
    url: string,
    options: ResourceLoadOptions = {}
  ): Promise<ImageBitmap | null> {
    if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
      return null;
    }

    const cacheKey = this.getCacheKey(url);
    const cached = this.textureCache.get(cacheKey);
    if (cached?.bitmap && cached.status === 'loaded') {
      return cached.bitmap;
    }

    const existingPromise = this.loadingPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const loadPromise = this._loadImageInternal(url, options.decode !== false, cacheKey);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const bitmap = await loadPromise;
      return bitmap;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  private async _loadImageInternal(
    url: string,
    shouldDecode: boolean,
    cacheKey: string
  ): Promise<ImageBitmap | null> {
    if (!this.textureCache.has(cacheKey)) {
      this.textureCache.set(cacheKey, {
        url,
        bitmap: null,
        status: 'loading',
      });
    }

    const resourceInfo = this.textureCache.get(cacheKey)!;
    resourceInfo.status = 'loading';

    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
      });

      if (!response.ok) {
        // 角色立绘 webp 404/失败 → 自动改拉同名 png
        const pngUrl = fallbackCharacterPortraitPng(url);
        if (pngUrl && pngUrl !== url) {
          console.warn(`[ResourceManager] portrait webp miss, fallback png: ${url}`);
          const pngRes = await fetch(pngUrl, { mode: 'cors', credentials: 'omit' });
          if (pngRes.ok) {
            const blob = await pngRes.blob();
            const bitmap = shouldDecode
              ? await createImageBitmap(blob)
              : await this._createImageBitmapFallback(blob);
            resourceInfo.bitmap = bitmap;
            resourceInfo.status = 'loaded';
            resourceInfo.loadedAt = Date.now();
            resourceInfo.refCount = (resourceInfo.refCount || 0) + 1;
            resourceInfo.url = pngUrl;
            this._cleanupCache();
            return bitmap;
          }
        }
        throw new Error(`Failed to load image: ${response.statusText}`);
      }

      const blob = await response.blob();
      const bitmap = shouldDecode
        ? await createImageBitmap(blob)
        : await this._createImageBitmapFallback(blob);

      resourceInfo.bitmap = bitmap;
      resourceInfo.status = 'loaded';
      resourceInfo.loadedAt = Date.now();
      resourceInfo.refCount = (resourceInfo.refCount || 0) + 1;

      this._cleanupCache();

      return bitmap;
    } catch (error) {
      // fetch 抛错时再试一次 png 兜底
      try {
        const pngUrl = fallbackCharacterPortraitPng(url);
        if (pngUrl && pngUrl !== url) {
          const pngRes = await fetch(pngUrl, { mode: 'cors', credentials: 'omit' });
          if (pngRes.ok) {
            const blob = await pngRes.blob();
            const bitmap = shouldDecode
              ? await createImageBitmap(blob)
              : await this._createImageBitmapFallback(blob);
            resourceInfo.bitmap = bitmap;
            resourceInfo.status = 'loaded';
            resourceInfo.loadedAt = Date.now();
            resourceInfo.refCount = (resourceInfo.refCount || 0) + 1;
            resourceInfo.url = pngUrl;
            this._cleanupCache();
            return bitmap;
          }
        }
      } catch {
        /* ignore secondary */
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      resourceInfo.status = 'error';
      resourceInfo.error = errorMessage;
      console.error(`[ResourceManager] Failed to load image: ${url}`, error);
      return null;
    }
  }

  private async _createImageBitmapFallback(blob: Blob): Promise<ImageBitmap> {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(blob);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        
        if (typeof createImageBitmap === 'function') {
          createImageBitmap(img)
            .then(resolve)
            .catch(() => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                createImageBitmap(canvas)
                  .then(resolve)
                  .catch(() => reject(new Error('createImageBitmap not supported')));
              } else {
                reject(new Error('Failed to get canvas context'));
              }
            });
        } else {
          reject(new Error('createImageBitmap not supported'));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };

      img.src = url;
    });
  }

  getResourceInfo(url: string): ResourceInfo | undefined {
    const cacheKey = this.getCacheKey(url);
    return this.textureCache.get(cacheKey);
  }

  isLoaded(url: string): boolean {
    const cacheKey = this.getCacheKey(url);
    const info = this.textureCache.get(cacheKey);
    return info?.status === 'loaded' && info.bitmap !== null;
  }

  getBitmap(url: string): ImageBitmap | null {
    const cacheKey = this.getCacheKey(url);
    const info = this.textureCache.get(cacheKey);
    return info?.bitmap || null;
  }

  useBitmap(url: string): ImageBitmap | null {
    const cacheKey = this.getCacheKey(url);
    const info = this.textureCache.get(cacheKey);
    if (info?.bitmap) {
      info.refCount = (info.refCount || 0) + 1;
    }
    return info?.bitmap || null;
  }

  releaseBitmap(url: string): void {
    const cacheKey = this.getCacheKey(url);
    const info = this.textureCache.get(cacheKey);
    if (info && info.refCount !== undefined && info.refCount > 0) {
      info.refCount--;
    }
  }

  private _cleanupCache(): void {
    if (this.textureCache.size <= this.maxCacheSize) {
      return;
    }

    const entries = Array.from(this.textureCache.entries())
      .filter(([_, info]) => {
        return info.status === 'loaded' && (info.refCount === undefined || info.refCount === 0);
      })
      .sort((a, b) => (a[1].loadedAt || 0) - (b[1].loadedAt || 0));

    const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
    toRemove.forEach(([cacheKey]) => {
      const info = this.textureCache.get(cacheKey);
      if (info?.bitmap && (info.refCount === undefined || info.refCount === 0)) {
        info.bitmap.close();
      }
      this.textureCache.delete(cacheKey);
    });
  }

  clearCache(): void {
    this.textureCache.forEach((info) => {
      if (info.bitmap) {
        info.bitmap.close();
      }
    });
    this.textureCache.clear();
    this.loadingPromises.clear();
  }

  getCacheStats() {
    const stats = {
      total: this.textureCache.size,
      loaded: 0,
      loading: 0,
      error: 0,
      pending: 0,
    };

    this.textureCache.forEach((info) => {
      switch (info.status) {
        case 'loaded':
          stats.loaded++;
          break;
        case 'loading':
          stats.loading++;
          break;
        case 'error':
          stats.error++;
          break;
        case 'pending':
          stats.pending++;
          break;
      }
    });

    return stats;
  }
}

export const gameResourceManager = new GameResourceManager();

