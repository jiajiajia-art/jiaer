# 社交页「推荐关注」列表 — 最终可实施计划

> **范围锁定**：账号社交页「推荐」Tab 下的**用户列表**（推荐「可能感兴趣的人」），对齐前端 `/account/.../social?tab=recommend`（名称以 FE 路由为准）。  
> **不改**：首页游戏「推荐」混排（`sort=recommended`）、互关 / 关注 / 粉丝列表主逻辑、作品推荐配置表主公式。  
> **可复用**：`user_follow` / `user_block`、游玩时长事件、用户偏好 / 行为标签画像、公开用户卡片字段。  
> **前置依赖**：账号社交 v1 / v1.1 / v1.2（关注、屏蔽、互关列表）已落地或并行可用。

**文档版本**：v1.0  
**最后更新**：2026-10-12  
**风格参照**：前端仓库 `docs/首页推荐改造-计划书.md`；关联 `账号社交.md` 附录 A/B、`推荐关注屏蔽融合-计划书.md`（首页作品侧）

---

## 0. 目标与成功标准

| 目标 | 验收 |
|------|------|
| **三路召回** | 登录且非「新用户」时，推荐列表由三路混合：常玩作者 / 感兴趣标签热门 / 关注的人也关注 |
| **配比** | 默认一页 **10** 人时，约 **3 : 4 : 3**（常玩 : 标签热门 : 关注关系） |
| **可解释理由** | 每条带 `reasonType` + `reasonText`，前端可直接展示（无需再猜） |
| **已关注顺延** | 「常玩作者」按停留时长排序；若 Top1～3 已关注，则自动取第 4、5、6… 直到凑满本路配额 |
| **新用户不推** | 满足「新用户」定义时返回空列表（或约定空态），**不**灌冷启动热门凑数（本版） |
| **社交过滤** | 排除自己、已关注、双向屏蔽、已注销；与账号社交屏蔽规则一致 |
| **隐私开关** | 尊重 `people_suggest_in` / `people_suggest_out`（见 §2.7；与隐私设置页对齐） |
| **不误用文案** | 第 3 路文案为「关注的人也关注…」，**不是**「N 个共同好友」 |

**产品说明文案（前端信息图标可引用）**：

> 基于下列信息，向你推荐可能感兴趣的人：  
> 1. 你常玩的游戏作者（按停留时长）  
> 2. 你感兴趣标签下的热门用户  
> 3. 你关注的人也关注的用户  
> 我们会根据你的停留时长、浏览行为、关注关系和公开信息进行推荐。

> **本版不做帖子作者**：文案若写「常看的帖子作者」，后端无帖子模型；v1 仅实现「常玩游戏作者」。帖子作为后续扩展。

---

## 1. 现状锚点（改哪里）

### 1.1 数据流（目标）

```
社交页「推荐」Tab
  → GET /api/account/recommend/users?limit=10
    → userRecommendFollowService.getRecommendUsers(viewerId)
        1) 判定是否新用户 → 是则空列表
        2) 三路并行召回（各超采后过滤）
        3) 按 3:4:3 配额混排 + 去重
        4) 批量补 user 卡片 + isFollowing / isFollowedBy
        5) 返回 list + reason*
```

### 1.2 与现有能力对照

| 能力 | 现状 | 本计划 |
|------|------|--------|
| 首页作品推荐 | `gameRecommendFeedService`：时长→**标签**→推作品 | **不直接复用**混排；可复用时长事件与 tag 画像 |
| 关注 / 屏蔽 | `user_follow` / `user_block` | 过滤 + 第 3 路 FoF 召回 |
| 互关列表 | `GET .../mutual` | 不改；推荐 Tab 独立接口 |
| 收藏 | `user_game_favorites` | **本版不作为召回路**（可后续加） |
| 帖子 / 主页停留 | **无** | 本版不做 |

### 1.3 关键文件（拟）

| 层 | 文件 | 动作 |
|----|------|------|
| BE Service | `services/d1/userRecommendFollowService.js` | **新建**：三路召回 + 混排 |
| BE Handler | `interface/handlers/account/accountHandlers.js`（或拆 `accountRecommend.js`） | 新 handler |
| BE Routes | `interface/routes/account.js` | 注册 `GET /api/account/recommend/users`（**固定路径，在 `:userCode` 前**） |
| 复用 | `userFollowService` / `userBlockService` / `userRecommendProfileService` / analytics | 读关系与画像 |
| FE | 社交页 Recommend Tab | 调新接口；展示 reason；关注按钮复用社交列表 |
| 单测 | `checks/userRecommendFollow.check.mjs` | 配比、顺延、过滤、新用户空 |

### 1.4 与其它模块

| 模块 | 是否纳入 | 说明 |
|------|----------|------|
| 社交「推荐」用户 Tab | **是** | 本计划唯一新增面 |
| 关注 / 粉丝 / 互关 Tab | 否 | 已有接口 |
| 首页游戏「推荐」 | 否 | 另见千人千面 / 关注屏蔽融合计划 |
| 关闭单条推荐（点 X） | **本版可选/不做** | 见 §2.6；需要时另开任务 |

---

## 2. 产品规则（定稿）

### 2.0 一句话

> 登录老用户打开「推荐关注」：按 **3:4:3** 混合「常玩作者 / 标签热门用户 / 关注的人也关注」；每条带理由；已关注与屏蔽不出现；新用户暂不推荐。

### 2.1 三路召回定义

#### 2.1.1 路 A — 常玩作者（文案类似「你常看的人」）

| 项 | 规则 |
|----|------|
| 信号 | `user_analytics_events`：`event_type = game_session_duration`，对 `duration_seconds` 求和 |
| 聚合 | `game_file_id` → `games.creator_user_id`，按创作者汇总时长 |
| 窗口 | 默认近 **90** 天（可配置，对齐行为画像 `behavior_lookback_days`） |
| 排序 | 总停留时长 **DESC** |
| 已关注顺延 | 按序扫描；**跳过已关注**（及自己 / 屏蔽 / 注销）；取够本路配额（默认 3）为止；若时长榜更后仍有合格者则继续（即「前 3 已关则推 4、5、6…」） |
| 帖子作者 | **本版不做** |
| `reasonType` | `frequent_play` |
| `reasonText` 例 | `你常玩的作者` |

```
候选 = GROUP BY creator_user_id ORDER BY SUM(duration_seconds) DESC
for creator in 候选:
  if 不合格(已关注/屏蔽/自己/注销) → skip
  else → 收入路 A，直到满额
```

#### 2.1.2 路 B — 感兴趣标签热门用户（文案类似「你可能感兴趣的人」）

| 项 | 规则 |
|----|------|
| 用户标签来源 | 优先 `resolveUserRecommendTags`（搜索画像 / 行为画像 / 手动偏好，与首页同源读取） |
| 热门定义（定稿建议） | 标签下公开作品（`is_public=1`，排除 `document.docx`）按创作者聚合；热度分可用近窗 `like_count` 或作品数+点赞加权（实现时写死一版公式，见 §3） |
| 排除 | 自己、已关注、屏蔽、注销；与路 A 去重时后者让位规则见 §2.3 |
| `reasonType` | `preferred_tag_hot` |
| `reasonText` 例 | `古风内容热门作者`（带上主标签名）；无具体标签时用 `你可能感兴趣的人` |

#### 2.1.3 路 C — 关注的人也关注（FoF，**不是**共同好友）

| 项 | 规则 |
|----|------|
| 定义 | 存在 `我 → A` 且 `A → B`，推荐 **B**（我尚未关注 B） |
| 排序建议 | 被多少个「我关注的人」关注（共同出度）DESC，其次可按 B 粉丝数 / 近活跃 |
| 排除 | B = 我；我已关注 B；双向屏蔽；注销；A 本人不必出现在结果里 |
| `reasonType` | `follow_of_follow` |
| `reasonText` 例 | `你关注的人也关注了 TA`；若方便可带 `共同关注来源数`（可选字段 `fofCount`） |

> **禁止**把本路文案写成「N 个共同好友」。共同好友若以后要做，另开一路 `common_friend`。

### 2.2 混排配额（定稿）

默认 `limit = 10`：

| 路 | 目标条数 | 比例 |
|----|----------|------|
| A 常玩作者 | **3** | 3/10 |
| B 标签热门 | **4** | 4/10 |
| C 关注的人也关注 | **3** | 3/10 |

**缺额补齐（定稿）**：

```
1) 各路先按规则召回（建议每路超采 2～3 倍再过滤）
2) 按 A→B→C 顺序填入目标槽，全局 userId 去重（先占槽的保留）
3) 某路不足时：空位按 B → C → A 顺序用其它路剩余候选补齐
4) 全部凑不满 limit：返回实际条数，不强行用「全站热门」灌水（本版）
```

展示顺序建议（单页）：

```
交错或分段均可；定稿采用「分段」：先 A 段（最多 3）→ B 段（最多 4）→ C 段（最多 3），
缺额补齐插入对应段末，避免同理由扎堆时可在实现期改为轻度交错（非阻塞）。
```

> 实现默认：**分段 3+4+3**；若产品要更像信息流交错，FE/BE 联调时再改 mix 函数即可。

### 2.3 去重与优先级

同一 `userId` 被多路命中时：

| 优先级（高→低） | 保留理由 |
|----------------|----------|
| 1 | `frequent_play`（常玩） |
| 2 | `follow_of_follow`（关注关系） |
| 3 | `preferred_tag_hot`（标签热门） |

只保留一条，占用**最高优先级那一路的配额槽**（或占用首次填入的槽——定稿：**按优先级重标 reason，槽位仍算在最终展示顺序中的位置**）。

### 2.4 新用户（定稿）

**新用户 = 暂不推荐**，返回：

```json
{ "success": true, "data": { "total": 0, "limit": 10, "list": [], "emptyReason": "new_user" } }
```

**新用户判定（定稿，可配置）** — 满足**任一**即视为新用户：

| 条件 | 默认阈值 | 说明 |
|------|----------|------|
| 注册时间过近 | `createTime` 距今 &lt; **3** 天 | 可配置 |
| 有效游玩过少 | 近 90 天 `game_session_duration` 去重作品数 &lt; **1** | 与常玩路同窗 |
| 无关注且无偏好标签 | `followingCount = 0` 且推荐标签向量为空 | 三路都难产出时 |

> 与「三路都空但非新用户」区分：后者 `emptyReason = "no_candidates"`。

### 2.5 全局过滤（每路必做）

从候选中剔除：

- `viewer` 自己  
- 已关注（`follower=viewer, followee=peer`）  
- 双向屏蔽（复用 `getRelatedBlockedUserIds` / `getBlockFlags`）  
- `deletedAt` 非空 / 账号注销  
- 候选 `people_suggest_out = 0`（见 §2.7；无 privacy 行当开启）  
- （可选）无公开作品的纯空号 —— **本版建议过滤「0 个 is_public=1 作品」的创作者**，避免推无可逛主页  

另：若 viewer `people_suggest_in = 0`（**默认即关**；无 privacy 行也当关），整表不召回，直接空列表（§2.7）。

### 2.6 明确不做（本版）

| 项 | 原因 |
|----|------|
| 共同好友召回 | 与 FoF 不同；产品已纠正 |
| 帖子作者 / 主页停留 | 无数据 |
| 近期收藏召回 | 本版产品未列入三路 |
| 复用首页 `getRecommendedFeed` 整段 | 推的是作品不是人 |
| 点 X 关闭推荐 + 负反馈表 | 可 P1 |
| 未登录推荐 | 与账号社交「接口需登录」一致 |
| profile 上展示推荐入口配置后台 | 非必须 |

### 2.7 与隐私设置页对齐（跨文档定稿）

> **关联：** 前端仓库 `.cursor/doc/account-social-backend-v1.md` 附录 C（列表可发现 / 屏蔽名单）；  
> 隐私页 UI：「推荐可能认识的人给我」「把我推荐给可能认识的人」。  
> **本计划书负责**这两项开关的库表字段、privacy API 扩展，以及推荐召回时的读写语义。  
> 附录 C **不**再扩这两列，避免双源。

#### 2.7.1 `user_privacy` 扩列（本计划书范围）

命名对齐账号社交约定：D1 = `snake_case`，JSON = `camelCase`。

```sql
-- 可与 list_discoverable 同迁或分迁；列名勿用 camelCase
ALTER TABLE user_privacy ADD COLUMN people_suggest_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_privacy ADD COLUMN people_suggest_out INTEGER NOT NULL DEFAULT 1;
```

| DB 列 | JSON | 默认 | 隐私页文案 | 语义 |
|-------|------|------|------------|------|
| `people_suggest_in` | `peopleSuggestIn` | **0（关）** | 推荐可能认识的人给我 | 是否允许系统向**我**下发推荐关注列表 |
| `people_suggest_out` | `peopleSuggestOut` | **1（开）** | 把我推荐给可能认识的人 | 是否允许把**我**放进别人的推荐候选 |

读写：仍走既有 `GET|PATCH /api/account/privacy`（与 `followingListPublic` / `listDiscoverable` 同一响应体，部分更新）。  
无 privacy 行时：`people_suggest_in` 当 **0**，`people_suggest_out` 当 **1**。

> **拍板：** 「推荐给我」默认关，避免未主动打开就做推荐计算；用户在隐私设置打开后再推。  
> 「把我推荐出去」默认开，保证打开推荐的人仍能拉到候选池。

#### 2.7.2 推荐服务必须遵守

在 §2.5 全局过滤之外增加：

| 开关 | 生效点 |
|------|--------|
| viewer 的 `people_suggest_in = 0` | `GET /api/account/recommend/users` 直接返回空列表；建议 `emptyReason = "privacy_opt_out"`（前端可提示「已在隐私设置中关闭推荐」） |
| 候选 peer 的 `people_suggest_out = 0` | 三路召回均剔除该 peer（与已关注 / 屏蔽同级过滤）；无行当 `1` |

实现：读 viewer privacy 一次；对候选 `peerIds` 批量查 `people_suggest_out`（禁止 N+1）。

#### 2.7.3 前端

| 项 | 说明 |
|----|------|
| 隐私设置页两开关 | `PATCH /api/account/privacy` 写 `peopleSuggestIn` / `peopleSuggestOut`；去掉本地 session 占位 |
| 推荐 Tab | 遇 `emptyReason=privacy_opt_out` 展示关闭态，可链到 `/account/privacy` |
| 列表可发现 / 屏蔽名单 | 仍按账号社交附录 C；与本 § 无冲突 |

#### 2.7.4 实施任务增量

| # | 任务 | 落点 |
|---|------|------|
| S5b | privacy 扩两列 + `userPrivacyService` 映射 | migration + privacy service |
| S5c | 推荐过滤：`people_suggest_in` / `out` | `userRecommendFollowService` |
| F5 | 隐私页两开关接真 API；推荐空态 `privacy_opt_out` | FE |

---

## 3. 技术要点（实现备忘）

### 3.1 路 A SQL 示意

```sql
SELECT g.creator_user_id AS creatorId,
       SUM(COALESCE(e.duration_seconds, 0)) AS playSecs
  FROM user_analytics_events e
  INNER JOIN games g ON g.file_id = e.game_file_id
 WHERE e.user_id = ?
   AND e.event_type = 'game_session_duration'
   AND e.event_time >= ?
   AND e.game_file_id IS NOT NULL
   AND g.is_public = 1
   AND g.title != 'document.docx'
   AND g.creator_user_id IS NOT NULL
   AND g.creator_user_id != ?
 GROUP BY g.creator_user_id
 ORDER BY playSecs DESC
 LIMIT ?;   -- 超采，如 30
```

索引：`idx_uae_user_type_date` 已存在；单用户窗口聚合预期可接受（与行为画像同源）。

### 3.2 路 B 热度示意

```
对用户 TopK tag_ids：
  找公开作品带这些 tag 的 creator
  score(creator) = Σ like_count(公开作) 或 count(公开作)×w + likes×w
  ORDER BY score DESC，超采后过滤
```

### 3.3 路 C FoF 示意

```sql
-- 我关注的人 A 所关注的 B，按「多少个 A 指向 B」排序
SELECT f2.followeeUserId AS peerId, COUNT(*) AS fofCount
  FROM user_follow f1
  INNER JOIN user_follow f2 ON f2.followerUserId = f1.followeeUserId
 WHERE f1.followerUserId = :viewer
   AND f2.followeeUserId != :viewer
 GROUP BY f2.followeeUserId
 ORDER BY fofCount DESC
 LIMIT ?;
```

再在应用层剔已关注 / 屏蔽。关注很多时注意 `LIMIT` 与只取最近关注的 Top N 个 A（配置 `fof_seed_following_limit`，默认 50）。

### 3.4 配置键（建议，可放代码常量或小表）

| 键 | 默认 | 说明 |
|----|------|------|
| `urf_limit_default` | 10 | 默认条数 |
| `urf_quota_play` | 3 | 路 A |
| `urf_quota_tag` | 4 | 路 B |
| `urf_quota_fof` | 3 | 路 C |
| `urf_play_lookback_days` | 90 | 常玩窗口 |
| `urf_play_overfetch` | 30 | 路 A 超采 |
| `urf_new_user_account_days` | 3 | 注册天数阈值 |
| `urf_fof_seed_following_limit` | 50 | FoF 种子关注人数上限 |

---

## 4. 后端实施任务

| # | 任务 | 落点 |
|---|------|------|
| S0 | 新用户判定 | `userRecommendFollowService` |
| S1 | 路 A 常玩作者 + 已关注顺延 | analytics + games |
| S2 | 路 B 标签热门创作者 | profile tags + tag_map + games |
| S3 | 路 C FoF | `user_follow` |
| S4 | 3:4:3 混排 + 去重优先级 + 缺额补齐 | mix 纯函数便于单测 |
| S5 | 过滤：关注 / 屏蔽 / 注销 / 无公开作 | 复用现有 service |
| S6 | Handler + Route（固定路径） | `account.js` |
| S7 | checks | 配比、顺延、FoF 文案类型、新用户空、屏蔽 |

**工期预估**：约 **3～4 人日**（含单测与联调）。

---

## 5. 前端实施任务

| # | 任务 | 说明 |
|---|------|------|
| F0 | Recommend Tab 调 `GET /api/account/recommend/users` | 登录态 |
| F1 | 列表项展示头像 / 昵称 / `reasonText` / 关注按钮 | 按钮逻辑可复用 `isFollowing`+`isFollowedBy` |
| F2 | 信息图标展示产品说明文案 | §0 |
| F3 | 空态：`new_user` / `no_candidates` | 文案区分 |
| F4 | （可选）点 X 关闭 | 依赖 P1 负反馈接口 |

---

## 6. 接口契约

### 6.1 推荐用户列表（新增）

```http
GET /api/account/recommend/users?limit=10
Authorization: 必填（与其它 /api/account/* 一致）
```

| Query | 默认 | 说明 |
|-------|------|------|
| `limit` | 10 | 上限建议 30；本版混排按 10 的 3:4:3 设计，非 10 时按比例取整（见实现） |

**Response `data`：**

```json
{
  "total": 10,
  "limit": 10,
  "emptyReason": null,
  "list": [
    {
      "userCode": "9481142783",
      "nickname": "昵称",
      "avatarUrl": "interactive-fiction-game-avatar/...",
      "bio": "",
      "isFollowing": false,
      "isFollowedBy": false,
      "reasonType": "frequent_play",
      "reasonText": "你常玩的作者",
      "fofCount": null
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `emptyReason` | `null` \| `new_user` \| `no_candidates` \| `privacy_opt_out`（viewer 关闭「推荐给我」） |
| `reasonType` | `frequent_play` \| `preferred_tag_hot` \| `follow_of_follow` |
| `reasonText` | 展示用文案 |
| `fofCount` | 仅 FoF 可选：多少个「我关注的人」也关注了 TA |
| `isFollowing` / `isFollowedBy` | 相对 viewer；推荐列表中 `isFollowing` 应为 `false`（已过滤） |

**错误**：未登录 `401`；其它 `500`。

### 6.2 限非 10 的配额

`limit ≠ 10` 时：

```
qA = round(limit * 0.3), qB = round(limit * 0.4), qC = limit - qA - qB
```

保证三者之和为 `limit`。

---

## 7. 排期

| 阶段 | 工期 | 交付 |
|------|------|------|
| P0 路 A + 过滤 + 空态 | 1 天 | 常玩作者可出数 |
| P0 路 B + 路 C | 1～1.5 天 | 三路候选 |
| P0 混排 3:4:3 + API | 0.5～1 天 | 接口可联调 |
| P0 单测 + 联调 | 0.5～1 天 | checks + FE Tab |
| P1（可选） | — | 关闭推荐；帖子作者；收藏路 |

**合计 P0**：约 **3～4 人日**。

### 建议开工顺序

1. 新用户判定 + 全局过滤工具函数  
2. 路 A（数据最贴「常看/常玩」）  
3. 路 B、路 C  
4. 混排与接口  
5. FE Tab + 验收  

---

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| 用户误以为是「共同好友」 | 文案强制 FoF；计划书与接口文档写死 |
| 帖子作者无法交付 | 本版范围写明只做游戏作者 |
| 常玩 Top 全是已关注 | 顺延规则；仍不足则该路缺额由 B/C 补 |
| FoF 关注很多人时 SQL 重 | `fof_seed_following_limit` + LIMIT 超采 |
| 标签热门与首页推荐「撞车感」 | 推的是人不是作品；reason 不同 |
| 新用户定义过严 / 过松 | 阈值可配置；联调时用抽样账号调 |

---

## 9. 验收清单（上线前）

- [ ] 老用户有游玩：列表中出现 `frequent_play`，且均为未关注作者  
- [ ] 常玩 Top3 已关注：出现的是时长榜更靠后的作者（顺延）  
- [ ] 有偏好/行为标签：出现 `preferred_tag_hot`  
- [ ] 有关注且关注对象也关注他人：出现 `follow_of_follow`，文案非「共同好友」  
- [ ] 默认 10 条时比例接近 3:4:3（允许缺额补齐导致略有偏差，但不得整页单一来源除非其它路为空）  
- [ ] 已关注 / 双向屏蔽 / 自己 / 注销不出现  
- [ ] `people_suggest_out=0` 的用户不出现在他人推荐列表  
- [ ] viewer `people_suggest_in=0`：`list=[]`，`emptyReason=privacy_opt_out`  
- [ ] 新用户：`list=[]`，`emptyReason=new_user`  
- [ ] 未登录：401  
- [ ] `checks/userRecommendFollow.check.mjs` 全绿  

---

## 10. 附录：用户感知举例

| 用户 | 行为 | 推荐观感（约 10 人） |
|------|------|----------------------|
| 甲 | 常玩李四、王五的作品；关注了赵六；爱古风 | ~3 个常玩作者（若李四已关则换成更后的）；~4 个古风热门作者；~3 个「赵六也关注的人」 |
| 乙 | 刚注册无游玩无关注 | 空列表，提示新用户暂不推荐 |
| 丙 | 只关注人、几乎不玩 | 路 A 弱/空；B 若有画像则有；C 有 FoF |

---

## 11. 一句话交付定义

社交页新增「推荐关注」用户列表：

> **三路召回（常玩作者 / 标签热门 / 关注的人也关注）按约 3:4:3 混合；带理由文案；新用户不推；尊重隐私页推荐开关（§2.7）；不复用首页作品推荐整条链路。**
