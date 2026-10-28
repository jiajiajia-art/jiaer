/* 人物时间线：按游戏当前日期把条目分成 已发生 / 今天 / 近期（7 天内）/ 未来，供 AI 叙事与界面展示。
 * 未来条目不告诉 AI，避免提前剧透；自由文字日期（如「2003年」）一律视为过往经历。 */
import type { Npc, NpcTimelineEntry } from "../lib/types";
import { LIVE_PEOPLE } from "../mods/registry";
import { dayDateLabel } from "./logic";

export type TimelineStatus = "past" | "today" | "soon" | "future";
const DATE = /^(\d{4})\.(\d{2})\.(\d{2})$/;
export const isDated = (when: string) => DATE.test(when.trim());
const ms = (when: string) => { const m = DATE.exec(when.trim())!; return Date.UTC(+m[1], +m[2] - 1, +m[3]); };

export function statusOf(e: NpcTimelineEntry, today: string): TimelineStatus {
  if (!isDated(e.when)) return "past";
  const d = (ms(e.when) - ms(today)) / 86400000;
  return d < 0 ? "past" : d === 0 ? "today" : d <= 7 ? "soon" : "future";
}

/* 玩家在固定人物里写的时间线优先；没写则用模组作者预设 */
export const timelineOf = (n: Pick<Npc, "id" | "persona">): NpcTimelineEntry[] =>
  n.persona?.timeline ?? LIVE_PEOPLE.find((p) => p.id === n.id)?.timeline ?? [];

/* 日期条目按时间排序，自由文字条目保持书写顺序并排在最前 */
export const sortTimeline = (l: NpcTimelineEntry[]) =>
  [...l].sort((a, b) => (isDated(a.when) ? 1 : 0) - (isDated(b.when) ? 1 : 0) || (isDated(a.when) && isDated(b.when) ? ms(a.when) - ms(b.when) : 0));

/* 按当前日期分组（供 NPC 私有知识库与记忆面板）：过往经历全量、今天、近期；未来不返回 */
export function timelineBuckets(n: Pick<Npc, "id" | "persona">, day: number) {
  const list = sortTimeline(timelineOf(n)).filter((e) => e.text.trim());
  const today = dayDateLabel(day);
  const by = (s: TimelineStatus) => list.filter((e) => statusOf(e, today) === s);
  return { today, past: by("past"), now: by("today"), soon: by("soon"), future: by("future") };
}

export const line = (e: NpcTimelineEntry) => `${e.when}${e.place ? `@${e.place}` : ""} ${e.text}`;
/* AI 提示词片段（无可用条目时返回空串） */
export function timelinePrompt(n: Pick<Npc, "id" | "persona">, day: number): string {
  const list = sortTimeline(timelineOf(n)).filter((e) => e.text.trim());
  if (!list.length) return "";
  const today = dayDateLabel(day);
  const by = (s: TimelineStatus) => list.filter((e) => statusOf(e, today) === s);
  const out: string[] = [];
  const past = by("past").slice(-3); // 速览；完整经历在该 NPC 的私有知识库里
  if (past.length) out.push(`经历：${past.map(line).join("；")}`);
  const now = by("today");
  if (now.length) out.push(`今天（${today}）正在：${now.map(line).join("；")}（若与主角同场或被提及，须在叙事中体现）`);
  const soon = by("soon");
  if (soon.length) out.push(`近期安排：${soon.map(line).join("；")}（可作伏笔，未到日期不得写成已发生）`);
  return out.join("\n  · ");
}
