# TXT 模式自由度改版 — 实现说明（P0–P3）

> **版本**：v0.1（2026-07-28）  
> **对应计划**：[`TXT模式自由度改版-计划书.md`](./TXT模式自由度改版-计划书.md)  
> **状态**：P0–P3 骨架已落地；P4 私聊 UI / P5 系统编辑 / Prompt 注入待续  
> **默认拍板**：§3.1 方案 C；卡库需登录；自设属性与 LLM 动态属性分区

---

## 1. 已交付摘要

| 阶段 | 交付 | 说明 |
|------|------|------|
| **P0** | 契约 / 校验 / 存储 / API | 纯逻辑类型与校验；D1 账号卡表；卡 CRUD；局内档案 / 开局 config 写入 session |
| **P1** | 局内角色档案 CRUD | 列表 / 添加 / 编辑 / 好感条；只写本局 session，不回写创作者 preset |
| **P2** | 我的档案 + 卡库导入 | 属性面板顶部自设档案；登录后从账号卡库导入并覆盖本局玩家 |
| **P3** | 开局向导 gate | `GameStartWizard`：姓名/性别 + **故事线必选**；未选不可「开始冒险」 |

### 明确未做（后续）

- P4：私聊聊天气泡 / 流式 / 长按重生成（隔离闸门逻辑已有）
- P5：系统面板世界书 / 文风 / 定位 / 路线可编辑
- P6：小手机壳
- 叙事 Prompt 组装：把 `playerEditableNpcs` / `sessionPlayerProfile` / `gameStartConfig` 注入下一轮 LLM（session 字段已写入）

---

## 2. 前端文件清单

### 2.1 纯逻辑（有单测）

| 路径 | 职责 |
|------|------|
| `src/lib/galgame/characterProfile.ts` | 局内 NPC 档案校验、创建、合并、排序 |
| `src/lib/galgame/playerCharacterCard.ts` | 账号卡校验、导入覆盖、搜索、预览 diff |
| `src/lib/galgame/gameStartConfig.ts` | 开局包校验、故事线必选 gate、方案 C 路线裁剪 |
| `src/lib/galgame/privateChatGate.ts` | 私聊消息校验；剥离误入主线的私聊 step；锁冲突文案 |

### 2.2 API

| 路径 | 职责 |
|------|------|
| `src/api/galgame/playerCharacterCards.ts` | 卡 CRUD、导入本局、session NPC/玩家档案/开局 config |

### 2.3 UI

| 路径 | 职责 |
|------|------|
| `src/components/Galgame/panels/CharacterProfileForm.tsx` | 角色必填 + 补充档案表单 |
| `src/components/Galgame/panels/CharactersPanel.tsx` | 列表/详情/添加编辑；好感条 |
| `src/components/Galgame/panels/PlayerArchiveSection.tsx` | 「我的档案」+ 导入卡库 |
| `src/components/Galgame/panels/AttributesPanel.tsx` | 接入自设档案区（与动态属性分区） |
| `src/components/Galgame/GameStartWizard.tsx` | 开局向导（替换原 StoryIntro 进局路径） |
| `src/page/Galgame.tsx` | 挂载向导；确认后写 `game-start-config` 再开局 |

### 2.4 单测入口

```bash
cd Interactive-fiction-frontend
pnpm run test:txtFreedomRevamp
# → scripts/txtFreedomRevamp.check.mjs（16 例）
```

覆盖：必填/字数/性别、导入覆盖与无权限、开局未选线不可提交、方案 C retained 路线、私聊不进主线 history。

---

## 3. 后端文件清单

| 路径 | 职责 |
|------|------|
| `cf/migrations/2026-07-28-player-character-cards.sql` | `player_character_cards` 表 |
| `services/playerCharacterCards/playerCharacterCardLogic.js` | 卡校验、鉴权口径、导入合并 |
| `services/d1/playerCharacterCardService.js` | D1 CRUD（仅本人） |
| `services/visual/sessionCharacterProfiles.js` | session NPC upsert、玩家自设档案、开局 config 写入 |
| `interface/handlers/playerCharacterCards.js` | HTTP：卡 CRUD + 导入本局 |
| `interface/handlers/visual/sessionPlayerProfiles.js` | HTTP：局内 NPC / 玩家档案 / 开局 config |
| `interface/routes/playerCharacterCards.js` | 路由注册 |
| `interface/registry/index.js` | `registerPlayerCharacterCardRoutes` |

### 3.1 API 一览

| Method | Path | 鉴权 | 说明 |
|--------|------|------|------|
| GET | `/api/player-character-cards?q=` | 登录 | 当前用户卡列表（可搜索） |
| POST | `/api/player-character-cards` | 登录 | 新建卡 |
| PUT | `/api/player-character-cards/:id` | 登录 | 更新（仅本人） |
| DELETE | `/api/player-character-cards/:id` | 登录 | 删除（仅本人） |
| POST | `/api/visual/session/:sessionId/import-player-card` | 登录 | body:`{ cardId }` 覆盖本局玩家档案 |
| PUT | `/api/visual/session/:sessionId/npcs/:npcId` | 登录 | 局内可编辑 NPC upsert |
| PUT | `/api/visual/session/:sessionId/player-profile` | 登录 | 更新本局自设玩家档案 |
| PUT | `/api/visual/session/:sessionId/game-start-config` | 登录 | 写入开局配置包 |

未登录 → **401**；操作他人卡/会话 → **403**。

### 3.2 Session 扩展字段（不回写 preset）

| 字段 | 含义 |
|------|------|
| `state.playerEditableNpcs[]` | 局内可编辑 NPC 档案 |
| `state.sessionPlayerProfile` | 自设玩家档案（与 `attributePanels` 分区） |
| `state.gameStartConfig` | `openingRouteId` / `openingMonologue` / `retainedStorylineIds` / 文风与世界书可选 |

### 3.3 单测入口

```bash
cd Interactive-fiction-backend
pnpm run test:txtFreedomRevamp
# → checks/txtFreedomRevamp.check.mjs（9 例）
```

覆盖：卡校验、401/403、CRUD 仅本人、NPC 字数、upsert 不碰 history、自设/动态分区、开局未选线失败。

---

## 4. 本地 / 测试环境迁移

在部署根或本地 wrangler 对 D1 执行：

```bash
npx wrangler d1 execute interactive_fiction --local --config cf/wrangler.toml \
  --file cf/migrations/2026-07-28-player-character-cards.sql

# 远程测试库加 --remote（确认 database_id）
```

---

## 5. 手测建议（对齐计划书 §9.2 子集）

1. 进局 → 角色面板「+ 添加角色」→ 填必填项保存 → 列表出现（可标未出场）  
2. 编辑态度 / 好感 → 再打开仍保留（依赖 session 持久化）  
3. 登录 → 属性面板「导入角色卡」（卡库需先 POST 建卡）→ 确认覆盖姓名/人设  
4. 新开局：不选故事线时「开始冒险」禁用；选线后可进局  
5. （待 P4）私聊多轮后主线仍可推进  

---

## 6. 与计划书差异 / 已知缺口

| 项 | 说明 |
|----|------|
| 故事线路由源 | 向导暂用 `world.keyEvents[]` 映射为 `OpeningRouteOption`；无 keyEvents 时退化为单条 `default` |
| 私聊 | 详情页仅占位文案；`privateChatGate` 供后续 UI/序列化复用 |
| Prompt 感知 | 改档已进 session，**尚未**改 `sendActionStream` 等组装逻辑，体感「下一轮对白变化」需接注入后再验 |
| 系统面板 | 仍为只读 morePromptForms 展示 |

---

## 7. 推荐下一步

1. Prompt 注入：`openingRoute` + `sessionPlayerProfile` + `playerEditableNpcs`  
2. P4 私聊 MVP（独立 endpoint + 前端气泡）  
3. P5 系统列表可编辑（与开局世界书/文风共用 schema）  
4. 全量跑 `pnpm run test:galgamePlayPanels` + `test:txtFreedomRevamp` 防回归  
