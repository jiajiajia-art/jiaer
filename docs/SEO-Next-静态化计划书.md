# Funloom 前端 SEO / Next 静态化 — 计划书

> **版本**：v1.2（2026-08-17）  
> **状态**：待开工（**保留** `/funloom` 前缀；去掉前缀另开需求；静态托管模式待二选一）  
> **仓库**：`Interactive-fiction-frontend`（现仓原地演进）  
> **产品域名路径**：`basename` / `basePath` = `/funloom`（本期保持；去前缀见附录 C，单独需求）  
> **参考现状**：Vite + React Router CSR；`base: '/funloom/'` + `BrowserRouter basename='/funloom'`；`index.html` 仅全局 `title=funloom`，无分页 keywords/description

---

## 1. 目标与验收标准

### 1.1 一句话目标

让 Funloom **公开浏览页、游戏详情页、游玩页** 具备可被搜索引擎稳定抓取的 HTML（含 title / keywords / description），并在构建体系上迁到 **Next.js 最新稳定版**，公开内容以静态预渲染为主。

### 1.2 硬验收（Done = 全部满足）

| # | 要求 | 验收方式 |
|---|------|----------|
| A | **所有纳入 SEO 范围的页面**均有非空 `meta name="keywords"`、`meta name="description"`，以及正确 `<title>` | 构建产物 / 线上「查看网页源代码」抽样 |
| B | 使用 **Next.js 最新稳定版**（开工时锁定，当前市场稳定线为 16.x） | `package.json` + `next build` 成功 |
| C | **纳入范围的页面静态化**：首屏 HTML 即含 SEO 元信息（非仅 CSR 改 `document.title`） | 禁用 JS 仍可见 title/meta；或 curl HTML 源码 |
| D | **所有 `<img>` / Next `Image`**：`alt` 非空 | CI 脚本 + 人工抽查 |
| E | **所有可点击链接**（`<a>` / `Link`）：`title` 非空 | CI 脚本 + 人工抽查 |
| F | **详情页 + 游玩页** title 公式：`{游戏名称} \| {分类名称} \| funloom AI小游戏` | 单元测试 + 源码抽查 |
| G | 后台 / 运营 / 创作台等 **不做 SEO 建设**（见范围） | 计划与实现清单无对应任务 |

### 1.3 非目标（本期不做）

- 后台、运营面板、创作者中心、管理端的 keywords/description 精修
- 全站多语言 SEO（i18n hreflang）专项（若后续要做另开计划）
- 付费墙后的剧情正文全文静态化（游玩页以壳层 + 游戏元信息 SEO 为主，局内动态对话仍客户端）
- **去掉 `/funloom` URL 前缀**（已撤回本期范围；技术方案草稿见 **附录 C**，后续单独需求处理）
- 更换品牌主域名

---

## 2. 已确认决策

| 议题 | 结论 |
|------|------|
| SEO 范围 | **公开页 + 详情页 + 游玩页**；**后台不做** |
| 游玩页 SEO | **需要做**，title / keywords / description **参照详情页同一套规则**（可在 description 中区分「详情介绍」vs「开始游玩」） |
| Title 分隔符 | **竖线** ` \| `（两侧空格可选，全站统一一种；推荐：`游戏名 \| 分类名 \| funloom AI小游戏`） |
| 路径前缀 | **本期保留 `/funloom`**（`basePath` / `basename` 不变）；去掉前缀 **另开需求**（附录 C） |
| 工程方式 | **现有仓库原地开发**；用 Next 作为路由与构建入口（见 §4「为何调整 Vite」） |
| 静态模式 A/B | **待产品/运维二选一**（见 §5）；文档两种都写清，开工前锁定 |

---

## 3. 范围：页面分级

### 3.1 必须做 SEO（In）

| 路由（相对 `/funloom`） | 说明 | Title 策略 |
|-------------------------|------|------------|
| `/` → `/home` | 首页 | 站点级品牌 + 核心词 |
| `/categories` | 分类 | 分类浏览导向 |
| `/rank` | 排行 | 排行 + 品牌 |
| `/library` | 书库/作品库 | 作品库导向 |
| `/specials` | 专题/特别 | 专题导向 |
| `/game/:fileId` | **游戏详情** | **`{游戏名} \| {分类名} \| funloom AI小游戏`** |
| 游玩入口（见下） | **游玩页** | **同详情公式**；description 可加「在线游玩 / AI 互动」等 |

**游玩页路由现状（实现时需对齐）：**

| 现状路由 | 备注 | SEO 注意 |
|----------|------|----------|
| `/galgame` | 主 Galgame 游玩壳，当前在 `ProtectedRoute` 内，多靠 `location.state` 带 `fileId` | SEO 需要 **可分享、可抓取的稳定 URL**（建议改为或增加 `/galgame/:fileId` 或 `/play/:fileId`，详情进游玩带 path 参数） |
| `/replay/:replayId` | 回放 | 用回放关联的游戏名/分类拼 title |
| `/novel/:fileId/read` | 小说阅读 | 按作品元信息；公式可与详情一致或加「阅读」后缀（实现时统一一种） |
| `/galgameMap` | 地图游玩 | 同游玩页策略 |
| 其他玩法 `/interactive-video/:fileId`、`/customif/:appId`、`/st/:appId` 等 | 若对公网可访问且希望收录 | 同期按「详情同款公式」覆盖；否则标为二期 |

> **关键设计点**：仅 `/galgame` 无 `fileId` 时，爬虫无法区分作品 → **游玩页 SEO 与详情对齐的前提是 URL 可定位到具体游戏**。计划书默认：**游玩页公开 URL = 带 `fileId`（或等价 id）的路径**，登录校验可保留，但 **SSR/SSG 壳层仍输出该游戏的 meta**。

### 3.2 明确不做 SEO 建设（Out）

| 路由前缀 / 类型 | 说明 |
|-----------------|------|
| `/admin/*` | 管理后台 |
| `/operator/*` | 运营 |
| `/create*`、`/creator*`、`/createGame`、编辑器类 | 创作台 |
| `/warehouse*`、`/favorites`、`/profile`、`/messages`、`/points/*`、`/asset/*`、`/analytics` 等 | 登录后个人能力 |
| 活动页（如抽奖） | 除非运营单独要求；默认不做完整 SEO 词表（可二期） |

**可选防护（不阻塞主路径）**：对 Out 页统一 `robots: noindex, nofollow`，避免薄内容进索引。非本期硬验收。

### 3.3 详情 / 游玩 Title 与 Meta 规则

**Title（详情 + 游玩统一）：**

```text
{游戏名称} | {分类名称} | funloom AI小游戏
```

**字段兜底：**

| 字段 | 缺失时 |
|------|--------|
| 游戏名称 | 用 `fileId` 短展示或「Funloom 游戏」（优先接口 `title`/`name`） |
| 分类名称 | 默认 `互动小说`（或产品指定默认分类文案，全站统一） |

**Description（建议）：**

- 详情：`{游戏名}。{简介截断至 80～120 字}。在 funloom 体验 AI 互动小游戏。`
- 游玩：`在线游玩《{游戏名}》（{分类}）。funloom AI 小游戏，立即开始互动。`

**Keywords（建议拼装，逗号分隔，非空）：**

```text
{游戏名},{分类名},funloom,AI小游戏,互动小说,Galgame,{标签1},{标签2}…
```

去重、控长（建议 ≤ 10～15 个词）。

**站点级默认（首页等）：**

- Title 示例：`funloom \| AI小游戏 \| 互动小说与Galgame`
- Description / Keywords：品牌词 + AI小游戏 + 互动小说 + Galgame + 核心品类（词表见 Phase 0 产出表）

---

## 4. 为何在现仓「调整 Vite」——说明（非另起炉灶）

当前栈是 **Vite 打包 + React Router 浏览器端路由**：

- 构建结果基本是 **单页** `index.html` + JS
- 爬虫拿到的 HTML **几乎没有** 分路由的 title/keywords/description
- 仅靠前端 `useEffect` 改 `document.title` **不满足「页面静态化」验收**

本期要用的是 Next 的：

- **按路由生成 HTML**
- **`generateMetadata` / 静态元信息**
- **SSG / 预渲染**

因此：

- **在现有 `Interactive-fiction-frontend` 仓库开发**（不新建并行站点目录）
- **构建与路由入口**从 Vite + React Router 转为 **Next App Router**
- **业务 React 组件、API、Zustand、样式大部分保留**，迁入 `app/` 或作为 Client Components 复用
- 「替换 Vite」= **替换打包/路由层**，不是重写全部产品逻辑

本地开发命令预期从 `vite` / `vite build` 变为 `next dev` / `next build`（具体脚本 Phase 1 落地）。

---

## 5. 静态模式说明与选型（开工前锁定）

### 5.1 模式 A — 纯静态导出（`output: 'export'`）

| 项 | 内容 |
|----|------|
| 含义 | `next build` 产出纯 HTML/CSS/JS/静态资源；**无** Node 渲染进程 |
| 上新游戏 | 需 **重新构建发布**，或另写「补页脚本」生成新 `game/[id].html` |
| 托管 | 与现 Cloudflare Assets / 静态托管最接近（当前 `wrangler.toml` → `./dist`） |
| 优点 | 运维简单、成本低、与现部署心智一致 |
| 缺点 | 新作品 SEO 页面有延迟，依赖发版频率 |

### 5.2 模式 B — SSG + 定时 / 按需刷新（ISR 类）

| 项 | 内容 |
|----|------|
| 含义 | 构建时预渲染列表与已有详情/游玩壳；之后可 **定时**（如 `revalidate = 600`）或 **按需**（上架 webhook → `revalidatePath`）只刷新变更页 |
| 「定时刷新」 | 过期后下次访问或后台任务触发重新生成该页 HTML |
| 「按需刷新」 | 运营/发布流水线在游戏上架成功时调用刷新接口，尽快让新详情可被抓取 |
| 托管 | 需要 **支持 Next 运行时或兼容 ISR 的平台**（如 Node / 部分 Cloudflare Workers 适配方案） |
| 优点 | 上新 SEO 更快，不必整站重建 |
| 缺点 | 部署与运维比纯静态复杂；需确认现网是否允许 |

### 5.3 选型建议（供拍板）

| 若… | 选 |
|-----|-----|
| 必须继续「只传静态目录、无服务端」 | **模式 A** |
| 可接受 Next 运行时，且上新希望尽快收录 | **模式 B** |

**未拍板前的工程默认（可改）**：先按 **模式 A** 设计目录与 `generateStaticParams`；预留 metadata / 数据拉取层，便于升级到 B。

> **请在开工前勾选其一：**  
> - [ ] 模式 A：`output: 'export'`  
> - [ ] 模式 B：SSG + 定时/按需刷新  

---

## 6. 分阶段实施计划

### Phase 0 — SEO 基线与词表（0.5～1 天）

**产出：**

1. 《页面 SEO 表》CSV/MD：`path` → `title模板` / `description模板` / `keywords模板` / `index?`
2. 站点默认 keywords 词库（品牌 + 品类）
3. 分类名字段来源确认（详情接口哪个字段；多分类时取主分类）
4. 游玩页 **目标 URL 方案**拍板（强烈建议 `/galgame/[fileId]` 或 `/play/[fileId]`）
5. 静态模式 A/B 最终勾选

**退出标准：** 产品确认词表与游玩 URL；模式 A/B 已勾选。

---

### Phase 1 — Next 最新版骨架 + 路由迁移（3～7 天，主路径）

**工作项：**

1. 引入 Next.js **最新稳定版**（App Router）；React 19 与现依赖对齐
2. 配置 `basePath: '/funloom'`（或等价），**保持现有路径兼容**
3. 路由映射：现 `App.tsx` Routes → `app/**/page.tsx`
4. 鉴权布局：后台/个人页继续 Client + 原 Protected 逻辑；SEO 页可拆 `app/(public)/`
5. 调整 Cloudflare / `wrangler` 产物目录（`out` 或 `.next` 静态导出约定）；Worker 继续服务 `/funloom`
6. 保留百度统计、微信 JSSDK 等第三方脚本接入方式（布局或 Script 组件）
7. 冒烟：首页、详情、进游玩、登录后创作台

**退出标准：** `next build` 通过；本地/预发 `/funloom/home`、`/funloom/game/:id` 可打开；旧书签路径不丢 `basePath`。

**风险：** Galgame 强依赖 client state、WebSocket/SSE、微信环境；优先 **SEO 壳 SSG + 内部 `'use client'` 游玩应用**，避免强行 SSR 整局。

---

### Phase 2 — 全站 Metadata（keywords + description）（1～2 天）

**工作项：**

1. 共享工具：`buildGameSeoTitle(name, category)`、`buildGameSeoDescription(...)`、`buildGameSeoKeywords(...)`
2. 各公开页 `generateMetadata`
3. 详情 + 游玩：严格竖线公式；分类兜底
4. 建议同步：`openGraph`、`twitter`、`alternates.canonical`
5. `app/robots.ts`、`app/sitemap.ts`（仅 In 范围 URL）
6. 单测：title 公式、兜底、keywords 非空

**退出标准：** 抽 5 个详情 + 2 个游玩 HTML 源码含正确 title/keywords/description。

---

### Phase 3 — 详情 / 游玩静态参数与数据（1～3 天，依赖模式 A/B）

**工作项：**

1. `generateStaticParams`：已上架/可公开 `fileId` 列表（调现有浏览/列表 API 或构建期脚本）
2. 构建期拉取：游戏名、分类、简介、封面
3. 模式 A：全量进 `export`；文档约定发版频率
4. 模式 B：配置 revalidate / 上架 webhook 刷新路径
5. 游玩页：同一套游戏元信息生成 metadata；正文区仍 CSR

**退出标准：** 任意已上架 `fileId` 在构建产物中有对应 HTML；新 URL 规则下游玩页可打开且 meta 正确。

---

### Phase 4 — 图片 `alt` 全覆盖（1～2 天）

**规则：**

| 场景 | alt 示例 |
|------|----------|
| 游戏封面 | `{游戏名}封面` 或 `{游戏名} \| {分类名}` |
| 角色立绘 | `{角色名}` / `{游戏名}-{角色名}` |
| 分类/入口图 | `{分类名}` / 功能语义文案 |
| 用户头像 | `{昵称}的头像` |
| 无法推断 | 禁止空字符串；用上下文兜底句（如「funloom 游戏图片」） |

**工程：**

- `SafeImage` / 封装 `Image`：TypeScript 强制 `alt: string`（非可选、非 `""`）
- 扫描替换裸 `<img>`
- CI：`scripts/seo-img-alt.check.mjs`（禁止空 alt）

**说明：** 若无障碍规范坚持装饰图 `alt=""`，与本期「不能为空」冲突 → **本期按产品要求全部非空**；无障碍另开协调。

---

### Phase 5 — 链接 `title` 全覆盖（1～2 天）

**规则：**

- 每个 `<a>` / `next/link` 具备非空 `title`
- 文案优先与可见文本一致，或更完整（如「查看《{游戏名}》详情」）
- 图标按钮：title = 无障碍可读名称

**工程：**

- `SafeLink` 封装
- CI：`scripts/seo-link-title.check.mjs`
- 列表卡片、底栏、分类、详情 CTA、游玩内返回链全覆盖

---

### Phase 6 — 结构化数据与体验加分（0.5～1 天，建议做）

- 详情 JSON-LD（如 `VideoGame` / `SoftwareApplication`）：名称、分类、描述、封面、url
- 可见 H1 = 游戏名；面包屑：首页 > 分类 > 游戏名
- 游玩页 H1 可与详情一致或「游玩：{游戏名}」（全站统一）

---

### Phase 7 — 验收、防回归与文档（1 天）

1. 类型检查：`tsc` / `next build`（0 error）
2. 全量单测：`npm test`（含新增 SEO checks）
3. Lighthouse SEO 抽检；百度/Google 抓取诊断（预发）
4. 更新本计划书状态与《实现说明》（文件清单）
5. 部署清单：wrangler/产物目录、环境变量、构建期 API 地址

---

## 7. 建议排期顺序

```text
Phase 0 词表 + 游玩 URL + 模式 A/B
    ↓
Phase 1 Next 骨架与路由（阻塞项）
    ↓
Phase 2 Metadata 工具与各页 generateMetadata
    ↓
Phase 3 generateStaticParams + 详情/游玩静态 HTML
    ↓
Phase 4 alt  →  Phase 5 link title
    ↓
Phase 6 JSON-LD（建议）→ Phase 7 验收
```

可部分并行：Phase 4/5 在 Phase 2 后即可扫现有组件，不必等全量静态参数完成。

---

## 8. 技术设计要点（实现约束）

### 8.1 目录示意（落地时可微调）

```text
Interactive-fiction-frontend/
  app/
    layout.tsx                 # 全局壳、统计脚本
    (public)/
      home/page.tsx
      categories/page.tsx
      rank/page.tsx
      library/page.tsximage.png
      specials/page.tsx
      game/[fileId]/page.tsx
      galgame/[fileId]/page.tsx  # 或 play/[fileId]（Phase 0 定名）
    (app)/                     # 后台等 Client，可不做 SEO
  src/                         # 既有组件/api/store，逐步引用
  scripts/
    seo-img-alt.check.mjs
    seo-link-title.check.mjs
    seo-title-formula.check.mjs
  docs/
    SEO-Next-静态化计划书.md    # 本文
```

### 8.2 SEO 工具函数（契约）

```ts
// 伪代码契约 — 实现时落单测
buildGameSeoTitle(gameName: string, categoryName: string): string
// => `${gameName} | ${categoryName} | funloom AI小游戏`

buildGameSeoDescription(kind: 'detail' | 'play', ...): string  // 非空
buildGameSeoKeywords(gameName, categoryName, tags?: string[]): string  // 非空
```

### 8.3 部署注意（现网）

- 当前 Workers + Assets：`directory = "./dist"`，`run_worker_first`，处理 `/funloom` SPA
- 迁 Next 后需同步改：产物目录、是否仍需要 SPA fallback、静态 HTML 是否优先于 Worker 改写
- **禁止**把含密钥的 `.env` 提交仓库；构建期拉列表用可公开或 CI 密钥

### 8.4 测试要求（仓库强制）

- 可测逻辑必须进 `scripts/*.check.mjs` 或 `checks/*.check.mjs`，并纳入 `npm test`
- 至少覆盖：title 公式、分类兜底、keywords/description 非空、禁止空 alt/空 link title
- 改 TS/TSX 后必须跑类型检查；收尾跑全量 `npm test`

---

## 9. 风险与依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| 游玩页无稳定 `fileId` URL | 游玩 SEO 无法按作品收录 | Phase 0 定 `/galgame/[fileId]` 并改详情进游玩跳转 |
| 构建期拉全量游戏失败/过多 | 构建超时 | 分页拉取、仅「已上架」、分批或模式 B |
| Cloudflare 对 Next ISR 支持不足 | 模式 B 受阻 | 选 A，或评估 OpenNext / 适配层 |
| 强 Client 游玩无法 SSR | 静态化误解为「整局服务端跑」 | 明确：静态的是 **壳 + meta + 关键首屏信息** |
| alt/title 全量改造面广 | 工期膨胀 | SafeImage/SafeLink + CI，按目录分批 |
| 与现 SPA Worker 路径改写冲突 | 404 或环重定向 | Phase 1 专门回归 `/funloom` 资源与深链 |

---

## 10. 里程碑与交付物

| 里程碑 | 交付物 |
|--------|--------|
| M0 | 本计划书 + SEO 表 + A/B 勾选 + 游玩 URL 方案 |
| M1 | Next 可运行预发；公开路由可访问 |
| M2 | 详情/游玩 HTML 源码含竖线 title 与 keywords/description |
| M3 | alt / link title CI 绿灯 |
| M4 | 实现说明文档 + 全量测试通过 + 部署说明 |

---

## 11. 待办确认清单（开工前）

- [ ] 静态模式勾选：**A** 或 **B**（§5.3）
- [ ] 游玩公开 URL 最终路径名（`/galgame/[fileId]` vs `/play/[fileId]`）
- [ ] 分类缺失时的默认文案是否采用「互动小说」
- [ ] Title 空格风格确认：`A | B | C`（推荐）是否照此执行
- [ ] 小说阅读页 `/novel/:fileId/read` 是否纳入一期（建议纳入，公式同详情）
- [ ] 互动视频 / customif / st 是否一期收录
- [ ] （另开需求）是否去掉 `/funloom` — 见附录 C，**本期不做**

---

## 12. 变更记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-08-17 | v1.0 | 初版：范围/竖线 title/现仓 Next 化/模式 A·B 说明/分阶段计划 |
| 2026-08-17 | v1.1 | 曾决策去掉 `/funloom`（已撤回） |
| 2026-08-17 | v1.2 | **撤销去前缀**：本期保留 `/funloom`；去前缀改附录 C，后续单独需求 |

---

## 附录 A — 与「仅改 SPA meta」方案对比

| 能力 | 仅 CSR 改 title/meta | 本计划（Next + 静态） |
|------|----------------------|------------------------|
| 用户可见标题 | 可以 | 可以 |
| 爬虫首屏 HTML 含 keywords/description | 基本不可以 | 可以 |
| 「页面静态化」验收 | 不通过 | 通过 |
| 工程量 | 小 | 大（值得，因验收要求） |

## 附录 B — 详情 Title 示例

```text
星落酒馆 | 恋爱 | funloom AI小游戏
```

游玩页同源示例（同一游戏）：

```text
星落酒馆 | 恋爱 | funloom AI小游戏
```

（description 区分详情 vs 游玩即可，避免靠改 title 后缀制造重复索引时可在 canonical 策略上让游玩指向详情或互为独立——**Phase 0 与 SEO 表一并定**：建议详情与游玩 **各自独立可索引**，或游玩 `canonical` 回详情；需产品选一种，默认 **独立可索引 + description 区分**。）

## 附录 C — 去掉 `/funloom`（**本期不做**，单独需求草稿）

> 状态：**已从本期 SEO/Next 计划撤回**。下文仅作后续开单参考，**本计划验收不包含去前缀**。

`/funloom` 是整站 **base path**，不是业务路由名。去掉时需同步：

| 位置 | 现状 | 去掉后 |
|------|------|--------|
| `vite.config.ts` / Next `basePath` | `/funloom` | `/` 或不设 basePath |
| `BrowserRouter basename` | `/funloom` | 删除或 `/` |
| Cloudflare Worker `src/index.js` | 仅放行 `/funloom` 并剥前缀 | 根路径托管 + SPA/SSG fallback |
| 硬编码链接 | `main.tsx`、`PromotionCenter`、`replay.ts` fallback 等 | 改为无前缀；全仓搜 `/funloom` |
| 旧链兼容 | — | `/funloom/*` → **301** 到 `/*` |

验收（未来单独需求）：根路径可访问；旧 `/funloom/...` 301；分享链接无前缀；注意同域名根路径是否被其它系统占用。

