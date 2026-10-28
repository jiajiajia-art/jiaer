/* ═══════════════ 音频库（原生资源层）═══════════════
 * 一个库：作者上传的音频（存档 game.audio）+ 已启用 MOD 注入的音频（content.audio / 旧版 content.bgm）。
 * 不区分来源，id 唯一；MOD 关闭 / 卸载后它注入的条目立刻从库里消失。
 * 冲突规则：作者音频优先；导入时选了「覆盖」的 MOD 条目在启用期间覆盖同 id；MOD 之间按加载顺序先到先得。 */
import { useSyncExternalStore } from "react";
import type { AudioAsset, AudioKind } from "../lib/types";
import type { Mod } from "../mods/types";
import { allMods, getWorld, subscribeMods } from "../mods/registry";
import { modLog } from "../mods/ext";

export const AUDIO_KIND_LABEL: Record<AudioKind, string> = { bgm: "背景音乐", sfx: "短音效", amb: "环境氛围音" };
export const AUDIO_EXT = /\.(mp3|ogg|wav)$/i;
export const AUDIO_ACCEPT = ".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav,audio/x-wav";
export const AUDIO_MAX_MB = 30;
export const EMBED_MB = 1; // MOD 方式 A 内嵌上限（MOD 存 localStorage）
export const audioUid = () => `au_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const loopOf = (a: AudioAsset) => a.loop ?? a.kind !== "sfx";

/* —— 作者音频：由 GameShell 从当前存档同步进来，供运行时与选择器读取 —— */
let author: AudioAsset[] = [];
let ver = 0;
const subs = new Set<() => void>();
const bump = () => { ver++; cache = null; subs.forEach((f) => f()); };
subscribeMods(bump);
export function setAuthorAudio(list: AudioAsset[] | undefined) {
  const n = list ?? [];
  if (n === author) return;
  author = n; bump();
}
export const useAudioLib = () => { useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => ver); return audioLibrary(); };

/* —— MOD 注入 —— */
export function modAudio(m: Mod): AudioAsset[] {
  const own = (m.content?.audio ?? []).map((a) => ({ ...a, _mod: m.id }));
  const legacy = (m.content?.bgm ?? []).filter((t) => !own.some((a) => a.id === t.id)).map<AudioAsset>((t) => ({ id: t.id, name: t.name, kind: "bgm", src: t.src, loop: true, _mod: m.id }));
  return [...own, ...legacy];
}
export const activeModIds = (): string[] => getWorld().chain.map((m) => m.id); // 世界 + 已启用扩展（按加载顺序）
export const isAudioOwnerOn = (mod?: string) => !mod || activeModIds().includes(mod);

let cache: Map<string, AudioAsset> | null = null;
/** 当前可用的全部音频（id → 条目） */
export function audioLibrary(): Map<string, AudioAsset> {
  if (cache) return cache;
  const m = new Map<string, AudioAsset>();
  for (const a of author) if (a?.id) m.set(a.id, a);
  for (const id of activeModIds()) {
    const mod = allMods().find((x) => x.id === id);
    if (!mod) continue;
    for (const a of modAudio(mod)) {
      const cur = m.get(a.id);
      if (!cur || (a.override && !cur._mod)) m.set(a.id, a);
      else if (cur._mod && cur._mod !== a._mod) modLog(mod.id, "warn", `音频 id「${a.id}」已被「${cur._mod}」注册，已跳过`);
    }
  }
  cache = m;
  return m;
}
export const resolveAudio = (id?: string) => (id ? audioLibrary().get(id) : undefined);

/** 选择器用：全部已知音频（含未启用 MOD 的，标记 on=false 置灰） */
export function audioOptions(kind?: AudioKind): { a: AudioAsset; on: boolean; modName?: string }[] {
  const lib = audioLibrary();
  const out: { a: AudioAsset; on: boolean; modName?: string }[] = [...lib.values()].map((a) => ({ a, on: true, modName: a._mod ? allMods().find((m) => m.id === a._mod)?.name : undefined }));
  for (const m of allMods()) for (const a of modAudio(m)) if (lib.get(a.id) !== a && !lib.has(a.id) && !out.some((o) => o.a.id === a.id)) out.push({ a, on: false, modName: m.name });
  return kind ? out.filter((o) => o.a.kind === kind) : out;
}
export const audioLabel = (id?: string) => { if (!id) return "（未选）"; const o = audioOptions().find((x) => x.a.id === id); return o ? `${o.a.name}${o.on ? "" : "（MOD 未启用）"}` : `已失效：${id}`; };

/* —— 导入 MOD 时的 id 冲突：自动重命名 / 跳过 / 覆盖 —— */
export type AudioResolve = "rename" | "skip" | "overwrite";
export function audioConflicts(mod: Mod, authorList: AudioAsset[] = author): { id: string; name: string; with: string }[] {
  const taken = new Map<string, string>();
  for (const a of authorList) taken.set(a.id, "作品音频库");
  for (const m of allMods()) if (m.id !== mod.id) for (const a of modAudio(m)) if (!taken.has(a.id)) taken.set(a.id, `MOD「${m.name}」`);
  return (mod.content?.audio ?? []).filter((a) => taken.has(a.id)).map((a) => ({ id: a.id, name: a.name, with: taken.get(a.id)! }));
}
/* 重命名时同步改掉本 MOD 内对该 id 的引用：音频效果 / 音频触发（kind:"audio" 的 id）、地点与事件的 bgm 字段 */
function renameRefs<T>(v: T, from: string, to: string): T {
  if (Array.isArray(v)) return v.map((x) => renameRefs(x, from, to)) as T;
  if (!v || typeof v !== "object") return v;
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = renameRefs(x, from, to);
  if (o.kind === "audio" && o.id === from) o.id = to;
  if (o.bgm === from) o.bgm = to;
  return o as T;
}
function renameAudio(mod: Mod, from: string, to: string): Mod {
  const m = renameRefs(mod, from, to);
  const ex = m.ext?.exports;
  return {
    ...m,
    content: { ...m.content, audio: (m.content?.audio ?? []).map((a) => (a.id === from ? { ...a, id: to } : a)), audioRefs: m.content?.audioRefs?.map((x) => (x === from ? to : x)) },
    ext: ex?.audio ? { ...m.ext, exports: { ...ex, audio: ex.audio.map((x) => (x.id === from ? { ...x, id: to } : x)) } } : m.ext,
  };
}
export function resolveAudioConflicts(mod: Mod, choice: Record<string, AudioResolve>): Mod {
  let out: Mod = mod;
  const taken = new Set([...author.map((a) => a.id), ...allMods().filter((m) => m.id !== mod.id).flatMap((m) => modAudio(m).map((a) => a.id)), ...(mod.content?.audio ?? []).map((a) => a.id)]);
  for (const [id, c] of Object.entries(choice)) {
    const list = out.content?.audio ?? [];
    if (c === "skip") out = { ...out, content: { ...out.content, audio: list.filter((a) => a.id !== id), audioRefs: [...new Set([...(out.content?.audioRefs ?? []), id])] } };
    else if (c === "overwrite") out = { ...out, content: { ...out.content, audio: list.map((a) => (a.id === id ? { ...a, override: true } : a)) } };
    else {
      let n = 2; while (taken.has(`${id}_${n}`)) n++;
      const nid = `${id}_${n}`; taken.add(nid);
      out = renameAudio(out, id, nid);
    }
  }
  return out;
}

/* —— 本机大文件：IndexedDB（src = idb:<key>）—— */
const DB = "star:audio", STORE = "blobs";
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const q = fn(d.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
export const putBlob = (key: string, b: Blob) => idb("readwrite", (s) => s.put(b, key));
export const delBlob = (key: string) => idb("readwrite", (s) => s.delete(key)).catch(() => undefined);
const urls = new Map<string, string>();
/** 把 src 解析成可播放的 URL（idb: 转 blob URL 并缓存） */
export async function playableSrc(src: string): Promise<string | null> {
  if (!src.startsWith("idb:")) return src;
  const k = src.slice(4);
  if (urls.has(k)) return urls.get(k)!;
  try { const b = await idb<Blob | undefined>("readonly", (s) => s.get(k) as IDBRequest<Blob | undefined>); if (!b) return null; const u = URL.createObjectURL(b); urls.set(k, u); return u; } catch { return null; }
}
export const srcKind = (src: string) => (src.startsWith("data:") ? "内嵌" : src.startsWith("idb:") ? "本机" : "链接");
export const readDataUrl = (f: Blob) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(f); });
export function audioFileProblem(f: File): string | null {
  if (!AUDIO_EXT.test(f.name)) return "只支持 mp3 / ogg / wav";
  if (f.size > AUDIO_MAX_MB * 1048576) return `超过 ${AUDIO_MAX_MB}MB`;
  return null;
}
