import type { TransportMode, TravelContent } from "../worlds/star2005/content";

/* 模组编辑器 · 出行与交通：基础路程参数 + 出行方式列表 + 默认方式 + 买车地点。
 * part="pace" 只渲染行动点与推进节奏（放在「时间与推进」，关掉交通系统也能配）；part="transport" 只渲染出行部分 */
const ICONS: [string, string][] = [["walk", "步行"], ["bike", "单车"], ["bus", "公交"], ["subway", "地铁"], ["taxi", "打车"], ["drive", "汽车"]];
const PRESET: TransportMode[] = [
  { id: "walk", label: "步行", fareMul: 0, timeMul: 1, fee: 0, note: "免费" },
  { id: "bus", label: "公交", fareMul: 0, timeMul: 1, fee: 2, note: "便宜，但要等" },
  { id: "subway", label: "地铁", fareMul: 0, timeMul: 1, fee: 4, note: "准点，性价比高" },
  { id: "taxi", label: "打车", fareMul: 0, timeMul: 1, fee: 20, note: "舒服，也最贵" },
  { id: "drive", label: "自己开车", fareMul: 0, timeMul: 1, fee: 0, note: "需要自有座驾", ownCar: true },
];
// 公共交通票价：作者直接填（每趟固定）；旧数据由 基础车费×倍率 换算显示
const feeOf = (m: TransportMode, base: number) => m.fee ?? Math.round(base * m.fareMul);
const BASE: TravelContent = { minutesPerHop: 20, feePerHop: 20, energyPerHop: 6 };
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

export default function ModTravelEditor({ value, rooms, onChange, part }: { value?: TravelContent; rooms: { id: string; name: string }[]; onChange: (v?: TravelContent) => void; part?: "pace" | "transport" }) {
  const pace = part !== "transport", transport = part !== "pace";
  const t = { ...BASE, ...value };
  const modes = t.modes ?? [];
  const set = (p: Partial<TravelContent>) => onChange({ ...t, ...p });
  const setMode = (i: number, p: Partial<TransportMode>) => set({ modes: modes.map((m, j) => (j === i ? { ...m, ...p } : m)) });
  const num = (v: string, min = 0) => Math.max(min, Number(v) || 0);
  const sample = modes.length ? modes : PRESET;

  return (
    <div className="space-y-3">
      {pace && <div className="grid grid-cols-2 gap-1.5">
        <label className="block text-[11px] text-ink-soft">每回合行动点（支线体力）
          <input type="number" min={1} max={99} value={t.apPerTurn ?? 10} onChange={(e) => set({ apPerTurn: num(e.target.value, 1) })} className={`${inp} mt-0.5`} />
        </label>
        <label className="block text-[11px] text-ink-soft">换一次地点扣
          <input type="number" min={0} max={99} value={t.apPerMove ?? 1} onChange={(e) => set({ apPerMove: num(e.target.value) })} className={`${inp} mt-0.5`} />
        </label>
        <p className="col-span-2 text-[10.5px] text-ink-soft">主线：每次「推进」进入新回合、行动点回满；支线：换地点按固定点数扣，进入事件支线按各事件设定扣点，不推进日历。行动点用完就得回主线推进时间。</p>
      </div>}

      {/* 出行面板文案：模组自定义（如古风世界改成「如何前往 / 文 / 不费分文」） */}
      {transport && <div className="grid grid-cols-3 gap-1.5">
        <label className="block text-[11px] text-ink-soft">选择区标题
          <input value={t.pickTitle ?? ""} placeholder="怎么去" onChange={(e) => set({ pickTitle: e.target.value || undefined })} className={`${inp} mt-0.5`} />
        </label>
        <label className="block text-[11px] text-ink-soft">货币符号
          <input value={t.currency ?? ""} placeholder="¥" onChange={(e) => set({ currency: e.target.value || undefined })} className={`${inp} mt-0.5`} />
        </label>
        <label className="block text-[11px] text-ink-soft">免费文案
          <input value={t.freeLabel ?? ""} placeholder="免费" onChange={(e) => set({ freeLabel: e.target.value || undefined })} className={`${inp} mt-0.5`} />
        </label>
      </div>}

      {pace && <div className="space-y-1.5 rounded-xl border border-line bg-paper-2 p-2.5">
        <p className="text-[12px] font-bold text-ink">默认推进节奏 <span className="font-normal text-ink-soft">开局默认值 · 玩家可在日程面板里自选</span></p>
        {/* 推进单位：日 / 周 / 月 / 年 */}
        <div className="grid grid-cols-4 gap-1">
          {([["day", "日"], ["week", "周"], ["month", "月"], ["year", "年"]] as const).map(([u, l]) => {
            const on = (t.advanceUnit ?? "day") === u;
            return (
              <button key={u} type="button" onClick={() => set({ advanceUnit: u === "day" ? undefined : u })}
                className={`rounded-[6px] border py-2 text-center transition ${on ? "border-jade bg-jade/10 text-jade" : "border-line bg-paper text-ink hover:border-jade"}`}>
                <span className="block font-serif text-[16px] font-black leading-none">{l}</span>
                <span className="mt-1 block text-[10px] text-ink-soft">按{l}推进</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(t.advanceUnit ?? "day") === "day" ? (
            <label className="block text-[11px] text-ink-soft">每次推进（天）
              <input type="number" min={1} max={30} value={t.advanceDays ?? 1} onChange={(e) => set({ advanceDays: Math.min(30, num(e.target.value, 1)) })} className={`${inp} mt-0.5`} />
            </label>
          ) : (
            <label className="block text-[11px] text-ink-soft">每次推进（{({ day: "天", week: "周", month: "个月", year: "年" } as const)[t.advanceUnit ?? "day"]}）
              <input type="number" min={1} max={12} value={t.advanceCount ?? 1} onChange={(e) => set({ advanceCount: Math.min(12, num(e.target.value, 1)) })} className={`${inp} mt-0.5`} />
            </label>
          )}
          <label className="block text-[11px] text-ink-soft">日程叙事字数
            <input type="number" min={100} max={2000} step={50} disabled={t.advanceStory === false} value={t.advanceWords ?? 500} onChange={(e) => set({ advanceWords: Math.min(2000, num(e.target.value, 100)) })} className={`${inp} mt-0.5 disabled:opacity-40`} />
          </label>
        </div>
        <p className="rounded-[6px] bg-paper px-2 py-1.5 text-[11px] text-ink">
          玩家每点一次推进：<b className="text-jade">{(t.advanceUnit ?? "day") === "day" ? `${t.advanceDays ?? 1} 天` : `${t.advanceCount ?? 1} ${({ day: "天", week: "周", month: "个月", year: "年" } as const)[t.advanceUnit ?? "day"]}`}</b>
          {(t.advanceUnit ?? "day") === "day" ? "，逐日结算当天日程，遇到周结算 / 结局即停。" : "，系统逐日结算、每周照常周结算，结束后弹出一张汇总报告；遇到结局即停。"}
        </p>
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink">
          <input type="checkbox" className="accent-[var(--jade)]" checked={t.advanceStory !== false} onChange={(e) => set({ advanceStory: e.target.checked ? undefined : false })} />
          推进后由 AI 生成日程叙事（结合时间、天气与之前的记忆）
        </label>
        <p className="text-[10.5px] text-ink-soft">未接入 AI 时只显示结算，不生成叙事；跨度很长时 AI 只参考最近两周的日程来写。</p>
      </div>}

      {transport && <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold text-ink">出行方式 <span className="font-normal text-ink-soft">{modes.length ? `${modes.length} 种` : "未配置 · 玩家只会看到「前往」"}</span></p>
          {!modes.length && <button className={btn} onClick={() => set({ modes: PRESET.map((m) => ({ ...m })) })}>填入示例五种</button>}
        </div>
        {modes.map((m, i) => (
          <div key={i} className="space-y-1.5 rounded-xl border border-line bg-paper-2 p-2">
            <div className="flex gap-1.5">
              <select className={`${inp} !w-20 shrink-0`} value={m.icon ?? m.id} onChange={(e) => setMode(i, { icon: e.target.value })} aria-label="图标">
                {ICONS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
              <input className={`${inp} ${String(m.label ?? "").trim() ? "" : "!border-danger"}`} value={String(m.label ?? "")} placeholder="名称" onChange={(e) => setMode(i, { label: e.target.value })} />
              <button className={`${btn} shrink-0`} onClick={() => set({ modes: modes.filter((_, j) => j !== i) })} aria-label="删除">×</button>
            </div>
            <input className={inp} value={String(m.note ?? "")} placeholder="一句说明（如：便宜但要等）" onChange={(e) => setMode(i, { note: e.target.value })} />
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {!m.ownCar && <label className="text-[11px] text-ink-soft">票价（¥ / 趟）<input type="number" min={0} value={feeOf(m, t.feePerHop)} onChange={(e) => setMode(i, { fee: num(e.target.value) })} className={`${inp} mt-0.5`} /></label>}
              <label className="col-span-2 flex items-center gap-1.5 self-end pb-1 text-[11.5px] text-ink-soft sm:col-span-1">
                <input type="checkbox" checked={!!m.ownCar} onChange={(e) => setMode(i, { ownCar: e.target.checked || undefined })} className="accent-[var(--jade)]" />需要自有座驾
              </label>
            </div>
          </div>
        ))}
        <button className={btn} onClick={() => set({ modes: [...modes, { id: `m${Date.now().toString(36).slice(-4)}`, label: "", fareMul: 0, timeMul: 1, fee: 0, note: "", icon: "walk" }] })}>＋ 添加出行方式</button>
      </div>

      <div className="grid grid-cols-1 gap-1.5 ">
        <label className="text-[11px] text-ink-soft">默认选中
          <select className={`${inp} mt-0.5`} value={t.defaultMode ?? ""} onChange={(e) => set({ defaultMode: e.target.value || undefined })}>
            <option value="">自动</option>
            {sample.filter((m) => !m.ownCar).map((m) => <option key={m.id} value={m.id}>{m.label || m.id}</option>)}
          </select>
        </label>

      </div>

      <div className="rounded-xl bg-jade/6 px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
        <b className="text-jade">预览 · 每趟：</b>
        {sample.map((m) => `${m.label || "?"} ${m.ownCar ? "自有·免费" : feeOf(m, t.feePerHop) ? `¥${feeOf(m, t.feePerHop)}` : "免费"}`).join("　")}
      </div>
      <div className="flex justify-end"><button className={btn} disabled={!value?.modes && !value?.defaultMode} onClick={() => { const { modes: _m, defaultMode: _d, pickTitle: _p, currency: _c, freeLabel: _f, ...rest } = t; void _m; void _d; void _p; void _c; void _f; onChange({ ...rest }); }}>清空出行方式（沿用依赖世界的设置）</button></div>
      </>}
    </div>
  );
}
