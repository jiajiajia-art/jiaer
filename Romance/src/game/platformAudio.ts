/* 平台公共曲库：优先读运营 `/api/audio-library` 上架项；失败或为空时退回内置示例。
 * 作者在模组编辑器里只能选和试听；id 一律 platform: 前缀（接口 id 已带此前缀则原样使用）。 */
import type { AudioAsset, AudioKind } from "../lib/types";
import { resolveFunloomApiBase } from "../lib/platformAvatarLibrary";

export type PlatformAudio = {
  id: string;
  name: string;
  kind: AudioKind;
  src: string;
  loop?: boolean;
};

const CC0 = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

/** 功能注释：内置兜底；接口不可用时编辑器仍可演示平台曲引用 */
export const PLATFORM_AUDIO_FALLBACK: readonly PlatformAudio[] = Object.freeze([
  { id: "platform:cc0-bed", name: "短循环示例", kind: "bgm", src: CC0, loop: true },
  { id: "platform:cc0-roar", name: "恐龙吼声", kind: "sfx", src: CC0, loop: false },
  { id: "platform:cc0-air", name: "短氛围示例", kind: "amb", src: CC0, loop: true },
]);

/** @deprecated 兼容旧引用；运行时以 getPlatformAudioList() 为准 */
export const PLATFORM_AUDIO = PLATFORM_AUDIO_FALLBACK;

let cached: PlatformAudio[] | null = null;
let inflight: Promise<PlatformAudio[]> | null = null;

function normalizeKind(raw: unknown): AudioKind {
  const k = String(raw || "").toLowerCase();
  if (k === "sfx" || k === "amb") return k;
  return "bgm";
}

function withPlatformPrefix(id: string): string {
  const s = String(id || "").trim();
  if (!s) return "";
  return s.startsWith("platform:") ? s : `platform:${s}`;
}

function mapApiItem(raw: Record<string, unknown>): PlatformAudio | null {
  const id = withPlatformPrefix(String(raw.id || ""));
  const src = String(raw.audioUrl || raw.audio_url || raw.src || "").trim();
  const name = String(raw.name || "").trim();
  if (!id || !src || !name) return null;
  const kind = normalizeKind(raw.kind);
  const loop =
    raw.loop === undefined || raw.loop === null
      ? kind !== "sfx"
      : Boolean(raw.loop);
  return { id, name, kind, src, loop };
}

/** 功能注释：拉运营上架曲目；失败退回内置，避免编辑器空白 */
export async function loadPlatformAudioFromApi(force = false): Promise<PlatformAudio[]> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const url = `${resolveFunloomApiBase()}/api/audio-library`;
      const res = await fetch(url, { credentials: "include" });
      const json = await res.json().catch(() => null);
      const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      const mapped = list
        .map((row: unknown) => (row && typeof row === "object" ? mapApiItem(row as Record<string, unknown>) : null))
        .filter(Boolean) as PlatformAudio[];
      cached = mapped.length ? mapped : [...PLATFORM_AUDIO_FALLBACK];
    } catch {
      cached = [...PLATFORM_AUDIO_FALLBACK];
    } finally {
      inflight = null;
    }
    return cached!;
  })();
  return inflight;
}

export function getPlatformAudioList(): readonly PlatformAudio[] {
  return cached ?? PLATFORM_AUDIO_FALLBACK;
}

export function platformTrack(id?: string): PlatformAudio | undefined {
  if (!id) return undefined;
  return getPlatformAudioList().find((t) => t.id === id);
}

/** 功能注释：注入全局音频库时不带 _mod，模组关闭或卸载后平台曲仍可播放 */
export function platformAudioAssets(): AudioAsset[] {
  return getPlatformAudioList().map((t) => ({
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

// 功能注释：模块加载时预拉一次，失败静默用内置
void loadPlatformAudioFromApi();
