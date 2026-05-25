---
name: 国际化 + Firebase Google 登录
overview: 为交互式小说平台添加国际化支持（中英文切换）和 Firebase Google 账号登录功能
todos:
  - id: i18n-setup
    content: 安装 i18next 相关依赖
    status: completed
  - id: i18n-structure
    content: 创建 i18n 配置和翻译文件结构
    status: completed
  - id: i18n-translations
    content: 创建中文和英文翻译文件
    status: completed
  - id: i18n-authmodal
    content: 修改 AuthModal.tsx 支持多语言
    status: completed
  - id: i18n-navbar
    content: 修改 Navbar.tsx 支持多语言
    status: completed
  - id: i18n-pages
    content: 修改其他页面组件支持多语言
    status: pending
  - id: i18n-switcher
    content: 在 Navbar 添加语言切换器
    status: completed
  - id: firebase-setup
    content: 创建 Firebase 配置
    status: pending
  - id: firebase-login-btn
    content: 在 AuthModal 添加 Google 登录按钮
    status: pending
  - id: firebase-api
    content: 对接后端 Google 登录 API
    status: pending
isProject: false
---

# 实施方案：国际化 + Firebase Google 登录

## 第一部分：国际化（i18next）

### 步骤 1：安装依赖

```bash
npm install i18next react-i18next i18next-browser-languagedetector i18next-http-backend
```

### 步骤 2：创建国际化配置和翻译文件

```
src/i18n/
├── index.ts              # i18next 配置和初始化
├── locales/
│   ├── zh.json          # 中文翻译（默认）
│   ├── en.json          # 英文翻译
│   └── es.json          # 西班牙语（后续扩展）
```

### 步骤 3：提取并翻译核心组件

**AuthModal.tsx**（登录/注册弹窗）- 优先处理：

- 登录、注册、重置密码标题
- 手机号、密码、验证码输入框提示
- 按钮文字（登录、注册、发送验证码等）
- 错误提示信息

**Navbar.tsx**（导航栏）：

- 首页、创建、游戏库、消息、个人中心等菜单

**首页和页面组件**：

- Home.tsx、Profile.tsx、AdminPanel.tsx 等

### 步骤 4：添加语言切换器

在 Navbar 中添加语言选择下拉框或按钮组：

- 中文（中文）
- English（EN）
- Español（ES）- 后续

### 步骤 5：持久化语言偏好

使用 Zustand 或 localStorage 保存用户选择的语言，下次访问时自动应用。

---

## 第二部分：Firebase Google 登录

### 步骤 1：创建 Firebase 项目（需要你操作）

1. 打开 https://console.firebase.google.com
2. 用 Google 账号登录
3. 创建新项目
4. 注册 Web 应用，获取 `firebaseConfig`

### 步骤 2：安装 Firebase SDK

```bash
npm install firebase
```

### 步骤 3：配置 Firebase

创建 `src/config/firebase.ts`：

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// 替换为你自己的 Firebase 配置
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

### 步骤 4：添加 Google 登录按钮

在 `AuthModal.tsx` 中添加 Google 登录按钮：

- 添加 Google 图标
- 点击后调用 Firebase Google 登录
- 获取 Google 用户信息后，发送到后端 API

### 步骤 5：与后端 API 对接

创建新的 API 端点或在现有 authApi.ts 中添加：

- `googleLogin(idToken)` - 发送 Google ID Token 到后端
- 后端验证 Token 并返回你的平台 JWT

---

## 实施顺序

1. **国际化基础**（i18next 安装 + 配置）
2. **翻译文件创建**（zh.json + en.json）
3. **核心组件翻译**（AuthModal + Navbar）
4. **语言切换器**
5. **Firebase 配置**
6. **Google 登录集成**

---

## 注意事项

### 你需要提供的信息：

1. Firebase 项目配置（firebaseConfig 对象）
2. 后端是否支持 Google 登录 API（需要后端配合）

### 关键文件：

- `src/components/AuthModal.tsx` - 添加 Google 登录按钮
- `src/components/Layout/Navbar.tsx` - 添加语言切换器
- `src/i18n/` - 新建国际化配置
- `src/config/firebase.ts` - Firebase 配置