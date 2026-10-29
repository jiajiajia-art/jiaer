/* 平台公共曲库：内置在客户端，维护方式同平台公共头像分类。
 * 作者在模组编辑器里只能选和试听，不能上传、改名或删除原曲。本次不做运营后台。
 * 文件放在平台地址上，不打进模组，也不复制进作品音频库。id 一律 platform: 前缀。 */
import type { AudioAsset, AudioKind } from "../lib/types";

export type PlatformAudio = {
  id: string;
  name: string;
  kind: AudioKind;
  src: string;
  loop?: boolean;
};

const CC0 = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

/** 功能注释：上下架只改这一份表；客户端没有的 id 在模组里标失效，不让存档打不开 */
export const PLATFORM_AUDIO: readonly PlatformAudio[] = Object.freeze([
  { id: "platform:cc0-bed", name: "短循环示例", kind: "bgm", src: CC0, loop: true },
  { id: "platform:cc0-roar", name: "恐龙吼声", kind: "sfx", src: CC0, loop: false },
  { id: "platform:cc0-air", name: "短氛围示例", kind: "amb", src: CC0, loop: true },
]);

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
