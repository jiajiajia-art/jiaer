import { feature } from "../mods/registry";
import { useEffect, useState } from "react";
import { useGame } from "../store/gameCtx";
import { IconChevronDown, IconChevronUp, IconPin, IconSparkle, StarRating } from "../lib/icons";
import { industryBoards, leaderboard, gigCategory, type GigCat } from "../game/logic";
import { GIG_POOL, STAT_LABELS, attrLabelOf, type StatKey } from "../game/data";
import { AD_BRANDS, MOVIE_TITLES, companyMeta, industryAwards, renderStarBuzz } from "../worlds/star2005/content";
import { complete, isConfigured } from "../lib/ai";
import { Chip, Modal } from "./ui";
import { CompanyModal, StarModal } from "./IndustryModals";
import { openPerson } from "./NpcTab";
import WeeklyPaper from "./WeeklyPaper";
import IndustryPageHeader from "./IndustryPageHeader";
import { liveTerm as T } from "../mods/live";

function fmtWan(v: number) {
  return v >= 10000 ? `${(v / 10000).toFixed(1)} 亿` : `${v.toLocaleString()} 万`;
}

function BoardHead({ code, cn, note }: { code: string; cn: string; note?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="h-4 w-1 rounded-full bg-gradient-to-b from-jade to-coral" data-code={code} />
      <span className="text-[14.5px] font-bold tracking-wide text-ink">{cn}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
      {note && <span className="shrink-0 rounded-full bg-jade/10 px-2 py-0.5 text-[11px] font-medium text-jade">{note}</span>}
    </div>
  );
}

const BOARD_TABS = [
  { id: "paper", label: "周报" },
  { id: "rank", label: "榜单" },
  { id: "co", label: "公司" },
  { id: "gig", get label() { return T("gig"); } },
] as const;
const RANK_TABS = [
  { id: "fame", label: "人气" },
  { id: "box", label: "票房" },
  { id: "ad", label: "代言" },
  { id: "award", label: "奖项" },
] as const;
type RankView = (typeof RANK_TABS)[number]["id"];
type BoardView = (typeof BOARD_TABS)[number]["id"];

export default function ActionsTab() {
  const { game, cfg, simNegotiate, busy } = useGame();
  const [tab, setTab] = useState<BoardView>("paper");
  const [rank, setRank] = useState<RankView>("fame");
  const view: string = tab === "rank" ? rank : tab;
  const [selStar, setSelStar] = useState<string | null>(null);
  const [selCompany, setSelCompany] = useState<string | null>(null);
  const [movie, setMovie] = useState<{ title: string; starName: string; company: string; value: number } | null>(null);
  const [fameAll, setFameAll] = useState(false);
  const [gigCat, setGigCat] = useState<GigCat>("ad");
  if (!game) return null;
  const s = game.sim;
  const board = leaderboard(s);
  const myRank = board.findIndex((r) => r.isPlayer) + 1;
  const { movies, ads } = industryBoards(s);
  const awards = industryAwards(s);
  const buzz = renderStarBuzz(s).slice(0, 12);
  const star = selStar ? s.npcs.find((n) => n.id === selStar) ?? null : null;
  const starById = (id: string) => s.npcs.find((n) => n.id === id) ?? null;
  const starByName = (name: string) => s.npcs.find((n) => n.name === name) ?? null;
  // 艺人即 NPC：统一跳到「人脉」里的人物详情
  const openStar = (id: string) => { setSelCompany(null); setSelStar(null); openPerson(id); };
  const rosterOf = (companyId: string) => s.npcs.filter((n) => n.companyId === companyId).sort((a, b) => b.fame - a.fame);

  const NameBtn = ({ name, className = "" }: { name: string; className?: string }) => {
    const found = starByName(name);
    if (!found) return <span className={className}>{name}</span>;
    return (
      <button onClick={(e) => { e.stopPropagation(); openStar(found.id); }} className={`underline decoration-dotted underline-offset-2 transition hover:text-jade ${className}`}>
        {name}
      </button>
    );
  };

  return (
    <div className="w-full pb-5">
      <IndustryPageHeader
        eyebrow={`第 ${s.week} 周`}
        title={`${T("industry")}`}
        subtitle="星榜风云"
        icon={<IconSparkle width={16} height={16} />}
      />

      <div className="mx-auto max-w-2xl px-4 pt-3">
        {/* 子页面切换：顶部横向标签栏 */}
        <div className="sticky top-0 z-10 -mx-4 mb-4 grid grid-cols-4 gap-1 border-b border-line/60 bg-paper/90 px-4 py-2.5 backdrop-blur-md [scrollbar-width:none]">
        {BOARD_TABS.map((t) => {
          const active = tab === t.id;
          const note = t.id === "rank" && myRank ? `${myRank}` : "";
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={active}
              className={`truncate rounded-full px-1 py-2 text-[12.5px] font-bold tracking-[0.06em] transition ${
                active ? "bg-gradient-to-r from-jade to-coral text-paper shadow-[0_6px_16px_-8px_var(--color-jade)]" : "bg-paper-2/70 text-ink-soft hover:text-jade"
              }`}
            >
              {t.label}{note && <sup className={`ml-0.5 text-[9.5px] font-black ${active ? "text-paper/85" : "text-coral"}`}>#{note}</sup>}
            </button>
          );
        })}
      </div>

      {tab === "rank" && (
        <div className="mb-4 flex gap-1 rounded-full border border-line bg-paper-2/60 p-1">
          {RANK_TABS.map((r) => (
            <button key={r.id} onClick={() => setRank(r.id)} aria-current={rank === r.id}
              className={`flex-1 rounded-full py-1.5 text-[12px] font-bold transition ${rank === r.id ? "bg-paper text-jade shadow-sm" : "text-ink-soft hover:text-jade"}`}>
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* 圈内动态 · 每周报纸 */}
      {view === "paper" && feature("weeklyPaper") && (
      <section className="mb-6">
        <WeeklyPaper
          week={s.week}
          buzz={buzz}
          awards={awards}
          topStars={board}
          movies={movies.map((m) => ({ title: MOVIE_TITLES[m.titleIndex % MOVIE_TITLES.length], starName: m.starName, value: m.value }))}
          onOpenName={(name) => { const f = starByName(name); if (f) openStar(f.id); }}
        />
      </section>
      )}

      {/* 年度奖项 · 当前得主 */}
      {view === "award" && (
      <section className="mb-6">
        <BoardHead code="AWARD" cn="年度奖项 · 当前得主" />
        <div className="grid gap-1.5 sm:grid-cols-2">
          {awards.map((a) => (
            <div key={a.ceremony + a.category} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-paper/70 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.12)] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] text-ink-soft">{a.ceremony}</p>
                <p className="truncate text-[13px] font-semibold text-ink">{a.category}</p>
                {a.work && <p className="truncate text-[11px] italic text-ink-soft">凭《{a.work}》</p>}
              </div>
              <span className="shrink-0"><NameBtn name={a.winnerName} className="text-[13px] font-bold text-gold" /></span>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* 人气榜 */}
      {view === "fame" && (
      <section className="mb-6">
        <BoardHead code="FAME" cn="艺人人气榜" note={`你排第 ${myRank} 名`} />
        <div className="rounded-2xl border border-line bg-paper/70 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.12)] p-3">
          <div className="space-y-0.5">
            {(fameAll ? board : board.slice(0, 10)).map((r, i) => (
              <div key={r.name} className={`flex items-center justify-between rounded-xl px-2 py-1.5 text-[13px] ${r.isPlayer ? "bg-jade/10 font-bold text-jade" : i % 2 ? "text-ink" : "bg-paper-2/40 text-ink"}`}>
                <span className="min-w-0 truncate">
                  <span className={`mr-2 inline-grid h-5 w-5 place-items-center rounded-full align-middle font-mono text-[11px] font-bold ${i === 0 ? "bg-gold text-paper" : i === 1 ? "bg-ink-soft/70 text-paper" : i === 2 ? "bg-coral/80 text-paper" : "bg-paper-2 text-ink-soft"}`}>{i + 1}</span>
                  {r.isPlayer ? r.name : <NameBtn name={r.name} />} <span className="text-[11px] font-normal text-ink-soft">{r.tag}</span>
                </span>
                <span className="font-mono">{r.fame}</span>
              </div>
            ))}
          </div>
          {board.length > 10 && (
            <button
              onClick={() => setFameAll((v) => !v)}
              className="mt-2 w-full rounded-2xl border border-line bg-paper/70 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.12)] py-1.5 text-[12px] font-medium text-jade transition hover:border-jade hover:bg-jade/5"
            >
              {fameAll ? <span className="inline-flex items-center justify-center gap-1">收起 <IconChevronUp size={12} /></span> : <span className="inline-flex items-center justify-center gap-1">查看全部 {board.length} 位 <IconChevronDown size={12} /></span>}
            </button>
          )}
        </div>
      </section>
      )}

      {/* 票房榜 */}
      {view === "box" && (
      <section className="mb-6">
        <BoardHead code="BOX" cn="院线票房榜" note="点戏名看详情" />
        <div className="space-y-1.5">
          {movies.map((m, i) => {
            const title = MOVIE_TITLES[m.titleIndex % MOVIE_TITLES.length];
            const company = companyMeta(m.companyId).name;
            return (
              <div
                key={m.starId}
                role="button"
                tabIndex={0}
                onClick={() => setMovie({ title, starName: m.starName, company, value: m.value })}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMovie({ title, starName: m.starName, company, value: m.value }); } }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-paper/70 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.12)] px-3 py-2 text-left transition hover:border-coral hover:bg-coral/5"
              >
                <span className={`w-5 text-right font-mono text-[13px] ${i < 3 ? "text-gold" : "text-ink-soft"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink">《{title}》 <span className="text-[11px] font-normal text-coral">详情 →</span></p>
                  <p className="truncate text-[11px] text-ink-soft">主演 <NameBtn name={m.starName} className="text-ink-soft" /> · {company}</p>
                </div>
                <span className="shrink-0 font-mono text-[13px] font-bold text-coral">{fmtWan(m.value)}</span>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* 代言榜 */}
      {view === "ad" && (
      <section className="mb-6">
        <BoardHead code="AD" cn="当红代言榜" note="身价·年" />
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ads.map((a) => (
            <div key={a.starId} className="flex items-center gap-2.5 rounded-2xl border border-line bg-paper/70 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.12)] px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{AD_BRANDS[a.titleIndex % AD_BRANDS.length]}</p>
                <p className="truncate text-[11px] text-ink-soft">代言人 <NameBtn name={a.starName} className="text-ink-soft" /></p>
              </div>
              <span className="shrink-0 font-mono text-[12.5px] font-bold text-gold">{fmtWan(a.value)}</span>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* 经纪公司 */}
      {view === "co" && (
      <section className="mb-6">
        <BoardHead code="CO" cn="经纪公司" note="点开看旗下艺人" />
        <div className="grid gap-1.5 sm:grid-cols-2">
          {s.companies?.slice().sort((a, b) => b.prestige - a.prestige).map((c) => {
            const meta = companyMeta(c.id);
            const roster = rosterOf(c.id);
            return (
              <button
                key={c.id}
                onClick={() => { setSelStar(null); setSelCompany(c.id); }}
                className="rounded-2xl border border-line bg-paper/70 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.12)] p-3 text-left transition hover:border-jade hover:bg-jade/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13.5px] font-bold text-ink">{meta.name}</p>
                  <Chip tone="gold">声望 {c.prestige}</Chip>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-soft">{meta.blurb}</p>
                <p className="mt-1 text-[11px] text-jade">旗下 {roster.length} 位艺人 →</p>
              </button>
            );
          })}
        </div>
      </section>
      )}

      {/* 通告库 · 全部可接通告（广告/电视剧/电影/唱片各 100 档） */}
      {view === "gig" && (() => {
        const CATS: { id: GigCat; label: string }[] = [
          { id: "ad", label: "广告" },
          { id: "tv", label: "电视剧" },
          { id: "film", label: "电影" },
          { id: "record", label: "唱片" },
        ];
        const used = new Set(s.usedGigs ?? []);
        const catList = GIG_POOL.filter((g) => gigCategory(g) === gigCat);
        const doneCount = catList.filter((g) => used.has(g.id)).length;
        return (
        <section className="mb-6">
          <BoardHead code="GIG" cn={`${T("gig")}库 · 全部${T("gig")}`} note={`共 ${GIG_POOL.length} 档 · 已拍过的不再出现`} />
          <p className="mb-3 text-[12px] leading-relaxed text-ink-soft">
            {T("city")}经纪圈流通的{T("gig")}全表，分<span className="text-jade">广告 · 电视剧 · 电影 · 唱片</span>四类，每类 100 档。影视类标注题材与男女主/男女配角阵容；接下并结算后即计入<span className="text-coral">「已拍」</span>，之后不会再被派到你名下。此处仅供<span className="text-jade">浏览全表</span>——真正接单要<span className="text-coral">踩地图</span>去对应公司找负责人「接洽{T("gig")}」当面交涉。
          </p>

          {/* 分类切换 */}
          <div className="mb-3 flex gap-1">
            {CATS.map((c) => {
              const n = GIG_POOL.filter((g) => gigCategory(g) === c.id).length;
              const active = gigCat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setGigCat(c.id)}
                  className={`flex-1 rounded-full border px-2 py-1.5 text-[12.5px] font-bold transition ${active ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft hover:border-jade/60"}`}
                >
                  {c.label}<span className="ml-1 text-[10px] font-normal text-ink-soft">{n}</span>
                </button>
              );
            })}
          </div>
          {doneCount > 0 && <p className="mb-2 text-[11px] text-ink-soft">本类已拍 {doneCount} / {catList.length} 档。</p>}

          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((tier) => {
              const list = catList.filter((g) => g.star === tier);
              if (!list.length) return null;
              return (
                <div key={tier}>
                  <p className="mb-1.5 text-[11.5px] font-bold tracking-[0.15em] text-gold">
                    <StarRating n={tier} />
                    <span className="ml-2 font-normal text-ink-soft">
                      {tier === 1 ? `起步${T("gig")}` : tier === 2 ? "崭露头角" : tier === 3 ? "小有名气" : tier === 4 ? "当红一线" : "顶流大咖"}
                    </span>
                  </p>
                  <div className="grid gap-1.5">
                    {list.map((g) => {
                      const isUsed = used.has(g.id);
                      const isActive = g.id === s.activeGigId;
                      const onOffer = (s.offers ?? []).includes(g.id);
                      return (
                      <div key={g.id} className={`rounded-2xl border bg-paper/70 px-3 py-2.5 ${isUsed ? "border-line/60 bg-black/[0.02] opacity-55" : isActive ? "border-coral bg-coral/5" : "border-line"}`}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`min-w-0 flex-1 truncate text-[13.5px] font-bold ${isUsed ? "text-ink-soft line-through" : "text-ink"}`}>{g.name}</p>
                          {isUsed ? <Chip>已拍</Chip> : isActive ? <Chip tone="coral">在拍</Chip> : onOffer ? <Chip tone="coral">本周可交涉</Chip> : <Chip tone="jade">{g.genre ?? g.type}</Chip>}
                        </div>
                        {g.note && <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{g.note}</p>}
                        {g.cast && (
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
                            <span>男主 <span className="text-ink">{g.cast.maleLead}</span></span>
                            <span>女主 <span className="text-ink">{g.cast.femaleLead}</span></span>
                            <span>男配 <span className="text-ink">{g.cast.maleSupport}</span></span>
                            <span>女配 <span className="text-ink">{g.cast.femaleSupport}</span></span>
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                          <span className="text-coral">片酬 {fmtWan(g.pay / 10000)}</span>
                          <span className="text-gold">名气 +{g.fame}</span>
                          <span className="text-ink-soft">档期 {g.days} 天</span>
                        </div>
                        <div className="mt-1.5 text-[11px] text-ink-soft">
                          门槛：{g.fameReq > 0 ? `名气 ${g.fameReq}` : "名气不限"}
                          {Object.entries(g.statReq).map(([k, v]) => `　${attrLabelOf(k)} ${v}`).join("")}
                        </div>
                        <div className="mt-0.5 text-[11px] text-jade">
                          成长：{Object.entries(g.grow).map(([k, v]) => `${attrLabelOf(k)} +${v}`).join(" · ")}
                        </div>
                        {/* 交涉接单：仅对本周已打听到的通告开放；签下后回「养成」排「拍摄」日程 */}
                        {onOffer && !isUsed && !isActive && (
                          <button
                            onClick={() => simNegotiate(g.id)}
                            disabled={!!s.activeGigId || busy}
                            className="mt-2 w-full rounded-full border border-coral bg-coral/10 py-1.5 text-[12px] font-bold text-coral transition hover:bg-coral/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {s.activeGigId ? `已有${T("gig")}在身 · 档期冲突` : "交涉接单（争取出演）"}
                          </button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        );
      })()}


      {star && <StarModal star={star} onOpenStar={openStar} onClose={() => setSelStar(null)} />}
      {selCompany && (
        <CompanyModal
          companyId={selCompany}
          roster={rosterOf(selCompany)}
          onOpenStar={openStar}
          onClose={() => setSelCompany(null)}
        />
      )}
      {movie && <MovieModal {...movie} cfg={cfg} onClose={() => setMovie(null)} />}
      </div>
    </div>
  );
}

/* 票房详情：票房数字确定性给定；剧情简介与热评由 AI 现写（不参与任何数值） */
function MovieModal({ title, starName, company, value, cfg, onClose }: { title: string; starName: string; company: string; value: number; cfg: Parameters<typeof complete>[0]; onClose: () => void }) {
  const [synopsis, setSynopsis] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const gen = async () => {
    if (!isConfigured(cfg)) { setErr("尚未配置 AI（右上角齿轮），无法生成剧情简介与热评。"); return; }
    setLoading(true); setErr("");
    try {
      const raw = await complete(cfg, [
        { role: "system", content: "你在扮演 2005 年中国大陆的娱乐媒体。用当年语感写作，简洁、有画面感，不使用现代网络热词。" },
        { role: "user", content: `为一部 2005 年上映、由「${starName}」（${company}旗下）主演的华语电影《${title}》创作：\n1) 一段约 80 字的剧情简介；\n2) 4 条网友短评（每条 25 字以内，风格各异）。\n严格按此格式输出，不要多余文字：\n简介：……\n热评：……\n热评：……\n热评：……\n热评：……` },
      ]);
      const syn = raw.match(/简介：\s*(.+)/)?.[1]?.trim() ?? "";
      const cmts = [...raw.matchAll(/热评：\s*(.+)/g)].map((m) => m[1].trim()).filter(Boolean);
      setSynopsis(syn || raw.trim());
      setComments(cmts);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "生成失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void gen(); /* 打开即生成一次 */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title={`《${title}》`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <Chip tone="coral">本周票房 {fmtWan(value)}</Chip>
        <span className="text-ink-soft">主演</span><span className="font-bold text-ink">{starName}</span>
        <span className="text-ink-soft">·</span><span className="text-ink">{company}</span>
      </div>

      <p className="mb-1.5 text-[12px] font-bold tracking-[0.2em] text-jade">▌剧情简介</p>
      {loading && !synopsis ? (
        <p className="text-[13px] text-ink-soft">AI 正在撰写……</p>
      ) : synopsis ? (
        <p className="story-prose text-[13.5px] leading-relaxed text-ink/90">{synopsis}</p>
      ) : (
        <p className="text-[13px] text-ink-soft/70">暂无简介。</p>
      )}

      <div className="mb-1.5 mt-4 flex items-center gap-2">
        <p className="text-[12px] font-bold tracking-[0.2em] text-jade">▌网友热评</p>
        <button onClick={() => void gen()} disabled={loading} className="text-[11px] text-ink-soft transition hover:text-jade disabled:opacity-50">{loading ? "生成中…" : "换一批 ↻"}</button>
      </div>
      {comments.length ? (
        <ul className="space-y-1.5">
          {comments.map((c, i) => (
            <li key={i} className="rounded-2xl border border-line bg-paper/70 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.12)] px-3 py-2 text-[13px] text-ink">“{c}”</li>
          ))}
        </ul>
      ) : (
        !loading && <p className="text-[13px] text-ink-soft/70">暂无热评。</p>
      )}

      {err && <p className="mt-3 text-[12px] text-danger">{err}</p>}
      <p className="mt-3 text-[11px] text-ink-soft/70">＊票房为引擎确定性结算，简介与热评由 AI 现写、仅供观赏。</p>
    </Modal>
  );
}
