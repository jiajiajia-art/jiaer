export const ON_SERVER: boolean = import.meta.env.PROD;
// 开发环境留空 → 走 Vite 同源 /api、/public 代理，局域网同事可访问
// 若后端不在本机，可设 VITE_API_BASE_URL=http://<后端IP>:3000
// export const HOST_ADDRESS = import.meta.env.VITE_API_BASE_URL ||
//   (ON_SERVER ? 'https://api.kurangames.com' : '');
// 测试
export const HOST_ADDRESS = 'https://api-test.kurangames.com';
// 测试2
// export const HOST_ADDRESS = 'https://api-test2.kurangames.com';
// 国内正式生产
 //export const HOST_ADDRESS = 'https://api.kurangames.com';
// 海外正式生产
// export const HOST_ADDRESS = 'https://api-overseas.kurangames.com';
// 本地直连（私聊去自我介绍 / 30s 主动开口等改动在本地后端）
// 本地直连
// export const HOST_ADDRESS = 'http://localhost:3000';
// cloudflare 代理测试
// export const HOST_ADDRESS = 'https://api-global.kurangames.com';

export const RECORD_CONVERSION = import.meta.env.PROD
  ? true
  : import.meta.env.VITE_RECORD_CONVERSION === 'true';

// Language: 'zh' | 'en' — hardcoded, no user switching
export const LANGUAGE: 'zh' | 'en' = 'zh'
