/**
 * play-ui 单侧延后：每 session 只拉一次（首屏可交互或打开面板时触发）。
 */

type PlayUiHydrator = () => Promise<void>;

const inflight = new Map<string, Promise<void>>();
const hydrated = new Set<string>();

/** 功能注释：同一 session 的 play-ui 只 hydrate 一次。 */
export function ensurePlayUiHydratedOnce(
  sessionId: string,
  hydrate: PlayUiHydrator,
): Promise<void> {
  const key = String(sessionId || '').trim();
  if (!key) return Promise.resolve();
  if (hydrated.has(key)) return Promise.resolve();

  const existing = inflight.get(key);
  if (existing) return existing;

  const run = (async () => {
    try {
      await hydrate();
      hydrated.add(key);
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, run);
  return run;
}

export function hasPlayUiHydrated(sessionId: string): boolean {
  return hydrated.has(String(sessionId || '').trim());
}

export function resetPlayUiHydrationGate(sessionId?: string): void {
  if (!sessionId) {
    inflight.clear();
    hydrated.clear();
    return;
  }
  const key = String(sessionId).trim();
  inflight.delete(key);
  hydrated.delete(key);
}
