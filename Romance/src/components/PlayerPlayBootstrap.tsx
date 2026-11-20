/**
 * 功能注释：玩家 play=1 / 审核 reviewPreview=1 进局引导。
 * play=1：正式局（requestPlatformPlay，无 STUDIO 壳，用 fileId 正式存档）。
 * reviewPreview=1：仍走作者预览隔离运行时（不写公开档）。
 */
import { useEffect, useState, type ReactNode } from "react";
import { requestAuthorPreview, reportAuthorPreviewFatal } from "../lib/authorPreview";
import { requestPlatformPlay } from "../lib/platformPlay";
import type { Mod } from "../mods/types";
import {
  fetchRomancePendingReviewContent,
  fetchRomancePublishedContent,
  resolveRomancePlayMode,
  type RomancePlayMode,
} from "../lib/platformRomancePlay";
import { applyPlatformThemeToMod, readWorldThemeHint } from "../lib/worldTheme";
import { fetchPlatformGameTheme } from "../lib/platformThemeTags";
import { setStorageGameFileId } from "../lib/storage";

function asMod(content: unknown): Mod | null {
  if (!content || typeof content !== "object") return null;
  const root = content as Record<string, unknown>;
  const mod = (root.mod && typeof root.mod === "object" ? root.mod : root) as Mod;
  if (!mod || typeof mod !== "object") return null;
  if (!(mod as { id?: string }).id && !(mod as { name?: string }).name) return null;
  return mod;
}

function returnToPublishQueue() {
  const base = window.location.pathname.replace(/\/romance(?:\/.*)?$/, "");
  window.location.replace(`${base}/operator/publish-queue`);
}

export default function PlayerPlayBootstrap({
  mode,
  fileId,
  children,
}: {
  mode: Exclude<RomancePlayMode, null>;
  fileId: string;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // 功能注释：进局先绑定本地存档命名空间，避免与其它作品槽位串档
    setStorageGameFileId(fileId);
    void (async () => {
      setLoading(true);
      setError(null);
      const result =
        mode === "reviewPreview"
          ? await fetchRomancePendingReviewContent(fileId)
          : await fetchRomancePublishedContent(fileId);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        reportAuthorPreviewFatal([result.error]);
        return;
      }
      const mod = asMod(result.content);
      if (!mod) {
        const msg = "内容包缺少可用模组字段";
        setError(msg);
        setLoading(false);
        reportAuthorPreviewFatal([msg]);
        return;
      }
      // 功能注释：清单没写题材时，用平台作品题材补上（通讯换皮 / 玩法适用题材）；只补缺，失败不阻断进局
      let playMod = mod;
      const hint = readWorldThemeHint(mod);
      if (hint.themeTagId == null || !hint.themeLabel) {
        const theme = await fetchPlatformGameTheme(fileId);
        if (cancelled) return;
        playMod = applyPlatformThemeToMod(mod, theme);
      }
      if (mode === "reviewPreview") {
        // 功能注释：审核预览继续隔离测试存档，不写玩家公开进度
        requestAuthorPreview(playMod, [], 0, returnToPublishQueue);
      } else {
        // 功能注释：过审正式游玩禁止挂 STUDIO PREVIEW；存档走 setStorageGameFileId(fileId)
        const boot = requestPlatformPlay(playMod);
        if (!boot.ok) {
          const msg = boot.errors.join("；") || "无法启动正式游玩";
          setError(msg);
          setLoading(false);
          reportAuthorPreviewFatal([msg]);
          return;
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, fileId]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
        <h2 className="text-lg font-bold text-ink">{mode === "reviewPreview" ? "无法打开审核预览" : "无法开始体验"}</h2>
        <p className="max-w-md text-sm text-ink-soft">{error}</p>
        {mode === "reviewPreview" && (
          <button type="button" className="ui-btn" onClick={returnToPublishQueue}>返回审核列表</button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink-soft" role="status">
        {mode === "reviewPreview" ? "正在加载待审快照…" : "正在加载已发布内容…"}
      </div>
    );
  }
  return mode === "play" ? <>{children}</> : null;
}

/** 功能注释：供 App 判断是否挂载进局引导 */
export function readPlayerPlayBoot(search = typeof location !== "undefined" ? location.search : "") {
  return resolveRomancePlayMode(search);
}
