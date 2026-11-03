/**
 * 功能注释：作者预览启动态（加载 / 就绪 / 失败）。
 * 避免 beginAuthorPreviewMod 失败或 PlayScreens 抛错后只剩顶栏、中间静默空白。
 */
export type AuthorPreviewBootState =
  | { status: "idle" }
  | { status: "booting" }
  | { status: "ready" }
  | { status: "failed"; errors: string[] };

let boot: AuthorPreviewBootState = { status: "idle" };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeAuthorPreviewBoot(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getAuthorPreviewBoot(): AuthorPreviewBootState {
  return boot;
}

export function setAuthorPreviewBoot(next: AuthorPreviewBootState) {
  boot = next;
  emit();
}

/** 功能注释：进入预览前先标 booting，GameContext 启动成功后再 ready。 */
export function markAuthorPreviewBooting() {
  setAuthorPreviewBoot({ status: "booting" });
}

export function markAuthorPreviewReady() {
  setAuthorPreviewBoot({ status: "ready" });
}

export function markAuthorPreviewFailed(errors: string[]) {
  const list = (errors || []).map((e) => String(e || "").trim()).filter(Boolean);
  setAuthorPreviewBoot({ status: "failed", errors: list.length ? list : ["预览启动失败"] });
}

export function resetAuthorPreviewBoot() {
  setAuthorPreviewBoot({ status: "idle" });
}
