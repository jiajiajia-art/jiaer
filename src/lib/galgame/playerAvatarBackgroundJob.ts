/**
 * 局内主角头像 AI 生成：组件外后台任务，离开编辑页也不中断。
 * 服务端会写回 session；完成后由 Galgame 订阅合并本地档案。
 */

import { sessionPlayerProfileApi } from '../../api/galgame/playerCharacterCards';
import type { SessionPlayerProfile } from './playerCharacterCard';
import type { PlayerAvatarMergeInput } from './playerAvatarMerge';
import { sanitizeUpstreamLlmErrorMessage } from '../../utils/error';

export type PlayerAvatarGenPayload = {
  name: string;
  gender: string;
  persona?: string;
  /** 用户补充外貌备注，拼到动态段之后 */
  promptSupplement?: string;
  /** 画风 A–D，默认 A */
  avatarStyle?: string;
};

export type PlayerAvatarGenResult = PlayerAvatarMergeInput & {
  profile?: SessionPlayerProfile;
  pointsDeducted?: number;
  remainingPoints?: number;
};

export {
  mergePlayerAvatarIntoProfile,
} from './playerAvatarMerge';

/**
 * 功能注释：前端硬超时。后端单次生图 55s，再加重试/抠图/压图；
 * 无客户端超时则 Network 挂死时按钮会永久「后台生成中…」。
 */
export const PLAYER_AVATAR_GEN_CLIENT_TIMEOUT_MS = 120_000;

type JobRecord = {
  sessionId: string;
  promise: Promise<PlayerAvatarGenResult>;
  abort: AbortController;
  listeners: Set<(busy: boolean) => void>;
};

const jobsBySession = new Map<string, JobRecord>();
/** 尚无 job 时先登记的订阅，start 时并入 */
const pendingListenersBySession = new Map<string, Set<(busy: boolean) => void>>();
type CompleteListener = (sessionId: string, result: PlayerAvatarGenResult) => void;
const completeListeners = new Set<CompleteListener>();

function notify(listeners: Set<(busy: boolean) => void>, busy: boolean) {
  for (const fn of listeners) {
    try {
      fn(busy);
    } catch {
      /* ignore */
    }
  }
}

function notifyComplete(sessionId: string, result: PlayerAvatarGenResult) {
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

/** 当前会话是否正在后台生成主角头像 */
export function isPlayerAvatarGenBusy(sessionId: string | null | undefined): boolean {
  const sid = String(sessionId || '').trim();
  return Boolean(sid && jobsBySession.has(sid));
}

/** 功能注释：取消进行中的生成（超时/用户离开局可调用），保证 busy 落回 false */
export function cancelPlayerAvatarBackgroundGen(sessionId: string | null | undefined, reason = 'cancelled') {
  const sid = String(sessionId || '').trim();
  const job = sid ? jobsBySession.get(sid) : undefined;
  if (!job) return;
  try {
    job.abort.abort(new Error(reason));
  } catch {
    job.abort.abort();
  }
}

/** 订阅生成成功（游玩页挂载用，面板关掉也能写回档案） */
export function subscribePlayerAvatarGenComplete(listener: CompleteListener): () => void {
  completeListeners.add(listener);
  return () => {
    completeListeners.delete(listener);
  };
}

/** 订阅 busy 变化；返回取消订阅 */
export function subscribePlayerAvatarGenBusy(
  sessionId: string | null | undefined,
  listener: (busy: boolean) => void,
): () => void {
  const sid = String(sessionId || '').trim();
  if (!sid) {
    listener(false);
    return () => {};
  }

  const job = jobsBySession.get(sid);
  if (job) {
    job.listeners.add(listener);
    listener(true);
    return () => {
      job.listeners.delete(listener);
    };
  }

  let pending = pendingListenersBySession.get(sid);
  if (!pending) {
    pending = new Set();
    pendingListenersBySession.set(sid, pending);
  }
  pending.add(listener);
  listener(false);
  return () => {
    pending?.delete(listener);
    if (pending && pending.size === 0) pendingListenersBySession.delete(sid);
  };
}

/**
 * 启动（或复用）后台生成。同一 session 并发第二次直接返回进行中的 promise。
 */
export function startPlayerAvatarBackgroundGen(opts: {
  token: string;
  sessionId: string;
  payload: PlayerAvatarGenPayload;
  /** 测试可注入；默认 PLAYER_AVATAR_GEN_CLIENT_TIMEOUT_MS */
  timeoutMs?: number;
}): Promise<PlayerAvatarGenResult> {
  const sid = String(opts.sessionId || '').trim();
  if (!sid || !opts.token) {
    return Promise.reject(new Error('会话不可用'));
  }

  const existing = jobsBySession.get(sid);
  if (existing) return existing.promise;

  const listeners = new Set<(busy: boolean) => void>();
  const pending = pendingListenersBySession.get(sid);
  if (pending) {
    for (const fn of pending) listeners.add(fn);
    pendingListenersBySession.delete(sid);
  }

  const abort = new AbortController();
  const timeoutMs = Number(opts.timeoutMs) > 0
    ? Number(opts.timeoutMs)
    : PLAYER_AVATAR_GEN_CLIENT_TIMEOUT_MS;
  const timer = setTimeout(() => {
    try {
      abort.abort(new Error(`头像生成超时（${Math.round(timeoutMs / 1000)}s），请稍后重试`));
    } catch {
      abort.abort();
    }
  }, timeoutMs);

  const job: JobRecord = {
    sessionId: sid,
    listeners,
    abort,
    promise: null as unknown as Promise<PlayerAvatarGenResult>,
  };

  const run = (async (): Promise<PlayerAvatarGenResult> => {
    notify(listeners, true);
    try {
      const res = await sessionPlayerProfileApi.generatePlayerAvatar(
        opts.token,
        sid,
        opts.payload,
        { signal: abort.signal },
      );
      if (!res?.success || !res.data?.avatarUrl) {
        const err = new Error(
          sanitizeUpstreamLlmErrorMessage(res?.message || '', '头像生成失败'),
        ) as Error & { code?: string };
        if (res?.code) err.code = res.code;
        throw err;
      }
      const result: PlayerAvatarGenResult = {
        avatarUrl: res.data.avatarUrl,
        avatarThumbUrl: res.data.avatarThumbUrl || '',
        profile: res.data.profile,
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
      jobsBySession.delete(sid);
      notify(listeners, false);
      listeners.clear();
    }
  })();

  job.promise = run;
  jobsBySession.set(sid, job);
  return run;
}
