# Visual 编辑器 — 第 5 步「世界书」页面改造计划

> **版本**：v0.1（2026-07-09）  
> **状态**：已实现（Step 5 世界书 + 左右分栏）  
> **范围**：仅 `Interactive-fiction-frontend` 前端交互；**API / 校验 / 运行时注入逻辑不变**  
> **关联**：[`TXT-morePromptForms-选择性注入计划书.md`](./TXT-morePromptForms-选择性注入计划书.md)、[`AI一句话生成-补充提示词规划.md`](./AI一句话生成-补充提示词规划.md)

---

## 1. 需求摘要（产品原话对齐）

| 项 | 要求 |
|----|------|
| 主流程 | 在 **Step 4 场景** 下增加 **Step 5「世界书」** |
| 点击世界书 | 右侧出现 **morePrompt 工作区**（表单形式与现有一致） |
| 布局 | **左侧**：条目菜单（即现在主侧栏里的补充提示词列表）；**右侧**：对应编辑内容 |
| 「+ 补充提示词」 | 从 **主侧栏底部** 挪到 **世界书页左侧菜单最下方** |
| 业务逻辑 | `morePromptForms` 数据结构、保存 API、校验、叙事注入 **不改** |

---

## 2. 现状（改造前）

### 2.1 主侧栏（`Sidebar.tsx`）

Visual 模式固定 **4 步** + 底部动态区块：

```
1 文档解析
2 世界观表单
3 角色档案
4 场景 / BGM
─────────────
  [条目1] 关键词…
  [条目2] …
  [+ 补充提示词]   ← MorePromptNavSection
```

### 2.2 主内容区（`GameSettingsEditor.tsx`）

- `activePanel === 'documents' | 'world' | 'characters' | 'scenes'` → 各 Step 面板
- `isMorePromptPanel(activePanel)` → 整页显示 `MorePromptFormPanel`（无内层左右分栏）

### 2.3 不变部分（本计划不碰）

| 模块 | 路径 |
|------|------|
| Hook / 保存 | `useMorePromptForms.ts`、`handleMorePromptSave/Cancel/Delete` |
| 表单 | `MorePromptFormPanel.tsx`、`MarkdownContentField.tsx` |
| 工具 | `morePromptForms.ts`（`morePrompt:new`、`morePrompt:{id}`） |
| 后端 | `PUT /api/visual/edit/:fileId/world`、`morePromptForms.js` |

---

## 3. 目标交互（改造后）

### 3.1 主侧栏（仅 5 个固定 Step）

```
1 文档解析
2 世界观表单
3 角色档案
4 场景 / BGM
5 世界书          ← 新增，点击进入 morePrompt 工作区
```

主侧栏 **不再** 渲染 `MorePromptNavSection`。

### 3.2 世界书工作区（主内容区内的复合页面）

点击 Step 5 后，右侧 **整块** 为「世界书」布局：

```
┌─────────────────────────────────────────────────────────┐
│  世界书（页头：标题 + 现有 sectionSubtitle 说明）          │
├──────────────┬──────────────────────────────────────────┤
│ 左：条目菜单  │ 右：MorePromptFormPanel（与现表单一致）    │
│              │                                          │
│ 5·关键词A    │  [关键词] [始终生效] [内容] [描述] …       │
│   副标题     │                                          │
│ 6·关键词B    │                                          │
│   副标题     │                                          │
│  …           │                                          │
│              │                                          │
│ [+ 补充提示词]│                                          │
└──────────────┴──────────────────────────────────────────┘
```

- 左侧菜单样式 **复用** 现有 `MorePromptNavSection` / `Sidebar.navBtn` 视觉，宽度约 240～280px。
- 右侧 **直接复用** `MorePromptFormPanel`，字段、tips、校验、未保存离开逻辑不变。

### 3.3 `activePanel` 路由约定

| `activePanel` | 主侧栏高亮 | 主内容区显示 |
|---------------|------------|--------------|
| `documents` … `scenes` | 对应 Step 1～4 | 原面板 |
| `worldBook` | Step 5 世界书 | 世界书布局；右侧可为空状态 |
| `morePrompt:new` | Step 5 世界书 | 世界书布局 + 新建表单 |
| `morePrompt:{id}` | Step 5 世界书 | 世界书布局 + 编辑该条 |

**主侧栏 Step 5 高亮条件**：

```ts
activePanel === 'worldBook' || isMorePromptPanel(activePanel)
```

### 3.4 进入世界书时的默认右侧

| 场景 | 建议行为 |
|------|----------|
| 已有条目，点击 Step 5 | 自动选中 **第一条**（`morePrompt:{firstId}`），避免右侧空白 |
| 无条目，点击 Step 5 | 右侧显示 **空状态**（文案 + 引导点左侧「+ 补充提示词」） |
| 从 Step 4 切到 Step 5 | 同上 |

（实现时可在 `handlePanelChange('worldBook')` 内做分支，逻辑集中在一处。）

---

## 4. 组件拆分方案

### 4.1 新增

| 文件 | 职责 |
|------|------|
| `WorldBook/WorldBookPanel.tsx` | 世界书复合页：左菜单 + 右表单/空状态 |
| `WorldBook/WorldBookPanel.module.css` | 左右分栏、页头、空状态 |
| `WorldBook/WorldBookEmptyState.tsx` | 可选：无条目时的右侧占位 |

### 4.2 迁移 / 复用

| 现有文件 | 调整 |
|----------|------|
| `MorePromptNavSection.tsx` | 从 `Sidebar` 挪到 `WorldBookPanel` 左侧；`numberOffset` 固定为 **5**（或 5 + index） |
| `MorePromptFormPanel.tsx` | **不改业务**，仅作为 `WorldBookPanel` 子组件 |
| `Sidebar.tsx` | 增加 `worldBook` nav；删除 `MorePromptNavSection` 引用 |

### 4.3 编排层

`GameSettingsEditor.tsx`：

- 删除：`isMorePromptPanel` 时单独占一整块 `section.panel` 的写法
- 新增：`activePanel === 'worldBook' || isMorePromptPanel(activePanel)` 时渲染 `<WorldBookPanel />`
- `Sidebar` 不再传 `morePromptForms` / `onMorePromptDelete`（改由 `WorldBookPanel` 接收）

---

## 5. 详细改动清单

### 5.1 `Sidebar.tsx`

- [x] `modeConfigs.visual` 增加 `{ id: 'worldBook', i18nKey: 'worldBook' }`
- [x] 移除 `MorePromptNavSection` 及 props：`morePromptForms`、`canAddMorePrompt`、`onMorePromptDelete`
- [x] `getItemStatus`：当 `isWorldBookActive(activePanel)` 时，Step 5 显示 `active`
- [x] 移动端进度：`1 / 5` … `5 / 5`

### 5.2 `GameSettingsEditor.tsx`

- [x] `handlePanelChange`：`worldBook` → `resolveWorldBookTargetPanel`
- [x] 离开 morePrompt 未保存检查保留
- [x] 用 `<WorldBookPanel>` 替换原独立 `morePromptForms` section

### 5.3 `WorldBookPanel.tsx`（新）

- [x] 左侧：`<MorePromptNavSection layout="worldBook" … />`
- [x] 右侧：表单 / 空状态

### 5.4 i18n（`zh.json` / `en.json`）

- [x] `sidebar.worldBook*`、`createGame.worldBook.*`
- [x] `step1Tip` 增加 Step 5

### 5.5 样式

- [x] `WorldBookPanel` 左右分栏；`MorePromptNavSection.sectionWorldBook` 纵向列表

### 5.6 工具函数

- [x] `src/utils/worldBookPanel.ts` + `scripts/worldBookPanel.check.mjs`

---

## 6. 行为保持不变的对照表

| 行为 | 改造后 |
|------|--------|
| 保存 `morePromptForms` 到 `world.json` | 不变 |
| 最多 10 条、描述 ≤15 字、关键词校验 | 不变 |
| 新建 `morePrompt:new`、编辑 `morePrompt:{id}` | 不变 |
| 删除确认弹窗 | 不变，仍在左侧菜单项上 |
| 未保存离开拦截 | 不变，`MorePromptFormPanelRef.checkBeforeLeave` |
| 一句话生成写入的条目 | 不变，进入世界书即可见 |
| worldInteraction 模式 | 仍 **不展示** 世界书 Step（与现 morePrompt 一致） |

---

## 7. 测试计划（前端）

> 业务逻辑未改，以 **交互路由 + 组件渲染** 单测为主；`morePromptForms` 校验测保持原 `pnpm test:morePromptForms`。

### 7.1 新增 `src/utils/worldBookPanel.test.ts`（或 `scripts/worldBookPanel.check.mjs`）

| 用例 | 期望 |
|------|------|
| `isWorldBookActive('worldBook')` | true |
| `isWorldBookActive('morePrompt:uuid')` | true |
| `isWorldBookActive('scenes')` | false |
| 点击 worldBook 且无条目 | 应解析为展示空状态（纯函数：resolveWorldBookRightPanel） |

### 7.2 手动验收清单

1. Step 1 未完成时，Step 5 与世界书内按钮均为 disabled  
2. 主侧栏仅 5 步，底部无「+ 补充提示词」  
3. 点击 Step 5 → 左侧见条目列表 + 底部「+」  
4. 点击条目 → 右侧表单与改造前一致（含 tips）  
5. 新建 / 保存 / 取消 / 删除 → 与改造前一致  
6. 有条目时从 Step 4 切到 Step 5 → 右侧有内容  
7. 编辑中切到 Step 2 → 弹出未保存提示  
8. 移动端：Step 5 可进入，布局不严重错位  

---

## 8. 分期与工作量（估算）

| 阶段 | 内容 | 估时 |
|------|------|------|
| **P1** | Sidebar 五步 + WorldBookPanel 骨架 + 路由 | 0.5～1d |
| **P2** | 迁移 MorePromptNavSection、空状态、i18n | 0.5d |
| **P3** | 未保存离开 / 默认选中第一条 / 移动端样式 | 0.5d |
| **P4** | 单测 + 文档更新 | 0.25d |

**合计**：约 **1.5～2 个工作日**（仅前端）。

---

## 9. 风险与注意点

| 风险 | 对策 |
|------|------|
| `activePanel` 深链接 / 刷新后落在 `morePrompt:id` 但侧栏未高亮 Step 5 | `getItemStatus` 用 `isWorldBookActive` |
| 序号从「5、6、7…」变为世界书内列表，产品是否还要全局 Step 号 | 左侧条目可 **去掉** 主流程序号，仅显示 title + description |
| 文档 / 截图仍写「侧栏底部 +」 | 同步更新 `Visual-morePromptForms-计划书.md` 侧栏描述 |

---

## 10. 文件索引（实施时）

| 类型 | 路径 |
|------|------|
| 主侧栏 | `src/components/GameSettingEditor/Sidebar.tsx` |
| 编排 | `src/page/GameSettingsEditor.tsx` |
| 待新建 | `src/components/GameSettingEditor/WorldBook/WorldBookPanel.tsx` |
| 左菜单复用 | `src/components/GameSettingEditor/MorePromptForms/MorePromptNavSection.tsx` |
| 右表单复用 | `src/components/GameSettingEditor/MorePromptForms/MorePromptFormPanel.tsx` |
| 路由工具 | `src/utils/morePromptForms.ts` |
| 文案 | `src/i18n/locales/zh.json`、`en.json` |

---

## 11. 变更记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-07-09 | v1.0 | 已实现：Step5 世界书、WorldBookPanel、worldBookPanel 单测 |
| 2026-07-09 | v0.1 | 初稿 |
