# React + TypeScript + Vite

## 开发规范（必读）

**双运行时强制兼容**：Cloudflare Pages 生产 + 阿里云静态站（`/funloom`、`/funloom-test`）。  
详见 [`DEVELOPMENT.md`](./DEVELOPMENT.md) 与 [`.cursor/rules/dual-runtime-cf-aliyun.mdc`](./.cursor/rules/dual-runtime-cf-aliyun.mdc)。

改代码前请确认不会破坏 Cloudflare 现网部署路径。

```bash
wrangler pages deploy dist --project-name funloom-frontend
```

