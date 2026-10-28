/* ═══════════════ 内容槽 · 活视图（零依赖） ═══════════════
 * 本文件不 import 任何游戏模块，故可被 game/* 与 worlds/* 安全引用而不形成循环。
 * registry 在加载时注册「槽读取器」；内容模块用 slot() 惰性取当前世界的槽值。
 * 规则：只在函数体 / Proxy 访问时求值，绝不在模块顶层读取槽值。 */

type SlotReader = (key: string) => { has: boolean; value: unknown; worldId: string };
let reader: SlotReader | null = null;
export function setSlotReader(r: SlotReader) { reader = r; }

/* 取槽：当前世界声明了 → 用之；未声明 → off()（功能关闭的空值）或 ent 默认。
 * registry 尚未注册（极早期调用）时一律回退 ent 默认，保证娱乐圈行为不变。 */
export function slot<T>(key: string, entDefault: () => T, off?: () => T): T {
  const r = reader?.(key);
  if (!r) return entDefault();
  if (r.has && r.value !== undefined) return r.value as T;
  return off ? off() : entDefault();
}
/* 当前世界是否声明了某槽（UI 据此隐藏功能入口） */
export function hasSlot(key: string): boolean {
  const r = reader?.(key);
  return !r || (r.has && r.value !== undefined);
}

export function liveArray<T>(get: () => T[]): T[] {
  return new Proxy([] as T[], {
    get: (_t, k) => { const a = get(); const v = Reflect.get(a, k); return typeof v === "function" ? v.bind(a) : v; },
    has: (_t, k) => Reflect.has(get(), k),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, k) => { const d = Reflect.getOwnPropertyDescriptor(get(), k); if (d && k !== "length") d.configurable = true; return d; },
  });
}
export function liveRecord<T extends object>(get: () => T): T {
  return new Proxy({} as T, {
    get: (_t, k) => Reflect.get(get(), k),
    has: (_t, k) => Reflect.has(get(), k),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, k) => { const d = Reflect.getOwnPropertyDescriptor(get(), k); if (d) d.configurable = true; return d; },
  });
}
/* 按数组身份缓存的 id 索引 */
export function liveById<T extends { id: string }>(get: () => T[]): Record<string, T> {
  const cache = new WeakMap<T[], Record<string, T>>();
  return liveRecord(() => {
    const a = get();
    let m = cache.get(a);
    if (!m) { m = Object.fromEntries(a.map((e) => [e.id, e])); cache.set(a, m); }
    return m;
  });
}
/* 按输入身份缓存的派生值 */
export function memoBy<I extends object, O>(get: () => I, f: (i: I) => O): () => O {
  const cache = new WeakMap<I, O>();
  return () => { const i = get(); let o = cache.get(i); if (o === undefined && !cache.has(i)) { o = f(i); cache.set(i, o); } return o as O; };
}

/* 术语活读取（零依赖）：registry 注册读取器；未注册 / 未声明 → 通用叫法 */
type TermReader = (key: string) => string | undefined;
let termReader: TermReader | null = null;
export function setTermReader(r: TermReader) { termReader = r; }
const GENERIC_TERMS: Record<string, string> = {
  city: "城里", industry: "这一行", celebrity: "名人", gig: "工作", fans: "关注者", reputation: "口碑", fame: "名气",
  money: "收入", works: "成果", advance: "日程",
};
/** 功能注释：不经 termReader 的兜底叫法，供 registry.resolveLiveTerm 使用，避免与 liveTerm 互相递归。 */
export function termFallback(key: string, fallback?: string): string {
  return fallback ?? GENERIC_TERMS[key] ?? "";
}

export function liveTerm(key: string, fallback?: string): string {
  return termReader?.(key) ?? termFallback(key, fallback);
}
