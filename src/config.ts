export const ON_SERVER: boolean = import.meta.env.PROD;
export const HOST_ADDRESS = import.meta.env.VITE_API_BASE_URL || 
  (ON_SERVER ? 'https://kurangames.com' : 'http://localhost:3000');
export const RECORD_CONVERSION = import.meta.env.VITE_RECORD_CONVERSION === 'true' || false; // 是否记录游戏需要统计的数据


export const getImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return `https://kurangames.com/images/${imagePath}`;
};