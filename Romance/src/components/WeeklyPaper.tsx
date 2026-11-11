import { useState } from "react";
/* 《星城娱乐週報》——「圈内动态」以每周报纸的形式呈现。
 * 精致的仿 2005 年小报排版：报头 + 头条导语 + 花边八卦 + 奖季呼声 + 票房速报。
 * 全为确定性派生数据（buzz/awards/榜单），不调用 AI，不参与任何数值结算。 */
import { weekLocalDate } from "../game/logic";
import { getWorldSlot, getWorldId } from "../mods/registry";
import type { AwardResult, StarBuzzView } from "../worlds/star2005/content";
import { liveTerm as T } from "../mods/live";

type TopStar = { name: string; fame: number; tag: string; isPlayer: boolean };
type BoxItem = { title: string; starName: string; value: number };

function weekToDate(week: number) {
  // 第 1 周 = 2005.01.03（周一），每周 +7 天，落成「YYYY 年 M 月 D 日」
  const d = weekLocalDate(week);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export default function WeeklyPaper({
  week,
  buzz,
  awards,
  topStars,
  movies,
  onOpenName,
}: {
  week: number;
  buzz: StarBuzzView[];
  awards: AwardResult[];
  topStars: TopStar[];
  movies: BoxItem[];
  onOpenName: (name: string) => void;
}) {
  const masthead = getWorldSlot("weeklyPaper")?.masthead ?? "週報";
  const isEnt = getWorldId() === "ent"; // 奖季 / 票房 / 月榜等栏目只属于娱乐圈
  const dateStr = weekToDate(week);
  const weekday = WEEKDAYS[new Date(2005, 0, 3 + (week - 1) * 7).getDay()];
  // 同一条见闻不重复见报；票房按数额从高到低排名；同片名只留一条
  const uniqBuzz = buzz.filter((b, i) => buzz.findIndex((x) => x.text === b.text) === i);
  const lead = uniqBuzz[0];
  const rest = uniqBuzz.slice(1, 7);
  const highlightAwards = awards.filter((a, i) => a.work && awards.findIndex((x) => x.winnerName === a.winnerName) === i).slice(0, 3);
  const box = movies.filter((m, i) => movies.findIndex((x) => x.title === m.title) === i).sort((a, b) => b.value - a.value).slice(0, 3);

  // 头条正文里把人名做成可点链接（跳到艺人资料卡）
  const Linkify = ({ text }: { text: string }) => {
    const names = [...new Set(topStars.map((t) => t.name).filter(Boolean))].sort((a, b) => b.length - a.length);
    if (!names.length) return <>{text}</>;
    const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
    const parts = text.split(re);
    return (
      <>
        {parts.map((p, i) =>
          names.includes(p) ? (
            <button key={i} onClick={() => onOpenName(p)} className="font-black text-coral hover:brightness-110">
              {p}
            </button>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </>
    );
  };

  const [page, setPage] = useState(0);
  const pages = isEnt ? 2 : 1;
  const maxBox = Math.max(1, ...box.map((m) => m.value));
  const fmtBox = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}亿` : `${v}万`);
  const issue = week <= 1 ? "创刊号" : `总第 ${week} 期`;
  const Kicker = ({ children, en }: { children: string; en?: string }) => (
    <div className="mb-2.5 flex items-end gap-2 border-b border-ink/70 pb-1">
      <span className="text-[14px] font-black tracking-[0.35em] text-ink">{children}</span>
      {en && <span className="pb-px text-[10px] tracking-[0.2em] text-ink-soft">{en}</span>}
      <span className="ml-auto mb-[3px] h-[3px] w-6 bg-coral" />
    </div>
  );

  return (
    <article className="relative overflow-hidden rounded-[4px] bg-[color-mix(in_srgb,var(--gold)_9%,var(--paper))] font-serif text-ink shadow-[0_18px_36px_-22px_rgba(40,20,60,0.55),0_1px_0_var(--line)] ring-1 ring-ink/20">
      {/* 纸纹与暗角 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.55),transparent_60%),radial-gradient(140%_100%_at_50%_120%,rgba(90,60,30,0.10),transparent_55%),repeating-linear-gradient(0deg,transparent_0_3px,rgba(60,40,20,0.022)_3px_4px)]" />

      <div className="relative px-4 pt-3.5 sm:px-6">
        {/* 报眉 */}
        <div className="flex items-center justify-between text-[10.5px] tracking-[0.14em] text-ink-soft">
          <span className="rounded-sm bg-coral px-1.5 py-px font-bold tracking-[0.2em] text-paper">{issue}</span>
          <span>{T("city")}　每周一出版</span>
          <span>零售价 ¥1.00</span>
        </div>

        {/* 报头 */}
        <div className="mt-2.5 border-y-[3px] border-double border-ink/80 py-2.5 text-center">
          <h2 className="text-[clamp(30px,9vw,46px)] font-black leading-none tracking-[0.14em]">{masthead}</h2>
          <p className="mt-1.5 text-[10.5px] tracking-[0.5em] text-ink-soft">星光之下　皆是新闻</p>
        </div>
        <div className="grid grid-cols-3 items-center border-b border-ink/60 py-1.5 text-[11px] tracking-[0.08em] text-ink-soft">
          <span>{dateStr}</span>
          <span className="text-center font-bold text-ink">第 {week} 周</span>
          <span className="text-right">星期{weekday}</span>
        </div>
      </div>

      <div className="relative">
        {page === 0 && <section className="px-4 pb-5 pt-4 sm:px-6">
          <Kicker en="本期头条">头条</Kicker>
          {lead ? (
            <>
              <h3 className="text-[23px] font-black leading-[1.3] sm:text-[27px]"><Linkify text={lead.text} /></h3>
              <p className="mt-2 text-[10.5px] tracking-[0.12em] text-ink-soft">本报讯　第 {lead.week} 周 · {T("city")}</p>
            </>
          ) : (
            <div className="relative py-1">
              <h3 className="text-[23px] font-black leading-[1.35] text-ink/85 sm:text-[27px]">{isEnt ? "圈子风平浪静，" : "本周风平浪静，"}<br />且待下期分晓</h3>
              <p className="mt-2 text-[10.5px] tracking-[0.12em] text-ink-soft">本报讯　{T("city")}</p>
            </div>
          )}

          <div className="mt-5">
            <Kicker en="坊间逸闻">花边</Kicker>
            {rest.length ? (
              <ul className="columns-1 gap-6 sm:columns-2 [column-rule:1px_solid_color-mix(in_srgb,var(--ink)_15%,transparent)]">
                {rest.map((b, i) => (
                  <li key={i} className="mb-3 break-inside-avoid text-[13px] leading-[1.8] text-ink/90 first-letter:float-left first-letter:mr-1.5 first-letter:text-[2em] first-letter:font-black first-letter:leading-[1] first-letter:text-coral">
                    <Linkify text={b.text} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-l-2 border-ink/20 pl-3 text-[13px] leading-[1.8] text-ink-soft">{isEnt ? "尚无花边逸闻。度过几周，同行间的恩怨情仇、合作绯闻便会陆续见报。" : "尚无花边逸闻。度过几周，身边的新鲜事便会陆续见报。"}</p>
            )}
          </div>
        </section>}

        {isEnt && page === 1 && (
          <aside className="px-4 pb-5 pt-4 sm:px-6">
            <Kicker en="提名风向">奖季呼声</Kicker>
            {highlightAwards.length ? (
              <div className="mb-6">
                {/* 头名：大幅奖项特写 */}
                {(() => {
                  const a = highlightAwards[0];
                  return (
                    <div className="relative overflow-hidden border border-ink/70 p-[3px]">
                      <div className="relative border border-ink/30 bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] px-4 pb-4 pt-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-[10px] tracking-[0.3em] text-ink-soft">
                          <span className="h-px w-6 bg-ink/40" />呼声第一<span className="h-px w-6 bg-ink/40" />
                        </div>
                        <p className="mt-2 text-[11px] font-bold tracking-[0.2em] text-coral">{a.ceremony} · {a.category}</p>
                        <button onClick={() => onOpenName(a.winnerName)} className="mt-1.5 text-[30px] font-black leading-none tracking-[0.12em] transition hover:text-coral">{a.winnerName}</button>
                        {a.work && <p className="mt-2 text-[12px] tracking-[0.08em] text-ink-soft">凭《<span className="font-bold text-ink">{a.work}</span>》领跑</p>}
                        <span className="absolute right-2.5 top-2.5 flex h-9 w-9 rotate-12 items-center justify-center rounded-full border-2 border-coral/70 text-[10px] font-black leading-[1.05] tracking-wider text-coral">独家<br />预测</span>
                      </div>
                    </div>
                  );
                })()}
                {/* 其余：双栏短讯 */}
                {highlightAwards.length > 1 && (
                  <div className="mt-3 grid grid-cols-2 divide-x divide-ink/20 border-y border-ink/30">
                    {highlightAwards.slice(1).map((a, i) => (
                      <div key={a.ceremony + a.category} className="px-3 py-2.5 first:pl-0 last:pr-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[18px] font-black italic leading-none text-ink/30">{i + 2}</span>
                          <p className="min-w-0 truncate text-[10px] tracking-[0.08em] text-coral">{a.category}</p>
                        </div>
                        <button onClick={() => onOpenName(a.winnerName)} className="mt-1 block text-[17px] font-black leading-tight transition hover:text-coral">{a.winnerName}</button>
                        {a.work && <p className="mt-0.5 truncate text-[11px] text-ink-soft">《{a.work}》</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="mb-6 text-[12.5px] text-ink-soft">奖季未启，敬请期待。</p>
            )}

            <Kicker en="本周院线">票房速报</Kicker>
            {box.length ? (
              <ol className="space-y-2">
                {box.map((m, i) => (
                  <li key={m.title} className={`relative flex items-stretch overflow-hidden border ${i === 0 ? "border-ink/70 bg-[color-mix(in_srgb,var(--gold)_14%,transparent)]" : "border-ink/25"}`}>
                    {/* 票根 */}
                    <div className={`flex w-11 shrink-0 flex-col items-center justify-center border-r border-dashed ${i === 0 ? "border-ink/50 bg-ink text-paper" : "border-ink/30 text-ink/45"}`}>
                      <span className="text-[8px] tracking-[0.2em]">NO.</span>
                      <span className="text-[20px] font-black leading-none">{i + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[14px] font-black">《{m.title}》</span>
                        <span className={`shrink-0 text-[15px] font-black tabular-nums ${i === 0 ? "text-coral" : ""}`}>{fmtBox(m.value)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-[4px] flex-1 bg-ink/10">
                          <div className={`h-full ${i === 0 ? "bg-coral" : "bg-ink/35"}`} style={{ width: `${Math.max(8, (m.value / maxBox) * 100)}%` }} />
                        </div>
                        {m.starName && <button onClick={() => onOpenName(m.starName)} className="shrink-0 text-[10.5px] text-ink-soft transition hover:text-coral">{m.starName} 主演</button>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[12.5px] text-ink-soft">院线待映。</p>
            )}
            <p className="mt-4 text-center text-[10px] tracking-[0.3em] text-ink-soft/70">— 数据为本报估算　仅供参考 —</p>
          </aside>
        )}
      </div>

      {/* 报脚 */}
      <div className="relative mx-4 flex items-center justify-between border-t-[3px] border-double border-ink/70 py-2 text-[10px] tracking-[0.16em] text-ink-soft sm:mx-6">
        {pages > 1 ? (
          <>
            <button type="button" disabled={page === 0} onClick={() => setPage(0)} className="px-1 py-1 font-bold text-ink transition hover:text-coral disabled:opacity-30">‹ 上一版</button>
            <span className="tabular-nums">第 {page + 1} 版 / 共 {pages} 版</span>
            <button type="button" disabled={page === pages - 1} onClick={() => setPage(1)} className="px-1 py-1 font-bold text-ink transition hover:text-coral disabled:opacity-30">下一版 ›</button>
          </>
        ) : (
          <>
            <span>{masthead}社 出品</span>
            <span>花边逸闻　仅供观赏</span>
          </>
        )}
      </div>
    </article>
  );
}
