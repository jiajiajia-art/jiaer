# React + TypeScript + Vite

## 开发规范（必读）

**双运行时强制兼容**：Cloudflare Pages 生产 + 阿里云静态站（`/funloom`、`/funloom-test`）。

详见 [`DEVELOPMENT.md`](./DEVELOPMENT.md) 与 [`.cursor/rules/dual-runtime-cf-aliyun.mdc`](./.cursor/rules/dual-runtime-cf-aliyun.mdc)。

改代码前请确认不会破坏 Cloudflare 现网部署路径。

## 运营消息中心

运营后台入口：`/operator/messages`（三个 Tab）

- **公告**：跳转管理端全员公告编辑（管理员）
- **意见反馈**：原工单能力，回复会写入用户站内信
- **定向站内信**：按用户搜索后发送仅对方可见的站内信

旧链接 `/operator/feedback` 会自动跳到 `/operator/messages/feedback`。

```bash
wrangler pages deploy dist --project-name funloom-frontend
```

