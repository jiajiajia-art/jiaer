import { gigConfig } from "../game/gigConfig";
import { wallet } from "../game/wallet";
import { StarRating } from "../lib/icons";
import { useGame } from "../store/gameCtx";
import { Chip } from "./ui";
import { LIVE_GIGS as GIG_POOL } from "../mods/registry";
import { STAT_LABELS, type Gig, type StatKey } from "../game/data";
import { offersFrom, gigEligible, gigManager, type GigCat } from "../game/logic";
import { type PersonContent } from "../worlds/star2005/content";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID } from "../mods/registry";
import { liveTerm as T } from "../mods/live";

/* 通告接洽（踩地图·当面接单）：走到对应公司找到负责人后，直接查看 TA 手上的通告
 * ——具体内容、男女主/男女配阵容、你要出演的角色、片酬与档期，重点通告还有固定开机日期，
 * 就地「交涉」争取出演，签下即回日程排「拍摄」。取代过去「打听→去养成页交涉」的绕路。 */
const fmtWan = (yuan: number) => wallet.short(yuan);

export default function GigBoard({ pid, name }: { pid: string; name: string }) {
  const { game, simNegotiate } = useGame();
  if (!game) return null;
  const s = game.sim;
  const person = PERSON_BY_ID[pid] as PersonContent | undefined;
  const off = person?.offers;

  if (!off) {
    return <p className="rounded-lg bg-paper px-3 py-3 text-center text-[13px] text-ink-soft">{name}不经手{T("gig")}资源，去找对应的制片人/制作人吧。</p>;
  }

  // 本周该负责人手上的通告（按类别 + 发布节奏 + 名气就近）
  const weeklyIds = offersFrom(s, off.cats as GigCat[], off.maxStar);
  // 重点通告：该负责人名下、有固定开机周、临近开机（提前 4 周开放接洽）
  const fixedIds = GIG_POOL.filter(
    (g) =>
      g.fixedWeek &&
      gigManager(g).name === name &&
      !(s.usedGigs ?? []).includes(g.id) &&
      g.id !== s.activeGigId &&
      s.week <= g.fixedWeek &&
      s.week >= g.fixedWeek - 4,
  ).map((g) => g.id);

  const ids = Array.from(new Set([...fixedIds, ...weeklyIds]));
  const gigs = ids.map((id) => GIG_POOL.find((g) => g.id === id)).filter((g): g is Gig => !!g);

  if (!gigs.length) {
    return <p className="rounded-lg bg-paper px-3 py-3 text-center text-[13px] text-ink-soft">{name}说这阵子没有适合你的{off.label}，过些日子再来碰碰。</p>;
  }

  return (
    <div>
      <p className="mb-2.5 text-[11.5px] leading-relaxed text-ink-soft">
        {name}翻开手上的<span className="text-coral">{off.label}</span>——看清角色与档期，谈得拢就当面签。签下后回「养成 · 日程」把「拍摄」排进这一周。
      </p>
      <div className="space-y-2.5">
        {gigs.map((g) => {
          const eligible = gigEligible(g, s);
          const busy = !!s.activeGigId;
          return (
            <div key={g.id} className="ui-card p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 flex-1 truncate font-serif text-[14.5px] font-bold text-ink">
                  <><StarRating n={g.star} /> {g.name}</>
                </p>
                {g.fixedWeek ? <Chip tone="coral">固定档 · 第 {g.fixedWeek} 周</Chip> : <Chip tone="jade">{g.genre ?? g.type}</Chip>}
              </div>
              {g.note && <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{g.note}</p>}

              {g.role && (
                <p className="mt-1.5 text-[12px]">
                  你的角色：<span className="font-bold text-coral">{g.role}</span>
                </p>
              )}
              {g.cast && gigConfig().roles.some((r) => g.cast?.[r.key]) && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
                  {gigConfig().roles.filter((r) => g.cast?.[r.key]).map((r) => (
                    <span key={r.key}>{r.label} <span className="text-ink">{g.cast?.[r.key]}</span></span>
                  ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                <span className="text-coral">{T("fee")} {fmtWan(g.pay)}</span>
                <span className="text-gold">{T("fame")} +{g.fame}</span>
                <span className="text-ink-soft">档期 {g.days} 天</span>
                {g.fixedWeek && <span className="text-ink-soft">第 {g.fixedWeek} 周开工</span>}
              </div>
              <div className="mt-1 text-[11px] text-ink-soft">
                门槛：{g.fameReq > 0 ? `名气 ${g.fameReq}` : "名气不限"}
                {Object.entries(g.statReq).map(([k, v]) => `　${STAT_LABELS[k as StatKey]} ${v}`).join("")}
              </div>

              <button
                onClick={() => simNegotiate(g.id)}
                disabled={busy || !eligible}
                className="mt-2.5 w-full rounded-[var(--radius-ui-sm)] border border-solid border-coral bg-coral/10 py-1.5 text-[12.5px] font-bold text-coral transition hover:bg-coral/20 disabled:cursor-not-allowed disabled:border-line disabled:text-ink-soft/60"
              >
                {busy ? `已有${T("gig")}在身 · 档期冲突` : eligible ? "交涉接单（争取出演）" : "硬性门槛未达标 · 暂无法交涉"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
