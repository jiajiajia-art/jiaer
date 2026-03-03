# 自定义界面（Shadow DOM）AI 交互接口设计与最小用法（基于现有 Galgame 接口封装）

本文件记录：
- 设计目标与分层（不在客户端选择模型）
- 基于“现有游戏接口”的 `aiAPI` 封装（会话/发送/事件/历史/重生成）
- 最小子集 API 规范
- 一个最小调用示例（伪代码，不依赖供应商）

---

## 1) 设计目标（与 SillyTavern 类似但不在客户端选模型）
- 模型选择与路由完全由服务端/宿主决定，客户端不配置 provider/model；客户端仅提交“动作/输入”。
- 会话即资源：先 `start()` 开局（或加载会话），再在会话内 `send()`；支持并发/取消/流式。
- 事件驱动：token 流、完成、错误等完整生命周期，便于做打字机/进度提示。
- 与现有接口对齐：封装自
  - 创建会话：`POST /optical/games/session/create { presetId }`、`POST /visual/session/create { fileId }`
  - 流式动作：`POST /visual/session/{sessionId}/action/stream { action }`
  - 重生成：`POST /visual/session/{sessionId}/regenerate { historyIndex }`
  - 历史：`GET  /visual/session/{sessionId}/history`

## 2) 分层架构（宿主侧内部）
- 会话封装层：负责创建/恢复/查询会话，缓存 `sessionId`。
- 流式发送层：按现有流接口解析分块/事件并转为统一事件。
- aiAPI（暴露给自定义 UI）：会话管理、发送/取消、事件订阅、历史与重生成调用。

## 3) aiAPI（面向自定义 UI）最小子集
（说明：客户端不负责选择模型与路由；所有上下文与资源信息由宿主 SDK 在运行时自动注入。）

- 会话（Session）
  - `ai.session.start() -> Promise<sessionId>`
    - 无参数。SDK 从宿主上下文自动获取一切所需信息（例如：当前是否游玩/编辑、`presetId` 或 `fileId`、已有 `sessionId` 等）。
    - 行为：
      - 若当前路由/状态已存在 `sessionId`（例如游戏内已创建），则直接返回并进入“已连接”状态；
      - 否则 SDK 自动根据上下文创建会话：
        - 游玩：`POST /optical/games/session/create { presetId }`
        - 编辑：`POST /visual/session/create { fileId }`
      - 多次调用 `start()` 必须幂等：已存在会话则复用（可返回 `{ sessionId, resumed: true }` 的语义化状态）。
  - `ai.session.end(sessionId) -> Promise<void>`（可选；若无结束接口，可为 no-op）
  - `ai.session.get(sessionId) -> Promise<sessionState>`（可选）

- 发送与取消（Chat）
  - `ai.chat.send(sessionId, text, options) -> Promise<requestId>`
    - `text`: 提交给后端的动作字符串（与现有 body `{ action: text }` 对齐）
    - `options`: { stream?: boolean }（默认 true；与服务端流式对齐）
  - `ai.chat.cancel(requestId) -> Promise<void>`（中断当前流）

- 历史与重生成（History & Regenerate）
  - `ai.history.get(sessionId) -> Promise<History[]>` → `GET /visual/session/{sessionId}/history`
  - `ai.chat.regenerate(sessionId, { historyIndex }) -> Promise<requestId>` → `POST /visual/session/{sessionId}/regenerate`

- 事件（Events）
  - 订阅：`ai.on(eventName, listener)`；反注册：`ai.off(eventName, listener)`
  - 事件名与负载：
    - `'request-start'`: { requestId, sessionId, inputPreview }
    - `'token'`: { requestId, text, index }
    - `'message'`: { requestId, sessionId, messageId?, role: 'assistant', finalText, finishReason }
    - `'request-error'`: { requestId, code, message }
    - `'request-complete'`: { requestId, usage?: { promptTokens?, completionTokens?, totalTokens? } }

说明：
- 客户端不决定 provider/model，也不传采样/stop 等推理参数；所有模型与推理策略由服务端在会话或路由层决定。
- 自定义 UI 关注：`start()`（无参）→ 发“动作” → 订阅事件 → 渲染。

## 4) 数据对象（最小子集）
- History（对齐后端）：`{ role: 'user'|'assistant'|'system', content: string, createdAt?, metadata? }`（实际字段以后端响应为准）
- 事件响应：`token/message/request-complete/request-error`（载荷见上）

## 5) 最小调用示例（伪代码 / JS 用法示例）
仅演示“如何按最小子集使用”，真实实现内部调用上述已有接口。

```js
// 1) 开启会话（无参；SDK 自动从宿主上下文恢复/创建会话）
const sessionId = await ai.session.start();

// 2) 订阅流式事件
ai.on('request-start', ({ requestId }) => ui.showTyping(requestId));
ai.on('token', ({ requestId, text }) => ui.appendText(requestId, text));
ai.on('message', ({ requestId, finalText }) => ui.finishMessage(requestId, finalText));
ai.on('request-complete', ({ requestId }) => ui.hideTyping(requestId));
ai.on('request-error', ({ requestId, code, message }) => ui.showError(code, message));

// 3) 发送动作（流式）
const reqId = await ai.chat.send(sessionId, '开始游戏', { stream: true });

// 4) （可选）获取历史
const history = await ai.history.get(sessionId);

// 5) （可选）对第 N 条历史重生成
const regenReqId = await ai.chat.regenerate(sessionId, { historyIndex: 12 });

// 6) （可选）取消当前请求
// await ai.chat.cancel(reqId);
```

要点：
- UI 不再关心“调用哪个模型/参数”，只关心“动作文本”；服务端负责会话绑定与模型路由。
- 流式输出靠 `'token'` 与 `'message'`；完成/错误均有事件可用。
- 历史接口与重生成与现有游戏内接口完全一致（路径与语义不变）。

---

## 6) 扩展与约束
- 上下文管理（persona/lorebook/记忆/摘要）由服务端编排；如需增加客户端提示，可在会话 `start()` 的 config 中允许服务端读取 UI 所在场景信息（由宿主注入）。
- 审核与配额统一由服务端执行；客户端只做失败提示与降级兜底（例如展示重试按钮）。
- 多 UI 并存时（多个 HTML 同时加载），每个 UI 可共享同一 `aiAPI` 实例与会话，也可独立会话，互不干扰。

---

## 7) 新增“基础模型模式”游戏类型（与 Galgame 并行）

目标：在现有 Galgame（/visual, /optical 路由）之外，新增一套“最小模型访问 API”驱动的游戏类型（以下简称 FM 游戏：Foundation Model Game）。该类型由服务端负责模型鉴权、路由与推理参数，前端/用户自定义 UI 仅提交“动作/输入”，实现最轻接入与可控安全。

设计要点：
- 统一会话语义：继续沿用“会话即资源”，先 `start()` 再 `send()`，支持并发/取消/流式。
- 服务端托管：模型选择（provider/model）、采样参数、停用词、审计、安全策略均由服务端策略决策（按游戏包/用户/配额路由）。
- 最小 API：`/ai-core/session/*` 一组端点，封装模型调用细节，返回事件流（SSE）。
- 与 aiAPI 对齐：沿用第 3 节 `aiAPI` 最小子集，无需 UI 侧改动；不同游戏类型仅由服务端在 `start()` 内部判断路由。

### 7.1 服务端 API（草案）

- 创建会话
  - `POST /ai-core/session/create`
  - Body（示例）：
    ```json
    {
      "mode": "play" | "edit",
      "resource": { "presetId?": "...", "fileId?": "..." },
      "routeHints?": { "domain?": "story|code|general", "creativity?": "low|mid|high", "safety?": "standard|strict" },
      "gameMeta?": { "gameType": "fm", "packageId?": "pkg_xxx", "version?": "1.0.0" }
    }
    ```
  - 返回：`{ sessionId, resumed, policySnapshotId?, usage? }`

- 流式动作（SSE）
  - `POST /ai-core/session/{sessionId}/chat/stream`
  - Body：`{ input: string, channel?: "action"|"system", metadata?: Record<string, any> }`
  - 事件流（示例行）：
    - `data: { "type":"token", "text":"...", "index":12 }`
    - `data: { "type":"message", "role":"assistant", "finalText":"...", "finishReason":"stop" }`
    - `data: { "type":"complete", "usage": { "promptTokens": 123, "completionTokens": 456, "totalTokens": 579 } }`
    - `data: { "type":"error", "code":"RATE_LIMIT", "message":"..." }`

- 重生成
  - `POST /ai-core/session/{sessionId}/regenerate`
  - Body：`{ historyIndex: number }`

- 历史
  - `GET /ai-core/session/{sessionId}/history`
  - 返回（示意）：`History[]`，与第 4 节最小结构一致。

- 取消（可选）
  - `POST /ai-core/session/{sessionId}/cancel`
  - Body：`{ requestId }`

说明：
- 以上端点均为“基础模型访问层”，模型提供商、秘钥、参数、对话模板、记忆与摘要策略在服务端内部实现，前端不感知。
- 可按 `policySnapshotId` 固化本次会话使用的路由/参数，便于审计与复现。

### 7.2 aiAPI 对齐（UI 不变）

FM 游戏沿用第 3 节 `aiAPI`：
- `ai.session.start()` 内部根据宿主上下文选择：
  - Galgame：走 `/visual`/`/optical` 既有路由；
  - FM 游戏：走 `/ai-core/session/create`；
- `ai.chat.send(sessionId, text, { stream })`：FM 游戏映射到 `/ai-core/session/{id}/chat/stream`；
- `ai.history.get`、`ai.chat.regenerate` 映射到 `/ai-core/session/...`。

事件桥接（从 SSE 到 UI 事件）：
- `'request-start'`：发送前触发（含 `requestId`、`inputPreview`）。
- `'token'`：映射 `type=token`；
- `'message'`：映射 `type=message`；
- `'request-complete'`：映射 `type=complete`（携带 usage）；
- `'request-error'`：映射 `type=error`。

### 7.3 用户自定义游戏包（上传）

为支持用户创建并上传“FM 游戏”，约定一个最小清单 + 资源包：
- 目录与清单（示意）：
  ```
  ai-game/
    ├─ index.html            # UI 入口（建议 Shadow DOM/iframe 方案）
    ├─ assets/**             # 静态资源
    └─ manifest.json         # 元数据
  ```
- manifest.json（草案）：
  ```json
  {
    "name": "My FM Game",
    "version": "1.0.0",
    "entry": "/index.html",
    "capabilities": { "model": "basic-chat", "tools?": ["search"], "history": true },
    "policyHints?": { "domain": "story", "creativity": "mid", "safety": "standard" },
    "ui": { "sandbox": "iframe|shadow", "zIndex": 1700 }
  }
  ```
- 服务端：
  - 完成包上传/存储与静态托管；
  - 解析并固化 `policyHints` 到会话策略；
  - 对外仅暴露 `/ai-core` 端点；UI 通过 `aiAPI` 交互。

安全建议：
- 生产默认使用 iframe + postMessage；Shadow DOM 仅用于可信内置示例；
- 包体积/外链域名白名单/资源限速与 CORS 控制；
- 会话限流与 quota，支持停用或下线特定包版本。

### 7.4 最小 UI 用法（FM 游戏）

```js
// 1) 开启会话（无参；宿主自动选择 FM 游戏并创建 /ai-core 会话）
const sessionId = await ai.session.start();

// 2) 订阅事件
ai.on('token', ({ text }) => ui.append(text));
ai.on('message', ({ finalText }) => ui.render(finalText));
ai.on('request-error', ({ code, message }) => ui.showError(code, message));

// 3) 发送动作
const reqId = await ai.chat.send(sessionId, '开始');

// 4) 历史/重生成
const history = await ai.history.get(sessionId);
await ai.chat.regenerate(sessionId, { historyIndex: history.length - 1 });
```

### 7.5 版本化与兼容
- `/ai-core` 作为稳定基座，按 `Accept: application/vnd.ai-core.v1+json` 或 `/v1/` 版本化；
- 事件字段与错误码采用向后兼容策略；
- Galgame 与 FM 游戏共享 `aiAPI`，宿主以“资源上下文/路由”决定走向，避免 UI 适配两套接口。

### 7.6 迁移与落地步骤
1) 服务端落地 `/ai-core` v1（create/chat/stream/regenerate/history/cancel）。
2) 宿主 SDK：在 `ai.session.start()` 内根据路由决定 Galgame vs FM；
3) 自定义 UI：沿用第 3 节最小子集，无需改动；
4) 管理端：上线“游戏包上传/启用/回滚/配额”与审计面板；
5) 安全：默认 iframe 沙箱，Shadow DOM 仅用于开发/内置示例。
