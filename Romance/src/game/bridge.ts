/* 牵线：主角主动促成两位 NPC 之间的往来——所有世界观与模组通用。
 * 不再预置「介绍认识 / 三人同行 / 撮合 / 劝和 / 挑拨」；默认无可用方式。
 * 需要牵线时请在固定事件 / 触发里自行配置。若旧稿或高级数据在 relations.bridge.modes
 * 里写了带 label 的自定义方式，运行时仍会读取（创作者界面不再引导去改 JSON）。
 *
 * need = 主角与两人好感都需达到的门槛；fx = [对当前人物 A, 对另一人 B] 的好感变化。
 * {a}/{b} 会替换成两人的名字。叙事与两人关系走向交给 AI；未接入 AI 时用 offline 文案。 */
import { RELATIONS } from "../worlds/star2005/content";

export type BridgeMode = string;
export type BridgeTone = "ink" | "jade" | "coral";
export type BridgeSpec = { label: string; verb: string; desc: string; need: number; fx: [number, number]; tone: BridgeTone; prompt: string; offline: string };
export type BridgeSlot = { perDay?: number; off?: boolean; modes?: Record<string, Partial<BridgeSpec> & { off?: boolean }> };

const slotOf = (): BridgeSlot => RELATIONS.bridge ?? {};
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export const bridgeEnabled = () => !slotOf().off && bridgeOrder().length > 0;
export const bridgePerDay = () => Math.max(1, Math.round(num(slotOf().perDay, 2)));

/** 功能注释：仅返回创作者显式配置且未关闭的牵线方式；引擎不再内置五种预设 */
export function bridgeModes(): Record<string, BridgeSpec> {
  const over = slotOf().modes ?? {};
  const out: Record<string, BridgeSpec> = {};
  for (const id of Object.keys(over)) {
    const o = over[id];
    if (!o || o.off) continue;
    const label = String(o.label ?? "").trim();
    if (!label) continue; // 自定义方式至少要有名字
    const fx = Array.isArray(o.fx) && o.fx.length === 2 ? [num(o.fx[0], 0), num(o.fx[1], 0)] as [number, number] : [2, 2];
    out[id] = {
      label,
      verb: o.verb ?? "往来",
      desc: o.desc ?? "",
      need: num(o.need, 20),
      fx: fx as [number, number],
      tone: o.tone ?? "ink",
      prompt: o.prompt ?? `主角促成{a}与{b}之间的「${label}」。写出两人的互动与关系变化。`,
      offline: o.offline ?? `你促成了{a}与{b}的「${label}」。`,
    };
  }
  return out;
}
export const bridgeOrder = () => Object.keys(bridgeModes());
export const fillPair = (t: string, a: string, b: string) => t.replace(/\{a\}/g, a).replace(/\{b\}/g, b);
