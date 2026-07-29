import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  privateChatApi,
  type PrivateChatMessageDto,
  type PrivateChatNpcDto,
} from '../../../api/galgame/privateChat';
import { resolvePrivateChatBusyMessage, validatePrivateChatMessage } from '../../../lib/galgame/privateChatGate';
import { getImageUrl } from '../../../utils/constants';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import styles from './PrivateChatPanel.module.css';

interface PrivateChatPanelProps {
  npcId: string;
  npcName: string;
  npcAvatarUrl?: string;
  narrativeBusy?: boolean;
  onBack: () => void;
}

/** 功能注释：局内 NPC 私聊气泡面板（不推进主线）。 */
const PrivateChatPanel: React.FC<PrivateChatPanelProps> = ({
  npcId,
  npcName,
  npcAvatarUrl,
  narrativeBusy = false,
  onBack,
}) => {
  const token = useAuthStore((s) => s.user?.token);
  const { sessionId } = useGameStore();
  const [npc, setNpc] = useState<PrivateChatNpcDto | null>(null);
  const [messages, setMessages] = useState<PrivateChatMessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const loadThread = useCallback(async () => {
    if (!token || !sessionId) return;
    setLoading(true);
    try {
      const res = await privateChatApi.getThread(token, sessionId, npcId);
      if (!res?.success || !res.data) {
        toast.error(res?.message || '加载私聊失败');
        return;
      }
      setNpc(res.data.npc);
      setMessages(res.data.thread.messages || []);
    } catch (e) {
      toast.error((e as Error)?.message || '加载私聊失败');
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [token, sessionId, npcId, scrollToBottom]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  const runStream = async (kind: 'send' | 'regen', content?: string) => {
    if (!token || !sessionId) {
      toast.error('请先登录');
      return;
    }
    const busyTip = resolvePrivateChatBusyMessage({
      narrativeBusy,
      privateChatBusy: busy,
    });
    if (busyTip) {
      toast.error(busyTip);
      return;
    }
    setBusy(true);
    setStreaming('');
    setMenuIndex(null);
    try {
      const onEvent = (ev: Parameters<typeof privateChatApi.sendMessage>[4] extends (e: infer E) => void ? E : never) => {
        if (ev.type === 'thread') {
          setMessages(ev.thread.messages || []);
          if (ev.npc) setNpc(ev.npc);
        } else if (ev.type === 'delta') {
          setStreaming((prev) => prev + (ev.text || ''));
        } else if (ev.type === 'done') {
          setMessages(ev.thread.messages || []);
          setStreaming('');
        } else if (ev.type === 'error') {
          toast.error(ev.message || '私聊失败');
          setStreaming('');
        }
      };
      if (kind === 'send') {
        await privateChatApi.sendMessage(token, sessionId, npcId, content || '', onEvent);
      } else {
        await privateChatApi.regenerate(token, sessionId, npcId, onEvent);
      }
    } catch (e) {
      toast.error((e as Error)?.message || '私聊失败');
      setStreaming('');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    const checked = validatePrivateChatMessage(draft);
    if (!checked.ok || !checked.text) {
      toast.error(checked.message || '请输入内容');
      return;
    }
    setDraft('');
    await runStream('send', checked.text);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (index: number, role: string) => {
    if (role !== 'assistant' || busy) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      setMenuIndex(index);
    }, 480);
  };

  const title = npc?.name || npcName || '私聊';
  const avatarSrc = getImageUrl(npcAvatarUrl || '');

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} disabled={busy} aria-label="返回">
          ‹
        </button>
        {avatarSrc ? (
          <img className={styles.headAvatar} src={avatarSrc} alt="" />
        ) : (
          <div className={styles.headAvatarEmpty} aria-hidden />
        )}
        <div className={styles.headText}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.sub}>
            <span className={styles.onlineDot} aria-hidden />
            在线
          </p>
        </div>
      </header>

      <div className={styles.list} ref={listRef}>
        {loading ? (
          <p className={styles.empty}>加载中…</p>
        ) : messages.length === 0 && !streaming ? (
          <p className={styles.empty}>和 {title} 说点什么吧</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.createdAt}-${i}`}
              className={`${styles.row} ${m.role === 'user' ? styles.rowUser : styles.rowAssistant}`}
            >
              {m.role === 'assistant' ? (
                avatarSrc ? (
                  <img className={styles.bubbleAvatar} src={avatarSrc} alt="" />
                ) : (
                  <div className={styles.bubbleAvatarEmpty} aria-hidden />
                )
              ) : null}
              <div
                className={`${styles.bubble} ${m.role === 'user' ? styles.user : styles.assistant}`}
                onPointerDown={() => startLongPress(i, m.role)}
                onPointerUp={clearLongPress}
                onPointerLeave={clearLongPress}
                onPointerCancel={clearLongPress}
                onContextMenu={(e) => {
                  if (m.role !== 'assistant') return;
                  e.preventDefault();
                  setMenuIndex(i);
                }}
              >
                <div className={styles.bubbleText}>{m.content}</div>
                {menuIndex === i ? (
                  <div className={styles.menu}>
                    <button
                      type="button"
                      className={styles.menuBtn}
                      disabled={busy}
                      onClick={() => void runStream('regen')}
                    >
                      重新生成
                    </button>
                    <button
                      type="button"
                      className={styles.menuBtn}
                      disabled={busy}
                      onClick={() => void runStream('regen')}
                    >
                      再说一遍
                    </button>
                    <button type="button" className={styles.menuBtn} onClick={() => setMenuIndex(null)}>
                      取消
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        {streaming ? (
          <div className={`${styles.row} ${styles.rowAssistant}`}>
            {avatarSrc ? (
              <img className={styles.bubbleAvatar} src={avatarSrc} alt="" />
            ) : (
              <div className={styles.bubbleAvatarEmpty} aria-hidden />
            )}
            <div className={`${styles.bubble} ${styles.assistant} ${styles.streaming}`}>
              <div className={styles.bubbleText}>{streaming}</div>
            </div>
          </div>
        ) : null}
        {busy && !streaming ? <p className={styles.typing}>对方正在输入…</p> : null}
      </div>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <textarea
          className={styles.input}
          rows={2}
          value={draft}
          disabled={busy || !token}
          placeholder={token ? '请输入内容…' : '请先登录'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <button type="submit" className={styles.send} disabled={busy || !draft.trim() || !token}>
          发送
        </button>
      </form>
    </div>
  );
};

export default PrivateChatPanel;
