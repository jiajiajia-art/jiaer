import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  privateChatApi,
  type PrivateChatAbDto,
  type PrivateChatMessageDto,
  type PrivateChatNpcDto,
  type PrivateChatSseEvent,
} from '../../../api/galgame/privateChat';
import {
  isPrivateChatNarrativeBusyError,
  resolvePrivateChatBusyMessage,
  shouldWaitPrivateChatForNarrative,
  validatePrivateChatMessage,
} from '../../../lib/galgame/privateChatGate';
import { stripPrivateChatFavorMarkers } from '../../../lib/galgame/privateChatFavor';
import {
  resolvePrivateChatIdleMs,
  shouldArmPrivateChatIdleNudge,
} from '../../../lib/galgame/privateChatIdleNudge';
import type { PlayerEditableNpc } from '../../../lib/galgame/characterProfile';
import {
  pickAvatarDisplayUrl,
  pickDisplayAvatarFullUrl,
} from '../../../lib/galgame/avatarThumbUrl';
import { getImageUrl } from '../../../utils/constants';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import GameConfirmModal from '../GameConfirmModal';
import styles from './PrivateChatPanel.module.css';

interface PrivateChatPanelProps {
  npcId: string;
  npcName: string;
  npcAvatarUrl?: string;
  npcAvatarThumbUrl?: string;
  /** 当前「我的档案」主角头像（档案变更后立刻刷新） */
  playerAvatarUrl?: string;
  playerAvatarThumbUrl?: string;
  playerName?: string;
  narrativeBusy?: boolean;
  onBack: () => void;
  onProfilesChange?: (profiles: PlayerEditableNpc[]) => void;
}

type DeferredOp =
  | { kind: 'boot' }
  | { kind: 'send'; content: string }
  | { kind: 'regen' }
  | { kind: 'continue' }
  | { kind: 'greet' }
  | { kind: 'nudge' };

/** 功能注释：局内 NPC 私聊气泡面板（不推进主线）。主线生成中进入时展示加载并等待。 */
const PrivateChatPanel: React.FC<PrivateChatPanelProps> = ({
  npcId,
  npcName,
  npcAvatarUrl,
  npcAvatarThumbUrl,
  playerAvatarUrl,
  playerAvatarThumbUrl,
  playerName,
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
  const [previewTarget, setPreviewTarget] = useState<'npc' | 'player' | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  /** 空线程即将自动打招呼：挡住空态文案，避免闪一下「说点什么吧」 */
  const [awaitingGreet, setAwaitingGreet] = useState(false);
  /** 主线未完成：进入私聊后展示加载中，待主线结束后再 boot / 重试 */
  const [waitingNarrative, setWaitingNarrative] = useState(() => shouldWaitPrivateChatForNarrative(narrativeBusy));
  const [chatAb, setChatAb] = useState<PrivateChatAbDto | null>(null);
  /** 服务端 ensure 后的主角小图（props 优先保证档案切换立刻变） */
  const [serverPlayerAvatar, setServerPlayerAvatar] = useState<{
    avatarUrl?: string;
    avatarThumbUrl?: string;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredOpRef = useRef<DeferredOp | null>({ kind: 'boot' });
  const bootKeyRef = useRef('');
  const narrativeBusyRef = useRef(narrativeBusy);
  narrativeBusyRef.current = narrativeBusy;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  /** 进入私聊 / 输入框可用时默认聚焦，方便直接打字 */
  useEffect(() => {
    if (!token || busy || waitingNarrative || loading || clearConfirmOpen || previewTarget) return;
    const el = inputRef.current;
    if (!el || el.disabled) return;
    const timer = window.setTimeout(() => {
      if (el.disabled) return;
      el.focus({ preventScroll: true });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [token, busy, waitingNarrative, loading, clearConfirmOpen, previewTarget, npcId]);

  const enterNarrativeWait = useCallback((op: DeferredOp) => {
    deferredOpRef.current = op;
    setWaitingNarrative(true);
    // 已有会话内容时不要整页「加载中」挡住消息；仅 boot 拉线程前才全屏等待
    if (op.kind === 'boot') {
      setLoading(true);
    }
    setAwaitingGreet(op.kind === 'greet');
    setBusy(false);
    setStreaming('');
  }, []);

  const handleStreamEvent = useCallback((ev: PrivateChatSseEvent, onNarrativeBusy: () => void) => {
    if (ev.type === 'thread') {
      setMessages(ev.thread.messages || []);
      if (ev.npc) setNpc(ev.npc);
      if (ev.ab) setChatAb(ev.ab);
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
      if (isPrivateChatNarrativeBusyError(ev)) {
        onNarrativeBusy();
        return;
      }
      toast.error(ev.message || '私聊失败');
      setStreaming('');
      setBusy(false);
      setAwaitingGreet(false);
    }
  }, [onProfilesChange]);

  const runStream = useCallback(async (kind: 'send' | 'regen' | 'continue' | 'greet' | 'nudge', content?: string) => {
    if (!token || !sessionId) {
      toast.error('请先登录');
      return;
    }
    const selfBusyTip = resolvePrivateChatBusyMessage({ privateChatBusy: busy });
    if (selfBusyTip) {
      toast.error(selfBusyTip);
      return;
    }
    if (shouldWaitPrivateChatForNarrative(narrativeBusyRef.current)) {
      enterNarrativeWait(
        kind === 'send'
          ? { kind: 'send', content: content || '' }
          : { kind },
      );
      return;
    }

    setBusy(true);
    setWaitingNarrative(false);
    // greet 保持 awaitingGreet，空线程只显示「对方正在打招呼」，避免再叠一层「对方正在输入」
    setAwaitingGreet(kind === 'greet');
    setStreaming('');
    setMenuIndex(null);
    const deferOp: DeferredOp = kind === 'send'
      ? { kind: 'send', content: content || '' }
      : { kind };

    try {
      const onEvent = (ev: PrivateChatSseEvent) => {
        handleStreamEvent(ev, () => enterNarrativeWait(deferOp));
      };
      if (kind === 'send') {
        await privateChatApi.sendMessage(token, sessionId, npcId, content || '', onEvent);
      } else if (kind === 'greet') {
        await privateChatApi.greet(token, sessionId, npcId, onEvent);
      } else if (kind === 'nudge') {
        await privateChatApi.nudge(token, sessionId, npcId, onEvent);
      } else if (kind === 'continue') {
        await privateChatApi.continueMessage(token, sessionId, npcId, onEvent);
      } else {
        await privateChatApi.regenerate(token, sessionId, npcId, onEvent);
      }
    } catch (e) {
      if (isPrivateChatNarrativeBusyError(e)) {
        enterNarrativeWait(deferOp);
        return;
      }
      // 静默主动开口失败不弹红错（实验组/竞态常见），避免打扰
      if (kind !== 'nudge') {
        toast.error((e as Error)?.message || '私聊失败');
      }
      setStreaming('');
      setAwaitingGreet(false);
    } finally {
      setBusy(false);
    }
  }, [token, sessionId, npcId, busy, enterNarrativeWait, handleStreamEvent]);

  const loadThread = useCallback(async () => {
    if (!token || !sessionId) return;

    // 读历史不依赖主线是否生成中；仅空线程打招呼 / 发消息才需要等锁
    setWaitingNarrative(false);
    setLoading(true);
    try {
      const res = await privateChatApi.getThread(token, sessionId, npcId);
      if (!res?.success || !res.data) {
        toast.error(res?.message || '加载私聊失败');
        return;
      }
      setNpc(res.data.npc);
      if (res.data.ab) setChatAb(res.data.ab);
      if (res.data.player) {
        setServerPlayerAvatar({
          avatarUrl: res.data.player.avatarUrl,
          avatarThumbUrl: res.data.player.avatarThumbUrl,
        });
      }
      const loadedMessages = res.data.thread.messages || [];
      setMessages(loadedMessages);
      // 先结束「加载中」，再打招呼，避免空线程 greet 7s 一直挡整页
      setLoading(false);
      if (deferredOpRef.current?.kind === 'boot') {
        deferredOpRef.current = null;
      }
      scrollToBottom();
      if (loadedMessages.length === 0) {
        setAwaitingGreet(true);
        if (shouldWaitPrivateChatForNarrative(narrativeBusyRef.current)) {
          enterNarrativeWait({ kind: 'greet' });
          return;
        }
        await runStream('greet');
      }
    } catch (e) {
      if (isPrivateChatNarrativeBusyError(e)) {
        enterNarrativeWait({ kind: 'boot' });
        return;
      }
      toast.error((e as Error)?.message || '加载私聊失败');
      setAwaitingGreet(false);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [token, sessionId, npcId, scrollToBottom, runStream, enterNarrativeWait]);

  const resumeDeferredOp = useCallback(async (op: DeferredOp) => {
    if (op.kind === 'boot') {
      await loadThread();
      return;
    }
    if (op.kind === 'send') {
      await runStream('send', op.content);
      return;
    }
    await runStream(op.kind);
  }, [loadThread, runStream]);

  // 进入私聊：始终先拉线程；主线真正生成中时仅推迟 greet/send/regen
  useEffect(() => {
    if (!token || !sessionId) return;
    const bootKey = `${sessionId}:${npcId}`;

    if (bootKeyRef.current !== bootKey) {
      bootKeyRef.current = bootKey;
      deferredOpRef.current = { kind: 'boot' };
      setChatAb(null);
      void loadThread();
      return;
    }

    if (shouldWaitPrivateChatForNarrative(narrativeBusy)) {
      return;
    }

    setWaitingNarrative(false);
    const pending = deferredOpRef.current;
    if (!pending || pending.kind === 'boot') {
      deferredOpRef.current = null;
      return;
    }
    deferredOpRef.current = null;
    void resumeDeferredOp(pending);
  }, [token, sessionId, npcId, narrativeBusy, loadThread, resumeDeferredOp]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  // A/B：实验组在对方已回复且用户未输入时，idleMs（默认 30s）后角色主动再开口
  useEffect(() => {
    if (
      !shouldArmPrivateChatIdleNudge({
        ab: chatAb,
        busy,
        waitingNarrative,
        loading,
        draft,
        messages,
      })
    ) {
      return undefined;
    }
    const ms = resolvePrivateChatIdleMs(chatAb);
    const timer = window.setTimeout(() => {
      void runStream('nudge');
    }, ms);
    return () => window.clearTimeout(timer);
  }, [chatAb, busy, waitingNarrative, loading, draft, messages, runStream]);

  useEffect(() => {
    if (menuIndex == null) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const menuEl = document.querySelector(`.${styles.menu}`);
      if (menuEl && menuEl.contains(target)) return;
      setMenuIndex(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuIndex]);

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
    if (role !== 'assistant' || busy || waitingNarrative) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      setMenuIndex(index);
    }, 480);
  };

  // 功能注释：父组件传入的局内改名优先；勿在加载中回落到文档原名
  const title = String(npcName || '').trim() || npc?.name || '私聊';
  // 功能注释：气泡优先确认 150；无 150 时用原图（私聊不跑批量 ensure，不能一直空白）
  // 有 thumb 后不再从大图切小图的路径：父组件应先带 thumb；若稍后才到 thumb 仍可能换一次——父侧尽量预取
  const npcAvatarSrcPath = pickAvatarDisplayUrl([
    npc?.avatarThumbUrl,
    npcAvatarThumbUrl,
    npc?.avatarUrl,
    npcAvatarUrl,
  ]);
  const avatarSrc = npcAvatarSrcPath ? getImageUrl(npcAvatarSrcPath) : '';
  const playerAvatarSrcPath = pickAvatarDisplayUrl([
    playerAvatarThumbUrl,
    serverPlayerAvatar?.avatarThumbUrl,
    playerAvatarUrl,
    serverPlayerAvatar?.avatarUrl,
  ]);
  const playerAvatarSrc = playerAvatarSrcPath ? getImageUrl(playerAvatarSrcPath) : '';
  const npcPreviewFullPath = pickDisplayAvatarFullUrl([
    npc?.avatarUrl,
    npcAvatarUrl,
    npc?.avatarThumbUrl,
    npcAvatarThumbUrl,
  ]);
  const playerPreviewFullPath = pickDisplayAvatarFullUrl([
    playerAvatarUrl,
    serverPlayerAvatar?.avatarUrl,
    playerAvatarThumbUrl,
    serverPlayerAvatar?.avatarThumbUrl,
  ]);
  const playerLabel = String(playerName || npc?.playerName || '我').trim() || '我';
  const introSummary = String(npc?.summary || '').trim();
  const introAttitude = String(npc?.attitude || '').trim();
  const introRelation = String(npc?.relationship || '').trim();
  const introBio = String(npc?.detailedBio || '').trim();
  const hasIntro = Boolean(introSummary || introAttitude || introRelation || introBio);
  /** 仅拉线程时整页「加载中」；等主线 / 打招呼用文案区分，避免连续两段空白加载 */
  const threadBooting = loading;
  const emptyGreeting =
    !threadBooting && messages.length === 0 && !streaming.trim() && (awaitingGreet || busy);
  const showTypingHint =
    !threadBooting && messages.length > 0 && (busy || awaitingGreet) && !streaming.trim();

  const npcPreviewSrc = npcPreviewFullPath ? getImageUrl(npcPreviewFullPath) : avatarSrc;
  const playerPreviewSrc = playerPreviewFullPath
    ? getImageUrl(playerPreviewFullPath)
    : playerAvatarSrc;
  const openNpcPreview = () => setPreviewTarget('npc');
  const openPlayerPreview = () => {
    if (!playerPreviewSrc) return;
    setPreviewTarget('player');
  };
  const closePreview = () => setPreviewTarget(null);

  const renderPlayerAvatar = () => (
    <button
      type="button"
      className={styles.avatarHit}
      onClick={openPlayerPreview}
      disabled={!playerPreviewSrc}
      aria-label={playerPreviewSrc ? `查看 ${playerLabel} 头像` : `${playerLabel} 暂无头像`}
    >
      {playerAvatarSrc ? (
        <img className={styles.bubbleAvatar} src={playerAvatarSrc} alt={playerLabel} />
      ) : (
        <div className={styles.bubbleAvatarEmpty} aria-hidden />
      )}
    </button>
  );

  const handleClearHistory = async () => {
    if (!token || !sessionId) {
      toast.error('请先登录');
      return;
    }
    const selfBusyTip = resolvePrivateChatBusyMessage({ privateChatBusy: busy });
    if (selfBusyTip) {
      toast.error(selfBusyTip);
      return;
    }
    if (shouldWaitPrivateChatForNarrative(narrativeBusyRef.current)) {
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

      const onEvent = (ev: PrivateChatSseEvent) => {
        handleStreamEvent(ev, () => enterNarrativeWait({ kind: 'greet' }));
      };
      await privateChatApi.greet(token, sessionId, npcId, onEvent);
    } catch (e) {
      if (isPrivateChatNarrativeBusyError(e)) {
        enterNarrativeWait({ kind: 'greet' });
        return;
      }
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
      onClick={openNpcPreview}
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
            {waitingNarrative ? '等待主线…' : '在线'}
          </p>
        </div>
        <button
          type="button"
          className={styles.clearBtn}
          disabled={busy || waitingNarrative || loading || messages.length === 0}
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
        {threadBooting ? (
          <p className={styles.empty} role="status" aria-live="polite">加载中…</p>
        ) : emptyGreeting ? (
          <p className={styles.empty} role="status" aria-live="polite">
            {waitingNarrative ? '主线生成结束后将自动打招呼…' : '对方正在打招呼…'}
          </p>
        ) : messages.length === 0 && !streaming && !busy && !awaitingGreet ? (
          <p className={styles.empty}>和 {title} 说点什么吧</p>
        ) : (
          messages.map((m, i) => {
            const isLastAssistant =
              m.role === 'assistant'
              && !messages.slice(i + 1).some((x) => x.role === 'assistant');
            return (
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
                  <div
                    className={styles.menu}
                    role="menu"
                    aria-label="消息操作"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuBtn}
                      disabled={busy || waitingNarrative || !isLastAssistant}
                      onClick={() => void runStream('continue')}
                    >
                      再说一句
                    </button>
                    <span className={styles.menuDivider} aria-hidden />
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuBtn}
                      disabled={busy || waitingNarrative || !isLastAssistant}
                      onClick={() => void runStream('regen')}
                    >
                      重新回复
                    </button>
                    <span className={styles.menuDivider} aria-hidden />
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.menuBtn} ${styles.menuBtnMuted}`}
                      onClick={() => setMenuIndex(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : null}
              </div>
              {m.role === 'user' ? renderPlayerAvatar() : null}
            </div>
            );
          })
        )}
        {!threadBooting && streaming.trim() ? (
          <div className={`${styles.row} ${styles.rowAssistant}`}>
            {renderAvatarButton(styles.bubbleAvatar, styles.bubbleAvatarEmpty)}
            <div className={`${styles.bubble} ${styles.assistant} ${styles.streaming}`}>
              <div className={styles.bubbleText}>{streaming}</div>
            </div>
          </div>
        ) : null}
        {showTypingHint ? (
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
          ref={inputRef}
          className={styles.input}
          rows={2}
          value={draft}
          disabled={busy || waitingNarrative || loading || !token}
          placeholder={
            !token
              ? '请先登录'
              : waitingNarrative
                ? '主线生成完成后可私聊…'
                : '请输入内容…'
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          type="submit"
          className={styles.send}
          disabled={busy || waitingNarrative || loading || !draft.trim() || !token}
        >
          发送
        </button>
      </form>

      {previewTarget === 'npc' ? (
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
                {npcPreviewSrc ? (
                  <img className={styles.previewPortrait} src={npcPreviewSrc} alt={title} />
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

      {previewTarget === 'player' && playerPreviewSrc ? (
        <div
          className={styles.previewOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${playerLabel} 头像`}
          onClick={closePreview}
        >
          <div className={styles.previewCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewChrome}>
              <span className={styles.previewChromeLabel}>我的档案</span>
              <button type="button" className={styles.previewClose} onClick={closePreview} aria-label="关闭">
                ×
              </button>
            </div>
            <div className={styles.previewBody}>
              <div className={styles.previewPortraitWrap}>
                <img className={styles.previewPortrait} src={playerPreviewSrc} alt={playerLabel} />
              </div>
              <h3 className={styles.previewName}>{playerLabel}</h3>
              <p className={styles.previewMeta}>当前主角</p>
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
