/**
 * 功能注释：平台正式进局（play=1）。激活发布模组叠加层，但不进入作者预览 session，
 * 避免 STUDIO PREVIEW / 独立测试存档；本地与云存档走 fileId 正式槽。
 */
import { beginAuthorPreviewMod } from "../mods/registry";
import type { Mod } from "../mods/types";

export const PLATFORM_PLAY_START = "star:platform-play-start";

/**
 * 功能注释：正式局启动。成功后派发 PLATFORM_PLAY_START，供 GameContext 切到建角页（不清档）。
 */
export function requestPlatformPlay(mod: Mod): { ok: true } | { ok: false; errors: string[] } {
  const boot = beginAuthorPreviewMod(mod);
  if (!boot.ok) return boot;
  try {
    window.dispatchEvent(
      new CustomEvent(PLATFORM_PLAY_START, {
        detail: { mod: structuredClone(mod), startedAt: Date.now() },
      }),
    );
  } catch {
    /* ignore */
  }
  return { ok: true };
}
