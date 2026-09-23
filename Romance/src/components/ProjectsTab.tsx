import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { Chip } from "./ui";
import { IconScroll } from "../lib/icons";
import { dayDateLabel, weekdayName } from "../game/logic";
import {
  STRATEGIES,
  bucketProjects,
  categoryLabel,
  isWorkdayToday,
  roleLabel,
  statusLabel,
  syncOpenProjects,
  tplOf,
  type ProjectInstance,
} from "../game/projects";
import { discoveredProjectIds, knows } from "../game/producer";

type View = "hall" | "applications" | "contracts" | "ongoing" | "history";
const VIEWS: { id: View; label: string }[] = [
  { id: "hall", label: "通告资料" },
  { id: "applications", label: "我的申请" },
  { id: "contracts", label: "合同/档期" },
  { id: "ongoing", label: "进行中" },
  { id: "history", label: "历史" },
];

const STATUS_TONE: Record<string, string> = {
  open: "gold", applied: "gold", pending_result: "gold", offered: "jade", signed: "jade",
  in_progress: "jade", completed: "jade", released: "coral", failed: "danger", breached: "danger", expired: "line",
};

export default function ProjectsTab({ embedded = false }: { embedded?: boolean }) {
  const { game, projSign, projNegotiate, projPromote, projWorkday } = useGame();
  const [view, setView] = useState<View>("hall");
  const [workId, setWorkId] = useState<string | null>(null);
  if (!game) return null;
  const s = game.sim;
  const portfolio = s.portfolio ?? [];
  const list = syncOpenProjects(s);
  const b = bucketProjects(list);
  const discovered = discoveredProjectIds(s);
  const counts: Record<View, number> = {
    hall: b.hall.filter((p) => discovered.has(p.templateId)).length,
    applications: b.applications.length, contracts: b.contracts.length,
    ongoing: b.ongoing.length, history: b.history.length,
  };

  const metricNow = (metric: string): number => {
    if (metric === "fame") return s.fame;
    if (metric === "reputation") return s.reputation;
    if (metric.startsWith("stats.")) return (s.stats as Record<string, number>)[metric.slice(6)] ?? 0;
    return 0;
  };

  const Card = ({ p, children }: { p: ProjectInstance; children?: React.ReactNode }) => {
    const tpl = tplOf(p.templateId);
    if (!tpl) return null;
    return (
      <div className="rounded-xl border border-line bg-paper-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
              {"★".repeat(tpl.starLevel)} {tpl.title}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-soft">
              {categoryLabel(tpl.category)} · {roleLabel(p.roleType)} · {tpl.workDayCount}个工作日 · 预计报酬 ¥{(Math.round(tpl.feeYuan * p.rewardMultiplier) / 10000).toFixed(1)}万
            </p>
          </div>
          <Chip tone={STATUS_TONE[p.status] ?? "line"}>{statusLabel(p.status)}</Chip>
        </div>
        {children}
      </div>
    );
  };

  const Timeline = ({ p }: { p: ProjectInstance }) => (
    <div className="mt-2 space-y-0.5 border-t border-line pt-2 text-[11.5px] text-ink-soft">
      {p.history.map((h, i) => <p key={i}>· {h}</p>)}
    </div>
  );

  return (
    <div className={embedded ? "" : "mx-auto max-w-2xl px-4 py-5"}>
      {!embedded && (
        <h2 className="mb-1 flex items-center gap-2 font-serif text-xl font-bold text-ink">
          <IconScroll width={20} height={20} className="text-coral" /> 通告 · 职业履历
        </h2>
      )}
      <p className="mb-3 text-[13px] text-ink-soft">
        找制作人洽谈→逐项解锁通告→争取角色→提交申请→等通知→查看结果→确认合同→锁定档期。本页只整理你已从制作人处了解到的通告资料，投递与争取请到「世界」去对应公司当面找制作人洽谈。
      </p>

      {/* 五页状态切换 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] transition ${
              view === v.id ? "border-coral bg-coral/10 font-semibold text-coral" : "border-line text-ink-soft hover:text-ink"
            }`}
          >
            {v.label}{counts[v.id] ? ` ${counts[v.id]}` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {/* 通告资料：只整理已从制作人处了解到的通告线索（只读，不能在此投递） */}
        {view === "hall" && (() => {
          const cards = b.hall.filter((p) => discovered.has(p.templateId));
          return cards.length ? cards.map((p) => {
          const tpl = tplOf(p.templateId)!;
          const mgrName = game.npcs.find((n) => n.id === tpl.managerNpcId)?.name ?? "负责人";
          const seen = (field: string) => knows(s, tpl.id, field);
          return (
            <Card key={p.id} p={p}>
              <p className="mt-1.5 text-[12.5px] text-ink">{seen("synopsis") ? tpl.synopsis : "——（剧本尚未细谈）"}</p>
              <p className="mt-1 text-[11.5px] text-ink-soft">来源：{tpl.source}｜负责人 {mgrName}｜{seen("deadline") ? `报名截止第 ${tpl.deadlineWeek} 周` : "截止未定"}</p>
              {seen("requirements") && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tpl.roleSlot.requirements.map((r, i) => (
                    <Chip key={i} tone={metricNow(r.metric) >= r.value ? "jade" : "danger"}>
                      {r.hint}{metricNow(r.metric) >= r.value ? " ✓" : `（差 ${Math.max(0, Math.ceil(r.value - metricNow(r.metric)))}）`}
                    </Chip>
                  ))}
                </div>
              )}
              <p className="mt-2.5 rounded-lg bg-paper px-3 py-2 text-center text-[12px] text-ink-soft">
                去「世界」到公司当面找 {mgrName} 洽谈{seen("requirements") ? "并争取角色" : "，继续追问后才能争取"}
              </p>
            </Card>
          );
          }) : <Empty text="还没有通告资料。去「世界」到对应公司当面找制作人洽谈，问到的通告会整理在这里。" />;
        })()}

        {/* 我的申请 */}
        {view === "applications" && (b.applications.length ? b.applications.map((p) => (
          <Card key={p.id} p={p}>
            {p.playerScore != null && (
              <p className="mt-1.5 text-[12px] text-ink">试镜分：你 {p.playerScore}{p.rivalName ? ` · ${p.rivalName} ${p.rivalScore}` : ""}</p>
            )}
            <Timeline p={p} />
            {p.status === "pending_result" && (
              <div className="mt-2.5 rounded-lg border border-gold/40 bg-gold/5 px-3 py-2 text-[12px] text-ink-soft">
                资料已投递，制作方评审中。{p.resultDay != null ? `试镜结果将于 ${dayDateLabel(p.resultDay)} 公布——点击推进即可等到结果。` : "结果公布后将在此提示。"}
              </div>
            )}
            {p.status === "offered" && (
              <div className="mt-2.5 space-y-2">
                {p.feeBonusRate ? (
                  <p className="text-[12px] text-jade">协商结果：报酬上浮 +{Math.round(p.feeBonusRate * 100)}%</p>
                ) : !p.negotiated && (
                  <button onClick={() => projNegotiate(p.id)} className="w-full rounded-lg border border-coral/50 py-2 text-[12.5px] font-medium text-coral transition hover:bg-coral/10">
                    尝试争取更高报酬（协商一次）
                  </button>
                )}
                <button onClick={() => projSign(p.id)} className="w-full rounded-lg bg-jade py-2 text-[12.5px] font-semibold text-paper-2 transition hover:brightness-110">
                  确认签约 · 领预付款
                </button>
              </div>
            )}
          </Card>
        )) : <Empty text="尚无进行中的申请。去公告大厅投递资料吧。" />)}

        {/* 合同/档期 + 进行中共用工作日入口 */}
        {(view === "contracts" || view === "ongoing") && (() => {
          const rows = view === "contracts" ? b.contracts : b.ongoing;
          if (!rows.length) return <Empty text={view === "contracts" ? "没有已签约待开拍的项目。" : "没有拍摄中的项目。"} />;
          return rows.map((p) => {
            const tpl = tplOf(p.templateId)!;
            const today = isWorkdayToday(s, p);
            return (
              <Card key={p.id} p={p}>
                {p.contract && (
                  <div className="mt-1.5 text-[12px] text-ink-soft">
                    <p>预付 ¥{(p.contract.advanceYuan / 10000).toFixed(1)}万 · 违约金 ¥{(p.contract.breachYuan / 10000).toFixed(1)}万 · 排他 {tpl.exclusivityTags.length || "无"}</p>
                    <p className="mt-0.5">工作日：{p.contract.workDays.map((d) => `${dayDateLabel(d)} ${weekdayName(d)}`).join("｜")}</p>
                    <p className="mt-0.5">进度：{p.workLog.length}/{p.contract.workDays.length} 天{p.workLog.length ? ` · 平均表现 ${Math.round(p.workLog.reduce((a, x) => a + x, 0) / p.workLog.length)}` : ""}</p>
                  </div>
                )}
                {today ? (
                  workId === p.id ? (
                    <div className="mt-2.5 space-y-1.5 rounded-lg border border-jade/40 bg-jade/5 p-2.5">
                      <p className="text-[12px] font-medium text-ink">今日拍摄策略：</p>
                      {STRATEGIES.map((st) => (
                        <button
                          key={st.id}
                          onClick={() => { projWorkday(p.id, st.id); setWorkId(null); }}
                          className="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-left text-[12px] text-ink transition hover:border-jade"
                        >
                          <span className="font-semibold">{st.label}</span> · 压力 +{st.stress}
                          <span className="block text-[11px] text-ink-soft">{st.desc}</span>
                        </button>
                      ))}
                      <button onClick={() => setWorkId(null)} className="w-full py-1 text-[11.5px] text-ink-soft">取消</button>
                    </div>
                  ) : (
                    <button onClick={() => setWorkId(p.id)} className="mt-2.5 w-full rounded-lg bg-jade py-2 text-[12.5px] font-semibold text-paper-2 transition hover:brightness-110">
                      进入今日工作
                    </button>
                  )
                ) : (
                  <p className="mt-2 text-[11.5px] text-ink-soft">今天不是工作日，用「养成」页推进到工作日再开拍。</p>
                )}
              </Card>
            );
          });
        })()}

        {/* 历史 */}
        {view === "history" && (b.history.length ? b.history.map((p) => (
          <Card key={p.id} p={p}>
            {p.quality != null && <p className="mt-1.5 text-[12px] text-ink">评价：{p.gradeLabel}（Q={p.quality}）</p>}
            <Timeline p={p} />
          </Card>
        )) : <Empty text="还没有完成或结束的项目。" />)}
      </div>

      {/* 作品库 */}
      {portfolio.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 font-serif text-base font-bold text-ink">作品库</h3>
          <div className="space-y-2">
            {portfolio.map((w, i) => (
              <div key={i} className="rounded-xl border border-line bg-paper-2 px-3 py-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ink">{w.title}</p>
                    <p className="text-[11.5px] text-ink-soft">{categoryLabel(w.category)} · {w.role} · Q{w.quality}</p>
                  </div>
                  <div className="text-right">
                    {w.released ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <Chip tone="coral">已发行 名气+{w.fameAwarded}</Chip>
                        {w.buzzTier && w.buzzTier !== "none" && <span className="text-[11px] text-gold">{w.buzzTier === "big" ? "大爆" : "小爆"} · 传播分 {w.buzzScore}</span>}
                      </div>
                    ) : (
                      <span className="text-[11.5px] text-ink-soft">待发行 · {dayDateLabel(w.releaseDay)}</span>
                    )}
                  </div>
                </div>
                {!w.released && (
                  <button
                    onClick={() => projPromote(w.projectId)}
                    className="mt-2 w-full rounded-lg border border-coral/50 py-1.5 text-[12px] font-medium text-coral transition hover:bg-coral/10"
                  >
                    为作品造势宣传（-¥3000 · 压力+3 · 宣传指数{w.publicityIndex}）
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[13px] text-ink-soft">{text}</p>;
}
