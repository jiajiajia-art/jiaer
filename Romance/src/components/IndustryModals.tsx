import { useGame } from "../store/gameCtx";
import { canRomance, type NPC } from "../game/logic";
import { MOVIE_TITLES, companyMeta, type FamilyRef } from "../worlds/star2005/content";
import { useState } from "react";
import { Avatar, Chip, Modal } from "./ui";
import { IconCoffee, IconPhone } from "../lib/icons";
import { relOf } from "../game/relations";
import { romanticCapOf } from "../worlds/star2005/content";
import { StatBars, WorksChips, ProfileBasics, ProfileRelations, ProfileGroup, ProfileHero, RelTag, ResumeTimeline, StatEditor, ProfileMemory, relationRefsOf } from "./personFields";

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
  const { game, setRelValue, simContact, phoneExchange, busy } = useGame();
  const [exchange, setExchange] = useState<null | "ok" | "no">(null);
  const co = companyMeta(star.companyId);
  const roster = game?.sim.npcs ?? [];
  // 老存档兼容：ecosystem 字段（works/debutYear/partnerId/exId）可能缺失，全部给安全缺省
  const debutYear = star.debutYear ?? 2005;
  const works = (star.works ?? []).map((w) => MOVIE_TITLES[w % MOVIE_TITLES.length]);
  const uniqWorks = [...new Set(works)];

  // 履历时间线：出道 + 每部代表作按年份铺开（确定性派生，不调用 AI）
  const resume = [
    { year: debutYear, text: `以${star.dir}身份出道，签约${co.name}` },
    ...uniqWorks.map((t, i) => ({ year: Math.min(2005, debutYear + i + 1), text: `主演《${t}》` })),
  ].sort((a, b) => a.year - b.year);

  const RelName = ({ id, name }: { id: string; name: string }) => (
    <button onClick={() => onOpenStar(id)} className="font-semibold text-jade underline decoration-dotted underline-offset-2 hover:text-coral">{name}</button>
  );
  // 情感关系：统一取自人物关系网（圈内现任 / 前任、与主角的关系、明确设定的亲属），全部直接可见；花名册里的艺人可点开
  const rels = relationRefsOf(game, star.id);
  const relNode = (refs: FamilyRef[], none?: string) => refs.length ? (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {refs.map((r, i) => {
        const label = r.note ? `${r.name}（${r.note}）` : r.name;
        return r.id && roster.some((n) => n.id === r.id) ? <RelName key={i} id={r.id} name={label} /> : <span key={i}>{label}</span>;
      })}
    </span>
  ) : none;

  // 艺人即 NPC：与「人脉」人物资料同一套界面——名片 + 关系数值 / 基本资料 / 情感关系 / 代表作 / 八维 / 关系经营 / 履历
  const rx = game ? relOf(game.sim, star.id) : null;
  const romanceOn = game ? canRomance(game.sim, star.id) : false; // 不可攻略的艺人不展示心动
  const hasContact = (game?.phone?.contacts ?? []).includes(star.id);
  const tile = "flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98]";
  return (
    <Modal title={`${star.name} · 人物资料`} onClose={onClose} wide>
      <ProfileHero
        name={star.name}
        sub={`艺人 · ${star.dir}`}
        avatar={<Avatar name={star.name} size={96} square editable={false} />}
        tags={<>
          <RelTag text="同行" />
          <Chip tone="coral">名气 {star.fame}</Chip>
          <Chip tone="gold">{star.personality}</Chip>
          <Chip>{star.pref}</Chip>
        </>}
      >
        {rx && (
          <div className="space-y-1.5">
            {romanceOn && <StatEditor label="心动" hint="私下的悸动" tone="coral" value={rx.romantic} min={0} max={romanticCapOf(star.id)} onChange={(v) => setRelValue(star.id, "romantic", v)} />}
            <StatEditor label="信任" hint="私人信任" tone="jade" value={rx.trust} min={0} max={100} onChange={(v) => setRelValue(star.id, "trust", v)} />
          </div>
        )}
      </ProfileHero>

      <ProfileMemory pid={star.id} />
      <ProfileBasics values={{ 性别: star.gender, 年龄: undefined, 所属: <>{co.name} <span className="text-[11px] text-ink-soft">· 声望 {co.prestige}</span></> }} />
      <ProfileRelations values={{
        现任: relNode(rels.现任, "单身"),
        前任: relNode(rels.前任, "无公开记录"),
        父母: relNode(rels.父母), 子女: relNode(rels.子女), 其他: relNode(rels.其他),
      }} noParents={rels.noParents} />
      {uniqWorks.length > 0 && <ProfileGroup title="代表作"><div className="py-2"><WorksChips works={uniqWorks} /></div></ProfileGroup>}
      <ProfileGroup title="个人能力"><div className="py-2"><StatBars stats={star.stats} /></div></ProfileGroup>

      <ProfileGroup title="关系经营"><div className="grid grid-cols-2 gap-2 py-2.5">
        <button onClick={() => simContact(star.id, star.name)} disabled={busy} className={`${tile} bg-gradient-to-br from-coral/15 to-coral/5 hover:from-coral/25 disabled:cursor-wait disabled:opacity-50`}>
          <IconCoffee size={16} />
          <span className="text-[13px] font-bold text-coral">{busy ? "生成中…" : "私下联系"}</span>
          <span className="text-[11px] text-ink-soft">回暖心情</span>
        </button>
        {hasContact ? (
          <div className={`${tile} bg-jade/10`}>
            <IconPhone size={16} />
            <span className="text-[13px] font-bold text-jade">已有联系方式</span>
            <span className="text-[11px] text-ink-soft">去手机里找 TA</span>
          </div>
        ) : (
          <button onClick={() => setExchange(phoneExchange(star.id) ? "ok" : "no")} className={`${tile} bg-gradient-to-br from-jade/15 to-jade/5 hover:from-jade/25`}>
            <IconPhone size={16} />
            <span className="text-[13px] font-bold text-jade">交换联系方式</span>
            <span className="text-[11px] text-ink-soft">{exchange === "no" ? "TA 婉拒了，改天再试" : "微信 / 电话"}</span>
          </button>
        )}
      </div></ProfileGroup>
      <ProfileGroup title="履历"><ResumeTimeline items={resume.map((e) => ({ year: e.year, title: e.text }))} /></ProfileGroup>
    </Modal>
  );
}
