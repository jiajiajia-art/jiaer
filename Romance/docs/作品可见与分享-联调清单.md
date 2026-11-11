# Romance · 作品可见与分享 — 联调缺口与程序员改动清单

给程序员直接改代码用。产品正文仍以《作品可见与分享-需求》为准；本文只写：**现在断在哪、要改什么、改完怎么验**。

配套文件（一并交给程序员，不要另抄正文）：

| 文件 | 用途 |
|------|------|
| `Romance/docs/作品可见与分享-需求.md` | 产品主需求（状态、三动作、协议弹窗、审核后台、创作者门禁） |
| `src/content/legal/creator-agreement-zh.md` | 《创作者协议》正本（版本 1.0.0） |
| `src/content/legal/work-review-standards-zh.md` | 《作品审核标准》正本（版本 1.0.0） |
| `Romance/docs/玩法Mod与手机应用-需求.md` | 玩法包 / 手机应用怎么做（门禁触发后才走这份） |

适用范围：仅游戏世界（`engine=ROMANCE`）。玩法包、手机应用的上架细则仍按《玩法Mod与手机应用-需求》；本文只补「谁能进创作入口」与审核可调试缺口。


## 0. 现状结论（改之前先对齐）

已通：

- Romance 草稿创建 / 标题 PATCH / 正文 PUT·GET（`public/romance/{fileId}/editor.json`）
- 运营「发布队列」列表、通过、驳回、关闭先审（通用 `games` 先审队，Romance 也会进队）
- 创作者本机「预览」可进局

未通 / 无法调（按优先级）：

1. 审核后台**不能**预览表单、**不能**预览游戏；审核员**读不到**他人待审 `editor.json`
2. 待审快照只有元数据（标题封面等），**没有** Romance 表单正文；过审**没有** Romance 内容发布镜像
3. 「保存草稿 / 私有分享 / 提交发布」三动作、协议弹窗、同意版本落库、私有试玩链接 **基本未落地**
4. 创作者身份门禁未拦；kkmod 多停在 `private_test` 难进审；手机应用可绕过后台直接上架


## 1. 必须先改：审核可调试闭环（对应主需求 §3.5、验收 6/7）

目标：运营在「发布队列」对一部审核中的 Romance 世界，能**只读看表单**、能**试玩一局**，再决定通过/驳回；预览不改作品状态、不写公开可续玩存档。

### 1.1 提交审核时冻结「待审表单快照」

现象：

- `pending_update_json` 只含 `SNAPSHOT_FIELDS`（标题、封面、价格等），不含 `mod+draft`
- 创作者审核中仍可能 `PUT .../content` 覆盖 live 草稿，审核员看到的版本会漂

要做：

1. Romance 走「提交发布审核」时，把**当时**的 `editor.json`（或等价 `mod+draft`）拷到待审专用位置，例如：
   - 对象存储：`public/romance/{fileId}/pending-review/editor.json`，或
   - DB 指针 + 独立对象键（二选一，但必须与 live 草稿隔离）
2. 审核中：创作者改 live 草稿**不得**覆盖待审快照；若允许继续改，须明确「再提交才刷新待审包」
3. 通过 / 驳回后按现有流程处理；驳回后创作者仍读自己的 live 草稿

涉及参考：

- 后端：`interface/handlers/games/gamesPublish.js`、`services/d1/gameVersionReview.js`、`services/d1/creatorModerationService.js`
- 正文现路径：`interface/handlers/games/creatorDrafts.js`（`romanceDraftContentKey` / PUT content）

### 1.2 管理员只读拉取待审正文

现象：

- `GET /api/auth/games/drafts/romance/:fileId/content` 内调用 `CreatorDraftService.assertOwnedDraft`，非作者（含运营）403/失败

要做：

1. 新增运营鉴权接口，例如：
   - `GET /api/admin/moderation/publish-queue/:fileId/romance-content`
   - 或 `GET /api/admin/romance/:fileId/pending-review-content`
2. 权限：运营 / 审核角色；仅允许读「审核中」作品的**待审快照**（不是作者本机草稿、不是旧公开版）
3. 只读；任何写入都必须拒绝

涉及参考：

- `interface/handlers/games/creatorDrafts.js`（`getRomanceDraftContentHandler`）
- `interface/routes/adminContentReports.js` / `interface/handlers/admin/contentReports.js`

### 1.3 发布队列 UI：预览表单 + 预览游戏 + 审核标准

现象：

- `PublishReviewAdminManager.tsx` 只有通过 / 驳回 / 关闭先审
- 列表不展示 `fileId`、引擎类型，无法手调
- 无《作品审核标准》入口；驳回只有自由文本，无勾选原因

要做：

1. 列表或详情醒目展示：`fileId`、引擎（至少标出 ROMANCE）、标题、封面、提交时间
2. **预览表单**：打开只读视图，渲染本次待审快照中至少：
   - 名称与介绍、设定摘要、人物、地点、世界书、开局相关
   - 封面与主要地点背景图是否齐全
   - 只读；改了也不回写
3. **预览游戏**：跳转或内嵌 Romance 进局，参数绑定本次待审快照（建议 `reviewPreview=1&fileId=...` 一类）；退出后仍为审核中；进度不进正式公开存档
4. 可打开 `work-review-standards-zh.md` 全文（链接或弹层）
5. 驳回原因可勾选（可多选）+ 可选补充说明：
   - 世界观不完整
   - 背景图不完整
   - 无法完整游玩
   - 违规或其他
6. 创作者作品侧能看到驳回原因；不强制「必须点过预览才能点通过」

涉及参考：

- 前端：`src/components/admin/PublishReviewAdminManager.tsx`、`src/api/admin/adminReportApi.ts`
- Romance 作者预览可参考：`AuthorPreviewPlayShell` / `requestAuthorPreview`（审核预览应读待审快照，不要读审核员本机草稿）

### 1.4 审核通过时的 Romance 内容镜像

现象：

- `services/games/publishedGameContent.js` 的 `CONTENT_ROOTS` **没有 `ROMANCE`**
- `promotePublishedGameContent` 对 Romance 会拿不到前缀；通过后可能只改 DB `is_public`，玩家读不到正式发布包

要做：

1. 为 `ROMANCE` 增加草稿前缀与发布前缀（与现有 `public/romance/{id}` 约定对齐）
2. 审核通过时：把**待审通过的那一版**拷到发布镜像（或你们现有 published 约定）；玩家只读发布镜像
3. 与 TXT/AVG 等引擎行为一致：作者继续改草稿不影响已上架玩家读到的版本，直到下次更新过审

涉及参考：

- `services/games/publishedGameContent.js`
- `services/d1/creatorModerationService.js`（`approvePublishQueueItem` 内 `promotePublishedGameContent`）


## 2. Romance 三动作 + 协议弹窗 + 落库（对应主需求 §3.2–3.4、验收 1–5/9/10）

### 2.1 界面三动作分开

要做（创作者作品列表 + 世界编辑器顶栏/发布区）：

| 动作 | 行为 |
|------|------|
| 保存草稿 | 只存给自己；不生成公开链接；不上商店；不进审核 |
| 私有分享 / 试玩链接 | 生成或管理受邀访问；可关闭、作废、设到期；默认不进推荐/排行/公开搜索；进入页标明「私有试玩，未公开发布」 |
| 提交发布审核 | 先弹 §3.4 协议窗，同意后再进审核队列 |

禁止：

- 「保存并发布」类混文案
- 点分享却顺带公开上架
- 私有链接与公开详情共用「已发布」标签

说明：现有 `ModEditorPanel` 里「发布」若是离开编辑器的必填校验，**不要**当成平台上架；平台上架文案必须单独、明确。

### 2.2 发布前协议弹窗

何时弹：点「提交发布审核」之后、真正发请求之前。  
何时不弹：保存草稿、私有分享。

正文与勾选以主需求 §3.4 为准；全文入口必须两个都能打开：

- 《创作者协议》→ 渲染 `creator-agreement-zh.md`
- 《作品审核标准》→ 渲染 `work-review-standards-zh.md`

勾选默认不勾；未勾选「同意并提交」不可用。  
`LegalDocument` 当前只支持 `user-agreement` / `privacy-policy`，需扩展或另开路由；**不要**和登录用户协议混成一个勾选。

提交成功落库建议字段：

- `creatorAgreementVersion`（文件头版本）
- `workReviewStandardsVersion`
- `agreedAt`、`accountId`、`worldId`（fileId）

任一文件换版本后：再次公开发布（含重新上架）须重新勾选；旧同意不能自动带过。

### 2.3 作品状态展示

创作者列表须能区分（实现可用枚举/字段组合，展示要能对应）：

- 草稿
- 已私有分享（未公开发布）
- 发布审核中
- 已公开发布
- 已下架

参考现有：`src/lib/creatorWorkLifecycle.ts`（目前缺「已私有分享」等）。

### 2.4 入口不要绕到 TXT 发布弹窗

现象：

- Romance 非草稿编辑易落到 `/createGame?mode=stats` + 通用 `PublishSettingsModal`（双封面、题材等），与 Romance 表单/协议不对齐

要做：

- Romance 编辑 / 提交发布 / 续编统一回 `/romance/?draftId=...`（或等价 Romance 壳）
- 发布校验对齐 Romance 封面与设定，不要强依赖 TXT 双封面流程


## 3. 创作者身份门禁（对应主需求 §3.6、验收 8）

触发：某账号**首次**有游戏世界「审核通过并成功上架」后，激活创作者身份。

未激活时：

- 不能使用玩法 Mod 创作（创建、编辑、预览、上架等）
- 不能使用手机应用创作（创建、编辑、预览、上架等）
- 「创作游戏」入口不可用或进入后明确提示：需先公开发布一部完整游戏世界并通过审核

要做：

1. 前端：`CreateType.tsx` 等入口按身份禁用/提示（不要只靠藏按钮）
2. 后端：玩法 Mod 上传/提审、手机应用发布等接口强制校验；未激活直接拒绝
3. 首次 `approvePublishQueue` 且成功上架时激活身份（与协议第二条一致）

玩家游玩他人已发布世界、或只用基础游玩，不受此门禁。


## 4. 关联缺口：玩法 Mod / 手机应用后台可审（配合门禁与《玩法Mod与手机应用-需求》）

下列不是主需求正文的「世界三态」，但会导致运营后台「有表单却审不到 / 绕过审核」：

### 4.1 kkmod 提审入队

现象：

- 上传后状态多为 `private_test`
- 后台 `AdminPlayModManager` 只对 `pending` 出审核按钮
- 缺少创作者侧「提交审核」把 kkmod 从 `private_test` → `pending` 的完整链路（`ai-drafts/:id/submit` 不够用或未被页面调用）

要做：

- 补 kkmod / 组件「提交审核」API + 创作者 UI
- 运营对 `pending` 可审；可选：后台对 `private_test` 提供「代提审」或私有测试预览入口

### 4.2 手机应用不要绕过审核（产品二选一，需产品确认后实现）

现象：

- `CreatePlatformApp` → `platformAppsApi.publish` 可直接 `published`，不经 `AdminPlayModManager`

要做（与产品确认后定一种）：

- A. 手机应用统一走组件审核队列，禁止作者直发；或
- B. 明确手机应用允许作者直发，并改掉「审核上架」类文案，避免运营误以为要在组件后台审

默认建议按《玩法Mod与手机应用-需求》走审核上架（A），与世界门禁一致。


## 5. 建议改动顺序（方便联调）

| 顺序 | 包 | 原因 |
|------|----|------|
| P0-1 | §1 待审快照 + 管理员只读 API + 队列「预览表单/预览游戏」+ 结构化驳回 + 《作品审核标准》入口 | 没有这条，运营无法按标准审 Romance |
| P0-2 | §1.4 Romance 过审内容镜像 | 否则「通过」不等于玩家真能玩到该版 |
| P0-3 | §2 Romance 三动作 + 协议弹窗 + 同意落库 + 状态展示 | 产品主路径 |
| P0-4 | §3 创作者身份激活与前后端门禁 | 与协议一致 |
| P1 | §4 kkmod 提审 + 手机应用审核策略 | 组件后台才能形成闭环 |
| P1 | 私有分享链接全链路（生成/关闭/作废/到期/进局门禁） | 主需求 §3.2；可与 P0-3 同迭代或紧随其后 |


## 6. 关键文件索引（方便搜）

前端：

- `src/components/admin/PublishReviewAdminManager.tsx`
- `src/api/admin/adminReportApi.ts`
- `src/page/operator/OperatorPanel.tsx`（`publishQueue`）
- `src/page/LegalDocument.tsx`（需扩展法律文）
- `src/content/legal/creator-agreement-zh.md`
- `src/content/legal/work-review-standards-zh.md`
- `src/page/CreateType.tsx`（玩法 Mod / 手机应用入口）
- `src/page/CreatePlatformApp.tsx`
- `src/components/admin/AdminPlayModManager.tsx`
- `src/lib/creatorWorkLifecycle.ts`
- `Romance/src/lib/platformRomanceDraft.ts`
- `Romance/src/components/ModEditorPanel.tsx`
- `Romance/src/components/WorldGenWizard.tsx`
- `Romance/src/lib/platformShellGate.ts`

后端：

- `interface/routes/adminContentReports.js`
- `interface/handlers/admin/contentReports.js`
- `interface/handlers/games/creatorDrafts.js`
- `interface/handlers/games/gamesPublish.js`
- `services/d1/creatorModerationService.js`
- `services/d1/gameVersionReview.js`
- `services/games/publishedGameContent.js`


## 7. 验收清单（转测用）

复制主需求第 4 节，并追加本清单特有项：

- [ ] 运营打开发布队列中的 Romance 待审项：能看到 fileId 与引擎标识
- [ ] 「预览表单」打开的是**本次提交**的只读快照；改 UI 不会写回待审包 / live 草稿
- [ ] 「预览游戏」能开局走几步；退出后仍是审核中；不产生公开可续玩存档
- [ ] 审核员账号能拉到待审正文；普通玩家广场仍看不到审核中世界
- [ ] 驳回可选勾选原因；创作者侧可见
- [ ] 可打开《作品审核标准》全文；通过/驳回依据不另写一套后台文案标准
- [ ] Romance 审核通过后，玩家能读到发布镜像内容（不只是列表变公开）
- [ ] 提交发布弹出协议窗；两份 md 都能打开；不勾不能提交；落库两个版本号 + 时间
- [ ] 保存草稿 / 私有分享 / 提交发布文案与行为分离
- [ ] 私有链接另一账号能玩；公开搜索找不到；作废后不能进
- [ ] 列表能区分草稿 / 已私有分享 / 审核中 / 已发布 / 已下架
- [ ] 首次过审上架后激活创作者身份；激活前玩法 Mod / 手机应用创作被前后端拦截
- [ ] （若做 §4）kkmod 可从私有测试提交进审；手机应用上架策略与文案一致、无静默绕过


## 8. 不要做的事

- 不要照着主需求第 2 节「现在的问题」当实现规格；按第 3 节与本文改动清单做
- 不要在代码里再手写一份《创作者协议》/《作品审核标准》全文；只渲染交付的 md
- 不要把玩法包、手机应用套上「草稿 / 私有分享 / 公开发布」世界三态（主需求已排除）
- 不要用审核员本机草稿或旧公开版冒充待审预览
- 不要默认勾选协议；不要无勾选也能提交


## 9. 给产品 / 对接人的一句话

请程序员按 **§5 顺序**先打通「待审快照 → 管理员只读 → 后台预览表单/游戏 → 过审镜像」，再补 Romance 三动作与协议落库、创作者门禁；否则运营后台会对 Romance **有队列、无内容、无法调试**。同步处理 **§10**：玩家能从详情/榜单真正开玩、草稿保存失败要可见、消息/申诉按引擎跳回 Romance、扣豆积分回写与 API 基址统一。


## 10. 增量联通断点（清单正文外补扫）

以下不替代 §1–§4，是联调时常见的「能创作、不能玩 / 看着存了、云端没有 / 进错 TXT 页」类断点。可与 P0 并行排期；**玩家开玩链**建议与 §1.4 过审镜像同迭代。

### 10.1 玩家游玩 / 详情 / 公开入口

| # | 现象 | 证据 | 要做 |
|---|------|------|------|
| A1 | 详情「开始体验」对 `engine=ROMANCE` toast「未知类型」，无跳转 | `src/page/GameDetail.tsx`（`normalizeGameMode` 无 ROMANCE；`startGameInternal` → `unknownGameType`） | 增加 ROMANCE 分支，跳转到约定游玩 URL（如 `/romance/?play=1&fileId=`），并加载**已发布包** |
| A2 | 主站几乎只有创作链（`createWorld` / `resume`），缺统一「玩家进局」入口 | `CreateType.tsx`、`CreatorWorksPanel.tsx`；Romance `App` 路由解析 | 补玩家参数解析与进局壳；首页/详情/榜单统一跳转 |
| A3 | 后端无「玩家读已发布 mod」接口，只有创作者本人草稿 content | `interface/routes/games.js`、`handlers/games/creatorDrafts.js` | 增加已上架只读内容 API（读发布镜像，非作者草稿） |
| A4 | `resolveContentMode` 认 ROMANCE，但 `CONTENT_ROOTS` 无条目 → 发布前缀恒失败 | `services/games/publishedGameContent.js` | 与 §1.4 一并补 ROMANCE 源/发布前缀 |
| A5 | `PlatformShellGate` 引导「去全部作品」，详情又不能开局 | `Romance/src/components/PlatformShellGate.tsx`、`GameDetail.tsx` | Gate 文案与真实开玩入口对齐 |
| A6 | `getPlayStatus` 主要扫 TXT `public/visual/user_saves`，详情续玩/存档状态对 Romance 不准 | `interface/handlers/games/gamesSession.js` | 按 engine 分支 Romance 存档路径，或明确本地存档策略并改详情按钮 |
| A7 | Romance 进局未接 `trackingApi.reportGameEntry`，互动榜/运营缺游玩事件 | 主站 `GameDetail.tsx` 有上报；`Romance/src` 无 | 玩家进局补与主站一致的 entry/session 上报 |
| A8 | 排行榜「互动榜」可列出 Romance，点详情却玩不了 | `src/page/Rankings.tsx` + `GameDetail.tsx` | 先修 A1–A3，或暂时过滤尚无游玩链的引擎 |

### 10.2 书架 / 编辑器保存 / 平台草稿

| # | 现象 | 证据 | 要做 |
|---|------|------|------|
| B1 | 平台 PATCH/PUT 失败返回 `false`，无 toast；多处 `void commit...` 静默 | `Romance/src/lib/platformRomanceDraft.ts`；`WorldGenWizard.tsx` | 失败必须提示；UI 区分「本机已存 / 云端未同步」 |
| B2 | 无 token 时拉 content 直接 `null`，resume 像「打不开存档」而非请先登录 | 同上 + `WorldGenWizard` `resumeLoad === "missing"` | 未登录与真无内容分文案；引导主站登录 |
| B3 | 主站 `creatorDraftApi` 有 get/put，但 `src` 内零引用；子应用另写一套 fetch | `src/api/creator/creatorDraftApi.ts` vs `platformRomanceDraft.ts` | 统一客户端与类型（含 `cover_url`），避免双实现漂移 |
| B4 | `creatorDraftApi.updateRomance` 类型只有 `title`，后端已支持 `cover_url` | `creatorDraftApi.ts`；`updateRomanceDraftHandler` | 对齐 PATCH 字段，书架封面与编辑器一致 |
| B5 | 后端 `POST .../drafts/dedupe` 已实现，前端无入口 | `creatorDraftApi.dedupe` | 书架加「清理重复草稿」或删除死 API |
| B6 | 编辑器文案「离开编辑器视为发布」，实际只 `onCommitted` 写草稿 | `ModEditorPanel.tsx`（约 663–691 行） | 文案改为保存语义；上架走 Romance 提审（§2） |

### 10.3 跳转被当成 TXT / 小程序

| # | 现象 | 证据 | 要做 |
|---|------|------|------|
| C1 | 消息中心违规下架「查看作品」进 `/createGame?mode=stats&gameId=` | `Messages.tsx`；`CreateGame.tsx` stats 模式 | 按 `engine` 分叉：ROMANCE → `/romance/?createWorld=1&draftId=&resume=1` |
| C2 | 发布申诉通过后只写「回编辑页」，无 Romance 深链 | `GamePublishAppeal.tsx` | 上下文带 engine，按钮直达 Romance 编辑器 |
| C3 | `gamesSession` / 多处 `normalizeGameMode` 无 ROMANCE | `gamesSession.js` 等 | 全栈统一引擎枚举；ROMANCE 单独会话模型或明确不支持并拦截 |
| C4 | 小程序创作白名单仍偏 TXT；Romance/玩法入口缺少一致拦截 | `utils/miniProgram.ts`；`CreateType.tsx` | 小程序明确拦截或正式开放并测全链路 |
| C5 | `isCreatorRoutePath` 不含 `/romance`，底栏「创作」态可能不对 | `miniProgram.ts`；`MobileBottomNav.tsx` | 把 `/romance` 纳入创作路由或单独 tab 规则 |
| C6 | 主站 `shouldGateRomancePlatformShell` 缺 `createPlayMod`，与子应用 `platformShellGate` 不一致 | `src/utils/gameListingAccess.ts` vs `Romance/src/lib/platformShellGate.ts` | 合并单一真源 |
| C7 | 员工角色可读多 key，token 只读 `auth-storage` | `platformShellGate.ts` vs `platformAvatarLibrary.ts` | Token 与主站 `useAuthStore` persist 键一致 |

### 10.4 世界生成 / 扣豆 / 退款 / API 基址

| # | 现象 | 证据 | 要做 |
|---|------|------|------|
| D1 | `POST /api/romance/world-gen/refund` 偏客户端上报点数，缺强幂等 | `worldGenRefund.js`；`clampWorldGenRefundPoints` | 按扣费流水 / 模组实例 id 幂等退款 |
| D2 | 退款失败返回 `false` 不抛错，用户只见生成失败不知豆未退 | `platformWorldGenAi.ts`；`worldGenGenerate.ts` | 退款失败醒目提示 + 重试或工单字段 |
| D3 | 后端返回 `remainingPoints`，子应用不回写主站积分，顶栏豆数陈旧 | `platformWorldGenAi.ts` / `platformPlayAi.ts` | 扣费成功后写回 `useAuthStore` 或广播刷新 |
| D4 | enrich 失败被 catch 后仍可能返回 skeleton，像生成完成 | `worldGenGenerate.ts` | UI 标「半成品」或触发部分退款，禁止静默当成功 |
| D5 | LLM 未配置返回 503 `LLM_UNAVAILABLE`，缺运营可行动引导 | `worldGenComplete.js`；`playComplete.js` | 明确「未配 romance_world_gen / romance_play」类提示 |
| D6 | `CreatePlatformApp` 用 `HOST_ADDRESS`，Romance 用 `VITE_API_BASE_URL` | `CreatePlatformApp.tsx` vs `platformAvatarLibrary.ts` | 统一 API 基址解析（与主站 config 一致） |
| D7 | 手机应用对话同样扣豆不回写积分 | `CreatePlatformApp.tsx` `completePhoneAppChat` | 同 D3 |

### 10.5 玩法 Mod / 手机应用（细项）

| # | 现象 | 证据 | 要做 |
|---|------|------|------|
| E1 | `playModApi.submitAiDraft` 已实现，全仓无页面调用 | `src/api/playMod/playModApi.ts`；`PlayModCreateShell.tsx` | 上传成功后接提审，UI 展示审核态（补全 §4.1） |
| E2 | `PlayModCreateShell` 成功判定含 `!!json?.data`，可能误报成功 | `PlayModCreateShell.tsx` | 仅以 `success === true` 为准，展示后端 `message` |
| E3 | 手机 Studio 内 `submit` 是应用内自检，不是组件商店提审 | `Romance/src/components/phone/studio/Studio.tsx` | 文案区分「应用内自检」与「组件商店提审」 |
| E4 | `ModWorkshop` 无平台 AI 时 placeholder「需要接入 AI」，未登录硬阻断 | `ModWorkshop.tsx`；`platformPlayAi` | 统一要求平台 JWT，UI 明示登录入口 |
| E5 | 主站无 Romance 调用 `POST /auth/games/publish`；从 CreateGame stats 误操作会走 TXT 发布 | `CreateGame.tsx` + `PublishSettingsModal` | 对 ROMANCE 禁用/重定向 stats 发布；只走 Romance 协议流（§2） |

### 10.6 审核预览与作者预览隔离

| # | 现象 | 证据 | 要做 |
|---|------|------|------|
| F1 | 作者预览纯前端 `authorPreview`，与审核「待审快照进局」若共用本地存档键会串档 | `Romance/src/lib\authorPreview.ts`、`AuthorPreviewPlayShell` | 作者预览与审核预览分存档键；审核退出不留公开可续玩进度（呼应 §1.3） |

### 10.7 建议排期（相对 §5）

| 顺序 | 项 | 说明 |
|------|----|------|
| 与 P0-2 同批 | A1–A4、A6–A8 | 过审镜像落地后，玩家必须能从详情真正开玩 |
| P1 | B1–B2、B6、C1–C2 | 创作者调试体验与修稿跳转 |
| P1 | D1–D4、D6–D7 | 扣豆/退款可见、防刷、基址统一 |
| P1 | C4–C7、E1–E5 | 小程序门禁、双实现收敛、玩法/应用提审细节 |
| P2 | B3–B5、A5、A7、D5、F1 | 双客户端合并、文案/统计/引导打磨 |

### 10.8 增量验收（追加到 §7）

- [ ] 已公开发布的 Romance：详情「开始体验」能进局，不出现「未知类型」
- [ ] 玩家读到的是发布镜像，不是作者 live 草稿；未上架/审核中广场不可玩
- [ ] 详情续玩/存档状态对 Romance 正确（或明确无云存档时按钮文案正确）
- [ ] 平台草稿保存失败有明确提示；未登录 resume 提示登录而非笼统打不开
- [ ] 消息「查看作品」、申诉回编辑：ROMANCE 进 `/romance/?draftId=&resume=1`，不进 TXT stats
- [ ] 扣豆后顶栏积分更新；退款失败有可见提示
- [ ] 主站与 Romance API base、shell gate（含 `createPlayMod`）行为一致
- [ ] 玩法上传后可提审进 `pending`；成功判定不以「有 data 就成功」
- [ ] 作者预览与审核预览本地存档不串；审核预览退出不留公开续玩档
