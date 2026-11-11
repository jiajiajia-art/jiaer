import { term } from "../mods/registry";
import type { PartnerPerk, PerkReq, PerkWhen, RelationsContent } from "../worlds/star2005/content";
import type { PerkKeyOption } from "../game/perkKeys";
import type { ReactNode } from "react";
import type { BridgeSlot } from "../game/bridge";

/* 关系玩法（商店 pack-relations）：表白门槛、婚礼费用 / 好感、NPC 牵线开关与每日次数、伴侣加成。
 * 须创作者从商店加进作品后才出现本编辑器与人物页表白/婚礼入口。
 * 不预置固定牵线方式；需要牵线时请自加触发 / 事件。只写改动的字段，其余沿用引擎默认。 */
type Rel = Partial<RelationsContent>;
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const lbl = "block text-[10.5px] font-bold text-ink-soft";
const numOr = (v: string) => (v.trim() === "" || !Number.isFinite(+v) ? undefined : Math.round(+v));

function Num({ label, value, ph, onChange }: { label: string; value?: number; ph: number; onChange: (v?: number) => void }) {
  return <label className={lbl}>{label}<input type="number" className={`${inp} mt-0.5`} value={value ?? ""} placeholder={`默认 ${ph}`} onChange={(e) => onChange(numOr(e.target.value))} /></label>;
}

type Fx = { key: string; delta: number };
/* 旧写法（固定的 压力 / 口碑 / 名气 / 好感 与 minFame 等）读入时并成通用列表；一经编辑即改存新写法 */
const fxOf = (p: PartnerPerk): Fx[] => {
  const out = [...(p.fx ?? [])];
  for (const k of ["stress", "reputation", "fame", "affinity"] as const) if (p[k] && !out.some((x) => x.key === k)) out.push({ key: k, delta: p[k]! });
  return out;
};
const reqOf = (w?: PerkWhen): PerkReq[] => {
  const out = [...(w?.req ?? [])];
  const legacy: [keyof PerkWhen, string, PerkReq["op"]][] = [["minWeek", "week", ">="], ["minFame", "fame", ">="], ["minReputation", "reputation", ">="], ["minLooks", "looks", ">="], ["maxBlackFans", "blackFans", "<="], ["minAffinity", "affinity", ">="], ["maxStress", "stress", "<="]];
  for (const [f, key, op] of legacy) { const v = w?.[f]; if (typeof v === "number") out.push({ key, op, value: v }); }
  return out;
};

/** 属性下拉：按「本世界观属性 / 通用 / 引擎内置」分组；已不存在的键原样保留并标注 */
function KeySelect({ opts, value, onChange }: { opts: PerkKeyOption[]; value: string; onChange: (k: string) => void }) {
  const groups = [...new Set(opts.map((o) => o.group))];
  return (
    <select className={`${inp} flex-1`} value={value} onChange={(e) => onChange(e.target.value)}>
      {!opts.some((o) => o.key === value) && <option value={value}>{value}（本世界观未定义）</option>}
      {groups.map((gname) => (
        <optgroup key={gname} label={gname}>
          {opts.filter((o) => o.group === gname).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function RowList<T>({ rows, blank, onChange, render, addLabel }: { rows: T[]; blank: T; onChange: (l: T[]) => void; render: (x: T, set: (x: T) => void) => ReactNode; addLabel: string }) {
  return (
    <div className="space-y-1">
      {rows.map((x, j) => (
        <div key={j} className="flex items-center gap-1.5">
          {render(x, (nx) => onChange(rows.map((y, q) => (q === j ? nx : y))))}
          <button type="button" className="shrink-0 rounded-full px-2 py-1 text-[11px] text-ink-soft transition hover:bg-danger/10 hover:text-danger" onClick={() => onChange(rows.filter((_, q) => q !== j))}>移除</button>
        </div>
      ))}
      <button type="button" className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft transition hover:border-jade hover:text-jade" onClick={() => onChange([...rows, blank])}>{addLabel}</button>
    </div>
  );
}

export default function ModRelationsEditor({ value, onChange, npcs = [], keyOptions = [] }: { value?: Rel; onChange: (v?: Rel) => void; npcs?: { id: string; name: string }[]; keyOptions?: PerkKeyOption[] }) {
  const v = value ?? {};
  const prune = (o: Record<string, unknown>) => { Object.keys(o).forEach((k) => o[k] === undefined && delete o[k]); return Object.keys(o).length ? o : undefined; };
  const put = (p: Rel) => onChange(prune({ ...v, ...p }) as Rel | undefined);
  const confess = (v.confess ?? {}) as Partial<RelationsContent["confess"]>;
  const wed = v.wedding ?? {};
  const br: BridgeSlot = v.bridge ?? {};
  // 功能注释：只保留开放开关与每日次数；固定牵线方式预置与 modes 编辑已下线
  const setBr = (p: BridgeSlot) => put({ bridge: prune({ ...br, ...p }) as BridgeSlot | undefined });

  const perks: PartnerPerk[] = v.partnerPerks ?? [];
  const putPerks = (l: PartnerPerk[]) => put({ partnerPerks: l });
  const setPerk = (i: number, p: Partial<PartnerPerk>) => putPerks(perks.map((x, j) => (j === i ? (prune({ ...x, ...p }) as PartnerPerk) : x)));

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-ink-soft">留空 = 用引擎默认。已添加「关系玩法」后，人物页的表白、婚礼按这里的数值判定与显示。</p>

      <div className="rounded-xl border border-line bg-paper p-2.5">
        <p className="mb-1.5 text-[12px] font-bold text-ink">表白</p>
        <div className="grid grid-cols-2 gap-2">
          <Num label="好感门槛" value={v.confess ? confess.friendshipMin : undefined} ph={60} onChange={(n) => put({ confess: prune({ ...confess, friendshipMin: n }) as RelationsContent["confess"] })} />
          <Num label="心动门槛" value={v.confess ? confess.romanticMin : undefined} ph={60} onChange={(n) => put({ confess: prune({ ...confess, romanticMin: n }) as RelationsContent["confess"] })} />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-paper p-2.5">
        <p className="mb-1.5 text-[12px] font-bold text-ink">婚礼 <span className="font-normal text-ink-soft">· 费用按钱包货币扣除；婚姻制度在「世界规则」里开关</span></p>
        <div className="grid grid-cols-2 gap-2">
          <Num label="婚礼费用" value={wed.cost} ph={30000} onChange={(cost) => put({ wedding: prune({ ...wed, cost }) as Rel["wedding"] })} />
          <Num label="好感门槛" value={wed.minAffinity} ph={80} onChange={(minAffinity) => put({ wedding: prune({ ...wed, minAffinity }) as Rel["wedding"] })} />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-paper p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[12px] font-bold text-ink">NPC 牵线</p>
          <label className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
            <input type="checkbox" checked={!br.off} onChange={() => setBr({ off: br.off ? undefined : true })} />开放
          </label>
        </div>
        {!br.off && (
          <>
            <div className="mb-2 w-1/2"><Num label="每天次数" value={br.perDay} ph={2} onChange={(perDay) => setBr({ perDay })} /></div>
            <p className="text-[10.5px] leading-relaxed text-ink-soft">此处不预置牵线方式。需要牵线时，请在「④ 剧情」里自行添加触发与事件。</p>
          </>
        )}
      </div>
      <div className="rounded-xl border border-line bg-paper p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[12px] font-bold text-ink">伴侣加成 <span className="font-normal text-ink-soft">· 与某人确认恋爱后，{term("gig", "工作")}结算或到访指定地点时获得的加成（用不到可留空）</span></p>
          <button type="button" className="rounded-full border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade"
            onClick={() => putPerks([...perks, { pid: npcs[0]?.id ?? "" }])}>＋ 添加</button>
        </div>
        {v.partnerPerks === undefined && <p className="text-[11px] text-ink-soft">未设置：沿用默认（仅对默认世界观里的角色生效）。添加一条或点「不要加成」即改为本模组自定义。
          <button type="button" className="ml-1 font-semibold text-jade" onClick={() => putPerks([])}>不要加成</button></p>}
        {v.partnerPerks && !perks.length && <p className="text-[11px] text-ink-soft">已关闭伴侣加成。<button type="button" className="ml-1 font-semibold text-jade" onClick={() => put({ partnerPerks: undefined })}>恢复默认</button></p>}
        <div className="space-y-2">
          {perks.map((p, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-line p-2">
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className={lbl}>恋人
                  {npcs.length ? (
                    <select className={`${inp} mt-0.5`} value={p.pid} onChange={(e) => setPerk(i, { pid: e.target.value })}>
                      {!npcs.some((n) => n.id === p.pid) && <option value={p.pid}>{p.pid || "选择角色"}</option>}
                      {npcs.map((n) => <option key={n.id} value={n.id}>{n.name || n.id}</option>)}
                    </select>
                  ) : <input className={`${inp} mt-0.5`} value={p.pid} placeholder="角色 id" onChange={(e) => setPerk(i, { pid: e.target.value })} />}
                </label>
                <label className={lbl}>名称<input className={`${inp} mt-0.5`} value={p.label ?? ""} placeholder="如：资本同盟" onChange={(e) => setPerk(i, { label: e.target.value || undefined })} /></label>
                <button type="button" className="rounded-full px-2 py-1 text-[11px] text-ink-soft transition hover:bg-danger/10 hover:text-danger" onClick={() => putPerks(perks.filter((_, j) => j !== i))}>删除</button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={lbl}>触发方式</span>
                {([["work", `${term("gig", "工作")}结算`], ["loc", "到访地点"]] as const).map(([k, name]) => {
                  const on = k === "loc" ? p.loc !== undefined : p.loc === undefined;
                  return (
                    <button key={k} type="button" onClick={() => setPerk(i, { loc: k === "loc" ? (p.loc ?? "") : undefined })}
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${on ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>{name}</button>
                  );
                })}
              </div>
              {p.loc === undefined ? (
                <div className="space-y-1">
                  <p className={lbl}>{term("gig", "工作")}玩法规则（引擎内置的结算规则，只对有{term("gig", "工作")}玩法的世界观生效；没有就留空）</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Num label="完成率 +%" value={p.rate} ph={0} onChange={(rate) => setPerk(i, { rate })} />
                  <Num label="限星级 ≥" value={p.minStar} ph={0} onChange={(minStar) => setPerk(i, { minStar })} />
                  <label className={lbl}>商业价值倍率<input type="number" step="0.01" className={`${inp} mt-0.5`} value={p.bizMult ?? ""} placeholder="如 1.1" onChange={(e) => setPerk(i, { bizMult: e.target.value === "" ? undefined : +e.target.value || undefined })} /></label>
                  <label className={lbl}>额外{term("money", "报酬")}比例<input type="number" step="0.01" className={`${inp} mt-0.5`} value={p.payBonus ?? ""} placeholder="如 0.05" onChange={(e) => setPerk(i, { payBonus: e.target.value === "" ? undefined : +e.target.value || undefined })} /></label>
                  <label className={lbl}>限{term("gig", "工作")}类型<input className={`${inp} mt-0.5`} value={p.gigType ?? ""} placeholder="如 广告|品牌" onChange={(e) => setPerk(i, { gigType: e.target.value || undefined })} /></label>
                </div>
                </div>
              ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <label className={`${lbl} col-span-2`}>地点 id<input className={`${inp} mt-0.5`} value={p.loc} placeholder="如 apartment|home" onChange={(e) => setPerk(i, { loc: e.target.value })} /></label>
</div>
              )}
              <div className="space-y-1.5">
                  <p className={lbl}>数值增减（从本世界观的属性里选{p.loc === undefined ? `；${term("gig", "工作")}成功时生效` : ""}）</p>
                  <RowList
                    rows={fxOf(p)}
                    blank={{ key: keyOptions.find((o) => !o.readOnly)?.key ?? "affinity", delta: 0 }}
                    onChange={(fx) => setPerk(i, { fx: fx.length ? fx : undefined, stress: undefined, reputation: undefined, fame: undefined, affinity: undefined })}
                    render={(x, set) => (
                      <>
                        <KeySelect opts={keyOptions.filter((o) => !o.readOnly)} value={x.key} onChange={(key) => set({ ...x, key })} />
                        <input type="number" className={`${inp} w-24`} value={x.delta || ""} placeholder="±数值" onChange={(e) => set({ ...x, delta: +e.target.value || 0 })} />
                      </>
                    )}
                    addLabel="＋ 增减一项"
                  />
                  <p className={lbl}>触发条件（可选，不填不限制；同时满足才触发）</p>
                  <RowList
                    rows={reqOf(p.when)}
                    blank={{ key: "affinity", op: ">=", value: 0 }}
                    onChange={(req) => setPerk(i, { when: prune({ ...p.when, req: req.length ? req : undefined, minWeek: undefined, minFame: undefined, minReputation: undefined, minLooks: undefined, maxBlackFans: undefined, minAffinity: undefined, maxStress: undefined }) as PerkWhen | undefined })}
                    render={(x, set) => (
                      <>
                        <KeySelect opts={keyOptions} value={x.key} onChange={(key) => set({ ...x, key })} />
                        <select className={`${inp} w-16`} value={x.op} onChange={(e) => set({ ...x, op: e.target.value as PerkReq["op"] })}><option value=">=">≥</option><option value="<=">≤</option></select>
                        <input type="number" className={`${inp} w-24`} value={x.value} onChange={(e) => set({ ...x, value: +e.target.value || 0 })} />
                      </>
                    )}
                    addLabel="＋ 添加条件"
                  />
                  <p className={lbl}>概率与次数</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([
["chance", "触发概率 %"],
                      ["maxTimes", "整局最多次数"],
                      ["cooldownDays", "间隔天数 ≥"],
                      ["perWeek", "每周最多次数"],
                    ] as const).map(([k, label]) => (
                      <Num key={k} label={label} value={p.when?.[k]} ph={k === "chance" ? 100 : 0}
                        onChange={(val) => setPerk(i, { when: prune({ ...p.when, [k]: val }) as PerkWhen | undefined })} />
                    ))}
                  </div>
              </div>
              {p.loc !== undefined && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={lbl}>剧情要点与地点原文</span>
                    {([["append", "接在原文后"], ["replace", "整段替换原文"]] as const).map(([k, name]) => {
                      const on = (p.msgMode ?? "append") === k;
                      return (
                        <button key={k} type="button" onClick={() => setPerk(i, { msgMode: k === "append" ? undefined : k })}
                          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${on ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>{name}</button>
                      );
                    })}
                  </div>
                  <label className={lbl}>剧情要点（交给 AI 演绎）<input className={`${inp} mt-0.5`} value={p.msg ?? ""} placeholder="如：TA 留了热汤等你回家。接入 AI 时据此写成剧情，数值按上面已结算的值；未接 AI 时直接显示这句" onChange={(e) => setPerk(i, { msg: e.target.value || undefined })} /></label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
