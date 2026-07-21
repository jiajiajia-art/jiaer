# Visual 编辑器 — 第 6 步「数据库」页面改造计划

> **版本**：v1.0（2026-07-09）  
> **状态**：已实现（Step 6 数据库 + dataPromptForms + 全量单测）  
> **范围**：`Interactive-fiction-frontend` + `Interactive-fiction-backend`  
> **关联**：[`Visual-世界书-morePrompt页面改造计划.md`](./Visual-世界书-morePrompt页面改造计划.md)、[`TXT-morePromptForms-选择性注入计划书.md`](./TXT-morePromptForms-选择性注入计划书.md)

---

## 1. 需求摘要

| 项 | 要求 |
|----|------|
| 主流程 | Visual 模式侧栏在 **Step 5 游戏系统** 下增加 **Step 6 数据库** |
| 布局 | 与 Step 5 相同：左条目列表 + 右编辑表单 |
| 表单字段 | 关键词、始终生效、内容、描述（含 tips、校验、未保存离开拦截） |
| 数据字段 | **`world.json` → `worldSetting.dataPromptForms`**（独立数组，不与 `morePromptForms` 混用） |
| 模式 | 仅 `visual` 展示；`worldInteraction` 不展示（与 Step 5 一致） |
| 运行时 | 关键词命中或「始终生效」后注入叙事 LLM，独立段落 **`## 游戏数据库`** |

---

## 2. 命名约定

| 层级 | Step 5 游戏系统 | Step 6 数据库 |
|------|-----------------|---------------|
| world.json 字段 | `morePromptForms` | **`dataPromptForms`** |
| 条目类型 | `MorePromptForm` | `DataPromptForm`（同结构） |
| 主面板 id | `worldBook` | `gameDatabase` |
| 子面板前缀 | `morePrompt:new` / `morePrompt:{id}` | **`dataPrompt:new` / `dataPrompt:{id}`** |
| 侧栏 i18n | `sidebar.worldBook` | `sidebar.gameDatabase` |
| 页头 i18n | `createGame.worldBook.*` | `createGame.gameDatabase.*` |
| 表单 i18n | `createGame.morePrompt.*` | **`createGame.dataPrompt.*`** |

---

## 3. 目标交互

### 3.1 侧栏（6 步）

```
1 文档解析
2 世界观表单
3 角色档案
4 场景 / BGM
5 游戏系统        ← morePromptForms
6 数据库          ← dataPromptForms
```

顶部 `step1Tip` 追加：`→ Step 6 数据库（数据条目）`

### 3.2 主内容区

```
┌─────────────────────────────────────────────────────────┐
│  数据库（页头：标题 + sectionSubtitle 说明）               │
├──────────────┬──────────────────────────────────────────┤
│ 左：条目菜单  │ 右：编辑表单（字段同 Step 5）              │
│ 条目 A       │  [关键词] [始终生效] [内容] [描述] …       │
│ 条目 B       │                                          │
│ [+ 数据条目]  │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### 3.3 `activePanel` 路由

| `activePanel` | 侧栏高亮 | 主内容区 |
|---------------|----------|----------|
| `gameDatabase` | Step 6 | 数据库布局；右侧空状态 |
| `dataPrompt:new` | Step 6 | 数据库 + 新建表单 |
| `dataPrompt:{id}` | Step 6 | 数据库 + 编辑该条 |

Step 5 保持不变：`worldBook` / `morePrompt:*`

```ts
isGameDatabaseActive(panel) =>
  panel === 'gameDatabase' || panel.startsWith('dataPrompt:')
```

### 3.4 进入 Step 6 默认行为

| 场景 | 行为 |
|------|------|
| 有条目，点击 Step 6 | 自动打开第一条 `dataPrompt:{firstId}` |
| 无条目 | 右侧空状态，引导点「+ 数据条目」 |
| Step 5 ↔ Step 6 切换 | 两侧表单均执行 `checkBeforeLeave` |

---

## 4. 数据模型

```ts
interface DataPromptForm {
  id: string;
  title: string;        // 关键词（逗号分隔）或侧栏展示名
  description: string;  // 列表副标题，≤15 字
  content: string;      // Markdown 正文
  constant?: boolean;   // 始终生效
  order: number;
  enabled?: boolean;
  updatedAt?: string;
}
```

约束（与 `morePromptForms` 一致）：

- 最多 10 条
- 描述 ≤ 15 Unicode 字符
- 标题 ≤ 80 字符
- 非「始终生效」时至少 1 个关键词
- 内容、描述必填

---

## 5. 运行时注入

叙事 system prompt 拼接顺序：

```
… 基础设定 …
## 创作者补充设定   ← morePromptForms 命中条目
## 游戏数据库       ← dataPromptForms 命中条目
… moreFormText（env）…
```

触发规则与 Step 5 相同：`selectActiveDataPromptForms` 扫描本轮输入 + 最近 8 条对话 + sessionSummary。

---

## 6. 实现清单

### 6.1 前端

| 文件 | 说明 |
|------|------|
| `src/utils/dataPromptForms.ts` | 校验、panel 解析 |
| `src/utils/dataPromptPanel.ts` | Step 6 路由 |
| `src/hooks/editor/useDataPromptForms.ts` | PUT `dataPromptForms` |
| `src/components/.../Database/DatabasePanel.tsx` | 复合页 |
| `MorePromptFormPanel.tsx` | 增加 `variant: 'morePrompt' \| 'dataPrompt'` |
| `MorePromptNavSection.tsx` | 增加 `variant` + 可配置 panel 工具 |
| `Sidebar.tsx` | Step 6 nav |
| `GameSettingsEditor.tsx` | 双 hook、双 ref、路由 |
| `EditorData.type.ts` | `dataPromptForms?` |
| `zh.json` / `en.json` | i18n |

### 6.2 后端

| 文件 | 说明 |
|------|------|
| `services/visual/dataPromptForms.js` | 校验 + 选择性注入 |
| `interface/handlers/visual/editRoutes.js` | PUT 校验 |
| `services/visual/gameLogic.js` | 注入 + `worldRequiredKeys` |
| `cf/migrations/2026-07-08-more-prompt-forms-v2-selective.sql` | D1 registry（含 dataPromptForms） |
| `cf/d1-schema.sql` | seed 同步 |

### 6.3 测试

| 脚本 | 覆盖 |
|------|------|
| `scripts/dataPromptForms.check.mjs` | 前端校验、panel id |
| `scripts/dataPromptPanel.check.mjs` | Step 6 路由 |
| `checks/dataPromptForms.check.mjs` | 后端校验、注入、putEditWorld |

---

## 7. 验收标准

1. Step 1 未完成时 Step 6 disabled  
2. 保存 `dataPromptForms` 后刷新仍可见  
3. Step 5 / Step 6 数据互不串写  
4. 叙事 LLM：关键词命中时注入 `## 游戏数据库` 段落  
5. `pnpm test:dataPromptForms && pnpm test:dataPromptPanel` 通过  
6. `npm run test:dataPromptForms` 通过  

---

## 8. 分期（本期一次交付）

| 阶段 | 内容 |
|------|------|
| P0 | UI + CRUD + PUT 持久化 |
| P1 | 叙事 LLM 注入 + 全量单测 |

**不在本期**：一句话生成自动写 `dataPromptForms`（可后续 Step 5/6 扩展）。

---

## 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-07-09 | v1.0 | 初稿；字段名定为 `dataPromptForms` |
