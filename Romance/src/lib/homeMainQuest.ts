/* 首页「主线」卡：只读创作者配的 storylines，不用引擎推的排日程/通告/推进日子。 */
import type { FixedCond, QuestState, Storyline } from "./types";

export type HomeMainQuest = {
  lineId: string;
  lineName: string;
  /** 当前这一步要做什么（节点名） */
  stepName: string;
  /** 节点说明，可空 */
  stepDesc?: string;
  /** 等到时间文案；没有就不显示第二行 */
  waitLabel?: string;
};

type QuestSrc = { flags?: Record<string, number>; clockMin?: number; day?: number };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const qFlag = (s: QuestSrc, id: string) => s.flags?.[`quest:${id}`] ?? 0;

/** 功能注释：与 fixedEvents.nodeState 同口径，本地实现以免单测拖入 registry */
function nodeState(line: Storyline, idx: number, s: QuestSrc): QuestState {
  const f = qFlag(s, line.nodes[idx].id);
  if (f > 0) return "done";
  if (f < 0) return "failed";
  if (qFlag(s, line.id) !== 0) return "pending";
  return line.nodes.slice(0, idx).every((n) => n.optional || qFlag(s, n.id) > 0) ? "active" : "pending";
}

/** 功能注释：把「14:00」收成「下午两点」一类口语句，给首页第二行用 */
export function friendlyClockLabel(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm.trim();
  const h = Number(m[1]) % 24;
  const min = Number(m[2]);
  const period = h < 6 ? "凌晨" : h < 11 ? "上午" : h < 13 ? "中午" : h < 18 ? "下午" : h < 23 ? "晚上" : "深夜";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const cn = ["零", "一", "两", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
  const hourWord = cn[h12] ?? String(h12);
  if (min === 0) return `${period}${hourWord}点`;
  if (min === 30) return `${period}${hourWord}点半`;
  return `${period}${hourWord}点${min}分`;
}

function clockMins(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m || Number(m[2]) >= 60) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function inClock(min: number, from: string, to: string): boolean {
  const a = clockMins(from), b = clockMins(to);
  if (a == null || b == null) return true;
  return a <= b ? min >= a && min <= b : min >= a || min <= b;
}

/** 功能注释：当前步若还没进 clock / date 窗口，给出「等到…」；已满足则不写，避免空行 */
export function waitLabelFromConds(conds: FixedCond[] | undefined, s: QuestSrc, todayYmd?: string): string | undefined {
  if (!conds?.length) return undefined;
  const now = s.clockMin ?? 0;
  for (const c of conds) {
    if (c.kind === "clock") {
      if (!inClock(now, c.from, c.to)) {
        const from = clockMins(c.from);
        if (from != null && now < from) return `等到${friendlyClockLabel(c.from)}`;
        // 跨午夜窗口：当前在窗口外且未到 from
        if (from != null) return `等到${friendlyClockLabel(c.from)}`;
      }
    }
    if (c.kind === "date" && c.op === "gte" && /^\d{4}\.\d{2}\.\d{2}$/.test(c.date) && todayYmd && todayYmd < c.date) {
      return `等到 ${c.date}`;
    }
  }
  return undefined;
}

function activeNode(line: Storyline, s: QuestSrc) {
  if (line.enabled === false || !line.nodes?.length) return null;
  if (qFlag(s, line.id) !== 0) return null;
  for (let i = 0; i < line.nodes.length; i++) {
    if (nodeState(line, i, s) === "active") return line.nodes[i];
  }
  return null;
}

/**
 * 功能注释：首页主线卡数据。创作者没配主线 → null（整块不出现）。
 * 配了则取第一条仍在进行的主线的当前节点；等待时间有则附带，没有就不带第二行。
 */
export function homeMainQuest(s: QuestSrc, lines: Storyline[] | undefined, todayYmd?: string): HomeMainQuest | null {
  const list = (lines ?? []).filter((l) => l.enabled !== false && l.nodes?.length);
  if (!list.length) return null;
  for (const line of list) {
    const node = activeNode(line, s);
    if (!node) continue;
    const stepName = str(node.name) || str(line.name) || "主线";
    const stepDesc = str(node.desc) || undefined;
    const waitLabel = waitLabelFromConds(node.conds, s, todayYmd);
    return {
      lineId: line.id,
      lineName: str(line.name) || "主线",
      stepName,
      stepDesc,
      waitLabel,
    };
  }
  return null;
}
