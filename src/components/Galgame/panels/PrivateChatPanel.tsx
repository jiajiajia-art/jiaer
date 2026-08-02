import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  privateChatApi,
  type PrivateChatMessageDto,
  type PrivateChatNpcDto,
} from '../../../api/galgame/privateChat';
import { resolvePrivateChatBusyMessage, validatePrivateChatMessage } from '../../../lib/galgame/privateChatGate';
import { stripPrivateChatFavorMarkers } from '../../../lib/galgame/privateChatFavor';
import type { PlayerEditableNpc } from '../../../lib/galgame/characterProfile';
import { getImageUrl } from '../../../utils/constants';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import GameConfirmModal from '../GameConfirmModal';
import styles from './PrivateChatPanel.module.css';

interface PrivateChatPanelProps {
  npcId: string;
  npcName: string;
  npcAvatarUrl?: string;
  narrativeBusy?: boolean;
  onBack: () => void;
  onProfilesChange?: (profiles: PlayerEditableNpc[]) => void;
}

/** 功能注释：局内 NPC 私聊气泡面板（不推进主线）。 */
const PrivateChatPanel: React.FC<PrivateChatPanelProps> = ({
  npcId,
  npcName,
  npcAvatarUrl,
  narrativeBusy = false,
  onBack,
  onProfilesChange,
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  /** 空线程即将自动打招呼：挡住空态文案，避免闪一下「说点什么吧」 */
  const [awaitingGreet, setAwaitingGreet] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const runStream = async (kind: 'send' | 'regen' | 'greet', content?: string) => {
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
    setAwaitingGreet(false);
    setStreaming('');
    setMenuIndex(null);
    try {
      const onEvent = (ev: Parameters<typeof privateChatApi.sendMessage>[4] extends (e: infer E) => void ? E : never) => {
        if (ev.type === 'thread') {
          setMessages(ev.thread.messages || []);
          if (ev.npc) setNpc(ev.npc);
        } else if (ev.type === 'delta') {
          const raw = ev.text || '';
          // replace=true：后端下发清洗后全文快照；否则兼容旧增量
          if (ev.replace) {
            setStreaming(stripPrivateChatFavorMarkers(raw));
          } else {
            setStreaming((prev) => stripPrivateChatFavorMarkers(prev + raw));
          }
        } else if (ev.type === 'done') {
          // 同一批更新：先落消息并结束 busy，避免气泡下方再闪「正在输入」
          setMessages(ev.thread.messages || []);
          setStreaming('');
          setBusy(false);
          setAwaitingGreet(false);
          if (Array.isArray(ev.playerEditableNpcs)) {
            onProfilesChange?.(ev.playerEditableNpcs as PlayerEditableNpc[]);
          }
        } else if (ev.type === 'error') {
          toast.error(ev.message || '私聊失败');
          setStreaming('');
          setBusy(false);
          setAwaitingGreet(false);
        }
      };
      if (kind === 'send') {
        await privateChatApi.sendMessage(token, sessionId, npcId, content || '', onEvent);
      } else if (kind === 'greet') {
        await privateChatApi.greet(token, sessionId, npcId, onEvent);
      } else {
        await privateChatApi.regenerate(token, sessionId, npcId, onEvent);
      }
    } catch (e) {
      toast.error((e as Error)?.message || '私聊失败');
      setStreaming('');
      setAwaitingGreet(false);
    } finally {
      setBusy(false);
    }
  };

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
      const loadedMessages = res.data.thread.messages || [];
      setMessages(loadedMessages);
      // 空线程：先进入 awaitingGreet，再关 loading，避免空态文案闪现
      if (loadedMessages.length === 0) {
        setAwaitingGreet(true);
        setLoading(false);
        scrollToBottom();
        await runStream('greet');
      } else {
        setLoading(false);
        scrollToBottom();
      }
      return;
    } catch (e) {
      toast.error((e as Error)?.message || '加载私聊失败');
      setAwaitingGreet(false);
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
  const introSummary = String(npc?.summary || '').trim();
  const introAttitude = String(npc?.attitude || '').trim();
  const introRelation = String(npc?.relationship || '').trim();
  const introBio = String(npc?.detailedBio || '').trim();
  const hasIntro = Boolean(introSummary || introAttitude || introRelation || introBio);

  const openPreview = () => setPreviewOpen(true);
  const closePreview = () => setPreviewOpen(false);

  const handleClearHistory = async () => {
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
    setClearConfirmOpen(false);
    setBusy(true);
    setStreaming('');
    setMenuIndex(null);
    try {
      const res = await privateChatApi.clearThread(token, sessionId, npcId);
      if (!res?.success || !res.data) {
        toast.error(res?.message || '清空失败');
        return;
      }
      setMessages([]);
      if (res.data.npc) setNpc(res.data.npc);
      toast.success('已清空私聊记录');
      setAwaitingGreet(true);

      const onEvent = (ev: Parameters<typeof privateChatApi.greet>[3] extends (e: infer E) => void ? E : never) => {
        if (ev.type === 'thread') {
          setMessages(ev.thread.messages || []);
          if (ev.npc) setNpc(ev.npc);
        } else if (ev.type === 'delta') {
          const raw = ev.text || '';
          if (ev.replace) {
            setStreaming(stripPrivateChatFavorMarkers(raw));
          } else {
            setStreaming((prev) => stripPrivateChatFavorMarkers(prev + raw));
          }
        } else if (ev.type === 'done') {
          setMessages(ev.thread.messages || []);
          setStreaming('');
          setBusy(false);
          setAwaitingGreet(false);
          if (Array.isArray(ev.playerEditableNpcs)) {
            onProfilesChange?.(ev.playerEditableNpcs as PlayerEditableNpc[]);
          }
        } else if (ev.type === 'error') {
          toast.error(ev.message || '打招呼失败');
          setStreaming('');
          setBusy(false);
          setAwaitingGreet(false);
        }
      };
      await privateChatApi.greet(token, sessionId, npcId, onEvent);
    } catch (e) {
      toast.error((e as Error)?.message || '清空失败');
      setStreaming('');
      setAwaitingGreet(false);
    } finally {
      setBusy(false);
      setAwaitingGreet(false);
    }
  };

  const renderAvatarButton = (className: string, emptyClassName: string) => (
    <button
      type="button"
      className={styles.avatarHit}
      onClick={openPreview}
      aria-label={`查看 ${title} 头像与介绍`}
    >
      {avatarSrc ? (
        <img className={className} src={avatarSrc} alt={title} />
      ) : (
        <div className={emptyClassName} aria-hidden />
      )}
    </button>
  );

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} disabled={busy} aria-label="返回">
          ‹
        </button>
        {renderAvatarButton(styles.headAvatar, styles.headAvatarEmpty)}
        <div className={styles.headText}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.sub}>
            <span className={styles.onlineDot} aria-hidden />
            在线
          </p>
        </div>
        <button
          type="button"
          className={styles.clearBtn}
          disabled={busy || loading || messages.length === 0}
          onClick={() => setClearConfirmOpen(true)}
          aria-label="清空私聊记录"
          title="清空私聊记录"
        >
          <svg className={styles.clearIcon} viewBox="0 0 16 16" width="1em" height="1em" fill="none" aria-hidden>
            <path
              d="M3.2 4.2h9.6M6.2 4.2V3.1c0-.4.3-.7.7-.7h2.2c.4 0 .7.3.7.7v1.1M5.1 4.2l.5 8.1c0 .5.4.9.9.9h3c.5 0 .9-.4.9-.9l.5-8.1"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.clearLabel}>清空</span>
        </button>
      </header>

      <div className={styles.list} ref={listRef}>
        {loading ? (
          <p className={styles.empty}>加载中…</p>
        ) : messages.length === 0 && !streaming && !busy && !awaitingGreet ? (
          <p className={styles.empty}>和 {title} 说点什么吧</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.createdAt}-${i}`}
              className={`${styles.row} ${m.role === 'user' ? styles.rowUser : styles.rowAssistant}`}
            >
              {m.role === 'assistant'
                ? renderAvatarButton(styles.bubbleAvatar, styles.bubbleAvatarEmpty)
                : null}
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
        {streaming.trim() ? (
          <div className={`${styles.row} ${styles.rowAssistant}`}>
            {renderAvatarButton(styles.bubbleAvatar, styles.bubbleAvatarEmpty)}
            <div className={`${styles.bubble} ${styles.assistant} ${styles.streaming}`}>
              <div className={styles.bubbleText}>{streaming}</div>
            </div>
          </div>
        ) : null}
        {(busy || awaitingGreet) && !streaming.trim() ? (
          <p className={styles.typing}>对方正在输入…</p>
        ) : null}
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

      {previewOpen ? (
        <div
          className={styles.previewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} 人物介绍`}
          onClick={closePreview}
        >
          <div className={styles.previewCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewChrome}>
              <span className={styles.previewChromeLabel}>人物笺</span>
              <button type="button" className={styles.previewClose} onClick={closePreview} aria-label="关闭">
                ×
              </button>
            </div>
            <div className={styles.previewBody}>
              <div className={styles.previewPortraitWrap}>
                {avatarSrc ? (
                  <img className={styles.previewPortrait} src={avatarSrc} alt={title} />
                ) : (
                  <div className={styles.previewPortraitEmpty} aria-hidden />
                )}
              </div>
              <h3 className={styles.previewName}>{title}</h3>
              {introRelation ? (
                <p className={styles.previewMeta}>关系：{introRelation}</p>
              ) : null}
              <div className={styles.previewIntro}>
                <h4 className={styles.previewIntroTitle}>人物介绍</h4>
                {hasIntro ? (
                  <>
                    {introSummary ? <p className={styles.previewIntroBody}>{introSummary}</p> : null}
                    {introAttitude ? (
                      <p className={styles.previewIntroBody}>对你的态度：{introAttitude}</p>
                    ) : null}
                    {introBio ? <p className={styles.previewIntroBody}>{introBio}</p> : null}
                  </>
                ) : (
                  <p className={styles.previewIntroMuted}>暂无人物介绍</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <GameConfirmModal
        isOpen={clearConfirmOpen}
        title="清空私聊记录"
        message={`将清空与「${title}」的全部私聊气泡（不影响主线）。清空后角色会重新打招呼。是否继续？`}
        confirmText="确认清空"
        cancelText="取消"
        overlayZIndex={3800}
        onConfirm={() => { void handleClearHistory(); }}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </div>
  );
};

export default PrivateChatPanel;
