import { npcFactionOf } from "../game/factions";
/* ————— 手机私聊/通话的 AI 驱动 —————
 * 与主线剧情分流：不进 story、不冒弹窗，回复以聊天气泡逐条呈现。
 * 严格贴合人物设定（PERSON_BY_ID）与历史对话，禁止 OOC；
 * 回复末尾附一小段 JSON 交代关系/心境/记忆变动，交由 phone.applyChatEffects 落账。 */
import { blockWordsOf, charCardBlock, maskWords } from "../game/charCard";
import type { AIConfig, GameState } from "./types";
import { EMOTIONS, isEmotion, type EmotionId, type Thread } from "../game/phone";
import { complete, worldBookBlock } from "./ai";
import { affinityOf, isParent, kbBlock, kbOf, recentStoryBlock, romanceBlock, toneCue } from "../game/npcKnowledge";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID } from "../mods/registry";
import { moodTier, weekdayName } from "../game/logic";
import { gameMinutes, gameTimeLabel, type ChatMsg } from "../game/phone";
import { MOOD_LABELS } from "../game/data";
import { liveTerm as T } from "../mods/live";
import { ageLabel } from "./npcIdentity";
import { giftInText, giftRule, groupGiftRule, parseGift, promisedGift, type Gift } from "./chatMoney";

export type ChatReply = {
  bubbles: string[]; // 1~5 句气泡；空数组表示「已读不回」
  read_only?: boolean; // 已读不回
  busy?: boolean; // 暂时忙碌（延迟查看）
  rel_delta?: number;
  love_delta?: number; // 爱慕（心动轴）变化 → sim.relations[pid].romantic
  mood?: string;
  memory?: string;
  stress_delta?: number;
  emotion?: EmotionId;
  inner_os?: string;
  self_event?: string; // NPC 自己身上发生的事 → selfMemory
  accept_money?: boolean; // 主角给的红包 / 转账：true 收下，false 不收退回；没表态为 undefined
  gift?: Gift; // TA 这次当场发给主角的红包 / 转账（金额由 chatMoney.giftCard 校正）
};
/* 私聊附加上下文：money = 主角给 TA、TA 还没收的那笔钱（如「红包 ¥88（恭喜发财）」） */
export type ChatOpts = { money?: string; stickers?: string[] };
/* 可发表情包提示：AI 在 bubbles 里单独一条写「[表情包：名字]」即发出该表情包（只能用列表里的名字） */
export function stickerHint(names?: string[]): string {
  return names?.length ? `\n（系统：你可以偶尔发表情包——在 bubbles 里单独一条写「[表情包：名字]」，名字只能从这里选：${names.slice(0, 40).join("、")}。贴合情绪时再用，不要每轮都发，也不要编造列表外的名字。）` : "";
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* 宽松地取出模型回复里的 JSON 对象：```json 代码块、正文里第一个 { 到最后一个 }、去掉多余的尾逗号再试 */
function looseJson(raw: string): Record<string, unknown> | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const tries: string[] = [];
  for (const s of [fence?.[1], raw]) {
    if (!s) continue;
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a >= 0 && b > a) tries.push(s.slice(a, b + 1));
    const t = s.trim();
    if (t.startsWith("[") && t.endsWith("]")) tries.push(`{"lines":${t}}`); // 群聊偶尔直接回一个数组
  }
  for (const t of tries) {
    for (const s of [t, t.replace(/,\s*([}\]])/g, "$1")]) {
      try {
        const o = JSON.parse(s);
        if (o && typeof o === "object" && !Array.isArray(o)) return o as Record<string, unknown>;
      } catch { /* 换下一种写法 */ }
    }
  }
  return null;
}
const unjson = (s: string) => { try { return JSON.parse(`"${s}"`) as string; } catch { return s; } };
const boolOf = (x: unknown) => (x === true || x === "true" ? true : x === false || x === "false" ? false : undefined);

function personaBlock(g: GameState, personId: string, channel: string, hay = ""): string {
  const p = PERSON_BY_ID[personId];
  const npc = g.npcs.find((n) => n.id === personId);
  const custom = { gender: npc?.persona?.gender, persona: npc?.persona?.text, voice: npc?.persona?.voice };
  const rel = affinityOf(g, personId);
  const romance = romanceBlock(g, personId);
  const mood = npc?.mood || "平静";
  const tags = (p?.tags ?? []).join("、");
  return `【你要扮演的人物】
姓名：${npc?.name ?? p?.name ?? personId}
身份：${p?.role ?? npc?.identity ?? "圈内人"}
与主角关系：${p?.relation ?? npc?.relation ?? "相识"}（好感 ${rel}）${romance ? `\n${romance}` : ""}
当前心情：${mood}
人物小传：${p?.bio ?? npc?.bio ?? "（暂无）"}
标签：${tags || "无"}${(() => { const f = npcFactionOf(personId, p?.factionId); return f ? `\n所属势力：${f.name}${f.desc ? `（${f.desc.slice(0, 60)}）` : ""}（立场与说话要符合这个身份）` : ""; })()}${custom?.gender ? `\n性别（玩家设定，以此为准）：${custom.gender}` : ""}${custom?.persona?.trim() ? `\n玩家自定义人设（优先于小传，务必遵守）：${custom.persona.trim()}` : ""}${custom?.voice?.trim() ? `\n说话口吻/语气：${custom.voice.trim()}` : ""}
${(() => { const c = charCardBlock(npc?.name ?? p?.name ?? personId, npc?.persona, hay); return c ? `${c}\n` : ""; })()}${kbBlock(g, personId)}
${recentStoryBlock(g)}

${giftRule(g, personId)}

【本次渠道】${channel}`;
}

/* 群消息上的扩展字段（贴纸、红包、撤回等，定义在 components/phone/wxFeatures 的 XMsg 里），这里只读用得到的几个 */
type GroupMsg = ChatMsg & { kind?: string; failed?: boolean };

/* 群消息 → 给 AI 看的一行字：贴纸、图片、语音、红包等换成文字占位，过长截断 */
function groupMsgText(m: GroupMsg): string {
  const t = m.text.length > 60 ? `${m.text.slice(0, 60)}…` : m.text;
  return m.kind === "sticker" ? `[表情包：${t}]` : m.kind === "photo" ? `[图片]${t ? " " + t : ""}` : m.kind === "voice" ? `[语音] ${t}`
    : m.kind === "redpacket" ? "[红包]" : m.kind === "transfer" ? "[转账]" : m.img ? `[截图]${t ? " " + t : ""}` : t;
}

/* 游戏内时间差（分钟）→「刚刚 / N 分钟前 / N 小时前 / N 天前」 */
function agoLabel(min: number): string {
  return min < 10 ? "刚刚" : min < 60 ? `${Math.round(min)} 分钟前` : min < 1440 ? `${Math.floor(min / 60)} 小时前` : `${Math.floor(min / 1440)} 天前`;
}

/* 私聊 / 通话带上 TA 所在群里最近的消息：群消息群里人人可见，TA 都看过，私聊时应当自然记得、能接着聊。
 * 只取 TA 自己在的群（不碰任何私聊），3 天内有动静的最多 2 个群、每群最近 10 条，避免挤占提示词；
 * 更早的群聊靠成员各自的往来记忆（见 groupMemoryOf）。 */
function groupRecallBlock(g: GameState, pid: string): string {
  const now = gameMinutes(g);
  const lastGt = (msgs: GroupMsg[]) => msgs[msgs.length - 1].gt;
  const groups = (g.phone?.threads ?? [])
    .filter((t) => t.kind === "group" && t.members?.includes(pid))
    .map((t) => ({ t, msgs: (t.msgs as GroupMsg[]).filter((m) => m.role !== "sys" && !m.failed && m.kind !== "recall").slice(-10) }))
    .filter(({ msgs }) => msgs.length > 0 && now - lastGt(msgs) <= 3 * 1440)
    .sort((a, b) => lastGt(b.msgs) - lastGt(a.msgs))
    .slice(0, 2);
  if (!groups.length) return "";
  const nameOf = (id?: string) => (id === pid ? "你" : (id && (g.npcs.find((n) => n.id === id)?.name ?? PERSON_BY_ID[id]?.name)) || "群友");
  const body = groups
    .map(({ t, msgs }) => `〈群「${t.title}」· 最近一条是${agoLabel(now - lastGt(msgs))}发的〉\n${msgs.map((m) => `${m.role === "me" ? "主角" : nameOf(m.from)}：${groupMsgText(m)}`).join("\n")}`)
    .join("\n");
  return `【你所在的群里最近的消息（群里人人可见，你也都看过，这是你知道的事）】
${body}
私聊时你自然记得这些：可以顺着群里的话头聊、接上没说完的，也可以说群里不方便说的真心话；别逐字复述，也别装作没看见。`;
}

export function buildChatMessages(g: GameState, thread: Thread, userText: string, image?: string, opts: ChatOpts = {}) {
  const pid = thread.personId!;
  const me = g.player;
  const myMood = MOOD_LABELS[moodTier(g.sim)];
  const recall = groupRecallBlock(g, pid);
  const stk = stickerHint(opts.stickers);
  const moneyAsk = opts.money
    ? `\n（系统：主角给你的${opts.money}你还没收。收不收由你按人设和你们的关系决定，写进 accept_money：true＝收下，false＝不收、退回去；还在客气推辞、没拿定主意就填 null，钱先放着。说出口的话必须和它一致——说了"不要""退给你""你自己留着"就不能填 true。）`
    : "";

  const sys = `你是一款复古${T("industry")}养成模拟器里的角色扮演引擎。现在由你扮演一位 NPC，通过手机与主角一对一私聊，务必像真人发消息一样：口语、简短、分条发送，贴合人物身份与当下心情，严禁 OOC（脱离人设）。

${personaBlock(g, pid, thread.kind === "group" ? "微信群聊" : "微信/短信私聊", `${userText} ${thread.msgs.slice(-6).map((m) => m.text).join(" ")}`)}
${recall ? `\n${recall}\n` : ""}${(() => { const recent = thread.msgs.slice(-6).map((m) => m.text).join(" "); const wb = worldBookBlock(g, `${userText} ${recent}`, { npcIds: [pid] }); return wb ? `\n【公共设定 · 世界书（所有人都知道的常识）】\n${wb}\n` : ""; })()}

【现在】${gameTimeLabel(g)} ${weekdayName(g.sim.day ?? 0)}（${timeOfDay(g.sim.clockMin ?? 480)}）——这是给你的背景，只用来让问候与作息不错位（早上别说"早点睡"，深夜别说"早安"）；不要在消息里报具体钟点或点评对方几点发消息（如"八点整""这时间卡得真准"），真人聊天很少这样。

【主角（对话的另一方）】
姓名：${me.name}｜身份：${me.identity}｜名气 ${g.sim.fame}｜口碑 ${g.sim.reputation}｜此刻心境：${myMood}

【回复要求】
1. ${toneCue(g, pid)}。好感越高篇幅越长、越敢开玩笑；心动、暧昧、吃醋的程度看上面的【你对主角的爱慕】，它和好感冲突时以爱慕为准。
2. 像发微信一样，用 1~5 条短消息，每条只放一句话；想说几件事就拆成几条放进 bubbles 数组，单条里不要换行、不要空行。不要长篇大论，不要旁白，不要动作描写括号。
2.1 称呼像真人：微信里极少连名带姓喊人，更不会每次都喊；按你们的关系用昵称、名字后两个字、"你"或干脆不称呼，只有生气、严肃或很生分时才叫全名。
2.2 对方发很短的消息（"1""嗯""ok"、表情）时，自然接话或顺势带过，不要逐字复述对方的内容来吐槽。
3. 结合上文与往来记忆（包括群里一起聊过的），记得之前聊过的事，不要遗忘、不要前后矛盾。
4. 允许模拟真人状态：偶尔"已读不回"或"正在忙"（用下面 JSON 的字段表达），不要每次都热情满满；但越心动越舍不得不回，「暗暗心动」以上很少已读不回。
5. 严格只输出 JSON，格式如下（不要输出任何 JSON 以外的文字）：
{
  "bubbles": ["第一条", "第二条"],
  "read_only": false,
  "busy": false,
  "rel_delta": 0,
  "love_delta": 0,
  "mood": "回复后你的新心情（如：开心/无奈/冷淡/心动/疲惫）",
  "memory": "用一句话概括这次私聊，将写入你们的往来记忆",
  "stress_delta": 0,
  "emotion": "calm",
  "inner_os": "必填：一句不会发出去的内心独白",
  "self_event": "（可空）你自己最近发生的一件生活小事，会记进你的近况",
  "accept_money": null,
  "gift": null
}
说明：bubbles 里只能放你亲手打出来发给她的字，第一人称；禁止写旁白、动作、状态（如"（已读不回）""林宜看了一眼没回"），也不要用括号。read_only=true 表示这次已读不回（bubbles 留空数组）；busy=true 表示你在忙、稍后才看（bubbles 可留空或只回一句敷衍）；rel_delta 取 -3~5 的小幅整数；stress_delta 是这次聊天让主角压力的变化（暖聊为负、争执为正，-8~8）。
accept_money 只在主角给你发了还没收的红包 / 转账时填 true 或 false，平时为 null；gift 是你这次当场发给主角的红包或转账（规则见上面的金钱说明），不发就是 null。
love_delta 是这次聊天后你对主角爱慕（私下心动）的变化，取 -2~3 的整数：只有真被撩到、被打动、暧昧升温（正）或失望、受伤、被冒犯（负）时才给，普通寒暄、聊正事一律为 0；现在毫无心动的人被真正打动时也可以 +1 开始在意；你是主角的家人或不可攻略时恒为 0。
emotion 必须从以下英文 id 中选一个，代表你此刻真实情绪：${Object.entries(EMOTIONS).map(([k, v]) => `${k}=${v.label}（${v.hint}）`).join("，")}。
inner_os 每次都必须填写（已读不回时也要写你为什么不回），是你心里没说出口的真实想法（第一人称、一句话、可以吃醋/傲娇/暗爽/占有欲/偷乐/委屈），要和表面消息形成反差或补充。`;

  const history = thread.msgs
    .filter((m) => m.role !== "sys")
    .slice(-16)
    .map((m) => ({ role: m.role === "me" ? ("user" as const) : ("assistant" as const), content: m.img ? `[她给你共享了一张屏幕截图]${m.text ? " " + m.text : ""}` : m.text }));

  return [
    { role: "system" as const, content: sys },
    ...history,
    image
      ? {
          role: "user" as const,
          content: [
            { type: "text" as const, text: `【屏幕共享】主角刚把她的手机屏幕/一张图片共享给你看。请先认真看清画面里的具体内容，再以你的性格当场做出反应：点评你看到的具体细节（不要泛泛而谈），并用 emotion 字段给出你看到画面后的真实情绪（惊讶 surprised / 开心 happy / 困惑 confused / 好奇 curious / 担心 worried / 兴奋 ecstatic / 感动 moved 等）。${userText ? `她附言：${userText}` : ""}${moneyAsk}` },
            { type: "image_url" as const, image_url: { url: image } },
          ],
        }
      : { role: "user" as const, content: `${userText}${moneyAsk}${stk}\n\n（系统：请严格按上面规定的 JSON 格式回复，bubbles 每条一句、不含换行，并填写 inner_os 与 emotion）` },
  ];
}

function safeParse(raw: string): ChatReply {
  const o = looseJson(raw);
  if (o) {
    // 单条里夹了换行/空行的，按行拆成多条气泡，像真人一句一句发
    const list = Array.isArray(o.bubbles) ? o.bubbles : typeof o.bubbles === "string" ? [o.bubbles] : [];
    const bubbles = list.filter((x: unknown): x is string => typeof x === "string").flatMap((x) => x.split(/\n+/)).map((x) => x.trim()).filter(Boolean).slice(0, 6);
    return {
      bubbles,
      read_only: !!o.read_only,
      busy: !!o.busy,
      rel_delta: Number(o.rel_delta) || 0,
      love_delta: Number(o.love_delta) || 0,
      mood: typeof o.mood === "string" ? o.mood : undefined,
      memory: typeof o.memory === "string" ? o.memory : undefined,
      stress_delta: Number(o.stress_delta) || 0,
      emotion: isEmotion(o.emotion) ? o.emotion : undefined,
      inner_os: typeof o.inner_os === "string" && o.inner_os.trim() ? o.inner_os.trim().slice(0, 80) : undefined,
      self_event: typeof o.self_event === "string" && o.self_event.trim() ? o.self_event.trim().slice(0, 80) : undefined,
      accept_money: boolOf(o.accept_money),
      gift: parseGift(o.gift),
    };
  }
  // 兜底：JSON 残缺（如被截断）时先从里面捞出 bubbles 的字符串，绝不把 JSON 残片当消息发出去；
  // 模型干脆没按 JSON 回时，按行拆成多条气泡
  const at = raw.search(/"bubbles"\s*:\s*\[/);
  const salvaged = at < 0 ? [] : [...raw.slice(at).replace(/^"bubbles"\s*:\s*\[/, "").split(/\]/)[0].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => unjson(m[1]).trim()).filter(Boolean);
  const lines = salvaged.length ? salvaged : raw.replace(/```[\s\S]*?```/g, "").split(/\n+/).map((x) => x.trim()).filter((x) => x && !/^[{}[\]",]|"\s*:/.test(x));
  return { bubbles: lines.length ? lines.slice(0, 6).map((x) => x.slice(0, 120)) : ["……（对方似乎不知道该说什么）"] };
}

export async function requestChatReply(cfg: AIConfig, g: GameState, thread: Thread, userText: string, image?: string, opts?: ChatOpts): Promise<ChatReply> {
  const raw = await complete(cfg, buildChatMessages(g, thread, userText, image, opts));
  const pid = thread.personId ?? "";
  const name = g.npcs.find((n) => n.id === pid)?.name ?? PERSON_BY_ID[pid]?.name ?? "";
  const r = cleanBubbles(safeParse(raw), name);
  const bw = blockWordsOf(g.npcs.find((n) => n.id === pid)?.persona);
  return bw.length ? { ...r, bubbles: r.bubbles.map((b) => maskWords(b, bw)) } : r;
}

/* 气泡只能是 TA 打出来的字：
 * · 整条括号/星号包裹的（（已读不回）（没回）*看了一眼*）是状态或动作，不是消息：含「已读/没回/不回」视为已读不回，其余丢弃；
 * · 用第三人称写 TA 自己（「林宜正跟人打电话，瞥了一眼屏幕」）的旁白丢弃；
 * · 句中夹的括号动作去掉，只留话。全部被滤掉 → 按已读不回处理。 */
/* 不是 TA 打出来的字：整条括号状态/动作，或第三人称旁白。旧聊天记录渲染时也用它隐藏 */
export function notAMessage(b0: string, name: string): boolean {
  const b = b0.trim();
  if (/^[（(【\[*].*[）)】\]*]$/.test(b) && !/[）)】\]*].+[（(【\[*]/.test(b)) return true;
  if (name && b.includes(name) && !/[我你]/.test(b.replace(name, ""))) return true;
  return /^(手机|屏幕|对方|TA|他|她)[^，。！？]{0,8}(震|亮|响|看了|瞥|没回|已读)/.test(b);
}
function cleanBubbles(r: ChatReply, name: string): ChatReply {
  let readOnly = !!r.read_only;
  let gift = r.gift;
  const own = name ? new RegExp(`^${esc(name)}\\s*[:：]\\s*`) : null;
  const out: string[] = [];
  for (const b0 of r.bubbles) {
    let b = own ? b0.trim().replace(own, "") : b0.trim(); // 模型偶尔给自己的话加上「姓名：」前缀
    // 写成「[红包 ¥88：生日快乐]」的：转成一张真的红包（gift），旁边的文字照常发
    const money = giftInText(b);
    if (money) {
      gift ??= money.gift;
      b = money.rest;
      if (!b) continue;
    }
    if (notAMessage(b, name)) {
      if (/已读|没回|不回|未回|没理|不理/.test(b)) readOnly = true;
      continue;
    }
    const t = b.replace(/[（(][^）)]*[）)]/g, "").trim();
    if (t) out.push(t);
  }
  // 嘴上说了「给你发个红包」却没填 gift：照说的当场发
  gift ??= out.map(promisedGift).find((x) => x) ?? undefined;
  if (!out.length && r.bubbles.length && !gift) readOnly = true;
  return { ...r, gift, bubbles: readOnly && !out.length ? [] : out, read_only: readOnly && !out.length };
}


/* ————— 群聊：多位人设同场，各自带着与主角的私聊记忆 ————— */
export type GroupLine = { id: string; text: string; emotion?: EmotionId; inner_os?: string; gift?: Gift };
/* grab：这轮领了主角红包 / 收下主角转账的成员（按先后）；AI 没给这个字段时为 undefined，由说出口的话兜底 */
export type GroupReply = { lines: GroupLine[]; memories: Record<string, string>; rel: Record<string, number>; love: Record<string, number>; grab?: string[] };
/* narration：userText 是旁白（旁观群聊），不是主角的发言；money：主角发在群里、还没领完的红包 / 转账 */
export type GroupOpts = { narration?: boolean; money?: string; stickers?: string[] };

/* 说话人别名：成员显示名与 id → 成员；「主角」与主角姓名 → ME（模型抄回主角的话，要丢掉） */
export const ME = "__me__";
export type SpeakerAlias = { name: string; id: string };
export function groupAliases(g: GameState, members: string[]): SpeakerAlias[] {
  const named = members.map((m) => ({ name: g.npcs.find((n) => n.id === m)?.name ?? PERSON_BY_ID[m]?.name ?? "", id: m }));
  return [...named, ...members.map((m) => ({ name: m, id: m })), { name: "主角", id: ME }, { name: g.player.name, id: ME }].filter((a) => a.name);
}

/* 把一段可能混了几个人的文字按「姓名：内容」拆成逐人逐条：支持换行分隔、行首「- **姓名**（备注）：」、
 * 以及句末标点后紧跟的「姓名：」。没有前缀的部分归 fallback（上一位说话人）；fallback 为空串的直接丢弃。 */
export function splitSpeakers(text: string, aliases: SpeakerAlias[], fallback: string): { id: string; text: string }[] {
  const list = [...aliases].sort((a, b) => b.name.length - a.name.length);
  const out: { id: string; text: string }[] = [];
  const alt = list.map((a) => esc(a.name)).join("|");
  const head = alt ? new RegExp(`^(?:[-*•·>]\\s*|\\d+[.、)]\\s*)?(?:\\*\\*)?[【\\[]?(${alt})[】\\]]?(?:\\*\\*)?\\s*(?:[（(][^）)\\n]{0,12}[）)])?\\s*(?:说|道)?\\s*[:：]\\s*(?:\\*\\*)?\\s*`) : null;
  const inline = alt ? new RegExp(`([。！？!?~～…）)」”])\\s*(${alt})\\s*[:：]`, "g") : null;
  let cur = fallback;
  for (const row of text.split(/\n+/)) {
    const marked = inline ? row.replace(inline, "$1\n$2：") : row;
    for (const seg of marked.split("\n")) {
      const s = seg.trim();
      if (!s) continue;
      const m = head ? s.match(head) : null;
      if (m) cur = list.find((a) => a.name === m[1])!.id;
      const body = (m ? s.slice(m[0].length) : s).trim().replace(/^["“]([\s\S]*)["”]$/, "$1").trim();
      if (body && cur) out.push({ id: cur, text: body });
    }
  }
  return out;
}

/* 群聊里多人同处一个提示词，无法逐人隔离——因此只给公开人设，不放任何人的私有记忆 / 私聊（严格隔离） */
function memberCard(g: GameState, pid: string): string {
  const npc = g.npcs.find((n) => n.id === pid);
  const ps = npc?.persona;
  const kb = kbOf(g, pid);
  const pf = kb.profile;
  const romance = romanceBlock(g, pid, true);
  // 成员自己的记忆（与主角的交往 + 自身近况）：群聊里也要记得之前发生过的事
  const mem = [...(kb.playerSummary ? [kb.playerSummary] : []), ...kb.playerMemory.slice(-4).map((m) => m.text), ...kb.selfMemory.slice(-2).map((m) => m.text)]
    .map((t) => t.trim()).filter(Boolean).join("；").slice(0, 260);
  return `${memberCardBase(g, pid, npc, ps, pf, romance)}${mem ? `\n  TA 记得：${mem}` : ""}`;
}
function memberCardBase(g: GameState, pid: string, npc: GameState["npcs"][number] | undefined, ps: NonNullable<GameState["npcs"][number]["persona"]> | undefined, pf: ReturnType<typeof kbOf>["profile"], romance: string): string {
  void npc;
  return `◆ id=${pid}｜${pf.name}｜${pf.identity ?? "相识"}${pf.job ? `｜职业 ${pf.job}` : ""}${pf.age ? `｜${ageLabel(pf.age)}` : ""}｜与主角：${pf.relation ?? "相识"}（好感 ${affinityOf(g, pid)}）${romance ? `｜${romance}` : ""}｜心情 ${npc?.mood || "平静"}
  公开人设：${(pf.bio || "（暂无）").slice(0, 160)}${pf.personality ? `｜性格 ${pf.personality}` : ""}${ps?.gender ? `｜性别 ${ps.gender}` : ""}${ps?.voice?.trim() ? `｜口吻 ${ps.voice.trim()}` : ""}${(() => { const c = charCardBlock(pf.name, ps, "", true); return c ? `\n  ${c.replace(/\n/g, "\n  ")}` : ""; })()}`;
}

/* 这轮群聊要记进某位成员记忆的一句话（不含群名前缀，落账时 applyChatEffects 会加上，并与同一场群聊并成一条）：
 * AI 写了就用 AI 的；AI 漏写时，只给本轮开口或被主角点名的人兜底记下「主角说了什么、我怎么回的」。
 * 没吭声的旁听者不硬塞，也不把整段群聊抄给每个人——他们私聊时还能从「群里最近的消息」看到（groupRecallBlock）。
 * said：主角这轮发的内容（已文字化）；传空串表示没什么值得兜底的（如只发了个表情包），返回空串表示不记。 */
export function groupMemoryOf(g: GameState, r: GroupReply, pid: string, said: string): string {
  const ai = r.memories[pid]?.trim();
  if (ai) return ai;
  if (!said) return "";
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const what = said.startsWith("[") ? `发了${clip(said, 30)}` : `说「${clip(said, 30)}」`;
  const mine = r.lines.filter((l) => l.id === pid).map((l) => l.text).join(" ");
  if (mine) return `主角在群里${what}，我回了「${clip(mine, 24)}」`;
  const name = g.npcs.find((n) => n.id === pid)?.name ?? PERSON_BY_ID[pid]?.name;
  return name && said.includes(name) ? `主角在群里点了我的名，${what}` : "";
}

export async function requestGroupReply(cfg: AIConfig, g: GameState, thread: Thread, userText: string, image?: string, opts: GroupOpts = {}): Promise<GroupReply> {
  const members = thread.members ?? [];
  const names = Object.fromEntries(members.map((m) => [m, g.npcs.find((n) => n.id === m)?.name ?? PERSON_BY_ID[m]?.name ?? m]));
  const prev = thread.msgs.filter((m) => m.role !== "sys");
  const lastGt = prev[prev.length - 1]?.gt;
  const gap = typeof lastGt === "number" ? `；群里上一条消息是${agoLabel(gameMinutes(g) - lastGt)}发的` : "；群里还没人说过话";
  const sys = `你是复古${T("industry")}养成模拟器里的群聊扮演引擎。主角 ${g.player.name} 建了一个微信群「${thread.title}」，群里有以下成员，你要同时扮演他们，像真实群聊一样接话。每个人严格保持自己的人设与口吻，可以互相调侃、拆台、护着主角。【知识隔离】群里每个人只知道群里说过的话和自己的公开人设，不知道别人与主角的私聊和私事，也不能替别人说出只有对方知道的事。

【群成员】
${members.map((m) => memberCard(g, m)).join("\n")}
${(() => { const rs = recentStoryBlock(g); return rs ? `\n${rs}\n` : ""; })()}
${(() => { const wb = worldBookBlock(g, `${userText} ${thread.msgs.slice(-6).map((m) => m.text).join(" ")}`, { npcIds: members }); return wb ? `\n【公共设定 · 世界书】\n${wb}\n` : ""; })()}

【现在】${gameTimeLabel(g)} ${weekdayName(g.sim.day ?? 0)}（${timeOfDay(g.sim.clockMin ?? 480)}）${gap}——只用来让作息、问候和话题冷热不错位（早上别说"晚安"；隔了好几天才有人说话，就别像话头没断过一样接着聊），群里不要报具体钟点。

【规则】
1. 本轮 1~5 条发言，不必人人都说，也别排队一人一句：被点名（@ 或叫名字）的人一般会回，和主角好感高的人更爱接话；其他人看心情和交情——可以接别的成员的话、互相抬杠、跑题，或只回一句"哈哈哈""+1"、一个表情；同一个人可以连发两条短的；在忙、不熟或没兴趣的人可以不吭声。
1.1 「爱慕」是成员对主角的私下心动，与好感分开：爱慕高的人会在细节里流露偏爱、在意或醋意，但群里人多，通常不直白表白；爱慕为 0 或标注不可攻略的人不对主角暧昧。心意只有本人知道，别人顶多察觉到异样，不能替别人说破。
2. 每条像发微信：口语、短句，不要旁白、不要括号动作；别复述主角的话，别客服腔（"收到""好的呢""有需要随时说"），也别条条都以问句结尾。
3. memories 会写进各成员自己的记忆，之后 TA 和主角私聊、见面时都会记得：本轮开口的人、被主角点名的人、跟这件事直接相关的人各写一条；主角说了跟全群有关的事（约饭、报喜、求助、发红包），每个成员都写。用该成员的第一人称、一句话写清具体的事（如"主角约大家周六吃火锅，我说我带酒"），别写"在群里聊了聊"这种空话；纯寒暄、没什么可记的就不写。
3.1 ${groupGiftRule(g, names)}${opts.money ? `
3.2 主角在群里发的${opts.money}还没人领。想领的成员按领取先后把 id 写进 grab，领到的人一般会道谢、起哄或喊"谢谢老板"；不好意思领、不想领的人不写，没人领就给空数组 []。说出口的要和 grab 一致：说了"抢到了""谢谢红包"的人必须在 grab 里。` : ""}
4. 严格只输出 JSON：
{
  "lines": [{"id": "成员id", "text": "一句话", "emotion": "calm", "inner_os": "可选，一句没说出口的心里话", "gift": null}],
  "memories": {"成员id": "该成员第一人称的一句话：这轮群聊里和主角有关、值得记住的具体的事"},
  "rel": {"成员id": 0},
  "love": {"成员id": 0}${opts.money ? `,
  "grab": ["领了主角红包的成员id"]` : ""}
}
emotion 取值：${Object.entries(EMOTIONS).map(([k, v]) => `${k}=${v.label}`).join("，")}。rel 为 -3~4 的整数，只写有变化的人。love 是该成员对主角爱慕（私下心动）的变化，-2~3 的整数，只写这轮确实心动或失望的人，多数时候留空对象；主角的家人不写。`;

  const history = prev.slice(-20).map((m) => ({
    role: m.role === "me" ? ("user" as const) : ("assistant" as const),
    content: m.role === "me" ? (m.img ? `[主角发了一张截图] ${m.text}` : m.text) : `${names[m.from ?? ""] ?? "成员"}：${m.text}`,
  }));
  const last = image
    ? { role: "user" as const, content: [{ type: "text" as const, text: `【主角在群里共享了一张截图，大家看完各自反应】${userText}` }, { type: "image_url" as const, image_url: { url: image } }] }
    : { role: "user" as const, content: `${userText}${stickerHint(opts.stickers)}` };
  const raw = await complete(cfg, [{ role: "system" as const, content: sys }, ...history, last]);

  let o: { lines?: unknown; memories?: unknown; rel?: unknown; love?: unknown; grab?: unknown } = {};
  try {
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    o = JSON.parse(raw.slice(a, b + 1));
  } catch { /* 兜底在下面 */ }
  const byName = Object.fromEntries(Object.entries(names).map(([id, n]) => [n, id]));
  const lines: GroupLine[] = (Array.isArray(o.lines) ? o.lines : [])
    .map((l: { id?: string; name?: string; text?: string; emotion?: string; inner_os?: string; gift?: unknown }) => {
      // 话里夹的「[红包 ¥88：恭喜]」抽成一张真的红包，旁边的字照常发；嘴上说了「给大家发个红包」却没填 gift 的，照说的发。群里只发红包
      const said = typeof l.text === "string" ? l.text.trim() : "";
      const inText = giftInText(said);
      const text = inText ? inText.rest : said;
      const gift = parseGift(l.gift) ?? inText?.gift ?? promisedGift(text) ?? undefined;
      return {
        id: members.includes(l.id ?? "") ? l.id! : byName[l.name ?? l.id ?? ""] ?? "",
        text: maskWords(text, blockWordsOf(g.npcs.find((n) => n.id === (members.includes(l.id ?? "") ? l.id! : byName[l.name ?? l.id ?? ""] ?? ""))?.persona)),
        emotion: isEmotion(l.emotion) ? l.emotion : undefined,
        inner_os: typeof l.inner_os === "string" && l.inner_os.trim() ? l.inner_os.trim().slice(0, 80) : undefined,
        ...(gift ? { gift: { ...gift, kind: "redpacket" as const } } : {}),
      };
    })
    .filter((l) => l.id && (l.text || l.gift))
    .slice(0, 6);
  // 领了主角红包的人（认 id，也认名字）；没问红包或 AI 没给这个字段 → undefined
  const grab = opts.money && Array.isArray(o.grab)
    ? [...new Set(o.grab.map((x) => String(x)).map((x) => (members.includes(x) ? x : byName[x] ?? "")).filter(Boolean))]
    : undefined;
  const pickObj = (x: unknown) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});
  const memories: Record<string, string> = {};
  for (const [k, v] of Object.entries(pickObj(o.memories))) if (members.includes(k) && typeof v === "string") memories[k] = v;
  const rel: Record<string, number> = {};
  for (const [k, v] of Object.entries(pickObj(o.rel))) if (members.includes(k) && Number(v)) rel[k] = Number(v);
  const love: Record<string, number> = {};
  for (const [k, v] of Object.entries(pickObj(o.love))) if (members.includes(k) && Number(v)) love[k] = Number(v);
  if (!lines.length && members[0]) lines.push({ id: members[0], text: raw.replace(/```[\s\S]*?```/g, "").trim().slice(0, 60) || "……" });
  return { lines, memories, rel, love, ...(grab ? { grab } : {}) };
}

/* 时段描述：让 AI 的问候与作息贴合游戏内时钟 */
function timeOfDay(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return h < 5 ? "深夜" : h < 9 ? "清晨/早上" : h < 12 ? "上午" : h < 14 ? "中午" : h < 18 ? "下午" : h < 23 ? "晚上" : "深夜";
}
