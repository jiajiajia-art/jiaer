import {
  GRADE_LABEL,
  type DayGrade,
  type LessonGrade,
  type StatsSlot,
  type TuningSlot,
  type GigRules,
  type GigCond,
  type GigRepair,
  type GigManager,
  RAW_STAT_LABELS,
  RAW_STAT_ORDER,
} from "../game/data";
import {
  TUNING_MODULE_META,
  type TuningModuleId,
  isTuningModuleOn,
  clearTuningModule,
  enableTuningModule,
  pruneTuningSlot,
} from "../game/tuningModules";
import type { AttrDef } from "../lib/types";

/* 模组编辑器 · 引擎规则：创作者勾选模块后才出现对应表单；数字自填，空着开局不生效，不预填某一打工剧本。 */
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/60 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const head = "text-[12px] font-bold text-ink";
const ORDER: DayGrade[] = ["perfect", "great", "success", "fail", "bad"];
const opt = (v: string) => (v === "" ? undefined : Number(v) || 0);
const emptyHint = "还没写，开局不会生效";

export default function ModTuningEditor({
  value,
  stats,
  attrs,
  npcs,
  showCourses = true,
  showJobs = true,
  showCareer = true,
  showModulePicker = true,
  onChange,
}: {
  value?: TuningSlot;
  stats?: StatsSlot;
  attrs?: AttrDef[];
  npcs?: { id: string; name: string }[];
  /** 功能注释：未勾养成「课程」时不出现课程倍率模块，避免默认塞娱乐圈课程经济 */
  showCourses?: boolean;
  /** 功能注释：未勾养成「打工」时不出现打工倍率 */
  showJobs?: boolean;
  /** 功能注释：未装通告/合约等演艺玩法时不出现工作结算与违约 */
  showCareer?: boolean;
  /**
   * 功能注释：养成总开关页已统一勾选子项时，隐藏本组件内的模块清单，只渲染已勾表单，
   * 避免再出现「引擎规则」第二块勾选卡。
   */
  showModulePicker?: boolean;
  onChange: (v?: TuningSlot) => void;
}) {
  const t = value ?? {};
  const replace = (next: TuningSlot) => onChange(pruneTuningSlot(next) as TuningSlot | undefined);
  const commit = (p: Partial<TuningSlot>) => {
    const next: Record<string, unknown> = { ...t, ...p };
    for (const k of Object.keys(next)) if (next[k] === undefined || (typeof next[k] === "object" && next[k] && !Array.isArray(next[k]) && !Object.keys(next[k] as object).length)) delete next[k];
    replace(next as TuningSlot);
  };
  // 功能注释：勾选只打开空表单；取消勾选清字段，保证开局不再生效。
  const setModule = (id: TuningModuleId, on: boolean) => {
    replace((on ? enableTuningModule(t, id) : clearTuningModule(t, id)) as TuningSlot);
  };
  const on = (id: TuningModuleId) => isTuningModuleOn(t, id);
  // 功能注释：只列出本作品相关玩法模块；课程/通告/违约不默认出现在每个剧本
  const visibleModules = TUNING_MODULE_META.filter((m) => {
    if (m.id === "course") return showCourses;
    if (m.id === "jobPay") return showJobs;
    if (m.id === "work" || m.id === "breach") return showCareer;
    return true;
  });

  const setRec = (k: "gradeOdds" | "gradeMul", g: DayGrade, v: string) => {
    const rec = { ...(t[k] ?? {}) };
    const n = opt(v);
    if (n === undefined) delete rec[g]; else rec[g] = n;
    commit({ [k]: Object.keys(rec).length ? rec : undefined });
  };
  const hasGradeOdds = !!(t.gradeOdds && Object.keys(t.gradeOdds).length);
  const odds = t.gradeOdds ?? {};
  const total = ORDER.reduce((a, g) => a + Math.max(0, odds[g] ?? 0), 0) || 1;
  const hidden = new Set(stats?.hidden ?? []);
  const luckOpts = [
    ...RAW_STAT_ORDER.filter((k) => !hidden.has(k)).map((k) => ({ v: `stat:${k}`, l: (typeof stats?.labels?.[k] === "string" ? stats.labels![k]!.trim() : "") || RAW_STAT_LABELS[k] })),
    ...(Array.isArray(attrs) ? attrs : []).map((a) => ({ v: `c:${a.id}`, l: `${a.label || a.id}（自定义）` })),
  ];
  const gr = t.gigRules ?? {};
  const setGr = (p: Partial<GigRules>) => {
    const next: Record<string, unknown> = { ...gr, ...p };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    commit({ gigRules: Object.keys(next).length ? (next as GigRules) : undefined });
  };
  const crashTouched = gr.crashOn !== undefined || gr.crashMods !== undefined || gr.crashStress != null || gr.crashBase != null || gr.crashMin != null;
  const crashOn = crashTouched ? gr.crashOn !== false : false;
  const bizTouched = gr.bizOn !== undefined || gr.bizTypes != null || gr.bizMin != null || gr.bizMax != null || gr.bizKey != null;
  const bizOn = bizTouched ? gr.bizOn !== false : false;
  const grNum = (k: "crashStress" | "crashBase" | "crashMin" | "bizMin" | "bizMax" | "breachBase" | "breachHi", label: string) => (
    <label className="block text-[10.5px] text-ink-soft">{label}
      <input type="number" className={`${inp} mt-0.5`} value={gr[k] ?? ""} placeholder={emptyHint} onChange={(e) => setGr({ [k]: opt(e.target.value) })} />
    </label>
  );
  const grNum2 = (k: "failPayMax", label: string) => (
    <label className="block text-[10.5px] text-ink-soft">{label}
      <input type="number" className={`${inp} mt-0.5 !w-20`} value={gr[k] ?? ""} placeholder={emptyHint} onChange={(e) => setGr({ [k]: opt(e.target.value) })} />
    </label>
  );
  const mods = gr.crashMods ?? [];
  const setMods = (m: GigCond[]) => setGr({ crashMods: m.length ? m : undefined });
  const condOpts = [
    ...RAW_STAT_ORDER.filter((k) => !hidden.has(k)).map((k) => ({ v: `stat:${k}`, l: (typeof stats?.labels?.[k] === "string" ? stats.labels![k]!.trim() : "") || RAW_STAT_LABELS[k] })),
    ...(Array.isArray(attrs) ? attrs : []).map((a) => ({ v: `attr:${a.id}`, l: `${a.label || a.id}（自定义）` })),
    { v: "affinity", l: "人物好感" },
    { v: "stress", l: "压力" }, { v: "fame", l: "名气" }, { v: "reputation", l: "口碑" },
    { v: "trust", l: "负责人信任" }, { v: "pr", l: "公关值" }, { v: "blackFans", l: "黑粉" }, { v: "defaults", l: "违约次数" },
  ];
  const fxOpts = [...condOpts.filter((o) => o.v !== "affinity"), { v: "money", l: "资金" }];
  const repairs = gr.repairs ?? [];
  const setRepairs = (v: GigRepair[]) => setGr({ repairs: v.length ? v : undefined });
  const upRepair = (i: number, p: Partial<GigRepair>) => setRepairs(repairs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const managers = gr.managers ?? [];
  const failFx = gr.failFx ?? [];
  const setFailFx = (v: NonNullable<GigRules["failFx"]>) => setGr({ failFx: v.length ? v : undefined });
  const loss = gr.failStatLoss;
  const setManagers = (v: GigManager[]) => setGr({ managers: v.length ? v : undefined });
  const keySel = (v: string, opts: { v: string; l: string }[], onPick: (v: string) => void) => (
    <select className={`${inp} !w-auto`} value={v} onChange={(e) => onPick(e.target.value)}>
      {!opts.some((o) => o.v === v) && <option value={v}>{v}</option>}
      {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  const npcSel = (v: string | undefined, onPick: (v?: string) => void) => (
    <select className={`${inp} !w-auto`} value={v ?? ""} onChange={(e) => onPick(e.target.value || undefined)}>
      <option value="">选择人物</option>
      {v && !(npcs ?? []).some((p) => p.id === v) && <option value={v}>{v}</option>}
      {(npcs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
  const grades = t.lessonGrades ?? [];
  const setGrades = (g: LessonGrade[]) => commit({ lessonGrades: g.length ? g : undefined });
  const num = (k: keyof TuningSlot, label: string) => (
    <label className="block text-[10.5px] text-ink-soft">{label}
      <input type="number" step={1} className={`${inp} mt-0.5`} value={(t[k] as number | undefined) ?? ""} placeholder={emptyHint} onChange={(e) => commit({ [k]: opt(e.target.value) })} />
    </label>
  );

  return (
    <div className="space-y-4">
      {showModulePicker && (
        <div className="space-y-1.5">
          <p className={head}>本作品要用哪些规则 <span className="font-normal text-ink-soft">· 勾了才出现下面的表单；没勾的编辑器和开局都不出现、也不生效。课程 / 通告结算 / 违约只在本作品相关玩法开启后列出</span></p>
          <div className="space-y-1">
            {visibleModules.map((m) => (
              <label key={m.id} className="flex items-start gap-2 text-[11.5px] text-ink">
                <input type="checkbox" className="mt-0.5" checked={on(m.id)} onChange={(e) => setModule(m.id, e.target.checked)} />
                <span>
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-ink-soft"> · {m.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {!showCareer && (
            <p className="text-[11px] text-ink-soft">未添加通告 / 合约等演艺玩法时，不提供「工作结算」「违约惩罚」。</p>
          )}
        </div>
      )}

      {on("dayGrade") && (
        <div className="space-y-1.5">
          <p className={head}>每日表现评级 <span className="font-normal text-ink-soft">· 上课 / 打工 / 拍摄时掷出，决定收益倍率</span></p>
          {!hasGradeOdds && !t.gradeMul && <p className="text-[11px] text-ink-soft">{emptyHint}</p>}
          <div className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-x-1.5 gap-y-1 text-[11px]">
            <span /> <span className="text-ink-soft">基础概率 %</span> <span className="text-ink-soft">收益倍率</span> <span className="text-ink-soft">实际</span>
            {ORDER.map((g) => (
              <div key={g} className="contents">
                <span className="font-semibold text-ink">{GRADE_LABEL[g]}</span>
                <input type="number" min={0} className={inp} value={t.gradeOdds?.[g] ?? ""} placeholder={emptyHint} onChange={(e) => setRec("gradeOdds", g, e.target.value)} />
                <input type="number" step={0.1} className={inp} value={t.gradeMul?.[g] ?? ""} placeholder={emptyHint} onChange={(e) => setRec("gradeMul", g, e.target.value)} />
                <span className="w-10 text-right text-ink-soft">{hasGradeOdds ? `${Math.round((Math.max(0, odds[g] ?? 0) / total) * 100)}%` : "—"}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <label className="block text-[10.5px] text-ink-soft">提升表现的属性
              <select className={`${inp} mt-0.5`} value={t.luckStat ?? ""} onChange={(e) => commit({ luckStat: e.target.value || undefined })}>
                <option value="">还没写</option>
                {luckOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
            {num("luckDiv", "每多少点 +1%（0=不影响）")}
            {num("stressDiv", "压力每多少点 -1%（0=不影响）")}
          </div>
        </div>
      )}

      {showCareer && on("work") && (
        <div className="space-y-1.5">
          <p className={head}>工作结算规则 <span className="font-normal text-ink-soft">· 没写的项开局不会生效</span></p>
          <label className="flex items-center gap-1.5 text-[11.5px] text-ink"><input type="checkbox" checked={crashOn} onChange={(e) => setGr({ crashOn: e.target.checked ? true : false })} />压力过高时工作可能崩溃（直接失败）</label>
          {crashOn && (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {grNum("crashStress", "压力达到")}
                {grNum("crashBase", "基础概率 %")}
                {grNum("crashMin", "最低概率 %")}
              </div>
              <p className="text-[10.5px] text-ink-soft">概率修正：满足条件则加减概率（负数为降低）</p>
              {!mods.length && <p className="text-[11px] text-ink-soft">{emptyHint}</p>}
              {mods.map((m, i) => {
                const up = (p: Partial<GigCond>) => setMods(mods.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <div key={i} className="flex flex-wrap items-center gap-1 text-[11px]">
                    <select className={`${inp} !w-auto`} value={m.key} onChange={(e) => up({ key: e.target.value })}>
                      {!condOpts.some((o) => o.v === m.key) && <option value={m.key}>{m.key}</option>}
                      {condOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    {m.key === "affinity" && (
                      <select className={`${inp} !w-auto`} value={m.pid ?? ""} onChange={(e) => up({ pid: e.target.value || undefined })}>
                        <option value="">选择人物</option>
                        {m.pid && !(npcs ?? []).some((p) => p.id === m.pid) && <option value={m.pid}>{m.pid}</option>}
                        {(npcs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                    <select className={`${inp} !w-auto`} value={m.op} onChange={(e) => up({ op: e.target.value as GigCond["op"] })}><option value=">=">≥</option><option value="<=">≤</option></select>
                    <input type="number" className={`${inp} !w-16`} value={m.value} onChange={(e) => up({ value: Number(e.target.value) || 0 })} />
                    <span className="text-ink-soft">概率</span>
                    <input type="number" className={`${inp} !w-14`} value={m.delta} onChange={(e) => up({ delta: Number(e.target.value) || 0 })} />
                    <span className="text-ink-soft">%</span>
                    <button className={btn} onClick={() => setMods(mods.filter((_, j) => j !== i))} aria-label="删除条件">×</button>
                  </div>
                );
              })}
              <div className="flex gap-1.5">
                <button className={btn} onClick={() => setMods([...mods, { key: condOpts[0]?.v ?? "stress", op: ">=", value: 0, delta: -5 }])}>+ 条件</button>
              </div>
            </>
          )}
          <label className="flex items-center gap-1.5 text-[11.5px] text-ink"><input type="checkbox" checked={bizOn} onChange={(e) => setGr({ bizOn: e.target.checked ? true : false })} />特定类型工作成功后涨商业价值</label>
          {bizOn && (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <label className="col-span-2 block text-[10.5px] text-ink-soft">工作类型（类型名包含其一，用 | 分隔）
                <input className={`${inp} mt-0.5`} value={gr.bizTypes ?? ""} placeholder={emptyHint} onChange={(e) => setGr({ bizTypes: e.target.value || undefined })} />
              </label>
              {grNum("bizMin", "每次涨 最少")}
              {grNum("bizMax", "每次涨 最多")}
              <label className="col-span-2 block text-[10.5px] text-ink-soft">涨到哪个属性
                <select className={`${inp} mt-0.5`} value={gr.bizKey ?? ""} onChange={(e) => setGr({ bizKey: e.target.value || undefined })}>
                  <option value="">还没写</option>
                  {condOpts.filter((o) => o.v !== "affinity" && o.v !== "stress").map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </label>
            </div>
          )}

          <p className="pt-1 text-[11.5px] font-semibold text-ink">工作失败的惩罚 <span className="font-normal text-ink-soft">· 每项在两个数之间随机，负数为扣除</span></p>
          {!failFx.length && <p className="text-[11px] text-ink-soft">{emptyHint}</p>}
          {failFx.map((x, k) => {
            const upF = (p: Partial<typeof x>) => setFailFx(failFx.map((y, j) => (j === k ? { ...y, ...p } : y)));
            return (
              <div key={k} className="flex flex-wrap items-center gap-1 text-[11px]">
                {keySel(x.key, fxOpts, (key) => upF({ key }))}
                <input type="number" className={`${inp} !w-20`} value={x.min} onChange={(e) => upF({ min: Number(e.target.value) || 0 })} />
                <span className="text-ink-soft">至</span>
                <input type="number" className={`${inp} !w-20`} value={x.max} onChange={(e) => upF({ max: Number(e.target.value) || 0 })} />
                <button className={btn} onClick={() => setFailFx(failFx.filter((_, j) => j !== k))} aria-label="删除惩罚">×</button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-1.5 text-[11px]">
            <button className={btn} onClick={() => setFailFx([...failFx, { key: "stress", min: 5, max: 5 }])}>+ 惩罚</button>
            {grNum2("failPayMax", "失败仍得报酬 最多 %")}
            <label className="block text-[10.5px] text-ink-soft">相关能力各降
              <span className="mt-0.5 flex items-center gap-1">
                <input type="number" className={`${inp} !w-14`} value={loss?.[0] ?? ""} placeholder="—" onChange={(e) => setGr({ failStatLoss: e.target.value === "" && (loss?.[1] == null) ? undefined : [Number(e.target.value) || 0, loss?.[1] ?? 0] })} />
                <span>至</span>
                <input type="number" className={`${inp} !w-14`} value={loss?.[1] ?? ""} placeholder="—" onChange={(e) => setGr({ failStatLoss: (loss?.[0] == null) && e.target.value === "" ? undefined : [loss?.[0] ?? 0, Number(e.target.value) || 0] })} />
              </span>
            </label>
          </div>

          <p className="pt-1 text-[11.5px] font-semibold text-ink">失败后的补救方案 <span className="font-normal text-ink-soft">· 工作失败时，从满足条件的方案里随机触发 1 项</span></p>
          {!repairs.length && <p className="text-[11px] text-ink-soft">{emptyHint}</p>}
          {repairs.map((rp, i) => {
            const conds = rp.conds ?? [];
            const setConds = (c: Omit<GigCond, "delta">[]) => upRepair(i, { conds: c.length ? c : undefined });
            return (
              <div key={i} className="space-y-1 rounded-lg bg-paper-2/60 p-1.5 text-[11px]">
                <div className="flex flex-wrap items-center gap-1">
                  <input className={`${inp} !w-28`} value={rp.name} placeholder="方案名称" onChange={(e) => upRepair(i, { name: e.target.value })} />
                  <span className="text-ink-soft">工作星级 ≤</span>
                  <input type="number" className={`${inp} !w-14`} value={rp.maxStar ?? ""} placeholder="不限" onChange={(e) => upRepair(i, { maxStar: opt(e.target.value) })} />
                  {conds.length > 1 && (
                    <select className={`${inp} !w-auto`} value={rp.any ? "any" : "all"} onChange={(e) => upRepair(i, { any: e.target.value === "any" || undefined })}>
                      <option value="all">条件全部满足</option><option value="any">任一条件满足</option>
                    </select>
                  )}
                  <button className={`${btn} ml-auto`} onClick={() => setRepairs(repairs.filter((_, j) => j !== i))} aria-label="删除方案">×</button>
                </div>
                {conds.map((c, k) => {
                  const upC = (p: Partial<GigCond>) => setConds(conds.map((x, j) => (j === k ? { ...x, ...p } : x)));
                  return (
                    <div key={k} className="flex flex-wrap items-center gap-1">
                      <span className="text-ink-soft">条件</span>
                      {keySel(c.key, condOpts, (key) => upC({ key }))}
                      {c.key === "affinity" && npcSel(c.pid, (pid) => upC({ pid }))}
                      <select className={`${inp} !w-auto`} value={c.op} onChange={(e) => upC({ op: e.target.value as GigCond["op"] })}><option value=">=">≥</option><option value="<=">≤</option></select>
                      <input type="number" className={`${inp} !w-20`} value={c.value} onChange={(e) => upC({ value: Number(e.target.value) || 0 })} />
                      <button className={btn} onClick={() => setConds(conds.filter((_, j) => j !== k))} aria-label="删除条件">×</button>
                    </div>
                  );
                })}
                {rp.fx.map((x, k) => {
                  const upF = (p: Partial<GigRepair["fx"][number]>) => upRepair(i, { fx: rp.fx.map((y, j) => (j === k ? { ...y, ...p } : y)) });
                  return (
                    <div key={k} className="flex flex-wrap items-center gap-1">
                      <span className="text-ink-soft">效果</span>
                      {keySel(x.key, fxOpts, (key) => upF({ key }))}
                      <input type="number" className={`${inp} !w-20`} value={x.min} onChange={(e) => upF({ min: Number(e.target.value) || 0 })} />
                      <span className="text-ink-soft">至</span>
                      <input type="number" className={`${inp} !w-20`} value={x.max} onChange={(e) => upF({ max: Number(e.target.value) || 0 })} />
                      <button className={btn} onClick={() => upRepair(i, { fx: rp.fx.filter((_, j) => j !== k) })} aria-label="删除效果">×</button>
                    </div>
                  );
                })}
                <div className="flex gap-1.5">
                  <button className={btn} onClick={() => setConds([...conds, { key: condOpts[0]?.v ?? "stress", op: ">=", value: 0 }])}>+ 条件</button>
                  <button className={btn} onClick={() => upRepair(i, { fx: [...rp.fx, { key: "stress", min: -5, max: -5 }] })}>+ 效果</button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-1.5">
            <button className={btn} onClick={() => setRepairs([...repairs, { name: `补救方案 ${repairs.length + 1}`, fx: [{ key: "stress", min: -5, max: -5 }] }])}>+ 补救方案</button>
          </div>

          <p className="pt-1 text-[11.5px] font-semibold text-ink">工作对接负责人 <span className="font-normal text-ink-soft">· 按工作类型从上往下匹配第一条</span></p>
          {!managers.length && !gr.managerDefault && <p className="text-[11px] text-ink-soft">{emptyHint}</p>}
          {managers.map((m, i) => {
            const upM = (p: Partial<GigManager>) => setManagers(managers.map((x, j) => (j === i ? { ...x, ...p } : x)));
            return (
              <div key={i} className="grid grid-cols-[1.3fr_1fr_1fr_auto] items-center gap-1">
                <input className={inp} value={m.types} placeholder="类型（| 分隔）" onChange={(e) => upM({ types: e.target.value })} />
                <input className={inp} value={m.name} placeholder="负责人" onChange={(e) => upM({ name: e.target.value })} />
                <input className={inp} value={m.loc} placeholder="地点" onChange={(e) => upM({ loc: e.target.value })} />
                <button className={btn} onClick={() => setManagers(managers.filter((_, j) => j !== i))} aria-label="删除对接">×</button>
              </div>
            );
          })}
          <div className="grid grid-cols-[1.3fr_1fr_1fr_auto] items-center gap-1">
            <span className="text-[11px] text-ink-soft">其余类型</span>
            <input className={inp} value={gr.managerDefault?.name ?? ""} placeholder={emptyHint} onChange={(e) => { const d = { ...(gr.managerDefault ?? { name: "", loc: "" }), name: e.target.value }; setGr({ managerDefault: d.name || d.loc ? d : undefined }); }} />
            <input className={inp} value={gr.managerDefault?.loc ?? ""} placeholder={emptyHint} onChange={(e) => { const d = { ...(gr.managerDefault ?? { name: "", loc: "" }), loc: e.target.value }; setGr({ managerDefault: d.name || d.loc ? d : undefined }); }} />
            <span />
          </div>
          <div className="flex gap-1.5">
            <button className={btn} onClick={() => setManagers([...managers, { types: "", name: "", loc: "" }])}>+ 对接</button>
          </div>
        </div>
      )}

      {showCareer && on("breach") && (
        <div className="space-y-1.5">
          <p className={head}>违约惩罚 <span className="font-normal text-ink-soft">· 每次违约让后续交涉成功率降低；空着开局不生效</span></p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {grNum("breachBase", "每次违约 -%")}
            {grNum("breachHi", "重点类型每次 -%")}
            <label className="col-span-2 block text-[10.5px] text-ink-soft">重点类型（| 分隔）
              <input className={`${inp} mt-0.5`} value={gr.breachHiTypes ?? ""} placeholder={emptyHint} onChange={(e) => setGr({ breachHiTypes: e.target.value || undefined })} />
            </label>
          </div>
        </div>
      )}

      {on("rest") && (
        <div className="space-y-1.5">
          <p className={head}>休息减压</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {num("restStress", "休息减压")}
          </div>
        </div>
      )}

      {showJobs && on("jobPay") && (
        <div className="space-y-1.5">
          <p className={head}>打工收入倍率</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {num("jobPayMul", "打工收入×")}
          </div>
        </div>
      )}

      {showCourses && on("course") && (
        <div className="space-y-1.5">
          <p className={head}>课程倍率与等级 <span className="font-normal text-ink-soft">· 课程没有单独设等级时使用下面的通用表</span></p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {num("trainGainMul", "课程收益×")}
            {num("trainFeeMul", "学费×")}
          </div>
          {!grades.length && <p className="text-[11px] text-ink-soft">{emptyHint}</p>}
          {grades.map((g, i) => (
            <div key={g.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-1 rounded-lg bg-paper-2/60 p-1.5 sm:grid-cols-[1.4fr_repeat(4,1fr)_auto] sm:bg-transparent sm:p-0">
              <label className="block text-[10px] text-ink-soft">名称<input className={`${inp} mt-0.5`} value={g.label} placeholder={emptyHint} onChange={(e) => setGrades(grades.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></label>
              {([["costMul", "学费×"], ["gainMul", "收益×"], ["cap", "上限"], ["stressAdd", "压力+"]] as const).map(([k, l]) => (
                <label key={k} className="block text-[10px] text-ink-soft">{l}
                  <input type="number" step={k.endsWith("Mul") ? 0.1 : 1} className={`${inp} mt-0.5`} value={g[k] || ""} placeholder={emptyHint} onChange={(e) => setGrades(grades.map((x, j) => (j === i ? { ...x, [k]: Number(e.target.value) || 0 } : x)))} />
                </label>
              ))}
              <button className={btn} onClick={() => setGrades(grades.filter((_, j) => j !== i))} aria-label="删除等级">×</button>
            </div>
          ))}
          <div className="flex gap-1.5">
            {/* 功能注释：新增等级从空白起，不沿用上一档×2 / ×0.75 的娱乐圈曲线。 */}
            <button className={btn} onClick={() => setGrades([...grades, { id: `g_${Date.now().toString(36).slice(-5)}`, label: "", costMul: 0, gainMul: 0, cap: 0, stressAdd: 0 }])}>＋ 添加等级</button>
          </div>
        </div>
      )}

      {value && <button className={btn} onClick={() => onChange(undefined)}>清空全部引擎规则</button>}
    </div>
  );
}
