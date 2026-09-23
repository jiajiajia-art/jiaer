# Android APK / AAB 打包说明

把 Capacitor Web 应用打包成：

- **APK**：可直接装到手机（内测 / 侧载）
- **AAB (Android App Bundle)**：给 Google Play 上架用（不能直接装手机）

## ⚡ npm 一键打包（推荐）

在 `Interactive-fiction-frontend` 根目录：

```bash
cd ~/Documents/cursor/gameWork/Interactive-fiction-frontend

# Google Play 上架用（AAB）
npm run android:aab:release

# 手机直接安装用（APK）
npm run android:apk:debug
npm run android:apk:release

# 仅构建 web + 同步到 android/（不调 gradle）
npm run android:sync
```

脚本会自动：`npm run build` → `npx cap sync android` → 对齐 `applicationId=com.Funloom.myapp` + release 签名 → `./gradlew …`，并优先使用 Android Studio 自带 JDK。

> Google Play 本应用登记包名为 **`com.Funloom.myapp`**（`F` 大写）。上传 AAB 的 `applicationId` 必须完全一致，否则控制台会报「软件包名称必须为…」。
> 新上架还要求 **`targetSdkVersion ≥ 36`**（打包脚本会把 `android/variables.gradle` 对齐到 36）。

| 命令 | 产物 |
|------|------|
| `npm run android:apk:debug` | `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run android:apk:release` | `android/app/build/outputs/apk/release/app-release.apk` |
| `npm run android:aab:debug` | `android/app/build/outputs/bundle/debug/app-debug.aab` |
| `npm run android:aab:release` | `android/app/build/outputs/bundle/release/app-release.aab` |

已同步过、只想重打 gradle 时：

```bash
ANDROID_SKIP_WEB=1 npm run android:aab:release
```

## ⚡ 手动命令（与脚本等价）

```bash
cd ~/Documents/cursor/gameWork/Interactive-fiction-frontend

# 1. 构建前端（输出到 dist/）
npm run build

# 2. 同步 web 资源到 android 工程
npx cap sync android

# 3. 构建
cd android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

./gradlew assembleDebug     # → APK debug
./gradlew assembleRelease   # → APK release
./gradlew bundleDebug       # → AAB debug
./gradlew bundleRelease     # → AAB release（Play 上架）
```

Debug APK 通常约几十到一百多 MB（含 Capacitor 运行时；若 `capacitor.config` 指向线上 URL，本地 assets 会更小）。

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
2. 菜单 **构建** → **Build App Bundle(s) / APK(s)** ▶ → **Build APK(s)** 或 **Build Bundle(s)**
3. 等底部"构建"面板显示 `BUILD SUCCESSFUL`
4. 完成后点 **locate** 链接直接跳到 APK / AAB 位置

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
  appId: 'com.Funloom.myapp',
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

## 🚀 Release 签名（keystore）

正式上架的 keystore **就是自己生成的**（或向已发版同事要同一把）。本项目用本地目录：

```
signing/funloom-upload.jks      # 密钥库（勿提交 git）
signing/keystore.properties     # 口令 / alias（勿提交 git）
```

一键生成并写入 `android/app/build.gradle`：

```bash
npm run android:signing
# 打 release 时也会自动跑：npm run android:aab:release
```

- **务必备份整个 `signing/`**（网盘/密码管理器均可）。丢了就无法用同一签名更新 Play 应用。
- `signing/` 已在 `.gitignore`，不会进仓库。
- 已有 jks 时脚本**不会**重新生成，避免误换钥。

构建 Release：

```bash
npm run android:aab:release   # → android/.../bundle/release/app-release.aab
npm run android:apk:release   # → android/.../apk/release/app-release.apk
```

---

## 📦 关于不同"版本"

**一个 APK 就能装所有 Android 手机**；**AAB 交给 Play**，由商店按设备切分下载。

- **分辨率**（hdpi/xhdpi/xxhdpi 等）：APK 里包含全部分辨率资源，Android 系统自动选合适的
- **构建变体**（debug/release）：在 AS 左下角 **构建变体** 面板切换，或命令行 `assemble*` / `bundle*`
- **ABI 拆分**（arm64/x86 等）：仅超大型 App 需要，本项目一般不必拆
- **App Bundle (AAB)**：Google Play 上架格式；本地装手机请用 APK

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
./gradlew assembleDebug | assembleRelease | bundleRelease
  ↓
APK → 装手机；AAB → 上传 Google Play
```

---

**更新日期**: 2026-09-17
**适用版本**: Capacitor 7.6.9 + Android Gradle Plugin 8.x