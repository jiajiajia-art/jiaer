/* ══════════════════════════════════════════════════════════════════════
 * storage.worker.client.ts — storage.worker 的主线程调用封装
 *
 * 把 postMessage 请求/回包封装成 async/await Promise，主线程零阻塞。
 * 应用默认走 storage.ts（主线程 localforage，已够快）；当需要把读写
 * 彻底移出主线程时，把存档调用替换成本文件的方法即可。
 * ════════════════════════════════════════════════════════════════════ */
import type { SaveSlot } from "./storage";

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./storage.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const { id, ok, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      ok ? p.resolve(result) : p.reject(new Error(error));
    };
    worker.onerror = (e) => {
      for (const [, p] of pending) p.reject(e);
      pending.clear();
    };
  }
  return worker;
}

function call<T>(payload: Record<string, unknown>): Promise<T> {
  const id = ++seq;
  const w = ensureWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ id, ...payload });
  }).catch((e) => {
    // 与 storage.ts 相同的异常兜底策略：失败不崩溃
    console.error("[storage.worker.client] 调用失败：", e);
    throw e;
  });
}

/* ───────────── 与 storage.ts 同名的异步 API（后台线程版） ───────────── */
export const listSavesW = () => call<SaveSlot[]>({ op: "list" });
export const getSlotW = (slot: string) => call<SaveSlot | null>({ op: "get", slot });
export const writeSlotW = (value: SaveSlot) => call<void>({ op: "set", value });
export const deleteSlotW = (slot: string) => call<void>({ op: "delete", slot });

/* ═══════════════════════ 主线程调用示例 ═══════════════════════
 * import { listSavesW, getSlotW, writeSlotW, deleteSlotW } from "./storage.worker.client";
 *
 * // 保存（后台线程写库，主线程不阻塞）：
 * await writeSlotW({ id: "slot-1", name: "初入行", updatedAt: Date.now(), state });
 *
 * // 读取：
 * const slot = await getSlotW("slot-1");
 * if (slot) startGame(slot.state);
 *
 * // 列表 / 删除：
 * const slots = await listSavesW();
 * await deleteSlotW("slot-1");
 * ═══════════════════════════════════════════════════════════ */
