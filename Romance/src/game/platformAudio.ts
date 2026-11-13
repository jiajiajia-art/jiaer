/* 平台公共曲库：由运营后台「音频库」维护（GET /api/audio-library，只返回上架曲目）。
 * 作者在模组编辑器里只能选和试听，不能上传、改名或删除原曲。
 * 文件放在平台地址上，不打进模组，也不复制进作品音频库。id 一律 platform: 前缀。
 * 接口不可用时退回下方内置示例，保证旧作品能打开。 */
import { useSyncExternalStore } from "react";
import type { AudioAsset, AudioKind } from "../lib/types";
import { readFunloomAuthToken, resolveFunloomApiBase, resolvePlatformAvatarUrl } from "../lib/platformAvatarLibrary.ts";

export type PlatformAudio = {
  id: string;
  name: string;
  kind: AudioKind;
  src: string;
  loop?: boolean;
};

const CC0 = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

/** 功能注释：后台接口不可用时的内置兜底曲目 */
const SEED: readonly PlatformAudio[] = Object.freeze([
  { id: "platform:cc0-bed", name: "短循环示例", kind: "bgm", src: CC0, loop: true },
  { id: "platform:cc0-roar", name: "恐龙吼声", kind: "sfx", src: CC0, loop: false },
  { id: "platform:cc0-air", name: "短氛围示例", kind: "amb", src: CC0, loop: true },
] as PlatformAudio[]);

/** 功能注释：当前平台曲库（live binding：加载完成后各处读到的就是后台最新列表）；客户端没有的 id 在模组里标失效，不让存档打不开 */
export let PLATFORM_AUDIO: readonly PlatformAudio[] = SEED;

const subs = new Set<() => void>();
let ver = 0;
let loading: Promise<void> | null = null;
export const subscribePlatformAudio = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

const KINDS: AudioKind[] = ["bgm", "sfx", "amb"];
function normalize(raw: unknown): PlatformAudio | null {
  const r = raw as Record<string, unknown>;
  const rid = String(r?.id ?? "").trim();
  const src = resolvePlatformAvatarUrl(String(r?.audioUrl ?? r?.url ?? r?.src ?? "").trim());
  if (!rid || !src || String(r?.status ?? "active") === "disabled") return null;
  const kind = KINDS.includes(r.kind as AudioKind) ? (r.kind as AudioKind) : "bgm";
  return { id: rid.startsWith("platform:") ? rid : `platform:${rid}`, name: String(r.name ?? rid), kind, src, loop: typeof r.loop === "boolean" ? r.loop : kind !== "sfx" };
}

/** 功能注释：从运营后台拉取上架曲目；失败或为空时保留内置兜底。重复调用共用一次请求，force 强制刷新 */
export function loadPlatformAudio(force = false): Promise<void> {
  if (loading && !force) return loading;
  const token = readFunloomAuthToken();
  const base = String(resolveFunloomApiBase() || "").replace(/\/$/, "");
  loading = fetch(`${base}/api/audio-library`, { headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const items: unknown[] = Array.isArray(j?.data) ? j.data : Array.isArray(j?.data?.items) ? j.data.items : [];
      const list = items.map(normalize).filter((x): x is PlatformAudio => !!x);
      if (!list.length) return;
      // 后台曲目在前；内置示例里后台没有的 id 保留，旧作品引用不失效
      PLATFORM_AUDIO = Object.freeze([...list, ...SEED.filter((s0) => !list.some((x) => x.id === s0.id))]);
      ver++;
      subs.forEach((f) => f());
    })
    .catch(() => { loading = null; });
  return loading;
}

/** 功能注释：组件里读平台曲库并在后台列表加载完成后重渲染 */
export function usePlatformAudio(): readonly PlatformAudio[] {
  useSyncExternalStore(subscribePlatformAudio, () => ver);
  return PLATFORM_AUDIO;
}

export function platformTrack(id?: string): PlatformAudio | undefined {
  if (!id) return undefined;
  return PLATFORM_AUDIO.find((t) => t.id === id);
}

/** 功能注释：注入全局音频库时不带 _mod，模组关闭或卸载后平台曲仍可播放 */
export function platformAudioAssets(): AudioAsset[] {
  return PLATFORM_AUDIO.map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    src: t.src,
    loop: t.loop ?? t.kind !== "sfx",
  }));
}

/** 功能注释：平台曲盖在库的最后，同 id 以平台地址为准，且不带 _mod */
export function overlayPlatformAudio(lib: Map<string, AudioAsset>): Map<string, AudioAsset> {
  for (const a of platformAudioAssets()) lib.set(a.id, a);
  return lib;
}
