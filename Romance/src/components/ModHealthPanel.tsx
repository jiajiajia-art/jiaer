import { useMemo } from "react";
import { Chip } from "./ui";
import type { Mod } from "../mods/types";
import { addonImpact, balanceCheck, chainShadows, inheritedSlots, priorFor, type Impact } from "../mods/balance";
import { StatusMark } from "../lib/icons";

/* 模组编辑器 · 数值体检：只提醒、不拦截保存 */
const OP: Record<Impact["op"], { label: string; tone: string }> = {
  replace: { label: "整组替换", tone: "coral" },
  merge: { label: "覆盖", tone: "gold" },
  add: { label: "追加", tone: "jade" },
};

export function ImpactRow({ i }: { i: Impact }) {
  return (
    <li className="flex items-baseline gap-2 py-0.5 text-[12px]">
      <Chip tone={OP[i.op].tone}>{OP[i.op].label}</Chip>
      <span className="shrink-0 font-semibold text-ink">{i.label}</span>
      <span className="min-w-0 text-ink-soft">{i.text}</span>
    </li>
  );
}

export default function ModHealthPanel({ mod }: { mod: Mod }) {
  const prior = useMemo(() => priorFor(mod), [mod]);
  const findings = useMemo(() => balanceCheck(mod, prior[0]), [mod, prior]);
  const inherited = useMemo(() => inheritedSlots(mod), [mod]);
  const impacts = useMemo(() => (mod.kind === "addon" ? addonImpact(mod, prior) : []), [mod, prior]);
  const shadows = useMemo(() => (mod.kind === "addon" ? chainShadows([...prior, mod])[mod.id] ?? [] : []), [mod, prior]);
  const warn = findings.filter((f) => f.level === "warn").length;
  const num = impacts.filter((i) => i.numeric), other = impacts.filter((i) => !i.numeric);

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] leading-relaxed text-ink-soft">
        只提醒，不拦截保存。对比基准是娱乐圈原版数值，按本模组自己的能力上限折算，所以上限改成 100 也能比较。
        {mod.kind === "addon" && "叠加包只检查本包自己写的数值。"}
      </p>

      <div className={`rounded-xl border px-3 py-2 text-[12px] ${warn ? "border-gold/50 bg-gold/10" : "border-jade/40 bg-jade/5"}`}>
        {findings.length === 0
          ? <p className="font-semibold text-jade"><StatusMark kind="ok">没发现明显失衡</StatusMark></p>
          : <p className="font-semibold text-ink">{warn ? `${warn} 处可能失衡` : "没有明显失衡"}{findings.length - warn ? ` · ${findings.length - warn} 条提示` : ""}</p>}
        {findings.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {findings.map((f, i) => (
              <li key={i} className="flex items-baseline gap-2 leading-snug">
                <span className={`shrink-0 text-[10.5px] font-bold ${f.level === "warn" ? "text-gold" : "text-ink-soft"}`}>{f.level === "warn" ? <StatusMark kind="warn">{f.area}</StatusMark> : <>· {f.area}</>}</span>
                <span className="min-w-0 text-ink">{f.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inherited.length > 0 && (
        <div className="rounded-xl border border-line bg-paper p-3">
          <p className="text-[12px] font-bold text-ink">沿用娱乐圈的内容</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">本世界观没写这些，开局时会直接用娱乐圈原版。数值本身是平衡过的，但不一定贴合你的世界观。在对应区块填写即可替换。</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {inherited.map((s) => <Chip key={s.key} tone={s.numeric ? "gold" : undefined}>{s.label}</Chip>)}
          </div>
        </div>
      )}

      {mod.kind === "addon" && (
        <div className="rounded-xl border border-line bg-paper p-3">
          <p className="text-[12px] font-bold text-ink">叠加后的影响 <span className="font-normal text-ink-soft">· 叠加在「{prior.map((m) => m.name).join(" → ")}」之后 · {mod.slotMerge === "merge" ? "追加合并" : "整体替换"}</span></p>
          {impacts.length === 0 && <p className="mt-1 text-[11.5px] text-ink-soft">本包还没有写任何内容。</p>}
          {num.length > 0 && <ul className="mt-1.5">{num.map((i) => <ImpactRow key={i.key} i={i} />)}</ul>}
          {other.length > 0 && <p className="mt-1 text-[11px] text-ink-soft">不影响数值：{other.map((i) => `${i.label}（${i.text}）`).join("、")}</p>}
          {mod.slotMerge !== "merge" && num.some((i) => i.op === "replace") && (
            <p className="mt-1.5 text-[11px] text-coral">整组替换会丢掉原世界观的同类内容。只想加几项的话，在「基本信息」里把「列表内容合并方式」改成「追加合并」。</p>
          )}
          {shadows.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-gold">{shadows.map((s, i) => <li key={i}><StatusMark kind="warn">{s}</StatusMark></li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}
