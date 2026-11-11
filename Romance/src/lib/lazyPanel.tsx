import { Suspense, lazy, type ComponentProps, type ComponentType } from "react";

/* 按需加载：首屏不打包进主脚本；页面空闲后在后台逐个预取，用户点开时通常已就绪。
 * 若尚未加载完成，显示轻量的「加载中」提示而不是空白。 */
const queue: Array<() => Promise<unknown>> = [];
let scheduled = false;
function schedulePrefetch() {
  if (scheduled || typeof window === "undefined") return;
  scheduled = true;
  const idle = (cb: () => void) =>
    "requestIdleCallback" in window ? (window as any).requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 1500);
  const next = () => {
    const job = queue.shift();
    if (!job) return;
    job().catch(() => {}).finally(() => idle(next));
  };
  // 等首屏渲染稳定后再开始预取，不抢首屏带宽
  setTimeout(() => idle(next), 2500);
}

const Fallback = () => (
  <div style={{ padding: "24px 0", textAlign: "center", fontSize: 13, opacity: 0.55 }}>加载中…</div>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPanel<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  let p: Promise<{ default: T }> | null = null;
  const once = () => (p ??= load().catch((e) => { p = null; throw e; }));
  const L = lazy(once);
  queue.push(once);
  schedulePrefetch();
  return (props: ComponentProps<T>) => <Suspense fallback={<Fallback />}><L {...props} /></Suspense>;
}
