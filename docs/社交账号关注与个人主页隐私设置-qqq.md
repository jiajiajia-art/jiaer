# 个人主页 / 关注体系 — 后端设计 v1

> 对齐前端：`/account/:userCode`、`/account/:userCode/social`  
> 仓储习惯：Cloudflare D1 + raw SQL；响应 `{ success, message?, data }`  
> 本版：**接口需登录**；`bio`/`bannerUrl` 在 `user`；列表可见性在 `user_privacy`（无行=默认公开）；关注列表游标+排序；Banner R2 路径对齐头像模式（方案 A）。

---

## 1. 目标能力

| 能力 | 说明 |
|------|------|
| 公开主页资料 | 按 `userCode` 取昵称、头像、简介、Banner、关注/粉丝数、相对当前用户是否已关注 |
| 编辑简介 | 仅本人 |
| 上传 / 清除 Banner | 仅本人；jpg/png/webp，≤ 5MB；服务端可压缩；读图走 Cloudflare 图片转换（参照头像） |
| 关注 / 取消关注 / 移除粉丝 | 对任意其他用户；幂等；取关与移除粉丝共用 `DELETE .../follow`，用 `action` 区分方向 |
| 关注列表 / 粉丝列表 | 默认他人可看（仅公开字段）；支持「最近 / 最早」+ 游标分页；受隐私开关约束 |
| 列表隐私设置 | 本人可分别设置「关注列表 / 粉丝列表」是否对他人可见；**未设置 = 全部可见**；本人始终可看自己的列表 |

本版不做：关键词搜索、特别关注、互粉标签、Redis 缓存、`follow_count`/`fan_count` 冗余列、匿名访问主页、更细粒度「仅好友可见」等。  
本版要做：游标分页、`sort`、关注/取关/移除粉丝、**列表可见性（独立表）**。

---

## 2. 数据库

### 2.1 `user` 表增量（仅展示资料）

```sql
-- cf/migrations/YYYY-MM-DD-user-account-profile.sql
ALTER TABLE user ADD COLUMN bio TEXT;
ALTER TABLE user ADD COLUMN bannerUrl TEXT;
```

| 列 | 类型 | 说明 |
|----|------|------|
| `bio` | TEXT NULL | 个人简介；空/NULL 表示未填写，前端用占位文案 |
| `bannerUrl` | TEXT NULL | R2 object key（写入约定见 §3）；NULL 前端灰底 |

约束（应用层）：

- `bio` trim 后长度 ≤ 120（可配置）；空串表示用户清空  
- `bannerUrl` 仅允许本系统 Banner 上传产生的 key 前缀  

### 2.2 新建 `user_privacy`（列表可见性）

```sql
CREATE TABLE IF NOT EXISTS user_privacy (
  userId TEXT PRIMARY KEY,
  followingListPublic INTEGER NOT NULL DEFAULT 1,
  followersListPublic INTEGER NOT NULL DEFAULT 1,
  updateTime TEXT
);
```

| 列 | 说明 |
|----|------|
| `userId` | 同 `user.userId` |
| `followingListPublic` | `1` 他人可见关注列表；`0` 仅自己 |
| `followersListPublic` | `1` 他人可见粉丝列表；`0` 仅自己 |
| `updateTime` | 最后修改时间 |

**默认公开约定：**

- **没有 `user_privacy` 行** → 两个列表都当公开  
- 有行时字段只接受 `0`/`1`；`PATCH` 可只改其中一项（upsert）  
- 读主页/鉴权列表：`LEFT JOIN user_privacy`，`NULL` 当 `1`

与 `user_recommend_profile`（推荐偏好）分离；后续通知/作品默认可见等设置可继续往本表加列。

### 2.3 新建 `user_follow`

```sql
CREATE TABLE IF NOT EXISTS user_follow (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  followerUserId TEXT NOT NULL,
  followeeUserId TEXT NOT NULL,
  createTime TEXT NOT NULL,
  UNIQUE (followerUserId, followeeUserId)
);

CREATE INDEX IF NOT EXISTS idx_user_follow_follower_time
  ON user_follow (followerUserId, createTime DESC);

CREATE INDEX IF NOT EXISTS idx_user_follow_followee_time
  ON user_follow (followeeUserId, createTime DESC);
```

| 列 | 说明 |
|----|------|
| `followerUserId` | 关注方 `user.userId` |
| `followeeUserId` | 被关注方 `user.userId` |
| `createTime` | ISO 或现有项目统一时间格式 |

规则：

- 禁止 `followerUserId = followeeUserId`
- 关注：插入；已存在 → 幂等成功
- 取消：删除；不存在 → 幂等成功
- 计数：`COUNT(*)`（中小体量够用；本版不加 `follow_count` / `fan_count` 冗余列）
- **只存单向边**：A 关注 B 只插一行 `(follower=A, followee=B)`；粉丝列表用反向 where，不要再插一条镜像行

### 2.4 列表查询实现要点（防 N+1 + 游标）

1. 先从 `user_follow` 按 `sort` + 游标条件取出一页（`LIMIT`；含 `id`、`createTime`、对端 `userId`）  
2. **一次** `WHERE userId IN (...)` 拉昵称/头像/简介  
3. 再批量查「当前登录用户对这些人是否已关注」填 `isFollowing`  
4. 禁止对每个 id 循环查 `user`  
5. 若本页条数 `< limit` → `nextCursor = null`（已到底）；否则用本页最后一条的 `(createTime, id)` 编码为 `nextCursor`

---

## 3. 存储与图片（Banner）— 方案 A（对齐头像）

**头像现状（对照）：**

- R2 key：`interactive-fiction-game-avatar/{userId}/{timestamp}_{sanitizedName}`
- 库字段 `avatarUrl` 存该 key
- 读图：`GET /interactive-fiction-game-avatar/:userId/:filename?`（可选 webp 转换）

**Banner 采用同一模式，仅换前缀：**

1. multipart 校验：`image/jpeg` | `image/png` | `image/webp`；大小 ≤ 5MB  
2. R2 key（已拍板）：

```text
interactive-fiction-game-banner/{userId}/{timestamp}_{sanitizedName}
```

3. 写库 `user.bannerUrl = objectKey`（与头像一样存 key，不存完整 https）  
4. 读图路由（建议）：

```text
GET /interactive-fiction-game-banner/:userId/:filename?
```

   转换逻辑仿照头像 handler（Cloudflare 图片转换；展示按主页 Banner 尺寸/16:9，不必照搬 150 小头像）  
5. 前端继续用 `getImageUrl(bannerUrl)` 拼 `HOST_ADDRESS`  

可选：`DELETE` 清 Banner 时只清库字段（R2 对象可异步 GC）。  
勿与运营首页 Banner（`/uploads/admin/banners/...`）混用。

---

## 4. 接口一览

统一：

- Header：现有登录态（与 `/api/auth/*` 一致）
- 未登录：`401` + `{ success: false, message }`
- 用户不存在 / 已注销：`404`
- 公开列表字段：`userCode, nickname, avatarUrl, bio, isFollowing, followedAt`（`bannerUrl` 仅在 profile 详情）

### 4.1 公开主页

`GET /api/account/:userCode/profile`

**Response `data`：**

```json
{
  "userCode": "9481142783",
  "nickname": "昵称",
  "avatarUrl": "interactive-fiction-game-avatar/...",
  "bio": "",
  "bannerUrl": null,
  "followingCount": 12,
  "followersCount": 34,
  "isFollowing": false,
  "isSelf": true,
  "followingListPublic": true,
  "followersListPublic": true,
  "canViewFollowingList": true,
  "canViewFollowersList": true
}
```

- `isSelf`：当前登录用户是否该主页主人  
- `isFollowing`：非本人时是否已关注主人；本人固定 `false`  
- `followingListPublic` / `followersListPublic`：主人自己的设置（布尔）  
- `canViewFollowingList` / `canViewFollowersList`：**相对当前访客**是否允许打开对应列表（本人恒为 `true`；他人则看主人开关）  

**计数与隐私：** 关闭列表可见后，**仍返回** `followingCount` / `followersCount`（与常见社交产品一致：数字可看、名单不可进）。前端根据 `canView*` 决定点击进列表还是提示「已设置不可见」。

实现要点：`getUserByUserCode` + `LEFT JOIN user_privacy` + 两次 `COUNT` + follow 存在性 + 算 `canView*`（无 privacy 行则公开）。

### 4.2 更新简介

`PATCH /api/account/bio`

```json
{ "bio": "一句话介绍" }
```

- 仅本人  
- 超长 / 非法字符 → `400`  
- 成功返回 `{ bio }`

### 4.3 上传 Banner

`POST /api/account/banner`  
`Content-Type: multipart/form-data`，字段名建议 `banner`

成功：

```json
{ "success": true, "data": { "bannerUrl": "interactive-fiction-game-banner/..." } }
```

### 4.4 清除 Banner

`DELETE /api/account/banner`  
→ `bannerUrl = NULL`

### 4.4.1 列表隐私设置（本人）

`GET /api/account/privacy`

```json
{
  "followingListPublic": true,
  "followersListPublic": true
}
```

`PATCH /api/account/privacy`

```json
{
  "followingListPublic": false,
  "followersListPublic": true
}
```

- 仅本人；字段均可选，只更新传入的键（对 `user_privacy` upsert）  
- **GET 无行时**：返回两个 `true`（默认公开），不必先插行  
- 成功返回完整当前设置  

### 4.5 关注 / 取消关注 / 移除粉丝

`POST /api/account/:userCode/follow`  
→ 我关注 `:userCode`（插入 `follower=我, followee=对方`）

`DELETE /api/account/:userCode/follow?action=unfollow|removeFollower`

| `action` | 含义 | 删除的边 |
|----------|------|----------|
| `unfollow`（默认，可省略） | 取消关注 | `follower=我 → followee=对方` |
| `removeFollower` | 移除粉丝 | `follower=对方 → followee=我` |

规则：

- 目标为自己 → `400`  
- `action` 非法 → `400`  
- **幂等**：边已不存在时 DELETE 仍 `success: true`；已关注再 POST 仍 `success: true`（不重复计数）  
- `removeFollower`：必须确认对方确实是我的粉丝边；鉴权始终以当前登录用户为「我」，禁止代操作  
- 互关时：`unfollow` 与 `removeFollower` 删的是**不同**的两行，互不影响  
- 可选 `data: { followingCount, followersCount, isFollowing }`（`isFollowing` = 操作后「我是否仍关注对方」；移除粉丝不改变该值，除非同时互关且另做了取关）

前端约定：

- 关注列表点「已关注」→ 取消：`action=unfollow`（或默认）  
- 粉丝列表点「移除」→ `action=removeFollower`  

### 4.6 关注列表 / 粉丝列表（游标分页）

交互约定：进入列表先拉一屏（建议 `limit=10`），用户下拉再带上页的 `nextCursor` 继续拉，直到 `nextCursor == null`。

`GET /api/account/:userCode/following?limit=10&sort=recent`  
`GET /api/account/:userCode/following?limit=10&sort=recent&cursor={nextCursor}`  
粉丝列表同理：`.../followers`

| Query | 说明 |
|-------|------|
| `limit` | 默认 **10**，上限建议 50 |
| `sort` | `recent`（默认）=`createTime DESC, id DESC`；`earliest`=`createTime ASC, id ASC` |
| `cursor` | 可选；首页不传；加载更多时传上一次响应的 `nextCursor`（不透明字符串，前端勿解析） |

非法 `sort` → 当 `recent`。切换「最近 / 最早」时**清空列表并重请求**（不带旧 `cursor`），避免游标与排序不一致。

**游标内容（服务端编码，建议）：** `createTime` + `user_follow.id`（可用 base64url / 简单拼接）。  
**下一页条件示例（`sort=recent`）：**

```sql
-- 关注列表
WHERE followerUserId = :ownerUserId
  AND (
    createTime < :cursorTime
    OR (createTime = :cursorTime AND id < :cursorId)
  )
ORDER BY createTime DESC, id DESC
LIMIT :limit
```

`sort=earliest` 时比较符与 `ORDER BY` 方向对称反过来。粉丝列表把 `followerUserId` 换成 `followeeUserId`。

**Response `data`：**

```json
{
  "total": 86,
  "limit": 10,
  "sort": "recent",
  "nextCursor": "eyJ0IjoiMjAyNi0xMC0wMVQxMjowMDowMC4wMDBaIiwiaSI6MTIzfQ",
  "list": [
    {
      "userCode": "...",
      "nickname": "...",
      "avatarUrl": "...",
      "bio": "...",
      "isFollowing": true,
      "followedAt": "2026-10-01T12:00:00.000Z"
    }
  ]
}
```

- `total`：可选，用 `COUNT(*)` 一次算出，供「我的关注 N 人」文案；与游标无关  
- `nextCursor`：还有下一页时返回；已到底为 `null`  
- **不要**再使用 `offset`  
- `isFollowing` / `followedAt` 含义同前  

**隐私鉴权（列表接口必做）：**

1. 解析路径 `:userCode` → 列表主人  
2. 若当前用户是主人 → 放行  
3. 若请求 following 且主人 privacy 明确为关（`followingListPublic = 0`）→ `403`  
   `{ success: false, code: 'FOLLOWING_LIST_PRIVATE', message: '该用户已隐藏关注列表' }`  
4. 若请求 followers 且主人 privacy 明确为关 → `403`  
   `{ success: false, code: 'FOLLOWERS_LIST_PRIVATE', message: '该用户已隐藏粉丝列表' }`  
5. **无 `user_privacy` 行或字段为公开** → 放行  

前端应先看 profile 的 `canView*`，避免无谓请求；后端仍必须强校验。

---

## 5. 对照「关注最简通用方案」——我们要什么

| 通用建议 | 本项目（中小 + D1） |
|----------|-------------------|
| 一张单向 follow 表 + UNIQUE | **要**：即 `user_follow` |
| 关注/粉丝 = where 方向相反 | **要** |
| `(follower)` / `(followee)` 侧索引 | **要**：`(followerUserId, createTime)`、`(followeeUserId, createTime)` |
| 先取 id 再批量查 user，禁止 N+1 | **要** |
| 关注/取关幂等 | **要** |
| 列表按时间排序 + 分页 | **要**：`sort` + **游标**（下拉加载） |
| 用户表冗余 follow_count / fan_count | **本版不要**：主页/列表 `total` 用 `COUNT(*)` |
| Redis ZSet 缓存关系 | **不要** |
| 游标分页 | **本版要做** |
| 互粉判定 | **本版不要** |
| 删用户清理 follow | **建议做** |
| 列表隐私开关 | **本版要做**：独立表 `user_privacy`（无行=默认公开） |

一句话：资料在 `user`，隐私在 `user_privacy`，关注单表 + 游标；Banner 路径对齐头像（换前缀）；不加 Redis、不加计数字段。

---

## 6. 后端落点建议（实现时）

| 层 | 建议 |
|----|------|
| Migration | `user` 加 bio/bannerUrl；建 `user_privacy`、`user_follow` |
| Schema 快照 | 同步 `cf/d1-schema.sql` |
| Service | `userFollowService.js`；`userPrivacyService.js`；`userService` 增 bio/banner |
| Routes | `interface/routes/account.js`，登录中间件；**固定路径** `bio` / `banner` / `privacy` **须注册在** `:userCode` **之前** |
| Banner 读图 | `GET /interactive-fiction-game-banner/:userId/:filename?`，仿头像转换 |

---

## 7. 前端对接顺序（下一迭代）

1. `GET profile` 替换主页占位（bio、banner、计数、`isFollowing`）  
2. 本人主页：编辑 bio、点 Banner 上传/清除  
3. 设置页：读写 `/api/account/privacy`；主页入口按 `canView*` 控制能否进列表  
4. 关注 → POST follow；取消关注 → DELETE `action=unfollow`；移除粉丝 → DELETE `action=removeFollower`  
5. 社交列表页 → following/followers（游标 + sort）；遇 `403 * _LIST_PRIVATE` 展示不可见态

路由仍用 `userCode`，不暴露内部 `userId`。

---

## 8. 已拍板摘要

- 接口需登录  
- `bio` / `bannerUrl` 在 `user`；列表可见性在 **`user_privacy`**（无行=默认都可见）  
- 关列表后仍显示人数；列表接口 403；`GET|PATCH /api/account/privacy`  
- Banner 方案 A：`interactive-fiction-game-banner/{userId}/{ts}_{name}` + 专用 GET，仿头像 + Cloudflare 转换  
- 列表：`sort` + 游标，默认每页 10  
- `DELETE .../follow?action=unfollow|removeFollower`  
- 不加 `follow_count`/`fan_count`；不加 Redis  

---

# 附录 A — v1.1 续写（相对 v1 新增）

> **约定：** 上文 §1–§8 为 v1 原文，不因本附录回改。  
> 本附录只写增量：主页已发布作品分接口；屏蔽能力。  
> 与 v1 冲突处以**本附录为准**。  
> **已拍板：** 屏蔽用独立表 `user_block`，**不**扩展 `user_follow`（见 A.3）。

## A.0 相对 v1 变更清单

| 项 | 类型 | 说明 |
|----|------|------|
| `GET /api/account/:userCode/works` | **新增** | 按 userCode 拉已发布作品；不嵌进 profile |
| 表 `user_block` | **新增** | 单向屏蔽边；与 `user_follow` 并列，不混 type |
| `POST\|DELETE /api/account/:userCode/block` | **新增** | 屏蔽 / 取消屏蔽；行为见 A.2 |
| profile 增 `isBlocked` / `isBlockedBy` | **扩展字段** | 他人主页按钮态 |
| follow / 名单 / works 遇屏蔽 | **扩展规则** | 统一 `403` + `code: 'USER_BLOCKED'` |
| 本版仍不做 | — | 屏蔽管理列表页、推荐/搜索全站过滤、作品嵌 profile、扩 follow 表 |

---

## A.1 主页已发布作品（与 profile 分接口）

**为什么分开：** profile 只扛身份与社交状态；作品字段多、可分页，嵌进 profile 拖慢首屏。创作台 `GET /auth/games/user` 含草稿且只认当前登录用户，不能填他人主页。

`GET /api/account/:userCode/works?limit=20&offset=0`

| Query | 说明 |
|-------|------|
| `limit` | 默认 **20**，上限建议 50 |
| `offset` | 默认 `0`；对齐现有 `/auth/games/*`（本接口不用游标） |

**鉴权与过滤：**

1. 需登录；用户不存在 → `404`  
2. 解析 `:userCode` → 主人 `userId`  
3. **对方屏蔽了我**（`user_block`：blocker=主人, blocked=我）→ `403` + `code: 'USER_BLOCKED'`  
4. **我屏蔽了对方**：本版仍允许返回公开作品  
5. SQL 硬条件：`creator_user_id = :ownerUserId AND is_public = 1`  
6. **永远不返回草稿**；即使 `isSelf` 也一样——草稿继续走 `/auth/games/user`  
7. 排序建议：`updated_at DESC`（与现有公开列表对齐即可）

**Response `data`：**

```json
{
  "total": 8,
  "limit": 20,
  "offset": 0,
  "list": [ /* 对齐 UserGameData 对外子集 */ ]
}
```

- 单项含封面、评分、点赞、引擎、价格、`userCode`（或 `creator_user_code`）等，便于 `CreatorWorksPanel` visitor 复用卡片  
- **不要**塞激励结算私有字段、草稿专属字段  

| | `GET /auth/games/user` | `GET /api/account/:userCode/works` |
|--|------------------------|-------------------------------------|
| 谁的作品 | 仅当前登录用户 | 路径 `:userCode` |
| 草稿 | 有 | **无** |
| 用途 | 创作台 / 本人草稿 Tab | 他人主页已发布；本人公开预览也可走此接口 |

前端：`CreatorWorksPanel` 在 `access=visitor` 调本接口，传入主页 `userCode`。

---

## A.2 屏蔽 — 产品行为

**接口：**

- `POST /api/account/:userCode/block` — 我屏蔽对方  
- `DELETE /api/account/:userCode/block` — 取消屏蔽  

**规则：**

- 不可屏蔽自己 → `400`；用户不存在 → `404`；幂等  
- 屏蔽成功时（同一请求内）：`INSERT user_block` + **拆除双方全部 `user_follow` 边**  
- 取消屏蔽：只删 `user_block` 边，**不**自动恢复关注  
- 任一方屏蔽另一方后：`POST follow` / `removeFollower` → `403 USER_BLOCKED`  
- 被对方屏蔽：following / followers / works → `403 USER_BLOCKED`  
- profile **仍返回**基础公开资料（勿 404），并带：  
  - `isBlocked`：我是否已屏蔽对方（本人主页固定 `false`）  
  - `isBlockedBy`：对方是否已屏蔽我（本人主页固定 `false`）  
  - 存在屏蔽时 `isFollowing = false`；`isBlockedBy` 时 `canView* = false`  

成功可选返回：`{ isBlocked, isFollowing, followingCount, followersCount }`（人数为对方主页计数，便于就地刷新）。

**前端（他人主页）：**

| 状态 | UI |
|------|----|
| 正常 | 关注 + 屏蔽 |
| 已关注 | 已关注 + 屏蔽 |
| `isBlocked` | 仅「取消屏蔽」 |
| `isBlockedBy` | 不显示关注/屏蔽；提示无法互动 |
| `isSelf` | 不显示关注/屏蔽 |

**本版不做：**「我的屏蔽列表」页；推荐/搜索/评论全站过滤（可后续复用 `user_block` 查询）。

---

## A.3 屏蔽落表 — 已拍板：独立 `user_block`

**决定：** 新建 `user_block`，**不**给 `user_follow` 加 type/status。  
（讨论过扩 follow / 关系表方案，已否决——避免关注计数与列表 SQL 全面加过滤、与 v1「纯关注表」定义冲突。）

```sql
CREATE TABLE IF NOT EXISTS user_block (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blockerUserId TEXT NOT NULL,
  blockedUserId TEXT NOT NULL,
  createTime TEXT NOT NULL,
  UNIQUE (blockerUserId, blockedUserId)
);

CREATE INDEX IF NOT EXISTS idx_user_block_blocker_time
  ON user_block (blockerUserId, createTime DESC);

CREATE INDEX IF NOT EXISTS idx_user_block_blocked
  ON user_block (blockedUserId);
```

| 列 | 说明 |
|----|------|
| `blockerUserId` | 发起屏蔽的人（我） |
| `blockedUserId` | 被屏蔽的人 |
| `createTime` | 屏蔽时间 |

规则：

- 禁止自己屏蔽自己  
- **只存单向边**：A 屏蔽 B ≠ B 屏蔽 A  
- 屏蔽：插入；已存在 → 幂等成功  
- 取消：删除；不存在 → 幂等成功  
- 屏蔽成功后任一方对另一方 follow → `403 USER_BLOCKED`  
- 关注/粉丝列表：建议过滤掉与当前登录用户存在**任一方向**屏蔽关系的用户  
- 删用户时建议一并清理本表（与 follow 同级）

**实现落点（相对 v1 §6 增量）：**

| 层 | 增量 |
|----|------|
| Migration | 建 `user_block`（另迁；不改 v1 的 `user_follow` DDL） |
| Service | `userBlockService.js`；公共 `assertNotBlocked(viewerId, targetId)` 供 follow / lists / works 复用 |
| Routes | `:userCode/block` 与 follow / works 同级；固定路径仍在 `:userCode` 之前 |

profile 实现：在 v1 基础上再查双向 block 存在性，填 `isBlocked` / `isBlockedBy`。

---

## A.4 前端对接增量（在 v1 §7 之后）

6. 访客作品：`GET .../works` 接入 `CreatorWorksPanel` visitor  
7. 屏蔽：POST/DELETE `.../block` + profile `isBlocked` / `isBlockedBy`（替换 toast 占位）  
8. 遇 `USER_BLOCKED`：主页/名单/作品统一不可互动态  

---

## A.5 附录已拍板摘要

- 作品：`GET /api/account/:userCode/works`，仅 `is_public = 1`，`limit` + `offset`  
- 屏蔽：**独立表 `user_block`**；`POST|DELETE .../block`；屏蔽时拆双方 follow  
- profile：`isBlocked` / `isBlockedBy`；撞屏蔽统一 `403 USER_BLOCKED`  
- **不**扩展 `user_follow`；本版不做屏蔽列表页 / 全站过滤  

---

# 附录 B — v1.2 续写（互关标识 + 互关列表）

> **约定：** §1–§8 与附录 A 不因本附录回改正文；冲突处以**本附录为准**。  
> 相对 v1 §5「互粉判定本版不要」：**本附录明确要做**互关判定字段与互关列表接口。  
> **不**改 `user_follow` DDL（仍只存单向边）；互关 = 两条反向边同时存在。  
> 写操作仍用既有 `POST|DELETE .../follow`，本附录只扩**读**能力。

---

## B.0 相对 v1 / v1.1 变更清单

| 项 | 类型 | 说明 |
|----|------|------|
| following / followers 列表项增 `isFollowedBy` | **扩展字段** | 相对**当前登录用户**；与已有 `isFollowing` 成对 |
| `GET /api/account/:userCode/mutual` | **新增** | 互关列表；分页/排序对齐 following / followers |
| profile 增 `mutualCount`（可选） | **扩展字段** | 主页 / Tab 角标；本迭代可不做，前端可先用列表 `total` |
| follow 写接口 | **不改** | 仍 `POST|DELETE .../follow` |
| 隐私 | **复用** | 互关列表鉴权对齐 **关注列表**（`followingListPublic`） |

---

## B.1 列表项字段扩展：`isFollowedBy`

### B.1.1 作用接口

以下两个接口的 `data.list[]` **每一项**增加 `isFollowedBy`（布尔）：

- `GET /api/account/:userCode/following`
- `GET /api/account/:userCode/followers`

响应包络、Query（`limit` / `sort` / `cursor`）、游标编码、隐私 403、屏蔽过滤等规则**不变**，仅扩展 list 项字段。

### B.1.2 字段语义（相对「当前登录用户」= viewer）

对列表中某一行用户 `peer`：

| 字段 | 含义 | 判定（`user_follow`） |
|------|------|------------------------|
| `isFollowing` | **我是否关注了 peer**（已有） | 存在边 `(follower=viewer, followee=peer)` |
| `isFollowedBy` | **peer 是否关注了我**（新增） | 存在边 `(follower=peer, followee=viewer)` |
| `followedAt` | 本条边进入「当前列表」的时间（已有） | following：主人关注 peer 的时间；followers：peer 关注主人的时间；**不是**互关时间 |

**注意：**

1. `isFollowing` / `isFollowedBy` 一律相对 **viewer（当前登录用户）**，**不是**相对列表主人 `:userCode`。  
   - 例：看别人主页的「粉丝」列表时，`isFollowing` = 我是否关注了该粉丝，而不是「主人是否关注了该粉丝」。  
2. 当 `viewer` 就是列表主人（`isSelf`）时：  
   - **following 列表**：主人关注了 peer → `isFollowing` 恒为 `true`；`isFollowedBy` = peer 是否回关主人。  
   - **followers 列表**：peer 关注了主人 → `isFollowedBy` 恒为 `true`；`isFollowing` = 主人是否回关 peer。  
3. 本人行（peer = viewer）不应出现在列表中；若出现则两字段均 `false`，前端应隐藏关注按钮。  
4. 与屏蔽：列表已过滤与 viewer 存在任一方向屏蔽的 peer；过滤后两字段仍按上表计算。存在屏蔽时不应再返回该 peer。

### B.1.3 Response `list[]` 单项（扩展后）

```json
{
  "userCode": "abc123",
  "nickname": "昵称",
  "avatarUrl": "interactive-fiction-game-avatar/...",
  "bio": "",
  "isFollowing": true,
  "isFollowedBy": true,
  "followedAt": "2026-10-01T12:00:00.000Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userCode` | string | 是 | peer 的公开码 |
| `nickname` | string | 是 | |
| `avatarUrl` | string \| null | 是 | |
| `bio` | string | 是 | 无则 `""` |
| `isFollowing` | boolean | 是 | viewer → peer |
| `isFollowedBy` | boolean | 是 | peer → viewer |
| `followedAt` | string | 是 | ISO 时间；本列表边的 `createTime` |

### B.1.4 实现要点（防 N+1）

在现有 `listFollowHandler` 流程上增量：

1. 取出本页 `peerIds`（已有）  
2. 批量：`getFollowingSet(viewer, peerIds)` → `isFollowing`（已有）  
3. **新增批量**：`getFollowedBySet(viewer, peerIds)`  
   - 语义：查 `WHERE followeeUserId = :viewer AND followerUserId IN (:peerIds)`  
   - 返回 `Set<peerId>`；命中则该项 `isFollowedBy = true`  
4. **禁止**对每个 peer 循环单查  
5. 不改表结构；不新增冗余列  

### B.1.5 前端按钮文案映射（关注 / 粉丝 Tab）

优先级从上到下取第一条：

| 条件 | 按钮文案 | 可点操作 |
|------|----------|----------|
| `isFollowing && isFollowedBy` | **互相关注** | 取关：`DELETE .../follow?action=unfollow` |
| `isFollowing && !isFollowedBy` | **已关注** | 同上取关 |
| `!isFollowing && isFollowedBy` | **回关** | `POST .../follow` |
| 否则 | **关注** | `POST .../follow` |

取关成功后：本地将 `isFollowing = false`；`isFollowedBy` 保持原值（可能变为「回关」）。  
关注成功后：本地将 `isFollowing = true`；若原 `isFollowedBy === true` 则文案变为「互相关注」。

---

## B.2 新增互关列表：`GET /api/account/:userCode/mutual`

### B.2.1 路径与 Query

```
GET /api/account/:userCode/mutual?limit=10&sort=recent
GET /api/account/:userCode/mutual?limit=10&sort=recent&cursor={nextCursor}
```

| Query | 说明 |
|-------|------|
| `limit` | 默认 **10**，上限建议 50（与 following / followers 一致） |
| `sort` | `recent`（默认）/ `earliest`；非法值当 `recent` |
| `cursor` | 可选；首页不传；加载更多传上一页 `nextCursor`（不透明，前端勿解析） |

切换 `sort` 时前端清空列表并重请求（不带旧 cursor），规则同 §4.6。

**鉴权：** 需登录（与其它 account 列表一致）。

### B.2.2 互关定义

列表主人 `owner` 与 peer **互相关注**，当且仅当同时存在：

1. `(follower=owner, followee=peer)` — owner 关注了 peer  
2. `(follower=peer, followee=owner)` — peer 关注了 owner  

**排序时间 `followedAt`（拍板）：** 取两条边 `createTime` 的 **较晚者**（互关「达成」时间）。  
游标按该时间 + 稳定 tie-break（建议用两条边中用于排序的合成键；实现可用 `MAX(a.createTime, b.createTime)` + `peerUserId` 或双方 `user_follow.id` 的约定组合，须在编码/解码中自洽）。

### B.2.3 隐私鉴权

与 **关注列表** 对齐（拍板）：

1. 解析 `:userCode` → owner  
2. 用户不存在 → `404`  
3. 非本人且被 owner 屏蔽（`isBlockedBy`）→ `403` + `code: 'USER_BLOCKED'`  
4. 非本人且 owner `followingListPublic = 0`（有 privacy 行且明确关闭）→ `403`  
   `{ success: false, code: 'FOLLOWING_LIST_PRIVATE', message: '该用户已隐藏关注列表' }`  
5. 无 privacy 行或公开 → 放行；本人始终可看  

**说明：** 互关是「关注∩粉丝」子集，隐藏关注列表时他人也不可看互关列表。本版**不**新增独立 `mutualListPublic`。

### B.2.4 屏蔽过滤

与 following / followers 一致：本页候选 peer 中，与 **viewer** 存在任一方向 `user_block` 的用户须排除（可复用 `getRelatedBlockedUserIds`）。  
排除后不足 `limit` 时的补页策略与现有 `listVisibleEdges` 保持一致即可。

### B.2.5 Response `data`

结构与 following / followers **同形**，便于前端复用：

```json
{
  "total": 12,
  "limit": 10,
  "sort": "recent",
  "nextCursor": "eyJ0IjoiMjAyNi0xMC0wMVQxMjowMDowMC4wMDBaIiwiaSI6IjEyMzo0NTYifQ",
  "list": [
    {
      "userCode": "abc123",
      "nickname": "昵称",
      "avatarUrl": "interactive-fiction-game-avatar/...",
      "bio": "",
      "isFollowing": true,
      "isFollowedBy": true,
      "followedAt": "2026-10-01T12:00:00.000Z"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `total` | owner 的互关总人数（`COUNT` 互关集合；与游标无关） |
| `limit` / `sort` / `nextCursor` | 同 §4.6 |
| `list[].followedAt` | 互关达成时间（两边 `createTime` 较晚者） |
| `list[].isFollowing` | **建议恒为 `true`**（仍按 viewer 计算；互关页在本人视角下恒 true） |
| `list[].isFollowedBy` | **建议恒为 `true`**（同上） |

当访客查看他人互关列表时：`isFollowing` / `isFollowedBy` 仍相对 **viewer**，不必恒 true——与 B.1 同一套批量查询即可。前端在 `tab=mutual` 下按钮文案仍走 B.1.5 映射（通常为「互相关注」或「关注/回关」视 viewer 关系而定）。

### B.2.6 SQL 思路（参考，非强制实现细节）

互关集合可视为：

```sql
-- owner 关注的人 ∩ 关注 owner 的人
SELECT
  f1.followeeUserId AS peerUserId,
  CASE
    WHEN f1.createTime >= f2.createTime THEN f1.createTime
    ELSE f2.createTime
  END AS mutualAt
FROM user_follow f1
INNER JOIN user_follow f2
  ON f2.followerUserId = f1.followeeUserId
 AND f2.followeeUserId = f1.followerUserId
WHERE f1.followerUserId = :ownerUserId
```

再在其上按 `mutualAt` + 稳定键做 `sort` / 游标 / `LIMIT`，然后批量补 user 卡片与 viewer 的 `isFollowing` / `isFollowedBy`。

索引：现有 `idx_user_follow_follower_time`、`idx_user_follow_followee_time` 足够支撑中小体量；本版**不**新建互关物化表。

### B.2.7 错误码

| 场景 | HTTP | `code` |
|------|------|--------|
| 未登录 | 401 | （项目既有） |
| 用户不存在 | 404 | — |
| 被主人屏蔽 | 403 | `USER_BLOCKED` |
| 主人隐藏关注列表 | 403 | `FOLLOWING_LIST_PRIVATE` |
| 其它 | 500 | — |

### B.2.8 路由注册

`interface/routes/account.js`：

```text
GET /api/account/:userCode/mutual   → listMutualHandler（需登录）
```

与 `following` / `followers` 同级；固定路径（`bio` / `banner` / `privacy`）仍须注册在 `:userCode` 之前。

---

## B.3 profile 可选增量：`mutualCount`

`GET /api/account/:userCode/profile` 的 `data` 可增加：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mutualCount` | `number \| null` | 主人互关人数；`isBlockedBy` 时与 following/followers 一样可为 `null` |

- **本迭代可选**：前端 Tab 角标可先用 `GET .../mutual` 的 `total`  
- 若做：计数 SQL 与互关列表 `total` 同源；本人 / 公开规则与 `followingCount` 一致  

本附录**不强制**本迭代改 profile。

---

## B.4 前端对接要点（后端就绪后）

1. `SocialListUser` 增 `isFollowedBy: boolean`  
2. `accountSocialApi.getMutual(userCode, params)` → `GET .../mutual`  
3. 社交页 Tab：`following` \| `followers` \| `mutual`（`?tab=mutual`）  
4. 按钮文案按 B.1.5；互关 Tab 复用同一按钮逻辑  
5. 遇 `FOLLOWING_LIST_PRIVATE`：互关 Tab 与关注列表同样展示不可见态  

---

## B.5 附录已拍板摘要

- following / followers 列表项：**必增** `isFollowedBy`（相对当前登录用户）  
- **新增** `GET /api/account/:userCode/mutual`，Query/响应形对齐 following；隐私对齐 `followingListPublic`  
- 互关 = 双向各一条 `user_follow`；`followedAt` = 两边时间较晚者  
- **不**改 follow 写接口；**不**扩 `user_follow` DDL；**不**新建互关物化表  
- `mutualCount` 进 profile 为可选  

---

# 附录 C — v1.3 续写（隐私设置扩展 + 屏蔽名单）

> **约定：** §1–§8 与附录 A / B 不因本附录回改正文；冲突处以**本附录为准**。  
> 前端对齐：`/account/privacy`（隐私设置）、`/account/privacy/find-me`、`/account/privacy/muted`（不看他/她）。  
> **不**新建隐私路由前缀；读写仍走既有 `GET|PATCH /api/account/privacy`。  
> **不**新建隐私表；在既有 `user_privacy` 上扩列（本附录只扩 `list_discoverable`）。  
> **命名约定：** D1 = `snake_case`；HTTP JSON = `camelCase`（Service 映射）。  
> **交叉文档：** 推荐关注列表 + 隐私页「推荐给我 / 把我推荐出去」→ 后端  
> `Interactive-fiction-backend/.cursor/doc/推荐关注列表-计划书.md` **§2.7**（本附录不扩 `people_suggest_*`）。

---

## C.0 相对 v1 / v1.1 / v1.2 变更清单

| 项 | 类型 | 说明 |
|----|------|------|
| `user_privacy` 扩 1 列 | **DDL 扩展** | `list_discoverable` |
| `GET\|PATCH /api/account/privacy` | **扩展字段** | JSON 增加 `listDiscoverable`；旧字段行为不变 |
| following / followers / mutual 列表过滤 | **扩展规则** | 非本人视角下排除 `list_discoverable = 0` 的 peer |
| `GET /api/account/blocked` | **新增** | 「不看他(她)」屏蔽名单；取消屏蔽仍用 `DELETE .../block` |

相对附录 A.0 / A.5「本版不做屏蔽列表页」：**本附录明确要做** `GET /api/account/blocked`。

---

## C.1 概念区分（勿与 v1 列表隐私混用）

| DB 列（snake_case） | JSON（camelCase） | 控制什么 | 生效点 |
|---------------------|-------------------|----------|--------|
| `following_list_public`（已有） | `followingListPublic` | 别人能不能打开**我的**关注列表 | 列表接口鉴权 403 |
| `followers_list_public`（已有） | `followersListPublic` | 别人能不能打开**我的**粉丝列表 | 同上 |
| `list_discoverable`（新增） | `listDiscoverable` | 别人打开**他人**的关注/粉丝/互关列表时，**我这条能不能出现** | 列表结果集过滤 |

例（粉丝列表同理）：你（A）关注了 B，并关闭「通过他人的关注和粉丝列表找到我」→

| 谁在看 B 的粉丝列表 | 能否看到 A |
|--------------------|------------|
| **B 本人**（列表主人） | **能**（主人看自己名单不过滤） |
| **A 自己**（隐身者点开 B） | **能**（当前登录用户本人豁免） |
| **第三方 C** | **不能** |

---

## C.2 数据库：`user_privacy` 扩列

### C.2.1 表位置（便于检索）

| 位置 | 路径 |
|------|------|
| 全量 schema | `cf/d1-schema.sql` → `CREATE TABLE user_privacy` |
| 首建 migration | `cf/migrations/2026-10-09-user-account-profile.sql` |
| 读写 Service | `services/d1/userPrivacyService.js` |
| Handler | `GET\|PATCH /api/account/privacy`（`accountHandlers.js`） |

表在 **D1 / `cf/`**，不在 `services/` 里建表。无 privacy 行时仍按默认值解读（见 C.2.3）。

现网已有列（对照，勿再建成 camelCase）：

```sql
-- 已落地（节选）
CREATE TABLE IF NOT EXISTS user_privacy (
  user_id TEXT PRIMARY KEY,
  following_list_public INTEGER NOT NULL DEFAULT 1,
  followers_list_public INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);
```

### C.2.2 Migration（新增）

```sql
-- cf/migrations/YYYY-MM-DD-user-privacy-list-discoverable.sql
-- 功能注释：是否允许出现在他人可见的关注/粉丝/互关列表中
-- 列名一律 snake_case

ALTER TABLE user_privacy ADD COLUMN list_discoverable INTEGER NOT NULL DEFAULT 1;
```

同步更新 `cf/d1-schema.sql` 中 `user_privacy` 的建表定义：

```sql
CREATE TABLE IF NOT EXISTS user_privacy (
  user_id TEXT PRIMARY KEY,
  following_list_public INTEGER NOT NULL DEFAULT 1,
  followers_list_public INTEGER NOT NULL DEFAULT 1,
  list_discoverable INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);
```

| DB 列 | 类型 | 默认 | 说明 |
|-------|------|------|------|
| `list_discoverable` | INTEGER `0`/`1` | **1** | `1` = 允许出现在他人可见的关注/粉丝/互关列表中 |

**默认约定：**

- **没有 `user_privacy` 行** → `list_discoverable` 当 `1`（可被发现）  
- 有行时字段只接受 `0`/`1`；`PATCH` 可只改本项（upsert）  
- 旧行靠 `ADD COLUMN ... DEFAULT 1` 回填；若 D1 行为不符预期再补 `UPDATE`

### C.2.3 Service 映射与返回形（扩展后）

`UserPrivacyService`：**SQL 只读写 snake_case 列**；对外返回 / 接收 **camelCase**。

| DB 列 | JSON 键 |
|-------|---------|
| `following_list_public` | `followingListPublic` |
| `followers_list_public` | `followersListPublic` |
| `list_discoverable` | `listDiscoverable` |

`getPrivacy` / `upsertPrivacy` 返回完整对象：

```json
{
  "followingListPublic": true,
  "followersListPublic": true,
  "listDiscoverable": true
}
```

`upsertPrivacy`：对每个传入 JSON 键做 `normalizeOptionalFlag`；未传的键保留当前值（无行则用默认）。  
非法非布尔 → 继续抛 `invalid_privacy_flag` → handler `400`。

---

## C.3 接口：扩展 `GET|PATCH /api/account/privacy`

路径、鉴权（需登录）、部分更新语义**不变**。

### C.3.1 `GET /api/account/privacy`

成功 `data`：C.2.3 三字段全集（camelCase）。无行时返回默认值，**不必**先插行。

### C.3.2 `PATCH /api/account/privacy`

Body 字段均可选，只更新传入键：

```json
{
  "followingListPublic": false,
  "followersListPublic": true,
  "listDiscoverable": false
}
```

成功返回更新后的**完整**三字段对象（同 GET）。

### C.3.3 前端映射（隐私设置页）

| UI | JSON 字段 | 交互 |
|----|-----------|------|
| 找到我的方式 →「通过他人的关注和粉丝列表找到我」 | `listDiscoverable` | 子页开关 → `PATCH` |
| 列表隐私 · 关注/粉丝 | `followingListPublic` / `followersListPublic` | 主页设置与隐私设置双入口，同一接口 |

前端「找到我的方式 / 列表隐私」去掉本地占位，以本接口为准。  
隐私主列表「推荐给我 / 把我推荐出去」两项的字段与推荐过滤 → 《推荐关注列表-计划书》**§2.7**（仍走同一 `GET|PATCH /api/account/privacy`）。

---

## C.4 列表过滤：落实 `list_discoverable`

### C.4.1 作用范围

| 接口 | 是否过滤 |
|------|----------|
| `GET .../following` / `followers` / `mutual` **列表项** | 是（藏 `list_discoverable=0`；本人豁免） |
| 列表 `total` / profile `followingCount`·`followersCount`·`mutualCount`（访客视角） | **不因本开关减人数**（仍扣双向屏蔽）；可与列表刷出条数不一致 |

### C.4.2 过滤规则（已拍板）

对列表中的 peer：

1. **viewer 是列表主人（isSelf）** → **不过滤**（主人永远能看见自己名单里的人；计数也用全量）  
2. **viewer 不是主人** → 排除 `list_discoverable = 0` 的 peer（无 privacy 行当 `1`）  
3. **例外（本人豁免）**：即使 viewer 自己关了 `list_discoverable`，在别人的关注/粉丝/互关列表里 **仍能看见自己那一条**（`peer === viewer` 不因本开关被滤）  
4. 与现有「双向屏蔽过滤」**叠加**（本人豁免只针对 `list_discoverable`，不解除屏蔽）  
5. 排除后本页不足 `limit` 时的补页策略与现有屏蔽补页保持一致  

实现建议：

```sql
-- 批量示例：无行视为可发现；访客视角下 viewer 本人豁免
-- COALESCE(p.list_discoverable, 1) = 1 OR peer.user_id = :viewerUserId
SELECT p.user_id, COALESCE(p.list_discoverable, 1) AS list_discoverable
FROM ... -- peer ids
LEFT JOIN user_privacy p ON p.user_id = peer.user_id
```

- **禁止**对每个 peer 单查 privacy  

### C.4.3 计数与角标（已拍板）

**列表主人：** 列表与计数均全量。  

**访客视角（已拍板）：**

| | 行为 |
|--|------|
| **角标 / `total`** | **不因** `list_discoverable` 减少；仍按真实关系人数（只扣与 viewer 的双向屏蔽） |
| **列表条目** | 仍隐藏他人 `list_discoverable = 0`；viewer 本人豁免 |

例：B 有粉丝 A、C 共 2 人；A 关了「通过他人列表找到我」→ C 看 B 粉丝：**角标仍为 2**，列表里刷不到 A（只能刷到可见的人，含 C 自己）。

> 前端需接受：访客场景下角标人数 ≥ 列表实际能刷到的人数，属预期，不要强行改角标。

### C.4.4 与「列表隐私」403 的关系

- 主人关了 `following_list_public` → 他人直接 `403 FOLLOWING_LIST_PRIVATE`，与本过滤无关  
- 主人列表公开，但某 peer 关了 `list_discoverable` → 第三方列表里少这一行，**不**对该 peer 单独报错；该 peer 自己点开时仍能看见自己；**角标仍含该人**  

---

## C.5 屏蔽名单：`GET /api/account/blocked`

> 对应前端「隐私设置 → 屏蔽 → 不看他(她)」。  
> 写操作**不新开**：取消屏蔽继续 `DELETE /api/account/:userCode/block`（附录 A）。  
> **分页对齐关注/粉丝列表：** 默认一页 **10** 条，有 `nextCursor` 则可下拉续拉；**前端不做**「最近/最早」排序 UI。

### C.5.1 路径与 Query

```
GET /api/account/blocked?limit=10
GET /api/account/blocked?limit=10&cursor={nextCursor}
```

| Query | 说明 |
|-------|------|
| `limit` | 默认 **10**，上限建议 50（与 following / followers 一致） |
| `cursor` | 可选；首页不传；加载更多传上一页 `nextCursor` |

**排序（服务端固定）：** 始终按 `user_block.created_at DESC, id DESC`（最近屏蔽在前）。  
**不**暴露 `sort` Query；前端也不展示排序切换。

**鉴权：** 需登录；名单**仅本人**——固定查 `blocker_user_id = 当前登录 userId`，路径**无** `:userCode`。

路由须注册在 `/api/account/:userCode/*` **之前**：

```text
GET /api/account/blocked   → listBlockedHandler（需登录）
```

### C.5.2 Response `data`

```json
{
  "total": 3,
  "limit": 10,
  "nextCursor": null,
  "list": [
    {
      "userCode": "abc123",
      "nickname": "昵称",
      "avatarUrl": "interactive-fiction-game-avatar/...",
      "bio": "",
      "blockedAt": "2026-10-12T12:00:00.000Z"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `total` | 我屏蔽的总人数 |
| `nextCursor` | 本页条数 `< limit` 则为 `null`；否则用末条 `(created_at, id)` 编码 |
| `list[].blockedAt` | 来自 `user_block.created_at` |
| 不返回 | `sort`、`isFollowing` / `isFollowedBy`（前端按钮固定「取消屏蔽」） |

### C.5.3 取消屏蔽（复用）

`DELETE /api/account/:userCode/block` → 本地列表移除该项；**不**自动恢复关注。

### C.5.4 错误码

| 场景 | HTTP |
|------|------|
| 未登录 | 401 |
| 其它 | 500 |

---

## C.6 实现落点

| 层 | 增量 |
|----|------|
| Migration | `user_privacy.list_discoverable`；更新 `d1-schema.sql` |
| Service | `userPrivacyService.js` 读写 + 映射；列表/计数侧批量查 discoverable |
| List handlers | following / followers / mutual：非 self 时过滤；访客 `total`/角标同步 |
| Routes | `GET /api/account/blocked`（固定路径在 `:userCode` 前） |
| Block Service | `listBlocked(...)`（`limit` 默认 10；固定 recent 游标） |
| 前端 | `listDiscoverable` + 列表隐私接真 API；muted 页无限滚动 / 下拉续拉 |

---

## C.7 前端对接要点（后端就绪后）

1. `AccountPrivacy` 增 `listDiscoverable`  
2. 「找到我的方式」子页接 `PATCH`；去掉该开关的本地 session 占位  
3. 「不看他(她)」接 `getBlocked`（`limit=10` + cursor）+ `unblock`；无排序 UI  
4. 主页设置与隐私设置两处「列表隐私」共用同一 PATCH  
5. 「推荐给我 / 把我推荐出去」两项 → 字段与推荐过滤见后端《推荐关注列表-计划书》**§2.7**（本附录不扩这两列）

---

## C.8 产品拍板记录（2026-10-12）

| # | 议题 | 结论 |
|---|------|------|
| 1 | `list_discoverable` 默认 | **开（1）** |
| 2 | 访客视角角标 / `total` | **不因 `list_discoverable` 减人数**（可大于列表刷出条数）；列表主人仍全量；屏蔽仍扣 |
| 3 | 屏蔽名单分页 | **默认 10 条**，有更多则 cursor 下拉续拉（对齐关注/粉丝） |
| 4 | 屏蔽名单排序 UI | **不要**；服务端固定最近屏蔽在前 |
| 5 | 隐私页两项推荐开关 | **并入推荐计划书**（见该文档 §2.7）；本附录只交叉引用 |
| 6 | 隐身者看别人名单 | **本人豁免**：关了 `list_discoverable` 仍能在对方关注/粉丝/互关里看见自己 |

---

## C.9 附录摘要

**本附录范围：**

- 扩 `list_discoverable`（默认开）；API `listDiscoverable`  
- 列表主人：不过滤；访客列表：过滤他人隐身 + **本人豁免**；访客角标/`total`：**不因隐身减人数**（可与列表条数不一致）  
- **新增** `GET /api/account/blocked`（`limit=10` + cursor，无 sort）；取消屏蔽复用 `DELETE .../block`  

**交叉文档：**

- 推荐关注列表与「推荐给我 / 把我推荐出去」隐私开关 → 后端  
  `Interactive-fiction-backend/.cursor/doc/推荐关注列表-计划书.md` **§2.7**  
