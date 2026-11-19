# Romance 浏览器回归脚本

真实浏览器（Chromium）+ 拦截假 AI 接口，跑通建角 → 开局 → 回合 → 读档，以及编辑器 → 作者预览 → 返回编辑器。
AI 回复由 `e2e-lib.mjs` 里的 `REPLY` 模拟，不消耗额度，不需要登录。

```bash
# 一次性：在任意目录装 playwright-core（不进项目依赖）
mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright-core@1.48
# 运行（预览服务需已启动）
PW_DIR=/tmp/pw node scripts/e2e/pages-smoke.e2e.mjs
PW_DIR=/tmp/pw node scripts/e2e/romance-play.e2e.mjs
PW_DIR=/tmp/pw node scripts/e2e/romance-editor.e2e.mjs
PW_DIR=/tmp/pw node scripts/e2e/romance-preview.e2e.mjs
```

环境变量：`PW_DIR`（playwright-core 安装目录，默认 `/tmp/pw`）、`E2E_BASE`（默认 `http://localhost:3000/funloom`）、`CHROMIUM_PATH`（默认 `/usr/bin/chromium`）。
