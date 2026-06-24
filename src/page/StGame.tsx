import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import FooterArea from '../components/Layout/FooterArea';
import styles from './StGame.module.css';
import { stApi, type StChatMessage, type StRenderRule } from '../api/stGame';
import StShowdownText from '../components/StGame/StShowdownText';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import { buildStSceneSrcDoc } from '../utils/stSceneHtml';
import { useTranslation } from 'react-i18next';
import type { Currency } from '../api/common/currency';

type CreateResp = {
  success: boolean;
  sessionId: string;
  entryUrl?: string; // unused in showdown mode
  opening?: { text?: string };
  renderRegex?: StRenderRule[];
  materialsHash?: string;
};

type ActResp = {
  success: boolean;
  reply: { text: string };
  renderRegex?: StRenderRule[];
  materialsHash?: string;
};

type Msg = { role: 'user'|'assistant'; text: string; streaming?: boolean };

type StPointsPayPayload = {
  requestId?: string;
  amount: number;
  currency?: Currency;
  dryRun?: boolean;
};

type SceneMsg =
  | { type: 'st:ready'; payload: { appId: string; sessionId: string; assetBase?: string; protocols?: { actionByMessages: boolean } } }
  | { type: 'st:assistant'; payload: { requestId: string; text: string } }
  | { type: 'st:assistant_delta'; payload: { requestId: string; text: string } }
  | { type: 'st:assistant_done'; payload: { requestId: string } }
  | { type: 'st:kv:result'; payload: { requestId: string; success: boolean; op: 'get' | 'set' | 'delete'; code?: string; message?: string; kv?: { scope: 'user' | 'session'; namespace?: string; values: Record<string, unknown> } } }
  | { type: 'st:points:result'; payload: { requestId: string; success: boolean; consumed?: number; balance?: number; currency?: Currency; code?: string; message?: string; txnId?: string } }
  | { type: 'st:error'; payload: { requestId: string; message: string } }
  | { type: 'st:debug'; payload: { phase: string; message: string; ts: number } };

type SceneActionByMessagesPayload = {
  requestId?: string;
  messages?: unknown;
  globals?: unknown;
  model?: unknown;
  stream?: unknown;
};

const StGame: React.FC = () => {
    const { t } = useTranslation();
    const { appId } = useParams();
  const [sessionId, setSessionId] = useState<string>('');
  const [rules, setRules] = useState<StRenderRule[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [openingHtml, setOpeningHtml] = useState<string>('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const sceneIframeRef = useRef<HTMLIFrameElement>(null);
  const sendingRef = useRef(false);

  const assetPrefix = useMemo(() => `${HOST_ADDRESS}/public/custom/apps/${appId || ''}/assets`, [appId]);
  const isSceneMode = !!openingHtml.trim();
  const openingSrcDoc = useMemo(
    () => buildStSceneSrcDoc(openingHtml, assetPrefix),
    [openingHtml, assetPrefix],
  );

  const postSceneMessage = (msg: SceneMsg) => {
    const target = sceneIframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(msg, '*');
  };

  const postSceneDebug = (phase: string, message: string) => {
    if (!isSceneMode) return;
    postSceneMessage({
      type: 'st:debug',
      payload: { phase, message, ts: Date.now() },
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!appId) return;
      try {
        setLoading(true);
        const resp = await stApi.createSession(appId, { autoStart: true });
        const data: CreateResp = resp.data;
        if (cancelled) return;
        if (!data?.success) throw new Error(t('stGame.sessionCreateFailed'));
        setSessionId(data.sessionId);
        setRules(data.renderRegex || []);
        const openingText = String(data.opening?.text || '');
        const hasHtmlOpening = /<(html|head|body|script|style|div|section|main)\b|<!doctype/i.test(openingText);
        if (hasHtmlOpening) {
          setOpeningHtml(openingText);
          postSceneDebug('session', '检测到开场 HTML，进入场景模式');
        } else if (openingText) {
          setMessages([{ role: 'assistant', text: openingText }]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const readSSE = async (
    resp: Response,
    handlers: {
      onDelta: (text: string) => void;
      onDone?: () => void;
    },
  ) => {
    if (!resp.ok || !resp.body) {
      throw new Error(`stream request failed: ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    let doneAll = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const lines = frame.split('\n').map(s => s.trim()).filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim();
          if (dataStr === '[DONE]') {
            doneAll = true;
            handlers.onDone?.();
            break;
          }
          try {
            const json = JSON.parse(dataStr);
            const choice = json?.choices?.[0];
            const piece: string = choice?.delta?.content || '';
            if (piece) {
              handlers.onDelta(piece);
            }
          } catch (err) {
            console.warn('SSE parse error:', err);
          }
        }
        if (doneAll) break;
      }
      if (doneAll) break;
    }
  };

  const normalizeManagedMessages = (raw: unknown): StChatMessage[] => {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const role = String((item as Record<string, unknown>).role || '');
      if (role !== 'system' && role !== 'user' && role !== 'assistant') return [];
      const content = (item as Record<string, unknown>).content;
      if (content == null) return [];
      return [{ role, content: String(content) }];
    });
  };

  const validateManagedMessages = (managedMessages: StChatMessage[]) => {
    if (!managedMessages.length) {
      return 'messages 缺失';
    }
    const lastNonSystem = [...managedMessages].reverse().find((msg) => msg.role !== 'system');
    if (!lastNonSystem || lastNonSystem.role !== 'user') {
      return '最后一条非 system 消息必须是 user';
    }
    return '';
  };

  const sendByMessages = async (payload: SceneActionByMessagesPayload) => {
    if (!appId || !sessionId || sendingRef.current) return;

    const requestId = typeof payload.requestId === 'string' && payload.requestId.trim()
      ? payload.requestId.trim()
      : crypto.randomUUID();
    const managedMessages = normalizeManagedMessages(payload.messages);
    const validationError = validateManagedMessages(managedMessages);
    if (validationError) {
      postSceneMessage({
        type: 'st:error',
        payload: { requestId, message: validationError },
      });
      return;
    }

    const stream = payload.stream !== false;
    const body: {
      messages: StChatMessage[];
      globals?: unknown;
      model?: string;
      stream?: boolean;
    } = {
      messages: managedMessages,
      stream,
    };
    if (payload.globals !== undefined) {
      body.globals = payload.globals;
    }
    if (typeof payload.model === 'string' && payload.model.trim()) {
      body.model = payload.model.trim();
    }

    sendingRef.current = true;
    setSending(true);

    try {
      if (stream) {
        let acc = '';
        const resp = await authFetch(`${HOST_ADDRESS}/api/st/apps/${appId}/session/${sessionId}/action-by-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
          body: JSON.stringify(body),
        });
        await readSSE(resp, {
          onDelta: (piece) => {
            acc += piece;
            postSceneMessage({
              type: 'st:assistant_delta',
              payload: { requestId, text: piece },
            });
          },
          onDone: () => {
            if (!acc) {
              postSceneMessage({
                type: 'st:assistant',
                payload: { requestId, text: '' },
              });
            }
            postSceneMessage({
              type: 'st:assistant_done',
              payload: { requestId },
            });
          },
        });
        return;
      }

      const resp = await stApi.actByMessages(appId, sessionId, body);
      const data = resp.data as ActResp;
      if (!data?.success) {
        throw new Error(t('stGame.actionByMessagesFailed'));
      }
      setRules(data.renderRegex || []);
      postSceneMessage({
        type: 'st:assistant',
        payload: { requestId, text: String(data.reply?.text || '') },
      });
    } catch (err) {
      postSceneMessage({
        type: 'st:error',
        payload: {
          requestId,
          message: String((err as Error)?.message || err || '请求失败'),
        },
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const send = async (rawText?: string) => {
    if (!appId || !sessionId || sendingRef.current) return;
    const text = String(rawText ?? input).trim();
    if (!text) return;
    if (!rawText) setInput('');

    if (!isSceneMode) {
      // 聊天模式下：先放入用户消息与占位的助手消息（流式）
      setMessages(prev => [...prev, { role: 'user', text }, { role: 'assistant', text: '', streaming: true }]);
    }
    sendingRef.current = true;
    setSending(true);

    try {
      // 优先尝试流式（SSE，OpenAI 兼容 chunk）
      const requestId = crypto.randomUUID();
      const url = `${HOST_ADDRESS}/api/st/apps/${appId}/session/${sessionId}/action`;
      const controller = new AbortController();
      const resp = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ input: text, stream: true }),
        signal: controller.signal,
      });
      let acc = '';

      const appendDelta = (deltaText: string) => {
        if (!deltaText) return;
        acc += deltaText;
        if (!isSceneMode) {
          setMessages(prev => {
            const out = prev.slice();
            // 找到最后一条 streaming 的助手消息
            for (let i = out.length - 1; i >= 0; i--) {
              if (out[i].role === 'assistant' && out[i].streaming) {
                out[i] = { ...out[i], text: (out[i].text || '') + deltaText };
                break;
              }
            }
            return out;
          });
        }
      };
      await readSSE(resp, {
        onDelta: (piece) => {
          appendDelta(piece);
          if (isSceneMode) {
            postSceneMessage({
              type: 'st:assistant_delta',
              payload: { requestId, text: piece },
            });
          }
        },
      });

      // 流式结束：把最后一条助手消息从 streaming 切换为最终（用正则+showdown 渲染）
      if (isSceneMode) {
        if (!acc) {
          postSceneMessage({
            type: 'st:assistant',
            payload: { requestId, text: '' },
          });
        }
        postSceneMessage({
          type: 'st:assistant_done',
          payload: { requestId },
        });
      } else {
        setMessages(prev => {
          const out = prev.slice();
          for (let i = out.length - 1; i >= 0; i--) {
            if (out[i].role === 'assistant' && out[i].streaming) {
              out[i] = { ...out[i], streaming: false };
              break;
            }
          }
          return out;
        });
      }

    } catch (err) {
      console.error('stream failed, fallback to non-stream:', err);
      // 回退到非流式
      try {
        const resp2 = await stApi.act(appId, sessionId, { input: text });
        const data2 = resp2.data as ActResp;
        if (data2?.success) {
          setRules(data2.renderRegex || rules);
          if (isSceneMode) {
            const fallbackRequestId = crypto.randomUUID();
            postSceneMessage({
              type: 'st:assistant',
              payload: { requestId: fallbackRequestId, text: data2.reply.text },
            });
          } else {
            setMessages(prev => {
              const out = prev.slice();
              // 移除 streaming 占位，换成最终文本
              for (let i = out.length - 1; i >= 0; i--) {
                if (out[i].role === 'assistant' && out[i].streaming) {
                  out[i] = { role: 'assistant', text: data2.reply.text };
                  return out;
                }
              }
              // 若未找到占位，直接追加
              out.push({ role: 'assistant', text: data2.reply.text });
              return out;
            });
          }
        }
      } catch (e2) {
        console.error(e2);
        if (isSceneMode) {
          postSceneMessage({
            type: 'st:error',
            payload: {
              requestId: crypto.randomUUID(),
              message: String((e2 as Error)?.message || e2 || t('stGame.requestFailed')),
            },
          });
        }
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  useEffect(() => {
    if (!isSceneMode || !sessionId || !appId) return;

    const handleSceneKV = async (type: string, payload: Record<string, unknown>) => {
      const requestId = String(payload.requestId || crypto.randomUUID());
      const op = type === 'st:kv:set' ? 'set' : type === 'st:kv:delete' ? 'delete' : 'get';
      const scope = payload.scope === 'user' ? 'user' : 'session';
      const namespace = typeof payload.namespace === 'string' ? payload.namespace : undefined;

      try {
        const body: Record<string, unknown> = {
          scope,
          namespace,
          sessionId,
        };
        if (op === 'get') {
          body.keys = Array.isArray(payload.keys) ? payload.keys : undefined;
          body.prefix = typeof payload.prefix === 'string' ? payload.prefix : undefined;
          body.limit = typeof payload.limit === 'number' ? payload.limit : undefined;
        } else if (op === 'set') {
          body.items = Array.isArray(payload.items) ? payload.items : [];
        } else {
          body.keys = Array.isArray(payload.keys) ? payload.keys : [];
        }

        const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${appId}/kv/${op}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await resp.json().catch(() => ({} as Record<string, unknown>));
        if (!resp.ok || json?.success === false) {
          postSceneDebug('kv', `${op} 失败 requestId=${requestId}`);
          postSceneMessage({
            type: 'st:kv:result',
            payload: {
              requestId,
              success: false,
              op,
              code: String((json as Record<string, unknown>)?.code || 'HTTP_ERROR'),
              message: String((json as Record<string, unknown>)?.message || resp.statusText || 'KV request failed'),
            },
          });
          return;
        }

        const data = ((json as Record<string, unknown>)?.data || {}) as Record<string, unknown>;
        const values = (data.values && typeof data.values === 'object' ? data.values : {}) as Record<string, unknown>;
        postSceneMessage({
          type: 'st:kv:result',
          payload: {
            requestId,
            success: true,
            op,
            kv: {
              scope: (data.scope === 'user' ? 'user' : scope),
              namespace: typeof data.namespace === 'string' ? data.namespace : namespace,
              values,
            },
          },
        });
      } catch (err) {
        postSceneDebug('kv', `${op} 异常 requestId=${requestId}`);
        postSceneMessage({
          type: 'st:kv:result',
          payload: {
            requestId,
            success: false,
            op,
            code: 'NETWORK_ERROR',
            message: String((err as Error)?.message || err),
          },
        });
      }
    };

    const handlePointsPay = async (payload: StPointsPayPayload) => {
      const requestId = String(payload.requestId || crypto.randomUUID());
      const currency = payload.currency === 'diamonds' ? 'diamonds' : 'points';
      const body = {
        amount: payload.amount,
        idempotencyKey: requestId,
        ...(payload.currency && { currency: payload.currency }),
        ...(payload.dryRun && { dryRun: true }),
      };

      try {
        const url = `${HOST_ADDRESS}/api/custom/apps/${appId}/points/pay`;
        const resp = await authFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await resp.json().catch(() => ({} as Record<string, unknown>));
        const success = json && typeof json.success === 'boolean' ? json.success : resp.ok;

        if (!success) {
          postSceneDebug('points', `支付失败 requestId=${requestId}`);
          postSceneMessage({
            type: 'st:points:result',
            payload: {
              requestId,
              success: false,
              consumed: json?.consumed as number | undefined,
              balance: json?.balance as number | undefined,
              currency,
              code: String((json as Record<string, unknown>)?.code || 'HTTP_ERROR'),
              message: String((json as Record<string, unknown>)?.message || resp.statusText || 'Payment failed'),
              txnId: json?.txnId as string | undefined,
            },
          });
          return;
        }

        postSceneMessage({
          type: 'st:points:result',
          payload: {
            requestId,
            success: true,
            consumed: json?.consumed as number | undefined,
            balance: json?.balance as number | undefined,
            currency,
            txnId: json?.txnId as string | undefined,
          },
        });
      } catch (err) {
        postSceneDebug('points', `支付异常 requestId=${requestId}`);
        postSceneMessage({
          type: 'st:points:result',
          payload: {
            requestId,
            success: false,
            currency,
            code: 'NETWORK_ERROR',
            message: String((err as Error)?.message || err),
          },
        });
      }
    };

    const handler = (event: MessageEvent) => {
      if (event.source !== sceneIframeRef.current?.contentWindow) return;
      const data = event.data as Record<string, unknown>;
      if (!data || typeof data !== 'object') return;
      const type = String(data.type || '');
      const payload = (data.payload || {}) as Record<string, unknown>;

      if (type === 'st:init') {
        postSceneDebug('bridge', '收到 st:init，回传 st:ready');
        postSceneMessage({
          type: 'st:ready',
          payload: { appId, sessionId, assetBase: assetPrefix, protocols: { actionByMessages: true } },
        });
        return;
      }

      if (type === 'st:return') {
        const text = String(payload.text || '').trim();
        postSceneDebug('bridge', `收到 st:return，text="${text || '继续(兜底)'}"`);
        void send(text || '继续');
        return;
      }

      if (type === 'st:action-by-messages') {
        postSceneDebug('bridge', '收到 st:action-by-messages，转发 action-by-messages');
        void sendByMessages(payload as SceneActionByMessagesPayload);
        return;
      }

      if (type === 'st:kv:get' || type === 'st:kv:set' || type === 'st:kv:delete') {
        void handleSceneKV(type, payload);
      }

      if (type === 'st:points:pay') {
        postSceneDebug('bridge', '收到 st:points:pay，转发积分支付');
        void handlePointsPay(payload as StPointsPayPayload);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isSceneMode, sessionId, appId, send]);

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>{t('stGame.loading')}</div>;

  if (isSceneMode) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
        <iframe
          ref={sceneIframeRef}
          title="STScene"
          srcDoc={openingSrcDoc}
          style={{ display: 'block', width: '100%', height: '100%', border: 'none', background: '#000' }}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        />
      </div>
    );
  }

  return (
    <div className={styles.pageRoot}>
      <div className={styles.main}>
        <div className={styles.chat} ref={listRef}>
          {messages.map((m, idx) => (
            <div key={idx} className={m.role === 'user' ? styles.msgUser : styles.msgAi}>
              {m.role === 'user' ? (
                <div className={styles.userBubble}>{m.text}</div>
              ) : m.streaming ? (
                <div className={styles.aiBubble}>{m.text}</div>
              ) : (
                <StShowdownText
                  text={m.text}
                  rules={rules}
                  assetPrefix={assetPrefix}
                  className={styles.aiBubble}
                />
              )}
            </div>
          ))}
        </div>
        <div className={styles.inputBar}>
          <input
            className={styles.text}
            placeholder={t('stGame.inputPlaceholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
            disabled={sending}
          />
          <button className={styles.send} onClick={() => { void send(); }} disabled={sending || !input.trim()}>{t('stGame.send')}</button>
        </div>
      </div>
      <FooterArea />
    </div>
  );
};

export default StGame;
