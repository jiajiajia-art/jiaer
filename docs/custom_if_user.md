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

