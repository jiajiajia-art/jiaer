import NpcProfile from "./NpcProfile";
import { useMemo, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { affinityLevel, Avatar, Chip, Modal, SectionHead } from "./ui";
import { IconHeart } from "../lib/icons";
import { canConfess, relOf } from "../game/relations";
import { ROMANCE_ARCS, arcView } from "../game/logic";
import { creditsOf, profileOf, resumeOf, romanticCapOf, type FamilyRef, type ResumeEvent } from "../worlds/star2005/content";
import { locOf } from "../game/mud";
import { isManager } from "../game/producer";
import { FAMILY_NPC_IDS } from "../game/family";
import { CreditsList, StatBars, WorksChips } from "./personFields";

/* 关系维度 → 语义色 */
const DIM_TONE: Record<string, string> = { 信任: "jade", 爱慕: "coral", 友善: "gold", 敌意: "danger", 好感: "jade", 心动: "coral", 私人信任: "jade", 近况心情: "gold" };
const TONE_VAR: Record<string, string> = { jade: "var(--jade)", coral: "var(--coral)", gold: "var(--gold)", danger: "var(--danger)", "ink-soft": "var(--ink-soft)" };
const UNKNOWN = "尚未得知";

/* 情感值可调行：− / 滑杆 / + ，实时写回引擎或情感印象轴 */
function StatEditor({ label, hint, tone, value, min, max, step = 5, onChange }: { label: string; hint?: string; tone: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const accent = TONE_VAR[tone] ?? "var(--coral)";
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const btn = "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line text-[15px] leading-none text-ink-soft transition hover:border-jade hover:text-jade active:scale-95 disabled:opacity-40";
  return (
    <div title={hint} className="flex items-center gap-2 py-0.5 text-[12.5px]">
      <span className="w-16 shrink-0 text-ink-soft">{label}</span>
      <button type="button" aria-label={`${label} 减`} className={btn} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>−</button>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-line/60"
        style={{ color: accent, accentColor: accent, height: "6px" }}
      />
      <button type="button" aria-label={`${label} 加`} className={btn} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>+</button>
      <span className="w-14 shrink-0 text-right font-medium tabular-nums" style={{ color: accent }}>{value}{max > 100 ? `/${max}` : ""}</span>
    </div>
  );
}

/* 统一字段行：标签 + 值（缺省显示「尚未得知」，不泄露后台真相） */
function Field({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === undefined || children === null || children === "" || (Array.isArray(children) && children.length === 0);
  return (
    <div className="flex gap-2 py-0.5 text-[13px]">
      <span className="w-16 shrink-0 text-ink-soft">{label}</span>
      <span className="min-w-0 flex-1 break-words text-ink">{empty ? <span className="text-ink-soft/70">{UNKNOWN}</span> : children}</span>
    </div>
  );
}

/* 统一分节：终端平铺分节标题 + 内容（无卡片外框） */
function Section({ title, code, children }: { title: string; code?: string; children: ReactNode }) {
  return (
    <section>
      <SectionHead code={code} cn={title} />
      {children}
    </section>
  );
}

export default function NpcTab() {
  const { game, commitGame, setNpcAvatar, setRelValue, setNpcDim, simConfess, simChooseArc, simConfirmDating, phoneExchange } = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [exchange, setExchange] = useState<null | "ok" | "no">(null);
  if (!game) return null;
  const s = game.sim;
  const hasContact = (pid: string) => (game.phone?.contacts ?? []).includes(pid);
  const npc = game.npcs.find((n) => n.id === sel);

  let profileModal: ReactNode = null;
  if (npc) {
    const pid = npc.id;
    const romanceEnabled = s.romanceEnabled?.[pid] !== false;
    const profile = profileOf(pid);
    const dead = profile?.status === "dead" || !!s.npcLives?.[pid]?.dead;
    const lv = affinityLevel(npc.affinity, FAMILY_NPC_IDS.includes(pid as (typeof FAMILY_NPC_IDS)[number]));
    const rx = relOf(s, pid);
    const isDating = s.dating === pid;
    const arc = ROMANCE_ARCS[pid];
    const view = arc ? arcView(s, pid) : null;
    const confess = canConfess(s, pid);
    // 常驻地点：内容池覆盖优先，否则由据点推导；未知则「尚未得知」
    const fam = profile?.family;

    // 性别：读内容池存的确定性数据；家人（无 profile）按父/母称谓落定，均无则留白
    const genderText: string | undefined =
      profile?.gender ?? (npc.relation === "父亲" ? "男" : npc.relation === "母亲" ? "女" : undefined);
    // 年龄：内容池存的数字优先，其次家人档案里的 age 字段，缺则不展示该行
    const ageDigits = String(npc.age ?? "").replace(/[^\d]/g, "");
    const ageText: string | undefined = profile?.age ? `${profile.age} 岁` : ageDigits ? `${ageDigits} 岁` : undefined;

    // 双亲：内容池没有其档案，故就地推导亲属关系——配偶=另一位家长，子女=玩家本人
    const isFamily = FAMILY_NPC_IDS.includes(pid as (typeof FAMILY_NPC_IDS)[number]);
    const otherParent = isFamily ? game.npcs.find((n) => n.id !== pid && FAMILY_NPC_IDS.includes(n.id as (typeof FAMILY_NPC_IDS)[number])) : undefined;
    const spouseRefs: FamilyRef[] | undefined = otherParent ? [{ id: otherParent.id, name: otherParent.name, note: npc.relation === "父亲" ? "妻子" : "丈夫" }] : fam?.spouse ? (Array.isArray(fam.spouse) ? fam.spouse : [fam.spouse]) : undefined;
    const childRefs: FamilyRef[] | undefined = isFamily ? [{ id: "__player__", name: game.player.name, note: "你" }] : fam?.children ? (Array.isArray(fam.children) ? fam.children : [fam.children]) : undefined;

    // 亲属引用渲染：命中花名册者可点击跳转，否则纯文本；带备注附注
    const refList = (refs?: FamilyRef[] | FamilyRef | null): ReactNode => {
      const arr = Array.isArray(refs) ? refs : refs ? [refs] : [];
      if (arr.length === 0) return undefined;
      return (
        <span className="flex flex-wrap gap-1.5">
          {arr.map((r, i) => {
            const label = r.note ? `${r.name}（${r.note}）` : r.name;
            // 主角本人：跳转到「人物档案」页签
            if (r.id === "__player__") {
              return (
                <button
                  key={i}
                  onClick={() => window.dispatchEvent(new CustomEvent("star:navtab", { detail: "sim" }))}
                  className="rounded-sm border border-dashed border-jade/50 px-2 py-0.5 text-[12px] text-jade transition hover:bg-jade/10"
                >
                  {label} ↗
                </button>
              );
            }
            const target = r.id ? game.npcs.find((n) => n.id === r.id) : undefined;
            return target ? (
              <button
                key={i}
                onClick={() => { setSel(target.id); setResumeOpen(false); }}
                className="rounded-sm border border-dashed border-jade/50 px-2 py-0.5 text-[12px] text-jade transition hover:bg-jade/10"
              >
                {label} ↗
              </button>
            ) : (
              <span key={i} className="rounded-sm border border-dashed border-line px-2 py-0.5 text-[12px] text-ink-soft">{label}</span>
            );
          })}
        </span>
      );
    };

    // 情感关系各行预渲染：无数据者返回 undefined，用于条件隐藏，避免整屏「尚未得知」
    const spouseRefsNode = refList(spouseRefs);
    const exNode = refList(profile?.ex);
    const parentsNode = refList(fam?.parents);
    const childRefsNode = refList(childRefs);

    // 头像右侧速调只用到 友善（自由轴，缺失以 0 兜底）
    const dimVal = (label: string) => npc.dims.find((x) => x.label === label)?.value ?? 0;

    profileModal = (
      <NpcProfile pid={pid} onClose={() => { setSel(null); setResumeOpen(false); setExchange(null); }}>
      <div className="mx-auto max-w-2xl">

        {/* ═══ 关系经营（仅在世；接通告改到「世界」当面洽谈） ═══ */}
        {dead ? (
          <Section code="BOND" title="关系经营">
            <p className="text-[13px] text-ink-soft">斯人已逝，档案就此封存。你只能在回忆与履历里与 TA 重逢。</p>
          </Section>
        ) : (
          <>
            <Section code="BOND" title="关系经营">
              {arc && <p className="mb-2 text-[11.5px] text-gold">固定角色 · 需长线经营</p>}
              {/* 交互联系方式：交换成功后开通「手机」私聊通道 */}
              {hasContact(pid) ? (
                <p className="mt-2 rounded-sm border border-dashed border-jade/50 bg-jade/5 py-2 text-center text-[12.5px] text-jade">
                  已交换联系方式 · 去「手机」微信/短信/电话找 TA
                </p>
              ) : (
                <button
                  onClick={() => setExchange(phoneExchange(pid) ? "ok" : "no")}
                  className="mt-2 w-full rounded-sm border border-dashed border-jade/60 py-2 text-[13px] font-medium text-jade transition hover:bg-jade/10"
                >
                  [ 交互联系方式 · 交换微信/电话 ]
                </button>
              )}

              {romanceEnabled && arc && view && (
                <div className="mt-3 border-t border-dashed border-line pt-3">
                  <p className="mb-2 text-[12px] text-ink-soft">专属状态「{view.buff}」· 需长线经营，火候到了自会水到渠成。</p>
                  {view.stage ? (
                    <div>
                      <p className="mb-1.5 text-[14px] font-bold text-ink">第 {view.stage.id} 段 · {view.stage.name}</p>
                      {view.locked ? (
                        <p className="rounded-sm border border-dashed border-danger/40 px-3 py-2 text-[13px] text-ink-soft">时机未到，你们的缘分还需要沉淀——继续经营名声与彼此的默契。</p>
                      ) : (
                        <div className="space-y-2">
                          {view.stage.choices.map((c, i) => (
                            <button key={i} onClick={() => simChooseArc(pid, i)} className="block w-full rounded-sm border border-dashed border-line p-3 text-left transition hover:border-coral hover:bg-coral/5">
                              <p className="text-[14px] font-medium text-ink">{c.label}</p>
                              <p className="mt-0.5 text-[12px] text-ink-soft">→ {c.result}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : isDating ? (
                    <p className="rounded-sm border border-dashed border-coral/50 px-3 py-3 text-center text-[14px] font-semibold text-coral">你与{npc.name}已确认关系 · 状态「{view.buff}」生效中</p>
                  ) : view.datingReady ? (
                    <button onClick={() => simConfirmDating(pid)} className="w-full rounded-sm border border-dashed border-coral bg-coral/10 py-3 text-sm font-semibold text-coral transition hover:bg-coral/20">[ 七段圆满 · 确认交往 ]</button>
                  ) : (
                    <p className="px-3 py-3 text-center text-[13px] text-ink-soft">剧情已推进完，但你们之间还差一点火候——再沉淀些名声与代表作，缘分自会成熟。</p>
                  )}
                </div>
              )}

              {romanceEnabled && !arc && (
                <div className="mt-3 border-t border-dashed border-line pt-3">
                  {isDating ? (
                    <p className="rounded-sm border border-dashed border-coral/50 px-3 py-2.5 text-center text-[13.5px] font-semibold text-coral">你与{npc.name}已确认关系 </p>
                  ) : (
                    <button
                      onClick={() => simConfess(pid, npc.name)}
                      disabled={!confess.ok}
                      className="w-full rounded-sm border border-dashed border-coral py-2.5 text-[13.5px] font-semibold text-coral transition hover:bg-coral/10 disabled:cursor-not-allowed disabled:border-line disabled:text-ink-soft disabled:opacity-60"
                    >
                      {confess.ok ? "[ 向 TA 表白心意 ]" : "表白：好感与心动需先到 60"}
                    </button>
                  )}
                </div>
              )}
            </Section>
          </>
        )}

        {/* ═══ 履历（默认不展开，点击打开弹窗） ═══ */}
        <button
          onClick={() => setResumeOpen(true)}
          className="mt-5 flex w-full items-center justify-between rounded-sm border border-dashed border-line px-4 py-3 text-left transition hover:border-jade"
        >
          <span className="text-[13px] font-bold text-ink">履历与互动记录</span>
          <span className="text-[12px] text-jade">查看 →</span>
        </button>

        {resumeOpen && <ResumeModal name={npc.name} pid={pid} onClose={() => setResumeOpen(false)} npc={npc} />}
        {exchange && (
          <Modal title="交换联系方式" onClose={() => setExchange(null)}>
            {exchange === "ok" ? (
              <p className="text-[14px] leading-relaxed text-ink">
                {npc.name}把联系方式给了你。到底部「<span className="font-semibold text-jade">手机</span>」里，就能随时用微信、短信或电话找 TA 了。
              </p>
            ) : (
              <p className="text-[14px] leading-relaxed text-ink-soft">
                {npc.name}婉拒了——似乎还没到能交换联系方式的交情。多相处、把好感养起来，再试一次吧。
              </p>
            )}
          </Modal>
        )}
      </div>
      </NpcProfile>
    );
  }

  // 人脉同时展示已登场与未登场人物；未登场人物只展示公开的地点与解锁提示。
  const roster = game.npcs;
  const known = roster.filter((n) => s.metPeople.includes(n.id));
  const unknown = roster.filter((n) => !s.metPeople.includes(n.id));

  // 分类：制作人 / 圈内艺人 / 其他（依据 isManager 与身份关键词，皆来自内容池，前端只做归类）
  const ENTERTAINER = /演员|歌手|艺人|明星|偶像|模特|主持|练习生|新人/;
  const bucketOf = (n: (typeof roster)[number]): "family" | "producer" | "star" | "other" => {
    if (FAMILY_NPC_IDS.includes(n.id as (typeof FAMILY_NPC_IDS)[number])) return "family";
    if (isManager(n.id)) return "producer";
    const tags = (profileOf(n.id)?.tags ?? []).join(" ");
    if (ENTERTAINER.test(`${n.identity} ${n.relation} ${tags}`)) return "star";
    return "other";
  };
  const CATS: { key: "family" | "producer" | "star" | "other"; label: string }[] = [
    { key: "family", label: "家人 · 双亲" },
    { key: "producer", label: "制作人 · 片场负责人" },
    { key: "star", label: "圈内艺人" },
    { key: "other", label: "其他往来" },
  ];
  const grouped = CATS.map((c) => ({
    ...c,
    people: known.filter((n) => bucketOf(n) === c.key).sort((a, b) => b.affinity - a.affinity),
  })).filter((g) => g.people.length > 0);

  const Card = ({ n, locked = false }: { n: (typeof roster)[number]; locked?: boolean }) => {
    const isFam = FAMILY_NPC_IDS.includes(n.id as (typeof FAMILY_NPC_IDS)[number]);
    const lv = affinityLevel(n.affinity, isFam);
    const dead = profileOf(n.id)?.status === "dead";
    const dating = s.dating === n.id;
    const pct = Math.max(0, Math.min(100, n.affinity));
    const person = profileOf(n.id);
    const place = person?.whereabouts ?? locOf(person?.home ?? "")?.name ?? "地点未公开";
    const unlock = person?.requires?.length ? person.requires.map((r: any) => r.hint ?? r.note ?? "满足指定条件").join(" · ") : "前往对应地点即可初遇";
    // 好感度着色：随亲疏由珊瑚过渡到暖金
    return (
      <button
        onClick={() => !locked && setSel(n.id)}
        className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left shadow-sm backdrop-blur-sm transition-all duration-200 ${locked ? "cursor-default border-dashed border-line/70 bg-paper/35" : "border-line bg-paper-2/55 hover:-translate-y-0.5 hover:border-jade/60 hover:bg-paper-2/80 hover:shadow-[0_10px_24px_-14px_var(--dream-glow,rgba(0,0,0,0.35))]"}`}
      >
        {/* 简洁圆角头像；已故人物灰化。 */}
        <div className="relative shrink-0">
          <div className={`${dead || locked ? "opacity-45 grayscale" : ""} [&>div]:bg-none [&>div]:bg-jade/5 [&>div]:shadow-none [&>div]:ring-0`}>
            <Avatar src={locked ? "" : n.avatar} name={locked ? "?" : n.name} size={46} editable={false} />
          </div>
          {dating && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-coral text-white shadow ring-2 ring-paper-2">
              <IconHeart width={9} height={9} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14.5px] font-bold text-ink">{locked ? "未登场人物" : n.name}</p>
            {locked ? <Chip>未登场</Chip> : dead ? <Chip tone="danger">已故</Chip> : <Chip tone={lv.tone}>{lv.text}</Chip>}
          </div>
          <p className="mt-0.5 mb-1 truncate text-[11.5px] text-ink-soft">{locked ? `${place} · 初遇条件未满足` : `${n.identity || "—"} · ${n.relation || "—"}`}</p>
          {locked && <p className="mb-2 line-clamp-1 text-[10.5px] text-gold">{unlock}</p>}
          {/* 好感度：细圆角进度条 + 数值 */}
          {!locked && <div className="flex items-center gap-2">
            <IconHeart width={12} height={12} className="shrink-0 text-coral" />
            <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-soft/15">
              <span
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${n.affinity < 0 ? "bg-danger/70" : "bg-gradient-to-r from-coral to-gold"}`}
                style={{ width: `${n.affinity < 0 ? 100 : pct}%` }}
              />
            </span>
            <span className="w-7 shrink-0 text-right text-[11px] font-medium tabular-nums text-ink-soft">{n.affinity}</span>
          </div>}
        </div>

        {/* 右侧微光箭头 */}
        {!locked && <span className="shrink-0 self-center text-ink-soft/40 transition group-hover:translate-x-0.5 group-hover:text-jade">›</span>}
      </button>
    );
  };

  // 分类配色：家人金、制作人主色、艺人珊瑚、其他中性
  const CAT_TONE: Record<string, string> = { family: "text-gold", producer: "text-jade", star: "text-coral", other: "text-ink-soft" };

  return (
    <div className="w-full pb-5">
      {profileModal}

      <div className="mx-auto max-w-2xl px-4 pt-3">
      {known.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-2/40 px-4 py-10 text-center">
          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-ink-soft/10 text-ink-soft/60"><IconHeart width={22} height={22} /></span>
          <p className="text-[13px] text-ink-soft">还没结识任何人。<br />到各处走走、与人搭话，认识的人才会记入人脉。</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <section key={g.key}>
              <div className="mb-2.5 flex items-center gap-2">
                <span className={CAT_TONE[g.key] ?? "text-jade"}>▌</span>
                <span className="text-[13px] font-bold text-ink">{g.label}</span>
                <span className={`rounded-full bg-ink-soft/10 px-1.5 py-px text-[10.5px] font-semibold tabular-nums ${CAT_TONE[g.key] ?? "text-ink-soft"}`}>{g.people.length}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {g.people.map((n) => <Card key={n.id} n={n} />)}
              </div>
            </section>
          ))}
        </div>
      )}
      {unknown.length > 0 && <section className="mt-6"><div className="mb-2.5 flex items-center gap-2"><span className="text-ink-soft">▌</span><span className="text-[13px] font-bold text-ink">未登场人物</span><span className="rounded-full bg-ink-soft/10 px-1.5 py-px text-[10.5px] font-semibold text-ink-soft">{unknown.length}</span><span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" /></div><div className="grid gap-2.5 sm:grid-cols-2">{unknown.map((n) => <Card key={n.id} n={n} locked />)}</div></section>}
      </div>
    </div>
  );
}

/* ═══════════════ 履历弹窗：静态生平（可筛选）+ 游戏内互动记录 ═══════════════
 * 生平履历取自内容池，只读、确定性——筛选只做前端过滤，不产生任何新事件、不调用 AI。 */
function ResumeModal({ name, pid, onClose, npc }: { name: string; pid: string; onClose: () => void; npc: { affinityHistory: { turn: number; delta: number; reason: string }[]; interactions: { turn: number; time: string; text: string }[] } }) {
  const all = resumeOf(pid);
  const known = all.filter((e) => !e.hidden); // hidden=后台存在但玩家尚未得知
  const hiddenCount = all.length - known.length;
  const [year, setYear] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const years = useMemo(() => Array.from(new Set(known.map((e) => e.year))).sort((a, b) => a - b), [known]);
  const months = useMemo(() => Array.from(new Set(known.filter((e) => e.month != null).map((e) => e.month!))).sort((a, b) => a - b), [known]);
  const types = useMemo(() => Array.from(new Set(known.map((e) => e.type))), [known]);

  const filtered = useMemo(() => {
    const list = known.filter(
      (e) =>
        (year === "all" || e.year === Number(year)) &&
        (month === "all" || e.month === Number(month)) &&
        (type === "all" || e.type === type),
    );
    return list.slice().sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0));
  }, [known, year, month, type]);

  const filtering = year !== "all" || month !== "all" || type !== "all";
  const selCls = "rounded-sm border border-dashed border-line bg-paper px-2 py-1 text-[12px] text-ink transition hover:border-jade/60";

  return (
    <Modal title={`${name} · 履历`} onClose={onClose} wide>
      {/* 生平履历 */}
      <SectionHead code="RESUME" cn="生平履历" right={<span className="text-[11px] tabular-nums text-ink-soft">{filtered.length} 条</span>} />
      {all.length === 0 ? (
        <p className="border-l border-line px-3 py-2.5 text-[13px] text-ink-soft/70">{UNKNOWN}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <select value={year} onChange={(e) => setYear(e.target.value)} className={selCls} aria-label="按年份筛选">
              <option value="all">全部年份</option>
              {years.map((y) => <option key={y} value={y}>{y} 年</option>)}
            </select>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={selCls} aria-label="按月份筛选">
              <option value="all">全部月份</option>
              {months.map((m) => <option key={m} value={m}>{m} 月</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className={selCls} aria-label="按类型筛选">
              <option value="all">全部类型</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {filtered.length === 0 ? (
            <p className="border-l border-line px-3 py-2.5 text-[13px] text-ink-soft">该筛选下没有记录。</p>
          ) : (
            <ol className="relative space-y-3 border-l border-line pl-4">
              {filtered.map((e, i) => (
                <ResumeRow key={i} e={e} />
              ))}
            </ol>
          )}
          {hiddenCount > 0 && !filtering && (
            <p className="mt-3 border-l border-dashed border-line px-3 py-2 text-[12.5px] text-ink-soft/70">
              尚未得知 · 还有 {hiddenCount} 段往事，等你与 TA 相知更深后揭晓。
            </p>
          )}
        </>
      )}

      {/* 游戏内互动记录（确定性存档，非 AI 现编） */}
      <SectionHead code="LOG" cn="互动记录" right={<span className="text-[11px] tabular-nums text-ink-soft">{npc.interactions.length} 条</span>} />
      {npc.interactions.length ? (
        <ol className="relative space-y-2.5 border-l border-line pl-4">
          {[...npc.interactions].reverse().map((it, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-coral" />
              <p className="text-[11px] tabular-nums text-ink-soft">{it.time} · 第 {it.turn} 回合</p>
              <p className="text-[13.5px] text-ink">{it.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border-l border-line px-3 py-2.5 text-[13px] text-ink-soft">尚无互动。</p>
      )}

      {npc.affinityHistory.length > 0 && (
        <>
          <SectionHead code="AFFINITY" cn="好感变动" />
          <div className="space-y-1.5">
            {[...npc.affinityHistory].reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-2 border-l border-dashed border-line px-3 py-1.5 text-[12.5px]">
                <span className={`font-bold tabular-nums ${h.delta > 0 ? "text-jade" : "text-danger"}`}>{h.delta > 0 ? "+" : ""}{h.delta}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">第 {h.turn} 回合</span>
                <span className="truncate text-ink">{h.reason}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function ResumeRow({ e }: { e: ResumeEvent }) {
  return (
    <li className="relative">
      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-jade" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-ink-soft">{e.year} 年{e.month ? ` · ${e.month} 月` : ""}</span>
        <Chip tone="jade">{e.type}</Chip>
      </div>
      <p className="mt-0.5 text-[14px] font-medium text-ink">{e.title}</p>
      {e.detail && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{e.detail}</p>}
    </li>
  );
}

