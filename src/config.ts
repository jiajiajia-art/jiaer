export const ON_SERVER: boolean = import.meta.env.PROD;
// export const HOST_ADDRESS = import.meta.env.VITE_API_BASE_URL ||
//   (ON_SERVER ? 'https://api.kurangames.com' : 'http://localhost:3000');
// 测试环境
export const HOST_ADDRESS = 'https://api-test.kurangames.com';
// 生产环境
// export const HOST_ADDRESS = 'https://api.kurangames.com';
//国外生产
//export const HOST_ADDRESS = 'https://api-overseas.kurangames.com';
// export const HOST_ADDRESS = 'http://localhost:3000';
export const RECORD_CONVERSION = import.meta.env.PROD
  ? true
  : import.meta.env.VITE_RECORD_CONVERSION === 'true';

// Language: 'zh' | 'en' — hardcoded, no user switching
export const LANGUAGE: 'zh' | 'en' = 'zh'
