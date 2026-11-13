import type { ChatMsg } from "./ai";
import type { Diary, WeekReport } from "../store/gameCtx";

/**
 * 功能注释：日记本 · 周记（AI 驱动）。
 * 周属性总结由代码结算展示；这里只负责把本周真实数据（日程、数值起止、收支、纪事、预警、主线、剧情记忆）
 * 交给模型，以主角第一人称写约 800 字周记；禁止编造数据里没有的数值或事件。
 */
export type WeekDiaryText = { title: string; text: string };

export type WeekReviewInput = {
  worldName: string;
  scriptTone?: string;
  playerName: string;
  playerIdentity?: string;
  report: WeekReport;
  diary?: Diary;
  changes: string[];
  bill?: { lines: { label: string; amount: number }[]; total: number } | null;
  earned?: number;
  money: (n: number) => string;
  goal?: { lineName: string; stepName: string; stepDesc?: string; done: number; total: number } | null;
  daysLeft?: number;
  /** 功能注释：压缩后的主线剧情记忆，让周记接得上前情 */
  memory?: string;
  /** 功能注释：上一篇周记结尾，保持语气与叙事连贯 */
  prevTail?: string;
  /** 功能注释：要写人物周记的人物——各自的近况心情、自己经历的事、与主角的往来（可空） */
  npcs?: { name: string; identity?: string; mood?: string; self: string[]; withPlayer: string[] }[];
};

/** 功能注释：周记正文之后的人物周记忆分隔标记；其下每行「姓名：一句话」 */
export const NPC_WEEK_MARK = "【人物周记】";
export type NpcWeekMemory = { name: string; text: string };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function buildWeekDiaryMessages(i: WeekReviewInput): ChatMsg[] {
  const r = i.report;
  const span = r.weekTo ? `第 ${r.week}～${r.weekTo} 周` : `第 ${r.week} 周`;
  const lines: string[] = [
    `作品：${i.worldName}`,
    i.scriptTone ? `剧本基调：${clip(i.scriptTone, 300)}` : "",
    `主角：${i.playerName}${i.playerIdentity ? `（${i.playerIdentity}）` : ""}`,
    `时段：${span}${i.diary ? ` · ${i.diary.date} · ${i.diary.season}` : ""}${i.daysLeft != null ? ` · 距本局结算还剩 ${i.daysLeft} 天` : ""}`,
    r.act ? `本段主要安排：${r.act}${r.grade ? `（表现：${r.grade}）` : ""}` : "",
    i.diary?.sources.length ? `日程与收获：${i.diary.sources.join("；")}` : r.gains.length ? `收获：${r.gains.join("；")}` : "",
    i.diary?.rows.length
      ? `数值起止：${i.diary.rows.map((x) => `${x.label} ${x.from}→${x.to}`).join("；")}`
      : i.changes.length ? `数值变化：${i.changes.join("；")}` : "数值：本段没有变化",
    i.bill ? `收支：进账 ${i.money(i.earned ?? 0)}；支出 ${i.bill.lines.map((l) => `${l.label} ${i.money(l.amount)}`).join("、") || "无"}；合计 ${i.money((i.earned ?? 0) - i.bill.total)}` : "",
    r.events.length ? `纪事：\n${r.events.slice(-12).map((e) => `- [${e.tag}] ${clip(e.text, 120)}`).join("\n")}` : "纪事：无",
    r.warnings.length ? `预警：${r.warnings.join("；")}` : "",
    r.settle.length ? `结算备注：${r.settle.join("；")}` : "",
    i.goal ? `当前主线：${i.goal.lineName}（${i.goal.done}/${i.goal.total}），下一步「${i.goal.stepName}」${i.goal.stepDesc ? `：${clip(i.goal.stepDesc, 120)}` : ""}` : "当前没有进行中的主线",
    i.memory ? `前情记忆：${clip(i.memory, 700)}` : "",
    i.prevTail ? `上一篇周记的结尾：${clip(i.prevTail, 160)}` : "",
    i.npcs?.length
      ? `人物周记素材（每人只能用自己这一行的数据）：\n${i.npcs.map((n) => [
          `- ${n.name}${n.identity ? `（${clip(n.identity, 20)}）` : ""}`,
          n.mood ? `近况心情：${clip(n.mood, 30)}` : "",
          `自己的事：${n.self.length ? n.self.map((t) => clip(t, 60)).join("；") : "无记录"}`,
          `与主角：${n.withPlayer.length ? n.withPlayer.map((t) => clip(t, 60)).join("；") : "本周无往来"}`,
        ].filter(Boolean).join("｜")).join("\n")}`
      : "",
  ].filter(Boolean);
  const npcRule = i.npcs?.length
    ? `主角周记写完后，在同一份输出里紧接着空一行，单独一行写「${NPC_WEEK_MARK}」，其下为「人物周记素材」里的每个人各写一行，格式「姓名：一句话」（姓名与素材一字不差）。` +
      "人物周记规则：用该人物的第一人称；写 TA 自己这一周——自己做了什么、自己的状态、自己的事；可以提到主角但不是必须，不要以主角为中心；" +
      "每句不超过 40 字；只能依据该人物那一行素材，不得编造没给的经历；与主角「本周无往来」时写 TA 自己的近况，不要写成想念或惦记主角；" +
      "人物之间各自独立，不要互相转述，也不要把所有人写成围着主角转。"
    : "";
  return [
    {
      role: "system",
      content:
        "你是这部互动小说的主角，在周末写一篇日记，回顾这一周。" +
        "要求：第一人称，约 800 字（700~900 字），分 4~6 段；贴合作品基调与时代语感；" +
        "把本周的安排、数值上的起落（用感受去写，可以点到具体变化）、收支、遇到的人和事、未解的心事都写进去，结尾写下对下周的打算；" +
        "只依据给出的数据与前情，不得编造数据里没有的人物、事件或数值；不要列表、不要小标题、不要旁白说明。" +
        "输出格式：第一行只写日记标题（不超过12字，不加引号、书名号或「标题」字样），空一行后直接写正文，段落之间空一行。" +
        npcRule,
    },
    { role: "user", content: lines.join("\n") },
  ];
}

/**
 * 功能注释：把（可能尚未写完的）流式全文拆成标题与正文——第一行是标题，其余是正文。
 * 流式显示与最终落库共用，保证打字过程中看到的就是最终内容。
 */
export function splitWeekDiary(full: string): { title: string; body: string; hasTitle: boolean } {
  // 功能注释：人物周记忆不进日记正文（流式显示也不露出）
  const cut = full.indexOf(NPC_WEEK_MARK);
  const s = (cut >= 0 ? full.slice(0, cut) : full).replace(/^\s+/, "");
  const nl = s.indexOf("\n");
  if (nl < 0) return { title: s.trim(), body: "", hasTitle: false };
  const title = s.slice(0, nl).replace(/^#+\s*|^(标题|题目)[:：]\s*/g, "").replace(/^[《「"“]|[》」"”]$/g, "").trim();
  return { title, body: s.slice(nl + 1).trim(), hasTitle: true };
}

/** 功能注释：最终解析——正文过短视为失败，由界面提示重写；兼容模型仍输出 JSON 的情况 */
export function parseWeekDiary(raw: string): WeekDiaryText | null {
  const cut = raw.indexOf(NPC_WEEK_MARK);
  const trimmed = (cut >= 0 ? raw.slice(0, cut) : raw).trim().replace(/^```\w*\n?|```$/g, "").trim();
  if (trimmed.startsWith("{")) {
    try {
      const o = JSON.parse(trimmed.replace(/,\s*([}\]])/g, "$1")) as Record<string, unknown>;
      const text = typeof o.text === "string" ? o.text.trim() : "";
      if (text.length >= 200) return { title: clip(typeof o.title === "string" && o.title.trim() ? o.title.trim() : "本周记事", 16), text };
    } catch { /* 按纯文本处理 */ }
  }
  const { title, body, hasTitle } = splitWeekDiary(trimmed);
  const text = hasTitle && title.length <= 20 ? body : trimmed;
  if (text.replace(/\s/g, "").length < 200) return null;
  return { title: clip(hasTitle && title.length <= 20 ? title : "本周记事", 16), text };
}

/**
 * 功能注释：解析周记末尾的人物周记忆：标记后每行「姓名：一句话」；兼容 JSON 里的 npcMemories:[{name,text}]。
 * 只保留名单里的人物（names 为空则不过滤），每人一条、每条截到 60 字。
 */
export function parseNpcWeekMemories(raw: string, names: string[] = []): NpcWeekMemory[] {
  const allow = new Set(names.map((n) => n.trim()).filter(Boolean));
  const out = new Map<string, string>();
  const add = (name: string, text: string) => {
    const n = name.replace(/^[-*·•\s]+/, "").replace(/[（(].*?[)）]$/, "").trim();
    const t = text.trim().replace(/^[「“"]|[」”"]$/g, "").trim();
    if (!n || !t || (allow.size && !allow.has(n)) || out.has(n)) return;
    out.set(n, t.length > 60 ? `${t.slice(0, 60)}…` : t);
  };
  const json = raw.trim().replace(/^```\w*\n?|```$/g, "").trim();
  if (json.startsWith("{")) {
    try {
      const o = JSON.parse(json) as { npcMemories?: { name?: string; text?: string }[] };
      for (const m of Array.isArray(o.npcMemories) ? o.npcMemories : []) add(String(m?.name ?? ""), String(m?.text ?? ""));
    } catch { /* 走文本 */ }
  }
  const cut = raw.indexOf(NPC_WEEK_MARK);
  if (cut >= 0) {
    for (const line of raw.slice(cut + NPC_WEEK_MARK.length).split(/\n+/)) {
      const m = line.match(/^(.{1,20}?)[：:]\s*(.+)$/);
      if (m) add(m[1], m[2]);
    }
  }
  return [...out].map(([name, text]) => ({ name, text }));
}
