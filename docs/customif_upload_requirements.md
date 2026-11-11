# 自定义游戏多文件上传（ZIP/目录）服务端协议需求

本文描述前端已实现的多文件上传流程所需的后端接口与约束（兼容现有单文件 index.html 上传）。

## 现有接口（保持不变）
- 创建 App（新建模式使用）
  - `POST /api/custom/apps/create-empty`
  - Request: `{ "title": "My Custom IF" }`
  - Response: `{ "appId": "app_xxx" }`

- 创建会话（开始测试时使用）
  - `POST /api/custom/apps/:appId/session/create`
  - Response:
    ```json
    { "sessionId":"sess_xxx", "version":"1.0.0", "entryUrl":"/public/custom/apps/:appId/ui/1.0.0/index.html", "manifestUrl":"/public/custom/apps/:appId/ui/1.0.0/manifest.json" }
    ```

- Chat（宿主侧转发，UI 通过 postMessage 使用）
  - `POST /api/custom/apps/:appId/openai/v1/chat/completions`（OpenAI 兼容，支持流式）

## 新增/兼容：UI 包上传（支持三种模式）
接口路径保持不变：
- `POST /api/custom/apps/:appId/ui/upload`

请求体（multipart/form-data）：
- 通用字段
  - `version: string`（必填）
  - `manifest: string`（可选，JSON 文本；若提供，服务端应落盘为 `/manifest.json`）
  - `overwrite: 0|1`（可选；版本已存在时是否覆盖，默认不允许覆盖→409）

- 模式 A：单文件（兼容现状）
  - `index: file`（必填，HTML）
  - 行为：与当前实现一致，落盘为 `/index.html`

- 模式 B：多文件（客户端解包或选择目录）
  - `mode: "multi"`（必填）
  - `files[]: file`（必填，N 个）
  - `paths[]: string`（必填，N 个；与 files[] 一一对应，代表相对路径，例如 `assets/logo.png`、`style.css`）
  - `entryPath: string`（可选；若提供，服务端以此为入口；否则在根或唯一的 `*/index.html` 中自动探测）
  - 行为：服务端按 `paths[]` 恢复目录结构至 `/public/custom/apps/:appId/ui/:version/`

- 模式 C：ZIP 直传（可选）
  - `bundle: file`（.zip）
  - `entryPath: string`（可选）
  - 行为：服务端解压 ZIP 到目标目录；若 `entryPath` 缺省，自动探测 `index.html`

响应（建议统一）：
```json
{
  "entryUrl": "/public/custom/apps/:appId/ui/:version/index.html",
  "manifestUrl": "/public/custom/apps/:appId/ui/:version/manifest.json",
  "assetPrefix": "/public/custom/apps/:appId/ui/:version/",
  "version": "1.0.0",
  "files": { "count": 17, "bytes": 1234567 }
}
```

## 服务器实现要点
- 目录与路径安全
  - 将 `paths[]` 进行规范化：去除前导 `/`、拒绝 `..`；ZIP 解包同样需要防止 zip slip
  - 支持大小写一致性校验（可选）

- 白名单与大小限制
  - 扩展名白名单：`.html .js .css .json .png .jpg .jpeg .gif .svg .webp .mp3 .wav .ogg .ttf .woff .woff2`（可扩展）
  - MIME 校验与单文件大小限制（例如 10MB），包体总大小限制（例如 50MB）

- 入口文件与清单
  - 若 `entryPath` 提供：验证该文件存在且为 `.html`
  - 否则自动探测：根目录 `index.html` 或唯一的 `*/index.html`
  - 若 `manifest` 表单字段提供：写为 `/manifest.json`；否则可省略

- 版本冲突与权限
  - 版本已存在：返回 `409 { code:"VERSION_EXISTS", message:"..." }`；若 `overwrite=1` 且平台允许，则覆盖
  - 非所有者：`403 { code:"FORBIDDEN" }`

- 静态托管与缓存
  - 目录：`/public/custom/apps/:appId/ui/:version/`
  - `index.html`：`Cache-Control: no-cache`（或短时）
  - 其他静态资源：`Cache-Control: public, max-age=31536000, immutable`
  - 安全头：`X-Content-Type-Options: nosniff`；可选 CSP 白名单（限制外链脚本域）

##（可选）协商接口
前端可根据服务端能力与阈值选择“客户端解包/目录上传”或“ZIP 直传”。
- `GET /api/custom/apps/:appId/ui/negotiate`
- Response：
```json
{
  "maxFiles": 5000,
  "maxBytes": 52428800,
  "prefer": "client-unzip", // or "server-unzip"
  "multipart": true,
  "supportsOverwrite": false
}
```

## 错误码规范（示例）
- `400 INVALID_PARAM` 参数/清单非法
- `400 INVALID_ENTRY` 入口文件缺失或不是 HTML
- `403 FORBIDDEN` 非所有者/权限不足
- `409 VERSION_EXISTS` 版本冲突
- `413 PAYLOAD_TOO_LARGE` 单文件/总大小超限
- `415 UNSUPPORTED_TYPE` 非白名单类型

## 审计与限流（建议）
- 记录：appId、version、userId、fileCount/totalBytes、IP、UA、耗时
- 限流：按用户与 App 维度限制上传频率与总量

