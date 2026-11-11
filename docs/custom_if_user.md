# 自定义类型游戏（Custom IF）创作者文档

面向 UI 包作者的最小接入说明。你只需上传一个 `index.html`，通过 postMessage 与宿主交互，无需也不应直接访问模型接口或持有密钥。

## 流程总览
- 创建 App：`POST /api/custom/apps/create-empty {"title":"My Custom IF"}` → `appId`
- 上传 UI：`POST /api/custom/apps/{appId}/ui/upload`（multipart：version、index、manifest[可选]）
- 进入游戏时：宿主创建会话 `POST /api/custom/apps/{appId}/session/create`，响应返回 `sessionId`、`version`、`entryUrl`（已确认后端返回）。宿主用 iframe 加载你的 UI。

## iframe 通信协议（postMessage）
- UI → 宿主（请求）
  - `ai:init` → 告知宿主 UI 已就绪
  - `ai:send` `{ text:string, stream?:boolean }` → 发送用户输入
  - `ai:cancel` `{ requestId:string }` → 取消当前请求
  - `ai:history:get` → 请求当前会话历史（若服务端无接口，则由宿主本地聚合）
  - `ai:regenerate` `{ historyIndex:number }` → 基于历史重试（宿主可本地实现或转发服务端）
- 宿主 → UI（事件）
  - `ai:ready` `{ appId, version, sessionId, entryUrl, manifest? }` → 握手信息
  - `ai:request-start` `{ requestId, inputPreview }`
  - `ai:token` `{ requestId, text, index }` → 流式 token（OpenAI chunk delta 映射）
  - `ai:message` `{ requestId, finalText, finishReason }` → 完整回复
  - `ai:request-error` `{ requestId, code, message }`
  - `ai:request-complete` `{ requestId, usage?, headers?:{ 'X-Session-Id': string } }`
  - `ai:history` `{ messages: Array<{role,content}> }`

说明：UI 不显示“模型选择”；由服务端/宿主决定模型与推理参数。若需要提示能力，可读取 `ai:ready.manifest`。

## 最小示例（index.html）
```html
<!doctype html><meta charset="utf-8"><style>body{font:14px system-ui;padding:16px}</style>
<input id="q" placeholder="输入..."/> <button onclick="ask()">发送</button>
<pre id="log"></pre>
<script>
  let sessionId=null; const host=window.parent; const logEl=document.getElementById('log');
  function send(type,payload){ host.postMessage({type,payload}, '*'); }
  function log(t){ logEl.textContent+=t; logEl.scrollTop=logEl.scrollHeight; }
  function ask(){ const v=document.getElementById('q').value.trim(); if(!v) return; send('ai:send',{text:v,stream:true}); }
  window.addEventListener('message',(e)=>{
    const {type,payload}=e.data||{};
    if(type==='ai:ready'){ sessionId=payload.sessionId; log(`[ready] app=${payload.appId} v${payload.version}\n`); }
    if(type==='ai:request-start'){ log(`> ${payload.inputPreview}\n`); }
    if(type==='ai:token'){ log(payload.text); }
    if(type==='ai:message'){ log(`\n---\n${payload.finalText}\n---\n`); }
    if(type==='ai:request-error'){ log(`[error] ${payload.code}: ${payload.message}\n`); }
    if(type==='ai:request-complete'){ log('[done]\n'); }
  });
  send('ai:init');
// 可选：send('ai:history:get');
// 可选：send('ai:regenerate',{historyIndex: 12});
</script>
```

## 清单 manifest（可选）
上传时可提供 JSON 文本，例如：
```json
{ "allowedModels": ["claude-3-5-sonnet-20240620"], "capabilities": { "history": true } }
```
由服务端/宿主按策略选择实际模型（UI 不直接决定模型）。

## 约束与建议
- 安全：不引入第三方高风险脚本；所有模型调用由宿主代发；不要尝试访问 /api/custom/*。
- 体积：控制包体积；资源路径相对 index.html；版本号语义化。
- 体验：在 `ai:request-error` 后提供重试按钮；在 `ai:request-complete` 后滚动到输出末尾。

## 扩展功能：日志 / KV 存储 / 积分支付

在基础 `ai:*` 协议之外，自定义 UI 还可以通过以下消息与宿主交互：

### 1. 记录日志

- UI → 宿主：
  - `log:write` `{ level?:'debug'|'info'|'warn'|'error', event:string, message?:string, data?:any, time?:string }`
    - 示例：
      ```js
      parent.postMessage({
        type: 'log:write',
        payload: {
          level: 'info',
          event: 'stage_clear',
          message: '第三关完成',
          data: { stageId: 3, score: 12345 },
        },
      }, '*');
      ```
- 宿主 → UI：
  - `log:ack` `{ ok:boolean, code?:string, message?:string }`（可选，表示写入结果）

### 2. KV 存取记录（底层 Key-Value）

KV 用于存放通用状态（例如存档、进度、解锁标记等），不绑定任何业务语义。

- UI → 宿主：
  - `kv:get` `{ requestId, scope?:'user'|'session', namespace?:string, keys?:string[], prefix?:string, limit?:number }`
    - `scope`：`user` 表示 `(userId, appId)` 级别；`session` 表示绑定当前会话。
    - `namespace`：可选逻辑分组，如 `'game'` / `'ui'`。
    - `keys` 或 `prefix` 二选一。
  - `kv:set` `{ requestId, scope?, namespace?, items: Array<{ key:string; value:any; ttlSeconds?:number }> }`
  - `kv:delete` `{ requestId, scope?, namespace?, keys:string[] }`
- 宿主 → UI：
  - `kv:result` `{ requestId, success:boolean, op:'get'|'set'|'delete', code?:string, message?:string, kv?:{ scope, namespace?, values:Record<string,any> } }`

示例：读取并保存进度：

```js
// 读取进度
const getId = 'kv_get_' + Date.now();
parent.postMessage({
  type: 'kv:get',
  payload: { requestId: getId, scope: 'user', namespace: 'game', keys: ['progress', 'flags'] },
}, '*');

window.addEventListener('message', (e) => {
  const { type, payload } = e.data || {};
  if (type === 'kv:result' && payload.requestId === getId && payload.success && payload.kv) {
    const { values } = payload.kv;
    console.log('当前进度:', values.progress);
  }
});

// 保存进度
const setId = 'kv_set_' + Date.now();
parent.postMessage({
  type: 'kv:set',
  payload: {
    requestId: setId,
    scope: 'user',
    namespace: 'game',
    items: [
      { key: 'progress', value: { chapter: 3, checkpoint: 'forest' } },
      { key: 'flags', value: { secretUnlocked: true } },
    ],
  },
}, '*');
```

### 3. 支付积分（积分消费）

- UI → 宿主：
  - `points:pay` `{ requestId, amount:number, reason?:string, metadata?:any, dryRun?:boolean }`
    - `amount`：本次需要扣除的积分。
    - `reason` / `metadata`：描述用途，如 `{ reason:'unlock-chapter', metadata:{ chapterId:'ch03' } }`。
    - `dryRun:true` 表示只试算不扣费。
- 宿主 → UI：
  - `points:result` `{ requestId, success:boolean, consumed?:number, balance?:number, code?:string, message?:string, txnId?:string }`

示例：尝试扣除 20 积分解锁关卡：

```js
const payId = 'points_' + Date.now();
parent.postMessage({
  type: 'points:pay',
  payload: {
    requestId: payId,
    amount: 20,
    reason: 'unlock-chapter',
    metadata: { chapterId: 'ch03' },
  },
}, '*');

window.addEventListener('message', (e) => {
  const { type, payload } = e.data || {};
  if (type === 'points:result' && payload.requestId === payId) {
    if (payload.success) {
      console.log('扣费成功，当前积分余额：', payload.balance);
    } else {
      alert(payload.message || '积分扣除失败');
    }
  }
});
```

> 注意：自定义 UI 不应直接访问平台后端 `/api/*`，所有日志、存储、积分操作都必须通过以上 postMessage 协议交给宿主代为处理。
