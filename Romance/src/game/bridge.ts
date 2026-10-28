/* 牵线：主角主动促成两位 NPC 之间的往来——所有世界观与模组通用。
 * 引擎内置五种方式（介绍认识 / 三人同行 / 撮合 / 劝和 / 挑拨），世界观可在「关系设定」槽
 * relations.bridge 里改参数、关掉某种方式、或新增自定义方式：
 *
 *   relations:
 *     bridge:
 *       perDay: 2                 # 每天最多牵线几次
 *       off: false                # true = 本世界观不开放牵线
 *       modes:
 *         provoke: { off: true }  # 关掉「挑拨」
 *         duel:                   # 新增一种方式
 *           label: 约战切磋
 *           desc: 让两人比试一场
 *           need: 30
 *           fx: [2, 2]
 *           tone: coral
 *           prompt: "主角促成{a}与{b}比试一场……"
 *           offline: "{a}与{b}切磋了一场，不分胜负。"
 *
 * need = 主角与两人好感都需达到的门槛；fx = [对当前人物 A, 对另一人 B] 的好感变化。
 * {a}/{b} 会替换成两人的名字。叙事与两人关系走向交给 AI；未接入 AI 时用 offline 文案。 */
import { RELATIONS } from "../worlds/star2005/content";

export type BridgeMode = string;
export type BridgeTone = "ink" | "jade" | "coral";
export type BridgeSpec = { label: string; verb: string; desc: string; need: number; fx: [number, number]; tone: BridgeTone; prompt: string; offline: string };
export type BridgeSlot = { perDay?: number; off?: boolean; modes?: Record<string, Partial<BridgeSpec> & { off?: boolean }> };

const DEFAULTS: Record<string, BridgeSpec> = {
  intro: {
    label: "介绍认识", verb: "认识", desc: "做个中间人，让两人搭上话", need: 10, fx: [2, 2], tone: "jade",
    prompt: "主角做中间人，介绍{a}与{b}认识。写出初次见面的寒暄、彼此的第一印象，以及两人是否合得来。",
    offline: "你做了回中间人，{a}和{b}寒暄了几句。往后会不会有交集，就看他们自己了。",
  },
  hangout: {
    label: "三人同行", verb: "一起出去", desc: "约上两人一起消磨些时光", need: 25, fx: [3, 3], tone: "ink",
    prompt: "主角约{a}与{b}三人同行，按本世界观的风物安排一段相处时光。写出三人相处的氛围、两人之间的互动与小插曲，以及主角夹在中间的位置。",
    offline: "你约上{a}和{b}一起消磨了些时光。两人之间比之前熟络了些。",
  },
  match: {
    label: "撮合", verb: "多些相处机会", desc: "暗中给两人制造独处机会", need: 40, fx: [2, 2], tone: "coral",
    prompt: "主角有意撮合{a}与{b}，为两人制造独处机会。两人是否互有好感、会不会察觉被撮合、是心动还是尴尬，都由两人的性格与现有关系决定，不必强行成功。",
    offline: "你借故先走一步，把时间留给了{a}和{b}。两人之间有没有火花，暂时还看不出来。",
  },
  reconcile: {
    label: "劝和", verb: "化解心结", desc: "在两人之间调停矛盾", need: 35, fx: [3, 1], tone: "jade",
    prompt: "主角在{a}与{b}之间调停，试图化解两人的心结或误会。若两人本无矛盾，就写成一次坦诚的交心；若积怨已深，劝和可能只成功一半。",
    offline: "你分别找{a}和{b}谈了谈，两人之间的那点别扭似乎松动了一些。",
  },
  provoke: {
    label: "挑拨", verb: "产生嫌隙", desc: "站在 TA 这边，让两人生出嫌隙", need: 30, fx: [4, -6], tone: "coral",
    prompt: "主角站在{a}一边，暗中挑拨{a}与{b}的关系。写出挑拨的手段与两人的反应；{b}可能察觉主角的用意并因此疏远主角，{a}则可能更信任主角，也可能看穿这一切。",
    offline: "你在{a}面前有意无意地提起{b}的不是。{a}听进去了几分，而{b}对你的态度明显冷淡了。",
  },
};

const slotOf = (): BridgeSlot => RELATIONS.bridge ?? {};
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export const bridgeEnabled = () => !slotOf().off && bridgeOrder().length > 0;
export const bridgePerDay = () => Math.max(1, Math.round(num(slotOf().perDay, 2)));

/* 当前世界观生效的方式（内置 + 覆盖 + 新增，已剔除 off） */
export function bridgeModes(): Record<string, BridgeSpec> {
  const over = slotOf().modes ?? {};
  const out: Record<string, BridgeSpec> = {};
  for (const id of [...Object.keys(DEFAULTS), ...Object.keys(over).filter((k) => !(k in DEFAULTS))]) {
    const o = over[id];
    if (o?.off) continue;
    const base = DEFAULTS[id];
    const label = o?.label ?? base?.label;
    if (!label) continue; // 新增方式至少要有名字
    const fx = Array.isArray(o?.fx) && o.fx.length === 2 ? [num(o.fx[0], 0), num(o.fx[1], 0)] as [number, number] : base?.fx ?? [2, 2];
    out[id] = {
      label,
      verb: o?.verb ?? base?.verb ?? "往来",
      desc: o?.desc ?? base?.desc ?? "",
      need: num(o?.need, base?.need ?? 20),
      fx,
      tone: o?.tone ?? base?.tone ?? "ink",
      prompt: o?.prompt ?? base?.prompt ?? `主角促成{a}与{b}之间的「${label}」。写出两人的互动与关系变化。`,
      offline: o?.offline ?? base?.offline ?? `你促成了{a}与{b}的「${label}」。`,
    };
  }
  return out;
}
export const bridgeOrder = () => Object.keys(bridgeModes());
export const fillPair = (t: string, a: string, b: string) => t.replace(/\{a\}/g, a).replace(/\{b\}/g, b);
