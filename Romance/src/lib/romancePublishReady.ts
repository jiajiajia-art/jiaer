/**
 * 功能注释：Romance「提交发布审核」前门禁，与后端 /api/auth/games/publish 校验对齐。
 * 预览仍用 authorPreview（可不拦封面/题材）；发布必须有封面 + 平台题材，否则会 400。
 */
import type { Mod } from "../mods/types.ts";
import { assessAuthorRequiredFields, type AuthorRequiredIssue } from "./authorPreview.ts";
import { resolveRomanceDraftCoverUrl } from "./platformRomanceDraft.ts";

export type RomancePublishReadyField =
  | AuthorRequiredIssue["field"]
  | "cover"
  | "themeTag";

export type RomancePublishReadyIssue = {
  field: RomancePublishReadyField;
  label: string;
  group: "base" | "grow" | "look";
  target: string;
};

/**
 * 功能注释：发布就绪清单 = 作者必填 + 作品封面 + 平台题材。
 * 输入 mod；输出缺口列表（空表示可打开提交审核弹窗）。
 */
export function assessRomancePublishReady(mod: Mod | null | undefined): RomancePublishReadyIssue[] {
  if (!mod || typeof mod !== "object" || mod.kind === "addon") return [];
  const issues: RomancePublishReadyIssue[] = assessAuthorRequiredFields(mod).map((issue) => ({ ...issue }));
  const coverUrl = resolveRomanceDraftCoverUrl(mod);
  if (!coverUrl) {
    issues.push({
      field: "cover",
      label: "作品封面（发布需要横竖封面，保存后会同步到平台）",
      group: "base",
      target: "author-field-cover",
    });
  }
  const themeTagId = mod.themeTagId;
  if (!(typeof themeTagId === "number" && Number.isFinite(themeTagId) && themeTagId > 0)) {
    issues.push({
      field: "themeTag",
      label: "作品题材",
      group: "base",
      target: "author-field-theme",
    });
  }
  return issues;
}

/** 功能注释：把发布缺口写成短文案，便于 Toast / 门禁弹窗展示。 */
export function romancePublishReadyLabels(mod: Mod | null | undefined): string[] {
  return assessRomancePublishReady(mod).map((issue) => issue.label);
}

/**
 * 功能注释：识别「缺封面」类提交失败文案（含后端 games:err_missing_cover）。
 * 用于错误弹窗是否露出「去上传封面」跳转。
 */
export function isPublishCoverError(message: string | null | undefined): boolean {
  const text = String(message || "").trim();
  if (!text) return false;
  return /封面|cover/i.test(text);
}
