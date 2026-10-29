import { GENERIC_BILLS, RAW_SIDE_JOBS, bankruptLineFor, billsSlot, startMoney, type BillsSlot, type EconomyRules, type SideJob, type TuningSlot } from "../game/data";
import type { Mod } from "../mods/types";

/* 模组编辑器 · 数值平衡：把「钱从哪来、扣在哪」摊开算给作者看，并开放经济规则（透支 / 破产 / 新手缓冲） */
type C = Mod["content"];
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/60 focus:border-jade focus:outline-none";
const lbl = "mb-0.5 block text-[11px] font-semibold text-ink-soft";
const yuan = (v: number) => `${v < 0 ? "−" : ""}¥${Math.abs(Math.round(v)).toLocaleString("zh-CN")}`;
const sum = (l?: { amount: number }[]) => (l ?? []).reduce((a, b) => a + b.amount, 0);
const opt = (v: string) => (v === "" ? undefined : Number(v) || 0);

function Row({ k, v, tone, note }: { k: string; v: string; tone?: "good" | "bad"; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[12px]">
      <span className="text-ink-soft">{k}{note && <span className="ml-1 text-[10.5px] opacity-70">{note}</span>}</span>
      <span className={`font-mono font-semibold ${tone === "bad" ? "text-coral" : tone === "good" ? "text-jade" : "text-ink"}`}>{v}</span>
    </div>
  );
}

export default function ModBalancePanel({ c, kind, onChange }: { c: C; kind: Mod["kind"]; onChange: (p: Partial<C>) => void }) {
  // 未填写的字段：世界观走引擎通用默认，叠加包沿用当前生效世界
  const bills: BillsSlot = c.bills ?? (kind === "world" ? GENERIC_BILLS : billsSlot());
  const jobs: SideJob[] = c.sideJobs?.length ? c.sideJobs : RAW_SIDE_JOBS;
  const money0 = c.startMoney ?? startMoney();
  const t: TuningSlot = c.tuning ?? {};
  const eco: EconomyRules = t.economy ?? {};
  const jobMul = t.jobPayMul ?? 1;

  const weekly = sum(bills.weekly);
  const monthly = sum(bills.monthly);
  const graceW = eco.graceWeeks ?? 0;
  const graceMul = eco.graceBillMul ?? 0.5;
  const billOf = (w: number) => Math.round((weekly + (w % 4 === 0 ? monthly : 0)) * (graceW > 0 && w <= graceW ? graceMul : 1));
  const monthBills = weekly * 4 + monthly;
  const entry = jobs.filter((j) => j.fameReq <= 0).sort((a, b) => b.pay - a.pay)[0];
  const income = (Array.isArray(c.income) ? c.income : []).filter((r) => r?.enabled !== false && r?.target?.kind === "metric" && r?.target?.key === "money" && !(r.conds ?? []).length);
  const incomeMonth = income.reduce((a, r) => a + ((r.min + r.max) / 2) * 4, 0);
  const tiers = c.allowance?.tiers ?? [];
  const every = c.allowance?.everyWeeks ?? 4;
  const allowMin = tiers.length ? Math.min(...tiers.map((x) => x.base)) * (4 / every) : 0;
  const allowMax = tiers.length ? Math.max(...tiers.map((x) => x.base)) * (4 / every) : 0;
  const passiveMonth = incomeMonth + allowMin;
  const jobDays = 3; // 估算：每周排 3 天打工
  const jobMonth = entry ? entry.pay * jobMul * jobDays * 4 : 0;
  const line = bankruptLineFor(weekly, eco);

  // 模拟：只靠被动收入 / 再加每周 3 天入门打工，多少周后触及破产线
  const survive = (withJob: boolean) => {
    let m = money0;
    for (let w = 1; w <= 104; w++) {
      m += passiveMonth / 4 + (withJob ? jobMonth / 4 : 0) - billOf(w);
      if (eco.bankrupt !== false && m < line) return `第 ${w} 周破产`;
    }
    return m >= money0 ? "可持续（两年不降）" : "两年内不会破产";
  };
  const week1 = money0 - billOf(1);
  const setEco = (p: Partial<EconomyRules>) => {
    const next: EconomyRules = { ...eco, ...p };
    for (const k of Object.keys(next) as (keyof EconomyRules)[]) if (next[k] === undefined) delete next[k];
    const tt: TuningSlot = { ...t, economy: Object.keys(next).length ? next : undefined };
    if (!tt.economy) delete tt.economy;
    onChange({ tuning: Object.keys(tt).length ? tt : undefined });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-paper-2/60 p-3 text-[11.5px] leading-relaxed text-ink-soft">
        <p className="mb-1 font-bold text-ink">扣费依据</p>
        <p><b className="text-ink">主动消费</b>：课程学费、周末社交、出行路费、场景购物与行动、购车、婚礼。按标价扣，<b className="text-ink">余额不足直接拒绝</b>，不会扣成负数。</p>
        <p><b className="text-ink">被动扣费</b>：每周结算时扣「固定账单」（每周一次，每第 4 周再扣月度账单），以及违约金和事件后果。这些<b className="text-ink">允许透支</b>。</p>
        <p>透支期间每周压力会增加。透支超过破产线时，按下方规则结束游戏。</p>
      </div>

      <div className="rounded-xl border border-line bg-paper p-3">
        <p className="mb-1 text-[12px] font-bold text-ink">每 4 周现金流估算</p>
        <Row k="开局资金" v={yuan(money0)} />
        <Row k="固定账单" note={`每周 ${yuan(weekly)} × 4 ＋ 月度 ${yuan(monthly)}`} v={yuan(-monthBills)} tone="bad" />
        {!!incomeMonth && <Row k="周期收入（无条件部分）" v={yuan(incomeMonth)} tone="good" />}
        {!!tiers.length && <Row k="父母生活费" note={`${tiers.length} 档`} v={allowMin === allowMax ? yuan(allowMin) : `${yuan(allowMin)} ~ ${yuan(allowMax)}`} tone="good" />}
        {entry && <Row k={`入门打工「${entry.label}」`} note={`每周 ${jobDays} 天 · 一般表现`} v={yuan(jobMonth)} tone="good" />}
        <div className="my-1 border-t border-dashed border-line" />
        <Row k="不打工 · 净额" v={yuan(passiveMonth - monthBills)} tone={passiveMonth - monthBills < 0 ? "bad" : "good"} />
        <Row k="打工 · 净额" v={yuan(passiveMonth + jobMonth - monthBills)} tone={passiveMonth + jobMonth - monthBills < 0 ? "bad" : "good"} />
        <div className="my-1 border-t border-dashed border-line" />
        <Row k="第 1 周结算后余额" v={yuan(week1)} tone={week1 < 0 ? "bad" : undefined} />
        <Row k="破产线" v={eco.bankrupt === false ? "已关闭" : yuan(line)} />
        <Row k="不打工能撑多久" v={survive(false)} />
        <Row k="打工能撑多久" v={survive(true)} />
        {week1 < 0 && <p className="mt-2 rounded-lg bg-coral/10 px-2 py-1.5 text-[11.5px] text-coral">开局第一周就会透支。可以提高开局资金、降低每周账单，或开启新手缓冲。</p>}
      </div>

      <div className="rounded-xl border border-line bg-paper p-3">
        <p className="mb-2 text-[12px] font-bold text-ink">经济规则</p>
        <label className="mb-2 flex items-center gap-2 text-[12px] text-ink">
          <input type="checkbox" className="h-4 w-4 accent-[var(--jade)]" checked={eco.bankrupt !== false} onChange={(e) => setEco({ bankrupt: e.target.checked ? undefined : false })} />
          透支超过破产线时结束游戏
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lbl}>破产线（透支金额）</span>
            <input type="number" min={0} className={inp} value={eco.bankruptLine ?? ""} placeholder={`自动 ${(-bankruptLineFor(weekly, {})).toLocaleString("zh-CN")}`} onChange={(e) => setEco({ bankruptLine: opt(e.target.value) })} />
          </label>
          <label><span className={lbl}>透支每周压力</span>
            <input type="number" min={0} className={inp} value={eco.overdraftStress ?? ""} placeholder="4" onChange={(e) => setEco({ overdraftStress: opt(e.target.value) })} />
          </label>
          <label><span className={lbl}>新手缓冲（前 N 周）</span>
            <input type="number" min={0} className={inp} value={eco.graceWeeks ?? ""} placeholder="0 = 关闭" onChange={(e) => setEco({ graceWeeks: opt(e.target.value) })} />
          </label>
          <label><span className={lbl}>缓冲期账单倍率</span>
            <input type="number" min={0} step={0.1} className={inp} value={eco.graceBillMul ?? ""} placeholder="0.5" onChange={(e) => setEco({ graceBillMul: opt(e.target.value) })} />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">开局资金在「③ 养成 → 开局资源」里改；账单在「养成规则」里改；打工收入在「打工 · 周末活动」里改。此处只引用结果估算，不另存资金字段。</p>
      </div>
    </div>
  );
}
