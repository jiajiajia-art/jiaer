/**
 * 功能注释：玩家 play=1 / 审核 reviewPreview=1 进局引导。
 * 拉取发布镜像或待审快照后，走作者预览同款运行时；存档键与作者预览隔离（F1）。
 */
import { useEffect, useState } from "react";
import { requestAuthorPreview, reportAuthorPreviewFatal } from "../lib/authorPreview";
import type { Mod } from "../mods/types";
import {
  fetchRomancePendingReviewContent,
  fetchRomancePublishedContent,
  resolveRomancePlayMode,
  type RomancePlayMode,
} from "../lib/platformRomancePlay";
import { applyPlatformThemeToMod, readWorldThemeHint } from "../lib/worldTheme";
import { fetchPlatformGameTheme } from "../lib/platformThemeTags";

function asMod(content: unknown): Mod | null {
  if (!content || typeof content !== "object") return null;
  const root = content as Record<string, unknown>;
  const mod = (root.mod && typeof root.mod === "object" ? root.mod : root) as Mod;
  if (!mod || typeof mod !== "object") return null;
  if (!(mod as { id?: string }).id && !(mod as { name?: string }).name) return null;
  return mod;
}

export default function PlayerPlayBootstrap({
  mode,
  fileId,
}: {
  mode: Exclude<RomancePlayMode, null>;
  fileId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
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
      // 功能注释：审核预览与玩家进局复用预览运行时；session 带 fileId 前缀防串档
      requestAuthorPreview(playMod, mode === "reviewPreview" ? ["审核预览 · 不写公开存档"] : [], 0);
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
  return null;
}

/** 功能注释：供 App 判断是否挂载进局引导 */
export function readPlayerPlayBoot(search = typeof location !== "undefined" ? location.search : "") {
  return resolveRomancePlayMode(search);
}
