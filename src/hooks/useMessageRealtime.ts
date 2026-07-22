import { useEffect, useRef } from 'react';
import { HOST_ADDRESS, ON_SERVER } from '../config';
import { useAuthStore } from '../store/useAuthStore';
import { useMessageStore } from '../store/useMessageStore';

const RECONNECT_MS = 5000;
const PING_INTERVAL_MS = 30000;
const PONG_TIMEOUT_MS = 10000;

type RealtimeMessage = {
  type?: string;
  ts?: number;
};

function buildWebSocketUrl(token: string): string {
  // 开发环境走 Vite 同源代理，避免 5173 → 3000 跨域 WS 升级失败
  if (!ON_SERVER && typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = new URL(`${protocol}//${window.location.host}/api/auth/messages/ws`);
    url.searchParams.set('token', token);
    return url.toString();
  }

  const base = HOST_ADDRESS.replace(/^http/i, 'ws');
  const url = new URL('/api/auth/messages/ws', base);
  url.searchParams.set('token', token);
  return url.toString();
}

export function useMessageRealtime() {
  const { isAuthenticated, user } = useAuthStore();
  const refreshUnreadCount = useMessageStore((state) => state.refreshUnreadCount);
  const clearUnreadCount = useMessageStore((state) => state.clearUnreadCount);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldRunRef = useRef(false);

  useEffect(() => {
    shouldRunRef.current = isAuthenticated && Boolean(user?.token);

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

    const scheduleReconnect = () => {
      if (!shouldRunRef.current) return;
      if (reconnectTimerRef.current) return;

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, RECONNECT_MS);
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
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        try {
          socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
        } catch {
          socket.close();
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
      if (!shouldRunRef.current) return;

      const token = user?.token;
      if (!token) return;

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
        scheduleReconnect();
        return;
      }

      socketRef.current = socket;

      socket.onopen = () => {
        startHeartbeat(socket);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data || '{}')) as RealtimeMessage;
          handleRealtimePayload(payload);
        } catch {
          // ignore malformed payloads
        }
      };

      socket.onerror = () => {
        try {
          socket.close();
        } catch {
          // ignore close errors
        }
      };

      socket.onclose = () => {
        clearPingState();
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        scheduleReconnect();
      };
    };

    const cleanup = () => {
      shouldRunRef.current = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      clearPingState();

      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // ignore close errors
        }
        socketRef.current = null;
      }
    };

    if (!shouldRunRef.current) {
      clearUnreadCount();
      cleanup();
      return cleanup;
    }

    connect();

    return cleanup;
  }, [clearUnreadCount, isAuthenticated, refreshUnreadCount, user?.token]);
}
