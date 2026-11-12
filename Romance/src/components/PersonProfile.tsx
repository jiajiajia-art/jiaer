import { npcFactionOf, setNpcFaction, syncFactions } from "../game/factions";
import { useState } from "react";
import { relOf, canConfess } from "../game/relations";
import { canRomance, romanceFixedOff, isFamilyNpc, hasPartner } from "../game/logic";
import { romanticCapOf } from "../worlds/star2005/content";
import { ageLabel, moodLine, ownField } from "@/lib/npcIdentity";
import { useGame } from "../store/gameCtx";
import { Chip, Modal } from "./ui";
import { feature, LIVE_PERSON_BY_ID as PERSON_BY_ID, worldPersonById as profileOf } from "../mods/registry";
import { IconHeart, IconScroll, IconSend, IconVolume } from "../lib/icons";
import { speakOut, voiceOf } from "./phone/screenShare";
import {
  ActionTile,
  BondMeterRow,
  ProfileGroup,
  ProfileRelations,
  ProfileTabs,
  StatBars,
  affiliationOf,
  relationRefsOf,
} from "./personFields";

/**
 * 功能注释：人物档案弹窗主体——上下两块，色/描边/圆角一律读皮肤变量。
 * 上：头像 + 名 + 可攻略 + 身份标签 + 爱慕/好感；下：资料 / 情感 页签。
 */
export default function PersonProfile({ pid, name, known = true }: { pid: string; name?: string; known?: boolean }) {
  const { game, commitGame, setRomanceable, setRelValue, simContact, simConfess, busy } = useGame();
  const [resumeHint, setResumeHint] = useState(false);
  if (!game) return null;
  const s = game.sim;
  const wp = PERSON_BY_ID[pid];
  const profile = profileOf(pid);
  const n = game.npcs.find((x) => x.id === pid);
  const nm = name ?? n?.name ?? wp?.name ?? "";
  const aff = n?.affinity ?? s.rel?.[pid] ?? 0;
  const rom = relOf(s, pid).romantic;
  const cap = romanticCapOf(pid) || 100;
  const gender = n?.persona?.gender ?? wp?.gender;
  const age = ageLabel(ownField(n, "age", wp?.age ? String(wp.age) : undefined));
  const avatar = known ? n?.avatar : undefined;
  const bio = ownField(n, "bio", n?.persona?.text?.trim() || wp?.bio);
  const affil = affiliationOf(n?.identity) || (n?.identity || wp?.role);
  const tags = [gender, affil].filter(Boolean) as string[];
  // 功能注释：所属势力只读作者在人物卡选的真实势力，不从身份文字推断
  const fac = npcFactionOf(pid, wp?.factionId);
  const catchphrase = known ? wp?.catchphrase?.trim() : undefined;
  const factionList = (game?.factions ?? []).filter((f) => f.name?.trim());
  const romanceOn = canRomance(s, pid);
  const romanceFixed = romanceFixedOff(s, pid);
  const family = isFamilyNpc(pid);
  const bound = hasPartner(s, pid) || !!s.spouses?.includes(pid);
  const rels = relationRefsOf(game, pid);
  const stats = (profile?.stats ?? (n as { stats?: Record<string, number> } | undefined)?.stats) as Record<string, number> | undefined;
  const confess = canConfess(s, pid);
  // 功能注释：未添加「关系玩法」包时不展示表白入口
  const relationsPlayOn = feature("relationsPlay");

  const toggleRomance = () => {
    if (romanceFixed || (romanceOn && bound)) return;
    setRomanceable(pid, !romanceOn);
  };

  if (!known) {
    return (
      <div className="flex flex-col gap-3 pt-1">
        <section className="rounded-[var(--radius-ui-lg)] border border-line bg-paper p-3.5 shadow-[var(--shadow-ui)]">
          <div className="flex items-start gap-3.5">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-ui)] border border-line bg-paper-2">
              <p className="font-serif text-[28px] font-black text-coral">?</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[22px] font-black text-ink">陌生人</p>
              <Chip tone="gold">尚未结识</Chip>
            </div>
          </div>
        </section>
        <p className="rounded-[var(--radius-ui)] border border-line bg-paper/70 px-3.5 py-2.5 text-[13px] leading-[22px] text-ink/85">
          还不认识这个人。上前搭话，也许能知道更多。
        </p>
      </div>
    );
  }

  const refText = (refs: ReturnType<typeof relationRefsOf>["现任"]) => {
    if (!refs.length) return undefined;
    return refs.map((r) => (r.note ? `${r.name}（${r.note}）` : r.name)).join("、");
  };

  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* ═══ 上块：人物卡 ═══ */}
      <section className="rounded-[var(--radius-ui-lg)] border border-line bg-paper p-3.5 shadow-[var(--shadow-ui)]">
        <div className="flex items-start gap-3.5">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-ui)] border border-line bg-paper-2">
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <p className="font-serif text-[28px] font-black text-coral">{nm.slice(0, 1)}</p>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 truncate font-serif text-[22px] font-black leading-tight text-ink">{nm}</p>
              {/* 可攻略开关：跟在名字右侧，皮肤选中色 */}
              {romanceFixed ? (
                <Chip>{family ? "亲情" : "恒不可攻略"}</Chip>
              ) : (
                <label className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-bold text-ink">
                  <IconHeart width={13} height={13} className={romanceOn ? "text-coral" : "text-ink-soft"} aria-hidden />
                  <span>可攻略</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={romanceOn}
                    aria-label="可攻略"
                    disabled={romanceOn && bound}
                    onClick={toggleRomance}
                    className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${romanceOn ? "bg-coral" : "bg-line"}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-paper shadow transition-transform ${romanceOn ? "translate-x-4" : ""}`} />
                  </button>
                </label>
              )}
            </div>
            {/* 功能注释：常用语——名字下方一句口头禅，点小喇叭用该人物音色朗读 */}
            {catchphrase && (
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <p className="min-w-0 truncate text-[12.5px] italic text-ink-soft">「{catchphrase}」</p>
                <button
                  type="button"
                  onClick={() => speakOut(catchphrase, gender, pid, n?.persona?.ttsVoice || voiceOf(pid))}
                  aria-label="朗读常用语"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-coral transition hover:bg-coral/10"
                >
                  <IconVolume width={14} height={14} aria-hidden />
                </button>
              </div>
            )}
            {/* 功能注释：作品有势力时显示并允许玩家自由修改；改动写进存档，对话 / 事件条件 / 资料同步生效 */}
            {factionList.length > 0 && (
              <label className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                <span className="shrink-0 font-semibold">所属势力</span>
                <select
                  value={fac?.id ?? ""}
                  aria-label="所属势力"
                  onChange={(e) => {
                    const next = setNpcFaction(game, pid, e.target.value || null);
                    syncFactions(next);
                    commitGame(next);
                  }}
                  className={`min-w-0 max-w-[12rem] truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${fac ? "border-jade/40 bg-jade/10 text-jade" : "border-line bg-paper-2 text-ink-soft"}`}
                >
                  <option value="">无所属</option>
                  {factionList.map((f) => <option key={f.id} value={f.id}>{f.name || "（未命名势力）"}</option>)}
                </select>
              </label>
            )}
            {tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2.5 space-y-0.5 border-t border-line/70 pt-2">
              <BondMeterRow
                label="好感"
                value={aff}
                pct={((aff + 100) / 200) * 100}
                min={-100}
                max={100}
                bipolar
                onChange={(v) => setRelValue(pid, "friendship", v)}
              />
              {romanceOn ? (
                <BondMeterRow
                  label="爱慕"
                  value={rom}
                  pct={(rom / cap) * 100}
                  min={0}
                  max={cap}
                  onChange={(v) => setRelValue(pid, "romantic", v)}
                />
              ) : (
                <div className="flex items-center gap-2 py-1 text-[12px] text-ink-soft">
                  <span className="w-8 shrink-0 font-bold text-ink">爱慕</span>
                  <span>{romanceFixed ? (family ? "亲情 · 家人" : "子女亲情") : "不可攻略"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 下块：资料 / 情感 ═══ */}
      <section className="rounded-[var(--radius-ui-lg)] border border-line bg-paper p-3 shadow-[var(--shadow-ui)]">
        <ProfileTabs
          tabs={[
            {
              id: "info",
              label: "资料",
              body: (
                <div>
                  {bio ? <p className="mb-3 text-[13px] leading-relaxed text-ink/85">{bio}</p> : null}
                  {/* 只有带能力数值的人物（艺人等）才展示个人能力；普通 NPC 没有这套数值，不显示一排空条 */}
                  {stats && Object.values(stats).some((v) => typeof v === "number") ? (
                    <ProfileGroup title="个人能力">
                      <div className="py-2">
                        <StatBars stats={stats} />
                      </div>
                    </ProfileGroup>
                  ) : null}
                </div>
              ),
            },
            {
              id: "heart",
              label: "情感",
              body: (
                <div>
                  <ProfileRelations
                    values={{
                      现任: refText(rels.现任),
                      父母: refText(rels.父母),
                      子女: refText(rels.子女),
                    }}
                    noParents={rels.noParents}
                  />
                  <ProfileGroup title="关系经营">
                    <div className={`grid grid-cols-1 gap-2 py-2.5 ${relationsPlayOn ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                      <ActionTile
                        icon={IconSend}
                        tone="coral"
                        title={busy ? "生成中…" : "私下联系"}
                        sub="约 TA 单独见面聊聊"
                        onClick={() => simContact(pid, nm)}
                        disabled={busy}
                      />
                      <ActionTile
                        icon={IconScroll}
                        title="履历"
                        sub="生平往来"
                        onClick={() => setResumeHint(true)}
                      />
                      {relationsPlayOn && (
                        <ActionTile
                          icon={IconHeart}
                          tone="coral"
                          title="表白"
                          sub="与TA关系更进一步"
                          onClick={() => {
                            if (confess.ok) simConfess(pid, nm);
                          }}
                          disabled={!confess.ok || busy || !romanceOn}
                        />
                      )}
                    </div>
                  </ProfileGroup>
                  {n?.mood != null && (
                    <p className="mt-1 text-[12px] text-ink-soft">{moodLine({ mood: n.mood, affinity: aff })}</p>
                  )}
                </div>
              ),
            },
          ]}
        />
      </section>

      {resumeHint && (
        <Modal panelClassName="ui-dialog-game" title={`${nm} · 履历`} onClose={() => setResumeHint(false)}>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            更完整的生平与互动记录，请到「人脉」页打开 {nm} 的档案查看。
          </p>
        </Modal>
      )}
    </div>
  );
}
