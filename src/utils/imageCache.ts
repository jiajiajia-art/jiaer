import { getImageUrl } from './constants';

const imageCacheBustMap = new Map<string, string>();

export const withCacheBust = (url?: string | null): string => {
  if (!url || url === 'null' || url === 'undefined' || url.trim() === '') return '';
  
  const processedUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : getImageUrl(url);
  
  if (!processedUrl) return '';
  
  if (processedUrl.includes('?t=') || processedUrl.includes('&t=') || 
      processedUrl.includes('?cb=') || processedUrl.includes('&cb=')) {
    return processedUrl;
  }
  
  const cached = imageCacheBustMap.get(processedUrl);
  if (cached) return cached;
  
  const separator = processedUrl.includes('?') ? '&' : '?';
  const timestamp = Date.now();
  const busted = `${processedUrl}${separator}t=${timestamp}`;
  imageCacheBustMap.set(processedUrl, busted);
  return busted;
};

export const bumpCacheBust = (url?: string | null): void => {
  if (!url || url === 'null' || url === 'undefined' || url.trim() === '') return;
  
  const processedUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : getImageUrl(url);
  
  if (!processedUrl) return;
  
  const cleanUrl = processedUrl.split('?')[0].split('&')[0];
  
  imageCacheBustMap.delete(cleanUrl);
};

export const clearImageCache = (): void => {
  imageCacheBustMap.clear();
};

export const addImageTimestamp = (url: string | undefined): string => {
  return withCacheBust(url);
};

