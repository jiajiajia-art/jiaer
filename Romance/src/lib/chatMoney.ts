/* ————— 聊天里的钱：红包 / 转账「收不收」「发不发」的判定 —————
 * AI 只负责表态（JSON 的 accept_money / gift），金额、上限、频率以及父母给的钱一律由这里的代码决定；
 * AI 漏填字段时，按它说出口的话兜底——保证聊天里嘴上说的，和钱包里真实发生的一致。 */
import type { GameState } from "./types";
import { isParent, wealthTier } from "../game/npcKnowledge";
import { familyProfiles } from "../game/family";
import { gameMinutes } from "../game/phone";
import { walletDef, wallet } from "../game/wallet";

export type Gift = { kind: "redpacket" | "transfer"; amount?: number; note?: string };

const RED_CAP = 200; // 单个红包上限（与主角发红包一致）
const TRANSFER_CAP = 2000; // NPC 主动转账上限：防止哄几句就源源不断地要钱
const GAP_OTHER = 1440; // 同一个人一天最多主动给一次钱
const GAP_PARENT = 3 * 1440; // 父母的小红包 3 天一次；生活费另走 allowance

const isStranger = (pid: string) => pid.startsWith("stg_");
// 回执 / 状态文字（已收款、已退还、还没领……），不是一笔新的钱
const ACK_RE = /已(收|领|退)|收款|领取|退还|退回|没领|没收|还没/;

/* JSON 里的 gift 字段 → Gift；kind 认中英文，金额容忍「¥88」「88元」这类写法 */
export function parseGift(x: unknown): Gift | undefined {
  if (!x || typeof x !== "object") return undefined;
  const o = x as Record<string, unknown>;
  const k = String(o.kind ?? o.type ?? "");
  const kind = /transfer|转账/i.test(k) ? "transfer" : /red|红包/i.test(k) ? "redpacket" : undefined;
  if (!kind) return undefined;
  const n = Number(String(o.amount ?? "").replace(/[^\d.]/g, ""));
  const note = typeof o.note === "string" ? o.note.replace(/[[\]【】]/g, "").trim().slice(0, 20) : "";
  if (ACK_RE.test(note)) return undefined;
  return { kind, ...(n > 0 ? { amount: n } : {}), ...(note ? { note } : {}) };
}

/* 气泡里夹的「[红包 ¥88：生日快乐]」「【转账 100 灵石】」：取出成 Gift，返回剩下的文字 */
const BRACKET_RE = /[[【](红包|转账)\s*[¥￥]?\s*(\d+(?:\.\d{1,2})?)?\s*(?:元|块|[\u4e00-\u9fa5A-Za-z]{1,4})?(?:[：:]\s*([^\]】]*))?[\]】]/;
export function giftInText(text: string): { gift?: Gift; rest: string } | null {
  const m = text.match(BRACKET_RE);
  if (!m) return null;
  const rest = text.replace(m[0], "").trim();
  const note = (m[3] ?? "").replace(/（.*?）|\(.*?\)/g, "").trim().slice(0, 20);
  // 抄了历史里的状态文字（「[转账 ¥100（已收款）]」）：不是新的钱，整段丢掉
  if (ACK_RE.test(m[0])) return { rest };
  const n = Number(m[2]);
  return { gift: { kind: m[1] === "红包" ? "redpacket" : "transfer", ...(n > 0 ? { amount: n } : {}), ...(note ? { note } : {}) }, rest };
}

/* AI 嘴上说了「给你发个红包」「钱转你了」却没填 gift：当场兑现（语气是假设、提问、以后再说的不算） */
const GIVE_RE = /(给你|给宝贝|给宝宝|给闺女|给女儿|给儿子|给孩子|给大家|给你们)(先)?(发|包|转|打|塞)(了)?(个|一个|点|些|笔|一笔)?(小|大)?(红包|钱|零花钱|账)|(红包|钱)[^，。！？!?]{0,4}(发|转|打|塞)(过去|给你|你)(了|啦|咯)?/;
const NOT_NOW_RE = /(不|别|没|甭)(会|用|要|想|能|打算|准备)?[^，。！？]{0,3}(发|转|打|塞|给)|你给我|给我(发|转)|以后|改天|下次|回头|等(你|我)|等会|等下|待会|一会|晚点|晚些|明天|明儿|过年(再|的时候)|到时候|要是|如果|假如|万一|要不要|行不行|好不好|[?？]|[吗嘛]$/;
export function promisedGift(text: string): Gift | null {
  const m = text.match(GIVE_RE);
  if (!m || NOT_NOW_RE.test(text)) return null;
  const amt = text.match(/[¥￥]\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:块钱|块|元)|(\d+(?:\.\d{1,2})?)\s*的红包/);
  const n = Number(amt?.[1] ?? amt?.[2] ?? amt?.[3]);
  return { kind: /红包/.test(m[0]) ? "redpacket" : "transfer", ...(n > 0 ? { amount: n } : {}) };
}

export { moneyStance, moneyDecision } from "./chatMoneyStance";

/* 这个人最近一次主动给主角钱的时间（私聊 + 群聊；收款 / 退还回执不算） */
export function lastGiftAt(g: GameState, pid: string): number | undefined {
  let last: number | undefined;
  for (const t of g.phone?.threads ?? []) {
    for (const m of t.msgs) {
      const x = m as typeof m & { kind?: string; ack?: boolean };
      if (m.role !== "npc" || (x.kind !== "redpacket" && x.kind !== "transfer") || x.ack || /^已(收款|退还|退回)$/.test(m.text)) continue;
      if ((t.kind === "group" ? m.from : t.personId) === pid && (last === undefined || m.gt > last)) last = m.gt;
    }
  }
  return last;
}
export function canGift(g: GameState, pid: string): boolean {
  if (isStranger(pid)) return false;
  const last = lastGiftAt(g, pid);
  return last === undefined || gameMinutes(g) - last >= (isParent(pid) ? GAP_PARENT : GAP_OTHER);
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const NICE = [10, 20, 30, 50, 66, 88, 100, 128, 166, 188, 200, 300, 500, 666, 800, 1000, 1500, 2000];
const nice = (x: number) => NICE.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));

/* 父母给的钱：金额完全由代码按家境定，AI 写了数字也不采用 */
function parentAmount(g: GameState, kind: Gift["kind"]): number {
  const tier = wealthTier(g);
  if (tier) {
    const base = Math.max(50, tier.base) * (0.7 + Math.random() * 0.6);
    return nice(kind === "redpacket" ? Math.min(RED_CAP, base * 0.1) : Math.min(TRANSFER_CAP, base * 0.3));
  }
  const hay = [g.player.klass, g.player.background, ...familyProfiles(g.player).map((p) => p.job)].join(" ");
  const rich = /殷实|名门|贵族|富|豪|高管|企业|老板|名角/.test(hay);
  const poor = /清贫|贫|困难|拮据|下岗|农|种地|打工/.test(hay);
  return kind === "redpacket" ? pick(rich ? [166, 188, 200] : poor ? [20, 30, 50] : [50, 66, 88]) : pick(rich ? [800, 1000, 1500] : poor ? [100, 150, 200] : [200, 300, 500]);
}

/* 把 AI 想发的钱落成一张真实的卡片：频率不够、陌生人、父母借机发「生活费」→ 不发（返回 null）。
 * 自定义货币（灵石 / 金币…）按整数记账，上限沿用同样的数值 */
export function giftCard(g: GameState, pid: string, gift: Gift): { kind: Gift["kind"]; amount: number; note: string; text: string } | null {
  if (!canGift(g, pid)) return null;
  const parent = isParent(pid);
  if (parent && /生活费|补贴/.test(gift.note ?? "")) return null; // 生活费只走代码结算的 allowance
  const red = gift.kind === "redpacket";
  const int = !!walletDef(g);
  let amount = parent ? parentAmount(g, gift.kind) : gift.amount ?? (red ? pick(int ? [6, 8, 16, 20, 52, 66, 88] : [6.66, 8.88, 16.8, 20, 52, 66, 88]) : pick([50, 100, 200]));
  amount = Math.min(amount, red ? RED_CAP : TRANSFER_CAP);
  amount = int ? Math.max(1, Math.round(amount)) : Math.max(0.01, Math.round(amount * 100) / 100);
  const note = gift.note?.trim() || (red ? "恭喜发财，大吉大利" : "");
  return { kind: gift.kind, amount, note, text: note };
}

/* 金额单位：钱包绑定了自定义货币就用它的名字（灵石 / 金币…），否则「元」 */
export function giftUnit(g: GameState): string {
  return walletDef(g) ? wallet.name(g, "零钱") : "元";
}

/* 提示词里关于「给主角钱」的规则：说了要发就必须真发；父母不报金额；最近刚给过就别再提 */
export function giftRule(g: GameState, pid: string): string {
  if (isStranger(pid)) return "【金钱】你们只是刚认识的网友，不给主角发红包或转账，gift 保持 null。";
  const can = canGift(g, pid);
  if (isParent(pid)) {
    return `【金钱红线】生活费、补贴全部由系统按时结算，你绝不能自己承诺或报出具体数额，也不要在消息里写 [转账]/[红包]，只说态度与叮嘱。逢年过节、孩子有喜事或受了委屈想哄哄时，可以发个小红包表心意：在 JSON 的 gift 里填 {"kind": "redpacket", "note": "祝福语"}，金额由系统按家里条件定，你不要写数字。${can ? "" : "你最近刚给孩子发过钱，这次不要再发，也别说要发。"}`;
  }
  if (!can) return "【金钱】你最近刚给主角发过钱，这次不要再发红包或转账，也别说要发，gift 保持 null。";
  const unit = giftUnit(g);
  return `【金钱】平时不用给主角发钱。逢年过节、主角过生日或有喜事、你想道谢或赔个不是、知道主角手头紧时，如果合你的人设和你们的交情，可以发个红包或转账：在 JSON 的 gift 里填 {"kind": "redpacket" 或 "transfer", "amount": 金额数字, "note": "附言"}，红包最多 ${RED_CAP} ${unit}，转账最多 ${TRANSFER_CAP} ${unit}，不要在消息里写 [转账]/[红包]。说了要发就必须真发：消息里说了「给你发个红包」「钱转你了」，gift 就不能是 null；不打算发就别这么说。`;
}

/* 群聊提示词里的「给主角发红包」规则：群里只发红包；按各成员的频率限制点名这轮谁能发（names：成员 id → 名字） */
export function groupGiftRule(g: GameState, names: Record<string, string>): string {
  const can = Object.keys(names).filter((id) => canGift(g, id));
  if (!can.length) return "这轮谁都不给主角发红包，也别说要发，lines 里的 gift 一律为 null。";
  return `平时不用给主角发钱。逢年过节、主角有喜事、想谢谢主角或起哄庆祝时，合人设、交情够的成员可以在自己那条发言里填 "gift": {"kind": "redpacket", "amount": 金额数字, "note": "祝福语"}，最多 ${RED_CAP} ${giftUnit(g)}${can.some(isParent) ? "（主角的父母不写金额，由系统按家里条件定）" : ""}，不要在 text 里写 [红包]。说了"给大家发个红包""红包发群里了"就必须真填 gift，不打算发就别这么说。这轮只有 ${can.map((id) => names[id]).join("、")} 可以发，其他人别发，也别说要发。`;
}
