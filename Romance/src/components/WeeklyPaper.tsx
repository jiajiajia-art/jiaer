/* 《星城娱乐週報》——「圈内动态」以每周报纸的形式呈现。
 * 精致的仿 2005 年小报排版：报头 + 头条导语 + 花边八卦 + 本週封賞 + 票房速报。
 * 全为确定性派生数据（buzz/awards/榜单），不调用 AI，不参与任何数值结算。 */
import type { AwardResult, StarBuzzView } from "../worlds/star2005/content";

type TopStar = { name: string; fame: number; tag: string; isPlayer: boolean };
type BoxItem = { title: string; starName: string; value: number };

function weekToDate(week: number) {
  // 第 1 周 = 2005.01.03（周一），每周 +7 天，落成「YYYY 年 M 月 D 日」
  const base = new Date(2005, 0, 3);
  const d = new Date(base.getTime() + (week - 1) * 7 * 86400000);
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
  const dateStr = weekToDate(week);
  const weekday = WEEKDAYS[new Date(2005, 0, 3 + (week - 1) * 7).getDay()];
  const lead = buzz[0];
  const rest = buzz.slice(1, 7);
  const highlightAwards = awards.filter((a) => a.work).slice(0, 3);
  const box = movies.slice(0, 3);

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
            <button key={i} onClick={() => onOpenName(p)} className="font-semibold text-ink underline decoration-dotted underline-offset-2 hover:text-coral">
              {p}
            </button>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </>
    );
  };

  return (
    <div className="overflow-hidden rounded-sm border-2 border-double border-ink bg-paper font-serif text-ink shadow-[0_1px_0_var(--line),0_2px_12px_-6px_rgba(0,0,0,0.35)]">
      {/* 报头 */}
      <div className="border-b border-ink px-4 pb-2 pt-3 sm:px-6">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          <span>创刊号 · 星城</span>
          <span>逢周一出报</span>
        </div>
        <h2 className="my-1 text-center text-[30px] font-black leading-none tracking-[0.12em] sm:text-[40px]">星城娱樂週報</h2>
        <div className="flex items-center justify-center gap-3 text-[11px] text-ink-soft">
          <span className="h-px w-8 bg-ink/40" />
          <span>{dateStr} · 星期{weekday}</span>
          <span className="text-gold">★</span>
          <span>第 {week} 期</span>
          <span className="h-px w-8 bg-ink/40" />
        </div>
      </div>

      {/* 双栏正文 */}
      <div className="grid gap-0 sm:grid-cols-3">
        {/* 头条 + 花边（跨两栏） */}
        <div className="border-line px-4 py-3 sm:col-span-2 sm:border-r sm:px-6">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-coral">头 条</p>
          {lead ? (
            <>
              <h3 className="mb-2 text-[20px] font-black leading-snug sm:text-[23px]">
                <Linkify text={lead.text} />
              </h3>
              <p className="text-[10px] text-ink-soft">— 本报讯 · 第 {lead.week} 周星城见闻</p>
            </>
          ) : (
            <h3 className="text-[19px] font-black leading-snug text-ink-soft">圈子风平浪静，且待下期分晓</h3>
          )}

          <div className="mt-3 border-t border-dashed border-line pt-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-jade">花 边</p>
            {rest.length ? (
              <ul className="columns-1 gap-5 sm:columns-2 [&>li]:break-inside-avoid">
                {rest.map((b, i) => (
                  <li key={i} className="mb-2 border-l-2 border-line pl-2.5 text-[12.5px] leading-relaxed text-ink/90">
                    <span className="mr-1 font-mono text-[10px] text-ink-soft">W{b.week}</span>
                    <Linkify text={b.text} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-ink-soft">尚无花边逸闻。度过几周，同行间的恩怨情仇、合作绯闻便会陆续见报。</p>
            )}
          </div>
        </div>

        {/* 侧栏：封賞 + 票房 */}
        <aside className="bg-paper-2/40 px-4 py-3 sm:px-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-gold">本週封賞</p>
          {highlightAwards.length ? (
            <ul className="mb-4 space-y-2">
              {highlightAwards.map((a) => (
                <li key={a.ceremony + a.category} className="border-b border-dashed border-line pb-2 last:border-0">
                  <p className="text-[10px] text-ink-soft">{a.ceremony} · {a.category}</p>
                  <p className="text-[14px] font-bold">
                    <button onClick={() => onOpenName(a.winnerName)} className="underline decoration-dotted underline-offset-2 hover:text-coral">{a.winnerName}</button>
                  </p>
                  {a.work && <p className="text-[11px] italic text-ink-soft">凭《{a.work}》封赏</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-[12px] text-ink-soft">奖季未启，敬请期待。</p>
          )}

          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-coral">票房速报</p>
          {box.length ? (
            <ol className="space-y-1.5">
              {box.map((m, i) => (
                <li key={m.title} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="min-w-0 truncate">
                    <span className={`mr-1 font-mono ${i === 0 ? "text-gold" : "text-ink-soft"}`}>{i + 1}</span>
                    《{m.title}》
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-soft">
                    {m.value >= 10000 ? `${(m.value / 10000).toFixed(1)}亿` : `${m.value}万`}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[12px] text-ink-soft">院线待映。</p>
          )}
        </aside>
      </div>

      {/* 报脚 */}
      <div className="border-t border-ink px-4 py-1.5 text-center text-[10px] tracking-[0.15em] text-ink-soft sm:px-6">
        星城娱樂週報社 · 本期见闻由确定性引擎结算 · 花边逸闻仅供观赏
      </div>
    </div>
  );
}
