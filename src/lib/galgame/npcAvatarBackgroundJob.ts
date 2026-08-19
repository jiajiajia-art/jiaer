/**
 * 局内 NPC 角色头像 AI 生成：组件外后台任务，离开编辑页也不中断。
 * 服务端会写回 session 的 playerEditableNpcs；完成后由 Galgame 订阅合并本地角色列表。
 */

import { sessionPlayerProfileApi } from '../../api/galgame/playerCharacterCards';

export type NpcAvatarGenPayload = {
  npcId: string;
  name: string;
  gender: string;
  relationship?: string;
  summary?: string;
  attitudeToPlayer?: string;
  detailedBio?: string;
  /** 用户补充外貌备注，拼到动态段之后 */
  promptSupplement?: string;
  /** 画风 A–D，默认 A */
  avatarStyle?: string;
};

export type NpcAvatarGenResult = {
  npcId: string;
  avatarUrl: string;
  avatarThumbUrl?: string;
  pointsDeducted?: number;
  remainingPoints?: number;
};

/**
 * 功能注释：前端硬超时。后端单次生图 55s，再加重试/抠图/压图；
 * 无客户端超时则 Network 挂死时按钮会永久「后台生成中…」。
 */
export const NPC_AVATAR_GEN_CLIENT_TIMEOUT_MS = 120_000;
/** 用户点取消时的中止原因；busy 清掉且不写回头像 */
export const NPC_AVATAR_GEN_CANCELLED_MESSAGE = '已取消头像生成';

type JobRecord = {
  sessionId: string;
  npcId: string;
  promise: Promise<NpcAvatarGenResult>;
  abort: AbortController;
  listeners: Set<(busy: boolean) => void>;
};

const jobsBySessionNpc = new Map<string, JobRecord>();
const pendingListenersBySessionNpc = new Map<string, Set<(busy: boolean) => void>>();
type CompleteListener = (sessionId: string, result: NpcAvatarGenResult) => void;
const completeListeners = new Set<CompleteListener>();

function jobKey(sessionId: string, npcId: string) {
  return `${sessionId}|${npcId}`;
}

function notify(listeners: Set<(busy: boolean) => void>, busy: boolean) {
  for (const fn of listeners) {
    try {
      fn(busy);
    } catch {
      /* ignore */
    }
  }
}

function notifyComplete(sessionId: string, result: NpcAvatarGenResult) {
  for (const fn of completeListeners) {
    try {
      fn(sessionId, result);
    } catch {
      /* ignore */
    }
  }
}

function isAbortError(error: unknown): boolean {
  const name = String((error as { name?: string })?.name || '');
  const message = String((error as { message?: string })?.message || error || '');
  return name === 'AbortError' || /aborted|timeout/i.test(message);
}

/** 指定 NPC 是否正在后台生成头像 */
export function isNpcAvatarGenBusy(
  sessionId: string | null | undefined,
  npcId: string | null | undefined,
): boolean {
  const sid = String(sessionId || '').trim();
  const id = String(npcId || '').trim();
  return Boolean(sid && id && jobsBySessionNpc.has(jobKey(sid, id)));
}

/** 取消指定 NPC 进行中的生成 */
export function cancelNpcAvatarBackgroundGen(
  sessionId: string | null | undefined,
  npcId: string | null | undefined,
  reason = 'cancelled',
) {
  const sid = String(sessionId || '').trim();
  const id = String(npcId || '').trim();
  const job = sid && id ? jobsBySessionNpc.get(jobKey(sid, id)) : undefined;
  if (!job) return;
  try {
    job.abort.abort(new Error(reason));
  } catch {
    job.abort.abort();
  }
}

/** 订阅生成成功 */
export function subscribeNpcAvatarGenComplete(listener: CompleteListener): () => void {
  completeListeners.add(listener);
  return () => {
    completeListeners.delete(listener);
  };
}

/** 订阅 busy 变化 */
export function subscribeNpcAvatarGenBusy(
  sessionId: string | null | undefined,
  npcId: string | null | undefined,
  listener: (busy: boolean) => void,
): () => void {
  const sid = String(sessionId || '').trim();
  const id = String(npcId || '').trim();
  if (!sid || !id) {
    listener(false);
    return () => {};
  }

  const key = jobKey(sid, id);
  const job = jobsBySessionNpc.get(key);
  if (job) {
    job.listeners.add(listener);
    listener(true);
    return () => {
      job.listeners.delete(listener);
    };
  }

  let pending = pendingListenersBySessionNpc.get(key);
  if (!pending) {
    pending = new Set();
    pendingListenersBySessionNpc.set(key, pending);
  }
  pending.add(listener);
  listener(false);
  return () => {
    pending?.delete(listener);
    if (pending && pending.size === 0) pendingListenersBySessionNpc.delete(key);
  };
}

/**
 * 启动（或复用）后台生成。同一 session+npcId 并发第二次直接返回进行中的 promise。
 */
export function startNpcAvatarBackgroundGen(opts: {
  token: string;
  sessionId: string;
  payload: NpcAvatarGenPayload;
  /** 测试可注入；默认 NPC_AVATAR_GEN_CLIENT_TIMEOUT_MS */
  timeoutMs?: number;
}): Promise<NpcAvatarGenResult> {
  const sid = String(opts.sessionId || '').trim();
  const id = String(opts.payload?.npcId || '').trim();
  if (!sid || !id || !opts.token) {
    return Promise.reject(new Error('会话或角色不可用'));
  }

  const key = jobKey(sid, id);
  const existing = jobsBySessionNpc.get(key);
  if (existing) return existing.promise;

  const listeners = new Set<(busy: boolean) => void>();
  const pending = pendingListenersBySessionNpc.get(key);
  if (pending) {
    for (const fn of pending) listeners.add(fn);
    pendingListenersBySessionNpc.delete(key);
  }

  const abort = new AbortController();
  const timeoutMs = Number(opts.timeoutMs) > 0
    ? Number(opts.timeoutMs)
    : NPC_AVATAR_GEN_CLIENT_TIMEOUT_MS;
  const timer = setTimeout(() => {
    try {
      abort.abort(new Error(`头像生成超时（${Math.round(timeoutMs / 1000)}s），请稍后重试`));
    } catch {
      abort.abort();
    }
  }, timeoutMs);

  const job: JobRecord = {
    sessionId: sid,
    npcId: id,
    listeners,
    abort,
    promise: null as unknown as Promise<NpcAvatarGenResult>,
  };

  const run = (async (): Promise<NpcAvatarGenResult> => {
    notify(listeners, true);
    try {
      const res = await sessionPlayerProfileApi.generateNpcAvatar(
        opts.token,
        sid,
        opts.payload,
        { signal: abort.signal },
      );
      if (!res?.success || !res.data?.avatarUrl) {
        const err = new Error(res?.message || '头像生成失败') as Error & { code?: string };
        if (res?.code) err.code = res.code;
        throw err;
      }
      const result: NpcAvatarGenResult = {
        npcId: id,
        avatarUrl: res.data.avatarUrl,
        avatarThumbUrl: res.data.avatarThumbUrl || '',
        pointsDeducted: res.data.pointsDeducted,
        remainingPoints: res.data.remainingPoints,
      };
      notifyComplete(sid, result);
      return result;
    } catch (error) {
      if (isAbortError(error) || abort.signal.aborted) {
        const reason = abort.signal.reason;
        const msg = reason instanceof Error
          ? reason.message
          : (typeof reason === 'string' && reason
            ? reason
            : `头像生成超时（${Math.round(timeoutMs / 1000)}s），请稍后重试`);
        throw new Error(msg);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      jobsBySessionNpc.delete(key);
      notify(listeners, false);
      listeners.clear();
    }
  })();

  job.promise = run;
  jobsBySessionNpc.set(key, job);
  return run;
}
