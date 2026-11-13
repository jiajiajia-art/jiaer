/**
 * 平台画风库（/api/art-style-library）：运营在「素材中心 · 画风管理」配置；编辑器只读上架项。
 * 接口未上线 / 未登录 / 为空时回落内置 ART_STYLE_PRESETS。
 */
import { useEffect, useState } from "react";
import { readFunloomAuthToken, resolveFunloomApiBase, resolvePlatformAvatarUrl } from "./platformAvatarLibrary";
import { ART_STYLE_PRESETS, getActiveArtStylePresets, setActiveArtStylePresets, type ArtStylePreset } from "./editorImagePrompts";

type Row = { key?: string; id?: string; name?: string; prompt?: string; negative?: string; swatch?: string; sampleUrl?: string; sortOrder?: number; status?: string };

let inflight: Promise<ReadonlyArray<ArtStylePreset>> | null = null;

export function loadPlatformArtStyles(): Promise<ReadonlyArray<ArtStylePreset>> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const token = readFunloomAuthToken();
      const res = await fetch(`${resolveFunloomApiBase()}/api/art-style-library`, {
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: Row[] } | null;
      if (!res.ok || !json?.success || !Array.isArray(json.data)) return ART_STYLE_PRESETS;
      const list = json.data
        .filter((x) => x && String(x.status || "active") !== "disabled" && String(x.prompt || "").trim() && String(x.name || "").trim())
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((x): ArtStylePreset => ({
          id: String(x.key || x.id),
          label: String(x.name).trim(),
          prompt: String(x.prompt).trim(),
          negative: String(x.negative || "").trim(),
          swatch: String(x.swatch || "").trim() || "linear-gradient(135deg,#3a2a40,#1d1a20)",
          sampleUrl: x.sampleUrl ? resolvePlatformAvatarUrl(x.sampleUrl) : undefined,
        }));
      setActiveArtStylePresets(list);
      return getActiveArtStylePresets();
    } catch {
      return ART_STYLE_PRESETS;
    }
  })();
  return inflight;
}

/** 功能注释：画风列表 hook——先给当前生效列表，后台加载完再刷新 */
export function useArtStylePresets(): ReadonlyArray<ArtStylePreset> {
  const [list, setList] = useState(getActiveArtStylePresets);
  useEffect(() => {
    let alive = true;
    void loadPlatformArtStyles().then((l) => { if (alive) setList(l); });
    return () => { alive = false; };
  }, []);
  return list;
}
