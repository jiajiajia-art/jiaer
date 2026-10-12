import NpcProfile from "./NpcProfile";
import { useGame } from "../store/gameCtx";
import { type NPC } from "../game/logic";
import { MOVIE_TITLES, companyMeta } from "../worlds/star2005/content";
import { Chip, Modal } from "./ui";
import { StatBars, WorksChips } from "./personFields";

/* 经纪公司资料：声望、简介、旗下艺人名录（可点开每位艺人）——供「娱乐圈」页与「世界」页城市地图共用 */
export function CompanyModal({ companyId, roster, onOpenStar, onClose }: { companyId: string; roster: NPC[]; onOpenStar: (id: string) => void; onClose: () => void }) {
  const meta = companyMeta(companyId);
  return (
    <Modal title={meta.name} onClose={onClose} wide>
      <div className="mb-3 flex items-center gap-2">
        <Chip tone="gold">声望 {meta.prestige}</Chip>
        <span className="text-[12px] text-ink-soft">旗下 {roster.length} 位艺人</span>
      </div>
      {meta.blurb && <p className="mb-4 text-[13px] leading-relaxed text-ink/90">{meta.blurb}</p>}

      {/* 掌舵人 / 老板 */}
      {meta.boss && (
        <div className="mb-4 rounded-sm border border-dashed border-gold/60 bg-gold/[0.06] p-3">
          <p className="mb-1.5 text-[12px] font-bold tracking-[0.2em] text-gold">▌掌舵人</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-bold text-ink">{meta.boss.name}</span>
            <Chip tone="gold">{meta.boss.title}</Chip>
            <span className="text-[12px] text-ink-soft">{meta.boss.age} 岁 · {meta.boss.style}</span>
          </div>
          <p className="mt-2 border-l-2 border-gold/50 pl-2.5 text-[12.5px] italic text-ink/85">“{meta.boss.quote}”</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{meta.boss.bio}</p>
        </div>
      )}

      <p className="mb-2 text-[12px] font-bold tracking-[0.2em] text-jade">▌旗下艺人</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {roster.map((n) => (
          <button
            key={n.id}
            onClick={() => onOpenStar(n.id)}
            className="flex items-center justify-between gap-2 rounded-sm border border-dashed border-line px-3 py-2 text-left transition hover:border-jade hover:bg-jade/5"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink">{n.name}</span>
              <span className="block truncate text-[11px] text-ink-soft">{n.dir} · {n.personality}</span>
            </span>
            <span className="shrink-0 font-mono text-[12px] text-coral">名气 {n.fame}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* 艺人资料卡：公司、代表作、履历、情感关系、八维——全为确定性数据，不调用 AI */
export function StarModal({ star, onOpenStar, onClose }: { star: NPC; onOpenStar: (id: string) => void; onClose: () => void }) {
  return <NpcProfile pid={star.id} onClose={onClose} />;
}
