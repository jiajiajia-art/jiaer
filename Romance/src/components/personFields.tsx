import { IconBook, IconExternal, IconThought, IconHeart, IconHome, IconSpark, IconUsers } from "../lib/icons";
/* 人物档案·统一字段块——「人脉」与「艺人」两处详情共用同一套字段，
 * 保证每个人展示的属性集合一致（缺省一律显示占位，不会这人有那人没有）。
 * 纯展示、确定性，不调用 AI。 */
import { useState, type ReactNode } from "react";
import { STAT_LABELS, STAT_ORDER } from "../game/data";
import { looksTier, npcLooksFromStats } from "../game/logic";
import { BlockBar, Chip, Modal } from "./ui";
import { useGame } from "../store/gameCtx";
import { kbOf, type KbMem } from "../game/npcKnowledge";
import { gameTimeLabel } from "../game/phone";
import { relationsOf } from "../game/relNet";
import type { GameState } from "../lib/types";
import type { Credit, FamilyRef } from "../worlds/star2005/content";

const UNKNOWN = "尚未得知";

/* 八维能力：有数值则画条，缺省整齐地显示「尚未得知」——字段永远齐全 */
export function StatBars({ stats }: { stats?: Record<string, number> | null }) {
  const looks = stats ? npcLooksFromStats(stats) : undefined;
  if (!stats || !Object.keys(stats).length)
    return <p className="text-[12.5px] text-ink-soft/70">{["容貌", ...STAT_ORDER.map((k) => STAT_LABELS[k])].join(" · ")} —— {UNKNOWN}</p>;
  const rows: [string, number | undefined][] = [["容貌", looks], ...STAT_ORDER.map((k) => [STAT_LABELS[k], stats?.[k]] as [string, number | undefined])];
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {rows.map(([label, v]) => (
        <div key={label} className="flex items-center justify-between rounded-xl border border-line/65 bg-paper px-3 py-1.5 text-[12.5px] shadow-[0_2px_8px_-6px_rgba(0,0,0,0.2)]">
          <span className="font-medium text-ink-soft">{label}</span>
          <span className={`font-serif text-[14px] font-extrabold tabular-nums ${v === undefined ? "text-ink-soft/60" : "text-ink"}`}>{v ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

/* 亲属/主演引用：命中花名册者可点击跳转，否则纯文本（附备注） */
function RefName({ r, onOpenPerson }: { r: FamilyRef; onOpenPerson?: (id: string) => void }) {
  const label = r.note ? `${r.name}（${r.note}）` : r.name;
  if (r.id && onOpenPerson)
    return (
      <button onClick={() => onOpenPerson(r.id!)} className="text-jade underline decoration-dotted underline-offset-2 transition hover:text-coral">
        {label} <IconExternal size={10} />
      </button>
    );
  return <span className="text-ink">{label}</span>;
}

/* 作品详情弹窗：角色分工 + 剧情 + 主演联动（确定性静态数据，不调用 AI） */
export function WorkModal({ credit, onOpenPerson, onClose }: { credit: Credit; onOpenPerson?: (id: string) => void; onClose: () => void }) {
  const c = credit;
  return (
    <Modal title={`《${c.title}》`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip tone="jade">{c.role}</Chip>
        {c.genre && <Chip>{c.genre}</Chip>}
        {c.year && <Chip tone="gold">{c.year} 年</Chip>}
      </div>
      {c.synopsis && (
        <>
          <p className="mb-1.5 text-[12px] font-bold tracking-[0.2em] text-jade">▌剧情</p>
          <p className="story-prose mb-4 text-[13.5px] leading-relaxed text-ink/90">{c.synopsis}</p>
        </>
      )}
      {(c.lead || (c.costars?.length ?? 0) > 0) && (
        <>
          <p className="mb-1.5 text-[12px] font-bold tracking-[0.2em] text-jade">▌主演</p>
          <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
            {c.lead && <RefName r={c.lead} onOpenPerson={onOpenPerson} />}
            {c.costars?.map((r, i) => <RefName key={i} r={r} onOpenPerson={onOpenPerson} />)}
          </div>
        </>
      )}
      {c.note && <p className="text-[12px] italic text-ink-soft">{c.note}</p>}
    </Modal>
  );
}

/* 详版代表作：可点击的作品条，点开看剧情/主演；区分执导与主演由内容池 role 决定 */
export function CreditsList({ credits, onOpenPerson }: { credits: Credit[]; onOpenPerson?: (id: string) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  if (!credits.length) return <span className="text-[13px] text-ink-soft/70">暂无</span>;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {credits.map((c, i) => (
          <button
            key={i}
            onClick={() => setSel(i)}
            className="rounded-sm border border-dashed border-coral/50 px-2.5 py-1 text-[12.5px] text-coral transition hover:bg-coral/10"
          >
            《{c.title}》<span className="ml-1 text-[10px] text-ink-soft">{c.role}</span>
          </button>
        ))}
      </div>
      {sel !== null && <WorkModal credit={credits[sel]} onOpenPerson={onOpenPerson} onClose={() => setSel(null)} />}
    </>
  );
}

/* 代表作：去重后铺开；无则「暂无」 */
export function WorksChips({ works, plain }: { works: string[]; plain?: boolean }) {
  const uniq = [...new Set(works)];
  return (
    <div className="flex flex-wrap gap-2">
      {uniq.length ? (
        uniq.map((t) => (
          <Chip key={t} tone="coral">
            {plain ? t : `《${t}》`}
          </Chip>
        ))
      ) : (
        <span className="text-[13px] text-ink-soft/70">暂无</span>
      )}
    </div>
  );
}

/* ═══ 统一人物资料块 ═══
 * 游戏里所有「人物资料」（人脉详情 / 艺人资料 / 场景里的履历详情）都用这一套：
 * 分组与字段顺序固定，任何人缺哪项都显示「尚未得知」，不会这人有那人没有。 */
export const BASIC_FIELDS = ["职业", "性别", "年龄", "所属", "与你"] as const;
export const RELATION_FIELDS = ["现任", "前任", "父母", "子女", "其他"] as const;
type BasicKey = (typeof BASIC_FIELDS)[number];
type RelationKey = (typeof RELATION_FIELDS)[number];

const isEmpty = (v: ReactNode) => v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0);

export function ProfileRow({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-dashed border-line/60 py-2 text-[13px] last:border-b-0">
      <span className="w-12 shrink-0 text-[11.5px] font-semibold tracking-wider text-ink-soft">{label}</span>
      <span className="min-w-0 flex-1 break-words text-ink">{isEmpty(children) ? <span className="text-ink-soft/70">{UNKNOWN}</span> : children}</span>
    </div>
  );
}

export function ProfileGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <p className="mb-2 flex items-center gap-2 px-0.5 font-serif text-[13.5px] font-bold tracking-[0.12em] text-ink">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-[10px] text-white shadow-sm"></span>
        {title}
        <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
      </p>
      <div className="rounded-2xl border border-line bg-paper-2/80 px-3.5 py-1.5 shadow-[0_6px_18px_-14px_rgba(80,60,140,0.45)]">{children}</div>
    </section>
  );
}

/* 基本资料：两列小卡片，短字段并排，「与你」这类长文案独占一行 */
export function ProfileBasics({ values }: { values: Partial<Record<BasicKey, ReactNode>> }) {
  // 属性：两列描边小卡（职业 / 与你 已在顶部名片展示，这里不重复）
  return (
    <section className="mb-4">
      <p className="mb-1.5 text-[13px] font-bold text-coral">属性</p>
      <div className="grid grid-cols-2 gap-2">
        {BASIC_FIELDS.filter((k) => k !== "职业" && k !== "与你").map((k) => (
          <div key={k} className="flex min-h-[48px] items-center gap-1.5 rounded-2xl border border-coral/30 bg-paper-2 px-3 py-2 text-[13px]">
            <span className="shrink-0 text-ink-soft">{k}</span>
            <b className="min-w-0 flex-1 break-words font-bold text-ink">{isEmpty(values[k]) ? <span className="font-normal text-ink-soft/60">{UNKNOWN}</span> : values[k]}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

/* 情感关系：现任 / 前任 / 父母 / 子女 四格固定，「其他」有记录时整行展示；确无记录的格子淡显「暂无记录」——与「属性」同一套小卡样式。
 * 父母分三态：明确设定的人物 / 明确设定没有父母（noParents）/ 未设定（「未知」） */
const NO_RELATION = "暂无记录";
/** 功能注释：关系类型用线性图标区分，禁止装饰字符 */
const RELATION_ICON: Record<RelationKey, ReactNode> = {
  现任: <IconHeart size={12} />,
  前任: <IconHeart size={12} className="opacity-50" />,
  父母: <IconHome size={12} />,
  子女: <IconSpark size={12} />,
  其他: <IconUsers size={12} />,
};
export function ProfileRelations({ values, noParents }: { values: Partial<Record<RelationKey, ReactNode>>; noParents?: boolean }) {
  return (
    <section className="mb-4">
      <p className="mb-1.5 text-[13px] font-bold text-coral">情感关系</p>
      <div className="grid grid-cols-2 gap-2">
        {RELATION_FIELDS.filter((k) => k !== "其他" || !isEmpty(values[k])).map((k) => {
          const empty = isEmpty(values[k]);
          const none = k !== "父母" ? NO_RELATION : noParents ? "无（已明确设定）" : "未知";
          return (
            <div key={k} className={`flex min-h-[56px] flex-col justify-center gap-0.5 rounded-2xl border px-3 py-2 ${k === "其他" ? "col-span-2" : ""} ${empty ? "border-dashed border-line bg-paper-2/50" : "border-coral/30 bg-paper-2"}`}>
              <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                <span className={empty ? "text-ink-soft/60" : "text-coral"}>{RELATION_ICON[k]}</span>
                {k}
              </span>
              <span className="min-w-0 break-words text-[13px] font-bold leading-snug text-ink">
                {empty ? <span className="font-normal text-ink-soft/60">{none}</span> : values[k]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* 情感关系汇总（人脉详情 / 场景人物资料 / 艺人资料共用）：统一取自人物关系网（game/relNet），
 * 只列明确设定、且对方真实存在的人物，不按姓氏 / 称谓 / 常识推导。noParents = 明确设定了没有父母（区别于「未知」）。 */
export { PLAYER_REF } from "../game/relNet";
export function relationRefsOf(game: GameState | null | undefined, pid: string): Record<RelationKey, FamilyRef[]> & { noParents: boolean } {
  const r = relationsOf(game, pid);
  const refs = (k: RelationKey): FamilyRef[] => r[k].map((x) => ({ id: x.id, name: x.name, ...(x.note ? { note: x.note } : {}) }));
  return { 现任: refs("现任"), 前任: refs("前任"), 父母: refs("父母"), 子女: refs("子女"), 其他: refs("其他"), noParents: r.noParents };
}

/* 所属：从身份文案里取「某某公司 / 事务所 / 工作室」等机构名，取不到则留空（显示尚未得知） */
export function affiliationOf(identity?: string): string | undefined {
  const m = (identity ?? "").match(/[一-龥A-Za-z]{2,12}(事务所|传媒|影业|娱乐|工作室|公司|集团|剧团|电视台|学院)/);
  return m?.[0];
}

/* 统一人物名片：所有人物资料弹窗共用的头部（渐变底 + 光环头像 + 名字 + 身份 + 标签），children 放名片内的附加区（如情感调节） */
export function ProfileHero({ name, sub, avatar, avatarSrc, tags, dim, children, action, facts, badge, aside }: { badge?: ReactNode; aside?: ReactNode; name: string; facts?: Record<string, ReactNode>; sub?: ReactNode; avatar?: ReactNode; avatarSrc?: string; tags?: ReactNode; dim?: boolean; children?: ReactNode; action?: ReactNode }) {
  const fs = facts ? Object.entries(facts).filter(([, v]) => !isEmpty(v)) : [];
  return (
    <section className="relative mb-4 overflow-hidden rounded-[22px] border border-line/80 bg-gradient-to-br from-[var(--jade)]/14 via-paper to-[var(--coral)]/16 p-4 shadow-[0_12px_30px_-18px_rgba(120,90,200,0.35)]">
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-coral/15 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-jade/15 blur-2xl" />
      <div className="relative flex items-start gap-3.5">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className={`relative rounded-[18px] bg-gradient-to-br from-[var(--coral)] via-[var(--gold)] to-[var(--jade)] p-[2px] shadow-[0_8px_20px_-10px_rgba(200,90,130,0.6)] ${dim ? "opacity-60 grayscale" : ""}`}>
            <div className="rounded-[16px] bg-paper p-[2px]">
              {avatar ?? (avatarSrc
                ? <img src={(avatarSrc) || undefined} alt={name} className="h-[68px] w-[68px] rounded-[14px] object-cover object-top" />
                : <span className="grid h-[68px] w-[68px] place-items-center rounded-[14px] bg-gradient-to-br from-jade/25 to-coral/25 font-serif text-[26px] font-black text-ink/70">{name.charAt(0)}</span>)}
            </div>
            {badge != null && (
              <span className="absolute -left-2 -top-2 grid h-7 w-7 place-items-center">
                <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full drop-shadow-[0_2px_4px_rgba(200,60,110,0.45)]" aria-hidden><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.2 0 3.6 1.3 5.4 3.3 1.8-2 3.2-3.3 5.4-3.3 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21z" fill="var(--coral)" stroke="#fff" strokeWidth="1.4" /></svg>
                <span className="relative -mt-0.5 text-[10px] font-black tabular-nums text-white">{badge}</span>
              </span>
            )}
          </div>
          {action}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/60 pb-1.5">
            <h2 className="truncate font-serif text-[24px] font-black leading-tight tracking-wide text-ink">{name}</h2>
            {aside && <span className="rounded-full border border-line/70 bg-paper/80 px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">{aside}</span>}
          </div>
          {sub && <p className="mt-1 truncate text-[12.5px] font-medium text-ink-soft">{sub}</p>}
          {fs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
              {fs.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full border border-line/70 bg-paper/85 px-2.5 py-0.5">
                  <span className="text-ink-soft">{k}</span>
                  <b className="font-bold text-ink">{v}</b>
                </span>
              ))}
            </div>
          )}
          {tags && <div className="mt-2 flex flex-wrap items-center gap-1.5">{tags}</div>}
          {children && <div className="mt-2.5">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/* 人物简介：左竖线引文（外貌性格）+ 虚线框（身世背景） */
export function ProfileBio({ bio, story }: { bio?: string; story?: string }) {
  if (!bio && !story) return null;
  return (
    <div className="mb-4 space-y-3">
      {bio && <p className="story-prose border-l-[3px] border-coral/70 pl-3 text-[14px] leading-[1.85] text-ink/90">{bio}</p>}
      {story && <p className="rounded-xl border-2 border-dashed border-coral/35 bg-paper-2/70 px-3.5 py-3 text-[13px] leading-[1.8] text-ink/85">{story}</p>}
    </div>
  );
}

/* 常驻地点：粉色药丸标签（编辑器里选定的常驻地点优先，其次内容池原设定） */
export function ProfilePlaces({ places }: { places: string[] }) {
  return (
    <section className="mb-4">
      <p className="mb-1.5 text-[13px] font-bold text-coral">常驻地点</p>
      <div className="flex flex-wrap gap-1.5">
        {places.length ? places.map((p) => <span key={p} className="rounded-full bg-coral/12 px-3 py-1 text-[12px] font-medium text-coral">{p}</span>) : <span className="text-[12px] text-ink-soft/70">{UNKNOWN}</span>}
      </div>
    </section>
  );
}

/* TA 的记忆：对你的回忆 / 记得的事实（听闻），可手动添加与删除，写回 NPC 知识库 */
export function ProfileMemory({ pid, button }: { pid: string; button?: boolean }) {
  const { game } = useGame();
  const [open, setOpen] = useState(false);
  if (!game) return null;
  const k = kbOf(game, pid);
  const n = (k.playerMemory?.length ?? 0) + (k.selfMemory?.length ?? 0) + (k.heard?.length ?? 0);
  const name = game.npcs.find((x) => x.id === pid)?.name ?? "TA";
  const modal = open && <Modal title={`${name} 的记忆`} onClose={() => setOpen(false)}><MemoryBody pid={pid} /></Modal>;
  if (button) return (
    <>
      <ActionTile icon={IconBook} title="TA 的记忆" sub={n ? `记得 ${n} 件事` : "还没有记住什么"} badge={n || undefined} onClick={() => setOpen(true)} />
      {modal}
    </>
  );
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-line bg-paper-2/80 px-3.5 py-3 text-left shadow-[0_6px_18px_-14px_rgba(80,60,140,0.45)] transition hover:-translate-y-0.5 hover:border-coral">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--coral)] to-[var(--gold)] text-white"><IconThought size="md" className="text-white" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-ink">TA 的记忆</span>
          <span className="block text-[11px] text-ink-soft">对你的回忆 · 记得的事实 · 可手动添加</span>
        </span>
        <span className="shrink-0 rounded-full bg-coral/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-coral">{n} 条</span>
        <span className="text-[14px] text-coral">›</span>
      </button>
      {open && <Modal title={`${name} 的记忆`} onClose={() => setOpen(false)}><MemoryBody pid={pid} /></Modal>}
    </>
  );
}

function MemoryBody({ pid }: { pid: string }) {
  const { game, commitGame } = useGame();
  const [adding, setAdding] = useState<null | "playerMemory" | "selfMemory">(null);
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<"playerMemory" | "selfMemory">("playerMemory");
  if (!game) return null;
  const raw = kbOf(game, pid);
  // 旧存档兜底：记忆列表可能缺失
  const kb = { ...raw, playerMemory: raw.playerMemory ?? [], selfMemory: raw.selfMemory ?? [], heard: raw.heard ?? [] };
  const write = (key: "playerMemory" | "selfMemory", next: KbMem[]) => commitGame({ ...game, npcKb: { ...(game.npcKb ?? {}), [pid]: { ...kb, [key]: next } } });
  const save = () => {
    const t = draft.trim();
    if (t && adding) write(adding, [...kb[adding], { t: gameTimeLabel(game), text: t.slice(0, 160) }]);
    setDraft(""); setAdding(null);
  };
  // 合并为一块「记忆」：回忆 / 事实 两个页签共用一个添加入口
  const [tab, setTab] = [adding ?? view, (k: "playerMemory" | "selfMemory") => { setView(k); if (adding) setAdding(k); }];
  const list = kb[tab];
  const extra = tab === "selfMemory" ? kb.heard : [];
  const TABS = [["playerMemory", "TA 对你的回忆", kb.playerMemory.length], ["selfMemory", "TA 记得的事实", kb.selfMemory.length + kb.heard.length]] as const;
  return (
    <section>
      <div className="mb-2 flex gap-1.5">
        {TABS.map(([k, l, n]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full border px-2 py-1 text-[12px] font-semibold transition ${tab === k ? "border-coral bg-coral/10 text-coral" : "border-line text-ink-soft"}`}>{l} · {n}</button>
        ))}
      </div>
      {adding && (
        <div className="mb-2 flex gap-1.5">
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder={tab === "playerMemory" ? "写一件 TA 会记住的、和你有关的事…" : "写一条 TA 认定的事实…"} className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-coral" />
          <button onClick={save} className="shrink-0 rounded-lg bg-coral px-3 text-[12px] font-bold text-white">保存</button>
          <button onClick={() => setAdding(null)} className="shrink-0 rounded-lg border border-line px-2.5 text-[12px] text-ink-soft">取消</button>
        </div>
      )}
      {!adding && <button onClick={() => { setAdding(tab); setDraft(""); }} className="mb-2.5 w-full rounded-xl border border-dashed border-coral/50 py-2 text-[12.5px] font-bold text-coral transition hover:bg-coral/5">＋ 手动添加一条</button>}
      {list.length + extra.length === 0 ? (
        <p className="py-4 text-center text-[12px] leading-relaxed text-ink-soft">暂无记录；相处、私聊后会自动记下，也可手动添加或纠正。</p>
      ) : (
        <ul className="space-y-1">
          {list.map((m, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink/85">
              <span className="shrink-0 text-[11px] tabular-nums text-ink-soft">{m.t}</span>
              <span className="min-w-0 flex-1">{m.text}</span>
              <button aria-label="删除" onClick={() => write(tab, list.filter((_, j) => j !== i))} className="shrink-0 text-ink-soft/50 hover:text-danger">×</button>
            </li>
          ))}
          {extra.map((m, i) => <li key={`h${i}`} className="text-[12.5px] leading-relaxed text-ink-soft"><span className="mr-2 text-[11px]">传闻</span>{m.text}</li>)}
        </ul>
      )}
    </section>
  );
}

/* 「与你 · X」深色标签 */
export const RelTag = ({ text }: { text?: string }) => (
  <span className="rounded-full bg-ink/80 px-2.5 py-0.5 text-[11px] font-semibold text-paper">与你 · {text || UNKNOWN}</span>
);

/* 统一履历时间线 */
export function ResumeTimeline({ items, empty = "履历尚未得知" }: { items: { year: number | string; title: string; detail?: string }[]; empty?: string }) {
  if (!items.length) return <p className="py-2 text-[12.5px] text-ink-soft/70">{empty}</p>;
  return (
    <ol className="relative space-y-2.5 py-2.5 pl-4 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-line">
      {items.map((e, i) => (
        <li key={i} className="relative text-[12.5px] leading-relaxed">
          <span className="absolute -left-4 top-[5px] h-[11px] w-[11px] rounded-full border-2 border-paper-2 bg-gradient-to-br from-[var(--jade)] to-[var(--coral)]" />
          <span className="mr-2 font-semibold tabular-nums text-gold">{e.year}</span>
          <span className="font-bold text-ink">{e.title}</span>
          {e.detail && <span className="block text-ink/70">{e.detail}</span>}
        </li>
      ))}
    </ol>
  );
}

const STAT_TONE: Record<string, string> = { jade: "var(--jade)", coral: "var(--coral)", gold: "var(--gold)", danger: "var(--danger)" };
/* 情感值可调行：− / 滑杆 / + ，实时写回引擎或情感印象轴 */
export function StatEditor({ label, hint, tone, value, min, max, step = 5, onChange }: { label: string; hint?: string; tone: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const accent = STAT_TONE[tone] ?? "var(--coral)";
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const pct = ((value - min) / Math.max(1, max - min)) * 100;
  return (
    <div title={hint} className="flex items-center gap-2.5 py-1 text-[12.5px]">
      <span className="w-8 shrink-0 font-bold text-ink">{label}</span>
      <div className="relative h-4 min-w-0 flex-1">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-line/60">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
        </div>
        <span aria-hidden className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_currentColor]" style={{ left: `${pct}%`, color: accent }} />
        <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </div>
      <span className="w-8 shrink-0 text-right font-bold tabular-nums" style={{ color: accent }}>{value}</span>
    </div>
  );
}


/* 人物资料分页签：资料 / 情感 / 履历…… */
export function ProfileTabs({ tabs }: { tabs: { id: string; label: string; body: ReactNode }[] }) {
  const list = tabs.filter((t) => t.body);
  const [cur, setCur] = useState(list[0]?.id);
  const active = list.find((t) => t.id === cur) ?? list[0];
  return (
    <div>
      <div className="sticky top-12 z-[5] -mx-1 mb-3 flex gap-1 rounded-full bg-paper-2/90 p-1 ring-1 ring-line/60 backdrop-blur">
        {list.map((t) => (
          <button key={t.id} type="button" onClick={() => setCur(t.id)} aria-current={active?.id === t.id}
            className={`flex-1 rounded-full py-1.5 text-[13px] font-bold tracking-[0.1em] transition ${active?.id === t.id ? "bg-gradient-to-r from-jade to-coral text-white shadow-sm" : "text-ink-soft hover:text-coral"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {active?.body}
    </div>
  );
}

/* 人物互动操作卡：图标 + 标题 + 一句说明，统一尺寸与配色（无 onClick 时为状态卡） */
type IconC = (p: { width?: number; height?: number; "aria-hidden"?: boolean }) => import("react").ReactNode;
const TILE_TONE = {
  ink: "bg-ink/[0.06] text-ink",
  coral: "bg-coral/12 text-coral",
  jade: "bg-jade/12 text-jade",
} as const;
export function ActionTile({ icon: I, title, sub, tone = "ink", badge, onClick, disabled }: {
  icon: IconC; title: string; sub?: string; tone?: keyof typeof TILE_TONE; badge?: number; onClick?: () => void; disabled?: boolean;
}) {
  const body = (
    <>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TILE_TONE[tone]}`}><I width={17} height={17} aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <span className="truncate">{title}</span>
          {badge != null && <span className="rounded-full bg-coral/12 px-1.5 text-[10.5px] tabular-nums text-coral">{badge}</span>}
        </span>
        {sub && <span className="mt-0.5 block truncate text-[11px] text-ink-soft">{sub}</span>}
      </span>
    </>
  );
  const cls = "flex min-h-[56px] w-full items-center gap-2.5 rounded-2xl border border-line bg-paper px-2.5 py-2 text-left";
  if (!onClick) return <div className={`${cls} bg-paper-2/60`}>{body}</div>;
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`${cls} transition hover:-translate-y-px hover:border-ink-soft/40 hover:shadow-sm active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none`}>
      {body}
    </button>
  );
}
