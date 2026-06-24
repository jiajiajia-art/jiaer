import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import type { UIToHostMessage, HostToUIMessage, CustomIFSessionInfo, ChatMessage, CustomIFLogPayload, CustomIFKVGetPayload, CustomIFKVSetPayload, CustomIFKVDeletePayload, CustomIFPointsPayPayload } from './types';
import { readOpenAIStream } from './sse';

// Bridge between parent (host) and iframe UI for Custom IF
export class CustomIFHostBridge {
  private iframe: HTMLIFrameElement;
  private session: CustomIFSessionInfo;
  private entryOrigin: string;
  private messages: ChatMessage[] = [];
  private controllers = new Map<string, AbortController>();
  private manifest: any;
  private onMessageHandler?: (ev: MessageEvent) => void;

  constructor(iframe: HTMLIFrameElement, session: CustomIFSessionInfo){
    this.iframe = iframe;
    this.session = session;
    this.entryOrigin = new URL(session.entryUrl, window.location.origin).origin;
  }

  public attach(manifest?: any){
    this.manifest = manifest;
    this.onMessageHandler = (e: MessageEvent) => this.handleMessage(e);
    window.addEventListener('message', this.onMessageHandler);
  }

  public dispose(){
    for (const c of this.controllers.values()) try { c.abort(); } catch {}
    this.controllers.clear();
    if (this.onMessageHandler) window.removeEventListener('message', this.onMessageHandler);
  }

  private post(msg: HostToUIMessage){
    const w = this.iframe?.contentWindow; if (!w) return;
    try { w.postMessage(msg, this.entryOrigin); } catch {}
  }

  private okSource(e: MessageEvent){
    return e.origin === this.entryOrigin && e.source === this.iframe?.contentWindow;
  }

  private handleMessage(e: MessageEvent){
    if (!this.okSource(e)) return;
    const data = e.data as UIToHostMessage | undefined;
    if (!data || typeof data !== 'object' || !('type' in data)) return;

    if (data.type === 'ai:init'){
      this.post({ type: 'ai:ready', payload: { ...this.session, manifest: this.manifest } });
      return;
    }
    if (data.type === 'ai:send'){
      const text = String(data.payload?.text ?? '').slice(0, 8000);
      const stream = data.payload?.stream !== false; // default true
      const requestId = crypto.randomUUID();
      this.post({ type:'ai:request-start', payload:{ requestId, inputPreview: text } });
      if (stream) {
        this.chatStream(requestId, text).catch(err => this.post({ type:'ai:request-error', payload:{ requestId, code:'HTTP', message: String(err?.message || err) } }));
      } else {
        this.chatOnce(text).then(({ text:finalText, usage, headers }) => {
          const rid = crypto.randomUUID();
          this.post({ type:'ai:message', payload:{ requestId: rid, finalText, finishReason:'stop' } });
          this.post({ type:'ai:request-complete', payload:{ requestId: rid, usage, headers } });
        }).catch(err => this.post({ type:'ai:request-error', payload:{ requestId, code:'HTTP', message:String(err?.message||err) } }));
      }
      return;
    }
    if (data.type === 'ai:cancel'){
      const rid = String(data.payload?.requestId||'');
      const c = this.controllers.get(rid); if (c) { try { c.abort(); } catch {}; this.controllers.delete(rid); }
      return;
    }
    if (data.type === 'ai:history:get'){
      this.post({ type:'ai:history', payload:{ messages: this.messages } });
      return;
    }
    if (data.type === 'ai:regenerate'){
      const idx = Number(data.payload?.historyIndex ?? -1);
      this.regenerate(idx).catch(err => this.post({ type:'ai:request-error', payload:{ requestId: crypto.randomUUID(), code:'REGEN', message:String(err?.message||err) } }));
      return;
    }
    if (data.type === 'log:write'){
      this.handleLogWrite(data.payload as CustomIFLogPayload).catch(() => {});
      return;
    }
    if (data.type === 'kv:get'){
      this.handleKVGet(data.payload as CustomIFKVGetPayload).catch(() => {});
      return;
    }
    if (data.type === 'kv:set'){
      this.handleKVSet(data.payload as CustomIFKVSetPayload).catch(() => {});
      return;
    }
    if (data.type === 'kv:delete'){
      this.handleKVDelete(data.payload as CustomIFKVDeletePayload).catch(() => {});
      return;
    }
    if (data.type === 'points:pay'){
      this.handlePointsPay(data.payload as CustomIFPointsPayPayload).catch(() => {});
      return;
    }
  }

  private resolveModel(){
    const m = this.manifest;
    const allowed = Array.isArray(m?.allowedModels) && m.allowedModels.length>0 ? m.allowedModels[0] : undefined;
    return allowed || 'auto';
  }

  private async chatOnce(input: string){
    const body = {
      model: this.resolveModel(),
      messages: [...this.messages, { role:'user', content: input }],
      stream: false,
      metadata: { session_id: this.session.sessionId }
    };
    const url = `${HOST_ADDRESS}/api/custom/apps/${this.session.appId}/openai/v1/chat/completions`;
    const resp = await authFetch(url, { method:'POST', headers:{ 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(await resp.text());
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content ?? '';
    this.messages.push({ role:'user', content: input }, { role:'assistant', content: text });
    return { text, usage: json?.usage, headers: { 'X-Session-Id': resp.headers.get('X-Session-Id') } };
  }

  private async chatStream(requestId: string, input: string){
    const controller = new AbortController();
    this.controllers.set(requestId, controller);
    const body = {
      model: this.resolveModel(),
      messages: [...this.messages, { role:'user', content: input }],
      stream: true,
      metadata: { session_id: this.session.sessionId }
    };
    const url = `${HOST_ADDRESS}/api/custom/apps/${this.session.appId}/openai/v1/chat/completions`;
    const resp = await authFetch(url, { method:'POST', headers:{ 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!resp.ok) throw new Error(await resp.text());
    let acc = '';
    await readOpenAIStream(resp, {
      onDelta: (t) => { acc += t; this.post({ type:'ai:token', payload:{ requestId, text: t, index: acc.length } }); },
      onError: (m) => { this.post({ type:'ai:request-error', payload:{ requestId, code:'SSE', message:m } }); },
      onDone: () => { /* handled below */ }
    });
    this.messages.push({ role:'user', content: input }, { role:'assistant', content: acc });
    this.post({ type:'ai:message', payload:{ requestId, finalText: acc, finishReason: 'stop' } });
    this.post({ type:'ai:request-complete', payload:{ requestId, headers: { 'X-Session-Id': resp.headers.get('X-Session-Id') } } });
    this.controllers.delete(requestId);
  }

  private async handleLogWrite(payload: CustomIFLogPayload){
    const body = {
      sessionId: this.session.sessionId,
      level: payload.level || 'info',
      event: payload.event,
      message: payload.message,
      data: payload.data,
      time: payload.time,
    };
    try {
      const url = `${HOST_ADDRESS}/api/custom/apps/${this.session.appId}/logs`;
      const resp = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        let code = 'HTTP_ERROR';
        let message = `HTTP ${resp.status}`;
        try {
          const j = await resp.json();
          if (j && typeof j.code === 'string') code = j.code;
          if (j && typeof j.message === 'string') message = j.message;
        } catch {}
        this.post({ type: 'log:ack', payload: { ok: false, code, message } });
      } else {
        this.post({ type: 'log:ack', payload: { ok: true } });
      }
    } catch (err: any) {
      this.post({ type: 'log:ack', payload: { ok: false, code: 'NETWORK_ERROR', message: String(err?.message || err) } });
    }
  }

  private async handleKVGet(payload: CustomIFKVGetPayload){
    const requestId = payload.requestId || crypto.randomUUID();
    const scope = payload.scope || 'user';
    const body: any = {
      scope,
      namespace: payload.namespace,
      sessionId: this.session.sessionId,
      keys: payload.keys,
      prefix: payload.prefix,
      limit: payload.limit,
    };
    try {
      const url = `${HOST_ADDRESS}/api/custom/apps/${this.session.appId}/kv/get`;
      const resp = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json: any = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        this.post({
          type: 'kv:result',
          payload: {
            requestId,
            success: false,
            op: 'get',
            code: json?.code || 'HTTP_ERROR',
            message: json?.message || resp.statusText,
          },
        });
        return;
      }
      const data = json?.data || {};
      const values = data.values && typeof data.values === 'object' ? data.values : {};
      const retScope = (data.scope as any) || scope;
      const ns = typeof data.namespace === 'string' ? data.namespace : payload.namespace;
      this.post({
        type: 'kv:result',
        payload: {
          requestId,
          success: true,
          op: 'get',
          kv: { scope: retScope, namespace: ns, values },
        },
      });
    } catch (err: any) {
      this.post({
        type: 'kv:result',
        payload: {
          requestId,
          success: false,
          op: 'get',
          code: 'NETWORK_ERROR',
          message: String(err?.message || err),
        },
      });
    }
  }

  private async handleKVSet(payload: CustomIFKVSetPayload){
    const requestId = payload.requestId || crypto.randomUUID();
    const scope = payload.scope || 'user';
    const body: any = {
      scope,
      namespace: payload.namespace,
      sessionId: this.session.sessionId,
      items: payload.items || [],
    };
    try {
      const url = `${HOST_ADDRESS}/api/custom/apps/${this.session.appId}/kv/set`;
      const resp = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json: any = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        this.post({
          type: 'kv:result',
          payload: {
            requestId,
            success: false,
            op: 'set',
            code: json?.code || 'HTTP_ERROR',
            message: json?.message || resp.statusText,
          },
        });
        return;
      }
      const data = json?.data || {};
      const valuesFromServer = data.values && typeof data.values === 'object' ? data.values : undefined;
      const values = valuesFromServer || Object.fromEntries((payload.items || []).map(i => [i.key, i.value]));
      const retScope = (data.scope as any) || scope;
      const ns = typeof data.namespace === 'string' ? data.namespace : payload.namespace;
      this.post({
        type: 'kv:result',
        payload: {
          requestId,
          success: true,
          op: 'set',
          kv: { scope: retScope, namespace: ns, values },
        },
      });
    } catch (err: any) {
      this.post({
        type: 'kv:result',
        payload: {
          requestId,
          success: false,
          op: 'set',
          code: 'NETWORK_ERROR',
          message: String(err?.message || err),
        },
      });
    }
  }

  private async handleKVDelete(payload: CustomIFKVDeletePayload){
    const requestId = payload.requestId || crypto.randomUUID();
    const scope = payload.scope || 'user';
    const body: any = {
      scope,
      namespace: payload.namespace,
      sessionId: this.session.sessionId,
      keys: payload.keys || [],
    };
    try {
      const url = `${HOST_ADDRESS}/api/custom/apps/${this.session.appId}/kv/delete`;
      const resp = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json: any = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        this.post({
          type: 'kv:result',
          payload: {
            requestId,
            success: false,
            op: 'delete',
            code: json?.code || 'HTTP_ERROR',
            message: json?.message || resp.statusText,
          },
        });
        return;
      }
      this.post({
        type: 'kv:result',
        payload: {
          requestId,
          success: true,
          op: 'delete',
        },
      });
    } catch (err: any) {
      this.post({
        type: 'kv:result',
        payload: {
          requestId,
          success: false,
          op: 'delete',
          code: 'NETWORK_ERROR',
          message: String(err?.message || err),
        },
      });
    }
  }

  private async handlePointsPay(payload: CustomIFPointsPayPayload){
    const requestId = payload.requestId || crypto.randomUUID();
    const body = {
      amount: payload.amount,
      idempotencyKey: requestId,
    };
    try {
      const url = `${HOST_ADDRESS}/api/custom/apps/${this.session.appId}/points/pay`;
      const resp = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json: any = await resp.json().catch(() => ({}));
      const success = json && typeof json.success === 'boolean' ? json.success : resp.ok;
      if (!success) {
        this.post({
          type: 'points:result',
          payload: {
            requestId,
            success: false,
            consumed: json?.consumed,
            balance: json?.balance,
            currency: json?.currency,
            code: json?.code || 'HTTP_ERROR',
            message: json?.message || resp.statusText,
            txnId: json?.txnId,
          },
        });
        return;
      }
      this.post({
        type: 'points:result',
        payload: {
          requestId,
          success: true,
          consumed: json?.consumed,
          balance: json?.balance,
          currency: json?.currency,
          txnId: json?.txnId,
        },
      });
    } catch (err: any) {
      this.post({
        type: 'points:result',
        payload: {
          requestId,
          success: false,
          code: 'NETWORK_ERROR',
          message: String(err?.message || err),
        },
      });
    }
  }

  private async regenerate(historyIndex: number){
    if (!Number.isFinite(historyIndex) || historyIndex < 0) return;
    // local simulate: keep messages up to index, then re-ask last user
    // historyIndex 以 messages[] 为序；用户可根据实际实现调整
    const clipped = this.messages.slice(0, historyIndex);
    const lastUser = [...clipped].reverse().find(m => m.role==='user')?.content || '';
    this.messages = clipped.filter(Boolean);
    if (lastUser) {
      const reqId = crypto.randomUUID();
      this.post({ type:'ai:request-start', payload:{ requestId: reqId, inputPreview: lastUser } });
      await this.chatStream(reqId, lastUser);
    }
  }
}

