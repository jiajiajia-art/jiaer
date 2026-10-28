/* ═══════════════════════════════════════════════════════════════
 *  NPC 私有知识库（每人一份、严格隔离）+ 父母生活费（代码结算）
 *
 *  两层知识体系：
 *   ① 全局世界书（game.worldBook，关键词触发，所有 NPC 共读）——见 lib/ai.ts worldBookBlock
 *   ② NpcKnowledge（game.npcKb[npcId]）——只在扮演该 NPC 时注入，绝不拼进别人的提示词
 *      profile      固定人设档案（姓名 / 年龄 / 职业 / 家境档位 / 性格 / 固有身份）
 *      selfMemory   NPC 自己的生活事件
 *      playerMemory NPC 与玩家之间的交互记忆
 *   久远记忆按条数折叠成摘要（确定性压缩，零额外 token 开销）。
 *
 *  生活费：家境档位 → 基础月生活费 / 协商成功率 / 补贴额，全部由本模块计算；
 *  AI 只负责「怎么说」，不能决定「给多少」。档位与金额来自模组槽 allowance，
 *  未声明即整个生活费系统关闭（换模组不会冒出写死的数值）。 */
import { line, timelineBuckets } from "./npcTimeline";
import type { GameState, Npc } from "../lib/types";
import { ownField } from "../lib/npcIdentity";
import { slot } from "../mods/live";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID } from "../mods/registry";
import { familyProfiles, FAMILY_NPC_IDS } from "./family";
import { relOf } from "./relations";
import { canRomance, hasPartner, romanceFixedOff } from "./logic";
import { RELATIONS, romanticCapOf } from "../worlds/star2005/content";
import { relationPromptFor } from "./relNet";

export type KbMem = { t: string; text: string; turn?: number }; // t = 游戏内时间标签
export type NpcProfile = {
  name: string; age?: string; job?: string; wealth?: string; personality?: string; identity?: string; relation?: string; bio?: string;
};
export type NpcKnowledge = {
  profile: NpcProfile;
  selfMemory: KbMem[];
  playerMemory: KbMem[];
  selfSummary?: string; // 折叠后的久远自身经历
  playerSummary?: string; // 折叠后的久远交往记忆
  heard?: KbMem[]; // 从别的 NPC 那里听来的（同处一地时闲聊传开，属传闻）
};

/* —— 模组槽：生活费 —— */
export type AllowanceTier = {
  label: string; // 家境档位名，如「清贫」「小康」
  match?: string[]; // 命中家世 / 父母职业里的关键词即归入此档
  base: number; // 基础月生活费（元）
  negotiate: number; // 协商成功率 0~1
  bonus: number; // 协商成功的补贴额（元）
};
export type AllowanceSlot = {
  everyWeeks?: number; // 多少周发一次（缺省 4）
  payer?: string; // 发放人 npcId（缺省 母亲）
  tiers: AllowanceTier[]; // 按从穷到富排列；都不命中取中间档
  cooldownWeeks?: number; // 协商冷却（缺省 2 周）
};
export const allowanceOn = () => (allowanceCfg()?.tiers?.length ?? 0) > 0;
/* 只有声明了 allowance 槽的模组（如校园）才有生活费；未声明即关闭 */
export const allowanceCfg = (): AllowanceSlot | undefined => slot<AllowanceSlot | undefined>("allowance", () => undefined, () => undefined);

const KEEP = 12; // 每类记忆保留的近期条数
const FOLD = 8; // 超出后一次折叠多少条进摘要
const SUM_MAX = 360; // 摘要字数上限（超出只留最近的部分）
const MEM_MAX = 160; // 单条记忆字数上限

export const isParent = (id: string) => (FAMILY_NPC_IDS as readonly string[]).includes(id);
export const payerId = () => allowanceCfg()?.payer ?? FAMILY_NPC_IDS[1];

/* 家境档位：家世 + 父母职业 匹配档位关键词，取命中的最高档 */
export function wealthTier(g: GameState): AllowanceTier | undefined {
  const tiers = allowanceCfg()?.tiers ?? [];
  if (!tiers.length) return undefined;
  const parents = familyProfiles(g.player);
  const hay = [g.player.klass, g.player.background, ...parents.map((p) => p.job)].join(" ");
  let hit = -1;
  tiers.forEach((t, i) => { if ((t.match ?? []).some((k) => k && hay.includes(k))) hit = Math.max(hit, i); });
  return tiers[hit >= 0 ? hit : Math.floor((tiers.length - 1) / 2)];
}

function baseProfile(g: GameState, id: string): NpcProfile {
  const npc: Npc | undefined = g.npcs.find((n) => n.id === id);
  const p = PERSON_BY_ID[id];
  const prof: NpcProfile = {
    name: npc?.name ?? p?.name ?? id,
    age: npc?.age,
    // 身份 / 关系 / 简介：编辑器里改过的存档值优先，否则内容池原设定
    identity: ownField(npc, "identity", p?.role),
    relation: ownField(npc, "relation", p?.relation),
    bio: (npc?.persona?.text?.trim() || ownField(npc, "bio", p?.bio) || "").slice(0, 400),
  };
  if (isParent(id)) {
    const f = familyProfiles(g.player)[(FAMILY_NPC_IDS as readonly string[]).indexOf(id)];
    if (f) Object.assign(prof, { job: f.job, personality: f.personality, age: String(f.age) });
    const w = wealthTier(g);
    if (w) prof.wealth = w.label;
  }
  return prof;
}

/* 取（并按需建立）某 NPC 的知识库；profile 每次按最新人设刷新，记忆保留 */
export function kbOf(g: GameState, id: string): NpcKnowledge {
  const cur = g.npcKb?.[id];
  const profile = { ...baseProfile(g, id), ...(cur?.profile?.personality && !isParent(id) ? { personality: cur.profile.personality } : {}) };
  if (cur) return { ...cur, selfMemory: cur.selfMemory ?? [], playerMemory: cur.playerMemory ?? [], profile };
  // 旧存档迁移：把原有互动记录导入 playerMemory
  const npc = g.npcs.find((n) => n.id === id);
  const playerMemory = (npc?.interactions ?? []).map((it) => ({ t: it.time, text: it.text, turn: it.turn }));
  return fold({ profile, selfMemory: [], playerMemory });
}

function fold(kb: NpcKnowledge): NpcKnowledge {
  const squash = (list: KbMem[], sum?: string): [KbMem[], string | undefined] => {
    if (list.length <= KEEP) return [list, sum];
    const old = list.slice(0, Math.max(FOLD, list.length - KEEP));
    const add = old.map((m) => `${m.t ? m.t + "：" : ""}${m.text}`).join("；");
    const merged = [sum, add].filter(Boolean).join("；");
    return [list.slice(old.length), merged.length > SUM_MAX ? "……" + merged.slice(-SUM_MAX) : merged];
  };
  const [pm, ps] = squash(kb.playerMemory, kb.playerSummary);
  const [sm, ss] = squash(kb.selfMemory, kb.selfSummary);
  return { ...kb, playerMemory: pm, playerSummary: ps, selfMemory: sm, selfSummary: ss };
}

/* 同一场群聊并成一条记忆：上一条也是这个群（同一个「[群聊「群名」]」前缀）、同一天、同一主线回合时，
 * 把这轮的新内容接在后面并返回全文（已经记过就原样返回）；条件不符或并完超过单条上限返回 undefined，另起一条。
 * 群聊一轮就要给好几个人记一笔，不并的话一场群聊就会把私聊 / 当面的往来记忆挤出近期记忆（KEEP 条）。
 * npc.interactions 与知识库 playerMemory 共用这条规则，两边记的是同一件事 */
export function joinGroupMem(prev: { text: string; turn?: number } | undefined, prevTime: string | undefined, text: string, tag: string, turn: number, t: string): string | undefined {
  if (!prev || !tag || !text.startsWith(tag) || !prev.text.startsWith(tag) || prev.turn !== turn) return undefined;
  if (!prevTime || prevTime.split(" ")[0] !== t.split(" ")[0]) return undefined; // 时间标签形如「2005.03.12 下午 14:20」，首段是日期
  const add = text.slice(tag.length).trim();
  if (!add || prev.text.includes(add)) return prev.text;
  const joined = `${prev.text}；${add}`;
  return joined.length <= MEM_MAX ? joined : undefined;
}

/* 追加记忆（写回 game.npcKb，返回新 game）；kind=player 交互记忆 / self 自身事件。
 * merge：群聊前缀「[群聊「群名」]」，同一场群聊的后几轮并进上一条（见 joinGroupMem），不新增条目 */
export function remember(g: GameState, id: string, kind: "player" | "self", text: string, t: string, merge?: string): GameState {
  const clean = text.trim().slice(0, MEM_MAX);
  if (!clean) return g;
  const kb = kbOf(g, id);
  const key = kind === "player" ? "playerMemory" : "selfMemory";
  const last = kb[key].at(-1);
  if (last?.text === clean) return g; // 去重：同一句不重复写
  const joined = merge ? joinGroupMem(last, last?.t, clean, merge, g.turnCount, t) : undefined;
  if (last && joined !== undefined) {
    if (joined === last.text) return g;
    const merged: NpcKnowledge = { ...kb, [key]: [...kb[key].slice(0, -1), { ...last, text: joined }] };
    return { ...g, npcKb: { ...(g.npcKb ?? {}), [id]: merged } };
  }
  const next = fold({ ...kb, [key]: [...kb[key], { t, text: clean, turn: g.turnCount }] });
  return { ...g, npcKb: { ...(g.npcKb ?? {}), [id]: next } };
}

/* 背景履历（来自人物资料，隐藏条目不注入） */
function resumeText(id: string): string {
  return (PERSON_BY_ID[id]?.resume ?? []).filter((e) => !e.hidden).slice(-12)
    .map((e) => `· ${e.year}${e.month ? `.${e.month}` : ""} ${e.title}${e.detail ? `：${e.detail}` : ""}`).join("\n");
}

/* 主线最近 4 回合原文（给私聊 / 当面交谈作背景参考） */
export function recentStoryBlock(g: GameState): string {
  const turns = (g.story ?? []).filter((t) => !t.error).slice(-4);
  if (!turns.length) return "";
  const txt = turns.map((t) => `${t.role === "player" ? "【主角】" : "【剧情】"}${t.segments.map((s) => (s.kind === "dialogue" ? `「${s.speaker}」：${s.text}` : s.text)).join(" ")}`).join("\n").slice(-2400);
  return `【主线最近剧情（仅作背景；你只知道自己在场或被告知的部分）】\n${txt}`;
}

/* 给 AI 的私有知识库段落：只含这一位 NPC 的内容 */
/* 内容池的身份 / 关系以玩家视角书写（「你的经纪人」）；交给 NPC 扮演时「你」会被误读成 NPC 自己，统一改成「主角」 */
export const toNpcPov = (t?: string) => (t ?? "").trim().replace(/你们/g, "你和主角").replace(/你/g, "主角");

export function kbBlock(g: GameState, id: string): string {
  const kb = kbOf(g, id);
  const p = kb.profile;
  const row = (k: string, v?: string) => (v?.trim() ? `${k}：${v.trim()}\n` : "");
  const list = (l: KbMem[]) => l.map((m) => `· ${m.t ? `[${m.t}] ` : ""}${m.text}`).join("\n");
  // 时间线：玩家 / 作者为 TA 定下的过往经历（全部视为 TA 亲身记得的事）+ 今天与近期的安排
  const tl = timelineBuckets({ id, persona: g.npcs.find((n) => n.id === id)?.persona }, g.sim?.day ?? 0);
  let pastTxt = "";
  for (const e of [...tl.past].reverse()) { const l = `· ${line(e)}\n`; if (pastTxt.length + l.length > 1600) break; pastTxt = l + pastTxt; } // 超长时保留最近的
  const tlTxt = `${pastTxt ? `〈你的过往经历（这些是你亲身经历、清楚记得的事，可自然回忆、提起，但不要逐条背诵）〉\n${pastTxt}` : ""}${tl.now.length ? `〈你今天（${tl.today}）的安排〉\n${tl.now.map((e) => `· ${line(e)}`).join("\n")}\n` : ""}${tl.soon.length ? `〈你近期的安排（还没发生）〉\n${tl.soon.map((e) => `· ${line(e)}`).join("\n")}\n` : ""}`;
  return `【${p.name}的私有知识库 · 仅你本人知道，其他角色不可见】
〈人设档案〉
${row("姓名", p.name)}${row("年龄", p.age)}${row("职业", p.job)}${row("家境档位", p.wealth)}${row("性格", p.personality)}${row("固有身份", toNpcPov(p.identity))}${row("与主角关系", toNpcPov(p.relation))}${row("小传", p.bio)}${resumeText(id) ? `〈背景履历〉\n${resumeText(id)}\n` : ""}${tlTxt}${relationPromptFor(g, id)}
〈你自己的近况〉
${kb.selfSummary ? `（较早）${kb.selfSummary}\n` : ""}${list(kb.selfMemory) || "（暂无特别的事）"}
${kb.heard?.length ? `〈听别人说起的（传闻，未必属实，可以半信半疑地提起）〉\n${list(kb.heard)}\n` : ""}〈你和主角之间发生过的事〉
${kb.playerSummary ? `（较早）${kb.playerSummary}\n` : ""}${list(kb.playerMemory) || "（还没什么往来）"}
【知识边界】你只知道：上面的私有知识库 + 下方公共设定 + 本次对话里主角亲口告诉你的事。别人和主角之间的私事、你没亲历也没人告诉你的事，一律不知道，被问到要自然地表示不清楚；说话必须符合你的职业、年龄、家境与性格，不说超出身份的话。`;
}

/* 给 AI 的爱慕段落：读关系引擎的心动轴 sim.relations[id].romantic（人物页「爱慕」滑条改的就是它）。
 * 爱慕与好感（sim.rel）是两条独立的轴；不注入的话 AI 只看得到好感，爱慕 0 与满值聊起来毫无区别。
 * 分档以告白门槛为锚，门槛以上按该角色的爱慕上限再分两档（上限 1000 的角色不会在 100 就封顶）。
 * 父母、子女不注入（亲情线）；玩家设为「不可攻略」的人改注入「没有恋爱可能」，防止 AI 自行暧昧。
 * brief=true 给群聊成员卡用，只输出一行数值与档位。 */
const LOVE_TIERS: [string, string][] = [
  ["毫无心动", "对主角还没有任何心动，只当普通朋友或熟人相处：不主动暧昧、不吃醋、不说情话；主角撩你时按性格自然应对（装傻、打哈哈、婉拒或调侃），不会突然动情"],
  ["隐约在意", "对主角有一点说不清的在意：偶尔多问一句、多关心一下，自己都没意识到这是心动，表面仍是普通关系"],
  ["暗暗心动", "已经悄悄喜欢上主角：格外在意 TA 的消息和近况，会不自觉地关心、试探、害羞或嘴硬，但不会说破"],
  ["明显动心", "明显喜欢主角：主动找话题、想见面，语气藏不住甜和在意，会吃醋，偶尔大胆暧昧"],
  ["深深爱慕", "深深爱着主角，满心都是 TA：偏爱写在每句话里，亲昵、黏人，占有欲和醋意都很明显"],
];
/* 爱慕读数与分档（romanceBlock、toneCue 共用）；tier 即 LOVE_TIERS 的下标 */
function loveGauge(sim: GameState["sim"], id: string) {
  const v = Math.round(relOf(sim, id).romantic);
  const gate = RELATIONS.confess?.romanticMin || 60;
  const cap = Math.max(gate, romanticCapOf(id));
  return { v, gate, cap, tier: v >= (gate + cap) / 2 ? 4 : v >= gate ? 3 : v >= gate / 2 ? 2 : v > 0 ? 1 : 0 };
}
export function romanceBlock(g: GameState, id: string, brief = false): string {
  if (!g.sim || romanceFixedOff(g.sim, id)) return "";
  if (!canRomance(g.sim, id)) {
    return brief
      ? "不可攻略（对主角没有恋爱可能）"
      : "【你对主角的感情】你和主角之间没有恋爱可能（不可攻略）：你不会对主角产生任何心动，只按好感当朋友、同事或熟人相处——不暧昧、不吃醋、不说情话；主角示好或撩你时，按性格自然地装傻、打哈哈、婉拒或调侃，绝不动心。好感与信任照常可以加深，你们可以成为很好的朋友。";
  }
  const { v, gate, cap, tier } = loveGauge(g.sim, id);
  const [label, how] = LOVE_TIERS[tier];
  const status = g.sim.spouses?.includes(id) ? "与主角已婚" : hasPartner(g.sim, id) ? "与主角恋爱中" : "";
  const head = `爱慕 ${v}/${cap}（${label}${status ? `·${status}` : ""}）`;
  if (brief) return head;
  return `【你对主角的爱慕】${head}：你${how}。${!status && v >= gate ? "你们还没确认关系，别以恋人自居。" : ""}爱慕是私下的心动，与好感分开计算——好感决定熟不熟、暖不暖，爱慕决定有没有心动，按两者共同的分寸来演。`;
}

/* 相处分寸（私聊、通话、当面交谈共用）：好感定熟络，爱慕定心动。
 * 私聊规则原先只按好感下指令，好感低就「简短、略显疏离」，而开局好感大多是 0——人物页把爱慕拉满后，AI 夹在两条矛盾的指令之间，常常照样回得冷淡。
 * 爱慕到「暗暗心动」以上就不再下冷淡指令，改成「不熟但心动」的演法，并写明两者冲突时心动优先。家人与不可攻略的人只看好感。 */
export function toneCue(g: GameState, id: string): string {
  const rel = affinityOf(g, id);
  const tier = g.sim && !romanceFixedOff(g.sim, id) && canRomance(g.sim, id) ? loveGauge(g.sim, id).tier : -1;
  const warm = rel >= 70 ? "你们关系很好，话多、语气暖，会主动关心 TA"
    : rel >= 40 ? "你们还算熟络，自然、有来有往"
    : rel >= 15 ? "你们只是相识，客气但不算亲近"
    : tier >= 2 ? "你们还不太熟" : "你们不太熟，话少、略显疏离";
  if (tier < 0) return warm;
  if (tier < 2) return `${warm}；${tier ? "你对 TA 有一点说不清的在意，偶尔多问一句、多关心一下，表面仍按熟悉程度来" : "你对 TA 没有心动，再熟也只是朋友式的亲近，不暧昧、不吃醋"}`;
  const love = [
    "你已经悄悄喜欢上 TA：比对别人上心，忍不住多说几句、关心或试探，嘴上可以别扭、害羞、装不在意，但不会冷淡敷衍",
    "你明显喜欢 TA：主动找话题、想多聊多见面，语气藏不住甜和在意，会吃醋",
    "你深深爱着 TA：满心都是 TA，话多、亲昵、黏人，偏爱和醋意都藏不住，舍不得冷落 TA",
  ][tier - 2];
  return `${warm}${rel >= 40 ? "，而且" : "，但"}${love}——心动比熟不熟更决定你的态度`;
}

/* 好感读数：确定性引擎 s.rel 是唯一真相（人物页滑条、聊天、主线都写它）；
 * 还没有引擎条目的人物（AI 临时创建 / 旧存档）回退到展示值 npc.affinity，与人物页显示一致。 */
export function affinityOf(g: GameState, id: string): number {
  return g.sim?.rel?.[id] ?? g.npcs.find((n) => n.id === id)?.affinity ?? 0;
}

/* —— NPC 之间的知识流动：同处一地的人会闲聊，把各自与主角的近事传给对方 ——
 * 只传「与主角相关的最近一条」且概率触发，确定性（按 tick 哈希），不调 AI。 */
const HEARD_MAX = 8;
const h01 = (str: string) => { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };
export function gossipTick(g: GameState, mobs: Record<string, string>, tick: number, t: string): { g: GameState; spread: { from: string; to: string }[] } {
  const byRoom: Record<string, string[]> = {};
  for (const [id, room] of Object.entries(mobs)) (byRoom[room] ??= []).push(id);
  let kbs = g.npcKb ?? {};
  const spread: { from: string; to: string }[] = [];
  for (const ids of Object.values(byRoom)) {
    if (ids.length < 2) continue;
    for (const a of ids) for (const b of ids) {
      if (a === b || h01(`${a}>${b}:${tick}`) > 0.35) continue;
      const src = kbs[a]?.playerMemory.at(-1);
      if (!src) continue;
      const name = kbs[a]?.profile.name ?? PERSON_BY_ID[a]?.name ?? a;
      const text = `听${name}说：${src.text}`.slice(0, 160);
      const kb = kbs[b] ?? kbOf(g, b);
      if ((kb.heard ?? []).some((m) => m.text === text)) continue;
      kbs = { ...kbs, [b]: { ...kb, heard: [...(kb.heard ?? []), { t, text }].slice(-HEARD_MAX) } };
      spread.push({ from: a, to: b });
    }
  }
  return { g: spread.length ? { ...g, npcKb: kbs } : g, spread };
}

/* —— 生活费：代码结算 —— */
export type AllowanceState = { paidPeriod?: number; lastNegWeek?: number };
export const periodOf = (week: number) => Math.floor((week - 1) / Math.max(1, allowanceCfg()?.everyWeeks ?? 4));

/* 本期是否该发：每个周期只发一次 */
export function dueAllowance(g: GameState): { period: number; amount: number; tier: AllowanceTier } | null {
  if (!allowanceOn()) return null;
  const tier = wealthTier(g);
  if (!tier) return null;
  const period = periodOf(g.sim.week);
  if ((g.allowance?.paidPeriod ?? -1) >= period) return null;
  return { period, amount: Math.max(0, Math.round(tier.base)), tier };
}

/* 协商：成功率 = 档位基础 ± 好感修正，判定完全在代码里 */
export function negotiateAllowance(g: GameState): { ok: boolean; amount: number; reason: string; chance: number } | { blocked: string } {
  const cfg = allowanceCfg();
  const tier = wealthTier(g);
  if (!cfg || !tier) return { blocked: "本模组没有生活费系统" };
  const cd = cfg.cooldownWeeks ?? 2;
  const last = g.allowance?.lastNegWeek;
  if (last != null && g.sim.week - last < cd) return { blocked: `刚谈过不久，再过 ${cd - (g.sim.week - last)} 周再开口吧` };
  const rel = g.sim.rel[payerId()] ?? g.npcs.find((n) => n.id === payerId())?.affinity ?? 50;
  const chance = Math.max(0.05, Math.min(0.95, tier.negotiate + (rel - 60) / 400));
  const ok = Math.random() < chance;
  return { ok, amount: ok ? Math.max(0, Math.round(tier.bonus)) : 0, chance, reason: ok ? "同意补贴" : "这次没答应" };
}

/* 生活费到账消息的兜底话术（未配 AI 时）：由人设拼装，不是固定模板；金额只出现在代码生成的转账卡里 */
export function allowanceFallback(g: GameState): string[] {
  const kb = kbOf(g, payerId());
  const p = kb.profile;
  const strict = /严|方正|寡言|克制|固执/.test(p.personality ?? "");
  const warm = /温柔|慈|心疼|开朗|包容/.test(p.personality ?? "");
  const me = p.relation === "父亲" ? "爸" : p.relation === "母亲" ? "妈" : "我";
  const tone = strict ? "这个月的钱打过去了，省着点花。" : warm ? "生活费给你转过去啦，别舍不得吃饭～" : "这个月生活费到了，记得收一下。";
  const tail = kb.playerMemory.at(-1)?.text ? (strict ? "上回跟你说的事，自己心里有数。" : `上回你说的事，${me}一直记着呢。`) : p.job ? `${me}这阵子${p.job}那边忙，有事给${me}留言。` : "";
  return [tone, tail].filter(Boolean);
}
