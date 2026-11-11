# Romance 迁入 Funloom 前端：同仓同端口同部署计划

> 范围：`Interactive-fiction-frontend`  
> 子应用目录：根下 `Romance/`（代码已就位）  
> 目标：只启动外层 Funloom；访问 `/romance`（及带 basename 的正式路径）进入 Romance；**一次 `build` / 一次部署**，不单独起 Romance 服务、不单独发版。

---

## 1. 目标（验收口径）

| # | 要求 | 验收方式 |
|---|------|----------|
| A | `npm run dev`（外层）即可玩 Romance，**不需**再开 `Romance/` 里的 Vite | 只起 5173，浏览器能进 Romance |
| B | 路由带 `romance` 可访问 | 开发：短链 `/romance` → 正式 `/funloom/romance/`；生产 CF / 阿里云同理 |
| C | `npm run build` 产出**一份**静态包（含 Romance 资源） | `dist` / `dist-cn-*` 内有 Romance chunk；Nginx/Pages 只挂这一份 |
| D | 双运行时不破 | 兼容 CF（`funloom.kurangames.com`）与阿里云 `/funloom`、`/funloom-test`（见 `DEVELOPMENT.md`） |
| E | 不污染主站 | 离开 `/romance` 后主站样式/主题 class 正常 |

**明确不做：**

- 不为 Romance 单独部署第二套 Pages / 第二个 Nginx 站点。
- 开发态不强制「外层 + Romance 双 Vite 进程」（那是临时调试手段，不是目标架构）。

---

## 2. 推荐架构：同 SPA 嵌入（已选定）

```
浏览器
  └─ Funloom Vite（5173 / 线上静态）
        ├─ React Router basename = getAppBasePath()  // 如 /funloom
        ├─ 路由 path="/romance/*" → <RomanceHost />
        └─ Vite virtual 模块
              ├─ virtual:romance-app  → Romance/src/App.tsx
              └─ virtual:romance-css  → Romance/src/index.css
```

要点：

1. **一个 Vite 进程**：外层 `vite.config.ts` 解析并打包 `Romance/src`，HMR 跟主站同一端口。
2. **一个 Router**：Romance **不要**再套自己的 `BrowserRouter`（若后续加了路由库，须用相对当前 `/romance` 的子路由或 MemoryRouter）。
3. **一份产物**：`vite build` 把 Romance 打进主包/异步 chunk；部署仍只拷 `dist` 或 `dist-cn-*`。
4. **短链**：开发中间件 + CF Worker 把 `/romance` 重定向到 `/funloom/romance/`，避免忘带 basename。

> 备选（不推荐作主方案）：开发期 `concurrently` 起两个 Vite + 反向代理。会双端口、双 HMR、部署仍要二次集成，与「一个项目」冲突。仅在嵌入编译失败时作临时排障。

---

## 3. 现状盘点（2026-10-26）

| 项 | 状态 | 位置 |
|----|------|------|
| 子应用源码 | 已迁入 | `Romance/` |
| 外层路由 | 已挂 | `src/App.tsx` → `path="/romance/*"` + lazy `RomanceHost` |
| Host 壳 | 已有 | `src/page/RomanceHost.tsx`（`data-romance`、离开清 html class） |
| Virtual 模块 | 已有 | `vite.config.ts` → `romanceVirtualModules` |
| `@romance` 别名 | 已有 | 指向 `Romance/src` |
| 短链重定向（dev） | 已有 | `romanceShortLinkRedirect` |
| 短链重定向（CF Worker） | 已有 | `src/index.js` |
| 契约单测 | 已有 | `scripts/romanceEmbed.check.mjs`（纳入 `npm test`） |
| Romance CSS 嵌入策略 | **未对齐契约** | 契约要求嵌入时用 `tailwindcss/utilities`、避免整包 preflight；当前 `Romance/src/index.css` 仍是 `@import 'tailwindcss'` |
| Romance 独立 `package.json` / Vite 8 | 仍保留 | 可本地单独 `Romance` 调试；**生产路径不依赖它** |
| 外层 package scripts | 未写「romance」专用脚本 | 通常不必；可选 `dev:romance-alone` 仅排障 |

结论：**骨架已通，计划重点是补齐样式隔离、构建验证、双环境路由自检与文档化操作步骤**，而不是从零选型。

---

## 4. 实施分阶段

### P0 — 能访问、不炸主站（本周必须）

1. **确认开发入口**
   - 外层：`cd Interactive-fiction-frontend && npm run dev`
   - 打开：`http://localhost:5173/romance` → 应 302 到 `/funloom/romance/`
   - 或直接：`http://localhost:5173/funloom/romance/`
2. **修 Tailwind 嵌入**（对齐 `romanceEmbed.check.mjs`）
   - 嵌入场景：`Romance/src/index.css` 改为只引入 utilities（或 `@import "tailwindcss/theme" / utilities`），**避免**整包 preflight 洗掉主站全局样式。
   - 若 Romance 单独 `vite` 调试仍需完整 Tailwind，可用条件 CSS / 双入口文件（`index.css` 嵌入版 + `index.standalone.css`）。
3. **主题 class 作用域**
   - 继续由 `RomanceHost` 在卸载时 `clearRomanceHtmlClasses`。
   - 新加的 `html` class（`dark` / `accent-*` / `skin-*` / `font-*`）必须登记进清理列表。
4. **跑通契约测**
   - `node --experimental-strip-types --test scripts/romanceEmbed.check.mjs`
   - 全量：`npm test`（含上述 check）

### P1 — 同构建同部署（发版前）

1. **构建**
   - CF：`npm run build` → `dist/`
   - 阿里云：既有 `dist-cn-prod` / `dist-cn-test` 流程不变，确认 Romance chunk 进对应目录。
2. **basename**
   - 主站已用 `VITE_BASE` + `getAppBasePath()`；Romance **禁止**写死 `/` 或 `/funloom` 绝对路径作路由根。
   - 静态资源：用相对 `import` / Vite 处理的 URL；不要假设 Romance 挂在域名根。
3. **Nginx / Pages**
   - 仍是 SPA fallback 到外层 `index.html`；**无需**为 `/romance` 单独 location 指到第二套 dist。
   - CF Worker 保持 `/romance` → `/funloom/romance` 重定向。
4. **产物抽检**
   - `dist/assets` 中存在 Romance 相关 chunk（或主包含其模块）。
   - 预览：`npm run preview`，再访 `/funloom/romance/`。

### P2 — 工程卫生（可并行）

1. **依赖去重**：Romance 的 `react` / `react-dom` 与外层版本对齐；长期可删 `Romance/node_modules`，改由外层 hoist（注意 Vite 8 vs 外层 Vite 7 差异，嵌入时以**外层 Vite 编译**为准）。
2. **`.gitignore`**：`Romance/node_modules`、`.tmp` 勿提交；锁文件策略与外层统一（npm vs pnpm 二选一说明）。
3. **可选脚本**（非必须）
   ```json
   "dev:romance-alone": "npm run dev --prefix Romance"
   ```
   仅排障；README 写明「正式联调只用外层 `npm run dev`」。
4. **入口导航**：主站某处链到 `/romance`（产品决定；技术上 Host 已就绪）。

---

## 5. 开发 / 构建 / 部署操作清单

### 日常开发

```bash
cd Interactive-fiction-frontend
npm run dev
# 浏览器：
#   http://localhost:5173/romance
#   或 http://localhost:5173/funloom/romance/
```

- 改 `Romance/src/**`：同一 Vite HMR，刷新 `/funloom/romance/` 即可。
- 改 API 联调：仍只改 `devApiPresets.ts` 的 `ACTIVE_DEV_API`（Romance 若调主站 API，走同一代理）。

### 打包

```bash
# Cloudflare
npm run build

# 阿里云按现有脚本产出 dist-cn-*（保持原命令，勿拆 Romance 二次 build）
```

禁止流程：`cd Romance && pnpm build` 再拷进 `dist`（易 basename / 资源路径错乱）。

### 部署

- 与现网 Funloom 相同：上传/发布**外层**构建产物即可。
- 发版后抽测：
  - CF：`https://funloom.kurangames.com/funloom/romance/`
  - 短链：`https://funloom.kurangames.com/romance` → 应进 SPA romance
  - 阿里云：`http://<ECS>/funloom/romance/`（test 换 `/funloom-test/`）

---

## 6. 风险与对策

| 风险 | 对策 |
|------|------|
| Tailwind preflight 冲掉主站 | 嵌入 CSS 不用整包 `@import 'tailwindcss'`；Host 卸载清 class |
| 双份 React | 嵌入由外层打包解析，保证单例；勿在 Romance 再打包成独立 IIFE 嵌 iframe |
| Vite 大版本差（Romance 8 / 外层 7） | 生产以**外层 Vite**编译 Romance 源码；Romance 自带 Vite 仅独立调试 |
| tsc 扫描 Romance 报 unused | 继续经 `virtual:romance-*`，主工程 `tsc -b` 不直接编 Romance |
| 路由写死 `/` | 只用相对路径；资源走 Vite `import` |
| 阿里云 basename `/funloom-test` | 抽测 `VITE_BASE=/funloom-test/` 构建后的 `/funloom-test/romance/` |

---

## 7. 测试计划

1. **契约**：`scripts/romanceEmbed.check.mjs`（路由、Host、virtual、Worker、CSS 策略）。
2. **手工**
   - 外层 dev → `/romance` 302 → 页面可玩。
   - 从 Romance 点回主站路由（若有）样式正常。
   - `build` + `preview` 再测一遍。
3. **双环境**：CF 与 `funloom` / `funloom-test` 各点一次封面进 Romance。
4. **回归**：主站首页列表、登录、封面图（防 Tailwind/主题污染）。

---

## 8. 交付物清单

- [x] `Romance/` 源码就位  
- [x] `RomanceHost` + `/romance/*` 路由 + virtual 模块 + 短链  
- [x] `romanceEmbed.check.mjs`  
- [ ] Romance 嵌入用 CSS（去整包 preflight）与 check 对齐  
- [ ] `docs/romance-embed-plan.md`（本文）纳入协作说明；`DEVELOPMENT.md` 可加一行入口链接  
- [ ] CF + 阿里云各一次构建/预览验收记录  

---

## 9. 建议排期

| 日序 | 内容 |
|------|------|
| D0 | 对照本文验收「只开外层能否进 `/funloom/romance/`」；记下 Tailwind/样式问题 |
| D1 | 改嵌入 CSS、补清 class、单测绿 |
| D2 | `build`/`preview` + CF Worker 短链；阿里云 basename 抽测 |
| D3 | 合入说明、更新 `DEVELOPMENT.md` 一行、发测试环境 |

---

## 10. 相关文件速查

| 文件 | 作用 |
|------|------|
| `Romance/` | 子应用源码 |
| `src/page/RomanceHost.tsx` | 嵌入壳 |
| `src/App.tsx` | `/romance/*` 路由 |
| `vite.config.ts` | virtual 模块、短链、别名 |
| `src/index.js` | CF Worker 短链 |
| `src/types/romance-virtual.d.ts` | virtual 类型 |
| `scripts/romanceEmbed.check.mjs` | 嵌入契约测 |
| `DEVELOPMENT.md` | 双运行时总规范 |

---

**一句话**：Romance 作为 Funloom **同仓子树 + 同 Vite 嵌入**，路由 `/romance`（正式路径带 `/funloom` basename）；开发只起外层，打包只出一份包。当前骨架已在，优先把 **Tailwind 嵌入隔离** 和 **双环境访问验收** 做完即可达到「一个项目部署」目标。
