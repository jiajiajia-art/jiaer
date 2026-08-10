/**
 * 游戏内心跳与平台心跳互斥门闩。
 * 游玩页挂载 useGameDurationTracking 时暂停平台 duration，避免成对请求并双倍累计 totalSeconds。
 */

let gameTrackingDepth = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore subscriber errors
    }
  });
}

/** 进入带 gameFileId 的游玩页时调用；返回释放函数 */
export function acquireGameDurationTracking(): () => void {
  gameTrackingDepth += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    gameTrackingDepth = Math.max(0, gameTrackingDepth - 1);
    notify();
  };
}

export function isGameDurationTrackingActive(): boolean {
  return gameTrackingDepth > 0;
}

export function subscribeGameDurationTracking(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
