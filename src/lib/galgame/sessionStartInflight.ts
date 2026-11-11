/**
 * 新开局静默 start：同一 session 全局只跑一次（挡住 StrictMode 双挂载）。
 */

const inflight = new Map<string, Promise<void>>();
const completed = new Set<string>();

/** 功能注释：同一 sessionId 的自动开局只执行一次；并发调用复用同一 Promise。 */
export function runSessionAutoStartOnce(
  sessionId: string,
  task: () => Promise<void>,
): Promise<void> {
  const key = String(sessionId || '').trim();
  if (!key) return Promise.resolve();
  if (completed.has(key)) return Promise.resolve();

  const existing = inflight.get(key);
  if (existing) return existing;

  // 先占坑再跑 task，避免 StrictMode / 双 effect 在 await 前各起一路 stream 抢锁
  let settle!: () => void;
  const gate = new Promise<void>((resolve) => {
    settle = resolve;
  });
  inflight.set(key, gate);

  void (async () => {
    try {
      await task();
      completed.add(key);
    } finally {
      inflight.delete(key);
      settle();
    }
  })();

  return gate;
}

/** 功能注释：测试或切局时可清标记。 */
export function resetSessionAutoStartGate(sessionId?: string): void {
  if (!sessionId) {
    inflight.clear();
    completed.clear();
    return;
  }
  const key = String(sessionId).trim();
  inflight.delete(key);
  completed.delete(key);
}

export function hasSessionAutoStartCompleted(sessionId: string): boolean {
  return completed.has(String(sessionId || '').trim());
}
