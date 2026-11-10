/* ═══ 创意工坊 · 玩法实时预览 ═══
 * 草稿一改就重渲染：属性条与分档、头衔门槛、日程收益、事件链串联、规则开关、结局。
 * 属性名按「底层世界 + 本 Mod」的 customAttrs 解析，引用不存在的属性标红。
 * 「进入试玩」由外层调用作者预览，把草稿叠加到世界上真实开一局。 */
import { useMemo, useState, type ReactNode } from "react";
import { collectAttrSpecs, type AttrSpec } from "../mods/kkmod/attrs";
import { IconPlay } from "../lib/icons";

type Content = Record<string, unknown>;
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const list = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);
const s = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const BUILTIN: Record<string, string> = { money: "资金", stress: "压力", energy: "行动力", fame: "名气", reputation: "口碑", works: "作品", awards: "奖项", week: "周数" };

type Tab = "attrs" | "grow" | "events" | "rules";
const TABS: { id: Tab; label: string }[] = [
  { id: "attrs", label: "属性" }, { id: "grow", label: "养成" }, { id: "events", label: "事件" }, { id: "rules", label: "规则" },
];

export default function ModPreviewPanel({ modContent, baseContent, onPlaytest, playtestIssues }: {
  modContent: Content | undefined;
  baseContent?: Content;
  onPlaytest?: () => void;
  playtestIssues?: string[];
}) {
  const c = modContent ?? {};
  const attrs = useMemo(() => collectAttrSpecs(baseContent?.customAttrs, c.customAttrs), [baseContent, c.customAttrs]);
  const byId = useMemo(() => new Map(attrs.map((a) => [a.id, a])), [attrs]);
  const counts: Record<Tab, number> = {
    attrs: list(c.customAttrs).length,
    grow: list(c.titles).length + list(c.trainings).length + list(c.sideJobs).length + list(c.weekendActs).length,
    events: list(c.fixedEvents).length + list(c.endings).length,
    rules: list(c.gameRules).length + list(c.income).length + list(c.lookRules).length + (isRec(c.features) ? Object.keys(c.features).length : 0),
  };
  const [tab, setTab] = useState<Tab>(() => (TABS.find((t) => counts[t.id] > 0)?.id ?? "attrs"));

  /** 指标键 → 显示名；未定义的属性返回 null（标红） */
  const metricName = (key: string): { label: string; ok: boolean } => {
    if (key.startsWith("c:") || key.startsWith("attr:")) {
      const id = key.slice(key.indexOf(":") + 1);
      const a = byId.get(id);
      return a ? { label: a.label, ok: true } : { label: id, ok: false };
    }
    if (key.startsWith("stat:")) return { label: `${key.slice(5)}（旧八维）`, ok: false };
    return { label: BUILTIN[key] ?? key, ok: true };
  };
  const Metric = ({ k }: { k: string }) => {
    const m = metricName(k);
    return <span className={m.ok ? "" : "text-danger underline decoration-dotted"} title={m.ok ? undefined : "未定义的属性"}>{m.label}</span>;
  };
  const gainList = (g: unknown) => (isRec(g) ? Object.entries(g).map(([id, r]) => {
    const [lo, hi] = Array.isArray(r) ? r : [r, r];
    return <Chip key={id}><Metric k={`c:${id}`} /> +{n(lo)}{n(hi) !== n(lo) ? `~${n(hi)}` : ""}</Chip>;
  }) : null);
  const condText = (cond: Rec, i: number) => {
    const k = s(cond.kind);
    const op = cond.op === "lte" ? "≤" : "≥";
    if (k === "metric" || k === "stat") return <Chip key={i}><Metric k={k === "stat" ? `stat:${s(cond.key)}` : s(cond.key)} /> {op} {n(cond.value)}</Chip>;
    if (k === "rel") return <Chip key={i}>与 {s(cond.key)} 关系 {op} {n(cond.value)}</Chip>;
    if (k === "event") return <Chip key={i}>完成「{s(cond.key)}」</Chip>;
    if (k === "location") return <Chip key={i}>在 {s(cond.key)}</Chip>;
    if (k === "flag") return <Chip key={i}>变量 {s(cond.key)} {op} {n(cond.value)}</Chip>;
    return <Chip key={i}>{k}</Chip>;
  };
  const effText = (e: Rec, i: number) => {
    const d = n(e.delta);
    const sign = d > 0 ? `+${d}` : String(d);
    const k = s(e.kind);
    if (k === "metric" || k === "stat") return <Chip key={i} tone={d >= 0 ? "good" : "bad"}><Metric k={k === "stat" ? `stat:${s(e.key)}` : s(e.key)} /> {sign}</Chip>;
    if (k === "rel") return <Chip key={i} tone={d >= 0 ? "good" : "bad"}>{s(e.key)} 关系 {sign}</Chip>;
    if (k === "flag") return <Chip key={i}>变量 {s(e.key)} {e.set ? `= ${d}` : sign}</Chip>;
    return <Chip key={i}>{k}</Chip>;
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {onPlaytest && (
        <div className="rounded-xl border border-line bg-paper px-2.5 py-2">
          <button type="button" onClick={onPlaytest} className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-jade px-3 py-1.5 text-[12.5px] font-bold text-white">
            <IconPlay size={13} />进入试玩（叠加到世界真实开一局）
          </button>
          {playtestIssues?.length ? <p className="mt-1.5 text-[11px] text-danger">{playtestIssues.slice(0, 3).join("；")}</p> : <p className="mt-1 text-center text-[10.5px] text-ink-soft">试玩存档与正式存档隔离，退出试玩回到工坊</p>}
        </div>
      )}

      <div className="flex gap-1 rounded-full border border-line bg-paper p-0.5 text-[11.5px] font-semibold" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-2 py-1 transition ${tab === t.id ? "bg-jade text-white" : "text-ink-soft hover:text-ink"}`}>
            {t.label}{counts[t.id] ? <span className="ml-0.5 opacity-75">{counts[t.id]}</span> : null}
          </button>
        ))}
      </div>

      {total === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[11.5px] text-ink-soft">还没有玩法内容。对话生成后，这里实时显示效果。</p>}

      <div className="min-h-0 space-y-2 overflow-y-auto">
        {tab === "attrs" && (
          <>
            {list(c.customAttrs).map((raw) => {
              const a = byId.get(s(raw.id));
              return a ? <AttrBar key={a.id} a={a} /> : null;
            })}
            {attrs.length > list(c.customAttrs).length && (
              <Card title="底层世界已有属性" sub="可直接引用">
                <div className="flex flex-wrap gap-1">{attrs.filter((a) => !list(c.customAttrs).some((x) => x.id === a.id)).map((a) => <Chip key={a.id}>{a.label}</Chip>)}</div>
              </Card>
            )}
            {!attrs.length && <Empty text="还没有属性" />}
          </>
        )}

        {tab === "grow" && (
          <>
            {list(c.titles).length > 0 && (
              <Card title="头衔" sub={`${list(c.titles).length} 个`}>
                <ul className="space-y-1.5">
                  {list(c.titles).map((t) => (
                    <li key={s(t.id)} className="text-[11.5px]">
                      <span className="font-semibold">{s(t.name)}</span>{t.tier ? <span className="ml-1 text-[10.5px] text-gold">{s(t.tier)}</span> : null}
                      <div className="mt-0.5 flex flex-wrap gap-1">{isRec(t.req) ? Object.entries(t.req).map(([k, v]) => <Chip key={k}><Metric k={k} /> ≥ {n(v)}</Chip>) : null}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {list(c.trainings).map((t) => (
              <Card key={`t-${s(t.id)}`} title={s(t.name)} sub={`课程 · 花费 ${n(t.cost)} · 行动力 ${n(t.energy)} · 压力 ${n(t.stress) >= 0 ? "+" : ""}${n(t.stress)}`}>
                <div className="flex flex-wrap gap-1">{gainList(t.cgain)}{list(t.grades).length ? <Chip>{list(t.grades).length} 个进阶等级</Chip> : null}</div>
              </Card>
            ))}
            {list(c.sideJobs).length > 0 && (
              <Card title="打工" sub="按顺序成档">
                <ul className="space-y-1">{list(c.sideJobs).map((j) => <li key={s(j.id)} className="flex flex-wrap items-center gap-1 text-[11.5px]"><span className="font-semibold">{s(j.label)}</span><Chip tone="good">收入 {n(j.pay)}</Chip>{gainList(j.cgain)}</li>)}</ul>
              </Card>
            )}
            {list(c.weekendActs).length > 0 && (
              <Card title="周末活动">
                <ul className="space-y-1">{list(c.weekendActs).map((w) => <li key={s(w.id)} className="flex flex-wrap items-center gap-1 text-[11.5px]"><span className="font-semibold">{s(w.name)}</span><span className="text-ink-soft">{s(w.effect)}</span>{gainList(w.cgain)}</li>)}</ul>
              </Card>
            )}
            {!counts.grow && <Empty text="还没有头衔、课程或打工" />}
          </>
        )}

        {tab === "events" && (
          <>
            {list(c.fixedEvents).map((e, i, all) => {
              const next = Array.isArray(e.nextIds) ? (e.nextIds as unknown[]).map(s).filter(Boolean) : [];
              return (
                <Card key={s(e.id) || i} title={s(e.name) || s(e.id)} sub={[e.locked ? "锁定（由前一环解锁）" : "", e.once ? "仅一次" : "", e.random ? "随机" : ""].filter(Boolean).join(" · ")}>
                  {list(e.conds).length > 0 && <Row label="条件">{list(e.conds).map(condText)}</Row>}
                  {list(e.effects).length > 0 && <Row label="效果">{list(e.effects).map(effText)}</Row>}
                  {s(e.prompt) && <p className="mt-1 line-clamp-2 text-[11px] text-ink-soft">{s(e.prompt)}</p>}
                  {next.length > 0 && (
                    <Row label="接着">
                      {next.map((id) => {
                        const target = all.find((x) => x.id === id);
                        return <Chip key={id} tone={target ? undefined : "bad"}>→ {target ? s(target.name) || id : `${id}（不存在）`}</Chip>;
                      })}
                    </Row>
                  )}
                </Card>
              );
            })}
            {list(c.endings).length > 0 && (
              <Card title="结局" sub={`${list(c.endings).length} 个`}>
                <ul className="space-y-1">{list(c.endings).map((e) => <li key={s(e.id)} className="text-[11.5px]"><span className="font-semibold">{s(e.title)}</span><span className="ml-1 text-ink-soft">{s(e.desc)}</span></li>)}</ul>
              </Card>
            )}
            {!counts.events && <Empty text="还没有事件链或结局" />}
          </>
        )}

        {tab === "rules" && (
          <>
            {isRec(c.features) && Object.keys(c.features).length > 0 && (
              <Card title="功能开关">
                <div className="flex flex-wrap gap-1">{Object.entries(c.features).map(([k, v]) => <Chip key={k} tone={v ? "good" : "bad"}>{k} {v ? "开" : "关"}</Chip>)}</div>
              </Card>
            )}
            {list(c.income).length > 0 && (
              <Card title="每周收支">
                <ul className="space-y-1">{list(c.income).map((x) => <li key={s(x.id)} className="flex flex-wrap items-center gap-1 text-[11.5px]"><span className="font-semibold">{s(x.label)}</span>{isRec(x.target) ? <Chip tone={n(x.min) >= 0 ? "good" : "bad"}><Metric k={s(x.target.key)} /> {n(x.min)}~{n(x.max)}</Chip> : null}</li>)}</ul>
              </Card>
            )}
            {list(c.gameRules).map((r) => (
              <Card key={s(r.id)} title={s(r.name) || s(r.id)} sub={`每${r.when === "week" ? "周" : "天"}判定${r.chance ? ` · ${n(r.chance)}%` : ""}${r.once ? " · 仅一次" : ""}`}>
                {list(r.branches).map((b, i) => (
                  <div key={i} className="mt-1 rounded-lg bg-paper-2 px-2 py-1">
                    <Row label={list(b.conds).length ? `分支 ${i + 1}` : "否则"}>{list(b.conds).map(condText)}</Row>
                    {list(b.effects).length > 0 && <Row label="效果">{list(b.effects).map(effText)}</Row>}
                    {s(b.notice) && <p className="text-[10.5px] text-ink-soft">提示：{s(b.notice)}</p>}
                  </div>
                ))}
              </Card>
            ))}
            {list(c.lookRules).length > 0 && (
              <Card title="剧情美化" sub="条件满足时临时换外观">
                <ul className="space-y-1">{list(c.lookRules).map((l) => <li key={s(l.id)} className="flex flex-wrap items-center gap-1 text-[11.5px]"><span className="font-semibold">{s(l.name)}</span>{list(l.conds).map(condText)}</li>)}</ul>
              </Card>
            )}
            {!counts.rules && <Empty text="还没有规则或开关" />}
          </>
        )}
      </div>
    </div>
  );
}

function AttrBar({ a }: { a: AttrSpec }) {
  const span = Math.max(1, a.max - a.min);
  const pct = Math.round(((a.init - a.min) / span) * 100);
  const color = a.color === "coral" ? "var(--coral)" : a.color === "gold" ? "var(--gold)" : a.color === "danger" ? "var(--danger)" : "var(--jade)";
  return (
    <Card title={a.label} sub={`${a.id} · ${a.min}~${a.max} · 初始 ${a.initMode === "random" ? "随机" : a.init}`}>
      <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-paper-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        {a.tiers?.map((t) => <span key={t.min} className="absolute top-0 h-full w-px bg-ink/30" style={{ left: `${Math.round(((t.min - a.min) / span) * 100)}%` }} />)}
      </div>
      {a.tiers?.length ? <div className="mt-1 flex flex-wrap gap-1">{a.tiers.map((t) => <Chip key={t.min}>{t.min}+ {t.label}</Chip>)}</div> : null}
      {a.desc && <p className="mt-1 text-[11px] text-ink-soft">{a.desc}</p>}
    </Card>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-2.5 py-2">
      <p className="flex items-baseline gap-1.5"><span className="truncate text-[12.5px] font-bold">{title}</span>{sub && <span className="truncate text-[10.5px] text-ink-soft">{sub}</span>}</p>
      {children}
    </div>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="mt-1 flex flex-wrap items-center gap-1"><span className="text-[10.5px] text-ink-soft">{label}</span>{children}</div>;
}
function Chip({ children, tone }: { children: ReactNode; tone?: "good" | "bad" }) {
  const cls = tone === "good" ? "border-jade/40 text-jade" : tone === "bad" ? "border-danger/40 text-danger" : "border-line text-ink";
  return <span className={`inline-flex items-center gap-0.5 rounded-full border bg-paper-2 px-1.5 py-px text-[10.5px] ${cls}`}>{children}</span>;
}
function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-[11px] text-ink-soft">{text}</p>;
}
