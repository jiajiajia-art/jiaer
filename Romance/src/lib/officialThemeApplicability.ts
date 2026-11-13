/**
 * 功能注释：官方玩法包 / 官方手机应用的适用题材语义种子（C0.3）。
 * 前台「添加玩法」与应用商店读此表；运营后台可改绑后以前台读到的后台值为准。
 * 语义 code 由题材 API 解析成 id；匹配不到时打日志，禁止静默空数组上线。
 */

export type ThemeApplicabilityCode = "universal" | "modern" | "ancient";

/** 功能注释：官方玩法默认适用题材（语义 code，可多选） */
export const OFFICIAL_PLAY_MOD_THEME_CODES: Readonly<Record<string, readonly ThemeApplicabilityCode[]>> = Object.freeze({
  "pack-relations": ["universal"],
  "pack-faction-rep": ["universal"],
  "pack-pregnancy": ["universal"],
  "pack-transport": ["universal"],
  "pack-titles": ["universal"],
  "pack-career": ["modern"],
  "pack-image": ["modern"],
  "pack-paper": ["modern"],
  "pack-cars": ["modern"],
  "pack-living": ["modern"],
});

/** 功能注释：官方应用默认适用题材 */
export const OFFICIAL_PLATFORM_APP_THEME_CODES: Readonly<Record<string, readonly ThemeApplicabilityCode[]>> = Object.freeze({
  wechat: ["modern"],
  sms: ["modern"],
  call: ["modern"],
  weibo: ["modern"],
  xhs: ["modern"],
  video: ["modern"],
  cloudmusic: ["modern"],
  bosspin: ["modern"],
  mail: ["universal"],
  read: ["universal"],
  ticket: ["universal"],
});

/** 功能注释：题材名 / code → 语义桶，用于把后台题材树映射到种子 */
export function classifyThemeTagLabel(labelOrCode: string): ThemeApplicabilityCode | null {
  const t = String(labelOrCode || "").trim().toLowerCase();
  if (!t) return null;
  if (/现代|都市|娱乐|当代|modern|urban/.test(t)) return "modern";
  if (/古代|仙侠|宫斗|玄幻|武侠|ancient|xianxia|historical/.test(t)) return "ancient";
  if (/通用|全题材|universal|all/.test(t)) return "universal";
  return null;
}

/**
 * 功能注释：把语义 code 解析成题材 id 列表。
 * universal → 全部启用题材；modern/ancient → 分类匹配到的 id。
 * 解析结果为空时返回 null，调用方须打日志且不得当空数组上线。
 */
export function resolveApplicableThemeTagIds(
  codes: readonly ThemeApplicabilityCode[],
  enabledTags: Array<{ id: number; name?: string; code?: string }>,
): number[] | null {
  if (!codes.length) return null;
  const enabled = enabledTags.filter((t) => Number.isFinite(t.id));
  if (!enabled.length) return null;

  const want = new Set(codes);
  if (want.has("universal")) {
    return enabled.map((t) => t.id);
  }

  const ids = enabled
    .filter((t) => {
      const bucket = classifyThemeTagLabel(t.code || "") || classifyThemeTagLabel(t.name || "");
      return bucket != null && want.has(bucket);
    })
    .map((t) => t.id);

  return ids.length ? [...new Set(ids)] : null;
}

/**
 * 功能注释：计算最终生效的适用题材 id —— 后台（接口）返回非空 id 时一律以后台为准（运营改绑覆盖种子）；
 * 接口无值时才用语义种子解析；种子也解析不出则返回 null，调用方须打日志不得当空数组上线。
 */
export function resolveEffectiveApplicableThemeTagIds(
  apiThemeTagIds: readonly number[] | null | undefined,
  seedCodes: readonly ThemeApplicabilityCode[],
  enabledTags: Array<{ id: number; name?: string; code?: string }>,
): number[] | null {
  const fromApi = Array.isArray(apiThemeTagIds)
    ? [...new Set(apiThemeTagIds.filter((n) => Number.isInteger(n) && n > 0))]
    : [];
  if (fromApi.length) return fromApi;
  return resolveApplicableThemeTagIds(seedCodes, enabledTags);
}

/** 功能注释：世界主题材是否落在适用列表；空适用列表视为未知（不警告） */
export function shouldWarnThemeMismatch(
  worldThemeTagId: number | null | undefined,
  applicableThemeTagIds: number[] | null | undefined,
): boolean {
  if (worldThemeTagId == null || !Number.isFinite(worldThemeTagId)) return false;
  if (!applicableThemeTagIds || !applicableThemeTagIds.length) return false;
  return !applicableThemeTagIds.includes(worldThemeTagId);
}

/** 功能注释：安装前提示所需的「当前世界题材」上下文；id 优先，缺 id 时退回名称 / code 语义桶 */
export type WorldThemeContext = {
  worldThemeTagId?: number | null;
  worldThemeLabel?: string | null;
  worldThemeCode?: string | null;
  /** 后台启用题材列表：用于把语义 code 解析成 id（有 id 才走精确比对） */
  enabledThemeTags?: Array<{ id: number; name?: string; code?: string }> | null;
};

/** 功能注释：安装提示的统一文案（警告不拦截） */
export const THEME_MISMATCH_INSTALL_WARN = "当前世界题材与该玩法标注的适用题材不一致，仍可安装";

/**
 * 功能注释：世界题材与某玩法 / 应用标注的适用题材是否不一致（C0.2，只用于提示，不阻断安装）。
 * 1) 世界 id 与适用 id 列表都有 → 精确比对；
 * 2) 否则用语义桶：世界题材名 / code → modern|ancient，适用 code 含 universal 或该桶则不冲突；
 * 3) 任何一侧未知（无世界题材、无适用标注、世界题材归不进桶）→ 视为不冲突，宁可漏提示也不误报。
 */
export function isThemeMismatch(input: {
  worldThemeTagId?: number | null;
  applicableThemeTagIds?: number[] | null;
  worldThemeLabel?: string | null;
  worldThemeCode?: string | null;
  applicableThemeCodes?: readonly ThemeApplicabilityCode[] | null;
}): boolean {
  const ids = input.applicableThemeTagIds;
  if (input.worldThemeTagId != null && Number.isFinite(input.worldThemeTagId) && ids && ids.length) {
    return shouldWarnThemeMismatch(input.worldThemeTagId, ids);
  }
  const codes = input.applicableThemeCodes;
  if (!codes || !codes.length || codes.includes("universal")) return false;
  const bucket = classifyThemeTagLabel(input.worldThemeCode || "") || classifyThemeTagLabel(input.worldThemeLabel || "");
  if (!bucket || bucket === "universal") return false;
  return !codes.includes(bucket);
}

/**
 * 功能注释：对单个玩法 / 应用条目判断是否与当前世界题材冲突。
 * 条目自带已解析的 applicableThemeTagIds 优先；否则用启用题材表把语义 code 解析成 id，解析不出再走语义桶。
 */
export function isItemThemeMismatch(
  item: { applicableThemeCodes?: readonly ThemeApplicabilityCode[] | null; applicableThemeTagIds?: number[] | null },
  world: WorldThemeContext,
): boolean {
  let ids = item.applicableThemeTagIds ?? null;
  if ((!ids || !ids.length) && item.applicableThemeCodes?.length && world.enabledThemeTags?.length) {
    ids = resolveApplicableThemeTagIds(item.applicableThemeCodes, world.enabledThemeTags);
  }
  return isThemeMismatch({
    worldThemeTagId: world.worldThemeTagId,
    applicableThemeTagIds: ids,
    worldThemeLabel: world.worldThemeLabel,
    worldThemeCode: world.worldThemeCode,
    applicableThemeCodes: item.applicableThemeCodes,
  });
}
