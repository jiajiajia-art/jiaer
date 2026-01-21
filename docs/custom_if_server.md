# 自定义类型游戏（Custom IF）服务端修改/补充文档

已确认：创建会话返回 UI 入口信息。

## 1) 会话创建返回 entryUrl/version（必要改动）
- 接口：`POST /api/custom/apps/{appId}/session/create`
- 响应（建议）：
```json
{
  "sessionId": "sess_xxx",
  "version": "1.0.0",
  "entryUrl": "/public/custom/apps/{appId}/ui/1.0.0/index.html",
  "manifestUrl": "/public/custom/apps/{appId}/ui/1.0.0/manifest.json"
}
```
- 价值：宿主进入游戏即可加载正确版本 UI，并可在审计中固化版本。

## 2) 既有接口（保持不变）
- 创建 App：`POST /api/custom/apps/create-empty` → `{ appId, version, ui/manifest 路径 }`
- 上传 UI：`POST /api/custom/apps/{appId}/ui/upload`（multipart：version、index.html、manifest 文本） → 返回 entry 与 manifest 路径
- 访问 UI：`GET /public/custom/apps/{appId}/ui/{version}/index.html`
- Chat Completions（非流式/流式）：`POST /api/custom/apps/{appId}/openai/v1/chat/completions`（OpenAI 兼容，SSE `[DONE]` 结尾）

## 3) 推荐增强（可选）
- 历史接口（跨端恢复）：
  - `GET /api/custom/apps/{appId}/session/{sessionId}/history` → OpenAI messages[]
- 重生成接口（更严谨）：
  - `POST /api/custom/apps/{appId}/session/{sessionId}/regenerate { historyIndex }`
- 模型字段容忍度：
  - 允许 `model: "auto"` 或客户端省略；服务端根据 manifest/策略覆盖
- 流式 usage 与会话头：
  - 在 SSE 末帧或响应头返回 `usage`，并统一携带 `X-Session-Id`
- 版本激活/回滚（管理端）：
  - `POST /api/custom/apps/{appId}/ui/activate { version }`

## 4) 安全与限流
- 绑定：校验 `metadata.session_id` 与 `{appId, sessionId}` 是否匹配，防止跨 App 滥用
- 限额：每会话速率/总 tokens 限制与告警；按用户与 App 维度计费/统计
- 审计：固化 policySnapshot（实际 provider/model/参数）到会话，支持复现
- CORS：UI 静态资源建议同源 `/public/...`，避免跨域

## 5) 错误规范
- HTTP：`{ code: string, message: string }`
- SSE：在数据流中追加 `data: {"error": {"code":"...","message":"..."}}` 或直接终止，由客户端以 HTTP 状态判定

