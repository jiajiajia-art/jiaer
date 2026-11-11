/**
 * 手机应用运行时：渲染 kkapp@1 配置应用（mods/kkmod/phoneApp.ts）。
 * KkAppView 只管界面；数值读写交给运行时适配器：
 *   - 游戏内（默认导出 KkAppRenderer）：引擎 applyEffectList 结算，一次性 / 冷却记在规则变量里随存档走；
 *   - 实时预览（KkAppPreviewHost）：沙盒适配器，不碰存档。
 */
import { useState } from "react";
import { useGame } from "../../store/gameCtx";
import { applyEffectList, evalFixedCond, metricVal } from "../../game/fixedEvents";
import { logAct } from "../../game/phoneLink";
import type { FixedCond, FixedEffect } from "../../lib/types";
import type { GameState as SimState } from "../../game/logic";
import type { KkAppAction, KkAppBlock, KkAppCond, KkAppSpec } from "../../mods/kkmod/phoneApp";
import { TopBar, BottomTabs } from "./shared";

const toCond = (c: KkAppCond): FixedCond =>
  "metric" in c ? { kind: "metric", key: c.metric, op: c.op, value: c.value }
  : "flag" in c ? { kind: "flag", key: c.flag, op: c.op, value: c.value }
  : { kind: "rel", key: c.rel, op: c.op, value: c.value };

const condsOk = (conds: KkAppCond[] | undefined, s: SimState) => !conds?.length || conds.every((c) => evalFixedCond(toCond(c), s));

const toEffect = (e: NonNullable<KkAppAction["effects"]>[number]): FixedEffect =>
  "metric" in e ? { kind: "metric", key: e.metric, delta: e.delta }
  : "flag" in e ? { kind: "flag", key: e.flag, delta: e.delta, ...(e.set ? { set: true } : {}) }
  : { kind: "rel", key: e.rel, delta: e.delta };

/** 文案占位：{c:属性id} {money} {fame} … 显示当前值 */
const fill = (text: string, rt: KkAppRuntime) => (rt.ready ? text.replace(/\{(c:[a-z0-9_]+|money|stress|energy|fame|reputation|works)\}/gi, (_m, k: string) => String(Math.round(rt.read(k)))) : text);

/** 运行时适配器：界面只通过它读数值、判条件、执行效果 */
export type KkAppRuntime = {
  ready: boolean;
  day: number;
  read: (metric: string) => number;
  condsOk: (conds: KkAppCond[] | undefined) => boolean;
  /** 上次执行日 + 1；0 = 从未执行 */
  lastRun: (actionId: string) => number;
  /** 结算动作效果并记下执行日，返回变化描述 */
  apply: (action: KkAppAction, actionId: string, appName: string) => string[];
};

/** 游戏内运行时：引擎结算并写存档 */
export default function KkAppRenderer({ appId, name, spec, onBack }: { appId: string; name: string; spec: KkAppSpec; onBack: () => void }) {
  const { game, commitGame } = useGame();
  const sim = game?.sim as SimState | undefined;
  const flagKey = (actionId: string) => `kkapp:${appId}:${actionId}`;
  const rt: KkAppRuntime = {
    ready: !!sim,
    day: sim?.day ?? 0,
    read: (m) => (sim ? metricVal(sim, m) : 0),
    condsOk: (conds) => !!sim && condsOk(conds, sim),
    lastRun: (id) => sim?.flags?.[flagKey(id)] ?? 0,
    apply: (a, id, appName) => {
      if (!game || !sim) return [];
      const effects: FixedEffect[] = (a.effects ?? []).map(toEffect);
      if (a.once || a.cooldownDays) effects.push({ kind: "flag", key: flagKey(id), delta: sim.day + 1, set: true });
      const { next, changes } = applyEffectList(sim, effects);
      commitGame(logAct({ ...game, sim: next }, { app: appName, text: a.log || `在「${appName}」里${changes.length ? `：${changes.join("、")}` : "操作了一次"}`, min: 5 }));
      return changes;
    },
  };
  return <KkAppView name={name} spec={spec} onBack={onBack} rt={rt} />;
}

export function KkAppView({ name, spec, onBack, rt }: { name: string; spec: KkAppSpec; onBack: () => void; rt: KkAppRuntime }) {
  const [pageId, setPageId] = useState(spec.home);
  const [stack, setStack] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const page = spec.pages.find((p) => p.id === pageId) ?? spec.pages[0];
  const tabs = spec.pages.filter((p) => p.tab).map((p) => ({ id: p.id, label: p.tab! }));
  const accent = spec.theme?.accent ?? "#0a84ff";
  const dark = !!spec.theme?.dark;

  /** 空串 = 可执行；否则返回不可执行原因 */
  const blockedReason = (a: KkAppAction, actionId: string): string => {
    if (!rt.ready) return "需要先开局";
    const last = rt.lastRun(actionId);
    if (a.once && last > 0) return "已完成";
    if (a.cooldownDays && last > 0 && rt.day - (last - 1) < a.cooldownDays) return `${a.cooldownDays - (rt.day - (last - 1))} 天后可再次进行`;
    if (!rt.condsOk(a.when)) return a.lockedHint || "条件未满足";
    return "";
  };

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(""), 2200); };

  const run = (a: KkAppAction, actionId: string) => {
    if (a.effects?.length || a.once || a.cooldownDays || a.log) {
      const why = blockedReason(a, actionId);
      if (why) { flash(why); return; }
      const changes = rt.apply(a, actionId, name);
      flash(a.toast || changes.join("、") || "已完成");
    } else if (a.toast) flash(a.toast);
    if (a.go && spec.pages.some((p) => p.id === a.go)) { setStack((s) => [...s, page.id]); setPageId(a.go); }
  };

  const back = () => {
    if (stack.length) { setPageId(stack[stack.length - 1]); setStack(stack.slice(0, -1)); return; }
    onBack();
  };

  const card = dark ? "bg-white/[0.06]" : "bg-[#f2f2f7]";
  const soft = dark ? "text-white/55" : "text-black/50";

  const renderBlock = (b: KkAppBlock, i: number) => {
    switch (b.kind) {
      case "header":
        return (
          <div key={i} className="overflow-hidden rounded-2xl" style={{ background: b.cover ? undefined : `${accent}1a` }}>
            {b.cover && <img src={b.cover} alt="" className="h-32 w-full object-cover" />}
            <div className="px-4 py-3">
              <p className="text-[18px] font-bold">{fill(b.title, rt)}</p>
              {b.subtitle && <p className={`mt-0.5 text-[13px] ${soft}`}>{fill(b.subtitle, rt)}</p>}
            </div>
          </div>
        );
      case "text":
        return rt.ready && !rt.condsOk(b.when) ? null : <p key={i} className="whitespace-pre-wrap px-1 text-[14px] leading-relaxed">{fill(b.text, rt)}</p>;
      case "notice": {
        if (rt.ready && !rt.condsOk(b.when)) return null;
        const tone = b.tone === "warn" ? "#ff9f0a" : b.tone === "good" ? "#30d158" : accent;
        return <p key={i} className="rounded-xl px-3 py-2 text-[13px] leading-relaxed" style={{ background: `${tone}1f`, color: tone }}>{fill(b.text, rt)}</p>;
      }
      case "stats":
        return (
          <div key={i} className="grid grid-cols-3 gap-2">
            {b.items.map((x) => (
              <div key={x.metric + x.label} className={`rounded-xl px-2 py-2 text-center ${card}`}>
                <p className="text-[17px] font-bold tabular-nums" style={{ color: accent }}>{rt.ready ? Math.round(rt.read(x.metric)) : "—"}</p>
                <p className={`text-[11px] ${soft}`}>{x.label}</p>
              </div>
            ))}
          </div>
        );
      case "list":
        return (
          <div key={i}>
            {b.title && <p className={`mb-1 px-1 text-[12px] font-semibold ${soft}`}>{b.title}</p>}
            <ul className={`divide-y overflow-hidden rounded-2xl ${card} ${dark ? "divide-white/10" : "divide-black/[0.06]"}`}>
              {b.items.filter((x) => !rt.ready || rt.condsOk(x.when)).map((x) => {
                const why = x.action ? blockedReason(x.action, `${page.id}.${x.id}`) : "";
                return (
                  <li key={x.id}>
                    <button type="button" disabled={!x.action} onClick={() => x.action && run(x.action, `${page.id}.${x.id}`)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default">
                      {x.image && <img src={x.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5"><b className="truncate text-[14px]">{fill(x.title, rt)}</b>{x.badge && <span className="shrink-0 rounded-full px-1.5 text-[10px] font-semibold text-white" style={{ background: accent }}>{x.badge}</span>}</span>
                        {x.subtitle && <span className={`block truncate text-[12.5px] ${soft}`}>{fill(x.subtitle, rt)}</span>}
                        {x.action && why && x.action.effects?.length ? <span className="block text-[11px] text-[#ff9f0a]">{why}</span> : null}
                      </span>
                      {x.meta && <span className={`shrink-0 text-[12px] ${soft}`}>{fill(x.meta, rt)}</span>}
                      {x.action?.go && <span className={soft}>›</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      case "feed":
        return (
          <div key={i} className="space-y-2">
            {b.posts.map((p) => (
              <article key={p.id} className={`rounded-2xl px-3 py-2.5 ${card}`}>
                <div className="flex items-center gap-2">
                  {p.avatar ? <img src={p.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: accent }}>{p.author.slice(0, 1)}</span>}
                  <b className="text-[13px]">{p.author}</b>
                  {p.time && <span className={`ml-auto text-[11px] ${soft}`}>{p.time}</span>}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">{fill(p.text, rt)}</p>
                {p.image && <img src={p.image} alt="" className="mt-2 max-h-48 w-full rounded-xl object-cover" />}
                {typeof p.likes === "number" && <p className={`mt-1 text-[11.5px] ${soft}`}>{p.likes} 赞</p>}
              </article>
            ))}
          </div>
        );
      case "chat":
        return (
          <div key={i} className="space-y-2">
            <p className={`text-center text-[12px] ${soft}`}>{b.contact}</p>
            {b.messages.map((m, j) => (
              <div key={j} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <span className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[14px] leading-relaxed ${m.from === "me" ? "text-white" : card}`} style={m.from === "me" ? { background: accent } : undefined}>{fill(m.text, rt)}</span>
              </div>
            ))}
          </div>
        );
      case "buttons":
        return (
          <div key={i} className="flex flex-col gap-2">
            {b.items.map((x) => {
              const id = `${page.id}.${x.id}`;
              const why = x.action.effects?.length || x.action.once || x.action.cooldownDays ? blockedReason(x.action, id) : "";
              return (
                <button key={x.id} type="button" onClick={() => run(x.action, id)} aria-disabled={!!why}
                  className={`rounded-2xl px-4 py-2.5 text-[14.5px] font-semibold transition active:scale-[0.98] ${why ? "opacity-45" : ""}`}
                  style={x.style === "plain" ? { color: accent, background: `${accent}14` } : { background: accent, color: "#fff" }}>
                  {x.label}{why ? <span className="ml-1 text-[11.5px] font-normal">（{why}）</span> : null}
                </button>
              );
            })}
          </div>
        );
      case "divider":
        return <hr key={i} className={dark ? "border-white/10" : "border-black/[0.06]"} />;
      default:
        return null;
    }
  };

  return (
    <div className={`relative flex h-full flex-col ${dark ? "bg-[#111] text-white" : "bg-white text-[#181818]"}`}>
      <TopBar title={stack.length ? page.title : name} onBack={back} dark={dark} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {page.blocks.length ? page.blocks.map(renderBlock) : <p className={`py-10 text-center text-[13px] ${soft}`}>这一页还没有内容</p>}
      </div>
      {tabs.length > 1 && <BottomTabs tabs={tabs} active={tabs.some((t) => t.id === page.id) ? page.id : tabs[0].id} onPick={(id) => { setStack([]); setPageId(id); }} />}
      {toast && <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center"><span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white">{toast}</span></div>}
    </div>
  );
}
