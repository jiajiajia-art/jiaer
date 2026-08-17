/**
 * 仓库人设卡 / 角色卡立绘：组件外后台任务，关弹窗也不中断；仅锁生图按钮。
 */
import { playerCharacterCardsApi } from '../../api/galgame/playerCharacterCards';

export const WAREHOUSE_CARD_AVATAR_GEN_CLIENT_TIMEOUT_MS = 120_000;

export type WarehouseCardKind = 'player' | 'npc';

export type WarehouseCardAvatarGenPayload = {
  name: string;
  gender?: string;
  persona?: string;
  cardId?: string;
  cardKind: WarehouseCardKind;
  promptSupplement?: string;
};

export type WarehouseCardAvatarGenResult = {
  key: string;
  cardKind: WarehouseCardKind;
  cardId?: string;
  avatarUrl: string;
  avatarThumbUrl?: string;
  pointsDeducted?: number;
  remainingPoints?: number;
  card?: unknown;
};

type JobRecord = {
  key: string;
  promise: Promise<WarehouseCardAvatarGenResult>;
  abort: AbortController;
  listeners: Set<(busy: boolean) => void>;
};

const jobsByKey = new Map<string, JobRecord>();
const pendingListenersByKey = new Map<string, Set<(busy: boolean) => void>>();
type CompleteListener = (result: WarehouseCardAvatarGenResult) => void;
const completeListeners = new Set<CompleteListener>();

export function warehouseCardAvatarJobKey(
  cardKind: WarehouseCardKind,
  cardId?: string | null,
): string {
  const kind = cardKind === 'npc' ? 'npc' : 'player';
  const id = String(cardId || '').trim() || 'new';
  return `${kind}:${id}`;
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

function notifyComplete(result: WarehouseCardAvatarGenResult) {
  for (const fn of completeListeners) {
    try {
      fn(result);
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

export function isWarehouseCardAvatarGenBusy(key: string | null | undefined): boolean {
  const k = String(key || '').trim();
  return Boolean(k && jobsByKey.has(k));
}

export function subscribeWarehouseCardAvatarGenComplete(
  listener: CompleteListener,
): () => void {
  completeListeners.add(listener);
  return () => {
    completeListeners.delete(listener);
  };
}

export function subscribeWarehouseCardAvatarGenBusy(
  key: string | null | undefined,
  listener: (busy: boolean) => void,
): () => void {
  const k = String(key || '').trim();
  if (!k) {
    listener(false);
    return () => {};
  }

  const job = jobsByKey.get(k);
  if (job) {
    job.listeners.add(listener);
    listener(true);
    return () => {
      job.listeners.delete(listener);
    };
  }

  let pending = pendingListenersByKey.get(k);
  if (!pending) {
    pending = new Set();
    pendingListenersByKey.set(k, pending);
  }
  pending.add(listener);
  listener(false);
  return () => {
    pending?.delete(listener);
    if (pending && pending.size === 0) pendingListenersByKey.delete(k);
  };
}

/**
 * 启动（或复用）后台生图。同一 key 并发第二次返回进行中的 promise。
 */
export function startWarehouseCardAvatarBackgroundGen(opts: {
  token: string;
  payload: WarehouseCardAvatarGenPayload;
  timeoutMs?: number;
}): Promise<WarehouseCardAvatarGenResult> {
  const cardKind: WarehouseCardKind = opts.payload.cardKind === 'npc' ? 'npc' : 'player';
  const key = warehouseCardAvatarJobKey(cardKind, opts.payload.cardId);
  if (!opts.token) {
    return Promise.reject(new Error('请先登录'));
  }

  const existing = jobsByKey.get(key);
  if (existing) return existing.promise;

  const listeners = new Set<(busy: boolean) => void>();
  const pending = pendingListenersByKey.get(key);
  if (pending) {
    for (const fn of pending) listeners.add(fn);
    pendingListenersByKey.delete(key);
  }

  const abort = new AbortController();
  const timeoutMs = Number(opts.timeoutMs) > 0
    ? Number(opts.timeoutMs)
    : WAREHOUSE_CARD_AVATAR_GEN_CLIENT_TIMEOUT_MS;
  const timer = setTimeout(() => {
    try {
      abort.abort(new Error(`立绘生成超时（${Math.round(timeoutMs / 1000)}s），请稍后重试`));
    } catch {
      abort.abort();
    }
  }, timeoutMs);

  const job: JobRecord = {
    key,
    listeners,
    abort,
    promise: null as unknown as Promise<WarehouseCardAvatarGenResult>,
  };

  const run = (async (): Promise<WarehouseCardAvatarGenResult> => {
    notify(listeners, true);
    try {
      const res = await playerCharacterCardsApi.generateAvatar(opts.token, {
        name: opts.payload.name,
        gender: opts.payload.gender,
        persona: opts.payload.persona,
        cardId: opts.payload.cardId,
        cardKind,
        promptSupplement: opts.payload.promptSupplement,
      });
      if (abort.signal.aborted) {
        throw new Error(abort.signal.reason instanceof Error
          ? abort.signal.reason.message
          : 'cancelled');
      }
      if (!res?.success || !res.data?.avatarUrl) {
        const raw = String(res?.message || '生成图像失败');
        // 功能注释：兜底把上游英文 timeout 文案转成中文
        if (/timeout|timed?\s*out/i.test(raw)) {
          throw new Error('生图超时，请稍后重试（高峰期可能较慢）');
        }
        throw new Error(raw);
      }
      const result: WarehouseCardAvatarGenResult = {
        key,
        cardKind,
        cardId: opts.payload.cardId,
        avatarUrl: String(res.data.avatarUrl),
        avatarThumbUrl: res.data.avatarThumbUrl,
        pointsDeducted: res.data.pointsDeducted,
        remainingPoints: res.data.remainingPoints,
        card: res.data.card,
      };
      notifyComplete(result);
      return result;
    } catch (e) {
      if (isAbortError(e) || abort.signal.aborted) {
        throw e instanceof Error ? e : new Error('cancelled');
      }
      throw e;
    } finally {
      clearTimeout(timer);
      jobsByKey.delete(key);
      notify(listeners, false);
    }
  })();

  job.promise = run;
  jobsByKey.set(key, job);
  return run;
}
