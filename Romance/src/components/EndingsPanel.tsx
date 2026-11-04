import { useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import type { AttrDef, CmpOp, CustomEnding, FixedCond, FixedEvent, GradeDim, GradeDimIcon, Sideline, Storyline, TimeLimit } from "../lib/types";
import { CMP_OPS, GRADE_DIM_ICONS, GRADE_DIM_MAX, limitDays, parseYmdMs } from "../lib/types";
import { CondRow, defaultCond, questOpts, sideOpts } from "./FixedEventsPanel";
import { GroupEditor } from "./EventAdvanced";
import IntInput from "./IntInput";
import { matchCustomEnding, groupMet, endingCondsMet, evalFixedCond, condCurrent, metricDefaultFull } from "../game/fixedEvents";
import { dayDateLabel, endingText, startDateLabel } from "../game/logic";
import { creationCopy, type CreationPath, type StatsSlot } from "../game/data";
import { FALLBACK_DIM_LABELS, dimValue, endingPillars } from "../game/grade";
import { GROUP_BUILTIN, favorTargets, srcValue, valueSources, type ValueSrc } from "../game/valueSources";
import { getWorldSlot } from "../mods/registry";
import { GLYPHS } from "../lib/iconGlyphs";
import { ScopeBanner, SearchBox, matches, useConfirm } from "./EditorKit";
import { AuditBadge, AuditBar, AuditList, auditDomId } from "./EditorKit";
import { auditGame, auditStory, issuesAt } from "../game/refAudit";
import ImagePicker from "./ImagePicker";

/* 结局编辑器（作品后台）。三个区域，自上而下：
 *   区域 1 结算时限设置：本局总天数 → 到期自动结算
 *   区域 2 自定义结局规则列表：每条结局 = 文案 + 【结局触发条件】
 *   区域 3 结局评级维度设置：【评级维度】
 *
 * 两个概念互相独立，不要混用：
 *   【结局触发条件】CustomEnding.conds —— 条件判断。满足就「跳到这个结局」，决定玩家拿到哪一个结局。
 *   【评级维度】GradeDim —— 评分项。结局已经确定之后，按数值给 S+ / S / A / B / C / D 打分，只影响评级显示。
 *
 * 数值名称全部来自全局属性池 valueSources()（与人物线路编辑器共用），不写死任何属性名。
 * 数据仍是原有的动态 JSON：customEndings / timeLimit / gradeDims，存档直接读取结算。 */

const uid = () => `end_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-ink-soft/70 focus:border-[var(--jade)]";
const pillInp = "min-w-0 rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-[12px] text-ink outline-none focus:border-[var(--jade)]";
const btn = "rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11.5px] font-semibold text-ink transition hover:border-[var(--jade)] hover:text-[var(--jade)] disabled:pointer-events-none disabled:opacity-40";
const pill = (on: boolean) =>
  `rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold transition ${on ? "border-[var(--jade)] bg-[var(--jade)] text-white" : "border-line bg-paper-2 text-ink-soft hover:border-[var(--jade)] hover:text-ink"}`;
const del = "shrink-0 rounded-full border border-line px-2 py-0.5 text-[11.5px] text-ink-soft transition hover:border-[var(--coral)] hover:text-[var(--coral)]";
const GRADE_PRESETS = ["SSS", "S+", "S", "A", "B", "C", "D"];
const DIM_ICON_ORDER: GradeDimIcon[] = ["heart", "star", "leaf", "book", "crown", "note"];
const NUMERIC = new Set(["stat", "metric", "rel"]);

function DimGlyph({ icon, size = 14 }: { icon: GradeDimIcon; size?: number }) {
  const meta = GRADE_DIM_ICONS[icon] ?? GRADE_DIM_ICONS.star;
  const G = GLYPHS[meta.glyph]?.C;
  return G ? <G width={size} height={size} style={{ color: meta.color }} aria-hidden /> : null;
}

function Area({ n, title, desc, right, children }: { n: number; title: string; desc: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-paper px-3.5 py-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--jade)] text-[11px] font-bold text-white">{n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-bold leading-5 text-ink">{title}</h3>
          <div className="text-[11.5px] leading-relaxed text-ink-soft">{desc}</div>
        </div>
        {right}
      </div>
      <div className="mt-2.5 space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

/* 一行【结局触发条件】：指标（下拉读全局属性池 + 好感对象）· 判断符 · 阈值（整数，可正可负） */
function TriggerRow({ c, srcs, people, onChange, onDelete }: {
  c: Extract<FixedCond, { kind: "stat" | "metric" | "rel" }>; srcs: ValueSrc[]; people: { id: string; name: string; fromRoute: boolean }[];
  onChange: (c: FixedCond) => void; onDelete: () => void;
}) {
  const cur = `${c.kind}:${c.key}`;
  const groups = [...new Set(srcs.map((x) => x.group))];
  const known = srcs.some((x) => srcValue(x) === cur) || (c.kind === "rel" && people.some((p) => p.id === c.key));
  const pick = (raw: string) => {
    const i = raw.indexOf(":");
    onChange({ kind: raw.slice(0, i) as "stat" | "metric" | "rel", key: raw.slice(i + 1), op: c.op, value: c.value });
  };
  const routeFavor = people.filter((p) => p.fromRoute);
  const otherFavor = people.filter((p) => !p.fromRoute);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select className={`${pillInp} max-w-[13rem] flex-1`} value={cur} onChange={(e) => pick(e.target.value)} aria-label="指标">
        {!known && <option value={cur}>已失效：{c.key || "未选择"}</option>}
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {srcs.filter((x) => x.group === g).map((x) => <option key={srcValue(x)} value={srcValue(x)}>{x.label}</option>)}
          </optgroup>
        ))}
        {routeFavor.length > 0 && <optgroup label="好感 · 人物线路">{routeFavor.map((p) => <option key={p.id} value={`rel:${p.id}`}>{p.name} 好感</option>)}</optgroup>}
        {otherFavor.length > 0 && <optgroup label="好感 · 角色库">{otherFavor.map((p) => <option key={p.id} value={`rel:${p.id}`}>{p.name} 好感</option>)}</optgroup>}
      </select>
      <select className={`${pillInp} w-14 text-center font-bold`} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as CmpOp })} aria-label="判断符">
        {CMP_OPS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
      <IntInput value={c.value} label="阈值" onChange={(value) => onChange({ ...c, value })} />
      <button type="button" className={del} onClick={onDelete} aria-label="删除条件">×</button>
    </div>
  );
}

export default function EndingsPanel({
  value, onChange, timeLimitValue, onTimeLimitChange, gradeDimsValue, onGradeDimsChange, eventsValue, startDateValue,
  statsValue, attrsValue, pathsValue, peopleValue, storylinesValue, sidelinesValue,
}: {
  value?: CustomEnding[];
  onChange?: (v: CustomEnding[]) => void;
  timeLimitValue?: TimeLimit;
  onTimeLimitChange?: (t?: TimeLimit) => void;
  gradeDimsValue?: GradeDim[];
  onGradeDimsChange?: (d?: GradeDim[]) => void;
  eventsValue?: FixedEvent[];
  startDateValue?: string;
  /* 作品后台传入正在编辑的作品，让下拉只列本作品的属性池与角色 */
  statsValue?: StatsSlot;
  attrsValue?: AttrDef[];
  pathsValue?: CreationPath[];
  peopleValue?: { id: string; name: string }[];
  storylinesValue?: Storyline[];
  /* 结局条件可主动勾「某支线已完成」；支线本身不是结局 */
  sidelinesValue?: Sideline[];
} = {}) {
  const modMode = !!onChange;
  const { game, commitGame, endManually } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [confirm, confirmEl] = useConfirm();
  if (!modMode && !game) return null;

  /* 功能注释：AI/脏稿常缺 title/body/conds，conds 里还会塞 null；归一后再渲染，避免④剧情读 c.kind / .length 崩页 */
  const normalizeEnding = (e: CustomEnding | null | undefined): CustomEnding | null => {
    if (!e || typeof e !== "object") return null;
    const conds = Array.isArray(e.conds) ? e.conds.filter((c): c is NonNullable<typeof c> => !!c && typeof c === "object" && typeof (c as { kind?: unknown }).kind === "string") : [];
    const condGroups = Array.isArray(e.condGroups)
      ? e.condGroups
          .filter((g): g is NonNullable<typeof g> => !!g && typeof g === "object")
          .map((g) => ({
            ...g,
            conds: Array.isArray(g.conds)
              ? g.conds.filter((c): c is NonNullable<typeof c> => !!c && typeof c === "object" && typeof (c as { kind?: unknown }).kind === "string")
              : [],
          }))
      : undefined;
    return {
      ...e,
      id: typeof e.id === "string" && e.id ? e.id : `end_${Math.random().toString(36).slice(2, 8)}`,
      title: e.title ?? "",
      body: e.body ?? "",
      conds,
      ...(condGroups?.length ? { condGroups } : { condGroups: undefined }),
    };
  };
  const list = (modMode ? (value ?? []) : (game?.customEndings ?? []))
    .map(normalizeEnding)
    .filter((e): e is CustomEnding => !!e);
  const audit = modMode || !game
    ? auditStory({ endings: list, events: eventsValue, storylines: storylinesValue, npcIds: peopleValue?.map((p) => p.id), skip: ["item", "location", "flag", ...(storylinesValue ? [] : (["quest"] as const)), ...(peopleValue ? [] : (["npc"] as const))] })
    : auditGame(game, { endings: list });
  const endIssues = audit.issues.filter((x) => x.at?.startsWith("ending:"));
  const save = (next: CustomEnding[]) => {
    if (modMode) onChange?.(next);
    else if (game) commitGame({ ...game, customEndings: next });
  };
  const patch = (id: string, p: Partial<CustomEnding>) => save(list.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  // 全局属性池（与人物线路共用）：后台读正在编辑的作品；游戏内读当前世界 + 本存档属性（含线路开局新建的属性）
  const paths = modMode ? (pathsValue ?? []) : (creationCopy().paths ?? []);
  const srcs = modMode
    ? valueSources({ stats: statsValue, attrs: attrsValue, paths })
    : valueSources({ stats: getWorldSlot("stats"), attrs: game?.attrDefs ?? getWorldSlot("customAttrs"), paths });
  const people = favorTargets(modMode ? (peopleValue ?? []) : (game?.npcs ?? []).map((n) => ({ id: n.id, name: n.name })), paths);
  const srcLabel = (src: GradeDim["src"]) => srcs.find((x) => x.kind === src.kind && x.key === src.key)?.label ?? src.key;
  const firstCond = (): FixedCond => {
    const s = srcs[0];
    return s ? { kind: s.kind, key: s.key, op: "gte", value: 0 } : defaultCond("metric");
  };

  const add = () => {
    const e: CustomEnding = { id: uid(), title: `结局 ${list.length + 1}`, body: "", conds: [firstCond()] };
    save([...list, e]);
    setOpenId(e.id);
  };

  const sim = game?.sim;
  const hit = sim ? matchCustomEnding(list, sim) : null;

  /* ——— 区域 1：结算时限 ——— */
  const tl = modMode ? timeLimitValue : game?.timeLimit;
  const baseStartDate = (modMode ? startDateValue : game?.startDate) || startDateLabel();
  const totalDays = limitDays(tl, baseStartDate);
  const setTl = (t?: TimeLimit) => {
    if (modMode) onTimeLimitChange?.(t);
    else if (game) commitGame({ ...game, timeLimit: t });
  };
  const endDate = (() => {
    if (!tl) return "";
    if (tl.endDate) return tl.endDate;
    const startMs = parseYmdMs(baseStartDate);
    if (startMs == null || totalDays <= 0) return dayDateLabel(totalDays);
    const dt = new Date(startMs + totalDays * 86400000);
    return `${dt.getUTCFullYear()}.${String(dt.getUTCMonth() + 1).padStart(2, "0")}.${String(dt.getUTCDate()).padStart(2, "0")}`;
  })();

  const eventsList = modMode ? (eventsValue ?? []) : (game?.fixedEvents ?? []);
  const quests = questOpts(modMode ? storylinesValue : undefined);
  const sides = sideOpts(modMode ? sidelinesValue : undefined);

  /* ——— 区域 3：评级维度 ——— */
  const dims = modMode ? (gradeDimsValue ?? []) : (game?.gradeDims ?? []);
  const saveDims = (next: GradeDim[]) => {
    const v = next.length ? next : undefined;
    if (modMode) onGradeDimsChange?.(v);
    else if (game) commitGame({ ...game, gradeDims: v });
  };
  const patchDim = (id: string, p: Partial<GradeDim>) => saveDims(dims.map((d) => (d.id === id ? { ...d, ...p } : d)));
  const fullOf = (s: ValueSrc) => (s.kind === "stat" ? 300 : metricDefaultFull(s.key));
  const makeDim = (s: ValueSrc, i: number): GradeDim => ({
    id: uid().replace("end_", "dim_"), label: s.label.slice(0, 8), icon: DIM_ICON_ORDER[i % DIM_ICON_ORDER.length], src: { kind: s.kind, key: s.key }, full: fullOf(s),
  });
  const addDim = () => {
    const used = new Set(dims.map((d) => srcValue(d.src)));
    const s = srcs.find((x) => !used.has(srcValue(x))) ?? srcs[0];
    if (s) saveDims([...dims, makeDim(s, dims.length)]);
  };
  const setDimSrc = (d: GradeDim, raw: string) => {
    const s = srcs.find((x) => srcValue(x) === raw);
    if (!s) return;
    const label = !d.label.trim() || d.label === srcLabel(d.src) ? s.label.slice(0, 8) : d.label; // 名称没改过就跟着换
    patchDim(d.id, { src: { kind: s.kind, key: s.key }, label, full: fullOf(s) });
  };
  const dimCards = sim ? endingPillars(sim, dims, game?.journal?.length ?? 0) : [];
  const groups = [...new Set(srcs.map((x) => x.group))];
  const shown = list.filter((e) => matches(q, e.title, e.body, e.subTitle));

  return (
    <div className="space-y-3">
      {confirmEl}
      {!modMode && <ScopeBanner scope="save">这里的修改只影响当前存档，立即保存。作品自带的结局会在开新局时带入。</ScopeBanner>}

      {/* 区域 1｜结算时限设置 */}
      <Area n={1} title="结算时限设置" desc="到达截止日期，自动触发结局结算，AI 叙事会遵守该时间限制。"
        right={
          <span className="flex shrink-0 gap-1">
            <button type="button" className={pill(!!tl)} onClick={() => !tl && setTl({ value: 365, unit: "day" })}>限时</button>
            <button type="button" className={pill(!tl)} onClick={() => setTl(undefined)}>不限时</button>
          </span>
        }>
        {tl ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink">
              <span className="font-bold">本局总时长</span>
              <input type="number" min={1} step={1} inputMode="numeric" className={`${pillInp} w-20 text-center font-bold tabular-nums`} value={totalDays || ""}
                onChange={(ev) => setTl({ value: Math.max(1, Math.trunc(Number(ev.target.value)) || 1), unit: "day" })} aria-label="本局总天数" />
              <span>天</span>
              <span className="ml-1 rounded-full bg-paper-2 px-2.5 py-0.5 text-[11.5px] text-ink-soft">截止日期 <b className="font-mono text-ink tabular-nums">{endDate}</b></span>
              {sim && (
                <span className="rounded-full bg-[var(--coral)]/10 px-2.5 py-0.5 text-[11.5px] text-ink-soft">
                  倒计时 <b className="tabular-nums" style={{ color: "var(--coral)" }}>{Math.max(0, totalDays - sim.day)}</b> 天
                </span>
              )}
            </div>
            {tl.endDate && (
              <p className="text-[11px] text-ink-soft">
                当前按旧数据里的固定截止日期结算。<button type="button" className="underline hover:text-ink" onClick={() => setTl({ value: totalDays || 1, unit: "day" })}>改为按天数</button>
              </p>
            )}
          </>
        ) : (
          <p className="text-[11.5px] text-ink-soft">不限时：只有玩家主动结束，或某条结局勾选了「满足即结算」时才会结算。</p>
        )}
      </Area>

      {/* 区域 2｜自定义结局规则列表 */}
      <Area n={2} title="自定义结局规则列表"
        desc={<>结局从上往下依次判断；<b className="text-ink">第一个满足全部条件的结局生效</b>；所有自定义结局都不满足时，自动走默认评级结局。</>}
        right={!modMode && sim ? (
          <button type="button" className={btn} onClick={async () => { if (await confirm("现在就结束游戏，进入结算？")) void endManually("manual"); }}>立即测试结算</button>
        ) : undefined}>
        {/* 预览只读取当前存档，不写示例数据 */}
        <p className="flex flex-wrap items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1 text-[11.5px] text-ink-soft">
          结算预览：
          {sim ? (
            <>当前如果立刻结束游戏，将达成
              <b className="rounded-full px-2 text-white" style={{ background: hit ? "var(--jade)" : "var(--gold)" }}>
                {hit ? [hit.title || "未命名结局", hit.subTitle].filter(Boolean).join(" · ") : `默认 · ${endingText(sim).title}`}
              </b>
            </>
          ) : "进入游戏后，这里显示当前存档立刻结束会达成的结局。"}
        </p>

        {list.length > 0 && <AuditBar issues={endIssues} onJump={(at) => { setQ(""); setOpenId(at.slice(7)); }} />}
        {list.length > 4 && <SearchBox value={q} onChange={setQ} placeholder="搜索结局名称 / 副标题 / 描述" count={shown.length} />}

        {list.map((e, i) => {
          if (!matches(q, e.title, e.body, e.subTitle)) return null;
          const open = openId === e.id;
          const met = sim ? e.enabled !== false && (!e.minDay || sim.day >= e.minDay) && endingCondsMet(e, sim) : null;
          const okN = sim ? e.conds.filter((c) => evalFixedCond(c, sim)).length : 0;
          return (
            <div key={e.id} id={auditDomId(`ending:${e.id}`)} className={`scroll-mt-3 rounded-xl border ${open ? "border-[var(--jade)]/60" : "border-line"} bg-paper-2/40 ${e.enabled === false ? "opacity-55" : ""}`}>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-paper text-[10.5px] font-bold tabular-nums text-ink-soft" title="判断顺序">{i + 1}</span>
                <button type="button" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-bold text-ink">{e.title || "未命名结局"}{e.subTitle && <span className="ml-1.5 text-[11.5px] font-normal text-ink-soft">{e.subTitle}</span>}</span>
                  <span className="block truncate text-[11px] text-ink-soft">
                    {e.conds.length ? `${e.match === "any" ? "任意满足" : "全部满足"} · ${sim ? `${okN}/` : ""}${e.conds.length} 个条件` : "无条件（保底）"}
                    {e.auto ? " · 满足即结算" : ""}{e.enabled === false ? " · 已停用" : ""}
                  </span>
                </button>
                <AuditBadge issues={issuesAt(audit, `ending:${e.id}`)} />
                {met !== null && (
                  <span className="shrink-0 rounded-full border px-2 text-[10.5px] font-bold leading-5" style={{ color: met ? "var(--jade)" : "var(--coral)", borderColor: met ? "var(--jade)" : "var(--coral)" }}>{met ? "已满足" : "未满足"}</span>
                )}
                <button type="button" className={`${btn} !px-1.5`} onClick={() => move(i, -1)} disabled={i === 0 || !!q} aria-label="上移（更早判断）">↑</button>
                <button type="button" className={`${btn} !px-1.5`} onClick={() => move(i, 1)} disabled={i === list.length - 1 || !!q} aria-label="下移（更晚判断）">↓</button>
              </div>

              {open && (
                <div className="space-y-2.5 border-t border-line px-3 py-2.5">
                  <AuditList issues={issuesAt(audit, `ending:${e.id}`)} />
                  {/* 1~3：结局文案 */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label="结局名称">
                      <input className={inp} placeholder="如：顶流巨星 / 归隐山林 / 遗憾退场" value={e.title} maxLength={28} onChange={(ev) => patch(e.id, { title: ev.target.value })} />
                    </Field>
                    <Field label="结局标签副标题">
                      <input className={inp} placeholder="如：平凡而认真 · 素人结局" value={e.subTitle ?? ""} maxLength={24} onChange={(ev) => patch(e.id, { subTitle: ev.target.value || undefined })} />
                    </Field>
                  </div>
                  <Field label="结局描述（结算弹窗里展示给玩家）">
                    <textarea className={`${inp} min-h-[64px] resize-y`} placeholder="写清这个结局发生了什么、主角最后过得怎样。" value={e.body} maxLength={500} onChange={(ev) => patch(e.id, { body: ev.target.value })} />
                  </Field>

                  {/* 4：【结局触发条件】—— 满足就跳到这个结局（与下方评级维度无关） */}
                  <div className="space-y-1.5 rounded-lg border border-line/70 bg-paper p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11.5px] font-bold text-ink">触发条件</span>
                      <button type="button" className={pill((e.match ?? "all") === "all")} onClick={() => patch(e.id, { match: "all" })}>全部满足</button>
                      <button type="button" className={pill(e.match === "any")} onClick={() => patch(e.id, { match: "any" })}>任意满足</button>
                      <span className="ml-auto flex gap-1">
                        <button type="button" className={btn} onClick={() => patch(e.id, { conds: [...e.conds, firstCond()] })}>＋ 添加条件</button>
                        <button type="button" className={btn} title="时间、日期、经历过的事件等" onClick={() => patch(e.id, { conds: [...e.conds, defaultCond("time")] })}>＋ 其他条件</button>
                        {quests.length > 0 && <button type="button" className={btn} title="主线完成 / 失败、可选目标达成" onClick={() => patch(e.id, { conds: [...e.conds, { kind: "quest", key: quests[0].id, state: "done" }] })}>＋ 主线条件</button>}
                        <select className={btn} value="" aria-label="更多条件" onChange={(ev) => { const k = ev.target.value as FixedCond["kind"]; if (k) patch(e.id, { conds: [...e.conds, defaultCond(k)] }); }}>
                          <option value="">＋ 更多…</option>
                          <option value="faction">阵营声望</option>
                          <option value="visited">去过的地点</option>
                          <option value="item">持有道具</option>
                          <option value="relSet">NPC 好感集合</option>
                          <option value="memory">记忆标记</option>
                        </select>
                      </span>
                    </div>
                    {!e.conds.length && !e.condGroups?.length && <p className="text-[11px] text-ink-soft">没有条件：轮到它就一定生效，适合放在列表最后作保底。</p>}
                    {e.conds.map((c, ci) => {
                      const set = (nc: FixedCond) => patch(e.id, { conds: e.conds.map((x, xi) => (xi === ci ? nc : x)) });
                      const rm = () => patch(e.id, { conds: e.conds.filter((_, xi) => xi !== ci) });
                      const ok = sim ? evalFixedCond(c, sim) : null;
                      const cur = sim ? condCurrent(c, sim) : null;
                      return (
                        <div key={ci}>
                          {NUMERIC.has(c.kind)
                            ? <TriggerRow c={c as Extract<FixedCond, { kind: "stat" | "metric" | "rel" }>} srcs={srcs} people={people} onChange={set} onDelete={rm} />
                            : <CondRow c={c} events={eventsList} selfId="" srcs={srcs} people={people} quests={quests} sides={sides} onChange={set} onDelete={rm} />}
                          {ok !== null && <p className="px-2 text-[10.5px]" style={{ color: ok ? "var(--jade)" : "var(--coral)" }}>{ok ? "已满足" : "未满足"}{cur != null ? ` · 当前 ${cur}` : ""}</p>}
                        </div>
                      );
                    })}
                    {(e.condGroups ?? []).map((g, gi) => (
                      <div key={`g${gi}`}>
                        <GroupEditor g={g} events={eventsList} selfId="" title={`且 条件组 ${gi + 1}`}
                          onChange={(ng) => patch(e.id, { condGroups: e.condGroups!.map((x, xi) => (xi === gi ? ng : x)) })}
                          onDelete={() => { const n = e.condGroups!.filter((_, xi) => xi !== gi); patch(e.id, { condGroups: n.length ? n : undefined }); }} />
                        {sim && <p className="px-2 text-[10.5px]" style={{ color: groupMet(g, sim) ? "var(--jade)" : "var(--coral)" }}>{groupMet(g, sim) ? "本组已满足" : "本组未满足"}</p>}
                      </div>
                    ))}
                    <button type="button" className="text-[11.5px] font-semibold text-jade hover:underline"
                      onClick={() => patch(e.id, { condGroups: [...(e.condGroups ?? []), { match: "any", conds: [defaultCond("faction")] }] })}>＋ 条件组（组内「且 / 或」，与上面的条件同时成立，如「声望达标 或 与三人好感≥60」）</button>
                  </div>

                  {/* 5：可选绑定 */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-line/70 bg-paper p-2">
                      <p className="mb-1 text-[11px] font-bold text-ink-soft">结局专属 CG（可选）</p>
                      <ImagePicker label="结局 CG" value={e.image} onChange={(url) => patch(e.id, { image: url || undefined })} hint="可上传、从素材库选，或粘贴图片链接" />
                    </div>
                    <Field label="结局专属剧情段落（可选）">
                      <select className={inp} value={e.sceneId ?? ""} onChange={(ev) => patch(e.id, { sceneId: ev.target.value || undefined })}>
                        <option value="">不绑定</option>
                        {e.sceneId && !eventsList.some((x) => x.id === e.sceneId) && <option value={e.sceneId}>已失效：{e.sceneId}</option>}
                        {eventsList.map((x) => <option key={x.id} value={x.id}>{x.name || "未命名"} · {x.id}</option>)}
                      </select>
                      <span className="mt-0.5 block text-[10.5px] text-ink-soft">从本作品的固定事件里选，结算时作为 AI 后记的收尾场景</span>
                    </Field>
                  </div>

                  {/* 其余展示项：保留原有字段，收进更多设置 */}
                  <details className="group rounded-lg border border-line/70 bg-paper px-2 py-1.5">
                    <summary className="cursor-pointer select-none text-[11.5px] font-bold text-ink-soft">更多设置（评级、金句、评语、时机）</summary>
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-ink-soft">指定评级</span>
                        <button type="button" className={pill(!e.grade)} onClick={() => patch(e.id, { grade: undefined })}>自动</button>
                        {GRADE_PRESETS.map((g) => <button key={g} type="button" className={pill(e.grade === g)} onClick={() => patch(e.id, { grade: g })}>{g}</button>)}
                        <input className={`${pillInp} w-36`} placeholder="评级短评（可选）" value={e.verdict ?? ""} maxLength={20} onChange={(ev) => patch(e.id, { verdict: ev.target.value || undefined })} />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Field label="结局标签（如：真结局 / 隐藏结局）">
                          <input className={inp} value={e.badge ?? ""} maxLength={16} onChange={(ev) => patch(e.id, { badge: ev.target.value || undefined })} />
                        </Field>
                        <Field label="一句话金句（显示在名称下方）">
                          <input className={inp} value={e.quote ?? ""} maxLength={80} onChange={(ev) => patch(e.id, { quote: ev.target.value || undefined })} />
                        </Field>
                      </div>
                      <Field label="评语（留空按评级自动生成）">
                        <textarea className={`${inp} min-h-[52px] resize-y`} value={e.comment ?? ""} maxLength={200} onChange={(ev) => patch(e.id, { comment: ev.target.value || undefined })} />
                      </Field>
                      <div className="flex items-end gap-2">
                        <Field label="评语人（留空：好感最高的人物）">
                          <input className={inp} list={`ending-by-${e.id}`} value={e.commentBy ?? ""} maxLength={12} onChange={(ev) => patch(e.id, { commentBy: ev.target.value || undefined })} />
                          <datalist id={`ending-by-${e.id}`}>{people.map((n) => <option key={n.id} value={n.name} />)}</datalist>
                        </Field>
                        <ImagePicker label="评语人头像" thumb="h-9 w-9" max={400} value={e.commentAvatar} onChange={(url) => patch(e.id, { commentAvatar: url || undefined })} />
                        <ImagePicker label="顶部大图" thumb="h-9 w-9" value={e.heroImage} onChange={(url) => patch(e.id, { heroImage: url || undefined })} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink">
                        <label className="flex items-center gap-1.5">第<input type="number" min={0} step={1} className={`${pillInp} w-16 text-center tabular-nums`} value={e.minDay ?? 0}
                          onChange={(ev) => patch(e.id, { minDay: Math.max(0, Math.trunc(Number(ev.target.value)) || 0) || undefined })} />天后才能达成</label>
                        <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="accent-[var(--jade)]" checked={!!e.auto} onChange={(ev) => patch(e.id, { auto: ev.target.checked })} />满足即结算（不等时限）</label>
                        <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="accent-[var(--jade)]" checked={e.enabled !== false} onChange={(ev) => patch(e.id, { enabled: ev.target.checked })} />启用</label>
                      </div>
                    </div>
                  </details>

                  <div className="flex justify-end">
                    <button type="button" className={del} onClick={async () => { if (!(await confirm(`删除结局「${e.title || "未命名"}」？`))) return; save(list.filter((x) => x.id !== e.id)); setOpenId(null); }}>删除这条结局</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button type="button" onClick={add} className="w-full rounded-full border border-dashed border-line py-1.5 text-[12.5px] font-bold text-ink transition hover:border-[var(--jade)] hover:text-[var(--jade)]">＋ 添加自定义结局</button>
      </Area>

      {/* 区域 3｜结局评级维度设置 —— 【评级维度】：结局确定后才打分，不参与决定是哪个结局 */}
      <Area n={3} title="结局评级维度设置"
        desc={
          <>
            <p>结算时，会根据这里配置的维度计算综合评级；最多支持 {GRADE_DIM_MAX} 个评级维度。</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
              <li>每个维度选择一项本作品指标，系统按数值自动换算评级（S+、S、A、B、C、D）与图标；</li>
              <li>综合评级取全部维度的平均；结局规则里单独指定了评级时，以结局的评级为准。</li>
            </ul>
          </>
        }>
        {dims.length === 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-2">
            <span className="rounded-full bg-[var(--gold)]/15 px-2 text-[10.5px] font-bold leading-5 text-ink">兜底内置，可全部替换</span>
            {Object.values(FALLBACK_DIM_LABELS).map((l) => {
              const card = dimCards.find((c) => c.label === l);
              return <span key={l} className="rounded-full border border-line bg-paper-2 px-2 text-[11.5px] leading-5 text-ink-soft">{l}{card ? <b className="ml-1 text-ink">{card.grade}</b> : null}</span>;
            })}
            <span className="w-full text-[11px] text-ink-soft">未配置维度时才使用这四项。添加任意一个维度后，兜底项全部停用。</span>
          </div>
        )}

        {dims.map((d) => {
          // 功能注释：脏评级维度可能缺 src；跳过整行，禁止 d.src.kind 崩④剧情
          if (!d || !d.src || typeof d.src.kind !== "string") return null;
          const card = dimCards.find((c) => c.id === d.id);
          const known = srcs.some((x) => x.kind === d.src.kind && x.key === d.src.key);
          const nextIcon = DIM_ICON_ORDER[(DIM_ICON_ORDER.indexOf(d.icon) + 1) % DIM_ICON_ORDER.length];
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-paper-2/60 px-2 py-1.5 text-[12px] text-ink">
              <button type="button" className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-paper" title="换图标" onClick={() => patchDim(d.id, { icon: nextIcon })}>
                <DimGlyph icon={d.icon} size={12} />
              </button>
              <select className={`${pillInp} max-w-[12rem] flex-1`} value={srcValue(d.src)} onChange={(ev) => setDimSrc(d, ev.target.value)} aria-label="指标名称">
                {!known && <option value={srcValue(d.src)}>已失效：{d.src.key}</option>}
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {srcs.filter((x) => x.group === g).map((x) => <option key={srcValue(x)} value={srcValue(x)}>{x.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <input className={`${pillInp} w-20`} placeholder="显示名" value={d.label} maxLength={8} onChange={(ev) => patchDim(d.id, { label: ev.target.value })} aria-label="显示名" />
              <span className="text-ink-soft">满分</span>
              <IntInput value={d.full} label="满分值" onChange={(v) => patchDim(d.id, { full: Math.max(1, v) })} />
              <label className="flex cursor-pointer items-center gap-1 text-ink-soft"><input type="checkbox" className="accent-[var(--jade)]" checked={!!d.lower} onChange={(ev) => patchDim(d.id, { lower: ev.target.checked || undefined })} />越低越好</label>
              <span className="ml-auto rounded-full bg-paper px-2 text-[11.5px] leading-5 text-ink-soft">
                {card && sim ? <>{d.label || srcLabel(d.src)} <b className="text-ink">{card.grade}</b> · 当前 {Math.round(dimValue(sim, d.src))}</> : "游戏内预览评级"}
              </span>
              <button type="button" className={del} onClick={() => saveDims(dims.filter((x) => x.id !== d.id))} aria-label={`删除维度 ${d.label}`}>×</button>
            </div>
          );
        })}

        <button type="button" onClick={addDim} disabled={dims.length >= GRADE_DIM_MAX || !srcs.length}
          className="w-full rounded-full border border-dashed border-line py-1.5 text-[12px] font-bold text-ink transition hover:border-[var(--jade)] hover:text-[var(--jade)] disabled:pointer-events-none disabled:opacity-40">
          {dims.length >= GRADE_DIM_MAX ? `已达上限 ${GRADE_DIM_MAX} 条` : "＋ 添加评级维度"}
        </button>
        {srcs.every((x) => x.group === GROUP_BUILTIN) && (
          <p className="text-[11px] text-ink-soft">本作品还没有自定义属性或人物线路词条，下拉里只有引擎内置数值。可先在「建角」或「人物线路」里建好再来选。</p>
        )}
      </Area>
    </div>
  );
}
