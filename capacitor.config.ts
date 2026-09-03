import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.funloom.interactivefiction',
  appName: 'funloom',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    // 直接加载线上已部署版本，所有路由/API/资源路径与 Web 版完全一致
    url: 'https://funloom.kurangames.com/funloom/',
  },
};

export default config;
