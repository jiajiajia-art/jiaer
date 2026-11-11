# 运营者中心可视化报表 — 技术规格（v1.0）

> **文档类型**：前后端联合规格  
> **日期**：2026-07-08  
> **关联仓库**：`Interactive-fiction-frontend`（页面）、`Interactive-fiction-backend`（API/聚合）  
> **后端迁移**：`cf/migrations/2026-07-07-role-permissions-and-stats.sql`（含报表查询索引，无新列）

---

## 1. 目标

在运营中心（`/operator/reports`）提供可视化报表：

| 模块 | 指标 | 粒度 |
|------|------|------|
| 平台活跃 | 投稿、浏览量(PV)、评论、分享 | 日 / 周 / 月 |
| 用户增长 | 注册用户数 | 日 / 周 / 月 |
| 消费趋势 | 积分消费（负向 points） | 日 / 周 / 月 + 月环比 |
| KPI | DAU（登录去重） | 独立展示，不进主图四曲线 |

---

## 2. 已锁定口径

| 项 | 口径 |
|----|------|
| 浏览量 | `game_statistics.pv_count`，按 `stat_date`；公开作品 `is_public=1` |
| 活跃度主图 | **次数**：投稿 / PV / 评论 / 分享 |
| DAU | **登录** `user_login` 去重；单独 KPI |
| 消费 | `user_point_activities`：`points < 0` 且 `status = 1` |
| 自然周 | 周一至周日 |
| 缺失日期 | 补 **0**，不插值 |
| 时区 | ISO 存 UTC；分桶展示 **Asia/Shanghai**（`datetime(col, '+8 hours')` 或 `Intl`） |
| PV `stat_date` | Phase 1 沿用 UTC 日历日（与创作者统计一致） |

---

## 3. API

鉴权：`requireOperatorUser`（`operator` / `admin`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/operator/reports/activity-trends` | `granularity`, `startDate`, `endDate`, `metrics` |
| GET | `/api/operator/reports/registrations/trend` | 注册增长 |
| GET | `/api/operator/reports/consumption/trend` | 积分消费 + 环比 |
| GET | `/api/operator/reports/active-users/summary` | DAU KPI |

响应 `series[].points[]`: `{ bucket, value }`

---

## 4. 数据源

| 指标 | 表 | 分桶 |
|------|-----|------|
| 投稿 | `promotion_submissions` | `submitted_at` → 上海日 |
| PV | `game_statistics` + `games` | `stat_date` |
| 评论 | `game_ratings_comments` | `created_at` → 上海日 |
| 分享 | `user_analytics_events` | `event_type=game_share`，`event_time` → 上海日 |
| 注册 | `user_register` | `register_time` → 上海日 |
| 消费 | `user_point_activities` | `created_at` → 上海日 |
| DAU | `user_login` | `login_time` → 上海日 |

---

## 5. 前端

- Tab：**数据报表** → `/operator/reports`
- 图表：**Recharts**（折线 / 柱状）
- 筛选：近 7 / 30 天、自定义；粒度 日 / 周 / 月

---

## 6. 测试

| 仓库 | 文件 | 命令 |
|------|------|------|
| 后端 | `checks/operatorReports.check.mjs` | `npm run test:operatorReports` |
| 前端 | `checks/operatorReports.check.mjs` | `npm run test:operatorReports` |

---

## 7. 关联迁移（角色/统计分支）

| 文件 | 说明 |
|------|------|
| `cf/migrations/2026-07-07-role-permissions-and-stats.sql` | 角色权限、统计表/索引 + 运营者报表查询索引 |
| `cf/d1-schema.sql` | 新环境全量建表 |

**升级**（已有库）：执行 `2026-07-07-role-permissions-and-stats.sql` 即可。
