import { IconClose } from "../lib/icons";
import { useEffect, useState, type ReactNode } from "react";
import { CondRow, useDraftDefaults } from "./FixedEventsPanel";
import ImagePicker from "./ImagePicker";
import { condsBrief } from "./ruleText";
import { ACCENTS, FONTS, SKINS } from "../lib/skins";
import { lookActive, lookSummary, type LookPatch, type LookRule } from "../lib/plotLook";
import { LIVE_PEOPLE as PEOPLE, getWorldLookRules } from "../mods/registry";
import { useDraftRefs } from "./draftRefsContext";
import { useGame } from "../store/gameCtx";
import type { FixedEvent } from "../lib/types";

/* 剧情美化规则编辑：条件（与固定事件同一套）+ 外观补丁。「试看」临时套用，不改任何设置。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const uid = () => `lk_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
const chip = (on: boolean) => `rounded-lg border px-2 py-1 text-[11.5px] transition ${on ? "border-jade bg-jade/15 font-bold text-jade" : "border-line bg-paper text-ink hover:border-jade/60"}`;

const TONES = [["none", "原色"], ["warm", "暖阳"], ["cool", "清冷"], ["dusk", "黄昏"], ["vintage", "旧胶片"], ["mono", "黑白"]] as const;
const DSTYLES = [["soft", "柔光卡片"], ["avg", "AVG 对话条"], ["letter", "信笺"], ["glass", "磨砂玻璃"], ["minimal", "极简"]] as const;
const BSTYLES = [["frost", "磨砂"], ["solid", "实色"], ["outline", "描边"], ["comic", "漫画"], ["plain", "无框"]] as const;
const TOPBARS = [["gradient", "流光渐变"], ["aurora", "极光幻彩"], ["plain", "简约纯色"]] as const;
const MODES = [["light", "浅色"], ["dark", "深色"]] as const;

const metric = (key: string, op: "gte" | "lte", value: number) => ({ kind: "metric" as const, key, op, value });
/* 功能注释：requires = 依赖的指标键；needsPeople = 需要人物。模组编辑器里只展示本作品具备的模板。 */
const TEMPLATES: { name: string; requires?: string[]; needsPeople?: boolean; make: (firstPerson: string) => Omit<LookRule, "id"> }[] = [
  { name: "深夜转暗", make: () => ({ name: "深夜转暗", conds: [{ kind: "clock", from: "22:00", to: "06:00" }], look: { mode: "dark", sceneTone: "cool", sceneDim: 60 } }) },
  { name: "压力爆表", requires: ["stress"], make: () => ({ name: "压力爆表", conds: [metric("stress", "gte", 80)], look: { sceneTone: "mono", tint: "#8b1e2d", topbarText: "快喘不过气" } }) },
  { name: "声名鹊起", requires: ["fame"], make: () => ({ name: "声名鹊起", conds: [metric("fame", "gte", 500)], look: { skin: "dream", accent: "gold", topbar: "aurora" } }) },
  { name: "囊中羞涩", requires: ["money"], make: () => ({ name: "囊中羞涩", conds: [metric("money", "lte", 0)], look: { sceneTone: "vintage", tint: "#57534e" } }) },
  { name: "心动时刻", needsPeople: true, make: (firstPerson) => ({ name: "心动时刻", conds: [{ kind: "rel", key: firstPerson, op: "gte", value: 60 }], look: { accent: "rose", sceneTone: "warm", bubbleStyle: "comic" } }) },
];

function Row({ t, children }: { t: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-14 shrink-0 text-[11px] font-bold text-ink-soft">{t}</span>
      {children}
    </div>
  );
}

/* 选项行：再点一次已选项 = 不改这一项 */
function Pick<K extends keyof LookPatch>({ k, opts, p, set }: { k: K; opts: readonly (readonly [string, string])[]; p: LookPatch; set: (k: K, v: LookPatch[K]) => void }) {
  return <>{opts.map(([v, l]) => <button key={v} type="button" className={chip(p[k] === v)} onClick={() => set(k, (p[k] === v ? undefined : v) as LookPatch[K])}>{l}</button>)}</>;
}

function PatchEditor({ p, onChange }: { p: LookPatch; onChange: (p: LookPatch) => void }) {
  const set = <K extends keyof LookPatch>(k: K, v: LookPatch[K]) => {
    const n = { ...p, [k]: v };
    if (v === undefined || v === "") delete n[k];
    onChange(n);
  };
  return (
    <div className="space-y-1.5 rounded-xl bg-paper/60 p-2">
      <Row t="深浅色"><Pick k="mode" opts={MODES} p={p} set={set} /></Row>
      <Row t="皮肤"><Pick k="skin" opts={SKINS.map((s) => [s.id, s.label] as const)} p={p} set={set} /></Row>
      <Row t="主题色">
        {ACCENTS.map((a) => (
          <button key={a.id} type="button" title={a.label} aria-label={a.label} onClick={() => set("accent", p.accent === a.id ? undefined : a.id)}
            className={`h-6 w-6 rounded-full ${a.bg} ring-offset-2 ring-offset-paper transition ${p.accent === a.id ? "ring-2 ring-jade" : "opacity-80 hover:opacity-100"}`} />
        ))}
        <label className="ml-1 flex items-center gap-1 text-[11px] text-ink-soft">
          <input type="color" value={p.tint ?? "#b04a7a"} onChange={(e) => set("tint", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-line bg-paper" aria-label="自定义主色" />
          {p.tint ? <button type="button" className="text-[11px] text-ink-soft hover:text-danger" onClick={() => set("tint", undefined)}>清除自定色</button> : "自定色"}
        </label>
      </Row>
      <Row t="字体"><Pick k="font" opts={FONTS.map((f) => [f.id, f.label] as const)} p={p} set={set} /></Row>
      <Row t="场景滤镜"><Pick k="sceneTone" opts={TONES} p={p} set={set} /></Row>
      <Row t="场景遮罩">
        <label className="flex items-center gap-1 text-[11px] text-ink-soft">
          <input type="checkbox" className="accent-[var(--jade)]" checked={p.sceneDim != null} onChange={(e) => set("sceneDim", e.target.checked ? 60 : undefined)} />改
        </label>
        {p.sceneDim != null && <>
          <input type="range" min={0} max={90} step={5} value={p.sceneDim} onChange={(e) => set("sceneDim", +e.target.value)} className="min-w-0 flex-1 accent-[var(--jade)]" aria-label="遮罩浓度" />
          <span className="w-9 text-right text-[11px] tabular-nums text-ink-soft">{p.sceneDim}%</span>
        </>}
      </Row>
      <Row t="对话框"><Pick k="dialogStyle" opts={DSTYLES} p={p} set={set} /></Row>
      <Row t="气泡"><Pick k="bubbleStyle" opts={BSTYLES} p={p} set={set} /></Row>
      <Row t="顶栏"><Pick k="topbar" opts={TOPBARS} p={p} set={set} /></Row>
      <Row t="顶栏标语">
        <input className={`${inp} flex-1`} maxLength={12} value={p.topbarText ?? ""} placeholder="不改" onChange={(e) => set("topbarText", e.target.value || undefined)} />
      </Row>
      <details className="group">
        <summary className="cursor-pointer list-none text-[11px] font-bold text-ink-soft hover:text-jade">更多：场景图 · 条件 CSS <span className="inline-block transition group-open:rotate-90">›</span></summary>
        <div className="mt-1.5 space-y-1.5">
          <ImagePicker value={p.sceneBg} label="场景图" onChange={(u) => set("sceneBg", u)} hint="条件满足时替换主界面场景背景" />
          <textarea className={`${inp} font-mono text-[11.5px]`} rows={3} value={p.css ?? ""} placeholder={".app-root { filter: saturate(.6); }"} onChange={(e) => set("css", e.target.value || undefined)} />
        </div>
      </details>
    </div>
  );
}

export default function LookRulesEditor({ value, events = [], onChange }: { value?: LookRule[]; events?: FixedEvent[]; onChange: (v?: LookRule[]) => void }) {
  const dd = useDraftDefaults();
  const draftRefs = useDraftRefs();
  // 功能注释：编辑器内只给本作品有的指标/人物对应的模板；游玩态不过滤
  const firstPerson = draftRefs ? draftRefs.people[0]?.id ?? "" : PEOPLE[0]?.id ?? "";
  const templates = draftRefs
    ? TEMPLATES.filter((t) => (!t.requires || t.requires.every((k) => draftRefs.metricKeys?.includes(k))) && (!t.needsPeople || draftRefs.people.length > 0))
    : TEMPLATES;
  const { game, previewLook } = useGame();
  const list = value ?? [];
  const [pv, setPv] = useState<string | null>(null); // 正在试看的规则 id
  const commit = (n: LookRule[]) => onChange(n.length ? n : undefined);
  const set = (id: string, p: Partial<LookRule>) => commit(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const pvRule = list.find((r) => r.id === pv);

  // 试看跟随编辑实时刷新；离开面板自动结束试看
  useEffect(() => { previewLook(pvRule ? pvRule.look : null); }, [pvRule?.look]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => previewLook(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={() => commit([...list, { id: uid(), name: "新的剧情美化", conds: [dd.cond("metric")], look: {} }])}>＋ 空白规则</button>
        {templates.map((t) => <button key={t.name} className={`${btn} !font-normal`} onClick={() => commit([...list, { id: uid(), ...t.make(firstPerson) }])}>{t.name}</button>)}
      </div>
      {!list.length && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">还没有剧情美化 · 试试「深夜转暗」「压力爆表」模板</p>}

      {list.map((r) => {
        const on = lookActive(r, game?.sim);
        const tags = lookSummary(r.look ?? {});
        return (
          <div key={r.id} className={`space-y-2 rounded-2xl border bg-paper-2 p-2.5 transition ${pv === r.id ? "border-jade ring-2 ring-jade/25" : "border-line"} ${r.enabled === false ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--jade)]" checked={r.enabled !== false} onChange={(e) => set(r.id, { enabled: e.target.checked ? undefined : false })} aria-label="启用" />
              <input className={`${inp} font-bold`} value={r.name} placeholder="规则名" onChange={(e) => set(r.id, { name: e.target.value })} />
              {game && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${on ? "bg-jade/15 text-jade" : "bg-line/50 text-ink-soft"}`}>{on ? "此刻生效" : "未满足"}</span>}
              <button type="button" className={`${btn} shrink-0 ${pv === r.id ? "!border-jade !bg-jade !text-white" : ""}`} onClick={() => setPv(pv === r.id ? null : r.id)} aria-pressed={pv === r.id}>{pv === r.id ? "结束试看" : "试看"}</button>
              <button className="shrink-0 text-[12px] text-ink-soft hover:text-danger" onClick={() => { if (pv === r.id) setPv(null); commit(list.filter((x) => x.id !== r.id)); }} aria-label="删除"><IconClose size={14} /></button>            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-jade/15 px-1.5 py-0.5 text-[11px] font-black tracking-[0.1em] text-jade">当</span>
                {r.conds.length > 1 && (
                  <select className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-[11.5px]" value={r.match ?? "all"} onChange={(e) => set(r.id, { match: e.target.value as "all" | "any" })}>
                    <option value="all">全部满足</option><option value="any">任一满足</option>
                  </select>
                )}
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">{r.conds.length ? condsBrief(r.conds, r.match, events) : "至少加一个条件才会生效"}</span>
              </div>
              {r.conds.map((c, i) => (
                <CondRow key={i} c={c} events={events} selfId="" onChange={(x) => set(r.id, { conds: r.conds.map((y, j) => (j === i ? x : y)) })} onDelete={() => set(r.id, { conds: r.conds.filter((_, j) => j !== i) })} />
              ))}
              <button className="text-[11.5px] font-semibold text-jade hover:underline" onClick={() => set(r.id, { conds: [...r.conds, dd.cond("metric")] })}>＋ 条件</button>
            </div>

            <div className="space-y-1">
              <p className="flex items-center gap-2">
                <span className="rounded-md bg-gold/15 px-1.5 py-0.5 text-[11px] font-black tracking-[0.1em] text-gold">外观变为</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">{tags.length ? tags.join(" · ") : "未选择任何变化（下方点选；再点一次取消）"}</span>
              </p>
              <PatchEditor p={r.look ?? {}} onChange={(look) => set(r.id, { look })} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* 美化页 · 随剧情变化：此刻生效一览 + 世界作者的规则（可整体关闭）+ 玩家自己的规则 */
export function PlotLookPanel() {
  const { theme, setTheme, game, activeLooks } = useGame();
  const world = game ? getWorldLookRules() : [];
  const events = game?.fixedEvents ?? [];
  const accept = theme.plotLook !== false;
  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-ink-soft">条件满足时外观自动切换，条件不再满足即恢复，不会改动你保存的美化设置。条件与固定事件同一套：属性、指标、关系、地点、日期、当日时段、规则变量……</p>

      <div className="rounded-xl border border-line bg-paper px-3 py-2">
        <p className="text-[11px] font-bold tracking-[0.16em] text-ink-soft">此刻生效</p>
        {!game ? <p className="mt-1 text-[12px] text-ink-soft">进入游戏后按当前剧情判定</p>
          : activeLooks.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {activeLooks.map(({ rule, source }) => (
                <span key={source + rule.id} className="rounded-full border border-jade/40 bg-jade/10 px-2 py-0.5 text-[11px] text-jade">{rule.name || "未命名"}<span className="ml-1 text-ink-soft">{source === "world" ? "世界" : "我的"}</span></span>
              ))}
            </div>
          ) : <p className="mt-1 text-[12px] text-ink-soft">没有满足条件的规则，使用你的美化设置</p>}
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink">
          <span>接受世界作者的剧情美化<span className="ml-1 text-[11px] text-ink-soft">由当前世界 / 扩展包预设{world.length ? ` · ${world.length} 条` : " · 本世界未设置"}</span></span>
          <input type="checkbox" checked={accept} onChange={(e) => setTheme({ ...theme, plotLook: e.target.checked ? undefined : false })} className="h-4 w-4 accent-[var(--jade)]" />
        </label>
        {accept && world.map((r) => {
          const on = lookActive(r, game?.sim);
          return (
            <div key={r.id} className={`flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 ${r.enabled === false ? "opacity-50" : ""}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-jade" : "bg-line"}`} aria-label={on ? "生效中" : "未满足"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-ink">{r.name || "未命名"}</span>
                <span className="block truncate text-[10.5px] text-ink-soft">当 {condsBrief(r.conds ?? [], r.match, events) || "—"} → {lookSummary(r.look ?? {}).join(" · ") || "—"}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-bold tracking-[0.16em] text-ink-soft">我的剧情美化 · {theme.lookRules?.length ?? 0}<span className="ml-1 font-normal tracking-normal">优先级高于世界作者的设定；会随主题包一起导出</span></p>
        <LookRulesEditor value={theme.lookRules} events={events} onChange={(lookRules) => setTheme({ ...theme, lookRules })} />
      </div>
    </div>
  );
}
