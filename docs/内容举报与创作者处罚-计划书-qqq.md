# 内容举报 / 内容屏蔽 / 创作者处罚 — 计划书（v1.2）

> **日期**：2026-10-14  
> **最后修订**：2026-10-27（**运营撤销**警告/当前处罚：见 §2.7b R41–R48；不退档、不删历史）  
> **此前修订**：2026-10-26（**解禁登录**：`clear-login-ban` 与申诉通过同权，admin/operator；**施加**禁登录仍仅 admin）；2026-10-24（严重直达 R33）  
> **前端落点细则**：`.cursor/doc/前端交互.md`（与本文冲突时，**入口/过滤/契约字段以本文 + 前端交互为准**）  
> **入口**：  
> - 游戏详情页「分享」菜单 → **举报**（P0 展示说明文案）  
> - **仅首页推荐**：移动端长按 / 桌面端右键 → **屏蔽 / 举报**（搜索、榜单、作者主页作品卡不做）  
> - 他人个人主页右上角 **「⋯」** → **举报**（本人主页/自己作品入口直接隐藏）  
> - 帖子侧入口本版不做 UI（仅保留 `targetType=post` 类型与理由字典）  
> - 管理端：P0「举报审核」+「处罚记录（只读）」；P0.5 严重直达等；申诉 P1（`admin`/`operator` 可审；**施加**禁登录仅 admin，**解禁登录** admin/operator，与申诉通过一致）  
> **角色**：登录用户（举报/屏蔽）；创作者（收通知、申诉）；`admin` / `operator`（审核与处罚）  
> **关联已有能力**：`user_block`（人）、`games.is_public`、消息中心、`GET /auth/user/info`、`genRandomNickname` / `DEFAULT_AVATAR_URL`（注册默认）、评论审核 UI、提现审核权限  
> **前置依赖**：账号社交屏蔽（人）已上线；推荐流可读 `user_content_block`  
>
> **范围锁定**：游戏举报 + 账号举报 + 游戏内容屏蔽 + 举报理由字典 + 审核处置 + 警告/四级处罚（分 P0 / P0.5）+ 站内通知；帖子类型仅占位；申诉为 P1  
> **不改**：站外分享重做；帖子举报/屏蔽 UI；物理删作品；人级屏蔽语义；**本版不做「暂停收益/停结算」**；P0 **不做**取消屏蔽 UI  
> **可复用**：`user_block`、`games.is_public`、消息中心 `message_type`、注册默认昵称/头像生成、R2、`admin`+`operator`  

**文档版本**：v1.2  
**最后更新**：2026-10-26  
**风格参照**：`创作者钻石提现-计划书` / `推荐关注列表-计划书`  
**关联整改纪要**：`.cursor/doc/举报申诉功能/后端整改-Admin举报详情.md`（历史过程；现行约定以本文为准）

---

## 0. 目标与成功标准

| 目标 | 验收 |
|------|------|
| **游戏举报** | 详情分享菜单 / 首页推荐长按·右键均可进入同一举报流程；提交后运营可审 |
| **账号举报** | 他人主页「⋯」可举报；理由集比作品多账号类条目；自己的入口隐藏 |
| **游戏屏蔽** | 首页推荐屏蔽只挡推荐；搜索/作者主页/详情不因个人屏蔽而藏；**不**等同屏蔽作者；P0 只屏蔽不解 |
| **理由字典** | 后端表维护；前端按 `targetType` 拉取，不写死文案 |
| **举报成立处置** | 作品下架（非物理删）+ 后台留痕 + 警告（同内容多人只计 1 次） |
| **严重违规升级** | 运营可选跳过普通警告，直接施处罚等级（**P0.5** UI） |
| **处罚阶梯** | 一级 7 天禁发→观察7天；二级 30 天禁发+主页不展示→观察7天；三级 90 天+冻结等→观察30天；观察期内再违规升级；四级永久（**不做停结算**）；P0 先落地自动一级 |
| **运营面板** | 列表筛选、详情、通过/驳回、选处理动作、写审核备注；P0 含处罚记录只读；留下完整审计字段 |
| **通知** | 举报人：提交后 toast + 站内「已受理」；创作者：处罚/警告文案（§2.9）；`moderation` 可带 `relatedGameId`；**不开放审核进度页** |

**非目标（本版）**：

- 分享能力升级（分享给平台粉丝、QQ、朋友圈等）——另开需求  
- 帖子举报/屏蔽完整前端与帖子实体联动（无帖子表；仅 `post` 类型枚举 + 理由种子）  
- **二级/三级「暂停收益、停结算、停激励」联动**——结算改版后再做  
- 自动机器审核 / AI 判黄  
- 对举报人的反制（诬告处罚）——可后续加  
- 物理删除作品与 R2 资源清理  
- 新建 `moderation_notifications` 表（只用消息中心 `message_type`）

**产品说明（P0 必展示；详情分享菜单底部也出）**：

> 举报仅用于反馈违规内容。恶意举报可能影响账号信用。屏蔽只会让该内容不再出现在你的推荐中，不会屏蔽作者本人。

---

## 1. 现状锚点（改哪里）

### 1.1 数据流（目标）

```
用户：分享菜单/长按 → 举报
  → GET  /api/report/reasons?targetType=game|user|post
  → POST /api/report                 （写 user_report + 可选证据）
        → 前端 toast「已提交…」
        → 消息中心写给举报人：已受理（无进度）
  → （可选）POST /api/content/block  （仅屏蔽，不进审核）

运营：Admin「内容举报」
  → GET  /api/admin/reports
  → GET  /api/admin/reports/:id
  → POST /api/admin/reports/:id/review
        → 驳回 | 成立(标准) | 成立(严重)
        → 副作用：下架/清资料/记警告/触发处罚/通知创作者

创作者：消息中心看到处罚通知
  →（P1）申诉 → 运营复核 → 撤销或维持
```

### 1.2 与现有能力对照

| 能力 | 现状 | 本计划 |
|------|------|--------|
| 人级屏蔽 | `user_block` + `/api/account/:userCode/block` | **不改**；与内容屏蔽分离 |
| 内容屏蔽 | **无** | 新建 `user_content_block`（game / 预留 post） |
| 内容举报 | **无**（`operator/reports` 是运营数据报表） | 新建举报表 + 审核 API |
| 作品可见 | `games.is_public` | 下架 = `is_public=0` + **`moderation_status='taken_down'`**，防止创作者自行再公开 |
| 消息中心 | `announcement` / `promotion` / `favorite_game_updated` 等 | 扩展 `message_type`：`report_received`（举报人）+ `moderation`（创作者）；**不新建通知表** |
| 创作者禁发 | **无**统一开关 | `user_punishment`（当前态）+ `creator_moderation`（流水） |
| 帖子 | **无表** | 仅枚举占位；审核侧若收到 `post` 暂标「未接入」 |
| 管理端审核 UI | 评论 `CommentAdminManager`、提现审核 | 新 Tab，交互对齐评论/提现 |

### 1.3 关键文件（拟）

| 层 | 文件 | 动作 |
|----|------|------|
| migration | `cf/migrations/2026-10-14-content-report-moderation.sql` | **5 新表** + `games` 字段 + 理由种子（**不**改胖 `user`） |
| schema | `cf/d1-schema.sql` | 同步 |
| BE Service | `services/d1/reportReasonService.js` | 新建 |
| BE Service | `services/d1/userReportService.js` | 新建：提交/查重 |
| BE Service | `services/d1/userContentBlockService.js` | 新建：屏蔽游戏 |
| BE Service | `services/d1/creatorModerationService.js` | 新建：审核、警告、处罚、通知副作用 |
| BE Service | `services/d1/creatorAppealService.js` | P1 |
| BE Routes | `interface/routes/report.js`（或挂 `account`） | 用户侧 |
| BE Routes | `interface/routes/adminReport.js` | 管理侧 |
| BE | `gameRecommendFeedService` / 列表 handlers | 过滤 `user_content_block` + `taken_down` |
| BE | `gamesPublish` / 发帖入口（若有） | 检查发布限制 |
| BE | `interface/handlers/messages/messages.js` | 扩展 message_type |
| FE | `GameDetail` 分享菜单、推荐卡片长按 | 举报/屏蔽入口 |
| FE | `AccountHomepage` 分享菜单 | 账号举报 |
| FE | 举报流程页/弹层 | 选理由、补充说明、证据 |
| FE | `AdminPanel` 新 Tab | 审核列表+详情+动作 |
| FE | 消息中心 | 展示 moderation 通知 |

### 1.4 与其它模块

| 模块 | 是否纳入 | 说明 |
|------|----------|------|
| 游戏推荐/搜索/分享 | 是（读侧过滤） | 下架与个人屏蔽生效 |
| 人级屏蔽 | 否（不复用语义） | 长按「屏蔽游戏」≠ 屏蔽作者 |
| 站外分享产品 | **否** | 另开 |
| 帖子完整链路 | **否** | 仅类型 + 理由 |
| 申诉 | **P1** | 规则已写，接口可后做 |

---

## 2. 产品规则（定稿 / 建议）

### 2.0 一句话

> 用户可举报游戏或账号、可单独屏蔽某游戏；运营审核成立后下架/处理并记警告（同内容多人只记 1 次），累计与严重度走四级处罚；创作者收通知，可申诉（P1）。

### 2.1 入口与对象

| # | 规则 | 状态 |
|---|------|------|
| R1 | 举报/屏蔽均需**登录**；未登录点入口 → **弹登录框** | ✅ |
| R2 | 不可举报/屏蔽自己的作品；不可举报自己账号；对应入口 **直接隐藏** | ✅ |
| R3 | `targetType`：`game` \| `user` \| `post`；本版 UI 仅 `game`/`user` | ✅ |
| R4 | 游戏屏蔽只写内容屏蔽表，**不**写 `user_block` | ✅ |
| R4b | 个人屏蔽过滤范围：**仅推荐流**；**搜索 / 作者主页作品 / 详情直链不滤**；P0 **只屏蔽、不解**（不做取消 UI / 已屏蔽列表） | ✅ |
| R5 | 游戏详情分享菜单仅加「举报」；他人主页用「⋯」；**不**重做分享渠道；屏蔽与举报 **不互斥** | ✅ |
| R6 | 帖子举报 UI / 帖子屏蔽：**不做**；后端允许 `post` 类型以防后续 | ✅ |

### 2.2 举报提交

| # | 规则 | 状态 |
|---|------|------|
| R7 | 必须选 1 个 `reasonCode`（来自字典，且匹配 `targetType`） | ✅ |
| R8 | 补充说明可选，trim 后 ≤ 500 字 | ✅ |
| R9 | 证据**仅图片**，可选，最多 **3** 张，单张 ≤ **5MB**，jpg/png/webp；视频不做；链接可写补充说明 | ✅ |
| R10 | 同一用户对同一 `(targetType, targetId)` 仅允许 **1 条 pending**；已有 pending 再提 → 400 `duplicate_pending` | ✅ |
| R11 | 曾「成立」→ 400 `already_upheld`；驳回未满 **7** 天 → 400 `report_cooldown`；前端 P0 **不预检入口**，提交失败 toast | ✅ |
| R12 | 提交成功：**页面 toast**「已提交，我们会尽快处理」+ **消息中心**给举报人一条受理回执；**不**提供审核进度/结果页 | ✅ |

### 2.3 举报成立 — 作品（game）

| # | 规则 | 状态 |
|---|------|------|
| R13 | **下架**：`is_public=0` 且 `moderation_status='taken_down'`；**推荐 / 他人主页作品列表不展示**；公开开关锁死。**搜索本版不额外按 `taken_down` 过滤**（与个人屏蔽一致）。他人互动仍受 `is_public=0` 约束 | ✅ |
| R14 | **不物理删除**；保留内容、举报、审核记录 | ✅ |
| R15 | 创作者**不可**自行改回公开，除非申诉成功或运营撤销下架 | ✅ |
| R16 | 警告：该 `file_id` 首次成立时给创作者 **1** 次警告；后续再有人对同一作品举报成立 → **不再加警告**（仍可记审核流水） | ✅ |
| R17 | 严重违规：运营勾选「严重」→ 可不记普通警告，直接施加指定处罚等级（或跳到四级） | ✅ |

### 2.4 举报成立 — 账号（user）

| # | 规则 | 状态 |
|---|------|------|
| R18 | 普通成立可选动作（可多选）：要求修改；重置头像/昵称/简介；记 1 次账号类警告；临时限制部分功能 | ✅ |
| R19 | 账号类：头像违规、昵称违规、骚扰等**不同 reason 成立可分别警告**（与「同作品只一次」不同） | ✅ |
| R20 | **违规重置**（运营勾选分项）：昵称 → 复用注册同款 `genRandomNickname()`（形如 `Kuran_a3f9c201`）；头像 → `DEFAULT_AVATAR_URL`；简介 → 清空。实现时将生成函数抽到公共模块，注册与审核共用 | ✅ |

### 2.5 举报成立 — 帖子（post，占位）

| # | 规则 | 状态 |
|---|------|------|
| R21 | 类型与理由字典预留；审核若收到 post：本版返回「帖子模块未接入」，不执行删除 | ✅ |
| R22 | 将来：删除/隐藏 + 清互动入口 + 同帖子警告只计 1 次 + 可严重升级 | 文档锁定，实现后置 |

### 2.6 警告与处罚阶梯

| # | 规则 | 状态 |
|---|------|------|
| R23 | 警告来源：作品成立 / 帖子成立 / 账号成立 / 平台巡查（运营手工记警告） | ✅ |
| R24 | 同作品/同帖子只计 1 次警告（多人举报不叠加） | ✅ |
| R25 | **警告有效期**：滚动 **365** 天（见 §2.6.1）；触发一级后相关警告 `consumed=1`；申诉通过改为 `status=revoked` 的警告**也不计入**下次「凑满 3 次」与 `ownerWarningCount` | ✅ |
| R26 | **一级**：有效警告累计 ≥ 3 → 禁发作品/帖子 **7** 天；已发内容可展示（违规除外）；可登录浏览评论 | ✅ |
| R27 | 一级处罚结束后进入 **7** 天观察期；**观察期内再次违规（获警告）→ 处罚升级为二级** | ✅ |
| R28 | **二级**：禁发 **30** 天；**个人主页对外不可展示**（本人可进可编辑，访客见「因违规暂不可见」，管理员可看）；活动/推荐/榜单限制可做；**收益/结算暂停本版不做** | ✅ |
| R29 | 二级处罚结束后进入 **7** 天观察期；**观察期内再次违规 → 升级为三级** | ✅ |
| R30 | **三级**：禁发 **90** 天；冻结创作者身份；进重点风控；期满后新发 **先审后发**；**收益暂停本版不做** | ✅ |
| R31 | 三级处罚结束后进入 **30** 天观察期；**观察期内再次违规 → 可升级为四级**（或由运营判定四级） | ✅ |
| R31b | **观察期通则**：处罚期满后进入对应观察期；观察期内再获警告/成立违规 = **直接升一级处罚**，不重新走「凑满 3 次警告」；观察期结束后无新违规则观察解除，之后警告重新按 365 天滚动累计 | ✅ |
| R32 | **四级**：永久禁发；取消创作者身份；下架其全部**已标记违规**作品（非一键删全站）；禁止再申请创作者认证；情节严重可禁登录 | ✅ |
| R33 | **严重直达**（管理端勾选并指定 `penaltyLevel`=1～4）：**跳过**「凑满 3 次警告」阶梯，**直接**记对应等级处罚。同一次成立：**只写一条 penalty**，**不写** warning、**不增加**有效警告计数、**不**再跑「因本次警告触发自动升 L1」。对用户只发 **一条** 处罚类 `moderation` 通知（禁止「警告通知 + 处罚通知」双发）。内容类处置（下架、重置资料等）可与直达并存，与警告档位互斥 | ✅ |
| R34 | 处罚期满：发布权限自动恢复（三级需保持「先审后发」标记直至运营关闭） | ✅ |

#### 2.6.1 「滚动 365 天」与「consumed」白话说明

**不是**页面上有个会滚动的控件，而是**计数规则**：

```
今天 = 2026-10-14
只统计：created_at ≥ 今天往前推 365 天
        且 consumed=0
        且 status <> 'revoked'
        的警告条数
满 3 条 → 触发一级处罚
触发后：这 3 条（或当时参与计数的）警告打上 consumed=1
之后重新从 0 开始攒（观察期规则另算）
```

`countActiveWarnings` / 详情 `ownerWarningCount` 同一套条件。申诉通过只把目标警告改成 `revoked`，**不要求**再改 `consumed`。驳回不改原警告。近期流水仍保留已撤销警告和申诉，方便核对。

| 例子 | 结果 |
|------|------|
| 2025-01 有 1 次警告，2026-10 又来 2 次 | 2025-01 那次已超过 365 天，**不算**；有效只有 2，不触发一级 |
| 近一年内有 3 次未消耗警告 | 触发一级；这 3 条变 `consumed=1` |
| 两次警告，其中一次申诉通过（`revoked`） | 有效警告是 **1**，不是 2 |
| 一级刚结束，观察期内又获 1 次警告 | 不走「再凑 3 次」，**直接升级二级** |
| 二级结束后 7 天观察期内再违规 | **直接升级三级** |
| 三级结束后 30 天观察期内再违规 | **可升级四级** |

### 2.7 申诉（P1）

| # | 规则 | 状态 |
|---|------|------|
| R35 | 可申诉：作品下架、帖子删除、账号警告、发布限制、创作者冻结、账号封禁 | ✅ |
| R36 | 处罚通知后 **7** 天内可申；每条警告/处罚记录原则上 **1** 次（`hasAppealed` / `canAppeal`） | ✅ |
| R37 | 须选申诉问题类型（`reasonCode`，来自 `GET /report/reasons?targetType=appeal`）+ 描述长文 + 证据图；平台 **3～7** 工作日复核 | ✅ |
| R38 | 成功：撤销处罚/恢复内容/恢复功能；失败：维持 | ✅ |
| R39 | 对外只用 16 位 `moderation_id` / `appeal_id`；提交体字段为 `relatedModerationId`，不用库内自增 id | ✅ |
| R40 | 用户底栏：`canAppeal=true` 可点「申诉」；已申过或不可申则灰掉，**不做**「再次申诉」 | ✅ |

### 2.7b 运营主动撤销警告 / 处罚（误操作纠错，非申诉）

> **目的**：运营误触警告或当前处罚时，可主动撤销；与「用户申诉通过」分流。  
> **原则**：只终止**当前这条**产生的限制；**不**自动退回上一档；**不**删改其他历史流水。第一版用户侧列表**仍显示「已撤销」**，不可再申诉。

| # | 规则 | 状态 |
|---|------|------|
| R41 | **处罚**：只能撤销**当前生效档**（与 `user_punishment.active_penalty_level` 对应的那条）；历史已结束的更低档 **不能**撤 | ✅ 产品锁定 2026-10-27 |
| R42 | 撤销当前处罚后：该条立即 `revoked` 并清除**本条造成的**热限制（含禁发/主页隐藏/冻结/先审/观察期/**禁登录**）；**不**把已 `finished` 的上一档重新激活 | ✅ |
| R43 | 「不修改其他处罚/警告/历史」= 不改写、不删除其他流水行；若确有其他**仍独立生效**的限制则继续执行（现网多为单份热快照，撤当前档通常等同清空该用户热状态） | ✅ |
| R44 | **警告**：仅当**未被消耗**（`consumed=0` 且未因本警告链触发升档）时可**单独**撤销；已用于「满 3 次升一级」的警告 **不能单撤**，要处理则撤销**整次升档处罚** | ✅ |
| R45 | **作品下架**：撤销本条关联的下架时，仅当该作品**没有其他未撤销的有效下架原因**（如另一次举报仍使 `taken_down`）才恢复上架；否则暂不恢复 | ✅ |
| R46 | 目标上若有**处理中申诉**（`pending`），仍允许运营撤销；申诉自动关闭为 **`cancelled`（取消）**，**不要**记成 `approved`/`rejected`（避免文案打脸）；撤销站内信已说明结果，申诉侧可不另发成功/失败模板 | ✅ |
| R47 | 权限：`operator` ∪ `admin`；入口：运营**举报详情 / 处罚详情**历史与当前处罚区。**不做**发布审核（`publish_review`）撤销 | ✅ |
| R48 | 撤销后发站内信（`record_type=moderation_revoke`，通用文案一条）；用户侧违规列表**仍展示**该条并标「已撤销」，`canAppeal=false` | ✅ |

**通用撤销站内信文案**：

> 您此前收到的账号违规警告/处罚已撤销，相关限制及处罚记录已解除。本次撤销不会对账号后续使用产生影响。给您带来的不便，我们深表歉意。

**接口（拟）**：`POST /api/admin/moderation/:moderationId/revoke`（`:moderationId` 为 16 位；可选 body `reviewNote`）。副作用复用申诉通过中的撤流水 / 清热状态 / `restoreTakenDownGame`（无其他有效下架时），再写 `moderation_revoke` 通知行。

### 2.8 运营权限与可执行动作

| 角色 | 能力 |
|------|------|
| `operator` / `admin` | 入口：`AdminPanel` 新 Tab「内容举报」；看列表/详情、通过/驳回、选处置、手工警告/处罚、撤销下架、**撤销当前警告/当前生效处罚**（§2.7b）、看申诉（P1） |
| 仅 `admin` | **施加**四级永久封禁登录、注销创作者身份、改风控名单开关（**解禁登录**见动作表：admin/operator） |

**审核通过时可选处理包（UI 勾选，后端校验组合合法）**：

| 处理码 | 含义 | 适用 |
|--------|------|------|
| `reject` | 驳回举报 | 全部 |
| `uphold_takedown` | 下架作品 | game |
| `uphold_reset_profile` | 重置头像/昵称/简介（分项） | user |
| `uphold_warn` | 记警告（若该内容未记过则记） | 全部 |
| `uphold_restrict_publish` | 临时禁发 N 天（手工） | user/creator |
| `uphold_penalty_l1`…`l4` | 直接套处罚等级 | 严重 |
| `uphold_hide_homepage` | 主页不可展示 | user |
| `uphold_freeze_creator` | 冻结创作者身份 | user |
| `uphold_ban_login` | **施加**禁登录（审核成立 / L4 勾选） | **仅 admin**（operator 提交 → 403） |
| （独立接口）`POST /api/admin/moderation/clear-login-ban` | **解除**禁登录 | **admin / operator**（与「申诉通过」一致；运营不能封禁，但可解禁） |
| （独立接口）`POST /api/admin/moderation/:moderationId/revoke` | **运营撤销**当前警告 / 当前生效处罚（§2.7b） | **admin / operator**；非当前档 / 已消耗警告 → 4xx |

### 2.9 通知（消息中心 + toast）

**实现方式**：只扩展现有消息中心允许的 `message_type`，**不**建 `moderation_notifications` 表。  
建议类型：`report_received`（给举报人）、`moderation`（给被处理创作者）。读写复用 `user_message_reads`。

| 对象 | 时机 | 形态 | 文案 |
|------|------|------|------|
| 举报人 | 提交成功当下 | **Toast**（页面顶部/底部短暂提示，几秒消失） | `已提交，我们会尽快处理` |
| 举报人 | 提交成功后 | **消息中心**一条（可回看） | `我们已收到你的举报，将尽快处理。`（不展示进度/结果） |
| 创作者 | 作品成立 | 消息中心 | 你的作品因违反平台规范已被下架，并记为一次警告。请查看违规原因并避免再次违规。 |
| 创作者 | 帖子成立 | 消息中心 | 你的帖子因违反平台规范已被删除，并记为一次警告。请查看违规原因并避免再次违规。 |
| 创作者 | 账号成立 | 消息中心 | 你的账号信息或行为因违反平台规范已被处理，并记为一次警告。请及时修改相关内容。 |
| 创作者 | 一级处罚（凑满 3 次警告自动触发，或严重直达选一级） | 消息中心 | 由于你在警告有效期内累计达到 3 次警告，平台将限制你 7 天内发布作品和帖子。处罚结束后，账号将进入 7 天观察期。（严重直达一级可用等价处罚语气，**不再另发**「记为一次警告」那条） |
| 创作者 | 严重直达二～四级 | 消息中心 | 仅 **一条** 对应等级处罚通知；**不得**再附带同单警告通知 |
| 创作者 | 运营主动撤销警告/处罚（§2.7b） | 消息中心 | `recordType=moderation_revoke`；标题建议「违规处理撤销通知」；正文用 §2.7b 通用文案；**不可申诉** |

（二～四级文案同语气补全。消息数字 `sourceId` **只用于标已读**；跳转违规页用 16 位 `moderationId`，跳转申诉结果用 16 位 `appealId`；撤销通知用 `recordType=moderation_revoke` 识别。）

**通知互斥（锁定）**：同一次 `uphold` 对创作者可见结果取**最高处置档**。有 `penaltyLevel` 时最高档即该处罚，源头只产处罚记录与一条通知，**禁止**先写警告再写处罚再双推。

### 2.10 口径已全部锁定（原待确认项）

| # | 结论 |
|---|------|
| Q1 | 警告滚动 365 天 + 触发一级后 consumed（§2.6.1） |
| Q2 | 二级后观察期 **7** 天；三级后观察期 **30** 天；观察期内再违规则处罚升级 |
| Q3 | 重置昵称 = `genRandomNickname()`；头像 = `DEFAULT_AVATAR_URL`；简介清空（R20） |
| Q4 | 举报人：toast + 受理站内信；无进度/结果页 |
| Q5 | 二级主页隐藏：本人可进可编辑 + 顶栏「对外暂不可见」；访客「因违规暂不可见」（P0.5） |
| Q6 | 暂停收益/停结算：**本版不做** |
| Q7 | 管理入口：内容安全分组；P0 举报审核 + 处罚记录只读；`admin`+`operator` 可审；**施加**禁登录仅 admin；**解禁登录** admin/operator |
| Q8 | 证据本版**仅图片**（≤3，单张 ≤5MB）；仅上传成功计入名额 |
| Q9 | 屏蔽只滤推荐；搜索/作者主页不滤；只屏蔽不解 |
| Q10 | 用户信息下发：`publishBanUntil`（P0）/ `homeHidden`（P0.5）挂 `GET /auth/user/info` |
| Q11 | R11 错误码：`already_upheld` / `report_cooldown`（及已有 `duplicate_pending`） |
| Q12 | `moderation` 消息可选 `relatedGameId`；消息中心新建分区「安全 / 违规」 |
| Q13 | **严重直达**：`penaltyLevel` 有值时只记处罚、不记警告、只发一条处罚通知（见 R33、§5.2.1）；前端直达请求不带 `uphold_warn` |

---

## 3. 状态机

### 3.1 举报单 `user_report.status`

```
pending ──review(reject)──► rejected
   │
   └──review(uphold*)──► upheld
```

不可从终态回 pending；撤销处罚走独立 `moderation_action` / 申诉，不改写原举报结论（可追加 `reversed_at`）。

### 3.2 创作者处罚（存于 `creator_moderation`，`record_type=penalty`）

```
（警告累计）──► L1(active) ──expire──► L1_done + 观察7d
                      │（观察期内再违规 → 升级）
                      └──► L2(active) ──expire──► L2_done + 观察7d
                             │（观察期内再违规 → 升级）
                             └──► L3(active) ──expire──► L3_done + 观察30d
                                    │（观察期内再违规 → 升级）
                                    └──► L4(permanent)
严重直达：pending_report ──► L1|L2|L3|L4
         （不经 warning；不写同单 warning 行）
```

### 3.3 作品审核态 `games.moderation_status`

```
none ──takedown──► taken_down ──(appeal_ok|admin_restore)──► none
```

`taken_down` 时强制 `is_public=0`；发布接口若目标为公开则 403。

---

## 4. 数据模型（P0：5 张新表 + `games` 增量）

> **合并原则**：警告 + 处罚 +（P1）申诉 → 一张 `creator_moderation`；**当前处罚热状态** → 独立 `user_punishment`（1 用户 1 行，不往 `user` 加列）；通知不建表，消息源复用业务表。

| 新表 | 职责 |
|------|------|
| `report_reason` | 理由字典 |
| `user_report` | 举报单 + 审核审计 |
| `user_content_block` | 屏蔽游戏（≠ `user_block`） |
| `creator_moderation` | 警告 / 处罚 /（P1）申诉 **历史流水** |
| `user_punishment` | 创作者**当前**处罚快照（禁发到何时、藏主页等） |

**相对更早草案**：不把风控热字段堆进 `user`；不建独立通知表 / 独立 appeal 表。

### 4.1 `report_reason`（理由字典）

| 字段 | 说明 |
|------|------|
| `id` | INTEGER PK |
| `code` | TEXT UNIQUE，如 `game_porn` |
| `target_type` | `game` \| `user` \| `post` |
| `title` | 短标题，如「色情低俗」 |
| `description` | 说明文案 |
| `sort_order` | INTEGER |
| `is_active` | 0/1 |
| `created_at` / `updated_at` | TEXT |

> **已砍**：`severity_level_hint`。严重与否由运营在审核时手选处罚动作，不必字典预标。

**种子（游戏）**：`game_porn` / `game_political_rumor` / `game_political_sensitive` / `game_offsite_guide` / `game_bad_values` / `game_plagiarism` / `game_incitement` / `game_minor_harm` / `game_malware`（文案同产品原文）。  

**种子（账号建议）**：`user_avatar_violation` / `user_nickname_violation` / `user_bio_violation` / `user_impersonation` / `user_harassment` / `user_fraud` / `user_other`。  

**种子（帖子占位）**：`post_*` 前缀，后续替换。

### 4.2 `user_report`

| 字段 | 说明 |
|------|------|
| `id` | INTEGER PK |
| `reporter_user_id` | 举报人 |
| `target_type` | game/user/post |
| `target_id` | file_id / userId / postId |
| `target_owner_user_id` | 被举报主体所属用户（游戏=创作者） |
| `reason_code` | 理由 code |
| `reason_title_snapshot` | 提交时标题快照 |
| `detail` | 补充说明 |
| `target_title_snapshot` | 提交时对象标题/昵称快照（游戏 title / 用户 nickname），防事后改名导致运营列表空白 |
| `evidence_urls` | JSON 数组（R2 keys） |
| `status` | pending / rejected / upheld |
| `reviewer_user_id` / `reviewed_at` / `review_note` | 审核 |
| `handle_actions` | JSON：执行的处理码 |
| `warned` | 0/1 本次是否新产生警告 |
| `penalty_level_applied` | NULL 或 1..4 |
| `created_at` / `updated_at` | |

索引：`(status, created_at DESC)`；`(target_type, target_id)`；pending 唯一用应用层保证。

### 4.3 `user_content_block`

| 字段 | 说明 |
|------|------|
| `id` | PK |
| `blocker_user_id` | 谁屏蔽 |
| `target_type` | `game` \| `post` |
| `target_id` | |
| `created_at` | |
| UNIQUE `(blocker_user_id, target_type, target_id)` |

不与 `user_block` 合并：人屏蔽与内容屏蔽语义、现网接口、唯一键都不同，硬揉会污染账号社交。

### 4.4 `creator_moderation`（警告 + 处罚 + P1 申诉）

| 字段 | 说明 |
|------|------|
| `id` | PK（库内自增；**用户接口不暴露**） |
| `user_id` | 创作者 |
| `record_type` | `warning` \| `penalty` \| `appeal`（appeal=P1） |
| `level` | 仅 penalty：1..4；其它 NULL |
| `status` | warning 用 `active`/`consumed`/`revoked`；penalty 用 `active`/`finished`/`revoked`；appeal 用 `pending`/`approved`/`rejected` |
| `dedupe_key` | 仅 warning：如 `game:{fileId}`；UNIQUE(user_id, dedupe_key) WHERE record_type=warning（应用层保证亦可） |
| `source_type` / `source_id` | game/post/user/patrol + 对应 id |
| `report_id` | 关联举报，可空 |
| `related_id` | appeal 指向被申诉行的**库内自增 id**；可空。**用户接口不暴露**，对外用 `relatedModerationId`（= 被申诉行的 `moderation_id`） |
| `moderation_id` | 仅 `warning` / `penalty`：16 位对外编号（13 位毫秒 + 3 位随机，字符串）。写入时生成；存量可补数。申诉行不用 |
| `appeal_id` | 仅 `appeal`：16 位对外编号。详情路径与跳转用它，不用自增 `id` |
| `starts_at` / `ends_at` | penalty 起止；L4 的 ends_at 可空 |
| `observation_until` | 处罚结束后观察截止 |
| `expires_at` | warning 过期时间 = created_at+365d（便于查询；也可运行时算） |
| `consumed` | warning：是否已用于触发一级 |
| `effects_json` | penalty 生效快照：禁发/藏主页/冻创作者/先审后发等（**不含停结算**） |
| `notify_body` | 写入时固化的站内信正文（创作者消息中心直接展示；模板生成一次） |
| `reason` / `evidence_urls` | appeal 用；warning/penalty 可空 |
| `reviewer_user_id` / `reviewed_at` / `review_note` | 人工处理 |
| `created_by` | `system` / adminUserId |
| `created_at` / `updated_at` | |

#### 4.4.1 消息中心如何「不新建通知表」

现网消息中心是：**各业务表当消息源** + `user_message_reads` 记已读（见 `favorite_game_updated` → `game_favorite_update_notifications`）。

本计划同样：

| message_type | 消息源 | 已读 `sourceId` | 跳转与额外字段 |
|--------------|--------|------------------|----------------|
| `report_received` | `user_report`（举报人=当前用户） | `user_report.id`（数字） | 只展开正文 |
| `moderation` | `creator_moderation`（**warning / penalty / appeal**，user_id=当前用户） | 消息数字 `id`（**只用于 mark-read**） | 见下表 |

正文：举报人侧固定「已受理」文案；创作者侧读 `notify_body`。  
前端列表分区：**「安全 / 违规」**（与系统/活动/互动并列）。  
`MessageCenterService` 需扩展聚合这两路；**仍不建** `moderation_notifications`。

| `recordType` | 跳转 | 「查看作品」 | 列表卡额外字段 |
|--------------|------|--------------|----------------|
| `warning` / `penalty` | `moderationId`（16 位）→ `/moderation/{moderationId}`；审核详情底栏申诉带 `relatedModerationId` | 有 `relatedGameId` → **`/createGame?mode=stats&gameId=`**（不进公开 `/game/:id`） | 短 `reason`；`startsAt` / `endsAt`（纯警告常无 `endsAt`） |
| `appeal` | `appealId`（16 位）→ `/appeals/{appealId}`。**不出**「去申诉」 | 有 `relatedGameId` 则可出（同上 stats） | `appealedAt`、`status`（`approved` / `rejected` / `pending`） |

前端禁止把 16 位 id `Number()` 后再请求（超过安全整数会丢精度）。

### 4.5 `user_punishment`（当前处罚快照，1 用户至多 1 行）

> **不往 `user` 加列**：`user` 已够胖；发布/主页高频读时与 privacy/block **并行点查**一行即可（PK=`user_id`，无行=无限制）。  
> **体感**：现网主页已查 privacy + block + 关注计数；多 1 次主键读可忽略，远低于关注计数。不要串成「先 punishment 再 privacy」两段瀑布，除非 `homepage_hidden` 命中后要提前返回（可仍与 user 解析并行启动）。

| 字段（库 snake_case） | 说明 |
|------|------|
| `user_id` | PK，同 `user.userId` |
| `publish_blocked_until` | 禁发截止；NULL=不禁 |
| `homepage_hidden` | 0/1 |
| `creator_frozen` | 0/1 |
| `publish_need_review` | 0/1 先审后发 |
| `in_risk_list` | 0/1 |
| `login_banned` | 0/1 |
| `active_penalty_level` | 0..4 |
| `observation_until` | 观察期截止 |
| `updated_at` | 最后同步时间 |

- **无行** = 无任何处罚限制（与「全 0/NULL」等价，实现任选：懒创建 or 默认空）  
- 处罚生效/到期：写 `creator_moderation` 流水 **同时** upsert 本表  
- 历史真相仍以 `creator_moderation` 为准；本表只服务「现在能不能发 / 主页藏不藏」  
- **对外 API 短名**（挂 `GET /auth/user/info` 及登录 `user`，表结构不往 `user` 加列）：  
  - `publishBanUntil` ← `publish_blocked_until`（**P0**；前端灰创建/发布）  
  - `homeHidden` ← `homepage_hidden`（**P0.5**；本人主页顶栏）

### 4.6 `games` 增量（全站下架锁；**不能**只靠 `is_public`）

| 字段 | 说明 |
|------|------|
| `moderation_status` | `none` \| `taken_down`，默认 `none` |
| `moderation_at` | 下架时间 |
| `moderation_report_id` | 关联举报 id |

**为何保留 `moderation_status`，而不是只改 `is_public`：**

| | 仅 `is_public=0` | `is_public=0` + `moderation_status=taken_down` |
|--|------------------|-----------------------------------------------|
| 对外不可见 | ✅ | ✅ |
| 创作者能否再点「公开」 | ❌ 现有发布逻辑通常允许他改回 1 | ✅ 发布接口对 `taken_down` 直接 403 |
| 语义 | 分不清「自己下架/未发布」还是「违规被锁」 | 明确是风控锁 |
| 申诉恢复 | 只能盲改 is_public | 清 `taken_down` 后再允许公开 |

下架时：**两个都改**（`is_public=0` 立刻藏起来 + `taken_down` 上锁）。  
只改 `is_public` **能藏，但锁不住**，产品上不规范（漏洞级），不是风格偏好问题。

### 4.7 运营列表字段来源

举报人/被举报人/类型/对象/理由/说明/证据/审核结果/处理方式/是否警告/处罚等级/审核人/时间 → 主要来自 **`user_report`**；警告与处罚历史 → **`creator_moderation`**；当前限制 → **`user_punishment`**；申诉（P1）→ `creator_moderation.record_type=appeal`。

列表与详情在读 `user_report` 时**补查**当前昵称 / `userCode` / 游戏当前标题，**不把昵称写入举报表新列**。`target_title_snapshot`（API 的 `targetTitle`）仍是提交时快照，游戏展示用 `gameTitle`。

| 字段 | 说明 |
|------|------|
| `reporterNickname` / `reporterUserCode` | 举报人当前昵称与主页码；空或用户不存在 → `null` |
| `targetOwnerNickname` / `targetOwnerUserCode` | 账号举报=被举报人；游戏举报=创作者。跳转 `/account/{targetOwnerUserCode}`，`null` 不可点 |
| `gameTitle` | **仅** `targetType=game`：`games.title` 当前值；作品不存在 → `null`，前端写「作品已不存在」，**不回退** `targetTitle`。账号/帖子不带此键 |
| `ownerWarningCount` | 近 365 天、`consumed=0`、`status <> revoked` 的警告数；`0` 也返回 |
| `ownerPunishment` | 当前处罚快照；无则 `null` |
| `ownerModerationHistory[].id` | warning/penalty → 16 位 `moderation_id`；appeal → 16 位 `appeal_id`；未补数可为 `null` |

---

## 5. 接口契约

### 5.1 用户侧

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/report/reasons` | 登录 | 按类型拉理由（`game` / `user` / `post` / `appeal`） |
| POST | `/api/report` | 登录 | 提交举报 |
| POST | `/api/report/evidence` | 登录 | 上传证据图，返回 key/url |
| POST | `/api/content/block` | 登录 | 屏蔽游戏（或预留 post） |
| DELETE | `/api/content/block` | 登录 | 取消屏蔽（接口可留；**P0 前端不调用**） |
| GET | `/api/content/blocked` | 登录 | 我的屏蔽列表（**P0 不做 UI**） |
| GET | `/api/moderation/:moderationId` | 登录 | 警告/处罚详情；`:moderationId` 为 16 位字符串；本人可查，否则 404（admin/operator 见 §5.2） |
| GET | `/api/appeals/eligible` | 登录 | 可申诉列表；`eligible[].id` 为 16 位 `moderation_id` |
| POST | `/api/appeals/evidence` | 登录 | 申诉证据上传 |
| POST | `/api/appeals` | 登录 | 提交申诉 |
| GET | `/api/appeals` | 登录 | 我的申诉列表 |
| GET | `/api/appeals/:appealId` | 登录 | 申诉详情；`:appealId` 为 16 位；本人可查 |

#### 5.1.1 理由列表

```http
GET /api/report/reasons?targetType=game
Authorization: Bearer …
```

**Response `data`：**

```json
{
  "list": [
    {
      "code": "game_porn",
      "title": "色情低俗",
      "description": "游戏内容包含色情、低俗、擦边等不适宜内容",
    }
  ]
}
```

#### 5.1.2 提交举报

```http
POST /api/report
```

| 字段 | 类型 | 约束 |
|------|------|------|
| `targetType` | string | game/user/post |
| `targetId` | string | 必填 |
| `reasonCode` | string | 必填且 active |
| `detail` | string | 可选 ≤500 |
| `evidenceKeys` | string[] | 可选 ≤3 |

**成功：**

```json
{
  "success": true,
  "message": "已提交，我们会尽快处理",
  "data": { "reportId": 123, "status": "pending" }
}
```

**错误**（须稳定 `code`，前端提交失败 toast，不预检入口）：

| code | 含义 |
|------|------|
| `invalid_reason` | 理由无效 / 与 targetType 不匹配 |
| `duplicate_pending` | 已有 pending（R10） |
| `already_upheld` | 同用户同对象曾成立（R11） |
| `report_cooldown` | 驳回后未满 7 天（R11） |
| `cannot_report_self` | 举报自己 |
| `target_not_found` | 对象不存在 |
| 401 / 403 | 未登录或无权限 |

#### 5.1.3 屏蔽内容

```http
POST /api/content/block
{ "targetType": "game", "targetId": "file_xxx" }
```

幂等；成功后 **仅推荐流**不再出现（搜索 / 作者主页 / 详情不因屏蔽隐藏）。

#### 5.1.4 警告 / 处罚详情

```http
GET /api/moderation/1792330349103001
```

`:moderationId` 与 `data.id` 均为 **16 位字符串**（`moderation_id`）。不接受自增数字路径。申诉行走此路径 → 404（`code: use_appeals_endpoint`），改走 `/api/appeals/:appealId`。

鉴权：普通用户只能查本人；admin / operator 可查任何人。

除 `recordType` / `level` / `status` / `notifyBody` / `reportId` / `reasonCode` / `reasonTitle` / `reportDetail` / `sourceType` / `sourceId` / 时间外，必带：

| 字段 | 说明 |
|------|------|
| `hasAppealed` | 是否已有申诉（任意状态） |
| `canAppeal` | 未申诉、状态为 `active` / `consumed` / `finished`、且在 7 天内为 `true`；已申诉或已撤销为 `false` |
| `appealId` | 已有 16 位申诉编号则返回字符串，否则 `null` |

用户审核详情页底栏：`canAppeal === true` 可点「申诉」，`relatedModerationId` = 本接口 `id`。已申过灰掉，不做「再次申诉」。顶栏头像/昵称走当前登录用户。

#### 5.1.5 提交申诉

```http
POST /api/appeals
```

```json
{
  "relatedModerationId": "1792330349103001",
  "reasonCode": "appeal_mute",
  "reason": "申诉描述",
  "evidenceKeys": ["interactive-fiction-appeal-evidence/..."]
}
```

| 字段 | 说明 |
|------|------|
| `relatedModerationId` | 被申诉警告/处罚的 16 位 `moderation_id`（= 详情 `id`） |
| `reasonCode` | `targetType=appeal` 的字典 code |
| `reason` | 描述长文 |
| 返回 `appealId` | 16 位字符串；跳转 `/appeals/{appealId}` |

#### 5.1.6 申诉详情

```http
GET /api/appeals/:appealId
```

用户、admin、operator **同一路径同一响应**。非本人且不是 staff → 404。`GET /api/admin/appeals/:id`、`GET /api/operator/appeals/:id` 已去掉。

`id`、`relatedModerationId`、`target.id` 均为 16 位字符串。详情可多带 `ownerPunishment`（没有则为 `null`），用户页忽略。

| 页面行 | 字段 |
|--------|------|
| 违规对象 | 有 `gameTitle` 用作品名；否则 `账号"{targetOwnerNickname}"`；昵称 `null` →「未设置昵称」 |
| 申诉理由 | `reasonTitle`（短标签）；`null` → `—` |
| 申诉描述 | `reason` |
| 申诉证据 | `evidenceUrls`（R2 key 或绝对 URL；空数组 → `—`）。前端 `getImageUrl`，后端不必改成绝对 URL |

### 5.2 管理端 / 运营端

路径风格对齐现网：写操作与列表仍走 `/api/admin/...`，鉴权 `admin` **或** `operator`（**施加**禁登录仅 admin；**解禁** `POST /api/admin/moderation/clear-login-ban` 与申诉通过同权）。**不提供** `/api/operator` 别名。详情类 GET 与用户侧共用资源路径（见 §5.1.4 / §5.1.6）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/reports` | 列表：`status` / `targetType` / `keyword` / 精确 `targetOwnerUserId` / `reporterUserId` |
| GET | `/api/admin/reports/:id` | 详情：§4.7 字段 + 历史警告/处罚 |
| POST | `/api/admin/reports/:id/review` | 审核 |
| POST | `/api/admin/moderation/warn` | 巡查手工警告 |
| POST | `/api/admin/moderation/penalty` | 手工开处罚 |
| POST | `/api/admin/moderation/clear-login-ban` | **解除禁登录**（body: `{ userId }`；**admin / operator**；与申诉通过同权） |
| POST | `/api/admin/moderation/:moderationId/revoke` | **运营撤销**当前警告 / 当前生效处罚（§2.7b；16 位 id；可选 `reviewNote`） |
| POST | `/api/admin/moderation/restore-game` | 撤销下架 |
| GET | `/api/admin/penalties` | 处罚列表；`id` 为 16 位 `moderation_id` |
| GET | `/api/moderation/:moderationId` | 警告/处罚详情（与用户同一条） |
| GET | `/api/admin/appeals` | 运营申诉列表（不与「我的列表」合并） |
| GET | `/api/appeals/:appealId` | 申诉详情（与用户同一条） |
| POST | `/api/admin/appeals/:id/review` | 申诉审核写入 |

列表筛选：`targetOwnerUserId` / `reporterUserId` 从行上的 userId 带过去，不用昵称。`keyword` 仍匹配不到「只看这个游戏创作者」。

展示口径：昵称 `null` →「未设置昵称」；账号举报不再单独出「对象」块；游戏对象只看 `gameTitle`；点历史 warning/penalty → `GET /api/moderation/:id`，点申诉 → `GET /api/appeals/:appealId`，不要把当前举报单理由套到所有历史记录上。

#### 5.2.1 审核

**普通成立（无严重直达）示例**：

```http
POST /api/admin/reports/:id/review
{
  "decision": "uphold",
  "actions": ["uphold_takedown", "uphold_warn"],
  "penaltyLevel": null,
  "resetFields": ["avatar", "nickname", "bio"],
  "reviewNote": "内部备注",
  "restrictDays": null
}
```

**严重直达示例**（只处罚，不带警告动作）：

```http
POST /api/admin/reports/:id/review
{
  "decision": "uphold",
  "actions": ["uphold_takedown"],
  "penaltyLevel": 1,
  "reviewNote": "内部备注"
}
```

账号严重直达若需重置资料：`actions` 可含 `uphold_reset_profile` + `resetFields`，**仍不得**含 `uphold_warn`。

**分支与副作用顺序（uphold）**：

1. 校验 report pending  
2. 执行**内容类** actions（下架 / 重置资料 / …）。严重直达时若请求仍含 `uphold_warn`：后端应**忽略**或 **400**（推荐忽略并按直达执行，避免双写）  
3. **若 `penaltyLevel` ∈ {1,2,3,4}（严重直达）**：  
   - **只**写一条 `creator_moderation`（`record_type=penalty`，对应 level）+ upsert `user_punishment`  
   - **不写** warning；**不增加**有效警告计数；**不**因「本次警告」触发凑满升档  
   - 消息中心 **只发一条** 处罚类 `moderation` 通知  
4. **否则（普通成立）**：  
   - 若 actions 含 `uphold_warn`（或默认需警告）：按 dedupe 写入 warning  
   - 若有效警告累计达阈值 → 再写 penalty + upsert `user_punishment`，并按规则通知（凑满升档场景可有警告通知 + 处罚通知，因来自「警告阶梯」而非同单直达叠写）  
5. 更新 report 终态与审计字段  

**互斥（锁定）**：同一次 review **禁止**「先写 warning 再因同单 `penaltyLevel` 再写 penalty」的叠加路径；有 `penaltyLevel` 则走第 3 步，不走第 4 步的写警告。

**错误**：404；409 非 pending；400 动作与 targetType 不匹配（及可选：直达却强制要求带 `uphold_warn` 的冲突）。

### 5.3 行为变更（现有接口）

| 接口/能力 | 变更 |
|-----------|------|
| **推荐流** | 排除 `moderation_status=taken_down`；排除当前用户 `user_content_block` |
| **作者主页作品列表（访客）** | 排除 `taken_down`；**不**因 `user_content_block` 过滤 |
| **搜索** | **本版不**因 `taken_down` / 个人屏蔽额外过滤（见前端交互 §4.2） |
| 创作者作品列表 / owner 详情 | 返回 `moderationStatus`（含 `taken_down`），供「违规下架」标签与锁公开开关 |
| 游戏设为公开 | `taken_down` 时 403 |
| 发布作品/帖子 | `publish_blocked_until > now` 时 403，文案「账号处于发布限制中」 |
| `GET /auth/user/info`（及登录 user） | 增加 `publishBanUntil`（P0）、`homeHidden`（P0.5）；见 §4.5 |
| 个人主页 GET | `homepage_hidden=1`：本人与管理员正常进（本人可出顶栏提示）；其它访客空态「因违规暂不可见」 |
| 消息中心 | 允许 `report_received`、`moderation`；可选 `relatedGameId`；违规跳转带 `moderationId`，申诉结果带 `appealId`；`sourceId` 只用于已读；前端分区「安全 / 违规」 |

---

## 6. 前端交互

> 细化口径见 `.cursor/doc/前端交互.md`；本节为计划书内摘要。

### 6.1 游戏详情 · 分享菜单

- 现有分享（复制链接 / 二维码等）**保留**  
- 菜单底部增加 **举报**（危险色/次要样式）+ **P0 必展示** §0 说明文案  
- 点击 → 打开 `ReportSheet`（一套组件 + 响应式：窄屏底栏 / 宽屏居中）：  
  1. `GET /api/report/reasons?targetType=game`  
  2. 单选理由（title + description）  
  3. 补充说明（选填 ≤500）  
  4. 证据：选图先上传；**仅成功**计入已选（≤3）；失败 toast、不占名额  
  5. 提交 → toast「已提交，我们会尽快处理」→ 关闭；后端写举报人站内信  
- 提交失败（含 R11）→ toast `message`/`code`，不预禁用入口  
- **不改**：分享到 QQ/朋友圈/粉丝  

### 6.2 首页推荐 · 长按 / 右键

| 项 | 口径 |
|----|------|
| 范围 | **仅首页推荐**；搜索/榜单/作者主页作品卡 **不做** |
| 移动端 | 长按 |
| 桌面端 | 右键 |
| 菜单 | **屏蔽**、**举报**（独立、不互斥） |

```
长按/右键
  ├─ 屏蔽 → Confirm「屏蔽后将不再出现在推荐中」→ POST /api/content/block → 推荐列表移除该项
  └─ 举报 → 同 §6.1 ReportSheet
```

推荐里先屏蔽后若要再举报 → 从详情（或作者主页进详情）进入。P0 无取消屏蔽入口。

### 6.3 他人主页 · 「⋯」

- 右上角新建 **「⋯」**，内放 **举报**（`targetType=user`）  
- 本人主页、自己的作品：**不展示**举报入口  

### 6.4 管理端

对齐 `CommentAdminManager`；信息架构见附录 A。

**P0**

- Tab：**举报审核** + **处罚记录（只读，主要一级；列表 `id` 为 16 位）**  
- 筛选：`status` / `targetType` / `keyword`，以及精确「只看此人被举报 / 此人提交」  
- 列表/详情：举报人与被举报人用当前昵称 + userId；被举报人可点进 `/account/{userCode}`；游戏对象用 `gameTitle`（`null` →「作品已不存在」）  
- 详情抽屉：证据、说明、有效警告数（不计 `revoked`）、是否观察期、当前处罚、近期记录（点开走统一 moderation / appeals 详情）  
- 成立默认勾选：游戏 = **下架 + 记警告**；账号 = **记警告**（重置资料不预勾）  
- **不**在 P0 主路径手选 L1～L4；升档靠后端自动（满 3 次警告 → 一级等）  
- 驳回 / 成立二次确认  

**P0.5**

- **严重直达**入口：手选 L1～L4，跳过凑满 3 次警告；成立后**只记该级处罚**（见 R33）  
- 前端提交：带 `penaltyLevel`；`actions` **不要**带 `uphold_warn`（重置资料只用 `uphold_reset_profile` 等）  
- **施加**禁登录：**仅 admin 可见/可勾选**（operator 不展示）；**解禁登录**：admin/operator 均可（详情「解除禁登录」→ `clear-login-ban`，与申诉通过同权）  
- 主页隐藏等升档副作用的运营可见性  

**运营纠错（§2.7b，可与 P0.5 同迭代或紧随）**

- 举报详情 / 处罚详情：可撤项出「撤销」+ 二次确认 → `POST /api/admin/moderation/:moderationId/revoke`  
- 处罚：仅当前生效档可撤；警告：仅未消耗可单撤；有 pending 申诉也可撤（申诉 → `cancelled`）  
- 用户侧：列表仍显示「已撤销」，无申诉按钮；**不做**发布审核撤销  

**不改**：现有评论审核、提现 Tab。

### 6.5 消息中心

- 新建分区：**「安全 / 违规」**（`report_received` / `moderation`）  
- `report_received`：只展开正文，不跳业务页  
- 违规通知：进 `/moderation/{moderationId}`（16 位）；有 `relatedGameId` → **「查看作品」**进 stats  
- 申诉结果：进 `/appeals/{appealId}`；**不出**「去申诉」  
- 运营撤销通知：`recordType=moderation_revoke`；展示撤销文案；**不出**申诉  
- 标已读仍用数字 `sourceId`  

### 6.6 处罚副作用（用户侧 FE）

- 读 `publishBanUntil` → 创建/发布 **前置灰掉**（P0）  
- `taken_down`：创作者列表标签「违规下架」；可编辑；公开开关锁死 + 旁注  
- `homeHidden`：访客空态；本人顶栏「对外暂不可见」（P0.5）  

### 6.7 帖子

- **本版无入口**；理由字典可先入库  

### 6.8 申诉（P1）

- 提交页 `/appeal/submit?relatedModerationId=`（16 位）；无参则先选自 `eligible`  
- 问题类型：`GET /report/reasons?targetType=appeal`；描述 + 证据图（≤3）  
- 结果页 `/appeals/:appealId`：违规对象 / `reasonTitle` / 描述 / 证据  
- 审核详情 `/moderation/:moderationId`：底栏看 `canAppeal`；可申诉则带 `relatedModerationId` 进提交页  
- Admin 申诉复核：详情调 `GET /api/appeals/:appealId`；审核仍 `POST /api/admin/appeals/:id/review`（**admin / operator** 均可「通过」，与解禁登录同权；**施加**禁登录仍仅 admin）  

---

## 7. 后端实施任务

| # | 任务 | 落点 |
|---|------|------|
| S0 | migration：5 新表（含 `user_punishment`）+ `games` 字段 + 理由种子 | `cf/migrations/…` |
| S1 | `reportReasonService` + GET reasons | |
| S2 | 证据上传 R2 + `userReportService.create` + 举报人 `report_received` 消息 | |
| S3 | `userContentBlockService`：**仅推荐**滤 block；搜索/作者主页/详情不因 block 藏 | |
| S4 | `creatorModerationService.review`：下架、warning/自动一级 penalty、upsert `user_punishment`、通知（含 `relatedGameId`）；R11 错误码 | |
| S4b | 将 `genRandomNickname` / `DEFAULT_AVATAR_URL` 抽到公共模块，注册改 import | |
| S5 | 发布/公开/主页 + **`/auth/user/info` 下发 `publishBanUntil`**；owner 列表带 `moderationStatus` | |
| S6 | Admin list/detail/review + 昵称/`gameTitle`/按人筛 + **penalties 只读列表**（16 位 id） | |
| S7 | 消息中心 ALLOWED 扩展 `report_received` / `moderation` + `relatedGameId` + `moderationId` / `appealId` | |
| S5b |（P0.5）二～四级升档、`homeHidden` 下发、严重直达、先审后发、冻创作者、禁登录 | |
| S5c |（运营纠错）`POST .../moderation/:id/revoke`：§2.7b；复用申诉通过副作用 + `moderation_revoke` 通知；pending 申诉 → `cancelled` | |
| S8 |（P1）申诉：同表 `record_type=appeal`；`appeal_id` / `moderation_id`；统一 GET `/appeals/:appealId`、`/moderation/:id`；`relatedModerationId` 提交 | |

## 8. 前端实施任务

| # | 任务 | 说明 |
|---|------|------|
| F0 | 通用 `ReportSheet`（一套响应式） | 理由/说明/证据上传成功才计入/提交/错误 toast |
| F1 | GameDetail 分享菜单挂举报 + §0 说明文案 | |
| F2 | **首页推荐**长按/右键：屏蔽+举报 | |
| F3 | AccountHomepage「⋯」账号举报；自己入口隐藏 | |
| F4 | Admin 举报审核 + 处罚记录只读（P0）；严重 UI（P0.5） | |
| F5 | 消息中心「安全/违规」+ `moderationId` / `appealId` 跳转 + `relatedGameId`「查看作品」→ **stats** | |
| F5b | `publishBanUntil` 灰发布；`taken_down` 标签/锁公开；`homeHidden` 顶栏（P0.5 用户侧） | |
| F6 |（P1）`/appeal/submit`、`/moderation/:id`、`/appeals/:appealId` + Admin 申诉复核（通过：admin/operator；施加禁登录仍仅 admin） | |
| F4b |（P0.5 Admin 下一轮）严重直达 L1–L4、先审后发、冻创作者；**施加**禁登录仅 admin，**解禁** admin/operator | |
| F4c |（运营纠错）Admin 详情「撤销」→ `.../revoke`；用户侧列表显示「已撤销」+ 撤销站内信；不做发布审核撤销 | |
| F7 | **不做**分享渠道大改、帖子入口、取消屏蔽 UI | |

---

## 9. 分阶段交付

| 阶段 | 内容 | 预估 | 依赖 |
|------|------|------|------|
| **P0** | 理由字典 + 游戏/账号举报 + 屏蔽（只滤推荐）+ 审核默认下架/警告 + **满 3 次自动一级** + 通知（含 `relatedGameId`）+ Admin 举报审核 + **处罚记录只读** + `publishBanUntil` 灰按钮 + R11 错误码 + 创作者「违规下架」展示 | BE 5～7d / FE 4～6d | — |
| **P0.5** | 二～四级自动升档、主页隐藏（`homeHidden` + 访客空态 + 本人顶栏；**用户侧已接**）、严重直达 UI / 先审后发 / 冻创作者 / 禁登录（**施加仅 admin，解禁 admin/operator**；Admin 下一轮；不含停结算） | BE 3～4d / FE 1～2d | P0 |
| **P0.5+** | 运营主动撤销警告/当前处罚（§2.7b / S5c / F4c；不退档、不删历史；撤销站内信） | BE 0.5～1d / FE 0.5～1d | P0.5 或与收尾同迭代 |
| **P1** | 申诉全流程 + 运营申诉复核（**FE 已对接**；16 位对外 id + 统一详情 GET） | BE 2～3d / FE 2～3d | P0.5 |
| **P2** | 帖子举报/屏蔽真实联动（待帖子模型） | 另估 | 帖子模块 |
| **另开** | 分享到粉丝/QQ/朋友圈 | — | 产品单独 PRD |

**建议开工顺序**：S0 字典与表 → F0 ReportSheet + S2 提交（含错误码）→ S3 屏蔽仅进推荐 → S4/S6 审核闭环 + 处罚只读 → S5/S7 `publishBanUntil` 与通知 → P0.5（S5b）→ P1 申诉。

---

## 10. 风险与对策

| 风险 | 对策 |
|------|------|
| 仅改 `is_public` 被创作者再公开 | 强制 `moderation_status=taken_down` + 发布校验 |
| 警告重复累计 | `creator_moderation.dedupe_key`（warning）唯一 |
| 帖子类型过早承诺 | UI 不做；审核对 post 明确未接入 |
| 分享菜单过载 | 本版只加举报一行，不扩分享渠道 |
| 处罚状态与定时不一致 | cron 每日扫 `ends_at` 切 finished + 写 observation_until |
| 运营误点四级 | Admin 二次确认 + **仅 admin 可施加**禁登录；解禁 admin/operator |
| 运营误点警告/处罚 | §2.7b 主动撤销（仅当前档 / 未消耗警告）；不退档；发撤销站内信 |

---

## 11. 验收清单（上线前）

- [ ] 游戏详情分享菜单可见举报 + §0 说明；未登录弹登录框  
- [ ] 首页推荐长按/右键可屏蔽+举报；搜索/榜单/作者卡无该菜单  
- [ ] 屏蔽后推荐不再出现；**搜索、作者主页、详情仍可见**；不产生 `user_block`  
- [ ] 他人主页「⋯」可举报；本人入口隐藏  
- [ ] 举报须选字典理由；`duplicate_pending` / `already_upheld` / `report_cooldown` 等 code 可 toast  
- [ ] 运营成立作品举报：对外不可见/不可搜；库中记录仍在；创作者列表有「违规下架」  
- [ ] A/B/C 三人举报同一作品均成立 → 警告 **+1** 而非 +3  
- [ ] 累计 3 次有效警告 → 一级 7 天禁发；`publishBanUntil` 下发且发布按钮可灰；发布接口 403  
- [ ] `moderation` 可带 `relatedGameId`；消息在「安全/违规」分区  
- [ ] 「查看作品」进 `/createGame?mode=stats&gameId=`（非公开详情）  
- [ ] 申诉结果通知用 `appealId`（16 位）进结果页，**无**「去申诉」；违规通知用 `moderationId` 进审核详情；标已读仍用数字 `sourceId`  
- [ ] 提交申诉带 `relatedModerationId`（16 位），不传库内自增 id  
- [ ] Admin 举报列表可按 `targetOwnerUserId` / `reporterUserId` 精确筛；游戏标题用 `gameTitle`，昵称 `null` 显示「未设置昵称」  
- [ ] `GET /api/moderation/:id`、`GET /api/appeals/:appealId` 无 `/admin`、`/operator` 别名；`canAppeal=false` 时底栏申诉为灰，不做「再次申诉」  
- [ ] 申诉通过的警告（`status=revoked`）不计入 `ownerWarningCount`  
- [ ] 举报人 toast +「已受理」站内信；点开不跳进度页  
- [ ] P0 Admin：举报审核 + 处罚记录只读；成立默认下架+警告  
- [ ] P1 Admin：申诉复核；admin/operator 均可「通过」（含解除禁登录效果）；**施加**禁登录仍仅 admin  
- [ ] P0.5：严重直达可跳过三次警告；同单只记一条处罚、玩家只收到一条处罚通知（无同单警告通知）；主页隐藏访客空态 + 本人顶栏（用户侧）  
- [ ] 运营撤销：仅当前生效处罚可撤；撤后不退上一档；禁登录一并解除；未消耗警告可单撤；已升档警告不可单撤  
- [ ] 撤销后用户侧列表仍显示「已撤销」、不可申诉；收到 `moderation_revoke` 站内信（通用文案）  
- [ ] 撤销时若有 pending 申诉 → 申诉 `cancelled`；作品仅在无其他有效下架原因时恢复上架  
- [ ] 本版结算/收益逻辑**未被**处罚改动  
- [ ] 账号举报可重置资料并记警告  
- [ ] 帖子 UI 不出现；reasons?targetType=post 可返回种子  
- [ ] 分享到 QQ/朋友圈等**未**被本需求改动；P0 无取消屏蔽 UI  

---

## 12. 口径确认记录

| 问题 | 结论 |
|------|------|
| 作品成立后处理 | 下架+留痕+警告；不物理删 |
| 同内容多举报 | 警告只计 1 次 |
| 帖子本版 | 仅类型+理由；UI 忽略 |
| 分享渠道重做 | 非本计划 |
| 警告有效期 | 滚动 365 天；触发一级后 consumed（§2.6.1） |
| 举报人反馈 | toast + 受理站内信；不看进度 |
| 暂停收益/停结算 | **本版不做** |
| 通知存储 | 只扩 `message_type`，不新建通知表 |
| 表数量 | P0 共 5 张新表 + `games` 三字段；风控热状态在 `user_punishment`，不堆 `user` |
| games 下架 | 必须 `is_public=0` + `moderation_status=taken_down`，禁止只改 is_public |
| 观察期 | 一级后 7 天；二级后 **7** 天；三级后 **30** 天；期内再违规则处罚升级 |
| 违规重置资料 | 昵称复用 `genRandomNickname()`；头像 `DEFAULT_AVATAR_URL`；简介清空 |
| 二级主页隐藏 | 本人可进可编辑 + 顶栏提示；访客不可见（P0.5） |
| 管理入口 | 举报审核 + 处罚记录（P0 只读）；严重 UI P0.5；admin+operator；**施加**禁登录仅 admin，**解禁** admin/operator |
| 证据 | 仅图片 ≤3；上传成功才占名额 |
| 屏蔽过滤 | 只挡推荐；搜索/作者主页/详情不滤；只屏蔽不解 |
| 用户处罚字段 | `publishBanUntil` / `homeHidden` 挂 `/auth/user/info` |
| R11 错误码 | `already_upheld` / `report_cooldown` |
| 消息 | 「安全/违规」分区；`relatedGameId` 可选；「查看作品」→ stats；跳转用 `moderationId` / `appealId`（16 位）；`sourceId` 只用于已读 |
| 对外 id | warning/penalty 用 `moderation_id`；appeal 用 `appeal_id`；提交申诉用 `relatedModerationId`；库内自增 id 不对用户暴露 |
| 详情 GET | 警告/处罚 `GET /api/moderation/:moderationId`；申诉 `GET /api/appeals/:appealId`（用户与 staff 同一条）；无 `/admin`、`/operator` 详情别名 |
| 有效警告 | `consumed=0` 且 `status <> revoked`；申诉通过的那次不计 |
| Admin 展示 | 当前昵称 / `userCode` / `gameTitle`；可按 `targetOwnerUserId`、`reporterUserId` 精确筛 |
| 四级申诉通过 / 解禁登录 | **admin / operator**（与 `clear-login-ban` 同权）；**施加**禁登录仍仅 admin |
| 他人主页入口 | 「⋯」；长按仅首页推荐 + 桌面右键 |
| 严重直达 vs 警告 | `penaltyLevel` 有值 → 只记处罚、不记警告、只发一条处罚通知；FE 直达不带 `uphold_warn`（2026-10-24） |
| 运营主动撤销 | 仅当前生效处罚；不退档；不删其他历史；未消耗警告可单撤；已升档警告不单撤；无其他有效下架才恢复作品；pending 申诉 → `cancelled`；禁登录一并解除；权限 operator+admin；用户侧显示已撤销；通用撤销文案；不做发布审核撤销（2026-10-27） |

---

## 13. 一句话交付定义

> 用户能举报游戏/账号并屏蔽单个游戏；运营下架须 `taken_down` 上锁；处罚当前态在 `user_punishment`、流水在 `creator_moderation`；对外用 16 位 moderation/appeal id；本版不停结算；重置昵称复用 `genRandomNickname()`；P0 共 5 张新表。

---

## 附录 A · 管理面板信息架构（草图）

```
AdminPanel
 └─ 内容安全
     ├─ 举报审核（默认）  ← 列表 + 详情抽屉
     ├─ 处罚记录            ← penalty 列表 / 提前结束（慎用）
     └─ 申诉复核（P1）
```

详情抽屉分区：举报信息 | 对象快照 | 证据 | 历史警告/处罚 | 处理表单。

---

## 附录 B · 实现备忘

- 推荐过滤：`gameRecommendFeedService` 排除 `user_content_block` 与 `moderation_status=taken_down`  
- 作者主页（访客）：排除 `taken_down`；**不要**套个人 `user_content_block`
- 搜索：**本版不**因 `taken_down` / 个人屏蔽额外过滤（前端交互 §4.2）  
- 通知：扩展 `ALLOWED_MESSAGE_TYPES`；`moderation` 聚合带 `recordType`、可选 `relatedGameId`、`moderationId` / `appealId`；数字 `sourceId` 只用于已读  
- 前端口径细则：`.cursor/doc/前端交互.md`；过程纪要：`.cursor/doc/举报申诉功能/后端整改-Admin举报详情.md`  
- 用户信息：`/auth/user/info` 映射 `publishBanUntil` / `homeHidden`（见 §4.5）  
- cron：扫 `creator_moderation` 中到期 penalty，切 finished 并 upsert `user_punishment`  
- 标识符：表字段 snake_case；API JSON camelCase；对外 moderation/appeal 为 16 位**字符串**，勿 `Number()`  
- migration：`2026-10-17-appeal-id-reason-title.sql`、`2026-10-18-moderation-id.sql`；存量 warning/penalty 补 16 位见整改纪要（手动 SQL，不进迁移目录）  
- **P0 新表共 5 张**：`report_reason` / `user_report` / `user_content_block` / `creator_moderation` / `user_punishment`
