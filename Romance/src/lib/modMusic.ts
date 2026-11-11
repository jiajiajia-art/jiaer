/* 模组「音乐」列表：界面是一份列表，存储仍分三处。
 * 内嵌 / 本机 / 链接 → content.bgm；作品引用 → content.audioRefs；平台曲 → content.platformAudioRefs。
 * musicOrder 只排显示顺序，platformAutoplay 只记一首平台曲的开局播放，都不把曲目并成一种格式。 */
import type { AudioKind } from "./types";
import type { ModTrack } from "../mods/types";

export type MusicSource = "embed" | "local" | "link" | "ref" | "platform";

export type MusicRow = {
  key: string;
  source: MusicSource;
  id: string;
  name: string;
  src?: string;
  autoplay: boolean;
  missing: boolean;
  nameLocked: boolean;
};

export type MusicLookups = {
  author: readonly { id: string; name: string; src?: string }[];
  platform: readonly { id: string; name: string; kind: AudioKind; src: string }[];
};

export type MusicSlice = {
  bgm?: unknown;
  audio?: { id?: string; name?: string; kind?: string }[];
  audioRefs?: unknown;
  platformAudioRefs?: unknown;
  platformAutoplay?: unknown;
  musicOrder?: unknown;
  rooms?: Record<string, { bgm?: unknown } | null | undefined>;
  fixedEvents?: { bgm?: unknown }[];
  events?: { bgm?: unknown }[];
};

export type MusicPatch = {
  bgm?: ModTrack[];
  audioRefs?: string[];
  platformAudioRefs?: string[];
  platformAutoplay?: string;
  musicOrder?: string[];
};

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asId = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** 功能注释：脏 src 不是字符串时按链接处理，避免 .startsWith 崩页 */
export function bgmSourceOf(src: unknown): "embed" | "local" | "link" {
  const s = typeof src === "string" ? src : "";
  if (s.startsWith("data:")) return "embed";
  if (s.startsWith("local:")) return "local";
  return "link";
}

export const SOURCE_LABEL: Record<MusicSource, string> = {
  embed: "内嵌",
  local: "本机",
  link: "链接",
  ref: "引用",
  platform: "平台",
};

function rowKey(source: MusicSource, id: string): string {
  if (source === "ref") return `a:${id}`;
  if (source === "platform") return id.startsWith("platform:") ? id : `platform:${id}`;
  return `b:${id}`;
}

/** 功能注释：旧模组没有 musicOrder 时按 bgm、作品引用、平台引用的原顺序合成一份列表 */
export function musicRows(content: MusicSlice, look: MusicLookups): MusicRow[] {
  const author = new Map(look.author.map((a) => [a.id, a]));
  const plat = new Map(look.platform.map((p) => [p.id, p]));
  const rows: MusicRow[] = [];
  let seenAuto = false;
  const takeAuto = (want: boolean) => {
    if (!want || seenAuto) return false;
    seenAuto = true;
    return true;
  };
  for (const raw of asList(content.bgm)) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as { id?: unknown; name?: unknown; src?: unknown; autoplay?: unknown };
    const id = asId(t.id) || `t${rows.length}`;
    const src = typeof t.src === "string" ? t.src : "";
    const key = rowKey("embed", id);
    if (rows.some((r) => r.key === key)) continue;
    rows.push({
      key,
      source: bgmSourceOf(src),
      id,
      name: typeof t.name === "string" ? t.name : "",
      src,
      autoplay: takeAuto(t.autoplay === true),
      missing: false,
      nameLocked: false,
    });
  }
  for (const raw of asList(content.audioRefs)) {
    const id = asId(raw);
    if (!id) continue;
    const key = rowKey("ref", id);
    if (rows.some((r) => r.key === key)) continue;
    const a = author.get(id);
    rows.push({
      key,
      source: "ref",
      id,
      name: a?.name || id,
      src: a?.src,
      autoplay: false,
      missing: !a,
      nameLocked: true,
    });
  }
  const autoId = asId(content.platformAutoplay);
  for (const raw of asList(content.platformAudioRefs)) {
    const id = asId(raw);
    if (!id) continue;
    const key = rowKey("platform", id);
    if (rows.some((r) => r.key === key)) continue;
    const p = plat.get(id);
    rows.push({
      key,
      source: "platform",
      id,
      name: p?.name || id,
      src: p?.src,
      autoplay: takeAuto(!!p && autoId === id),
      missing: !p,
      nameLocked: true,
    });
  }
  const order = asList(content.musicOrder).map(asId).filter(Boolean);
  if (!order.length) return rows;
  const map = new Map(rows.map((r) => [r.key, r]));
  const ordered: MusicRow[] = [];
  for (const k of order) {
    const r = map.get(k);
    if (!r) continue;
    ordered.push(r);
    map.delete(k);
  }
  for (const r of rows) if (map.has(r.key)) ordered.push(r);
  return ordered;
}

/** 功能注释：写回时三处字段各存各的；引用和平台不进 bgm，平台 id 不进 audioRefs */
export function applyMusicRows(rows: MusicRow[]): MusicPatch {
  let taken = false;
  const cleaned = rows.map((r) => {
    const autoplay = r.source !== "ref" && r.autoplay && !r.missing && !taken;
    if (autoplay) taken = true;
    return { ...r, autoplay };
  });
  const bgm: ModTrack[] = cleaned
    .filter((r) => r.source === "embed" || r.source === "local" || r.source === "link")
    .map((r) => ({ id: r.id, name: r.name, src: r.src ?? "", ...(r.autoplay ? { autoplay: true as const } : {}) }));
  const audioRefs = cleaned.filter((r) => r.source === "ref").map((r) => r.id);
  const platformAudioRefs = cleaned.filter((r) => r.source === "platform").map((r) => r.id);
  const platformAutoplay = cleaned.find((r) => r.source === "platform" && r.autoplay)?.id;
  const musicOrder = cleaned.map((r) => r.key);
  return {
    bgm: bgm.length ? bgm : undefined,
    audioRefs: audioRefs.length ? audioRefs : undefined,
    platformAudioRefs: platformAudioRefs.length ? platformAudioRefs : undefined,
    platformAutoplay,
    musicOrder: musicOrder.length ? musicOrder : undefined,
  };
}

/** 功能注释：地点背景音乐下拉。平台曲直接出现，不必先加进音乐列表；引用名后保留「（引用）」 */
export function locationBgmOptions(content: MusicSlice, look: MusicLookups): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  const add = (id: string, name: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name });
  };
  for (const raw of asList(content.bgm)) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as { id?: unknown; name?: unknown };
    const id = asId(t.id);
    if (id) add(id, typeof t.name === "string" && t.name ? t.name : id);
  }
  for (const a of content.audio ?? []) {
    if (a?.kind === "bgm" && a.id) add(a.id, a.name || a.id);
  }
  for (const raw of asList(content.audioRefs)) {
    const id = asId(raw);
    if (!id) continue;
    const name = look.author.find((a) => a.id === id)?.name;
    add(id, `${name ?? `已失效：${id}`}（引用）`);
  }
  for (const p of look.platform) add(p.id, `${p.name}（平台）`);
  return out;
}

/** 功能注释：引用缺失、平台下架只出警告，不抛错，编辑器和存档仍能打开 */
export function musicHealthWarnings(content: MusicSlice, look: MusicLookups): string[] {
  const author = new Set(look.author.map((a) => a.id));
  const plat = new Set(look.platform.map((p) => p.id));
  const out: string[] = [];
  for (const raw of asList(content.audioRefs)) {
    const id = asId(raw);
    if (id && !author.has(id)) out.push(`引用的音频「${id}」不在作品音频库`);
  }
  const platformIds = new Set<string>();
  for (const raw of asList(content.platformAudioRefs)) {
    const id = asId(raw);
    if (id) platformIds.add(id);
  }
  const rooms = content.rooms && typeof content.rooms === "object" ? Object.values(content.rooms) : [];
  for (const room of rooms) {
    const id = asId(room?.bgm);
    if (id.startsWith("platform:")) platformIds.add(id);
  }
  for (const ev of [...(content.fixedEvents ?? []), ...(content.events ?? [])]) {
    const id = asId(ev?.bgm);
    if (id.startsWith("platform:")) platformIds.add(id);
  }
  for (const id of platformIds) {
    if (!plat.has(id)) out.push(`平台曲目「${id}」已失效`);
  }
  for (const raw of asList(content.bgm)) {
    if (!raw || typeof raw !== "object") continue;
    const id = asId((raw as { id?: unknown }).id);
    if (id.startsWith("platform:") || plat.has(id)) out.push(`内置曲目「${id}」使用了平台曲库的 id`);
  }
  return out;
}
