import { ProfileTabs } from "./personFields";
import { ageLabel, birthdayLabel, ownField } from "../lib/npcIdentity";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { datingBlocked, divorceBlocked, weddingBlocked, weddingCost, weddingMinAffinity } from "../game/logic";
import { wallet } from "../game/wallet";
import { bridgeEnabled, bridgeModes, bridgePerDay, type BridgeMode } from "../game/bridge";
import { divorceMode, maxSpouses } from "../game/worldRules";
import type { Npc } from "../lib/types";
import { affinityLevel, Avatar, Chip, Modal, SectionHead } from "./ui";
import { IconCheck, IconExternal, IconHeart, IconScroll, IconSend, IconUsers } from "../lib/icons";
import { ActionTile } from "./personFields";
import { canConfess, relOf } from "../game/relations";
import { ROMANCE_ARCS, arcView, canRomance, hasPartner, romanceFixedOff, isFamilyNpc } from "../game/logic";
import { RELATIONS, MOVIE_TITLES, COMPANIES, companyMeta, creditsOf, resumeOf, romanticCapOf, type FamilyRef, type ResumeEvent } from "../worlds/star2005/content";
import { feature, worldPersonById as profileOf } from "../mods/registry";
import { locOf } from "../game/mud";
import { homePlaceOf } from "../game/homeSpot";
import { contactsCfg, contactsTitle, groupContactsByStage, metricKey, visibleContactMetrics, type ContactIcon as ContactIconKind, type ContactSrc, type ContactStage } from "../game/contacts";
import ContactIcon from "./ContactIcon";
import { FAMILY_NPC_IDS } from "../game/family";
import { CreditsList, StatBars, WorksChips, ProfileRelations, ProfileGroup, ResumeTimeline, BondMeterRow, ProfileBio, ProfilePlaces, ProfileMemory, affiliationOf, relationRefsOf } from "./personFields";
import IndustryPageHeader from "./IndustryPageHeader";
import CustomPersonModal from "./CustomPersonModal";
import { NpcDiary, NpcCgStrip } from "./DiaryCg";
import { onClearPlayerMemory } from "../lib/saveScope";

/* 关系维度 → 语义色 */
const DIM_TONE: Record<string, string> = { 信任: "jade", 爱慕: "coral", 友善: "gold", 敌意: "danger", 好感: "jade", 心动: "coral", 私人信任: "jade", 近况心情: "gold" };
const TONE_VAR: Record<string, string> = { jade: "var(--jade)", coral: "var(--coral)", gold: "var(--gold)", danger: "var(--danger)", "ink-soft": "var(--ink-soft)", ink: "var(--ink-soft)" };
const UNKNOWN = "尚未得知";
/* 情感线在人物页只显示进度与提示；这一段的经历和确认关系都在线下见面时进行（地图上见到 TA、点 TA） */
const arcHint = (today: boolean) => today ? "今天你们已经经历过一段了，留点余味，改天再见。" : "时机到了。这一段要当面经历——去 TA 常在的地方，见到 TA 时点 TA 就能展开。";
const DATING_HINT = "火候到了。这句话要当面说——见到 TA 时点 TA，就能确认关系。";

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

/* 极简人物行：头像 + 名字 / 阶段词 + 一行身份 · 所属；右侧是作者在人物上方配的卡片数值（条数不限、可隐藏） */
export type CardMetric = { key: string; icon: ContactIconKind; value: number; tone?: string };
function PersonCard({ onClick, name, avatar, chip, sub, metrics, dead, dating }: { onClick: () => void; name: string; avatar?: string; chip: ReactNode; sub: string; metrics: CardMetric[]; dead?: boolean; dating?: boolean }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-paper-2 active:bg-paper-2">
      <div className={`relative shrink-0 ${dead ? "opacity-50 grayscale" : ""}`}>
        <Avatar src={avatar} name={name} size={40} editable={false} />
        {dating && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-coral text-white ring-2 ring-paper-2">
            <IconHeart width={9} height={9} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[14px] font-bold text-ink">{name}</p>
          {chip}
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-ink-soft">{sub}</p>
      </div>
      {metrics.map((m) => (
        <span key={m.key} className="flex shrink-0 items-center gap-1 text-[12px] font-semibold tabular-nums"
          style={{ color: m.value < 0 ? "var(--danger)" : TONE_VAR[m.tone ?? "jade"] ?? "var(--ink-soft)" }}>
          <ContactIcon kind={m.icon} />{m.value}
        </span>
      ))}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-ink-soft/35"><path d="m9 18 6-6-6-6" /></svg>
    </button>
  );
}
const LIST = "ui-list";
const GroupHead = ({ label, count }: { label: string; count: number }) => (
  <p className="ui-label mb-1.5 px-1">{label}<span className="ml-1.5 font-medium tabular-nums text-ink-soft/60">{count}</span></p>
);

/* 从别处（如娱乐圈页）直接打开某人的人物详情：记下目标并切到「人脉」 */
let pendingPerson: string | null = null;
onClearPlayerMemory(() => { pendingPerson = null; }); // 切档：丢弃指向上一局人物的跳转
export function openPerson(id: string) {
  pendingPerson = id;
  window.dispatchEvent(new CustomEvent("star:openperson", { detail: id }));
  window.dispatchEvent(new CustomEvent("star:navtab", { detail: "npc" }));
}

/* 婚礼入口：已交往 → 举办婚礼；已婚 → 夫妻标记 */
function Wedding({ pid, name }: { pid: string; name: string }) {
  const { game, busy, simWedding, simDivorce } = useGame();
  const [ask, setAsk] = useState(false);
  if (!game) return null;
  const s = game.sim;
  if (s.spouses?.includes(pid)) {
    const no = divorceBlocked(s, pid);
    const forbid = divorceMode() === "forbid";
    return (
      <div className="space-y-2">
        <p className="rounded-xl border border-coral/40 bg-coral/10 py-2.5 text-center text-[13.5px] font-bold text-coral">你与{name}已结为夫妻</p>
        {!forbid && (ask ? (
          <div className="flex gap-2">
            <button onClick={() => { setAsk(false); simDivorce(pid); }} disabled={busy || !!no} className="flex-1 rounded-xl border border-danger/50 py-2 text-[12.5px] font-bold text-danger disabled:opacity-50">确认离婚</button>
            <button onClick={() => setAsk(false)} className="flex-1 rounded-xl border border-line py-2 text-[12.5px] text-ink-soft">再想想</button>
          </div>
        ) : (
          <button onClick={() => setAsk(true)} disabled={busy || !!no} className="w-full text-center text-[11.5px] text-ink-soft transition hover:text-danger disabled:cursor-not-allowed disabled:hover:text-ink-soft">
            {no || (divorceMode() === "unilateral" ? "提出离婚（单方可离 · 伤感情）" : "协议离婚（对方已同意）")}
          </button>
        ))}
      </div>
    );
  }
  const cost = weddingCost(), minAff = weddingMinAffinity();
  const funds = wallet.balance(game);
  const fmt = (n: number) => wallet.fmt(n, game, (x) => `¥${Math.max(0, x).toLocaleString("zh-CN")}`);
  const why = weddingBlocked(s, pid, s.rel?.[pid] ?? 0, funds, fmt);
  const max = maxSpouses();
  const aff = s.rel?.[pid] ?? 0;
  const checks: [string, boolean][] = max
    ? [
        ["已确认恋爱关系", true],
        [`好感 ≥ ${minAff}（当前 ${aff}）`, aff >= minAff],
        [max === 1 ? "你目前没有配偶" : `配偶未满 ${max} 位（已有 ${s.spouses?.length ?? 0}）`, (s.spouses?.length ?? 0) < max],
        [`婚礼费用 ${fmt(cost)}（现有 ${fmt(funds)}）`, funds >= cost],
      ]
    : [];
  // 其余拦截（如同性婚恋禁止）不在清单里，单独提示
  const extra = why && checks.every(([, ok]) => ok) ? why : "";
  return (
    <div className="rounded-2xl border border-coral/25 bg-gradient-to-br from-coral/[0.07] to-gold/[0.05] p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-coral/15 text-coral"><IconHeart width={15} height={15} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-ink">你与{name}正在交往</span>
          <span className="block text-[11px] text-ink-soft">{max ? "条件齐了，就可以谈婚论嫁" : "这个世界没有婚姻制度，你们以伴侣相守"}</span>
        </span>
      </div>
      {checks.length > 0 && (
        <ul className="mb-3 space-y-1">
          {checks.map(([t, ok]) => (
            <li key={t} className={`flex items-center gap-2 text-[12px] ${ok ? "text-ink" : "text-ink-soft"}`}>
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${ok ? "bg-jade text-white" : "border border-line"}`}>{ok && <IconCheck width={10} height={10} aria-hidden />}</span>
              {t}
            </li>
          ))}
        </ul>
      )}
      {extra && <p className="mb-2 text-[11.5px] text-danger">{extra}</p>}
      {max > 0 && (
        <button onClick={() => simWedding(pid)} disabled={busy || !!why}
          className="w-full rounded-xl bg-gradient-to-r from-[var(--coral)] to-[var(--gold)] py-2.5 text-[13.5px] font-bold text-white shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:from-transparent disabled:to-transparent disabled:bg-paper disabled:text-ink-soft disabled:shadow-none disabled:ring-1 disabled:ring-line">
          {why ? "条件未满足" : `举办婚礼 · ${fmt(cost)}`}
        </button>
      )}
    </div>
  );
}

/* 表白卡：好感与心动两条进度，达标才可表白；被世界规则拦截时说明原因 */
function Confess({ pid, name }: { pid: string; name: string }) {
  const { game, busy, simConfess } = useGame();
  if (!game?.sim) return null;
  const s = game.sim;
  const F = RELATIONS.confess;
  const chk = canConfess(s, pid);
  const f = s.rel?.[pid] ?? 0, r = relOf(s, pid).romantic;
  const blocked = chk.reason === "rule" ? datingBlocked(s, pid) : "";
  const bar = (label: string, v: number, need: number, tone: string) => (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px]"><span className="text-ink-soft">{label}</span><span className={`tabular-nums font-semibold ${v >= need ? "text-jade" : "text-ink"}`}>{Math.max(0, v)} / {need}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, (v / need) * 100))}%` }} /></div>
    </div>
  );
  return (
    <div className="rounded-2xl border border-line bg-paper p-3.5">
      <p className="mb-2.5 text-[13px] font-bold text-ink">{chk.ok ? `时机成熟了，向${name}说出心意吧` : "表白之前"}</p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        {bar("好感", f, F.friendshipMin, "bg-jade")}
        {bar("心动", r, F.romanticMin, "bg-coral")}
      </div>
      {blocked && <p className="mb-2 text-[11.5px] leading-relaxed text-danger">{blocked}</p>}
      <button onClick={() => simConfess(pid, name)} disabled={!chk.ok || busy}
        className="w-full rounded-xl bg-gradient-to-r from-[var(--coral)] to-[var(--jade)] py-2.5 text-[13.5px] font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-transparent disabled:to-transparent disabled:bg-paper-2 disabled:text-ink-soft disabled:shadow-none">
        {chk.ok ? F.labels.button : blocked ? "当前规则下无法表白" : "多相处，把好感与心动养起来"}
      </button>
    </div>
  );
}

/* 牵线：主角促成当前人物与另一位人物之间的往来 */
function NpcBridge({ pid, name }: { pid: string; name: string }) {
  const { game, busy, simBridge } = useGame();
  const [other, setOther] = useState("");
  const [mode, setMode] = useState<BridgeMode>("");
  const [msg, setMsg] = useState("");
  if (!game?.sim) return null;
  // 功能注释：未安装关系玩法包时不出现牵线入口
  if (!feature("relationsPlay")) return null;
  const s = game.sim;
  const list = game.npcs.filter((n) => n.id !== pid && profileOf(n.id)?.status !== "dead");
  const modes = bridgeModes(), order = Object.keys(modes);
  // 功能注释：无创作者配置的牵线方式时不展示（引擎不再预置五种固定方式）
  if (!list.length || !bridgeEnabled() || !order.length) return null;
  const cur = modes[mode] ? mode : order[0];
  const spec = modes[cur];
  const perDay = bridgePerDay();
  const ra = s.rel?.[pid] ?? 0, rb = other ? s.rel?.[other] ?? 0 : 0;
  const used = s.flags?.[`bridge_d${s.day}`] ?? 0;
  const otherName = list.find((n) => n.id === other)?.name ?? "";
  const lack = !other ? "先选一位人物" : Math.min(ra, rb) < spec.need ? `需与两人好感都 ≥ ${spec.need}` : used >= perDay ? "今天的牵线次数用完了" : "";
  const fmt = (d: number) => `${d >= 0 ? "+" : ""}${d}`;
  return (
    <div className="rounded-2xl border border-line bg-paper p-3.5">
      <div className="mb-2.5 flex items-baseline gap-2">
        <p className="text-[13px] font-bold text-ink">牵线</p>
        <p className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">让{name}与别人产生交集</p>
        <span className="shrink-0 text-[11px] tabular-nums text-ink-soft">今日 {used}/{perDay}</span>
      </div>
      <select aria-label="另一位人物" value={other} onChange={(e) => { setOther(e.target.value); setMsg(""); }} className="ui-input mb-2.5 w-full">
        <option value="">选择另一位人物…</option>
        {list.map((n) => <option key={n.id} value={n.id}>{n.name}{n.identity ? ` · ${n.identity.slice(0, 12)}` : ""}（好感 {s.rel?.[n.id] ?? 0}）</option>)}
      </select>
      <div role="radiogroup" aria-label="方式" className="mb-2 flex flex-wrap gap-1.5">
        {order.map((k) => {
          const on = k === cur, m = modes[k];
          return (
            <button key={k} type="button" role="radio" aria-checked={on} onClick={() => { setMode(k); setMsg(""); }}
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${on ? (m.tone === "coral" ? "border-coral bg-coral/10 text-coral" : m.tone === "jade" ? "border-jade bg-jade/10 text-jade" : "border-ink bg-ink text-paper") : "border-line text-ink-soft hover:text-ink"}`}>
              {m.label}
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-ink-soft">
        {spec.desc} · 门槛好感 {spec.need} · 你与{name} {fmt(spec.fx[0])}{otherName ? `，与${otherName} ${fmt(spec.fx[1])}` : `，与对方 ${fmt(spec.fx[1])}`}
      </p>
      {msg && <p className="mb-2 text-[11.5px] text-danger">{msg}</p>}
      <button type="button" disabled={busy || !!lack} onClick={() => setMsg(simBridge(pid, other, cur))}
        className="w-full rounded-xl bg-ink py-2.5 text-[13px] font-bold text-paper transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-paper-2 disabled:text-ink-soft">
        {lack || `${spec.label} · ${name} × ${otherName}`}
      </button>
    </div>
  );
}

/* 可攻略开关：默认开启；关闭后爱慕冻结。compact=名字旁一行（人物卡）；完整版带说明。
 * 家人 / 子女恒不可攻略；已确认关系的人不能关。颜色读皮肤 --coral。 */
function RomanceSwitch({ pid, arc, compact = false }: { pid: string; arc: boolean; compact?: boolean }) {
  const { game, setRomanceable } = useGame();
  const [why, setWhy] = useState("");
  if (!game?.sim) return null;
  const s = game.sim;
  const family = isFamilyNpc(pid);
  const fixed = romanceFixedOff(s, pid) && !family; // 只有子女锁死；家人可手动开启
  const on = canRomance(s, pid);
  const bound = hasPartner(s, pid) || !!s.spouses?.includes(pid);
  const hint = fixed
    ? "子女之间只有亲情，恒不可攻略"
    : family && !on
      ? "TA 是你的家人，默认只有亲情；打开后可发展恋爱线"
      : !on
      ? `TA 不会对你心动${arc ? "，情感线停在当前进度" : ""}；好感与信任照常发展`
      : bound
        ? "你们已确认关系，不能关闭"
        : arc
          ? "可推进专属情感线；关闭后 TA 不会再对你心动"
          : "TA 可能对你心动，好感与心动够了就能表白";
  const sw = fixed ? (
    <Chip>{family ? "亲情" : "恒不可攻略"}</Chip>
  ) : (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="可攻略"
      disabled={on && bound}
      onClick={() => setWhy(setRomanceable(pid, !on))}
      className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-coral" : "bg-line"}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-paper shadow transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
  if (compact) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-bold text-ink" title={why || hint}>
        <IconHeart width={13} height={13} className={on ? "text-coral" : "text-ink-soft"} aria-hidden />
        <span>可攻略</span>
        {sw}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-ui)] border border-line bg-paper px-3 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${on ? "bg-coral/15 text-coral" : "bg-line/60 text-ink-soft"}`}>
        <IconHeart width={16} height={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">可攻略</span>
        <span className="mt-0.5 block text-xs leading-snug text-ink-soft">{why || hint}</span>
      </span>
      {sw}
    </div>
  );
}

export default function NpcTab() {
  const { game, setNpcAvatar, setRelValue, simContact, simConfess, phoneExchange, busy } = useGame();
  const [sel, setSel] = useState<string | null>(() => { const p = pendingPerson; pendingPerson = null; return p; });
  useEffect(() => {
    const on = (e: Event) => { setSel((e as CustomEvent<string>).detail); pendingPerson = null; };
    window.addEventListener("star:openperson", on);
    return () => window.removeEventListener("star:openperson", on);
  }, []);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [exchange, setExchange] = useState<null | "ok" | "no">(null);
  const [profileOpen, setProfileOpen] = useState(false);
  if (!game) return null;
  const s = game.sim;
  const hasContact = (pid: string) => (game.phone?.contacts ?? []).includes(pid);
  // 艺人即 NPC：圈内艺人没有人脉条目时，就地合成一个，走同一套人物详情界面
  const starOf = (id?: string | null) => (id ? (s.npcs ?? []).find((x) => x.id === id) : undefined);
  const asNpc = (st: NonNullable<ReturnType<typeof starOf>>): Npc => ({
    id: st.id, name: st.name, age: "", identity: `艺人 · ${st.dir}`, relation: "同行", avatar: "", bio: "", mood: "",
    affinity: s.rel?.[st.id] ?? 0, dims: [], tags: [], attrs: [], affinityHistory: [], interactions: [],
  });
  const npc = game.npcs.find((n) => n.id === sel) ?? (starOf(sel) ? asNpc(starOf(sel)!) : undefined);

  if (npc) {
    const pid = npc.id;
    const profile = profileOf(pid);
    const star = starOf(pid);
    const dead = profile?.status === "dead";
    const rx = relOf(s, pid);
    const isDating = s.dating === pid;
    const arc = ROMANCE_ARCS[pid];
    const view = arc ? arcView(s, pid) : null;
    const confess = canConfess(s, pid);
    const romanceOn = canRomance(s, pid); // 可攻略开关；家人 / 子女恒为 false
    // 功能注释：表白/婚礼/牵线入口仅在已添加「关系玩法」包时出现
    const relationsPlayOn = feature("relationsPlay");
    const romanceFixed = romanceFixedOff(s, pid);
    // 常驻地点：编辑器里选定的优先，其次内容池覆盖 / 由据点推导；未知则「尚未得知」
    const home = homePlaceOf(game, npc, profile);
    const places = home ? [home] : [];

    // 性别：编辑器「人设」里明确选过的优先，其次内容池存的确定性数据；家人（无 profile）按父/母称谓落定，均无则留白
    const genderText: string | undefined =
      npc.persona?.gender ?? profile?.gender ?? star?.gender ?? (npc.relation === "父亲" ? "男" : npc.relation === "母亲" ? "女" : undefined);
    // 年龄：编辑器里改过的存档值优先，其次内容池存的数字，再次存档 / 家人档案里的 age；纯数字显示为「N 岁」，自由文本原样，缺则不展示该行
    const ageText = ageLabel(ownField(npc, "age", profile?.age ? String(profile.age) : undefined));
    const bioText = ownField(npc, "bio", profile?.bio);

    const isFamily = FAMILY_NPC_IDS.includes(pid as (typeof FAMILY_NPC_IDS)[number]);
    // 情感关系：统一取自人物关系网（只列明确设定的人物），不设结识门槛
    const rels = relationRefsOf(game, pid);

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
                  {label} <IconExternal size={10} />
                </button>
              );
            }
            const target = r.id ? game.npcs.find((n) => n.id === r.id) ?? starOf(r.id) : undefined;
            return target ? (
              <button
                key={i}
                onClick={() => { setSel(target.id); setResumeOpen(false); setProfileOpen(false); }}
                className="rounded-sm border border-dashed border-jade/50 px-2 py-0.5 text-[12px] text-jade transition hover:bg-jade/10"
              >
                {label} <IconExternal size={10} />
              </button>
            ) : (
              <span key={i} className="rounded-sm border border-dashed border-line px-2 py-0.5 text-[12px] text-ink-soft">{label}</span>
            );
          })}
        </span>
      );
    };

    // 情感关系各行预渲染：确无记录者返回 undefined，格子淡显「暂无记录」
    const spouseRefsNode = refList(rels.现任);
    const parentsNode = refList(rels.父母);
    const childRefsNode = refList(rels.子女);

    // ═══ 人物详情：上下两块（人物卡 + 资料/情感），样式读皮肤变量 ═══
    const affinityPct = Math.round(((npc.affinity + 100) / 200) * 100);
    const cap = romanticCapOf(pid) || 100;
    const romPct = Math.max(0, Math.min(100, (rx.romantic / cap) * 100));
    const affil = isFamily ? "家人" : star ? companyMeta(star.companyId).name : affiliationOf(npc.identity);
    const quickFacts = [genderText, ageText, birthdayLabel(npc), affil].filter(Boolean);

    // 功能注释：资料 / 情感 两页签；能力只读作品配置；关系经营固定三卡（私下联系 / 履历 / 表白）
    const profileTabsNode = (
      <ProfileTabs tabs={[
        { id: "info", label: "资料", body: <div>
          <ProfileBio bio={bioText} />
          <ProfilePlaces places={places} />
          {/* 代表作只在有作品时出现（非娱乐圈模组、素人 NPC 没有作品，不留空栏） */}
          {(() => {
            const works = profile?.works?.map((x) => x.trim()).filter(Boolean) ?? (star ? [...new Set((star.works ?? []).map((w) => MOVIE_TITLES[w % MOVIE_TITLES.length]))] : []);
            if (!creditsOf(pid).length && !works.length) return null;
            return (
              <ProfileGroup title={profile?.worksLabel?.trim() || "代表作"}>
                <div className="py-2">
                  {creditsOf(pid).length > 0 ? (
                    <CreditsList
                      credits={creditsOf(pid)}
                      onOpenPerson={(id) => { if (game.npcs.some((n) => n.id === id)) { setSel(id); setResumeOpen(false); } }}
                    />
                  ) : (
                    <WorksChips works={works} plain={profile?.worksPlain} />
                  )}
                </div>
              </ProfileGroup>
            );
          })()}
          <ProfileGroup title="个人能力">
            <div className="py-2"><StatBars stats={(profile?.stats ?? star?.stats) as Record<string, number> | undefined} /></div>
          </ProfileGroup>
          <NpcDiary pid={pid} />
          <NpcCgStrip pid={pid} />
        </div> },
        { id: "heart", label: "情感", body: <div>
          <ProfileRelations values={{ 现任: spouseRefsNode, 父母: parentsNode, 子女: childRefsNode }} noParents={rels.noParents} />
          {dead ? (
            <ProfileGroup title="关系经营"><div className="space-y-2 py-2.5">
              <p className="text-[13px] text-ink-soft">斯人已逝，档案就此封存。你只能在回忆与履历里与 TA 重逢。</p>
            </div></ProfileGroup>
          ) : (
            <ProfileGroup title="关系经营"><div className="space-y-2.5 py-2.5">
              {arc && romanceOn && <p className="mb-1 text-[11.5px] font-semibold text-gold">固定角色 · 专属情感长线</p>}
              <div className={`grid grid-cols-1 gap-2 ${relationsPlayOn ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <ActionTile icon={IconSend} tone="coral" title={busy ? "生成中…" : "私下联系"} sub="约 TA 单独见面聊聊" onClick={() => simContact(pid, npc.name)} disabled={busy} />
                <ActionTile icon={IconScroll} title="履历" sub="生平往来" onClick={() => setResumeOpen(true)} />
                {relationsPlayOn && (
                  <ActionTile
                    icon={IconHeart}
                    tone="coral"
                    title="表白"
                    sub="与TA关系更进一步"
                    onClick={() => { if (confess.ok) simConfess(pid, npc.name); }}
                    disabled={!confess.ok || busy || !romanceOn || isDating}
                  />
                )}
              </div>
              {hasContact(pid)
                ? <p className="text-[11.5px] text-ink-soft">已有联系方式 · 可在手机里找到 TA</p>
                : (
                  <button
                    type="button"
                    onClick={() => setExchange(phoneExchange(pid) ? "ok" : "no")}
                    className="text-left text-[11.5px] font-semibold text-jade underline decoration-dotted underline-offset-2"
                  >
                    尝试交换联系方式
                  </button>
                )}
              <ProfileMemory pid={pid} button />
              {relationsPlayOn && game.npcs.some((n) => n.id === pid) && <NpcBridge pid={pid} name={npc.name} />}
              {arc && view && romanceOn && (
                <div className="mt-3 border-t border-dashed border-line pt-3">
                  <p className="mb-2 text-[12px] text-ink-soft">专属状态「{view.buff}」· 需长线经营，火候到了自会水到渠成。</p>
                  {view.stage ? (
                    <div>
                      <p className="mb-1.5 text-[14px] font-bold text-ink">第 {view.stage.id} 段 · {view.stage.name}</p>
                      {view.locked ? (
                        <p className="rounded-xl border border-dashed border-danger/40 bg-danger/[0.04] px-3 py-2 text-[13px] text-ink-soft">时机未到，你们的缘分还需要沉淀——继续经营名声与彼此的默契。</p>
                      ) : (
                        <p className="rounded-xl border border-dashed border-coral/40 bg-coral/[0.04] px-3 py-2 text-[13px] text-ink-soft">{arcHint(view.today)}</p>
                      )}
                    </div>
                  ) : isDating && relationsPlayOn ? (
                    <div className="space-y-2"><p className="text-center text-[12px] text-coral">状态「{view.buff}」生效中</p><Wedding pid={pid} name={npc.name} /></div>
                  ) : view.datingReady ? (
                    <p className="rounded-xl border border-dashed border-coral bg-coral/10 px-3 py-3 text-center text-[13px] text-coral">{DATING_HINT}</p>
                  ) : (
                    <p className="px-3 py-3 text-center text-[13px] text-ink-soft">剧情已推进完，但你们之间还差一点火候——再沉淀些名声与代表作，缘分自会成熟。</p>
                  )}
                </div>
              )}
              {!arc && romanceOn && isDating && relationsPlayOn && (
                <div className="mt-3 border-t border-dashed border-line pt-3">
                  <Wedding pid={pid} name={npc.name} />
                </div>
              )}
              {!arc && romanceOn && !isDating && !confess.ok && relationsPlayOn && (
                <div className="mt-2">
                  <Confess pid={pid} name={npc.name} />
                </div>
              )}
            </div></ProfileGroup>
          )}
        </div> },
      ]} />
    );

    // 功能注释：上下两块人物档案——上人物卡（头像/名/可攻略/标签/爱慕好感），下资料·情感页签；色与圆角读皮肤变量
    const card = (
      <div className="mx-auto max-w-2xl space-y-3 px-4 pb-8 pt-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setSel(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-1.5 text-[12.5px] font-bold text-ink shadow-[var(--shadow-ui)] transition hover:border-jade hover:text-jade"
          >
            <span>←</span>
            <span>返回人脉</span>
          </button>
        </div>

        <section className={`rounded-[var(--radius-ui-lg)] border border-line bg-paper p-3.5 shadow-[var(--shadow-ui)] ${dead ? "opacity-80" : ""}`}>
          <div className="flex items-start gap-3.5">
            <div className={`shrink-0 ${dead ? "grayscale" : ""}`}>
              <Avatar src={npc.avatar} name={npc.name} size={72} square onPick={dead ? undefined : (d) => setNpcAvatar(npc.id, d)} editable={!dead} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate font-serif text-[22px] font-black leading-tight tracking-wide text-ink">{npc.name}</h2>
                {dead ? (
                  <Chip tone="danger">已故</Chip>
                ) : (
                  <RomanceSwitch key={pid} pid={pid} arc={!!arc} compact />
                )}
              </div>
              {(quickFacts.length > 0 || npc.identity) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {genderText && (
                    <span className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">{genderText}</span>
                  )}
                  {(affil || npc.identity) && (
                    <span className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">{affil || npc.identity}</span>
                  )}
                  {ageText && (
                    <span className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">{ageText}</span>
                  )}
                  {!dead && isDating && <Chip tone="coral">恋人</Chip>}
                </div>
              )}
              {!dead && (
                <div className="mt-2.5 space-y-0.5 border-t border-line/70 pt-2">
                  {romanceOn ? (
                    <BondMeterRow
                      label="爱慕"
                      value={rx.romantic}
                      pct={romPct}
                      min={0}
                      max={cap}
                      onChange={(v) => setRelValue(pid, "romantic", v)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 py-1 text-[12px] text-ink-soft">
                      <span className="w-8 shrink-0 font-bold text-ink">爱慕</span>
                      <span>{romanceFixed ? (isFamilyNpc(pid) ? "亲情 · 家人" : "子女亲情") : "不可攻略"}</span>
                    </div>
                  )}
                  <BondMeterRow
                    label="好感"
                    value={npc.affinity}
                    pct={affinityPct}
                    min={-100}
                    max={100}
                    onChange={(v) => setRelValue(pid, "friendship", v)}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="rounded-[var(--radius-ui-lg)] border border-line bg-paper p-3.5 shadow-[var(--shadow-ui)]">
          {profileTabsNode}
        </div>
      </div>
    );

    return (
      <>
      {card}
        {resumeOpen && <ResumeModal name={npc.name} pid={pid} onClose={() => setResumeOpen(false)} npc={npc} extra={star ? starResume(star) : undefined} />}
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
      </>
    );
  }

  // 列表：只展示真正打过交道（已结识）的人——没交互过的绝不出现在人脉里
  const known = game.npcs.filter((n) => s.metPeople.includes(n.id));

  // 功能注释：玩家列表只按当前关系阶段分组；组织仅作为卡片资料展示，绝不参与归组。
  const cfg = contactsCfg();
  type Entry = { id: string; name: string; avatar?: string; sub: string; rel: number; vals: (src: ContactSrc) => number | undefined; dead?: boolean; dating?: boolean };
  const npcEntries: Entry[] = known.map((n) => {
    const prof = profileOf(n.id);
    const org = prof?.org?.trim() || affiliationOf(n.identity);
    return {
      id: n.id, name: n.name, avatar: n.avatar, rel: n.affinity,
      sub: [n.identity || "—", org].filter(Boolean).join(" · "),
      vals: (src) => src.kind === "rel" ? n.affinity
        : n.attrs.find((a) => a.key === src.key || a.label === src.label)?.value ?? n.dims.find((d) => d.label === src.label)?.value,
      dead: prof?.status === "dead", dating: s.dating === n.id,
    };
  });
  // 功能注释：仅在作品声明了行业公司时并入娱乐圈随机艺人；无 industry 的旅馆等题材绝不塞「新人 · 自由艺人」
  const knownIds = new Set(npcEntries.map((e) => e.id));
  const poolEntries: Entry[] = COMPANIES.length > 0
    ? (s.npcs ?? []).filter((n) => !knownIds.has(n.id)).map((n) => {
      const rel = s.rel?.[n.id] ?? 0;
      const org = companyMeta(n.companyId).name;
      return {
        id: n.id, name: n.name, rel,
        sub: [n.dir, org].filter(Boolean).join(" · "),
        vals: (src) => src.kind === "rel" ? rel : src.key === "fame" ? n.fame : src.kind === "stat" ? (n.stats as Record<string, number>)[src.key] : undefined,
      };
    })
    : [];
  const entries = [...npcEntries, ...poolEntries];
  const shownMetrics = visibleContactMetrics(cfg);
  const primary = shownMetrics[0];
  const sortVal = (e: Entry) => (primary ? e.vals(primary.src) : e.rel) ?? -Infinity;
  const grouped = groupContactsByStage(cfg, entries, (entry) => entry.rel)
    .map((group) => ({ ...group, people: [...group.people].sort((a, b) => sortVal(b) - sortVal(a)) }));

  const Card = ({ e, stage }: { e: Entry; stage: ContactStage }) => {
    const metrics: CardMetric[] = shownMetrics.flatMap((m) => {
      const v = e.vals(m.src);
      return v === undefined || Number.isNaN(v) ? [] : [{ key: metricKey(m.src), icon: m.icon, value: Math.round(v), tone: m.tone }];
    });
    return (
      <PersonCard
        onClick={() => { setSel(e.id); setProfileOpen(false); }}
        name={e.name} avatar={e.avatar} dead={e.dead} dating={e.dating}
        chip={e.dead ? <Chip tone="danger">已故</Chip> : <Chip tone={stage.tone}>{stage.label}</Chip>}
        sub={e.sub}
        metrics={metrics}
      />
    );
  };

  return (
    <div className="w-full pb-5">
      <IndustryPageHeader
        title={contactsTitle()}
        subtitle={cfg.subtitle ?? ""}
        action={<button onClick={() => setAddOpen(true)} aria-label="添加人物" className="flex h-8 items-center gap-1 rounded-[8px] border border-coral/40 bg-paper/80 px-2.5 text-[12px] font-bold text-coral transition hover:bg-coral/10"><span className="text-[15px] leading-none">＋</span>添加</button>}
      />
      {addOpen && <CustomPersonModal onClose={() => setAddOpen(false)} />}

      <div className="mx-auto max-w-2xl px-4 pt-3">

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-2/40 px-4 py-10 text-center">
          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-ink-soft/10 text-ink-soft/60"><IconUsers width={22} height={22} /></span>
          <p className="text-[13px] text-ink-soft">还没结识任何人。<br />到各处走走、与人搭话，认识的人才会记入{contactsTitle()}。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => {
            return (
              <section key={g.stage.id}>
                <GroupHead label={g.stage.label} count={g.people.length} />
                <div className={LIST}>
                  {g.people.map((e) => <Card key={e.id} e={e} stage={g.stage} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

/* ═══════════════ 履历弹窗：静态生平（可筛选）+ 游戏内互动记录 ═══════════════
 * 生平履历取自内容池，只读、确定性——筛选只做前端过滤，不产生任何新事件、不调用 AI。 */
/* 艺人履历：出道 + 代表作按年份铺开（确定性派生） */
function starResume(st: { dir: string; companyId: string; debutYear?: number; works?: number[] }): ResumeEvent[] {
  const debut = st.debutYear ?? 2005;
  const works = [...new Set((st.works ?? []).map((w) => MOVIE_TITLES[w % MOVIE_TITLES.length]))];
  return [
    { year: debut, type: "出道", title: `以${st.dir}身份出道，签约${companyMeta(st.companyId).name}` },
    ...works.map((t, i) => ({ year: Math.min(2005, debut + i + 1), type: "作品", title: `主演《${t}》` })),
  ];
}

function ResumeModal({ name, pid, onClose, npc, extra }: { name: string; pid: string; onClose: () => void; extra?: ResumeEvent[]; npc: { affinityHistory: { turn: number; delta: number; reason: string }[]; interactions: { turn: number; time: string; text: string }[] } }) {
  const all = [...resumeOf(pid), ...(extra ?? [])];
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
    <Modal title={`${name} · 履历与互动`} onClose={onClose}>
      <ProfileGroup title={`生平履历 · ${filtered.length} 条`}>
        {all.length === 0 ? <ResumeTimeline items={[]} /> : (
          <>
            <div className="flex flex-wrap gap-2 pt-2">
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
            <ResumeTimeline
              items={filtered.map((e) => ({ year: `${e.year}${e.month ? `.${e.month}` : ""}`, title: `${e.title}${e.type ? ` · ${e.type}` : ""}`, detail: e.detail }))}
              empty="该筛选下没有记录。"
            />
            {hiddenCount > 0 && !filtering && (
              <p className="border-t border-dashed border-line/60 py-2 text-[11.5px] text-ink-soft/70">尚未得知 · 还有 {hiddenCount} 段往事，等你与 TA 相知更深后揭晓。</p>
            )}
          </>
        )}
      </ProfileGroup>

      <ProfileGroup title={`互动记录 · ${npc.interactions.length} 条`}>
        <ResumeTimeline items={[...npc.interactions].reverse().map((it) => ({ year: it.time, title: it.text }))} empty="尚无互动。" />
      </ProfileGroup>

      {npc.affinityHistory.length > 0 && (
        <ProfileGroup title="好感变动">
          {[...npc.affinityHistory].reverse().map((h, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-dashed border-line/60 py-2 text-[12.5px] last:border-b-0">
              <span className={`w-9 shrink-0 font-bold tabular-nums ${h.delta > 0 ? "text-jade" : "text-danger"}`}>{h.delta > 0 ? "+" : ""}{h.delta}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{h.reason}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-soft">第 {h.turn} 回合</span>
            </div>
          ))}
        </ProfileGroup>
      )}
    </Modal>
  );
}
