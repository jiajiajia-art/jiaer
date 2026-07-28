# TXT 模式自由度改版 — 计划书

> **版本**：v0.2（2026-07-28）  
> **状态**：开发中（P0–P3 骨架已落地；P4 私聊 UI / P5 系统编辑待续）  
> **范围**：**Galgame TXT 游玩侧**（进局前向导 + 局内角色/属性/系统/私聊）  
> **默认拍板（开工假设）**：§3.1 方案 **C**；Q1 卡库需登录；Q2 私聊与小手机同引擎；Q3 系统改动下一轮生效；Q4 可有快速开始但故事线仍必选；Q5 自设/动态属性分区  
> **实现说明（文件清单 / API / 单测）**：[`TXT模式自由度改版-实现说明.md`](./TXT模式自由度改版-实现说明.md)

---

## 1. 目标与边界

### 1.1 目标（一句话）

让玩家在 **进局前** 自定义人设/世界书/文风并选择开局路线，在 **局内** 可编辑角色档案、维护账号级玩家角色卡、与 NPC 私聊（记忆隔离），从而提升自由度与复玩价值。

### 1.2 本期范围（In）

| 模块 | PRD 对应 | UE 图 |
|------|----------|-------|
| A. 角色卡二改（局内 CRUD + 详情可编辑） | §（一）1 | `img_v3_0213t_7100f3d1-....png` |
| B. 私聊（脱离主线、记忆隔离） | §（一）1 + §（一）5 小手机 | 同上 UE 屏⑤；小手机为同能力增强壳 |
| C. 玩家自设人设 + 多角色卡（**账号云同步**） | §（一）2 | `image 3.png` |
| D. 开局向导（人设 / 世界书 / 文风 / 故事线 → 确认进局） | §（一）2 开局段 | `image 5.png` |
| E. 系统列表可编辑（世界书 / 文风 / 定位 / 路线） | §（一）3 | `img_v3_0213t_72203a2f-....png` |

### 1.3 明确不做 / 后置（Out / Later）

| 项 | 说明 | 建议阶段 |
|----|------|----------|
| 地图可交互换点 + 花积分 | §（一）4 | Phase 6+ |
| 任务回合数强制收尾 | §（二）1 | 独立计划 |
| 属性检定驱动任务 | §（二）2 | 独立计划（PRD 未定方案） |
| 选择性提示词 n 选 1（关系定位） | §（三）1 | 可与开局故事线合并设计，二期 |
| 酒馆级文风预设全量（隐藏长提示词） | §（四） | Phase 5 做玩家可见开关；长提示词库二期 |
| 立绘尺寸统一 | §（五） | 视觉专项 |
| 「剧情展开中」文案 | §（六） | **已落地**，本计划不重复 |
| AVG / MapGalgame / 世界互动游玩页 | — | 本期不做 |
| 玩家改动回写创作者 preset | — | 默认只影响本局 session |

---

## 2. 已确认决策

| 项 | 决定 | 来源 | 确认时间 |
|----|------|------|----------|
| 玩家多角色卡存储 | **挂用户账号云端持久化**；换设备同账号保留；换账号不共享 | 用户 | 2026-07-27 |
| 「导入角色卡」含义 | 从**当前账号卡库**选卡 → 预览 → **覆盖当前局玩家档案**（非本机文件为主路径） | 用户 + UE | 2026-07-27 |
| UE 图可读性 | 附件目录本机可读，计划以 UE 为准 | 工程确认 | 2026-07-27 |
| 引擎范围 | **Galgame TXT**（`Galgame.tsx` 及开局入口） | 与四面板计划对齐 | 建议确认 |
| 局内改 NPC | 只影响后续 LLM 上下文，**不回写已发生 narrative step** | 建议默认 | **待确认** |
| 新增 NPC 出场态 | 进档案列表，标记未出场；叙事提及后再记 encountered | 建议默认 | **待确认** |
| 开局故事线 vs 创作台 storyline | 见 §3 | — | **待确认** |

---

## 3. 待确认决策（开工前拍板）

### 3.1 开局「故事线」与创作台 `storyline[]` 的关系

**问题**：创作台故事线是「全程节奏约束」；玩法侧是「选一条开局路线」。选中后本局 prompt 里放什么？

| 方案 | 行为 | 推荐度 |
|------|------|--------|
| **A. 裁剪** | 本局只注入选中的一条（+ 对应开场白） | 与「选线」心智最一致 |
| **B. 加权保留** | 全量保留，标「当前开场=选中项」 | 适合作者多阶段大纲 |
| **C. 开场+后续** | 选中项=开场；其余=后续阶段约束 | 最贴创作台「分阶段」 |

**建议默认：C**（若创作台无多阶段结构则退化为 A）。

> 说明：这不是「要不要做选线」，而是「选完以后喂给 AI 的集合怎么裁」。产品未选前，实现应把「开局路线」与「创作台 storyline」做成**两套字段**（`openingRoute` vs `storylines`），避免 UI 选 A、模型仍按 B/C 演。

### 3.2 其它待确认

| # | 问题 | 选项 |
|---|------|------|
| Q1 | 未登录用户能否进局 / 建卡？ | 登录后才能管卡库；局内临时编辑可允许但不进卡库 |
| Q2 | 私聊与「小手机」是否同一会话通道？ | 建议同一 PrivateChat 引擎，小手机为列表壳 |
| Q3 | 系统面板改世界书/文风是否立即进下一轮 prompt？ | 建议保存即生效（下一轮叙事） |
| Q4 | 开局向导是否覆盖「从创作台一键开玩」？ | 建议：有完整 preset 时可「快速开始」跳过选填项，故事线仍必选（若 preset 仅一条则自动选中） |
| Q5 | 属性：玩家自设数值 vs LLM 动态属性面板 | 建议分区展示，避免互相覆盖（见 §5.2） |

---

## 4. 需求摘要（对照 UE）

### 4.1 角色模块（UE：角色档案）

```text
角色列表 → 详情（可编辑）→ 私聊
     └→ +添加角色 → 必填表单 →（可选）补充档案 → 保存
```

| 界面 | 要点 |
|------|------|
| 列表 | 标题「角色档案」；右上「+ 添加角色」（手写注：可扩展导入已有角色）；卡片简介；可进详情；可有私聊捷径 |
| 添加/编辑表单（必填） | 姓名*、性别*（男/女/其他/未知）、关系*≤20、简介*≤200、对你的态度*≤100 |
| 补充档案（选填） | 详细简介≤500、重要程度（重要/次要/路人）、存活（存活/死亡/未知） |
| 详情 | 关系、简介、人设（可编辑）、态度 + 好感进度条；底栏「私聊」 |
| 私聊 | 独立对话；长按：重新生成 / 再说一遍；输入中态；**不推进主线** |

### 4.2 属性 / 我的档案（UE：属性模块）

```text
属性总览（我的档案 + 属性数值）
  ├→ 编辑档案（姓名/性别/人设）→ 保存回总览
  └→ 导入角色卡 → 账号卡库列表 → 预览覆盖 → 确认回总览
```

| 界面 | 要点 |
|------|------|
| 我的档案 | 姓名、性别、人设；按钮：编辑档案、导入角色卡 |
| 属性数值 | 如 容貌/才艺/心机（示例）；导入时可预览新数值（UE 绿色） |
| 卡库 | 搜索/筛选；选卡后确认「将覆盖当前玩家档案」 |

### 4.3 开局向导（UE：创建角色流程）

```text
创建角色首页（姓名* 性别* + 四入口）
  ├ 人设设定（可选）：身份 / 性格 / 经历 / 目标
  ├ 世界书设定（可选）：导入或手编
  ├ 文风设定（可选）：风格 chips、节奏、避雷词
  └ 故事线选择（必填）→ 开场白确认 → 正式进局
「开始冒险」：故事线未选则 disabled
```

### 4.4 系统列表（UE：系统模块）

| 入口 | 能力 |
|------|------|
| 世界书 | 列表启停；新增/编辑（标题/内容/触发词/常驻/状态）；导入 JSON |
| 文风设定 | 预设开关、节奏、避雷词库增删 |
| 玩家目前定位 | 身份 + 立场可编辑 |
| 目前选择路线 | 展示当前路线/阶段；可改路线（确认框） |

---

## 5. 现状与 Gap

| 能力 | 现状 | Gap |
|------|------|-----|
| 角色面板 | `CharactersPanel` 只读列表+详情 | 无添加/编辑/好感条/私聊 |
| 创作台角色 | `GameSettingEditor/CharactersPanel` 重编辑器 | **勿整页复用**；抽字段校验与表单 primitives |
| 出场累计 | `encounteredCharacters.ts` | 需扩展字段映射 + 玩家自建 NPC |
| 属性面板 | LLM SSE 数值卡（`AttributesPanel`） | 无「我的档案」、无账号卡库导入 |
| 开局 | `StoryIntroModal`（标题+initialPlot+开始） | 缺四步向导与故事线确认 |
| 世界书/文风 | 创作台 + 局内系统面板只读展示（四面板） | 局内可编辑、开局可配置 |
| 私聊 / 小手机 | 无 | 全新会话通道 + 记忆隔离 |
| 玩家角色卡 API | 无 | 需 D1/用户表 + CRUD |

---

## 6. 数据模型草案

### 6.1 局内 NPC 档案扩展（session / world 侧）

```ts
type PlayerEditableNpc = {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  relationship: string;       // ≤20
  summary: string;            // ≤200 简介
  attitudeToPlayer: string;   // ≤100
  detailedBio?: string;       // ≤500
  importance?: 'major' | 'minor' | 'extra';
  survival?: 'alive' | 'dead' | 'unknown';
  favorability?: number;      // 0–100
  personalityTags?: string[]; // 人设标签
  source: 'preset' | 'player_created';
  encountered: boolean;
};
```

- 保存后写入 **本局 session 世界快照**，并注入后续叙事 prompt 片段。
- **不**默认回写创作者发布包。

### 6.2 账号级玩家角色卡（云端）

```ts
type PlayerCharacterCard = {
  id: string;
  userId: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  persona: string;            // 通用描述：年龄/喜好/外貌等
  attributes: Record<string, number>; // 如 { 容貌: 50, 才艺: 50, 心机: 50 }
  createdAt: string;
  updatedAt: string;
};
```

**API 草案**（路径名可按现有路由风格调整）：

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/.../player-character-cards` | 当前用户卡列表（支持 q 搜索） |
| POST | `/api/.../player-character-cards` | 新建 |
| PUT | `/api/.../player-character-cards/:id` | 更新 |
| DELETE | `/api/.../player-character-cards/:id` | 删除 |
| POST | `/api/.../sessions/:id/import-player-card` | 将卡导入本局（覆盖 session 玩家档案） |

鉴权：必须登录；仅能操作 `userId === 当前用户`。

### 6.3 开局配置包（进 session 前）

```ts
type GameStartConfig = {
  player: {
    name: string;
    gender: 'male' | 'female' | 'other';
    personaBlocks?: {
      identity?: string;
      traits?: string;
      background?: string;
      goal?: string;
    };
    /** 可选：从卡库带入的属性 */
    attributes?: Record<string, number>;
  };
  worldBookEntries?: WorldBookEntry[];
  writingStyle?: {
    toggles: string[];
    pace: 'slow' | 'medium' | 'fast';
    avoidWords: string[];
  };
  /** 玩法侧开局路线（与创作台 storylines 解耦） */
  openingRouteId: string;
  openingMonologue?: string;
};
```

### 6.4 私聊会话

```ts
type PrivateChatThread = {
  sessionId: string;   // 所属游玩局（便于权限）
  npcId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; createdAt: string }>;
  /** 与主线 narrative history 隔离 */
};
```

---

## 7. 分阶段实施计划

```text
P0 契约/表结构/鉴权
 → P1 角色档案 CRUD（局内）
 → P2 玩家档案 + 账号卡库
 → P3 开局向导（故事线必填）
 → P4 私聊 MVP
 → P5 系统面板可编辑（世界书/文风/定位/路线）
 → P6 小手机壳 + 主动打招呼等增强（可选）
 → P7 i18n / 全量单测 / 打磨
```

预估总工期：**10–14 周**（视后端人力与 §3 拍板速度）。

### Phase 0 — 契约与存储（约 1 周）

| 交付 | 说明 |
|------|------|
| Schema | `player_character_cards` 表（D1）；session 内 NPC/player 扩展字段 |
| API stub | 卡 CRUD + 局内角色 PATCH + 开局 config 写入 session |
| 前端 types | `lib/galgame/playerCharacterCard.ts`、`characterProfile.ts`、`gameStartConfig.ts` |
| 单测 | 校验字数、覆盖导入合并逻辑、未登录 401 |

### Phase 1 — 角色档案二改（约 2–3 周）

| 任务 | 路径（预期） |
|------|----------------|
| 列表 + 添加入口 | `src/components/Galgame/panels/CharactersPanel.tsx` |
| 表单抽屉 | 新建 `CharacterProfileForm.tsx` |
| 详情可编辑 + 好感条 | 同面板 detail 态 |
| 保存写 session | 后端 visual/session character update |
| 校验单测 | 必填、字数上下限 |

**验收**：进局可见 preset 角色 → 编辑态度/简介 → 下轮叙事可感知变化；新增角色出现在列表。

### Phase 2 — 我的档案 + 账号卡库（约 2 周）

| 任务 | 说明 |
|------|------|
| 属性面板顶部「我的档案」 | 姓名/性别/人设 + 编辑弹窗 |
| 卡库列表 / 新建 / 编辑 | 需登录；云端 CRUD |
| 导入预览确认 | 覆盖 session 玩家；属性预览 |
| 与 LLM 属性卡分区 | 「自设属性」vs「动态面板」文案区分（Q5） |

**验收**：账号 A 建卡 → 换设备登录仍可见 → 导入覆盖当前局档案。

### Phase 3 — 开局向导（约 3 周）

| 任务 | 说明 |
|------|------|
| `GameStartWizard` 替换/增强 `StoryIntroModal` | 首页 gate：故事线必填 |
| 子页：人设 / 世界书 / 文风 / 故事线列表 | 复用创作台逻辑 primitives，勿整页拷贝 |
| 开场白确认页 | 左开场白、右路线摘要；确认进局 |
| `createSession` 注入 `GameStartConfig` | 与 §3.1 方案对齐 |

**验收**：未选故事线无法开始；确认后开场白与所选路线一致。

### Phase 4 — 私聊 MVP（约 2–3 周）

| 任务 | 说明 |
|------|------|
| 私聊 UI | 气泡、输入中、长按重新生成/再说一遍 |
| API | 独立 endpoint；上下文=角色卡+少量世界摘要；**不写主线 step** |
| 锁策略 | 与叙事 LLM 锁协调（排队或明确失败 Toast） |

**验收**：私聊多轮不影响主线进度；主线继续后私聊历史仍在。

### Phase 5 — 系统列表可编辑（约 2 周）

对齐系统 UE：世界书 CRUD/导入、文风开关+避雷词、玩家定位、当前路线展示/修改。  
与 P3 开局配置**共用组件与 schema**，避免两套世界书。

### Phase 6 — 小手机与增强（可选，约 1–2 周）

- 底栏/入口「小手机」：会话列表壳，底层仍 PrivateChat  
- 久未对话主动打招呼（服务端定时或进局检查）  
- 地图换点+积分（若排期则另开计划书）

### Phase 7 — 质量收口

- i18n（zh/en）  
- 前端 `pnpm test` / 后端相关单测全绿  
- 手测清单（§9）

---

## 8. 前端 / 后端改动清单（预期）

### 8.1 前端（`Interactive-fiction-frontend`）

| 区域 | 文件（现有或新建） |
|------|-------------------|
| 游玩壳 | `src/page/Galgame.tsx`、`useGalgameController.ts` |
| 角色 | `panels/CharactersPanel.tsx`、`CharacterProfileForm.tsx`（新） |
| 属性/档案 | `panels/AttributesPanel.tsx`、玩家档案组件（新） |
| 系统 | `panels/SystemsPanel.tsx` 及子编辑页（新） |
| 开局 | `StoryIntroModal.tsx` → `GameStartWizard/*`（新） |
| 私聊 | `PrivateChat/*`（新） |
| 卡库 API | `src/api/.../playerCharacterCards.ts`（新） |
| 纯逻辑 | `lib/galgame/characterProfile.ts`、`playerCharacterCard.ts`、`gameStartConfig.ts`、`privateChatGate.ts`（新） |
| 单测 | 与上列同目录 `*.test.ts` |

### 8.2 后端（`Interactive-fiction-backend`）

| 区域 | 说明 |
|------|------|
| D1 migration | `player_character_cards`；必要时 session JSON 扩展文档化 |
| Handlers | 卡 CRUD；session 角色 PATCH；私聊 stream；开局 config 合并进 session |
| Prompt 组装 | 注入玩家档案、可编辑 NPC、世界书启停、文风/避雷、openingRoute |
| 锁 | 私聊 vs 叙事 vs 属性面板：避免互相误报「正在生成」 |

---

## 9. 测试与验收

### 9.1 单测（强制，与实现同迭代）

- 表单校验：必填、字数边界、非法性别  
- 导入覆盖：字段合并 / 空卡 / 无权限  
- 开局 gate：未选故事线不可提交；已选可提交  
- 私聊隔离：消息不进入 narrative history 序列化器  
- 云端卡：仅本人可见（handler 层 mock 鉴权）

### 9.2 手测清单

1. 预设角色进局 → 改态度 → 下一轮对白变化（体感）  
2. 添加 NPC → 出现在列表 → 可再编辑  
3. 登录建 2 张玩家卡 → 另一浏览器同账号可见  
4. 导入卡覆盖当前局 → 属性总览一致  
5. 开局选故事线 → 确认页开场白正确 → 进局  
6. 私聊 5 轮 → 主线选项仍可推进 → 私聊历史保留  
7. 系统面板改世界书启停 → 下一轮生效  

### 9.3 交付门槛

- 有逻辑必有测；收尾前跑全量前端测试（及本计划触及的后端测试）  
- 禁止仅用「请刷新看看」代替测试通过  

---

## 10. 风险与依赖

| 风险 | 缓解 |
|------|------|
| 「故事线」一词歧义导致选线无效 | §3.1 先拍板；字段拆分 `openingRoute` / `storylines` |
| 局内改角色与创作台字段不一致 | 以玩法表单字段为准做适配层，不硬绑 2500 行编辑器 |
| 私聊抢叙事锁 | 独立锁键或队列；前端 Toast 明确原因 |
| LLM 属性覆盖玩家自设数值 | UI/存储分区；导入写「自设层」，SSE 写「动态层」 |
| 卡库无迁移路径 | 一期直接云端；不做 localStorage 主存，避免双源 |

---

## 11. 推荐排期表（可演示里程碑）

| Sprint | 交付 | 可演示 |
|--------|------|--------|
| S1 | P0 + P1 表单（可先 mock 持久化） | 角色添加/编辑 UX |
| S2 | P1 真持久化 + P2 档案/卡库 | 账号卡导入覆盖 |
| S3 | P3 开局向导 MVP（故事线+确认） | 选线进局 |
| S4 | P4 私聊 MVP + P5 世界书启停 | 局内自由度闭环 |
| S5 | P5 文风/定位/路线 + P7 收口 | 对齐系统 UE |
| S6+ | P6 小手机 / 地图积分等 | 增强体验 |

---

## 12. 文档与附件索引

| 资源 | 路径 |
|------|------|
| 产品稿 | `Downloads/TXT模式改版20260623/TXT模式改版20260623.md` |
| 角色 UE | `图片和附件/img_v3_0213t_7100f3d1-d362-41d7-b8fe-9ebaa06460ag.png` |
| 属性/卡库 UE | `图片和附件/image 3.png` |
| 开局 UE | `图片和附件/image 5.png` |
| 系统 UE | `图片和附件/img_v3_0213t_72203a2f-8cc2-4c47-b866-959967f2814g.png` |
| 四面板基线 | `docs/Galgame-游玩界面四面板-计划书.md` |

---

## 13. 下一步（请产品确认后改状态为「可开发」）

1. 确认 §3.1 故事线方案（建议 **C**）及 §3.2 Q1–Q5  
2. 确认引擎范围是否 **仅 Galgame TXT**  
3. 确认是否将「小手机」并入 P4 还是 P6  
4. 确认后开 P0：migration + API 契约 + 前端 types  

确认结果请回填到 **§2 已确认决策** 表，版本升为 v0.2。
