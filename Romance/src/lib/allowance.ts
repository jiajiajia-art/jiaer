/* 父母生活费 · 对话层
 * 金额 / 成败全部由 game/npcKnowledge 代码判定；这里只请 AI 按父母人设「怎么说」，
 * 再把代码生成的转账卡推进私聊，事件写入父母的私有知识库。 */
import type { AIConfig, GameState } from "./types";
import { isConfigured } from "./ai";
import { requestChatReply } from "./phoneChat";
import { gameMinutes, gameTimeLabel, msgId, openThread, pushMsg, threadFor, ensurePhone } from "../game/phone";
import { allowanceFallback, dueAllowance, kbOf, negotiateAllowance, payerId, remember } from "../game/npcKnowledge";
import { moneyFromText, type XMsg } from "../components/phone/wxFeatures";

type Ctx = { cfg: AIConfig; get: () => GameState | null; commit: (g: GameState) => void };

const npcMsg = (g: GameState, text: string, extra: Partial<XMsg> = {}): XMsg =>
  ({ id: msgId(), role: "npc", text, ts: Date.now(), gt: gameMinutes(g), label: gameTimeLabel(g), ...extra }) as XMsg;
const transfer = (g: GameState, amount: number, note: string) =>
  npcMsg(g, note, { kind: "transfer", amount, note, pstate: "pending" });

/* 让 AI 按人设说几句（系统已定好结果，AI 不得改动金额）；失败 / 未配置 → 人设兜底 */
async function voice(ctx: Ctx, g: GameState, instruction: string, fallback: string[]): Promise<string[]> {
  const t = threadFor(ensurePhone(g).phone!, payerId());
  if (!t || !isConfigured(ctx.cfg)) return fallback;
  try {
    const r = await requestChatReply(ctx.cfg, g, t, `【系统提示，非主角发言】${instruction}\n只输出 1~3 条消息；不要报具体金额数字，不要发 [转账]；read_only 与 busy 必须为 false。`);
    const b = r.bubbles.filter((x) => !moneyFromText(x) && !/\d{2,}\s*(元|块)/.test(x));
    return b.length ? b : fallback;
  } catch {
    return fallback;
  }
}

/* 到期发放：先在代码里记账（防重复），再补一段人设话术 + 待收款转账卡 */
export async function payAllowanceIfDue(ctx: Ctx): Promise<void> {
  let g = ctx.get();
  if (!g) return;
  const due = dueAllowance(g);
  if (!due) return;
  const pid = payerId();
  if (!g.npcs.some((n) => n.id === pid)) return;
  g = openThread({ ...g, allowance: { ...(g.allowance ?? {}), paidPeriod: due.period } }, pid);
  ctx.commit(g);
  const kb = kbOf(g, pid).profile;
  const lines = await voice(ctx, g, `这期生活费到账了（家境档位「${due.tier.label}」，系统已转账）。请以你的身份、职业、性格和家境，给孩子发几句转账时会说的话，可以叮嘱、唠叨或分享你自己的近况，别和上次说得一样。`, allowanceFallback(g));
  g = ctx.get() ?? g;
  const tid = threadFor(ensurePhone(g).phone!, pid)!.id;
  for (const l of lines) g = pushMsg(g, tid, npcMsg(g, l));
  g = pushMsg(g, tid, transfer(g, due.amount, "生活费"));
  g = remember(g, pid, "player", `给孩子转了这期生活费（${kb.wealth ?? "按家里条件"}）`, gameTimeLabel(g));
  ctx.commit(g);
}

/* 聊聊生活费：成败由代码掷骰，AI 只演绎反应；结果写入父母记忆 */
export async function talkAllowance(ctx: Ctx, ask: string): Promise<string | null> {
  let g = ctx.get();
  if (!g) return null;
  const pid = payerId();
  const r = negotiateAllowance(g);
  if ("blocked" in r) return r.blocked;
  g = openThread({ ...g, allowance: { ...(g.allowance ?? {}), lastNegWeek: g.sim.week } }, pid);
  const tid = threadFor(ensurePhone(g).phone!, pid)!.id;
  g = pushMsg(g, tid, { id: msgId(), role: "me", text: ask, ts: Date.now(), gt: gameMinutes(g), label: gameTimeLabel(g) });
  ctx.commit(g);
  const fb = r.ok ? ["行吧，这次先给你补一点，下不为例。"] : ["这个月家里也紧，先省着点用吧。"];
  const lines = await voice(ctx, g, `孩子刚开口想多要点生活费：「${ask}」。系统判定结果：${r.ok ? "你同意了，额外补贴（系统转账）" : "你这次没有同意"}。请按你的性格、职业和家境自然地回应，结果不能改。`, fb);
  g = ctx.get() ?? g;
  for (const l of lines) g = pushMsg(g, tid, npcMsg(g, l));
  if (r.ok && r.amount > 0) g = pushMsg(g, tid, transfer(g, r.amount, "补贴"));
  g = remember(g, pid, "player", r.ok ? `孩子来要生活费，答应补贴了一笔` : `孩子来要生活费，这次没答应`, gameTimeLabel(g));
  ctx.commit(g);
  return null;
}
