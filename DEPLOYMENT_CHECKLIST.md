# Cloudflare Pages 部署检查清单

## ✅ 已完成的修改

1. **`src/config.ts`** ✅
   - 已改为使用环境变量 `VITE_API_BASE_URL`
   - 支持本地开发和生产环境自动切换

2. **`public/_redirects`** ✅
   - 已创建，支持 SPA 路由

## ⚠️ 需要修改的地方（硬编码的图片 URL）

发现以下文件中有硬编码的 `https://kurangames.com/images/`，建议统一改为使用配置：

### 需要修改的文件列表：

1. `src/components/CreateGame/GameStatsView.tsx` (1处)
2. `src/components/GameDetailModal.tsx` (2处)
3. `src/page/Create.tsx` (1处)
4. `src/components/GameSettingEditor/Sidebar.tsx` (1处)
5. `src/page/Home.tsx` (1处)
6. `src/page/Profile.tsx` (1处)
7. `src/components/GameGrid.tsx` (1处)
8. `src/components/CreateGame/GameForm.tsx` (2处)
9. `src/components/Layout/Navbar.tsx` (1处)

**总计：11 处硬编码**

### 当前状态

这些硬编码的图片 URL **在部署到 Cloudflare Pages 后仍然可以工作**，因为：
- 图片服务器地址 `https://kurangames.com/images/` 是固定的
- 不依赖环境变量

### 建议修改的原因

虽然当前可以工作，但为了：
1. **更好的可维护性**：如果图片服务器地址改变，只需要修改配置
2. **支持多环境**：开发/测试/生产环境可以使用不同的图片服务器
3. **代码一致性**：所有外部资源都通过配置管理

## 📋 修改方案

### 方案 1：使用 `HOST_ADDRESS`（推荐）

假设图片和 API 在同一个服务器上，可以统一使用 `HOST_ADDRESS`：

```typescript
// 将
`https://kurangames.com/images/${path}`

// 改为
`${HOST_ADDRESS}/images/${path}`
```

### 方案 2：添加独立的图片服务器配置

如果图片服务器和 API 服务器不同，可以在 `config.ts` 中添加：

```typescript
export const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL || 
  (ON_SERVER ? 'https://kurangames.com' : 'http://localhost:3000');
```

## 🎯 结论

### 当前状态：**可以部署，但建议优化**

- ✅ **API 请求**：已正确配置，使用环境变量
- ✅ **路由**：已正确配置，支持 SPA
- ⚠️ **图片 URL**：硬编码，功能正常但不够灵活

### 是否需要立即修改？

**如果图片服务器地址不会改变**：
- ✅ 可以**不修改**，直接部署
- 功能完全正常

**如果想要更好的可维护性**：
- ⚠️ 建议修改这 11 处硬编码
- 统一使用配置管理

## 🚀 部署准备状态

| 项目 | 状态 | 说明 |
|------|------|------|
| API 配置 | ✅ 完成 | 使用环境变量 |
| 路由配置 | ✅ 完成 | SPA 路由支持 |
| 图片 URL | ⚠️ 可选优化 | 硬编码但可用 |
| 构建配置 | ✅ 完成 | Vite 配置正确 |

**总结**：代码已经可以部署到 Cloudflare Pages，硬编码的图片 URL 不影响功能，但建议后续优化。

