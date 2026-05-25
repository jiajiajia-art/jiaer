# 重构计划：Home.tsx 拆分 & Components 目录整理

> 创建日期：2026-05-25
> 状态：待执行

---

## 一、背景

### 1.1 Home.tsx 问题
- **行数**：2342 行
- **评分**：6/6 (强烈建议拆分)
- **问题**：数据请求、轮播逻辑、弹窗管理、游戏列表等功能混在一起，维护成本高

### 1.2 Components 目录问题
- 根目录散落 44 个单文件组件，缺乏组织
- 同一类型的组件分散在不同位置（如 Modal 组件有多个分散在根目录）

---

## 二、Home.tsx 拆分方案

### 目标文件结构
```
src/page/Home/
├── Home.tsx                    # 主页面，组合各子组件
├── Home.module.css             # 主页样式（保留）
├── components/
│   ├── HomeCarousel.tsx       # 轮播组件
│   ├── ThemeShowcaseSection.tsx # 题材展示区
│   ├── HomeTicker.tsx         # 滚动通知
│   └── HomeGameListSection.tsx # 筛选栏+游戏列表
├── hooks/
│   ├── useHomeModals.ts       # 弹窗状态管理
│   ├── useHomeShowcaseData.ts # 展示数据加载
│   ├── useHomeGamesData.ts    # 游戏数据加载
│   └── useCarouselData.ts     # 轮播数据加载
└── types/
    └── Home.ts                # 类型定义
```

### 2.1 HomeCarousel（轮播组件）

**提取内容：**
- 状态：`currentSlide`, `desktopCurrentSlide`, `carouselItems`, `carouselImageLoadedMap`, `carouselImageRetryMap`
- 函数：
  - `loadCarouselData`
  - `preloadCarouselImage`
  - `waitForCarouselImageReady`
  - `requestCarouselNavAction`
  - `performCarouselNavAction`
  - `restoreCarouselAfterReset`
  - `handleCarouselTouchStart/Move/End`
- 渲染：整个轮播 JSX 区块

**优先级：高**（逻辑最复杂，约700行）

### 2.2 ThemeShowcaseSection（题材展示）

**提取内容：**
- 状态：`homeShowcaseTags`, `activeShowcaseTagKey`, `showcaseGamesCache`, `showcaseLoadingKey`
- 函数：
  - `loadHomeShowcaseTags`
  - `loadShowcaseGames`
  - `handleThemeClick`
  - `handleShowcaseMoreClick`
- 渲染：标签栏 + 标题行 + HomeThemePreviewRail

**优先级：中**

### 2.3 HomeTicker（滚动通知）

**提取内容：**
- 状态：`homeTicker`, `isTickerOverflowing`
- 函数：
  - `loadHomeTicker`
  - `measureTickerOverflow`
  - `navigateToHomeTickerLink`
  - `handleHomeTickerClick`
- 渲染：整个 ticker 按钮 JSX

**优先级：中**

### 2.4 HomeGameListSection（筛选栏+游戏列表）

**提取内容：**
- 状态：`allGames`, `allGamesFilters`, `allPage`, `hasMoreAll`, `isLoadingAll`, `isLoadingMoreAll`
- 函数：
  - `loadAllGames`
  - `loadMoreAll`
  - `handleAllGamesSortChange/ModeChange/TagChange`
- 渲染：HomeGameFilterBar + GameGrid + 加载更多触发器

**优先级：中**

### 2.5 useHomeModals Hook

**提取内容：**
- 签到、加入群组、公告等弹窗状态
- 相关 useEffect 和回调函数

**优先级：中**

---

## 三、Components 目录整理方案

### 3.1 新建 Admin/ 文件夹

**目的**：统一管理后台相关组件

**待移动文件：**
```
根目录 → src/components/Admin/
├── AdminRoute.tsx
├── AdminBannerManager.tsx
├── AdminBannerManager.module.css
├── CreatorIncentiveAdminManager.tsx
├── CreatorIncentiveAdminManager.module.css
├── PointsAdminManager.tsx
├── PointsAdminManager.module.css
├── PromotionAdminManager.tsx
├── PromotionAdminManager.module.css
├── SpecialThemeTagManager.tsx
├── SpecialThemeTagManager.module.css
├── SubscriptionAdminManager.tsx
└── SubscriptionAdminManager.module.css
```

**优先级：低**（不影响功能，整理性）

### 3.2 新建 Home/ 文件夹

**目的**：统一管理首页相关组件

**待移动文件：**
```
根目录 → src/components/Home/
├── GameGrid.tsx
├── GameGrid.module.css
├── HomeGameFilterBar.tsx
├── HomeGameFilterBar.module.css
├── HomeThemePreviewRail.tsx
└── HomeThemePreviewRail.module.css
```

**优先级：低**

### 3.3 保留不变的已有文件夹
- `CommonModal/` - 已有11个通用弹窗组件
- `Layout/` - 导航栏、底部导航等
- `Galgame/` - 游戏内 UI 组件
- `GalgameMap/` - 世界地图组件
- `GameSettingEditor/` - 游戏设置编辑器
- `CreateGame/` - 创建游戏组件
- `Skeleton/` - 骨架屏组件
- `Purchase/` - 充值相关

### 3.4 保留在根目录的组件
```
ProtectedRoute.tsx     - 通用路由保护
RouteReporter.tsx     - 路由上报
ScrollToTop.tsx       - 滚动置顶工具
CreatorProfile.tsx    - 用户相关
FloatingJoinGroup.tsx - 浮动组件
```

---

## 四、执行顺序建议

### 阶段一：Components 目录整理（可独立进行）
1. 新建 `Admin/` 文件夹
2. 移动 Admin 相关组件
3. 新建 `Home/` 文件夹
4. 移动 Home 相关组件
5. 更新所有 import 路径

### 阶段二：Home.tsx 拆分（依赖阶段一）
1. 新建 `page/Home/` 目录结构
2. 提取 HomeCarousel 组件
3. 提取 ThemeShowcaseSection 组件
4. 提取 HomeTicker 组件
5. 提取 HomeGameListSection 组件
6. 提取 hooks
7. 组装主页面
8. 删除原 Home.tsx

---

## 五、注意事项

### 5.1 Git 冲突风险
- 重命名/移动文件时，如果其他同事同时修改了相关文件，可能产生冲突
- **建议**：提前通知团队，约定一个时间点统一进行，重构期间避免多人修改 Home.tsx 和相关组件

### 5.2 import 路径更新
- 需要全局搜索替换所有相关的 import 语句
- 建议使用 IDE 的 "Find and Replace" 功能批量处理

### 5.3 测试验证
- 重构完成后需要验证：
  - 首页功能正常
  - 轮播正常切换
  - 标签切换正常
  - 游戏列表筛选/加载正常
  - 所有弹窗正常显示
  - 管理后台功能正常

---

## 六、预估工作量

| 任务 | 预估时间 |
|------|----------|
| Components 目录整理 | 1-2 小时 |
| Home.tsx 拆分 | 3-4 小时 |
| 测试验证 | 1-2 小时 |
| **总计** | **5-8 小时** |

---

## 七、相关文件清单

### 需要更新的 import 文件（Components 整理）
待补充...

### 需要更新的 import 文件（Home.tsx 拆分）
待补充...
