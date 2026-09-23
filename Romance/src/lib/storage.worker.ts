/* ══════════════════════════════════════════════════════════════════════
 * storage.worker.ts — 后台线程存储 Worker（localforage / IndexedDB）
 *
 * 所有数据库读写都在这个 Worker 里执行，UI 主线程零阻塞。
 * 与主线程通过 postMessage 收发；每条请求带唯一 id，回包按 id 对应。
 *
 * 用法（Vite）：主线程用 `new Worker(new URL("./storage.worker.ts", import.meta.url),
 * { type: "module" })` 实例化，再配合下方 storage.worker.client.ts 调用。
 * ════════════════════════════════════════════════════════════════════ */
/// <reference lib="webworker" />
import localforage from "localforage";

/* 与 storage.ts 保持一致的配置 */
const DB_NAME = "gameSaveDB";
const DB_STORE = "saves";

const db = localforage.createInstance({ name: DB_NAME, storeName: DB_STORE });
const driverReady = db.setDriver(localforage.INDEXEDDB).catch((e) => {
  console.warn("[storage.worker] IndexedDB 驱动不可用：", e);
});

const slotKey = (id: string) => `slot:${id}`;

type Req =
  | { id: number; op: "list" }
  | { id: number; op: "get"; slot: string }
  | { id: number; op: "set"; value: unknown }
  | { id: number; op: "delete"; slot: string };

type Res = { id: number; ok: boolean; result?: unknown; error?: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<Req>) => {
  const msg = e.data;
  const reply = (r: Omit<Res, "id">) => ctx.postMessage({ id: msg.id, ...r } as Res);
  try {
    await driverReady;
    switch (msg.op) {
      case "list": {
        const out: unknown[] = [];
        await db.iterate((v) => {
          if (v) out.push(v);
        });
        reply({ ok: true, result: out });
        break;
      }
      case "get":
        reply({ ok: true, result: (await db.getItem(slotKey(msg.slot))) ?? null });
        break;
      case "set": {
        const v = msg.value as { id: string };
        await db.setItem(slotKey(v.id), v);
        reply({ ok: true });
        break;
      }
      case "delete":
        await db.removeItem(slotKey(msg.slot));
        reply({ ok: true });
        break;
      default:
        reply({ ok: false, error: "unknown op" });
    }
  } catch (err) {
    reply({ ok: false, error: String(err) });
  }
};
