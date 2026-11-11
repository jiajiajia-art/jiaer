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

## 6) 自定义游戏扩展接口：日志 / KV / 积分

以下接口均以登录态中的 `userId` 为主体，并校验 `sessionId` 与 `{appId}` 绑定关系。错误返回统一使用 `{ code:string, message:string }`。

### 6.1 日志记录接口

- 接口：`POST /api/custom/apps/{appId}/logs`
- 请求体：
  ```json
  {
    "sessionId": "sess_xxx",
    "level": "info",
    "event": "stage_clear",
    "message": "第三关完成",
    "data": { "stageId": 3, "score": 12345 },
    "time": "2026-03-06T10:20:30.000Z"
  }
  ```
- 响应：
  ```json
  { "success": true }
  ```
- 建议：限制单条日志体积（如 data JSON 不超过 2KB），并自动补充 `userId`、`ip`、`ua`、`analyticsSessionId` 等字段用于审计。

### 6.2 KV 存取接口（底层 Key-Value）

KV 以 `(userId, appId, scope, namespace, key)` 为主键，值为 JSON 文本。

#### 6.2.1 读取 KV

- 接口：`POST /api/custom/apps/{appId}/kv/get`
- 请求体：
  ```json
  {
    "scope": "user",
    "namespace": "game",
    "sessionId": "sess_xxx",
    "keys": ["progress", "flags"],
    "prefix": null,
    "limit": 32
  }
  ```
  - `scope`：`user` 或 `session`。当为 `session` 时必须提供 `sessionId`。
  - `keys` / `prefix` 二选一；`prefix` 适合按前缀批量读取。
- 响应：
  ```json
  {
    "success": true,
    "data": {
      "scope": "user",
      "namespace": "game",
      "values": {
        "progress": { "chapter": 3, "checkpoint": "forest" },
        "flags": { "secretUnlocked": true }
      }
    }
  }
  ```

#### 6.2.2 写入 KV

- 接口：`POST /api/custom/apps/{appId}/kv/set`
- 请求体：
  ```json
  {
    "scope": "user",
    "namespace": "game",
    "sessionId": "sess_xxx",
    "items": [
      { "key": "progress", "value": { "chapter": 3, "checkpoint": "forest" } },
      { "key": "flags", "value": { "secretUnlocked": true } }
    ]
  }
  ```
- 响应（示例）：
  ```json
  {
    "success": true,
    "data": {
      "scope": "user",
      "namespace": "game",
      "values": {
        "progress": { "chapter": 3, "checkpoint": "forest" },
        "flags": { "secretUnlocked": true }
      }
    }
  }
  ```

#### 6.2.3 删除 KV

- 接口：`POST /api/custom/apps/{appId}/kv/delete`
- 请求体：
  ```json
  {
    "scope": "user",
    "namespace": "game",
    "sessionId": "sess_xxx",
    "keys": ["progress", "flags"]
  }
  ```
- 响应：
  ```json
  {
    "success": true,
    "data": { "deleted": ["progress", "flags"] }
  }
  ```

- 限制建议：
  - key 长度不超过 128，推荐字符集 `[a-zA-Z0-9._-]`。
  - 单个 value 序列化后不超过 8KB，总 KV 存储（按 `(userId, appId, scope, namespace)` 维度）不超过 128KB。
  - 单次请求 items/keys 数量不超过 32。

### 6.3 积分支付接口

- 接口：`POST /api/custom/apps/{appId}/points/pay`
- 请求体：
  ```json
  {
    "sessionId": "sess_xxx",
    "amount": 20,
    "reason": "unlock-chapter",
    "metadata": { "chapterId": "ch03" },
    "dryRun": false,
    "idempotencyKey": "points_1719999999999"
  }
  ```
- 响应（成功）：
  ```json
  {
    "success": true,
    "consumed": 20,
    "balance": 120,
    "txnId": "txn_abc123"
  }
  ```
- 响应（积分不足）：
  ```json
  {
    "success": false,
    "code": "INSUFFICIENT_POINTS",
    "message": "积分不足",
    "balance": 5
  }
  ```
- 实现要点：
  - 根据登录态识别 `userId`，并检查该用户是否允许在 `{appId}` 下消费积分。
  - 使用 `idempotencyKey` 做幂等，避免前端刷新 / 重试造成重复扣费。
  - 建议在账务系统中记录清晰的渠道和用途（如 `channel: 'custom_if'`, `reason`, `metadata`），便于对账与审计。
