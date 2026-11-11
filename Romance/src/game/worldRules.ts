/* 世界·社会规则 → 确定性玩法效果。
 * GameContext 每次渲染同步当前存档的规则；各引擎（关系/通告/家庭）从这里读取，
 * 规则关闭时一律返回现实默认（mono / father / standard）。 */
import type { WorldRules } from "../lib/types";
import { liveTerm as T } from "../mods/live";

let active: { rules?: WorldRules; female: boolean; npcGender: Record<string, string> } = { female: true, npcGender: {} };

/* npcGender：本档人物的性别（人物编辑器 / 档案），供同性婚恋判定 */
export function syncWorldRules(rules: WorldRules | undefined, gender?: string, npcGender: Record<string, string> = {}) {
  active = { rules, female: !/男/.test(gender ?? "女"), npcGender };
}
export const npcGenderOf = (id: string): string | undefined => active.npcGender[id];

export const activeGender = (): "男" | "女" => (active.female ? "女" : "男");

export type RuleDim = "love" | "marriage" | "surname" | "order" | "birth" | "samesex" | "divorce" | "inherit";
export function ruleOf(dim: RuleDim): string {
  const def = { love: "loyal", marriage: "mono", surname: "father", order: "standard", birth: "female", samesex: "allow", divorce: "mutual", inherit: "equal" }[dim];
  const r = active.rules;
  return r?.enabled ? r.choices[dim] ?? def : def;
}

/* 恋爱模式：海王可同时与多人交往 */
export function allowsMultiPartner(): boolean {
  return ruleOf("love") === "player";
}

/* 婚姻制度：能否结婚、最多几位配偶（以主角性别为准） */
export function maxSpouses(): number {
  const m = ruleOf("marriage");
  if (m === "free") return 0;
  if ((m === "poly_husband" && active.female) || (m === "poly_wife" && !active.female)) return 4;
  return 1;
}

/* 同性婚恋：禁止时，与同性角色无法确认交往或成婚（对方性别未知时不拦截） */
export function sameSexBlocked(partnerGender?: string): string {
  if (ruleOf("samesex") !== "forbid" || !partnerGender) return "";
  return /男/.test(partnerGender) === !active.female ? "同性婚恋「禁止」：这个社会不认可同性之间的恋爱与婚姻。" : "";
}

/* 离婚权限 */
export const divorceMode = (): "mutual" | "unilateral" | "forbid" => ruleOf("divorce") as "mutual" | "unilateral" | "forbid";
export const DIVORCE_AGREE_MAX = 40; // 双方同意：配偶好感 ≤ 此值才愿意分开

/* 子嗣继承权：按规则给出每个子女的继承份额（0~1），无继承权为 0 */
export function inheritShares<C extends { id: string; birthDay: number; gender: string; legit?: boolean }>(kids: C[], mode = ruleOf("inherit")): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(kids.map((k) => [k.id, 0]));
  const legit = kids.filter((k) => k.legit);
  if (mode === "eldest") {
    const pool = [...legit].sort((a, b) => a.birthDay - b.birthDay);
    const heir = pool.find((k) => /男/.test(k.gender)) ?? pool[0];
    if (heir) out[heir.id] = 1;
    return out;
  }
  const w = (k: C) => (mode === "legit" ? (k.legit ? 1 : 0) : mode === "any" ? 1 : k.legit ? 1 : 0.5);
  const total = kids.reduce((a, k) => a + w(k), 0);
  if (total > 0) for (const k of kids) out[k.id] = w(k) / total;
  return out;
}

/* 社会秩序：主角所处性别的地位修正 */
export function orderMods(): { rate: number; pay: number; scandal: number } {
  const o = ruleOf("order");
  const favored = (o === "matriarchy" && active.female) || (o === "patriarchy" && !active.female);
  const disfavored = (o === "matriarchy" && !active.female) || (o === "patriarchy" && active.female);
  if (favored) return { rate: 6, pay: 0.15, scandal: 0.7 };
  if (disfavored) return { rate: -6, pay: -0.15, scandal: 1.3 };
  if (o === "egalitarian") return { rate: 2, pay: 0.05, scandal: 1 };
  return { rate: 0, pay: 0, scandal: 1 };
}

/* 社会秩序 · 通用收入修正：任何世界观里叙事带来的正向进账都按地位增减 */
export function orderIncome(delta: number): number {
  if (delta <= 0) return delta;
  const pay = orderMods().pay;
  return pay ? Math.round(delta * (1 + pay)) : delta;
}

/* 每条规则当前对玩法的真实影响（设置面板 / AI 上下文展示用）
 * hasGigs：当前世界观是否有工作委托系统；没有就不提完成率、口碑损失这类专属玩法 */
export function ruleEffects(dim: string, opt: string, female = true, hasGigs = false): string[] {
  switch (dim) {
    case "love":
      if (opt === "player") return ["可同时与多位角色交往", "每开始一段新恋情，现有恋人好感 -8", "所有恋人加成同时生效"];
      return ["同一时间只能有一位恋人", "已有恋人时，向他人表白 / 定情会被拒绝"];
    case "marriage":
      if (opt === "free") return ["这个世界没有婚姻，无法举办婚礼"];
      if ((opt === "poly_husband" && female) || (opt === "poly_wife" && !female))
        return ["恋人好感 ≥ 80 可举办婚礼结为夫妻", "你最多可有 4 位配偶"];
      return ["恋人好感 ≥ 80 可举办婚礼结为夫妻", "只能有一位配偶，婚后不能再与他人成婚"];
    case "surname":
      if (opt === "mother") return ["你随母姓：母亲与你同姓，父亲另有其姓", "你将来的孩子也随母方姓"];
      if (opt === "either") return ["你的姓氏由父母协商——父母各自保留本姓", "孩子随父或随母，出生时决定"];
      if (opt === "new") return ["你家另立新姓：父母均保留原姓，你的姓为新立", "孩子出生时另起新姓"];
      return ["你随父姓：父亲与你同姓", "你将来的孩子也随父方姓"];
    case "samesex":
      return opt === "forbid" ? ["与同性角色无法确认交往", "与同性角色无法举办婚礼"] : ["同性恋人可确认交往", "同性恋人可举办婚礼"];
    case "divorce":
      if (opt === "forbid") return ["婚姻不可解除，没有离婚入口"];
      if (opt === "unilateral") return ["你可随时提出离婚", "离婚后对方好感 -30，压力 +10"];
      return [`配偶好感 ≤ ${DIVORCE_AGREE_MAX} 时才会同意离婚`, "离婚后对方好感 -15，压力 +6"];
    case "inherit":
      if (opt === "eldest") return ["最年长的婚生儿子继承全部，无子则长女", "非婚生子女无继承权"];
      if (opt === "legit") return ["只有婚内所生子女有继承权，婚生子女均分"];
      if (opt === "any") return ["所有子女不论婚生与否均分"];
      return ["婚生子女各得一份，非婚生子女得半份"];
    case "birth":
      if (opt === "male") return female ? ["你（女性）不会因亲密而怀孕", "男性伴侣可能怀胎生子"] : ["亲密后你有概率受孕", "怀胎十月，第十一个月分娩；孩子将加入人脉"];
      if (opt === "both") return ["无论男女，亲密后都有概率受孕", "怀胎十月，第十一个月分娩；孩子将加入人脉"];
      return female ? ["亲密后你有概率受孕", "怀胎十月，第十一个月分娩；孩子将加入人脉"] : ["你（男性）不会怀孕", "女性伴侣可能怀胎生子"];
    case "order": {
      const favored = (opt === "matriarchy" && female) || (opt === "patriarchy" && !female);
      const dis = (opt === "matriarchy" && !female) || (opt === "patriarchy" && female);
      const money = T("money"), gig = T("gig"), rep = T("reputation");
      const me = female ? "女性" : "男性";
      if (favored) return [`你（${me}）处于优势地位：${money} +15%`, ...(hasGigs ? [`${gig}成功率 +6%`, `负面事件${rep}损失 -30%`] : []), "NPC 待你更恭敬，社会资源向你倾斜"];
      if (dis) return [`你（${me}）处于弱势地位：${money} -15%`, ...(hasGigs ? [`${gig}成功率 -6%`, `负面事件${rep}损失 +30%`] : []), "NPC 可能轻视你，需要更努力才能被认可"];
      if (opt === "egalitarian") return [`${money} +5%`, ...(hasGigs ? [`${gig}成功率 +2%`] : []), "性别不影响地位与机会"];
      return ["无额外修正（现实基准）"];
    }
  }
  return [];
}
