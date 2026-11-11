# 首页「推荐」融合关注 / 屏蔽 — 可实施计划

> **范围锁定**：仅首页「推荐」列表（`sort=recommended` → `GET /api/auth/games/public/no-discount` 的混排链路）。  
> **不改**：「最热 / 最新」、轮播、题材预览条、排行榜；不改搜索画像 / 行为画像主公式；不新建首页列表 API。  
> **前置依赖**：`user_follow`（2026-10-09）、`user_block`（2026-10-10）已落地；千人千面推荐（commit `9b5d29a` 主路径）已上线。

**文档版本**：v1.0（产品已定：关注 +0.08 + 每页 0～2 关注位）  
**最后更新**：2026-10-10  
**父计划**：前端仓库 `docs/首页推荐改造-计划书.md`（千人千面 v1.1）

---

## 0. 目标与成功标准

| 目标 | 验收 |
|------|------|
| **屏蔽硬过滤** | 登录用户 A 屏蔽创作者 D 后，D 的公开作品在「推荐」中**完全不可见**（含 campaign / 关注注入槽） |
| **双向屏蔽** | A↔D 任一方屏蔽，对方作品均不进 A 的「推荐」 |
| **关注固定加分** | 关注作者作品在原 `rank_score` 上 **+0.08**（固定） |
| **关注占位** | 每页（默认 10 条）有 **0～2** 个「关注作者作品」注入位；有合格关注作则尽量填，没有则为 0 |
| **不抢主信号** | 有搜索/行为画像时，标签匹配仍主导其余位置；关注位最多占 2/10，不会整页变关注动态 |
| **未登录不变** | 未登录无关注/屏蔽逻辑，行为与现网一致 |
| **可配置** | `follow_boost` / `follow_inject_slots` 等走 `recommend_config` 或 `RECOMMEND_*`，不靠改代码发版 |

**产品口径（已定）**：

| 项 | 定稿 |
|----|------|
| 屏蔽 | **硬排除**（不做「降权」） |
| 关注加分 | **固定 +0.08** |
| 关注占位 | **每 10 条 0～2 个**关注作者作品位（`follow_inject_slots` 上限 = 2） |
| 计算时机 | 拉推荐时**实时**读关注/屏蔽关系并混排 |

---

## 1. 现状锚点（改哪里）

### 1.1 数据流（当前）

```
Home「推荐」
  → GET /api/auth/games/public/no-discount?sort=recommended
    → gamesService.getPublicGamesNoDiscount()
      → gameRecommendFeedService.getRecommendedFeed()
          1) resolveUserRecommendTags（搜索 80/20 或行为）
          2) loadCandidateGames（热门池 + 0 赞池，eligible 过滤）
          3) 算 rank_score = 0.7×personal + 0.2×quality + 0.1×freshness
          4) listActiveCampaignInjects（seeding/scaling，已排除自己作品）
          5) mixRecommendedPage（注入 1–2 槽 + 题材上限）
```

**缺口**：候选池 / 打分 / campaign 注入**均未**读取 `user_follow` / `user_block`；无关注占位。

### 1.2 改造后数据流（目标）

```
getRecommendedFeed(userId)
  1) 拉 following / blocked 集合（登录才有）
  2) 候选池：eligible + 剔除双向屏蔽作者
  3) base 打分（原公式）+ 关注作者 +0.08
  4) campaign 注入候选：剔除屏蔽作者
  5) 关注注入候选：关注作者作品（未屏蔽、合格、去重）
  6) mixRecommendedPage：
       - campaign 槽（现有 1～2）
       - 关注槽 0～2（本页有合格作才填）
       - 其余用 rank_score 填满 + 题材上限
```

### 1.3 关键文件

| 层 | 文件 | 现状 |
|----|------|------|
| 关注表 | `user_follow` | 已有；`userFollowService` |
| 屏蔽表 | `user_block` | 已有；`userBlockService`（注释已写「推荐过滤后续复用」） |
| 作品作者 | `games.creator_user_id` | 已有；campaign 已用于排除自己 |
| Feed | `services/d1/gameRecommendFeedService.js` | **主改点** |
| Campaign | `services/d1/gameRecommendCampaignService.js` → `listActiveCampaignInjects` | 注入前加屏蔽过滤 |
| 混排 | `services/d1/gameRecommendScoring.js` → `mixRecommendedPage` | 增加关注注入槽参数 |
| 配置 | `services/d1/gameRecommendConfig.js` | 追加 follow 相关键 |
| 前端 | Home 列表 | **可不改**（无新字段也可上线；可选 `recommend_reason`） |

### 1.4 与首页其它模块

| 模块 | 是否纳入 | 说明 |
|------|----------|------|
| 「推荐」混排 | **是** | 本计划唯一改造面 |
| 「最热 / 最新」 | 否 | 本版不强制屏蔽过滤（若产品要求全站一致，另开任务） |
| 关注列表 / 主页作品 | 否 | 已有社交接口，不复用推荐打分 |

---

## 2. 产品规则（定稿）

### 2.0 一句话

> 屏蔽 = 看不见；关注 = **总分固定 +0.08**，且每页（10 条）再留 **0～2 个关注作者作品位**；其余位置仍按标签 + 质量 + 新鲜度；全部在拉推荐时实时算。

### 2.1 屏蔽（硬规则，P0）

对登录用户 U：

```
blocked_authors(U) =
    { 我屏蔽的人 } ∪ { 屏蔽了我的人 }     # 双向
```

凡 `games.creator_user_id ∈ blocked_authors(U)`：

- 不进候选打分主列表
- 不进 campaign 注入槽
- 不进关注注入槽
- 不进 paused 兜底补齐
- **不因关注加分 / 占位「复活」**（屏蔽优先于关注）

未登录：跳过屏蔽逻辑。

**作者字段**：本版只用 `creator_user_id`。  
`source_author_user_id`（小说原作者）本版不处理，记入风险。

### 2.2 关注加分（软规则，P0）

#### 2.2.1 公式

```
base = 0.7 × personal + 0.2 × quality + 0.1 × freshness
     # 无画像时 base = 0.7 × quality + 0.3 × freshness（与现网一致）

follow_delta = (creator_user_id ∈ following(U)) ? 0.08 : 0

rank_score = clamp01(base + follow_delta)
```

`follow_boost` **固定默认 0.08**（配置可改，但产品定稿按 0.08 上线）。

#### 2.2.2 关注占位（已定）

每页 `limit`（首页默认 **10**）：

| 项 | 规则 |
|----|------|
| 上限 | **最多 2** 个关注作者作品位（`follow_inject_slots = 2`） |
| 下限 | **0**：没有合格关注作、未登录、或关注作都已被本页占用/过滤时，不强行凑数 |
| 候选条件 | `creator_user_id` 在关注列表；`eligible`；未屏蔽；公开；与本页其它条目去重 |
| 选谁优先 | 在关注候选中按 `rank_score`（已含 +0.08）降序取前 0～2 |
| `recommend_reason` | 建议标记 `follow_inject`（区别于 `follow_boost` 仅加分未占位） |

> 「0～2」指**实际上屏数量**随库存变化；配置上限固定为 2。

#### 2.2.3 与 campaign 注入的关系

| 槽位类型 | 每页 | 说明 |
|----------|------|------|
| campaign（新作/扶贫） | 现有约 1～2 | **只加屏蔽过滤**；逻辑独立 |
| 关注占位 | **0～2** | 产品已定；与 campaign **分开计数** |
| 常规召回 | 填满至 10 | 含已 +0.08 的关注作（未进关注槽的也可靠分数自然出现） |
| 题材上限 | 同页同题材最多 3 | 不变 |

混排建议顺序（单页）：

```
1) campaign 注入（若有）
2) 关注注入 0～2（若有）
3) 按 rank_score 填满剩余，去重 + 题材上限
```

若 campaign + 关注槽合计偏多，仍以 `limit=10` 截断；**优先保证去重后列表不空**。

#### 2.2.4 用户感知举例

| 用户 | 关系 | 「推荐」观感（约 10 条） |
|------|------|-------------------------|
| 甲 | 搜古风；关注李四；屏蔽张三 | 仍以古风为主；其中 **0～2 条**明确是李四等关注作者作品；张三**完全没有** |
| 乙 | 无关注无屏蔽 | 与现网一致（关注位 = 0） |
| 丙 | 关注 20 人 | 一页关注位仍 **最多 2**；其余靠分数，不会 20 个一起占满 |

### 2.3 明确不做（本版）

| 项 | 原因 |
|----|------|
| 用关注列表替换搜索/行为画像 | 关注 ≠ 题材偏好 |
| 「最热 / 最新」同步屏蔽 | 范围锁定；产品若要求全站再开任务 |
| 小说 `source_author_user_id` 联动 | 避免一次改太大 |
| 前端 UI 标识「因为你关注」 | 可选，非阻塞 |

---

## 3. 配置项（追加到 `RECOMMEND_DEFAULTS`）

| 键 | 默认 | 说明 |
|----|------|------|
| `follow_boost` | **0.08** | 关注作者额外加分（产品定稿固定该默认） |
| `follow_inject_slots` | **2** | 每页关注占位**上限**；实际 0～2 |
| `block_filter_enabled` | **1** | 紧急开关：关则无屏蔽过滤 |
| `follow_boost_enabled` | **1** | 紧急开关：关则不加 +0.08 |
| `follow_inject_enabled` | **1** | 紧急开关：关则无关注占位（仍可保留加分） |

读取优先级与现网一致：代码默认 ← `recommend_config` 表 ← env `RECOMMEND_*`。

---

## 4. 后端实施任务

| # | 任务 | 落点 |
|---|------|------|
| S0 | 配置默认值 | `gameRecommendConfig.js` |
| S1 | 批量拉关注集合 / 双向屏蔽集合 | 复用 `userFollowService` / `userBlockService`（避免 N+1） |
| S2 | 候选池 + 打分后过滤屏蔽作者 | `gameRecommendFeedService.js` |
| S3 | campaign 注入过滤屏蔽作者 | `listActiveCampaignInjects` 或 feed 侧二次过滤 |
| S4 | 关注作者 +0.08 | feed / scoring |
| S5 | 每页关注注入 0～2 | 扩展 `mixRecommendedPage` 或 feed 内混排 |
| S6 | `recommend_reason` | 如 `follow_boost@0.08` / `follow_inject` |
| S7 | 单测 | `checks/gameRecommendSocial.check.mjs`：屏蔽、双向、+0.08、关注位 0/1/2、屏蔽优先、与 campaign 去重 |

**工期预估**：P0（屏蔽 + 加分 + 关注占位）约 **2～3 人日**；含 checks。

---

## 5. 前端实施任务

| # | 任务 | 说明 |
|---|------|------|
| F0 | 无强依赖 | 列表接口不变即可生效 |
| F1 | （可选）开发态展示 `recommend_reason` | 便于 QA 区分加分 / 关注占位 |
| F2 | （可选）进游玩埋点 | 已有则不动 |

---

## 6. 接口契约（增量）

### 6.1 现有接口（行为变更，路径不变）

```http
GET /api/auth/games/public/no-discount?sort=recommended&limit=&offset=
Authorization: Bearer <token>   # 有 token 才应用关注/屏蔽
```

响应 `data[]` 可增（可选）：

```
recommend_reason?: string   # 例 "search_tag@0.80" / "follow_boost@0.08" / "follow_inject"
```

`sort=hot|latest` 本版不变。

### 6.2 无新接口

关注 / 屏蔽仍走账号社交已有 API；推荐侧只**读关系表**。

---

## 7. 排期

| 阶段 | 工期 | 交付 |
|------|------|------|
| **P0 屏蔽硬过滤** | 0.5～1 天 | 双向屏蔽从候选 + campaign + 关注槽 + 兜底全部剔除 |
| **P0 关注 +0.08** | 0.5 天 | 固定加分，开关可关 |
| **P0 关注占位 0～2** | 0.5～1 天 | 混排注入，无合格作则为 0 |
| **P0 单测** | 0.5 天 | social check 全绿 |
| **P1（可选）** | 0.5～1 天 | 小说原作者字段；最热/最新屏蔽对齐 |

**合计 P0**：约 **2～3 人日**。

### 建议开工顺序

1. 落地屏蔽过滤（安全底线）  
2. 落地关注 +0.08  
3. 落地关注占位 0～2 + 与 campaign 去重  
4. checks + 抽样账号验收  

---

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| 关注位 + campaign 位过多，题材兴趣被挤 | 关注位上限 2；列表仍 10 条截断；题材上限 3 保留 |
| `creator_user_id` 为空的老作品 | 无法关联关注/屏蔽 → 按无社交关系处理（不误杀） |
| 小说原作者 ≠ 发布者 | 本版只认 `creator_user_id`；文档写明 |
| 关注人数很多导致查询慢 | 一次拉 followee / blocked 集合，内存过滤 |
| 「最热」仍能看到屏蔽作者 | 产品已知范围；需全站一致时另开任务 |
| 无关注作品时占位为空 | 允许 0，不强行用非关注作凑「关注位」 |

---

## 9. 验收清单（上线前）

- [ ] A 屏蔽 D：A 的「推荐」无 D 的任何作品（含 campaign / 关注位）
- [ ] D 屏蔽 A：A 的「推荐」亦无 D 的作品
- [ ] A 关注 C：C 的作品 `rank_score` 含 **+0.08**
- [ ] A 关注多人且有合格作：同一页关注占位为 **1 或 2**（有货则尽量填，上限 2）
- [ ] A 无关注或关注作皆不合格：关注占位为 **0**，列表仍正常
- [ ] A 搜古风且关注赛博作者：关注位可能出现赛博作，但其余位置仍以古风为主
- [ ] 屏蔽作者即使被关注过：仍不出现（屏蔽优先）
- [ ] 未登录列表与现网一致、不报错
- [ ] `follow_inject_enabled=0` 时无关注占位；`follow_boost_enabled=0` 时无 +0.08
- [ ] `checks/gameRecommendSocial.check.mjs` 全绿

---

## 10. 附录：打分与占位示意

用户甲：搜索古风；关注李四；屏蔽张三。一页 10 条。

| 作品 | base | +0.08 | rank | 可能角色 |
|------|------|-------|------|----------|
| 古风热作（路人） | 0.76 | 0 | 0.76 | 常规位靠前 |
| 古风新作（李四） | 0.67 | 0.08 | 0.75 | **关注位**或常规高位 |
| 赛博作（李四） | 0.17 | 0.08 | 0.25 | 可能进 **关注位**（0～2 之一） |
| 古风作（张三） | — | — | — | **剔除** |

默认观感：约 8～10 条仍偏古风兴趣；其中最多 2 条是关注作者作品位；张三消失。

---

## 11. 一句话交付定义

首页「推荐」在现有千人千面之上增加：

> **双向屏蔽硬排除 + 关注作者固定 +0.08 + 每页 0～2 个关注作品占位**；拉推荐时实时计算；其它首页模块不动。
