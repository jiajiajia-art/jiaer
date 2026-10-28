import { GRADE_LABEL, RAW_GRADE_MUL, RAW_GRADE_ODDS, RAW_LESSON_GRADES, RAW_STAT_LABELS, RAW_STAT_ORDER, type DayGrade, type LessonGrade, type StatsSlot, type TuningSlot, type GigRules, type GigCond, type GigRepair, type GigManager, RAW_CRASH_MODS, RAW_GIG_REPAIRS, RAW_GIG_MANAGERS, RAW_GIG_MANAGER_DEFAULT, RAW_FAIL_FX } from "../game/data";
import type { AttrDef } from "../lib/types";

/* 模组编辑器 · 引擎规则：原本写死在结算里的数值。留空 = 引擎原值（输入框里灰字显示）。 */
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/60 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const head = "text-[12px] font-bold text-ink";
const ORDER: DayGrade[] = ["perfect", "great", "success", "fail", "bad"];
const opt = (v: string) => (v === "" ? undefined : Number(v) || 0);

export default function ModTuningEditor({ value, stats, attrs, npcs, onChange }: { value?: TuningSlot; stats?: StatsSlot; attrs?: AttrDef[]; npcs?: { id: string; name: string }[]; onChange: (v?: TuningSlot) => void }) {
  const t = value ?? {};
  const commit = (p: Partial<TuningSlot>) => {
    const next: Record<string, unknown> = { ...t, ...p };
    for (const k of Object.keys(next)) if (next[k] === undefined || (typeof next[k] === "object" && next[k] && !Array.isArray(next[k]) && !Object.keys(next[k] as object).length)) delete next[k];
    onChange(Object.keys(next).length ? (next as TuningSlot) : undefined);
  };
  const setRec = (k: "gradeOdds" | "gradeMul", g: DayGrade, v: string) => {
    const rec = { ...(t[k] ?? {}) };
    const n = opt(v);
    if (n === undefined) delete rec[g]; else rec[g] = n;
    commit({ [k]: rec });
  };
  const odds = { ...RAW_GRADE_ODDS, ...(t.gradeOdds ?? {}) };
  const total = ORDER.reduce((a, g) => a + Math.max(0, odds[g]), 0) || 1;
  const hidden = new Set(stats?.hidden ?? []);
  const luckOpts = [
    ...RAW_STAT_ORDER.filter((k) => !hidden.has(k)).map((k) => ({ v: `stat:${k}`, l: (typeof stats?.labels?.[k] === "string" ? stats.labels![k]!.trim() : "") || RAW_STAT_LABELS[k] })),
    ...(attrs ?? []).map((a) => ({ v: `c:${a.id}`, l: `${a.label || a.id}（自定义）` })),
  ];
  const gr = t.gigRules ?? {};
  const setGr = (p: Partial<GigRules>) => {
    const next: Record<string, unknown> = { ...gr, ...p };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    commit({ gigRules: Object.keys(next).length ? (next as GigRules) : undefined });
  };
  const grNum = (k: "crashStress" | "crashBase" | "crashMin" | "bizMin" | "bizMax" | "breachBase" | "breachHi", label: string, def: number) => (
    <label className="block text-[10.5px] text-ink-soft">{label}
      <input type="number" className={`${inp} mt-0.5`} value={gr[k] ?? ""} placeholder={String(def)} onChange={(e) => setGr({ [k]: opt(e.target.value) })} />
    </label>
  );
  const grNum2 = (k: "failPayMax", label: string, def: number) => (
    <label className="block text-[10.5px] text-ink-soft">{label}
      <input type="number" className={`${inp} mt-0.5 !w-20`} value={gr[k] ?? ""} placeholder={String(def)} onChange={(e) => setGr({ [k]: opt(e.target.value) })} />
    </label>
  );
  const mods = gr.crashMods ?? RAW_CRASH_MODS;
  const setMods = (m: GigCond[]) => setGr({ crashMods: m });
  const condOpts = [
    ...RAW_STAT_ORDER.filter((k) => !hidden.has(k)).map((k) => ({ v: `stat:${k}`, l: (typeof stats?.labels?.[k] === "string" ? stats.labels![k]!.trim() : "") || RAW_STAT_LABELS[k] })),
    ...(attrs ?? []).map((a) => ({ v: `attr:${a.id}`, l: `${a.label || a.id}（自定义）` })),
    { v: "affinity", l: "人物好感" },
    { v: "stress", l: "压力" }, { v: "fame", l: "名气" }, { v: "reputation", l: "口碑" },
    { v: "trust", l: "负责人信任" }, { v: "pr", l: "公关值" }, { v: "blackFans", l: "黑粉" }, { v: "defaults", l: "违约次数" },
  ];
  const fxOpts = [...condOpts.filter((o) => o.v !== "affinity"), { v: "money", l: "资金" }];
  const repairs = gr.repairs ?? RAW_GIG_REPAIRS;
  const setRepairs = (v: GigRepair[]) => setGr({ repairs: v });
  const upRepair = (i: number, p: Partial<GigRepair>) => setRepairs(repairs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const managers = gr.managers ?? RAW_GIG_MANAGERS;
  const failFx = gr.failFx ?? RAW_FAIL_FX;
  const setFailFx = (v: NonNullable<GigRules["failFx"]>) => setGr({ failFx: v });
  const loss = gr.failStatLoss ?? [1, 4];
  const setManagers = (v: GigManager[]) => setGr({ managers: v });
  const keySel = (v: string, opts: { v: string; l: string }[], on: (v: string) => void) => (
    <select className={`${inp} !w-auto`} value={v} onChange={(e) => on(e.target.value)}>
      {!opts.some((o) => o.v === v) && <option value={v}>{v}</option>}
      {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  const npcSel = (v: string | undefined, on: (v?: string) => void) => (
    <select className={`${inp} !w-auto`} value={v ?? ""} onChange={(e) => on(e.target.value || undefined)}>
      <option value="">选择人物</option>
      {v && !(npcs ?? []).some((p) => p.id === v) && <option value={v}>{v}</option>}
      {(npcs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
  const grades = t.lessonGrades ?? [];
  const setGrades = (g: LessonGrade[]) => commit({ lessonGrades: g.length ? g : undefined });
  const num = (k: keyof TuningSlot, label: string, def: number, step = 1) => (
    <label className="block text-[10.5px] text-ink-soft">{label}
      <input type="number" step={step} className={`${inp} mt-0.5`} value={(t[k] as number | undefined) ?? ""} placeholder={String(def)} onChange={(e) => commit({ [k]: opt(e.target.value) })} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className={head}>每日表现评级 <span className="font-normal text-ink-soft">· 上课 / 打工 / 拍摄时掷出，决定收益倍率</span></p>
        <div className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-x-1.5 gap-y-1 text-[11px]">
          <span /> <span className="text-ink-soft">基础概率 %</span> <span className="text-ink-soft">收益倍率</span> <span className="text-ink-soft">实际</span>
          {ORDER.map((g) => (
            <div key={g} className="contents">
              <span className="font-semibold text-ink">{GRADE_LABEL[g]}</span>
              <input type="number" min={0} className={inp} value={t.gradeOdds?.[g] ?? ""} placeholder={String(RAW_GRADE_ODDS[g])} onChange={(e) => setRec("gradeOdds", g, e.target.value)} />
              <input type="number" step={0.1} className={inp} value={t.gradeMul?.[g] ?? ""} placeholder={String(RAW_GRADE_MUL[g])} onChange={(e) => setRec("gradeMul", g, e.target.value)} />
              <span className="w-10 text-right text-ink-soft">{Math.round((Math.max(0, odds[g]) / total) * 100)}%</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          <label className="block text-[10.5px] text-ink-soft">提升表现的属性
            <select className={`${inp} mt-0.5`} value={t.luckStat ?? ""} onChange={(e) => commit({ luckStat: e.target.value || undefined })}>
              <option value="">默认（{(typeof stats?.labels?.zixin === "string" ? stats.labels.zixin.trim() : "") || RAW_STAT_LABELS.zixin}）</option>
              {luckOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </label>
          {num("luckDiv", "每多少点 +1%（0=不影响）", 40)}
          {num("stressDiv", "压力每多少点 -1%（0=不影响）", 3)}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className={head}>工作结算规则 <span className="font-normal text-ink-soft">· 留空 = 引擎原规则</span></p>
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink"><input type="checkbox" checked={gr.crashOn !== false} onChange={(e) => setGr({ crashOn: e.target.checked ? undefined : false })} />压力过高时工作可能崩溃（直接失败）</label>
        {gr.crashOn !== false && (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {grNum("crashStress", "压力达到", 90)}
              {grNum("crashBase", "基础概率 %", 20)}
              {grNum("crashMin", "最低概率 %", 5)}
            </div>
            <p className="text-[10.5px] text-ink-soft">概率修正：满足条件则加减概率（负数为降低）</p>
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
              {gr.crashMods && <button className={btn} onClick={() => setGr({ crashMods: undefined })}>恢复默认条件</button>}
            </div>
          </>
        )}
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink"><input type="checkbox" checked={gr.bizOn !== false} onChange={(e) => setGr({ bizOn: e.target.checked ? undefined : false })} />特定类型工作成功后涨商业价值</label>
        {gr.bizOn !== false && (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <label className="col-span-2 block text-[10.5px] text-ink-soft">工作类型（类型名包含其一，用 | 分隔）
              <input className={`${inp} mt-0.5`} value={gr.bizTypes ?? ""} placeholder="广告|综艺|品牌" onChange={(e) => setGr({ bizTypes: e.target.value || undefined })} />
            </label>
            {grNum("bizMin", "每次涨 最少", 4)}
            {grNum("bizMax", "每次涨 最多", 9)}
            <label className="col-span-2 block text-[10.5px] text-ink-soft">涨到哪个属性
              <select className={`${inp} mt-0.5`} value={gr.bizKey ?? ""} onChange={(e) => setGr({ bizKey: e.target.value || undefined })}>
                <option value="">商业价值（默认）</option>
                {condOpts.filter((o) => o.v !== "affinity" && o.v !== "stress").map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
          </div>
        )}

        <p className="pt-1 text-[11.5px] font-semibold text-ink">工作失败的惩罚 <span className="font-normal text-ink-soft">· 每项在两个数之间随机，负数为扣除</span></p>
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
          {gr.failFx && <button className={btn} onClick={() => setGr({ failFx: undefined })}>恢复默认惩罚</button>}
          {grNum2("failPayMax", "失败仍得报酬 最多 %", 30)}
          <label className="block text-[10.5px] text-ink-soft">相关能力各降
            <span className="mt-0.5 flex items-center gap-1">
              <input type="number" className={`${inp} !w-14`} value={loss[0]} onChange={(e) => setGr({ failStatLoss: [Number(e.target.value) || 0, loss[1]] })} />
              <span>至</span>
              <input type="number" className={`${inp} !w-14`} value={loss[1]} onChange={(e) => setGr({ failStatLoss: [loss[0], Number(e.target.value) || 0] })} />
            </span>
          </label>
        </div>

        <p className="pt-1 text-[11.5px] font-semibold text-ink">失败后的补救方案 <span className="font-normal text-ink-soft">· 工作失败时，从满足条件的方案里随机触发 1 项</span></p>
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
          {gr.repairs && <button className={btn} onClick={() => setGr({ repairs: undefined })}>恢复默认方案</button>}
        </div>

        <p className="pt-1 text-[11.5px] font-semibold text-ink">违约惩罚 <span className="font-normal text-ink-soft">· 每次违约让后续交涉成功率降低</span></p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {grNum("breachBase", "每次违约 -%", 8)}
          {grNum("breachHi", "重点类型每次 -%", 14)}
          <label className="col-span-2 block text-[10.5px] text-ink-soft">重点类型（| 分隔）
            <input className={`${inp} mt-0.5`} value={gr.breachHiTypes ?? ""} placeholder="广告|品牌|电影" onChange={(e) => setGr({ breachHiTypes: e.target.value || undefined })} />
          </label>
        </div>

        <p className="pt-1 text-[11.5px] font-semibold text-ink">工作对接负责人 <span className="font-normal text-ink-soft">· 按工作类型从上往下匹配第一条</span></p>
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
          <input className={inp} value={gr.managerDefault?.name ?? ""} placeholder={RAW_GIG_MANAGER_DEFAULT.name} onChange={(e) => { const d = { ...(gr.managerDefault ?? RAW_GIG_MANAGER_DEFAULT), name: e.target.value }; setGr({ managerDefault: d.name || d.loc ? d : undefined }); }} />
          <input className={inp} value={gr.managerDefault?.loc ?? ""} placeholder={RAW_GIG_MANAGER_DEFAULT.loc} onChange={(e) => { const d = { ...(gr.managerDefault ?? RAW_GIG_MANAGER_DEFAULT), loc: e.target.value }; setGr({ managerDefault: d.name || d.loc ? d : undefined }); }} />
          <span />
        </div>
        <div className="flex gap-1.5">
          <button className={btn} onClick={() => setManagers([...managers, { types: "", name: "", loc: "" }])}>+ 对接</button>
          {gr.managers && <button className={btn} onClick={() => setGr({ managers: undefined })}>恢复默认对接表</button>}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className={head}>收支与恢复</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {num("restStress", "休息减压", 8)}
          {num("trainGainMul", "课程收益×", 1, 0.1)}
          {num("trainFeeMul", "学费×", 1, 0.1)}
          {num("jobPayMul", "打工收入×", 1, 0.1)}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className={head}>通用课程等级 <span className="font-normal text-ink-soft">· 课程没有单独设等级时使用</span></p>
        {!grades.length && <button className={btn} onClick={() => setGrades(RAW_LESSON_GRADES.map((g) => ({ ...g })))}>以默认 4 级为起点自定义</button>}
        {grades.map((g, i) => (
          <div key={g.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-1 rounded-lg bg-paper-2/60 p-1.5 sm:grid-cols-[1.4fr_repeat(4,1fr)_auto] sm:bg-transparent sm:p-0">
            <label className="block text-[10px] text-ink-soft">名称<input className={`${inp} mt-0.5`} value={g.label} onChange={(e) => setGrades(grades.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></label>
            {([["costMul", "学费×"], ["gainMul", "收益×"], ["cap", "上限"], ["stressAdd", "压力+"]] as const).map(([k, l]) => (
              <label key={k} className="block text-[10px] text-ink-soft">{l}
                <input type="number" step={k.endsWith("Mul") ? 0.1 : 1} className={`${inp} mt-0.5`} value={g[k]} onChange={(e) => setGrades(grades.map((x, j) => (j === i ? { ...x, [k]: Number(e.target.value) || 0 } : x)))} />
              </label>
            ))}
            <button className={btn} onClick={() => setGrades(grades.filter((_, j) => j !== i))} aria-label="删除等级">×</button>
          </div>
        ))}
        {grades.length > 0 && (
          <div className="flex gap-1.5">
            <button className={btn} onClick={() => { const l = grades[grades.length - 1]; setGrades([...grades, { id: `g_${Date.now().toString(36).slice(-5)}`, label: `Lv${grades.length + 1}`, costMul: (l?.costMul ?? 1) * 2, gainMul: Math.max(0.1, (l?.gainMul ?? 1) * 0.75), cap: (l?.cap ?? 250) + 250, stressAdd: (l?.stressAdd ?? 0) + 1 }]); }}>＋ 添加等级</button>
            <button className={btn} onClick={() => setGrades([])}>恢复默认</button>
          </div>
        )}
      </div>
      {value && <button className={btn} onClick={() => onChange(undefined)}>全部恢复引擎原值</button>}
    </div>
  );
}
