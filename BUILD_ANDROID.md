# Android APK 打包说明

把 Capacitor Web 应用打包成安卓手机可以直接安装的 APK 文件。

## ⚡ 一键打包（最快）

在项目根目录执行：

```bash
cd ~/Documents/cursor/gameWork/Interactive-fiction-frontend

# 1. 构建前端（输出到 dist/）
npm run build

# 2. 同步 web 资源到 android 工程
npx cap sync android

# 3. 构建 Debug APK
cd android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew assembleDebug
```

完成后 APK 在：

```
android/app/build/outputs/apk/debug/app-debug.apk
```

（通常 80~120MB，包含 Capacitor 运行时 + 你的 web 资源）

---

## 📱 三种方式装到手机

### 方式 1：传文件（推荐，无需数据线）

```bash
cp android/app/build/outputs/apk/debug/app-debug.apk ~/Desktop/
```

然后微信/网盘/AirDrop 传到手机，手机文件管理点击 apk 安装。
> 首次安装要去手机 **设置 → 应用 → 特殊权限 → 安装未知应用**，允许你的文件管理/微信等。

### 方式 2：USB 数据线 + adb

```bash
# 1. 手机开 USB 调试（设置 → 开发者选项 → USB 调试）
# 2. 连接 Mac
adb devices                          # 确认手机已识别
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 方式 3：直接在 AS 里运行

1. AS 顶部设备下拉选你的手机
2. 点绿色 ▶ 运行按钮
3. 自动安装并启动

---

## 🖱️ 在 Android Studio 里点菜单打包

如果你想在 AS 里点鼠标操作（不用命令行）：

1. AS 打开 `android/` 子目录作为项目
2. 菜单 **构建** → **Build App Bundle(s) / APK(s)** ▶ → **Build APK(s)**
3. 等底部"构建"面板显示 `BUILD SUCCESSFUL`
4. 完成后点 **locate** 链接直接跳到 APK 位置

---

## 🔧 前置条件（首次需要）

### 1. Capacitor 依赖（项目内）

```bash
pnpm add -D @capacitor/cli@7 @capacitor/core@7 @capacitor/android@7
# 或 npm install -D @capacitor/cli@7 @capacitor/core@7 @capacitor/android@7
```

### 2. capacitor.config.ts（项目根目录）

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.funloom.interactivefiction',
  appName: 'Interactive Fiction',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
};

export default config;
```

### 3. Android 工程目录

```bash
# 仅在 android/ 目录不存在或被破坏时执行
npx cap add android     # 生成 android/ 目录
npx cap sync android    # 同步 web 资源
```

### 4. JDK（Mac 一般没装系统 JDK）

Android Studio 自带 JDK，直接用它的：

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

否则 `./gradlew` 会报 "Unable to locate a Java Runtime"。

### 5. Android SDK

`~/Library/Android/sdk` 必须存在，且 `android/local.properties` 里有：

```properties
sdk.dir=/Users/xiaoming/Library/Android/sdk
```

AS 首次打开会帮你配置好。

---

## 🚀 Release 版本（发布给别人）

Debug 版装自己手机够了，但如果要发布：

1. **生成签名 keystore**（一次性）：

   ```bash
   cd android/app
   keytool -genkey -v -keystore my-release-key.jks \
     -keyalg RSA -keysize 2048 -validity 10000 -alias my-key
   ```

2. **配置签名**：`android/app/build.gradle` 里加 `signingConfigs`，并把 `buildTypes.release.signingConfig` 指向它。

3. **构建 Release APK**：

   ```bash
   ./gradlew assembleRelease
   # 输出：android/app/build/outputs/apk/release/app-release.apk
   ```

或者用 AS 菜单：**构建** → **Generate Signed App Bundle / APK...** → 选 APK → 选 keystore → 选 release。

---

## 📦 关于不同"版本"

**一个 APK 就能装所有 Android 手机**，不用为不同分辨率建多个。

- **分辨率**（hdpi/xhdpi/xxhdpi 等）：APK 里包含全部分辨率资源，Android 系统自动选合适的
- **构建变体**（debug/release）：在 AS 左下角 **构建变体** 面板切换，或命令行 `./gradlew assembleDebug`/`assembleRelease`
- **ABI 拆分**（arm64/x86 等）：仅超大型 App 需要，本项目 99MB 不必拆
- **App Bundle (AAB)**：仅 Google Play 用，本地装手机不能用 AAB

---

## ❓ 常见问题

| 错误 | 解决 |
|------|------|
| `Unable to locate a Java Runtime` | 设置 `JAVA_HOME` 指向 AS 自带 JDK（见上文） |
| `Directory does not contain a Gradle build` | 重新执行 `npx cap add android` |
| `dl.google.com` 下载失败 | 国内网络问题，国内用户需配置镜像或挂代理 |
| Gradle 同步卡住 | 删除 `~/.gradle/caches` 重试，或设置 AS 代理 |
| AS 中文界面设置 | 见 `ASTUDIO_ZH_SETUP.md` |

---

## 📋 完整流程图

```
代码改动
  ↓
npm run build           构建 React/web 到 dist/
  ↓
npx cap sync android    同步 dist → android/app/src/main/assets/public/
  ↓
./gradlew assembleDebug 编译并打包 → APK
  ↓
adb install 或 文件传输 → 装到手机
```

---

**更新日期**: 2026-09-01
**适用版本**: Capacitor 7.6.9 + Android Gradle Plugin 8.x