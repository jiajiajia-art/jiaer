/* ————— 手机私聊/通话的 AI 驱动 —————
 * 与主线剧情分流：不进 story、不冒弹窗，回复以聊天气泡逐条呈现。
 * 严格贴合人物设定（PERSON_BY_ID）与历史对话，禁止 OOC；
 * 回复末尾附一小段 JSON 交代关系/心境/记忆变动，交由 phone.applyChatEffects 落账。 */
import type { AIConfig, GameState } from "./types";
import type { Thread } from "../game/phone";
import { complete } from "./ai";
import { PERSON_BY_ID } from "../worlds/star2005/content";
import { moodTier } from "../game/logic";
import { MOOD_LABELS } from "../game/data";

export type ChatReply = {
  bubbles: string[]; // 1~5 句气泡；空数组表示「已读不回」
  read_only?: boolean; // 已读不回
  busy?: boolean; // 暂时忙碌（延迟查看）
  rel_delta?: number;
  mood?: string;
  memory?: string;
  stress_delta?: number;
};

function personaBlock(g: GameState, personId: string, channel: string): string {
  const p = PERSON_BY_ID[personId];
  const npc = g.npcs.find((n) => n.id === personId);
  const rel = g.sim.rel[personId] ?? 0;
  const mood = npc?.mood || "平静";
  const mem = (npc?.interactions ?? []).slice(-4).map((it) => it.text).join("；");
  const tags = (p?.tags ?? []).join("、");
  return `【你要扮演的人物】
姓名：${npc?.name ?? p?.name ?? personId}
身份：${p?.role ?? npc?.identity ?? "圈内人"}
与主角关系：${p?.relation ?? npc?.relation ?? "相识"}（好感 ${rel}）
当前心情：${mood}
人物小传：${p?.bio ?? npc?.bio ?? "（暂无）"}
标签：${tags || "无"}
你们过往的私下往来记忆：${mem || "（还没什么特别的往来）"}

【本次渠道】${channel}`;
}

export function buildChatMessages(g: GameState, thread: Thread, userText: string) {
  const pid = thread.personId!;
  const me = g.player;
  const myMood = MOOD_LABELS[moodTier(g.sim)];
  const rel = g.sim.rel[pid] ?? 0;
  const warmth =
    rel >= 70 ? "你们关系很好，回复温和、话多、会主动关心她"
      : rel >= 40 ? "你们还算熟络，回复自然、有来有往"
      : rel >= 15 ? "你们只是相识，回复客气但不算亲近"
      : "你们不太熟，回复简短、略显疏离";

  const sys = `你是一款复古娱乐圈养成模拟器里的角色扮演引擎。现在由你扮演一位 NPC，通过手机与主角一对一私聊，务必像真人发消息一样：口语、简短、分条发送，贴合人物身份与当下心情，严禁 OOC（脱离人设）。

${personaBlock(g, pid, thread.kind === "group" ? "微信群聊" : "微信/短信私聊")}

【主角（对话的另一方）】
姓名：${me.name}｜身份：${me.identity}｜名气 ${g.sim.fame}｜口碑 ${g.sim.reputation}｜此刻心境：${myMood}

【回复要求】
1. ${warmth}。好感越高篇幅越长、语气越暖；好感低则简短冷淡。
2. 像发微信一样，用 1~5 条短消息（每条一句话左右），不要长篇大论，不要旁白，不要动作描写括号。
3. 结合上文与往来记忆，记得之前聊过的事，不要遗忘、不要前后矛盾。
4. 允许模拟真人状态：偶尔"已读不回"或"正在忙"（用下面 JSON 的字段表达），不要每次都热情满满。
5. 严格只输出 JSON，格式如下（不要输出任何 JSON 以外的文字）：
{
  "bubbles": ["第一条", "第二条"],
  "read_only": false,
  "busy": false,
  "rel_delta": 0,
  "mood": "回复后你的新心情（如：开心/无奈/冷淡/心动/疲惫）",
  "memory": "用一句话概括这次私聊，将写入你们的往来记忆",
  "stress_delta": 0
}
说明：read_only=true 表示这次已读不回（bubbles 留空数组）；busy=true 表示你在忙、稍后才看（bubbles 可留空或只回一句敷衍）；rel_delta 取 -3~5 的小幅整数；stress_delta 是这次聊天让主角压力的变化（暖聊为负、争执为正，-8~8）。`;

  const history = thread.msgs
    .filter((m) => m.role !== "sys")
    .slice(-16)
    .map((m) => ({ role: m.role === "me" ? ("user" as const) : ("assistant" as const), content: m.text }));

  return [
    { role: "system" as const, content: sys },
    ...history,
    { role: "user" as const, content: userText },
  ];
}

function safeParse(raw: string): ChatReply {
  let jsonStr = "";
  const fence = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1];
  else {
    const a = raw.indexOf("{");
    const b = raw.lastIndexOf("}");
    if (a >= 0 && b > a) jsonStr = raw.slice(a, b + 1);
  }
  try {
    const o = JSON.parse(jsonStr);
    const bubbles = Array.isArray(o.bubbles) ? o.bubbles.filter((x: unknown) => typeof x === "string" && x.trim()).slice(0, 5) : [];
    return {
      bubbles,
      read_only: !!o.read_only,
      busy: !!o.busy,
      rel_delta: Number(o.rel_delta) || 0,
      mood: typeof o.mood === "string" ? o.mood : undefined,
      memory: typeof o.memory === "string" ? o.memory : undefined,
      stress_delta: Number(o.stress_delta) || 0,
    };
  } catch {
    // 兜底：把整段当作一条气泡
    const line = raw.replace(/```[\s\S]*?```/g, "").trim().slice(0, 120);
    return { bubbles: line ? [line] : ["……（对方似乎不知道该说什么）"] };
  }
}

export async function requestChatReply(cfg: AIConfig, g: GameState, thread: Thread, userText: string): Promise<ChatReply> {
  const raw = await complete(cfg, buildChatMessages(g, thread, userText));
  return safeParse(raw);
}
