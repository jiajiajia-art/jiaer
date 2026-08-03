# Funloom 限定抽奖日 — 实施计划书

> **版本**：v0.2（2026-07-27）  
> **状态**：已实现（前后端可联调；上线前需跑 D1 migration）  
> **分支**：`feature-active-20260727`  
> **活动窗口**：2026-07-31 00:00 ～ 2026-08-03 23:59:59（时区：**Asia/Shanghai**）  
> **口号**：Funloom限定抽奖日！100%中奖  
> **用户链接**：`/funloom/activity/funloom-lottery-20260731`  
> **实现摘要**：独立活动目录 + 大转盘 + 日限抽 + 积分入账 + 收货表单 + 管理端名单/CSV；单测见 `test:funloomLottery` / `test:lottery`

---

## 1. 目标

落地一期 **独立活动页 + 独立链接** 的大转盘抽奖：

- 运营在后台把链接挂到推广活动 / 首页 ticker 等即可引流；
- 用户登录后每天可抽 **1** 次（活动期内最多 4 次，见 §2）；
- **100% 中奖**；库存耗尽的实物奖自动并入保底积分券；
- 实物（游戏机 / 精灵球）收集收货信息；现场奖只提示领取方式；积分券即时入账。

---

## 2. 已确认 / 待确认规则

### 2.1 奖池（名义概率）

| 奖品 key | 展示名 | 数量 | 名义概率 | 领取方式 | 素材 |
|----------|--------|------|----------|----------|------|
| `console` | 游戏机 | **1** | 1/3000 | 填写收货信息邮寄 | 图4 |
| `mini_handheld` | 迷你掌机 | **20** | 1/20 | **现场领取** | 图3 |
| `badge` | 吧唧 | **100** | 1/10 | **现场领取** | 图2 |
| `poke_ball` | 精灵球 | **9** | 1/30 | 填写收货信息邮寄 | 图1 |
| `points_300` | 游戏300积分券 | **无限** | 填补剩余概率（保底） | **直接发放积分** | 图5 |

**统一分母实现（推荐）**：内部用万分或千分权重，例如分母 3000：

| key | 权重 | 说明 |
|-----|------|------|
| `console` | 1 | |
| `mini_handheld` | 150 | 3000/20 |
| `badge` | 300 | 3000/10 |
| `poke_ball` | 100 | 3000/30 |
| `points_300` | **2449** | 3000 − (1+150+300+100) |

某实物 **库存为 0** 时：其权重并入 `points_300`，保证仍 100% 中奖且概率不「悬空」。

### 2.2 次数限制（按你的口头澄清）

| 项 | 决定 |
|----|------|
| 活动期 | 7.31–8.03（共 4 个自然日） |
| 抽奖次数 | **每个用户每个自然日限抽 1 次**（上海时区按日切分） |
| 活动期内理论上限 | 4 次（若每日都抽） |

> 文案「每个用户限抽一次」易误解为全期 1 次。若运营实际要 **全期仅 1 次**，改配置 `drawLimit: 'once_per_activity'` 即可，表结构预留，默认实现 **按日**。

### 2.3 中奖表现

| 场景 | 行为 |
|------|------|
| 任意奖 | 转盘停在对应扇区后弹窗标题：**「恭喜中奖！！」** + 奖品图/名 |
| `console` / `poke_ball` | 额外弹窗（或同弹窗第二步）填：**收货人 / 地址 / 手机号**；校验非空 + 手机号格式 |
| `mini_handheld` / `badge` | 弹窗说明 **现场领取**（文案待运营定，可配置） |
| `points_300` | **抽中即发放 300 游戏积分**（或打开结果弹窗时同步入账，失败可重试入账，见 §6） |

### 2.4 待运营确认（开工前尽量拍板）

| # | 问题 | 建议默认 |
|---|------|----------|
| Q1 | 未登录：强制登录后再抽，还是先看转盘？ | 可看页，点「抽奖」跳登录，回跳活动页 |
| Q2 | 现场领取地址/时间文案 | 配置字段 `onsiteClaimHint` |
| Q3 | 积分券「游戏积分」是否走现有游戏积分账户 | 是，与现有 ledger 一致 |
| Q4 | 后台是否要「中奖名单 / 导出售后地址」 | **要**（运营履约必备） |
| Q5 | 转盘扇区是否按概率等分还是视觉等分 | **视觉等分 5 扇区**（概率由服务端决定，前端只播动画对准结果） |

---

## 3. 产品形态：独立活动目录 + 独立链接

### 3.1 为什么单独目录

- 不污染主站 `page/` 业务；活动结束可整夹归档；
- 静态资源（奖品图、转盘 UI）与主站打包隔离清晰；
- 路由一眼可识别，方便后台填链接。

### 3.2 前端目录约定

```text
Interactive-fiction-frontend/
  src/
    activities/
      funloom-lottery-20260731/          # 本期活动根
        index.tsx                       # 页面入口
        FunloomLotteryPage.tsx
        components/
          LotteryWheel.tsx              # 大转盘
          WinModal.tsx                  # 「恭喜中奖！！」
          ShippingFormModal.tsx         # 收货信息
          PrizeLegend.tsx               # 奖品说明/剩余（可选）
        hooks/
          useLotteryDraw.ts
        api/
          lotteryApi.ts
        lib/
          lotteryTypes.ts
          lotteryDrawGate.ts            # 前端闸门：日期窗、今日已抽（以服务端为准）
          lotteryDrawGate.test.ts
        assets/                         # 图1–图5 拷贝至此
          prize-poke-ball.png
          prize-badge.png
          prize-mini-handheld.png
          prize-console.png
          prize-points-300.png
        FunloomLottery.module.css
    page/                               # 不放本期活动业务页
  docs/
    Funloom限定抽奖日-计划书.md         # 本文档
```

### 3.3 路由与可配置链接

| 项 | 值 |
|----|-----|
| 路由 path | `/activity/funloom-lottery-20260731` |
| 完整用户链接（线上示例） | `https://<域名>/funloom/activity/funloom-lottery-20260731` |
| `App.tsx` | 增加一条 `Route`；建议包 `ProtectedRoute` **或** 页内点抽奖再鉴权（见 Q1） |

运营后台配置方式（复用现有能力即可，**不必新建一套 CMS**）：

1. **推广活动** `promotion_activities.detail_link_url` / `internal_link_url` 填上述 URL；  
2. 和/或 **首页 ticker** `home_promotion_ticker.link_url` 填同一 URL；  
3. 活动页本身 **不依赖** 推广投稿逻辑，只做抽奖。

后续若有第二期活动：再建 `src/activities/<slug>/` + 新路由，链接换 slug。

---

## 4. 用户流程

```text
打开活动链接
  → 展示规则标题、奖池说明、大转盘、剩余次数/今日状态
  → 点击「开始抽奖」
      → 未登录：跳登录，returnUrl=活动页
      → 已抽过今日 / 不在活动期：Toast，不转
      → 请求 POST /lottery/draw（服务端原子抽奖+扣库存）
      → 前端按返回 prizeKey 播大转盘动画 → 停格
      → 弹窗「恭喜中奖！！」
          → points_300：展示已到账 / 失败则「重新领取」
          → 现场奖：展示领取说明
          → 邮寄奖：下一步填写收货人/地址/手机号 → POST 地址
  → 可选：本页展示「我的中奖记录」
```

**原则**：中奖结果 **只信服务端**；转盘动画是表现层，禁止前端本地随机定奖。

---

## 5. 大转盘（前端）

| 项 | 方案 |
|----|------|
| 扇区 | 5 块视觉等分，对应 5 个 `prizeKey`（顺序固定，与服务端枚举一致） |
| 动画 | CSS/`requestAnimationFrame` 旋转；收到结果后计算目标角 + 多圈缓动 |
| 时长 | 约 3–5s；请求未返回前转盘可 idle 或轻微晃动，**禁止**先停后改结果 |
| 并发 | 抽奖按钮 loading + 禁用，防连点 |
| 降级 | 若动画失败，仍展示 WinModal（结果已落库） |

奖品图使用本期 `activities/.../assets/` 内静态资源（由对话附图拷贝）。

---

## 6. 后端设计

### 6.1 表（D1 migration）

**`lottery_campaigns`**（可先只插一行本期配置，便于改时间/开关）

| 字段 | 说明 |
|------|------|
| `id` / `slug` | 如 `funloom-lottery-20260731` |
| `title` | Funloom限定抽奖日！100%中奖 |
| `starts_at` / `ends_at` | ISO 或上海日界 |
| `draw_limit_type` | `once_per_day` \| `once_per_activity` |
| `status` | `draft` \| `published` \| `ended` |
| `config_json` | 奖品定义、权重、积分数量、文案 |

**`lottery_prizes`**（或全部塞进 config_json；库存建议独立表便于原子扣减）

| 字段 | 说明 |
|------|------|
| `campaign_id` | |
| `prize_key` | `console` / … |
| `remaining` | 剩余库存；积分券用 `-1` 或极大值表示无限 |
| `weight` | 名义权重 |
| `fulfillment` | `shipping` \| `onsite` \| `points` |
| `points_amount` | 仅积分奖，300 |

**`lottery_draws`**（每次抽奖一条，幂等）

| 字段 | 说明 |
|------|------|
| `id` | |
| `campaign_id` | |
| `user_id` | |
| `draw_date` | `YYYY-MM-DD`（上海）— 用于日限唯一约束 |
| `prize_key` | |
| `request_id` | 客户端可选幂等键 |
| `points_grant_status` | `na` \| `pending` \| `granted` \| `failed` |
| `created_at` | |

唯一约束建议：

- `UNIQUE(campaign_id, user_id, draw_date)`（按日限）；  
- 若改全期一次：`UNIQUE(campaign_id, user_id)`。

**`lottery_shipping_addresses`**

| 字段 | 说明 |
|------|------|
| `draw_id` | 关联中奖记录 |
| `user_id` | |
| `recipient_name` | |
| `phone` | |
| `address` | |
| `created_at` / `updated_at` | 允许用户改一次 |

### 6.2 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/lottery/campaigns/:slug` | 活动元信息、奖池展示、**我的今日是否已抽**、剩余库存（实物可只显示「有/无」避免被刷） |
| POST | `/api/lottery/campaigns/:slug/draw` | **原子**：校验登录 → 活动窗 → 日限 → 加权随机（跳过 remaining=0）→ 扣库存 → 写 draws → 若积分则入账 |
| POST | `/api/lottery/draws/:id/shipping` | 仅 `shipping` 类奖；校验归属 |
| GET | `/api/lottery/campaigns/:slug/me` | 我的中奖记录 |
| GET | `/api/admin/lottery/...` | 运营：名单、地址导出、库存、强制下架 |

### 6.3 抽奖事务要点（防超发）

```text
BEGIN
  锁奖品行或用 UPDATE remaining = remaining - 1 WHERE remaining > 0
  若扣减失败 → 将该奖权重视为 0，重抽（或直接保底积分）
  插入 lottery_draws（唯一约束冲突 → 返回「今日已抽」）
  若 points → 调现有积分发放（写 ledger + 用户余额）
COMMIT
```

- **禁止**「先返回结果再异步扣库存」。  
- 积分发放失败：draw 已记奖，`points_grant_status=failed`，提供重试接口或打开弹窗再领一次（幂等按 `draw_id`）。

### 6.4 积分发放

复用现有「特殊积分 / 活动积分」发放路径（与推广奖励、运营调账同一套账户），`reason` 固定如 `lottery:funloom-lottery-20260731:points_300`，便于对账。

---

## 7. 运营后台（最小集）

| 能力 | 优先级 | 说明 |
|------|--------|------|
| 活动开关 / 改时间 | P0 | 改 `lottery_campaigns` 或 config |
| 中奖列表 + 筛选奖品 | P0 | |
| 导出售后地址 CSV | P0 | 游戏机、精灵球 |
| 库存只读 / 手动扣减纠错 | P1 | |
| 挂活动链接 | P0 | **用现有推广活动 detail 链接或 ticker**，填 §3.3 URL |

不必本期做可视化「转盘编辑器」；奖池写死在 migration/seed + 文档即可。

---

## 8. 分阶段实施

```text
P0 契约：表 + seed 奖池 + API 契约 + 前端 types
 → P1 活动页壳 + 路由 + 资源入仓 + 规则文案
 → P2 服务端抽奖原子逻辑 + 日限 + 积分发放
 → P3 大转盘动画对接真实结果
 → P4 中奖弹窗 + 收货表单 + 现场文案
 → P5 运营名单/导出 + 挂链接验收
 → P6 单测全量 + 压测库存/连点
```

| Phase | 工期（估） | 交付 |
|-------|------------|------|
| P0 | 0.5–1d | migration、slug 配置、类型与校验单测 |
| P1 | 0.5–1d | `/activity/funloom-lottery-20260731` 可打开 |
| P2 | 1–2d | draw API + 积分到账 |
| P3 | 1d | 转盘对准服务端结果 |
| P4 | 1d | 恭喜弹窗 + 邮寄表单 |
| P5 | 0.5–1d | admin 列表导出；运营配置链接 |
| P6 | 0.5–1d | 测试与边界 |

**合计约 5–8 人日**（前后端合计）。

---

## 9. 测试计划（强制）

### 9.1 单测

- 权重归一 / 库存为 0 时权重并入保底  
- 日界：上海 `draw_date` 计算  
- 收货手机号校验  
- 前端 `lotteryDrawGate`：活动窗外、今日已抽禁用  

### 9.2 接口 / 集成

- 同一用户同日第二次 draw → 4xx + 明确文案  
- `console` remaining=1 时并发 2 请求 → 仅 1 人中游戏机，另一人其他奖或积分  
- 积分奖 ledger +300，重复重试不双发  
- 非 shipping 奖调 shipping 接口 → 拒绝  

### 9.3 手测清单

1. 未登录点抽奖 → 登录回跳  
2. 转盘动画结束后标题为「恭喜中奖！！」  
3. 抽中积分 → 积分明细可见 +300  
4. 抽中精灵球/游戏机 → 填地址可保存，名单可见  
5. 抽中吧唧/掌机 → 现场领取文案  
6. 跨日 0 点后再抽一次（可改服务器时间或造 `draw_date`）  
7. 活动结束后按钮不可抽  
8. 后台链接点击进入活动页  

---

## 10. 风险

| 风险 | 缓解 |
|------|------|
| 前端随机被抓包改奖 | 结果仅服务端；动画只消费 `prizeKey` |
| 库存超发 | SQL 条件更新 + 唯一约束 + 并发测 |
| 「限抽一次」文案与按日不符 | 活动页规则写清「每日一次」；配置可切全期一次 |
| 积分账户类型搞错 | 与运营确认「游戏积分」账户；发奖前 staging 验一笔 |
| 实物履约 | P0 导出地址；现场奖需线下核对名单 |

---

## 11. 上线清单

1. 合并 `feature-active-20260727` → 部署前后端  
2. 跑 migration + seed（库存初值）  
3. 运营：推广活动 / ticker 填写  
   `https://<生产域名>/funloom/activity/funloom-lottery-20260731`  
4. 用测试号抽 1 次验积分与弹窗  
5. 7.31 零点前确认 `status=published`、时间窗正确  

---

## 12. 下一步

1. 确认 §2.2 次数规则（默认 **每日 1 次**）与 §2.4 Q1–Q5  
2. 确认积分发放走哪条现有 API（实现时对照 ledger）  
3. 确认后进入 **P0**：建表 + 活动目录脚手架 + 路由  

确认结果回填本节「已确认决策」后升版 **v0.2 / 可开发**。
