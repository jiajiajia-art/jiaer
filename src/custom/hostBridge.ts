import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import type { UIToHostMessage, HostToUIMessage, CustomIFSessionInfo, ChatMessage } from './types';
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

