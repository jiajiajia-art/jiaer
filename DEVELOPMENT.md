# Funloom 前端开发规范（双运行时）

> **强制**：所有改动必须同时兼容 **Cloudflare 生产（Pages / funloom.kurangames.com）** 与 **阿里云静态站（/funloom、/funloom-test）**，且不得破坏 Cloudflare 现网部署。

完整细则见 Cursor 规则：`.cursor/rules/dual-runtime-cf-aliyun.mdc`（已入库，同事与 Agent 均须遵守）。

## 一句话

业务 UI 同一套；用 `VITE_*` / `basename` / API Base 区分部署，禁止写死只适配某一侧的域名或路径。

## 必守清单

1. **路由 basename**：尊重 `VITE_BASE` / `getAppBasePath()`（`/funloom` vs `/funloom-test` vs CF 配置），不要写死 `/funloom/`。
2. **API Base**：走 `config` / 环境变量；阿里云可能是同源 `/api` 或 `/cn-test-api`，CF 为独立 API 域名。
3. **静态资源 URL**：封面等多在 `/public/...`；头像可能是 `/interactive-fiction-game-avatar/...`（无 `public/`）。不要假设所有资源都在 `/public` 下，也不要写死 Cloudflare CDN 域名（除非有明确多端配置）。
4. **语言 / Geo**：启动走 `/api/geo/region`；大陆简体依赖服务端国家码。前端失败兜底勿改成「永远英文」而破坏国内站体验；也不要删掉对服务端强制语言的遵循。
5. **构建产物**：`dist`（CF）、`dist-cn-prod` / `dist-cn-test`（阿里云）按部署文档分别产出；改构建配置时两边都要能编过。
6. **验证**：关键页面在 CF 与阿里云入口各抽测一次（登录、首页列表、封面/头像、语言）。

## 相关入口

| 环境 | 典型地址 |
|---|---|
| cf-prod | https://funloom.kurangames.com/funloom/ |
| cn-prod | http://\<ECS\>/funloom/ |
| cn-test | http://\<ECS\>/funloom-test/ |

## 本地联调：切换后端（同事最常用）

**只改一个文件一行**：`Interactive-fiction-frontend/devApiPresets.ts` 顶部的 `ACTIVE_DEV_API`。

可选：`cn-test` | `cn-prod` | `cn-gogo` | `cn-neo` | `cn-qqq` | `cf-test2` | `local`。保存后重启 `npm run dev`。

仓库外总览：`gameWork/项目启动文档.md`。

Romance 同仓嵌入（`/romance`、同构建同部署）：见 `docs/romance-embed-plan.md`。
