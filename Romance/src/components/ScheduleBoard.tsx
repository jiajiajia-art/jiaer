import { wallet } from "../game/wallet";
import { advanceCount, advanceLabel, advanceUnit, type AdvanceUnit } from "../game/mud";
/* 本周日程板：独立弹窗组件。
 * 从「世界」页场景的「▦ 本周日程」入口可直接弹出（不必先跳到人物页），
 * 人物页也复用同一组件。所有排程数据/风险预警都在内部自算。 */
import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { Modal } from "./ui";
import { LIVE_GIGS as GIG_POOL } from "../mods/registry";
import { TRAININGS, SIDE_JOBS, WEEKEND_ACTS, MEALS, mealOf, mealEffect, gradesOf, gradeLock, tuning, jobLock, unlockLock, STAT_LABELS, type StatKey } from "../game/data";
import { FIXED_METRICS } from "../game/fixedEvents";
import { dowOf, previewWeekBill, weekdayName, type GameState } from "../game/logic";
import { liveTerm as T } from "../mods/live";
import { StatusMark } from "../lib/icons";

/* ═══ 可排入日程的活动（仿《明星志愿》：通告 / 课程 / 打工 / 休息 / 社交） ═══ */
type PlanCat = "work" | "lesson" | "job" | "rest" | "social";
const CAT_META: Record<PlanCat, { label: string; hint: string; dot: string }> = {
  work: { get label() { return `拍摄${T("gig")}`; }, hint: "接戏拍摄，赚片酬涨名气", dot: "#e0533d" },
  lesson: { label: "才艺课程", hint: "分级授课 · 级别越高上限越高、单次加成越少", dot: "#c79a3a" },
  job: { label: "打工赚钱", hint: "分级零工 · 名气越高价码越高", dot: "#b3823c" },
  rest: { label: "休息调整", hint: "回血减压，保住状态", dot: "#3a9d78" },
  social: { label: "外出社交", hint: "自由活动可踩地图 · 人脉与心情", dot: "#d76d77" },
};
const CAT_ORDER: PlanCat[] = ["work", "lesson", "job", "rest", "social"];

/* 排入槽位的一件事：解码 schedule 字符串为可展示信息（名称/分类/开销/压力）。 */
type ActInfo = { id: string; name: string; cat: PlanCat; note: string; fee: number; stress: number; dot: string };

function describeAct(s: GameState, id: string | null): ActInfo | null {
  if (!id) return null;
  const dot = (c: PlanCat) => CAT_META[c].dot;
  if (id === "rest") return { id, name: "休息", cat: "rest", note: "缓解压力、调整状态", fee: 0, stress: -8, dot: dot("rest") };
  if (id === "gig") {
    const g = GIG_POOL.find((x) => x.id === s.activeGigId);
    const deadline = s.gigDeadlineWeek ? `，第 ${s.gigDeadlineWeek} 周前截止` : "";
    const preStart = s.gigStartWeek > 0 && s.week < s.gigStartWeek;
    const note = !g
      ? `暂无在拍${T("gig")}`
      : preStart
        ? `《${g.name}》第 ${s.gigStartWeek} 周开机（尚未进组）`
        : `《${g.name}》尚需 ${Math.max(0, s.gigDaysLeft)} 天${deadline}`;
    return { id, name: `拍摄${T("gig")}`, cat: "work", note, fee: 0, stress: 4, dot: dot("work") };
  }
  if (id.startsWith("train:")) {
    const [, tId, gId] = id.split(":");
    const t = TRAININGS.find((x) => x.id === tId);
    if (!t) return null;
    const gr = gradesOf(t).find((x) => x.id === gId) ?? gradesOf(t)[0];
    return { id, name: `${t.name}·${gr.label}`, cat: "lesson", note: t.effect, fee: Math.round(t.cost * gr.costMul * (tuning().trainFeeMul ?? 1)), stress: t.stress + gr.stressAdd, dot: dot("lesson") };
  }
  if (id.startsWith("work:")) {
    const [, jId] = id.split(":");
    const j = SIDE_JOBS.find((x) => x.id === jId);
    if (!j) return null;
    return { id, name: j.label, cat: "job", note: j.note, fee: 0, stress: j.stress, dot: dot("job") };
  }
  const w = WEEKEND_ACTS.find((x) => x.id === id);
  if (w) return { id, name: w.name, cat: w.id === "recuperate" ? "rest" : "social", note: w.effect, fee: w.cost, stress: w.stress, dot: dot(w.id === "recuperate" ? "rest" : "social") };
  // 兼容旧裸课程 id
  const t = TRAININGS.find((x) => x.id === id);
  if (t) return { id: `train:${t.id}:g1`, name: `${t.name}·初级`, cat: "lesson", note: t.effect, fee: Math.round(t.cost * (tuning().trainFeeMul ?? 1)), stress: t.stress, dot: dot("lesson") };
  return null;
}

/* 门槛指标 → 显示名（八维用模组改过的叫法） */
const reqLabel = (m: string) => m.startsWith("stat:") ? STAT_LABELS[m.slice(5) as StatKey] ?? m.slice(5) : FIXED_METRICS.find((x) => x.key === m)?.label ?? m;

const WEEKDAY_FULL = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/* 迷你成本徽章 */
function CostBadges({ act }: { act: ActInfo }) {
  return (
    <span className="flex flex-wrap gap-1">
      {act.fee > 0 && <span className="rounded bg-danger/10 px-1.5 py-px text-[10px] font-medium text-danger">¥{act.fee}</span>}
      {act.stress !== 0 && (
        <span className={`rounded px-1.5 py-px text-[10px] font-medium ${act.stress > 0 ? "bg-coral/10 text-coral" : "bg-jade/12 text-jade"}`}>
          压力{act.stress > 0 ? "+" : ""}{act.stress}
        </span>
      )}
    </span>
  );
}

export default function ScheduleBoard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { game, setSchedule, endDayNow, advanceNow, patchGame, busy } = useGame();
  const [pickSeg, setPickSeg] = useState<number | null>(null);
  if (!open || !game || !game.sim) return null;
  const s = game.sim;

  const today = dowOf(s.day ?? 0); // 当前是本周第几天（0=周一 … 6=周日）
  const schedule = s.schedule ?? [];

  /* ═══ 本周排程安全预警（镜像引擎的资金/压力公式） ═══ */
  let feeSum = 0;
  let stressDelta = 0;
  const feeItems: string[] = [];
  for (let i = today; i < 7; i++) {
    const a = describeAct(s, schedule[i] ?? null);
    if (!a) continue;
    if (a.fee > 0) feeItems.push(`${WEEKDAY_FULL[i]}${a.name} ${wallet.fmt(a.fee)}`);
    feeSum += a.fee;
    stressDelta += a.stress;
  }
  // 周日账单（房租/固定开销/伙食等）也会自动扣——一并计入预计余额，避免「莫名扣款」
  const sunBill = previewWeekBill(s);
  const projMoney = wallet.balance(s) - feeSum - sunBill.total;
  const projStress = Math.max(0, Math.min(100, s.stress + stressDelta));
  const warnings: string[] = [];
  // 只统计日程里排了的收费活动（课程/培训等），不含其他开销
  if (projMoney < 0) warnings.push(`${wallet.name()}撑不到周日：日程费用 ${wallet.fmt(feeSum)} + 周日账单 ${wallet.fmt(sunBill.total)}，现有 ${wallet.fmt(wallet.balance(s))}，还差 ${wallet.fmt(-projMoney)}。把收费课程换成「打工」或休息，或接${T("gig")}赚钱`);
  if (projStress >= 85) warnings.push("压力将逼近临界");
  const gigStarted = s.activeGigId && !(s.gigStartWeek > 0 && s.week < s.gigStartWeek);
  if (gigStarted && !schedule.slice(today).includes("gig")) warnings.push(`有在拍${T("gig")}却没排「拍摄」，会误了档期`);
  if (s.activeGigId && !gigStarted) warnings.push(`在拍${T("gig")}第 ${s.gigStartWeek} 周才开机，本周暂不能拍`);
  if (s.activeGigId && s.gigDeadlineWeek && s.week >= s.gigDeadlineWeek && s.gigDaysLeft > 0)
    warnings.push(`在拍${T("gig")}本周为截止周，仍差 ${s.gigDaysLeft} 天，拍不完将被撤换`);

  const chooseAct = (id: string | null) => {
    if (pickSeg == null) return;
    setSchedule(pickSeg, id);
    setPickSeg(null);
  };
  // 从今天起到周日，未过去的日子统一填入某活动（或清空）
  const fillWeek = (id: string | null) => {
    for (let i = today; i < 7; i++) setSchedule(i, id);
    setPickSeg(null);
  };
  // 本周伙食（生活开销包）：选择存进本局存档，一直沿用到改为止
  const meal = mealOf(s.meal);
  const chooseMeal = (id: string) => patchGame((g) => ({ ...g, sim: { ...g.sim, meal: id } }));

  return (
    <Modal title={`本周日程 · 第 ${s.week} 周`} onClose={() => { onClose(); setPickSeg(null); }} wide>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] leading-snug text-ink-soft">排满周一到周日各一件事，「推进一天」逐日结算并掷出结果；跨过周日自动结算并翻入新一周。</p>
        <div className="ml-3 flex shrink-0 gap-2 text-[11.5px]">
          <button onClick={() => fillWeek("rest")} className="text-ink-soft transition hover:text-jade">余下休息</button>
          <span className="text-line">·</span>
          <button onClick={() => fillWeek(null)} className="text-ink-soft transition hover:text-danger">清空</button>
        </div>
      </div>

      {/* 本周钱包：现有 → 日程费用 → 周日账单 → 预计余额，并给出赚钱途径 */}
      <div className={`mb-3 rounded-sm border p-3 ${projMoney < 0 ? "border-danger/50 bg-danger/5" : "border-line"}`}>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[
            ["现有", wallet.fmt(wallet.balance(s)), "text-ink"],
            ["日程费用", feeSum ? `−${wallet.fmt(feeSum)}` : "—", "text-danger"],
            ["周日账单", sunBill.total ? `−${wallet.fmt(sunBill.total)}` : "—", "text-danger"],
            ["预计周末余额", wallet.fmt(projMoney), projMoney < 0 ? "text-danger" : "text-jade-deep"],
          ].map(([k, v, c]) => (
            <div key={k}><p className="text-[10.5px] text-ink-soft">{k}</p><p className={`text-[14px] font-bold tabular-nums ${c}`}>{v}</p></div>
          ))}
        </div>
        {(feeItems.length > 0 || sunBill.lines.length > 0) && (
          <details className="mt-2 text-[11px] text-ink-soft">
            <summary className="cursor-pointer select-none font-semibold text-ink">扣款明细（何时扣、扣什么）</summary>
            <ul className="mt-1.5 space-y-0.5">
              {feeItems.map((f) => <li key={f}>· 当天扣：{f}</li>)}
              {sunBill.lines.map((l) => <li key={l.label}>· 周日自动扣：{l.label} {l.amount < 0 ? `收入 ${wallet.fmt(-l.amount)}` : wallet.fmt(l.amount)}</li>)}
            </ul>
          </details>
        )}
        <p className="mt-2 text-[11px] leading-snug text-ink-soft">
          <b className="text-ink">怎么赚钱：</b>日程里排「打工」按天领工钱；接下{T("gig")}后排「拍摄」，完工领片酬；名气越高，能接的活越多、越贵。
        </p>
      </div>

      {/* 七天日程卡 */}
      <div className="mb-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {WEEKDAY_FULL.map((wd, i) => {
          const a = describeAct(s, schedule[i] ?? null);
          const isNow = today === i;
          const isPast = today > i;
          const active = pickSeg === i;
          return (
            <button
              key={wd}
              onClick={() => !isPast && setPickSeg(active ? null : i)}
              disabled={isPast}
              className={`flex min-h-[84px] flex-col items-center gap-1 rounded-sm border border-dashed px-1 py-2 text-center transition ${
                isPast ? "cursor-default opacity-40" : "hover:border-jade"
              } ${active ? "border-solid border-jade bg-jade/10" : a ? "border-line" : "border-line/60 bg-paper/40"}`}
            >
              <span className={`text-[11.5px] font-semibold ${isNow ? "text-jade" : "text-ink-soft"}`}>
                {wd}{isNow ? "·今" : isPast ? "·过" : ""}
              </span>
              {a ? (
                <span className="mt-0.5 flex flex-col items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: a.dot }} />
                  <span className="text-[11.5px] font-medium leading-tight text-ink">{a.name}</span>
                </span>
              ) : (
                <span className="mt-2 text-[11px] text-ink-soft/60">+ 排</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 活动选择面板 */}
      {pickSeg != null && (
        <div className="mb-3 animate-pop rounded-sm border border-dashed border-jade/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-bold text-ink">{WEEKDAY_FULL[pickSeg]} · 安排什么？</p>
            <button onClick={() => chooseAct(null)} className="text-[11.5px] text-ink-soft transition hover:text-danger">留空</button>
          </div>

          {CAT_ORDER.map((c) => {
            const meta = CAT_META[c];
            const CatHead = (
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                <span className="text-[12.5px] font-bold text-ink">{meta.label}</span>
                <span className="text-[10.5px] text-ink-soft">{meta.hint}</span>
              </div>
            );

            // 拍摄通告：仅在拍摄期出现
            if (c === "work") {
              if (!s.activeGigId) return null;
              const info = describeAct(s, "gig");
              if (!info) return null;
              const chosen = schedule[pickSeg] === "gig";
              return (
                <div key={c} className="mb-3">
                  {CatHead}
                  <button
                    onClick={() => chooseAct("gig")}
                    className={`flex w-full items-start rounded-sm border border-dashed p-2.5 text-left transition ${chosen ? "border-solid border-jade bg-jade/8" : "border-line hover:border-jade"}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5"><span className="font-medium text-ink">{info.name}</span>{chosen && <span className="text-[10px] text-jade"><StatusMark kind="ok">已排</StatusMark></span>}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{info.note}</span>
                    </span>
                  </button>
                </div>
              );
            }

            // 才艺课程：每门课 4 个等级
            if (c === "lesson") {
              return (
                <div key={c} className="mb-3">
                  {CatHead}
                  <div className="space-y-2">
                    {TRAININGS.map((t) => (
                      <div key={t.id} className="rounded-sm border border-line/70 p-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[12.5px] font-medium text-ink">{t.name}</span>
                          <span className="text-[10.5px] text-ink-soft">{t.effect}</span>
                        </div>
                        <div className={`mt-1.5 grid gap-1 ${gradesOf(t).length <= 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                          {gradesOf(t).map((gr, gi) => {
                            const id = `train:${t.id}:${gr.id}`;
                            const chosen = schedule[pickSeg] === id;
                            const fee = Math.round(t.cost * gr.costMul * (tuning().trainFeeMul ?? 1));
                            const lock = gradeLock(s, t, gi, reqLabel);
                            const done = s.trainCounts?.[`${t.id}:${gr.id}`] ?? 0;
                            return (
                              <button
                                key={gr.id}
                                onClick={() => !lock && chooseAct(id)}
                                disabled={!!lock}
                                title={lock ? `未解锁：${lock}` : `上限 ${gr.cap} · 学费 ${wallet.fmt(fee)} · 已上 ${done} 次`}
                                className={`rounded-sm border border-dashed px-1 py-1.5 text-center transition disabled:cursor-not-allowed disabled:opacity-45 ${chosen ? "border-solid border-jade bg-jade/10" : "border-line hover:border-jade"}`}
                              >
                                <span className="block text-[11.5px] font-semibold text-ink">{gr.label}</span>
                                <span className="block text-[9.5px] text-ink-soft">{lock ? "未解锁" : (fee >= 10000 ? wallet.short(fee) : wallet.fmt(fee))}</span>
                              </button>
                            );
                          })}
                        </div>
                        {(() => {
                          const gi = gradesOf(t).findIndex((_, i) => gradeLock(s, t, i, reqLabel));
                          const why = gi >= 0 ? gradeLock(s, t, gi, reqLabel) : null;
                          return why ? <p className="mt-1 text-[10px] leading-snug text-ink-soft">解锁{gradesOf(t)[gi].label}：{why}</p> : null;
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // 打工：分级零工，名气不足则锁定
            if (c === "job") {
              return (
                <div key={c} className="mb-3">
                  {CatHead}
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {SIDE_JOBS.map((j, ji) => {
                      const id = `work:${j.id}`;
                      const why = jobLock(s, SIDE_JOBS, ji, reqLabel);
                      const locked = !!why;
                      const chosen = schedule[pickSeg] === id;
                      return (
                        <button
                          key={j.id}
                          disabled={locked}
                          onClick={() => chooseAct(id)}
                          className={`flex items-start rounded-sm border border-dashed p-2.5 text-left transition ${locked ? "cursor-not-allowed opacity-45" : chosen ? "border-solid border-jade bg-jade/8" : "border-line hover:border-jade"}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="font-medium text-ink">{j.label}</span>
                              {chosen && <span className="text-[10px] text-jade"><StatusMark kind="ok">已排</StatusMark></span>}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{j.note}</span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              <span className="rounded bg-jade/12 px-1.5 py-px text-[10px] font-medium text-jade">约 ¥{j.pay >= 10000 ? (j.pay / 10000).toFixed(1) + "万" : j.pay}</span>
                              <span className="rounded bg-coral/10 px-1.5 py-px text-[10px] font-medium text-coral">压力+{j.stress}</span>
                              {why && <span className="rounded bg-danger/10 px-1.5 py-px text-[10px] font-medium text-danger">{why}</span>}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // 休息 / 外出社交：从固定活动集取
            const ids = c === "rest" ? ["rest", "recuperate"] : WEEKEND_ACTS.filter((w) => w.id !== "recuperate").map((w) => w.id);
            const group = ids.map((id) => describeAct(s, id)).filter((x): x is ActInfo => !!x);
            if (!group.length) return null;
            return (
              <div key={c} className="mb-3 last:mb-0">
                {CatHead}
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {group.map((a) => {
                    const chosen = schedule[pickSeg] === a.id;
                    const why = unlockLock(s, WEEKEND_ACTS.find((w) => w.id === a.id)?.reqs, reqLabel);
                    return (
                      <button
                        key={a.id}
                        disabled={!!why}
                        onClick={() => !why && chooseAct(a.id)}
                        className={`flex items-start rounded-sm border border-dashed p-2.5 text-left transition ${why ? "cursor-not-allowed opacity-45" : chosen ? "border-solid border-jade bg-jade/8" : "border-line hover:border-jade"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5"><span className="font-medium text-ink">{a.name}</span>{chosen && <span className="text-[10px] text-jade"><StatusMark kind="ok">已排</StatusMark></span>}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{a.note}</span>
                          <span className="mt-1 block"><CostBadges act={a} /></span>
                          {why && <span className="mt-1 block text-[10px] text-danger">未解锁：{why}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 本周伙食：每周吃什么（只有挂了生活开销包的世界才有） */}
      {MEALS.length > 0 && (
        <div className="mb-3 rounded-sm border border-dashed border-line p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12.5px] font-bold text-ink">本周伙食</p>
            <p className="text-[10.5px] text-ink-soft">周日随账单结算 · 一直沿用到改为止</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {MEALS.map((m) => {
              const why = unlockLock(s, m.reqs, reqLabel);
              const chosen = meal?.id === m.id;
              return (
                <button
                  key={m.id}
                  disabled={!!why}
                  onClick={() => chooseMeal(m.id)}
                  title={m.desc}
                  className={`flex flex-col items-start rounded-sm border border-dashed p-2 text-left transition ${why ? "cursor-not-allowed opacity-45" : chosen ? "border-solid border-jade bg-jade/8" : "border-line hover:border-jade"}`}
                >
                  <span className="flex w-full items-baseline justify-between gap-1">
                    <span className="text-[12px] font-medium text-ink">{m.name}{chosen && <span className="ml-1 text-[10px] text-jade"><StatusMark kind="ok">已排</StatusMark></span>}</span>
                    <span className="shrink-0 text-[10.5px] font-semibold tabular-nums text-danger">¥{m.cost.toLocaleString("zh-CN")}</span>
                  </span>
                  <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-soft">{why ? `未解锁：${why}` : mealEffect(m)}</span>
                </button>
              );
            })}
          </div>
          {meal?.desc && <p className="mt-2 text-[10.5px] leading-snug text-ink-soft">「{meal.name}」{meal.desc}。钱不够时当周会自动降到付得起的一档。</p>}
        </div>
      )}

      {/* 排程风险预警（无风险时不显示） */}
      {warnings.length > 0 && (
        <div className="mb-3 rounded-sm border border-danger/40 bg-danger/5 p-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-[12px] text-danger"><StatusMark kind="warn">{w}</StatusMark></p>
          ))}
        </div>
      )}

      {/* 推进方式：玩家自选 日 / 周 / 月 / 年 + 次数（存进本局存档） */}
      {(() => {
        const pref = game?.advancePref;
        const unit = advanceUnit(pref), n = advanceCount(pref);
        const max = unit === "day" ? 30 : 12;
        const setPref = (u: AdvanceUnit, c: number) => patchGame((g) => ({ ...g, advancePref: { unit: u, count: Math.max(1, Math.min(u === "day" ? 30 : 12, c)) } }));
        const U = { day: "日", week: "周", month: "月", year: "年" } as const;
        return (
          <div className="rounded-[8px] border border-line bg-paper-2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-ink">推进方式</p>
              <div className="flex items-center gap-1">
                <button type="button" disabled={n <= 1} onClick={() => setPref(unit, n - 1)} className="grid h-7 w-7 place-items-center rounded-[6px] border border-line bg-paper text-ink disabled:opacity-35" aria-label="减少">−</button>
                <span className="w-8 text-center font-serif text-[16px] font-black tabular-nums text-ink">{n}</span>
                <button type="button" disabled={n >= max} onClick={() => setPref(unit, n + 1)} className="grid h-7 w-7 place-items-center rounded-[6px] border border-line bg-paper text-ink disabled:opacity-35" aria-label="增加">＋</button>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-4 gap-1.5">
              {(Object.keys(U) as AdvanceUnit[]).map((u) => (
                <button key={u} type="button" onClick={() => setPref(u, u === unit ? n : 1)}
                  className={`rounded-[6px] border py-2 font-serif text-[15px] font-black transition ${u === unit ? "border-jade bg-jade text-paper-2 shadow-sm" : "border-line bg-paper text-ink hover:border-jade"}`}>
                  {U[u]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button disabled={busy} onClick={advanceNow}
                className="flex-[2] rounded-[8px] py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                style={{ background: "linear-gradient(90deg, var(--jade), var(--coral))" }}>
                推进{advanceLabel(pref)} →
              </button>
              {!(unit === "day" && n === 1) && (
                <button disabled={busy} onClick={endDayNow}
                  className="flex-1 rounded-[8px] border border-line bg-paper py-3 text-[12.5px] font-semibold text-ink transition hover:border-jade disabled:opacity-50">
                  只过一天
                </button>
              )}
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink-soft">今天是{weekdayName(s.day)}。逐日结算日程，期间每周照常周结算，遇到结局会停下。</p>
          </div>
        );
      })()}
    </Modal>
  );
}
