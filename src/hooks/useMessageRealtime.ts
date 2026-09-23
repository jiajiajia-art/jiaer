import { useEffect, useRef } from 'react';
import { HOST_ADDRESS, ON_SERVER } from '../config';
import { useAuthStore } from '../store/useAuthStore';
import { useMessageStore } from '../store/useMessageStore';

const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 60000;
const PING_INTERVAL_MS = 30000;
const PONG_TIMEOUT_MS = 10000;

type RealtimeMessage = {
  type?: string;
  ts?: number;
};

/**
 * WS 地址与 HTTP API 对齐：
 * - HOST_ADDRESS 为绝对 URL（如 api-test）→ 直连该主机 wss
 * - HOST 为空且本地开发 → 走 Vite 同源 /api 代理（需本机后端在 3000）
 */
function buildWebSocketUrl(token: string): string {
  const host = String(HOST_ADDRESS || '').trim();

  if (/^https?:\/\//i.test(host)) {
    const base = host.replace(/^http/i, 'ws');
    const url = new URL('/api/auth/messages/ws', base.endsWith('/') ? base : `${base}/`);
    url.searchParams.set('token', token);
    return url.toString();
  }

  if (!ON_SERVER && typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = new URL(`${protocol}//${window.location.host}/api/auth/messages/ws`);
    url.searchParams.set('token', token);
    return url.toString();
  }

  const fallback = (host || 'https://api-test.kurangames.com').replace(/^http/i, 'ws');
  const url = new URL('/api/auth/messages/ws', fallback.endsWith('/') ? fallback : `${fallback}/`);
  url.searchParams.set('token', token);
  return url.toString();
}

function detachSocket(socket: WebSocket | null | undefined) {
  if (!socket) return;
  socket.onopen = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
}

export function useMessageRealtime() {
  const token = useAuthStore((s) => s.user?.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshUnreadCount = useMessageStore((state) => state.refreshUnreadCount);
  const clearUnreadCount = useMessageStore((state) => state.clearUnreadCount);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldRunRef = useRef(false);
  const failCountRef = useRef(0);
  /** StrictMode / effect 重跑时作废旧连接，避免对 CONNECTING 调 close 刷控制台 */
  const generationRef = useRef(0);

  useEffect(() => {
    const active = Boolean(isAuthenticated && token);
    shouldRunRef.current = active;
    const generation = ++generationRef.current;

    const clearPingState = () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      if (pongTimerRef.current) {
        clearTimeout(pongTimerRef.current);
        pongTimerRef.current = null;
      }
    };

    const isCurrent = () =>
      shouldRunRef.current && generationRef.current === generation;

    const scheduleReconnect = () => {
      if (!isCurrent()) return;
      if (reconnectTimerRef.current) return;

      const delay = Math.min(
        RECONNECT_MAX_MS,
        RECONNECT_BASE_MS * 2 ** Math.min(failCountRef.current, 5),
      );
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    const handleRealtimePayload = (payload: RealtimeMessage) => {
      if (payload.type === 'inbox_changed') {
        void refreshUnreadCount();
        return;
      }

      if (payload.type === 'pong' && pongTimerRef.current) {
        clearTimeout(pongTimerRef.current);
        pongTimerRef.current = null;
      }
    };

    const startHeartbeat = (socket: WebSocket) => {
      clearPingState();

      pingTimerRef.current = setInterval(() => {
        if (!isCurrent() || socket.readyState !== WebSocket.OPEN) {
          return;
        }

        try {
          socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        } catch {
          try {
            socket.close();
          } catch {
            // ignore
          }
          return;
        }

        if (pongTimerRef.current) {
          clearTimeout(pongTimerRef.current);
        }

        pongTimerRef.current = setTimeout(() => {
          pongTimerRef.current = null;
          try {
            socket.close();
          } catch {
            // ignore close errors
          }
        }, PONG_TIMEOUT_MS);
      }, PING_INTERVAL_MS);
    };

    const connect = () => {
      if (!isCurrent() || !token) return;

      if (socketRef.current) {
        const state = socketRef.current.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          return;
        }
      }

      let socket: WebSocket;
      try {
        socket = new WebSocket(buildWebSocketUrl(token));
      } catch {
        failCountRef.current += 1;
        scheduleReconnect();
        return;
      }

      socketRef.current = socket;

      socket.onopen = () => {
        // 已被新一代 effect 作废：安静关掉，不触发「握手前关闭」警告路径上的重连刷屏
        if (!isCurrent()) {
          detachSocket(socket);
          try {
            socket.close();
          } catch {
            // ignore
          }
          return;
        }
        failCountRef.current = 0;
        startHeartbeat(socket);
      };

      socket.onmessage = (event) => {
        if (!isCurrent()) return;
        try {
          const payload = JSON.parse(String(event.data || '{}')) as RealtimeMessage;
          handleRealtimePayload(payload);
        } catch {
          // ignore malformed payloads
        }
      };

      socket.onerror = () => {
        // 交给 onclose 统一重连；这里不主动 close，减少 CONNECTING 阶段警告
      };

      socket.onclose = () => {
        clearPingState();
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        if (!isCurrent()) return;
        failCountRef.current += 1;
        scheduleReconnect();
      };
    };

    if (!active) {
      clearUnreadCount();
      return () => {
        // no-op for logged-out path
      };
    }

    failCountRef.current = 0;
    connect();

    return () => {
      // 作废本代连接：不在 CONNECTING 时 close（Chrome 会报 closed before established）
      shouldRunRef.current = false;
      generationRef.current += 1;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearPingState();

      const socket = socketRef.current;
      socketRef.current = null;
      if (!socket) return;

      detachSocket(socket);
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.close();
        } catch {
          // ignore
        }
      }
      // CONNECTING：丢弃引用，等其自行失败或 open 后由过期 generation 处理
    };
  }, [clearUnreadCount, isAuthenticated, refreshUnreadCount, token]);
}
