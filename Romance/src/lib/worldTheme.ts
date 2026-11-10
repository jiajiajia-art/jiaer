/**
 * 功能注释：读取「当前世界题材」的唯一入口。
 * 题材来源是世界 Mod 清单上的可选字段（themeTagId / themeLabel / themeCode / commsSkin），
 * 由宿主或发布流程写入；编辑器的安装提示（C0.2）与局内通讯换皮（P4.1）共用，避免各读一遍。
 */
import { resolveCommsBrand, type CommsBrand } from "./commsSkin.ts";

export type WorldThemeHint = {
  themeTagId: number | null;
  themeLabel: string;
  themeCode: string;
  commsSkin: string;
};

type ThemeCarrier = {
  kind?: string;
  name?: string;
  themeTagId?: number | null;
  themeLabel?: string;
  themeCode?: string;
  commsSkin?: string;
} | null | undefined;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * 功能注释：从 Mod 清单（单个或合并链 world→addons）读题材；链上后者覆盖前者的非空字段。
 * 不用 name 猜题材：名字里带「古代」不等于题材，只有显式字段才算（通讯换皮另有 name 兜底）。
 */
export function readWorldThemeHint(source: ThemeCarrier | ThemeCarrier[]): WorldThemeHint {
  const list = Array.isArray(source) ? source : [source];
  const out: WorldThemeHint = { themeTagId: null, themeLabel: "", themeCode: "", commsSkin: "" };
  for (const m of list) {
    if (!m) continue;
    if (typeof m.themeTagId === "number" && Number.isFinite(m.themeTagId)) out.themeTagId = m.themeTagId;
    if (str(m.themeLabel)) out.themeLabel = str(m.themeLabel);
    if (str(m.themeCode)) out.themeCode = str(m.themeCode);
    if (str(m.commsSkin)) out.commsSkin = str(m.commsSkin);
  }
  return out;
}

/**
 * 功能注释：局内通讯品牌（绿信 / 传讯）。
 * 优先显式 commsSkin，其次题材 code / 名称；都没有时用世界 Mod 名兜底（旧作品没写题材字段时仍能识别「古代 / 仙侠」世界）。
 */
export function resolveWorldCommsBrand(chain: ThemeCarrier[] | null | undefined): CommsBrand {
  const hint = readWorldThemeHint(chain ?? []);
  const worldName = (chain ?? []).find((m) => m?.kind === "world")?.name ?? "";
  return resolveCommsBrand({
    override: hint.commsSkin,
    themeCode: hint.themeCode,
    themeLabel: hint.themeLabel || (hint.themeCode ? "" : str(worldName)),
  });
}

/** 功能注释：平台作品详情上的题材（theme_tag_ids / theme_tag_names，可选 codes）；用于补进 Mod 清单。 */
export type PlatformThemeInput = {
  themeTagIds?: readonly number[] | null;
  themeTagNames?: readonly string[] | null;
  themeTagCodes?: readonly string[] | null;
};

/**
 * 功能注释：把平台作品题材合并进世界 Mod 清单——只补缺，不覆盖创作者已写的 themeTagId / themeLabel / themeCode。
 * 取平台第 1 个题材（id / 名称 / code 按下标对齐）；平台无题材或清单已齐全时原样返回同一引用，便于调用方判断是否有变化。
 */
export function applyPlatformThemeToMod<T extends NonNullable<ThemeCarrier>>(mod: T, platform: PlatformThemeInput | null | undefined): T {
  if (!mod || !platform) return mod;
  const ids = (platform.themeTagIds ?? []).filter((n) => typeof n === "number" && Number.isFinite(n));
  const names = (platform.themeTagNames ?? []).map((s) => str(s));
  const codes = (platform.themeTagCodes ?? []).map((s) => str(s));
  if (!ids.length && !names.some(Boolean)) return mod;
  const patch: Partial<WorldThemeFieldsPatch> = {};
  const hasId = typeof mod.themeTagId === "number" && Number.isFinite(mod.themeTagId);
  if (!hasId && ids.length) patch.themeTagId = ids[0];
  if (!str(mod.themeLabel) && names[0]) patch.themeLabel = names[0];
  if (!str(mod.themeCode) && codes[0]) patch.themeCode = codes[0];
  return Object.keys(patch).length ? ({ ...mod, ...patch } as T) : mod;
}

/** 功能注释：编辑器可写的题材字段（commsSkin 为空 = 自动按题材判断）。 */
export type WorldThemeFieldsPatch = {
  themeTagId: number | null | undefined;
  themeLabel: string | undefined;
  themeCode: string | undefined;
  commsSkin: string | undefined;
};

/** 功能注释：通讯皮肤下拉可选值；其它值一律当「自动」。 */
export const COMMS_SKIN_OPTIONS = [
  { value: "", label: "自动（按题材）" },
  { value: "modern", label: "现代绿信" },
  { value: "letter", label: "古代传讯" },
] as const;

/**
 * 功能注释：编辑器写题材字段的唯一入口——空串 / 非法值落成 undefined（清单里不留空字段，旧作保存不产生噪音）；
 * commsSkin 只接受 modern | letter；themeTagId 只接受有限正数。
 */
export function patchWorldTheme<T extends NonNullable<ThemeCarrier>>(mod: T, patch: Partial<WorldThemeFieldsPatch>): T {
  const next: T = { ...mod };
  if ("themeLabel" in patch) next.themeLabel = str(patch.themeLabel) || undefined;
  if ("themeCode" in patch) next.themeCode = str(patch.themeCode) || undefined;
  if ("commsSkin" in patch) {
    const v = str(patch.commsSkin).toLowerCase();
    next.commsSkin = v === "modern" || v === "letter" ? v : undefined;
  }
  if ("themeTagId" in patch) {
    const n = patch.themeTagId;
    next.themeTagId = typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return next;
}
