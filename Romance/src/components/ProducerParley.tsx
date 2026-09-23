import type React from "react";
import { useGame } from "../store/gameCtx";
import { Chip } from "./ui";
import { PRODUCER } from "../worlds/star2005/content";
import { canPursue, knows, metToday, producerProjects, questionState } from "../game/producer";
import { categoryLabel, roleLabel } from "../game/projects";

/* 制作人洽谈（明星志愿式）：登门洽谈 → 逐项追问解锁 → 争取角色进入申请流程。
 * 只在对应公司地点、当事人在场时出现（由世界 Tab 场景决定何时挂载）。 */
export default function ProducerParley({ pid, name }: { pid: string; name: string }) {
  const { game, simMeetProducer, simAskProducer, projApply } = useGame();
  if (!game) return null;
  const s = game.sim;
  const projs = producerProjects(s, pid);
  const met = metToday(s, pid);
  const metricNow = (m: string): number =>
    m === "fame" ? s.fame : m === "reputation" ? s.reputation : m.startsWith("stats.") ? ((s.stats as Record<string, number>)[m.slice(6)] ?? 0) : 0;

  if (!projs.length) {
    return <p className="rounded-lg bg-paper px-3 py-3 text-center text-[13px] text-ink-soft">{PRODUCER.labels.notManager}</p>;
  }

  return (
    <div>
      {met ? (
        <p className="mb-3 rounded-lg bg-jade/10 px-3 py-2 text-[12.5px] text-jade">{PRODUCER.labels.meetDone}</p>
      ) : (
        <button onClick={() => simMeetProducer(pid, name)} className="mb-3 w-full rounded-lg bg-coral py-2.5 text-[13px] font-semibold text-paper-2 transition hover:brightness-110">
          {PRODUCER.labels.meet}
        </button>
      )}
      <div className="space-y-3">
        {projs.map((tpl) => {
          const inst = (s.projects ?? []).find((x) => x.templateId === tpl.id);
          const total = Math.round(tpl.feeYuan * tpl.roleSlot.rewardMultiplier);
          const w = (n: number) => `¥${(n / 10000).toFixed(1)}万`;
          const row = (label: string, known: boolean, val: React.ReactNode, maskKey: string) => (
            <div className="flex gap-2 text-[12.5px]">
              <span className="w-14 shrink-0 text-ink-soft">{label}</span>
              <span className={known ? "text-ink" : "text-ink-soft/60"}>{known ? val : PRODUCER.masks[maskKey]}</span>
            </div>
          );
          return (
            <div key={tpl.id} className="rounded-xl border border-line bg-paper p-3">
              <p className="mb-2 font-serif text-[15px] font-bold text-ink">{knows(s, tpl.id, "starLevel") ? "★".repeat(tpl.starLevel) + " " : ""}{tpl.title}</p>
              <div className="space-y-1">
                {row("类别", knows(s, tpl.id, "category"), categoryLabel(tpl.category), "starLevel")}
                {row("拍期", knows(s, tpl.id, "deadline"), `开拍第 ${tpl.openWeek} 周 · 报名截止第 ${tpl.deadlineWeek} 周`, "deadline")}
                {row("剧本", knows(s, tpl.id, "synopsis"), tpl.synopsis, "synopsis")}
                {row("级别", knows(s, tpl.id, "starLevel"), `${tpl.starLevel} 星制作`, "starLevel")}
                {row("角色", knows(s, tpl.id, "roleType"), roleLabel(tpl.roleSlot.roleType), "roleType")}
                {row("要求", knows(s, tpl.id, "requirements"), (
                  <span className="flex flex-wrap gap-1">
                    {tpl.roleSlot.requirements.map((r, i) => (
                      <Chip key={i} tone={metricNow(r.metric) >= r.value ? "jade" : "danger"}>{r.hint}{metricNow(r.metric) >= r.value ? " ✓" : `（差 ${Math.max(0, Math.ceil(r.value - metricNow(r.metric)))}）`}</Chip>
                    ))}
                  </span>
                ), "requirements")}
                {row("片酬", knows(s, tpl.id, "exactFee"), `总额 ${w(total)}（签约金 ${w(Math.round(total * tpl.advanceRate))} · 拍毕尾款 ${w(total - Math.round(total * tpl.advanceRate))}）`, knows(s, tpl.id, "feeRange") ? "exactFee" : "feeRange")}
                {knows(s, tpl.id, "feeRange") && !knows(s, tpl.id, "exactFee") && (
                  <div className="flex gap-2 text-[12.5px]"><span className="w-14 shrink-0 text-ink-soft" /><span className="text-ink-soft">约 {w(total * 0.8)}–{w(total * 1.2)}（区间）</span></div>
                )}
                {row("档期", knows(s, tpl.id, "workDates"), `${tpl.workDayCount} 个工作日`, "workDates")}
                {row("细则", knows(s, tpl.id, "breachFee"), `发行延迟 ${tpl.releaseDelayDays} 天 · 排他 ${tpl.exclusivityTags.length ? tpl.exclusivityTags.join("/") : "无"} · 违约金率 ${Math.round(tpl.breachRate * 100)}%`, "breachFee")}
              </div>

              {/* 追问问句（当日已洽谈才可点） */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {PRODUCER.questions.map((q) => {
                  const st = questionState(s, tpl.id, q);
                  if (st === "asked") return <span key={q.id} className="rounded-md bg-jade/10 px-2 py-1 text-[11.5px] text-jade">✓ {q.label}</span>;
                  return (
                    <button
                      key={q.id}
                      disabled={!met || st === "locked"}
                      onClick={() => simAskProducer(pid, tpl.id, q.id)}
                      className="rounded-md border border-coral/40 px-2 py-1 text-[11.5px] text-coral transition hover:bg-coral/10 disabled:cursor-not-allowed disabled:border-line disabled:text-ink-soft/50"
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>

              {/* 争取角色：问到「要求」后开放，进入正式申请流程 */}
              {inst && !["open"].includes(inst.status) ? (
                <p className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-center text-[12px] text-ink-soft">已进入申请流程 · 详见「通告」Tab</p>
              ) : (
                <button
                  disabled={!canPursue(s, tpl.id)}
                  onClick={() => projApply(tpl.id)}
                  className="mt-3 w-full rounded-lg bg-coral py-2 text-[12.5px] font-semibold text-paper-2 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {canPursue(s, tpl.id) ? `${PRODUCER.labels.pursue}（投递资料）` : "先追问「对演员有什么属性要求」再争取"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
