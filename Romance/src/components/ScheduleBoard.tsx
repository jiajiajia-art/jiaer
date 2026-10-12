/* 本周日程板：独立弹窗组件。
 * 从「世界」页场景的「▦ 本周日程」入口可直接弹出（不必先跳到人物页），
 * 人物页也复用同一组件。所有排程数据/风险预警都在内部自算。 */
import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { Modal } from "./ui";
import { GIG_POOL, TRAININGS, LESSON_GRADES, SIDE_JOBS, WEEKEND_ACTS } from "../game/data";
import { weekdayName, type GameState } from "../game/logic";

/* ═══ 可排入日程的活动（仿《明星志愿》：通告 / 课程 / 打工 / 休息 / 社交） ═══ */
type PlanCat = "work" | "lesson" | "job" | "rest" | "social";
const CAT_META: Record<PlanCat, { label: string; hint: string; dot: string }> = {
  work: { label: "拍摄通告", hint: "接戏拍摄，赚片酬涨名气", dot: "#e0533d" },
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
      ? "暂无在拍通告"
      : preStart
        ? `《${g.name}》第 ${s.gigStartWeek} 周开机（尚未进组）`
        : `《${g.name}》尚需 ${Math.max(0, s.gigDaysLeft)} 天${deadline}`;
    return { id, name: "拍摄通告", cat: "work", note, fee: 0, stress: 4, dot: dot("work") };
  }
  if (id.startsWith("train:")) {
    const [, tId, gId] = id.split(":");
    const t = TRAININGS.find((x) => x.id === tId);
    const gr = LESSON_GRADES.find((x) => x.id === gId) ?? LESSON_GRADES[0];
    if (!t) return null;
    const thrift = s.char.traitIds.includes("save") ? 0.85 : 1;
    return { id, name: `${t.name}·${gr.label}`, cat: "lesson", note: t.effect, fee: Math.round(t.cost * gr.costMul * thrift), stress: t.stress + gr.stressAdd, dot: dot("lesson") };
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
  if (t) return { id: `train:${t.id}:g1`, name: `${t.name}·初级`, cat: "lesson", note: t.effect, fee: t.cost, stress: t.stress, dot: dot("lesson") };
  return null;
}

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
  const { game, setSchedule, runWeekNow, endDayNow, busy } = useGame();
  const [pickSeg, setPickSeg] = useState<number | null>(null);
  if (!open || !game || !game.sim) return null;
  const s = game.sim;

  const today = (s.day ?? 0) % 7; // 当前是本周第几天（0=周一 … 6=周日）
  const schedule = s.schedule ?? [];
  const thrift = s.char.traitIds.includes("save") ? 0.85 : 1;

  /* ═══ 本周排程安全预警（镜像引擎的资金/压力公式） ═══ */
  let feeSum = 0;
  let stressDelta = 0;
  for (let i = today; i < 7; i++) {
    const a = describeAct(s, schedule[i] ?? null);
    if (!a) continue;
    feeSum += a.fee;
    stressDelta += a.stress;
  }
  const projMoney = s.money - feeSum;
  const projStress = Math.max(0, Math.min(100, s.stress + stressDelta));
  const warnings: string[] = [];
  if (projMoney < 0) warnings.push("本周开销将令资金转负");
  if (projStress >= 85) warnings.push("压力将逼近临界");
  const gigStarted = s.activeGigId && !(s.gigStartWeek > 0 && s.week < s.gigStartWeek);
  if (gigStarted && !schedule.slice(today).includes("gig")) warnings.push("有在拍通告却没排「拍摄」，会误了档期");
  if (s.activeGigId && !gigStarted) warnings.push(`在拍通告第 ${s.gigStartWeek} 周才开机，本周暂不能拍`);
  if (s.activeGigId && s.gigDeadlineWeek && s.week >= s.gigDeadlineWeek && s.gigDaysLeft > 0)
    warnings.push(`在拍通告本周为截止周，仍差 ${s.gigDaysLeft} 天，拍不完将被撤换`);

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

  return (
    <Modal title={`本周日程 · 第 ${s.week} 周`} onClose={() => { onClose(); setPickSeg(null); }} wide>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] leading-snug text-ink-soft">排满周一到周日各一件事，「推进一天」逐日结算并掷出结果；跨过周日自动结算并翻入新一周重排。</p>
        <div className="ml-3 flex shrink-0 gap-2 text-[11.5px]">
          <button onClick={() => fillWeek("rest")} className="text-ink-soft transition hover:text-jade">余下休息</button>
          <span className="text-line">·</span>
          <button onClick={() => fillWeek(null)} className="text-ink-soft transition hover:text-danger">清空</button>
        </div>
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
                      <span className="flex items-center gap-1.5"><span className="font-medium text-ink">{info.name}</span>{chosen && <span className="text-[10px] text-jade">✓ 已排</span>}</span>
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
                        <div className="mt-1.5 grid grid-cols-4 gap-1">
                          {LESSON_GRADES.map((gr) => {
                            const id = `train:${t.id}:${gr.id}`;
                            const chosen = schedule[pickSeg] === id;
                            const fee = Math.round(t.cost * gr.costMul * thrift);
                            return (
                              <button
                                key={gr.id}
                                onClick={() => chooseAct(id)}
                                title={`上限 ${gr.cap} · 学费 ¥${fee}`}
                                className={`rounded-sm border border-dashed px-1 py-1.5 text-center transition ${chosen ? "border-solid border-jade bg-jade/10" : "border-line hover:border-jade"}`}
                              >
                                <span className="block text-[11.5px] font-semibold text-ink">{gr.label}</span>
                                <span className="block text-[9.5px] text-ink-soft">¥{fee >= 10000 ? (fee / 10000).toFixed(1) + "万" : fee}</span>
                              </button>
                            );
                          })}
                        </div>
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
                    {SIDE_JOBS.map((j) => {
                      const id = `work:${j.id}`;
                      const locked = s.fame < j.fameReq;
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
                              {chosen && <span className="text-[10px] text-jade">✓ 已排</span>}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{j.note}</span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              <span className="rounded bg-jade/12 px-1.5 py-px text-[10px] font-medium text-jade">约 ¥{j.pay >= 10000 ? (j.pay / 10000).toFixed(1) + "万" : j.pay}</span>
                              <span className="rounded bg-coral/10 px-1.5 py-px text-[10px] font-medium text-coral">压力+{j.stress}</span>
                              {locked && <span className="rounded bg-danger/10 px-1.5 py-px text-[10px] font-medium text-danger">名气需 ≥{j.fameReq}</span>}
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
                    return (
                      <button
                        key={a.id}
                        onClick={() => chooseAct(a.id)}
                        className={`flex items-start rounded-sm border border-dashed p-2.5 text-left transition ${chosen ? "border-solid border-jade bg-jade/8" : "border-line hover:border-jade"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5"><span className="font-medium text-ink">{a.name}</span>{chosen && <span className="text-[10px] text-jade">✓ 已排</span>}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{a.note}</span>
                          <span className="mt-1 block"><CostBadges act={a} /></span>
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

      {/* 排程风险预警（无风险时不显示） */}
      {warnings.length > 0 && (
        <div className="mb-3 rounded-sm border border-danger/40 bg-danger/5 p-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-[12px] text-danger">⚠ {w}</p>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={endDayNow}
          className="flex-1 rounded-sm border border-dashed border-jade/60 py-3 text-sm font-semibold text-jade transition hover:bg-jade/10 disabled:opacity-50"
        >
          [ 推进一天 · {weekdayName(s.day)} ]
        </button>
        <button
          disabled={busy}
          onClick={runWeekNow}
          className="flex-1 rounded-sm border border-solid border-jade bg-jade/10 py-3 text-sm font-semibold text-jade transition hover:bg-jade/20 disabled:opacity-50"
        >
          [ 过完本周 · 周日结算 ]
        </button>
      </div>
    </Modal>
  );
}
