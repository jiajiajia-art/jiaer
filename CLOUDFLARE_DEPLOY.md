# Cloudflare Pages 部署指南

本文档说明将前端项目部署到 Cloudflare Pages 需要做的修改和配置。

## 📋 目录

1. [代码修改](#代码修改)
2. [配置文件创建](#配置文件创建)
3. [Cloudflare Pages 配置](#cloudflare-pages-配置)
4. [环境变量设置](#环境变量设置)
5. [注意事项](#注意事项)

---

## 🔧 代码修改

### 1. 修改 `src/config.ts` - 使用环境变量

**当前代码：**
```typescript
export const ON_SERVER: boolean = false;
export const HOST_ADDRESS = ON_SERVER ? 'https://kurangames.com' : 'http://localhost:3000';
export const RECORD_CONVERSION = false;
```

**需要修改为：**
```typescript
// 从环境变量获取配置，支持 Cloudflare Pages 部署
export const ON_SERVER: boolean = import.meta.env.PROD;
export const HOST_ADDRESS = import.meta.env.VITE_API_BASE_URL || 
  (ON_SERVER ? 'https://kurangames.com' : 'http://localhost:3000');
export const RECORD_CONVERSION = import.meta.env.VITE_RECORD_CONVERSION === 'true' || false;
```

**说明：**
- 使用 `import.meta.env.PROD` 自动判断是否为生产环境
  - 本地开发（`pnpm dev`）时：`import.meta.env.PROD = false`，会自动使用 `http://localhost:3000`
  - 生产构建（`pnpm build`）时：`import.meta.env.PROD = true`，会使用环境变量或默认的生产地址
- 通过 `VITE_API_BASE_URL` 环境变量配置 API 地址（可选，不设置时会使用默认值）
- 通过 `VITE_RECORD_CONVERSION` 环境变量控制转换记录功能
- Vite 只会暴露以 `VITE_` 开头的环境变量到客户端代码

**本地开发兼容性：**
- ✅ 修改后本地开发完全不受影响
- ✅ 运行 `pnpm dev` 时，如果没有设置 `VITE_API_BASE_URL`，会自动使用 `http://localhost:3000`
- ✅ 如果需要覆盖默认值，可以创建 `.env.local` 文件（会被 git 忽略）

---

## 📁 配置文件创建

### 2. 创建 `public/_redirects` 文件

在 `public` 目录下创建 `_redirects` 文件（注意：文件名前有下划线）：

**文件路径：** `public/_redirects`

**文件内容：**
```
/funloom/* /funloom/index.html 200
```

**说明：**
- Cloudflare Pages 会自动识别此文件
- 将所有 `/funloom/*` 路径的请求重定向到 `/funloom/index.html`
- 状态码 200 表示正常响应（不是重定向），这对 SPA 路由很重要
- 这确保了直接访问 `/funloom/home` 等路由时能正确加载应用

---

### 3. 创建 `.env.example` 文件（可选）

在项目根目录创建 `.env.example` 文件，作为环境变量配置示例：

**文件路径：** `.env.example`

**文件内容：**
```
# 环境变量示例文件
# 复制此文件为 .env.local（本地开发）或 .env.production（生产构建）

# API 基础地址
# 生产环境: https://kurangames.com
# 开发环境: http://localhost:3000
VITE_API_BASE_URL=https://kurangames.com

# 是否记录转换数据
VITE_RECORD_CONVERSION=false
```

**说明：**
- 本地开发时，可以创建 `.env.local` 文件（会被 git 忽略）
- 生产环境的环境变量在 Cloudflare Pages Dashboard 中设置

---

## ⚙️ Cloudflare Pages 配置

### 4. 构建设置

在 Cloudflare Pages Dashboard 中配置以下构建设置：

| 配置项 | 值 |
|--------|-----|
| **构建命令** | `pnpm build` 或 `npm run build` |
| **构建输出目录** | `dist` |
| **根目录** | `/` （项目根目录） |
| **Node.js 版本** | 18.x 或更高（推荐 20.x） |

---

### 5. 环境变量设置

在 Cloudflare Pages Dashboard → Settings → Environment Variables 中添加：

#### 生产环境（Production）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_API_BASE_URL` | `https://kurangames.com` | 后端 API 地址 |
| `VITE_RECORD_CONVERSION` | `false` | 是否记录转换数据（可选） |

#### 预览环境（Preview/Branch）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_API_BASE_URL` | `https://kurangames.com` | 后端 API 地址（或测试环境地址） |
| `VITE_RECORD_CONVERSION` | `false` | 是否记录转换数据（可选） |

**注意：**
- 环境变量修改后需要重新部署才会生效
- 所有以 `VITE_` 开头的变量会被注入到客户端代码中

---

## ✅ 当前配置检查清单

### 已正确配置的部分

- ✅ **Base 路径配置**
  - `vite.config.ts` 中已设置 `base: '/funloom/'`
  - `App.tsx` 中已设置 `BrowserRouter basename='/funloom'`
  - 构建输出已正确使用 `/funloom/` 前缀

- ✅ **路由配置**
  - 使用 React Router 的 `BrowserRouter`
  - 路由路径配置正确

- ✅ **构建配置**
  - Vite 配置正确
  - TypeScript 配置正确

### 需要修改的部分

- ⚠️ **环境变量配置**
  - `src/config.ts` 需要改为使用环境变量（见上方修改说明）

- ⚠️ **SPA 路由支持**
  - 需要创建 `public/_redirects` 文件（见上方说明）

---

## 🔍 部署后验证

部署完成后，检查以下内容：

1. **首页加载**
   - 访问 `https://your-domain.pages.dev/funloom/` 应该能正常加载

2. **路由跳转**
   - 点击导航链接，路由应该能正常工作
   - 直接访问 `https://your-domain.pages.dev/funloom/home` 应该能正常加载

3. **API 请求**
   - 打开浏览器开发者工具 → Network
   - 检查 API 请求是否指向正确的后端地址
   - 确认没有 CORS 错误

4. **静态资源**
   - 检查图片、字体等静态资源是否正常加载
   - 确认资源路径包含 `/funloom/` 前缀

---

## ⚠️ 注意事项

### 1. CORS 配置

确保后端 API 服务器允许来自 Cloudflare Pages 域名的跨域请求：

```
Access-Control-Allow-Origin: https://your-domain.pages.dev
```

或者使用通配符（不推荐用于生产环境）：
```
Access-Control-Allow-Origin: *
```

### 2. HTTPS 要求

- Cloudflare Pages 默认提供 HTTPS
- 确保后端 API 也支持 HTTPS
- 如果后端使用 HTTP，浏览器可能会阻止混合内容请求

### 3. 环境变量安全

- ⚠️ **重要**：所有 `VITE_` 开头的环境变量会被打包到客户端代码中
- 不要在环境变量中存储敏感信息（如 API 密钥、私钥等）
- 只存储可以在客户端公开的配置信息

### 4. 构建缓存

如果遇到构建问题，可以尝试：
- 清除 Cloudflare Pages 的构建缓存
- 在 Dashboard → Settings → Builds → Clear build cache

### 5. 自定义域名

如果使用自定义域名：
- 确保 DNS 配置正确
- 在 Cloudflare Pages Dashboard 中添加自定义域名
- SSL/TLS 证书会自动配置

### 6. 404 页面处理

如果需要自定义 404 页面：
- 可以在 `public` 目录下创建 `404.html`
- 或者通过 `_redirects` 文件配置：
  ```
  /* /funloom/index.html 200
  ```

---

## 📚 相关资源

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Vite 环境变量文档](https://vitejs.dev/guide/env-and-mode.html)
- [React Router 文档](https://reactrouter.com/)

---

## 🚀 快速部署步骤总结

1. **修改代码**
   - 修改 `src/config.ts` 使用环境变量

2. **创建配置文件**
   - 创建 `public/_redirects` 文件

3. **提交代码**
   - 将修改推送到 Git 仓库

4. **配置 Cloudflare Pages**
   - 连接 Git 仓库
   - 设置构建命令和输出目录
   - 配置环境变量

5. **部署**
   - Cloudflare Pages 会自动构建和部署
   - 检查部署日志确认成功

6. **验证**
   - 访问部署的网站
   - 测试路由和 API 请求

---

## ❓ 常见问题

### Q: 为什么需要 `_redirects` 文件？

A: React Router 使用客户端路由，所有路由都由前端 JavaScript 处理。当用户直接访问 `/funloom/home` 时，服务器需要返回 `index.html`，然后由前端路由处理。`_redirects` 文件告诉 Cloudflare Pages 将所有请求都返回 `index.html`。

### Q: 环境变量不生效怎么办？

A: 
1. 确认环境变量名以 `VITE_` 开头
2. 确认在正确的环境（Production/Preview）中设置
3. 重新部署应用（环境变量修改后需要重新构建）
4. 检查构建日志确认环境变量被正确读取

### Q: 静态资源 404 错误？

A: 
1. 确认 `vite.config.ts` 中的 `base` 配置正确
2. 确认资源路径包含 `/funloom/` 前缀
3. 检查 `public` 目录下的文件是否正确复制到 `dist` 目录

### Q: API 请求失败？

A:
1. 检查 `VITE_API_BASE_URL` 环境变量是否正确设置
2. 检查后端 API 的 CORS 配置
3. 检查浏览器控制台的错误信息
4. 确认后端 API 支持 HTTPS（如果前端使用 HTTPS）



