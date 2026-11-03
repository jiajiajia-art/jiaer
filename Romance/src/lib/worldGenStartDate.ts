/**
 * 生成世界 ·「时间与推进」开局日期：把 AI 各种写法收成 YYYY.MM.DD；
 * 漏写时按题材 / 已有人物年龄推断，避免整项因缺 startDate 失败。
 */
import type { Mod } from "../mods/types.ts";
import { asTrimmedString } from "./asTrimmedString.ts";
import { formatStartDate, parseStartDateParts } from "./startDateFields.ts";
import { readScriptTone } from "./scriptTone.ts";

/** 功能注释：把 AI 常见日期写法（点/横杠/斜杠/中文年月日/纯年）收成 YYYY.MM.DD */
export function coerceWorldGenStartDate(raw: unknown): string {
  const s = asTrimmedString(raw);
  if (!s) return "";
  const dotted = formatStartDate(parseStartDateParts(s));
  if (dotted) return dotted;
  const cn = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (cn) {
    const formatted = formatStartDate({
      year: Number(cn[1]),
      month: Number(cn[2]),
      day: Number(cn[3]),
    });
    if (formatted) return formatted;
  }
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) {
    const formatted = formatStartDate({ year: Number(yearOnly[1]), month: 3, day: 15 });
    if (formatted) return formatted;
  }
  return "";
}

/**
 * 功能注释：从补丁顶层 / travel / calendar 抬出开局日期并规范化；非法则清空，交给 ensure 补全。
 */
export function normalizeWorldGenPatchStartDate(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  let sd = coerceWorldGenStartDate(out.startDate);
  if (!sd && out.travel && typeof out.travel === "object" && !Array.isArray(out.travel)) {
    const travel = { ...(out.travel as Record<string, unknown>) };
    sd = coerceWorldGenStartDate(travel.startDate);
    delete travel.startDate;
    out.travel = travel;
  }
  if (!sd && out.calendar && typeof out.calendar === "object" && !Array.isArray(out.calendar)) {
    sd = coerceWorldGenStartDate((out.calendar as { startDate?: unknown }).startDate);
  }
  if (sd) out.startDate = sd;
  else delete out.startDate;
  return out;
}

type DraftBits = { title?: string; setting?: string };

/** 功能注释：拼设定与已生成内容，供年份/时代关键词推断 */
function worldGenDateContextBlob(draft: DraftBits, mod?: Mod | null): string {
  const c = mod?.content ?? {};
  const tone =
    c.prompt && typeof c.prompt === "object" && !Array.isArray(c.prompt)
      ? readScriptTone(c.prompt as { scriptTone?: string })
      : "";
  return [draft.title, draft.setting, mod?.description, tone].map((x) => String(x ?? "").trim()).filter(Boolean).join("\n");
}

/** 功能注释：按故事题材与人物年龄推断开局日期，供 AI 漏写时兜底 */
export function inferWorldGenStartDate(draft: DraftBits, mod?: Mod | null): string {
  const blob = worldGenDateContextBlob(draft, mod);

  const full = blob.match(/\b(1[89]\d{2}|20\d{2}|21\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (full) {
    const formatted = formatStartDate({
      year: Number(full[1]),
      month: Number(full[2]),
      day: Number(full[3]),
    });
    if (formatted) return formatted;
  }
  const cn = blob.match(/(1[89]\d{2}|20\d{2}|21\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (cn) {
    const formatted = formatStartDate({
      year: Number(cn[1]),
      month: Number(cn[2]),
      day: Number(cn[3]),
    });
    if (formatted) return formatted;
  }

  const yearHits = [...blob.matchAll(/\b(1[89]\d{2}|20[0-2]\d)\b/g)].map((m) => Number(m[1]));
  let year: number | null = yearHits.length ? yearHits[yearHits.length - 1]! : null;

  if (year == null) {
    if (/民国|抗战|淞沪|伪满/.test(blob)) year = 1935;
    else if (/清末|晚清|光绪|宣统/.test(blob)) year = 1908;
    else if (/八十年代|1980\s*年代/.test(blob)) year = 1985;
    else if (/九十年代|1990\s*年代/.test(blob)) year = 1995;
    else if (/千禧|00后|零零后|2000\s*年/.test(blob)) year = 2005;
    else if (/古代|仙侠|修真|王朝|唐朝|宋朝|明朝|清朝/.test(blob)) year = 1800;
    else year = 2024;
  }

  // 功能注释：已有人物年龄时，避免开局年份与「当代成人」叙事明显打架（仅微调现代默认年）
  const ages = Array.isArray(mod?.content?.npcs)
    ? (mod!.content!.npcs as { age?: unknown }[])
        .map((n) => Number(n?.age))
        .filter((a) => Number.isFinite(a) && a >= 12 && a <= 90)
    : [];
  if (ages.length && year >= 2000) {
    const avg = ages.reduce((s, a) => s + a, 0) / ages.length;
    if (avg >= 16 && avg <= 28 && year > 2020) {
      /* 校园/青年向：保持近年 */
    } else if (avg >= 35 && year >= 2020) {
      year = Math.min(year, 2018);
    }
  }

  let month = 3;
  let day = 15;
  if (/开学|秋季|九月|金秋/.test(blob)) {
    month = 9;
    day = 1;
  } else if (/新年|春节|一月|寒假/.test(blob)) {
    month = 1;
    day = 8;
  } else if (/盛夏|七月|暑期/.test(blob)) {
    month = 7;
    day = 15;
  } else if (/圣诞|十二月|深冬/.test(blob)) {
    month = 12;
    day = 20;
  }

  return formatStartDate({ year, month, day }) || "2024.03.15";
}

/**
 * 功能注释：时间与推进补丁必须带合法 startDate；AI 已写则规范化，漏写则按题材推断写入。
 */
export function ensureWorldGenTravelTimeStartDate(
  patch: Record<string, unknown>,
  draft: DraftBits,
  mod?: Mod | null,
): Record<string, unknown> {
  const normalized = normalizeWorldGenPatchStartDate(patch);
  const existing = coerceWorldGenStartDate(normalized.startDate);
  if (existing) return { ...normalized, startDate: existing };
  return { ...normalized, startDate: inferWorldGenStartDate(draft, mod) };
}
