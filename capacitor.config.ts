import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 必须与 Google Play 控制台登记的软件包名称完全一致（含大小写）
  appId: 'com.Funloom.myapp',
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
