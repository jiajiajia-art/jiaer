/**
 * 私聊 vs 主线叙事隔离闸门。
 * 私聊消息不得进入 narrative history 序列化；主线 step 不得写入私聊线程。
 */

export type PrivateChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type PrivateChatThread = {
  sessionId: string;
  npcId: string;
  messages: PrivateChatMessage[];
};

export type NarrativeHistoryLike = {
  steps?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

const PRIVATE_CHAT_CONTENT_MAX = 2000;

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

/** 功能注释：校验私聊发送内容。 */
export function validatePrivateChatMessage(content: unknown): {
  ok: boolean;
  message?: string;
  text?: string;
} {
  const text = trimStr(content);
  if (!text) return { ok: false, message: '请输入内容' };
  if (text.length > PRIVATE_CHAT_CONTENT_MAX) {
    return { ok: false, message: `消息不能超过${PRIVATE_CHAT_CONTENT_MAX}字` };
  }
  return { ok: true, text };
}

/** 功能注释：把用户消息追加到线程（不触碰主线）。 */
export function appendPrivateChatUserMessage(
  thread: PrivateChatThread,
  content: string,
  nowIso = new Date().toISOString(),
): { ok: true; thread: PrivateChatThread } | { ok: false; message: string } {
  const checked = validatePrivateChatMessage(content);
  if (!checked.ok || !checked.text) return { ok: false, message: checked.message || '无效消息' };
  return {
    ok: true,
    thread: {
      ...thread,
      messages: [
        ...(thread.messages || []),
        { role: 'user', content: checked.text, createdAt: nowIso },
      ],
    },
  };
}

/** 功能注释：按索引删除私聊气泡（前端乐观校验 / 单测）；不碰主线。 */
export function deletePrivateChatMessageAtIndex(
  thread: PrivateChatThread,
  index: number,
): { ok: true; thread: PrivateChatThread } | { ok: false; message: string } {
  const messages = [...(thread.messages || [])];
  if (!Number.isInteger(index) || index < 0 || index >= messages.length) {
    return { ok: false, message: '消息不存在' };
  }
  messages.splice(index, 1);
  return { ok: true, thread: { ...thread, messages } };
}

/**
 * 功能注释：问题8——AI 末条气泡（含自动第二句）是否可点「重新回复」。
 * 仅当 messages 末条为 assistant 时为 true。
 */
export function canRegeneratePrivateChatLastMessage(
  messages: Array<{ role?: string } | null | undefined> | null | undefined,
): boolean {
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) return false;
  return list[list.length - 1]?.role === 'assistant';
}

/** 功能注释：某下标是否为当前最后一条助手气泡（菜单「重新回复/再说一句」可用）。 */
export function isLastPrivateChatAssistantMessage(
  messages: Array<{ role?: string } | null | undefined> | null | undefined,
  index: number,
): boolean {
  const list = Array.isArray(messages) ? messages : [];
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return false;
  if (list[index]?.role !== 'assistant') return false;
  return !list.slice(index + 1).some((m) => m?.role === 'assistant');
}

/**
 * 功能注释：序列化主线 history 时剥离误混入的私聊标记字段。
 * 若 step 带 privateChat:true 则丢弃。
 */
export function sanitizeNarrativeHistoryForPersist(
  history: NarrativeHistoryLike | null | undefined,
): NarrativeHistoryLike {
  if (!history || typeof history !== 'object') return { steps: [] };
  const steps = Array.isArray(history.steps) ? history.steps : [];
  return {
    ...history,
    steps: steps.filter((step) => {
      if (!step || typeof step !== 'object') return false;
      if (step.privateChat === true || step.channel === 'private_chat') return false;
      return true;
    }),
  };
}

/** 功能注释：断言私聊线程消息未出现在主线 steps 文本序列中（测试/防御）。 */
export function assertPrivateChatIsolatedFromNarrative(
  thread: PrivateChatThread,
  history: NarrativeHistoryLike | null | undefined,
): { ok: boolean; leaked?: string[] } {
  const steps = Array.isArray(history?.steps) ? history!.steps! : [];
  const narrativeBlob = steps
    .map((s) => `${s?.content || ''}\n${s?.text || ''}\n${s?.dialogue || ''}`)
    .join('\n');
  const leaked: string[] = [];
  for (const msg of thread.messages || []) {
    const c = trimStr(msg.content);
    if (c.length >= 8 && narrativeBlob.includes(c)) {
      leaked.push(c.slice(0, 40));
    }
  }
  return leaked.length ? { ok: false, leaked } : { ok: true };
}

/** 功能注释：主线叙事「正在生成」时，私聊应等待（展示加载中），勿直接 toast 拦截。 */
export function shouldWaitPrivateChatForNarrative(narrativeBusy?: boolean): boolean {
  return Boolean(narrativeBusy);
}

/**
 * 功能注释：是否真正占用会话锁的主线生成中。
 * - streamLoading / isCompressingContext：后端会话锁，私聊须等。
 * - 不要用 isTyping（前端打字机）：文案已出、只是逐字显示，不占锁；
 *   误用会导致进私聊先空等很久，再叠一层 greet「对方正在输入」。
 * - 不要用 isWaitingForData：「等玩家点选项」时也会为 true。
 */
export function isNarrativeGenerationBusy(flags: {
  streamLoading?: boolean;
  isCompressingContext?: boolean;
}): boolean {
  return Boolean(flags.streamLoading || flags.isCompressingContext);
}

/** 功能注释：识别后端/SSE 返回的主线锁冲突。 */
export function isPrivateChatNarrativeBusyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code || '').trim();
  if (code === 'narrative_busy') return true;
  const message = String((err as { message?: unknown }).message || '');
  return message.includes('主线正在生成');
}

/**
 * 功能注释：私聊操作瞬时冲突提示。
 * 主线忙碌改为「加载中等待」，不走本函数 toast。
 */
export function resolvePrivateChatBusyMessage(opts: {
  narrativeBusy?: boolean;
  privateChatBusy?: boolean;
}): string | null {
  if (opts.privateChatBusy) return '私聊回复生成中，请稍候';
  return null;
}
