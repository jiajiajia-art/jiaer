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

/** 功能注释：私聊锁与叙事锁冲突时的前端提示码。 */
export function resolvePrivateChatBusyMessage(opts: {
  narrativeBusy?: boolean;
  privateChatBusy?: boolean;
}): string | null {
  if (opts.narrativeBusy) return '主线正在生成，请稍后再私聊';
  if (opts.privateChatBusy) return '私聊回复生成中，请稍候';
  return null;
}
