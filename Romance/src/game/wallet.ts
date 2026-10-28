/* 钱包：手机里所有收付款（购物、打赏、红包、转账、买票、闲鱼）的统一入口。
 * 默认记在游戏资金 sim.money（元）；存档在钱包页绑定某个自定义属性（如「灵石」）后，
 * 收付款都改记在该属性上。AI 主线里的赚钱 / 花钱则用该属性的 key 增减。 */
import type { AttrDef, GameState } from "../lib/types";

/** 自定义属性上限：不填（或 ≤0）= 无上限 */
export const attrCap = (max?: number) => (typeof max === "number" && max > 0 ? max : Infinity);

/** 当前绑定的货币属性；未绑定或属性已不存在时返回 undefined（= 用游戏资金） */
export function walletDef(g: GameState): AttrDef | undefined {
  const id = g.walletAttr;
  return id ? g.attrDefs?.find((d) => d.id === id) : undefined;
}

/** 自定义属性当前值（引擎 sim.cattrs 为准，缺省回落人物档案 / 初值） */
export function customAttrValue(g: GameState, d: AttrDef): number {
  return g.sim?.cattrs?.[d.id] ?? g.player.attrs.find((a) => a.key === d.id)?.value ?? d.init;
}

/** 写入自定义属性值：按上下限截断，同时写引擎（sim.cattrs）与人物档案，保持单一真相 */
export function setCustomAttr(g: GameState, d: AttrDef, value: number): GameState {
  const v = Math.max(d.min ?? 0, Math.min(attrCap(d.max), Math.round(value)));
  const has = g.player.attrs.some((a) => a.key === d.id);
  return {
    ...g,
    sim: { ...g.sim, cattrs: { ...(g.sim.cattrs ?? {}), [d.id]: v } },
    player: {
      ...g.player,
      attrs: has
        ? g.player.attrs.map((a) => (a.key === d.id ? { ...a, value: v } : a))
        : [...g.player.attrs, { key: d.id, label: d.label, value: v, max: d.max ?? 0, icon: d.icon }],
    },
  };
}

/* ================= 统一钱包接口 =================
 * 整个游戏（引擎结算、界面、手机应用、AI 回写）都通过 wallet.* 收付款与查余额：
 *   wallet.balance(x)        余额
 *   wallet.can(x, n)         付得起 n 吗（n ≤ 0 恒为 true）
 *   wallet.add(x, delta)     增减（不可变，返回同类型新对象；负数为支出）
 *   wallet.addIn(sim, delta) 原地增减（引擎内部对已克隆 sim 的结算用）
 *   wallet.fmt(n)            金额文案：「¥1,200」或「120 灵石」
 *   wallet.name()            货币名：「资金」或「灵石」
 * x 可以是整局游戏（GameState）或引擎状态（sim）。绑定了自定义货币属性时，收付改记在该属性上；
 * 未绑定则记在 sim.money。引擎函数只拿得到 sim，所以由 GameContext 用 setWalletSource 注册当前对局。 */
type Sim = GameState["sim"];
/** 最小钱袋：任何带 money（及可选 cattrs）的状态都能用 */
type Purse = { money: number; cattrs?: Record<string, number> };
type Holder = GameState | Purse;
let source: () => GameState | null | undefined = () => null;
/** GameContext 启动时注册一次「当前对局」读取器，引擎层据此知道绑定了哪种货币 */
export function setWalletSource(fn: () => GameState | null | undefined) { source = fn; }

const isGame = (x: Holder): x is GameState => !!x && typeof x === "object" && "sim" in x && "player" in x;
const gameOf = (x?: Holder) => (x && isGame(x) ? x : source() ?? undefined);
const defOf = (x?: Holder) => { const g = gameOf(x); return g ? walletDef(g) : undefined; };
const simOf = (x: Holder): Purse => (isGame(x) ? x.sim : x);

function balanceOf(x: Holder): number {
  const d = defOf(x), sim = simOf(x);
  if (!d) return sim?.money ?? 0;
  const g = gameOf(x);
  return sim?.cattrs?.[d.id] ?? (g ? customAttrValue(g, d) : d.init);
}
function simAdd<S extends Purse>(sim: S, delta: number, d: AttrDef | undefined, g?: GameState): S {
  if (!delta) return sim;
  if (!d) return { ...sim, money: sim.money + delta };
  const cur = sim.cattrs?.[d.id] ?? (g ? customAttrValue(g, d) : d.init);
  const v = Math.max(d.min ?? 0, Math.min(attrCap(d.max), Math.round(cur + delta)));
  return { ...sim, cattrs: { ...(sim.cattrs ?? {}), [d.id]: v } };
}
const yuanFmt = (n: number) => `¥${Math.round(n).toLocaleString("zh-CN")}`;

export const wallet = {
  balance: balanceOf,
  can: (x: Holder, n: number) => n <= 0 || balanceOf(x) >= n,
  add<T extends Holder>(x: T, delta: number): T {
    const d = defOf(x);
    if (isGame(x)) {
      if (!d) return { ...x, sim: { ...x.sim, money: x.sim.money + delta } } as T;
      return setCustomAttr(x, d, customAttrValue(x, d) + delta) as T;
    }
    return simAdd(x as Purse, delta, d, gameOf()) as T;
  },
  addIn(sim: Purse, delta: number): void {
    if (!delta) return;
    const d = defOf();
    if (!d) { sim.money += delta; return; }
    const g = gameOf();
    const cur = sim.cattrs?.[d.id] ?? (g ? customAttrValue(g, d) : d.init);
    sim.cattrs = { ...(sim.cattrs ?? {}), [d.id]: Math.max(d.min ?? 0, Math.min(attrCap(d.max), Math.round(cur + delta))) };
  },
  fmt(n: number, x?: Holder, yuan: (n: number) => string = yuanFmt): string {
    const d = defOf(x);
    return d ? `${Math.round(n).toLocaleString("zh-CN")} ${d.label}` : yuan(n);
  },
  /** 简写：未绑定时「¥1.2万」，绑定自定义货币时同 fmt */
  short: (n: number, x?: Holder) => (defOf(x) ? wallet.fmt(n, x) : `¥${(n / 10000).toFixed(1)}万`),
  name: (x?: Holder, fallback = "资金") => defOf(x)?.label ?? fallback,
  bound: (x?: Holder) => !!defOf(x),
};

/** 像货币的属性（名称或说明里提到货币/钱/币等），钱包绑定时优先推荐 */
export const looksLikeCurrency = (d: AttrDef) => /货币|钱|币|灵石|银两|金子|元宝|积分|点券/.test(`${d.label}${d.desc ?? ""}`);
