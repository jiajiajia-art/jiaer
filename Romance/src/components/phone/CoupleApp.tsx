import { IconSpark, IconHeart, IconMail, IconCalendar } from "../../lib/icons";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGame } from "../../store/gameCtx";
import { isConfigured } from "../../lib/ai";
import type { AIConfig, GameState, Npc } from "../../lib/types";
import { syncJson } from "./worldSync";
import { kbBlock, remember } from "../../game/npcKnowledge";
import { relOf } from "../../game/relations";
import { canRomance, dayDateLabel, dayParts } from "../../game/logic";
import { COUPLE_QUESTIONS } from "./couple/questions";
import { applyBond, type BondKind } from "../../game/coupleBond";
import {
  useCouple, updateCouple, getCouple, newSpace, uidc, readImage, paperStyle, fontOf,
  PAPERS, FONTS, INKS, ANNIV_COLORS, MAX_BINDINGS,
  type Anniv, type Block, type CoupleData, type Letter, type Space,
} from "./couple/store";

/* 「情侣空间」：选择 char 发送空间邀约 → TA 依人设与关系进度回信接受 / 婉拒；绑定后解锁
 * 主页装扮（任意背景图）· 每日问答（100 题，答完才看得到 TA 的答案）· 信箱（自定义信纸 / 字体 / 文字自由摆放，TA 回信）· 纪念日。
 * 视觉参照「清透线稿」：近乎透明的白卡 + 灰玫细线 + 内侧淡粉柔光。手机 App 配色固定，不随游戏皮肤变化。 */

const INK = "#5a4450";
const SOFT = "#a08894";
const ROSE = "#c4607e";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const CARD = "rounded-[18px] border border-[#dcc6cf] bg-white/55 shadow-[inset_0_0_14px_rgba(236,170,190,0.2),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-[3px]";
const BTN = "rounded-full border border-[#dcc6cf] bg-white/60 px-3.5 py-1.5 text-[12.5px] font-medium text-[#5a4450] shadow-[inset_0_0_8px_rgba(236,170,190,0.2)] transition active:scale-[0.97] disabled:opacity-40";
const BTN_ROSE = "rounded-full border border-[#c4607e]/50 bg-[#c4607e]/12 px-4 py-2 text-[13px] font-bold text-[#b0506e] shadow-[inset_0_0_10px_rgba(196,96,126,0.15)] transition active:scale-[0.97] disabled:opacity-40";
const INPUT = "w-full rounded-[12px] border border-[#dcc6cf] bg-white/70 px-3 py-2 text-[13px] text-[#5a4450] outline-none placeholder:text-[#c5b3bb] focus:border-[#c4607e]/60";

type View = "home" | "invite" | "qa" | "mail" | "anniv" | "dress";

/* 回信请求进行中的信件 id（模块级：离开 App 也不会重复请求） */
const inflight = new Set<string>();

/* ── 游戏内日期换算：纪念日以游戏日历为准 ── */
function gameBaseUtc(): number {
  const { y, m, d } = dayParts(0);
  return Date.UTC(y, m - 1, d);
}
const isoOfDay = (day: number) => { const { y, m, d } = dayParts(day); return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
function dayOfIso(iso: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - gameBaseUtc()) / 86400000);
}

const isLover = (g: GameState, id: string) => g.sim.dating === id || !!g.sim.partners?.includes(id);
function relLine(g: GameState, npc: Npc): string {
  if (!canRomance(g.sim, npc.id)) return `你与主角目前：好感 ${npc.affinity}；你们之间没有恋爱可能（不可攻略），你不会对主角心动，只当朋友相处。`;
  return `你与主角目前：好感 ${npc.affinity}，爱慕 ${relOf(g.sim, npc.id).romantic}，${isLover(g, npc.id) ? "已是恋人" : "尚未确认恋爱关系"}。`;
}
const askChar = <T extends object>(cfg: AIConfig, g: GameState, npc: Npc, task: string) =>
  syncJson<T>(cfg, g, `couple.${npc.id}`, `情侣空间·${npc.name}`, `${kbBlock(g, npc.id)}\n\n${task}`);
const letterText = (l: Letter) => l.blocks.map((b) => b.text.trim()).filter(Boolean).join("\n");
const S = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const charFontOf = (id: string) => FONTS[hash(id) % FONTS.length].id;

type Me = { name: string; avatar?: string };
type Patch = (fn: (latest: GameState) => GameState) => void;

/* App 内提示条（关系数值变化以彩色标注显示）：模块级通道，异步结果回来时也能弹出 */
let toastFn: ((t: string) => void) | null = null;
const toast = (t: string) => toastFn?.(t);

/* 关系数值结算：每类互动每个游戏日一次，基于最新存档写入 */
function settleBond(gameId: string, charId: string, kind: BondKind, patch: Patch): string {
  let note = "";
  patch((lg) => {
    const sp = getCouple(gameId)?.spaces[charId];
    if (!sp || sp.bond?.[kind] === lg.sim.day) return lg;
    const r = applyBond(lg, charId, kind);
    note = r.note;
    updateCouple(gameId, (d) => (d.spaces[charId] ? { ...d, spaces: { ...d.spaces, [charId]: { ...d.spaces[charId], bond: { ...d.spaces[charId].bond, [kind]: lg.sim.day } } } } : d));
    return r.next;
  });
  if (note) toast(note);
  return note;
}
/* 写进 TA 的私有记忆（基于最新存档） */
const memoOf = (patch: Patch, id: string, kind: "player" | "self", text: string) => patch((lg) => remember(lg, id, kind, text, dayDateLabel(lg.sim.day)));

/* TA 主动写信（久未通信 / 纪念日）：AI 自选信纸，落库后记入 TA 的记忆 */
async function charWrites(cfg: AIConfig, g: GameState, npc: Npc, me: Me, reason: string, patch: Patch): Promise<boolean> {
  const sp = getCouple(g.id)?.spaces[npc.id];
  if (!sp) return false;
  const history = sp.letters.slice(-4).map((l) => `${l.from === "me" ? me.name : npc.name}：${letterText(l).slice(0, 100)}`).join("\n");
  const p = await askChar<{ letter?: unknown; paper?: unknown }>(cfg, g, npc,
    `你是${npc.name}。${reason}
请你主动在情侣空间的信箱里给主角${me.name !== g.player.name ? `（空间昵称「${me.name}」）` : ""}写一封信（100~320 字，可分段，有称呼与落款；第一人称，口吻贴合人设与你们真实的关系；写你最近真实的生活与心事，不要旁白）。
${history ? `【你们之前的往来信件（节选）】\n${history}\n` : ""}${relLine(g, npc)}
信纸可选：${PAPERS.map((x) => `${x.id}(${x.label})`).join("、")}，挑一张最符合你此刻心情的。
返回 JSON：{"letter": "信件正文", "paper": "信纸 id"}`);
  const text = S(p?.letter, 1200);
  if (!text) return false;
  const paper = PAPERS.find((x) => x.id === p?.paper) ?? PAPERS[0];
  updateCouple(g.id, (d) => {
    const s2 = d.spaces[npc.id];
    if (!s2) return d;
    const l: Letter = { id: uidc(), from: "char", paper: paper.id, font: charFontOf(npc.id), color: paper.ink, size: 15, blocks: [{ id: uidc(), text, x: 8, y: 6 }], day: g.sim.day, ts: Date.now(), read: false };
    return { ...d, spaces: { ...d.spaces, [npc.id]: { ...s2, letters: [...s2.letters, l] } } };
  });
  memoOf(patch, npc.id, "self", `我在情侣空间主动给主角写了一封信：${text.slice(0, 70)}`);
  return true;
}

/* 今天是哪些纪念日：在一起每满 100 天 / 每满一年；自定义纪念日的同月同日 */
function todaysAnnivs(space: Space, day: number): string[] {
  const out: string[] = [];
  const n = day - space.since + 1;
  const name = space.annivs.find((a) => a.builtin)?.name ?? "我们在一起";
  if (n > 1 && n % 100 === 0) out.push(`${name} 第 ${n} 天`);
  if (day > space.since && (day - space.since) % 365 === 0) out.push(`${name} ${(day - space.since) / 365} 周年`);
  const t = dayParts(day);
  for (const a of space.annivs) {
    if (a.builtin) continue;
    const at = dayOfIso(a.date);
    if (at == null) continue;
    const p = dayParts(at);
    if (at === day) out.push(a.name);
    else if (at < day && p.m === t.m && p.d === t.d) out.push(`${a.name} ${t.y - p.y} 周年`);
  }
  return out;
}

export default function CoupleApp({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const [data, update] = useCouple(game!.id);
  if (!data) return <div className="grid h-full place-items-center bg-[#fbf4f6] text-[12px]" style={{ color: SOFT }}>正在打开情侣空间…</div>;
  return <CoupleInner data={data} update={update} onBack={onBack} />;
}

function CoupleInner({ data, update, onBack }: { data: CoupleData; update: (fn: (d: CoupleData) => CoupleData) => void; onBack: () => void }) {
  const { game, cfg, patchGame } = useGame();
  const g = game!;
  const day = g.sim.day;
  const online = isConfigured(cfg);
  const [tip, setTip] = useState("");
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    toastFn = (x) => { setTip(x); clearTimeout(t); t = setTimeout(() => setTip(""), 2600); };
    return () => { toastFn = null; clearTimeout(t); };
  }, []);
  const charId = data.bindings[0];
  const space = charId ? data.spaces[charId] : undefined;
  const npc = charId ? g.npcs.find((n) => n.id === charId) : undefined;
  const [view, setView] = useState<View>(space ? "home" : "invite");
  const me = {
    name: (data.identity.mode === "custom" && data.identity.name.trim()) || g.player.name,
    avatar: (data.identity.mode === "custom" && data.identity.avatar) || g.player.avatar,
  };
  const setSpace = (fn: (s: Space) => Space) => charId && update((d) => (d.spaces[charId] ? { ...d, spaces: { ...d.spaces, [charId]: fn(d.spaces[charId]) } } : d));
  const memo = (text: string) => { if (npc) memoOf(patchGame, npc.id, "player", text); };

  // TA 主动来信：距上次 TA 的信 ≥ 3 个游戏日，每天判定一次（约六成概率）
  useEffect(() => {
    if (!space || !npc || !online || space.proactiveDay === day) return;
    const lastChar = Math.max(space.since, ...space.letters.filter((l) => l.from === "char").map((l) => l.day));
    if (day - lastChar < 3) return;
    setSpace((s) => ({ ...s, proactiveDay: day }));
    if (hash(`${npc.id}:${day}`) % 10 >= 6) return;
    void charWrites(cfg, g, npc, me, `你们已经有 ${day - lastChar} 天没在情侣空间的信箱里通信了，你有些想念主角。`, patchGame)
      .then((ok) => ok && toast(`${npc.name} 给你寄来了一封信`));
  }, [charId, day, online]); // eslint-disable-line react-hooks/exhaustive-deps

  // 纪念日当天：一起过 → 结算关系 + TA 写一封纪念日的信
  const todays = space ? todaysAnnivs(space, day) : [];
  const celebrated = space?.bond?.anniv === day;
  const [celebrating, setCelebrating] = useState(false);
  const celebrate = async () => {
    if (!npc || !todays.length || celebrated || celebrating) return;
    setCelebrating(true);
    settleBond(g.id, npc.id, "anniv", patchGame);
    memo(`今天是我们的「${todays.join("、")}」，${me.name}在情侣空间约我一起过`);
    try {
      if (online) await charWrites(cfg, g, npc, me, `今天是你们的「${todays.join("、")}」，主角在情侣空间约你一起过这一天。`, patchGame);
    } finally {
      setCelebrating(false);
    }
  };

  const bound = !!(space && npc);
  const go = (v: View) => setView(bound || v === "invite" || v === "dress" ? v : "invite");
  const backTo = () => (view === "home" || (!bound && view === "invite") ? onBack() : setView(bound ? "home" : "invite"));
  const TITLE: Record<View, string> = { home: "情侣空间", invite: "情侣邀约", qa: "每日问答", mail: "信箱", anniv: "纪念日", dress: "主页装扮" };

  return (
    <div className="relative isolate flex h-full flex-col overflow-hidden text-[#5a4450]" style={{ fontFamily: "'Noto Sans SC', -apple-system, sans-serif", background: "#fbf4f6" }}>
      {/* 背景：自定义图片 + 蒙白；无图时用清透粉雾 + 细格 */}
      <div aria-hidden className="absolute inset-0 -z-10" style={data.bg
        ? { background: `center/cover no-repeat url(${data.bg})` }
        : { background: "radial-gradient(60% 40% at 10% 0%,#ffe4ec,transparent 70%),radial-gradient(60% 40% at 100% 100%,#f1e4f7,transparent 70%),linear-gradient(#f6e9ee 1px,transparent 1px) 0 0/22px 22px,linear-gradient(90deg,#f6e9ee 1px,transparent 1px) 0 0/22px 22px,#fdf7f9" }} />
      {data.bg && <div aria-hidden className="absolute inset-0 -z-10 bg-white" style={{ opacity: data.veil }} />}

      <header className="relative z-10 flex items-center gap-2 px-3 pb-2 pt-3">
        <button onClick={backTo} className="grid h-8 w-8 place-items-center rounded-full border border-[#dcc6cf] bg-white/60 text-[18px] leading-none" style={{ color: INK }} aria-label="返回">‹</button>
        <p className="flex-1 text-center text-[15px] font-bold tracking-[0.12em]">{TITLE[view]}</p>
        <button onClick={() => setView("dress")} className="grid h-8 w-8 place-items-center rounded-full border border-[#dcc6cf] bg-white/60 text-[13px]" style={{ color: ROSE }} aria-label="装扮"><IconSpark size={14} /></button>
      </header>

      {/* 滚动区不设定位：弹窗以 App 根节点为容器，始终居中覆盖整屏 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 [scrollbar-width:none]">
        {view === "invite" && <InviteView data={data} update={update} me={me} online={online} onBound={() => setView("home")} />}
        {view === "home" && bound && <HomeView data={data} space={space!} npc={npc!} me={me} day={day} go={go} todays={todays} celebrated={celebrated} celebrating={celebrating} onCelebrate={celebrate} />}
        {view === "qa" && bound && <QaView space={space!} npc={npc!} me={me} day={day} online={online} setSpace={setSpace} memo={memo} />}
        {view === "mail" && bound && <MailView data={data} update={update} space={space!} npc={npc!} me={me} day={day} online={online} setSpace={setSpace} memo={memo} />}
        {view === "anniv" && bound && <AnnivView space={space!} day={day} setSpace={setSpace} />}
        {view === "dress" && <DressView data={data} update={update} npc={npc} space={space} onUnbound={() => setView("invite")} />}
      </div>

      {tip && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-40 flex justify-center px-6">
          <p className="rounded-full border border-[#e9c3d1] bg-white/90 px-3.5 py-1.5 text-[12px] font-bold shadow-[0_6px_18px_-10px_rgba(196,96,126,0.6)]" style={{ color: ROSE }}>{tip}</p>
        </div>
      )}
    </div>
  );
}

/* ═══ 小部件 ═══ */
function Ava({ src, name, size = 56 }: { src?: string; name: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-[#dcc6cf] bg-white/70 p-[3px] shadow-[inset_0_0_8px_rgba(236,170,190,0.25)]" style={{ width: size, height: size }}>
      {src ? <img src={(src) || undefined} alt={name} className="h-full w-full rounded-full object-cover" /> : <span className="grid h-full w-full place-items-center rounded-full bg-[#f6e3ea] font-bold" style={{ color: ROSE, fontSize: size * 0.36 }}>{name.charAt(0)}</span>}
    </span>
  );
}
const Pulse = () => (
  <svg viewBox="0 0 120 14" className="mx-auto h-3.5 w-28" aria-hidden>
    <path d="M0 7h44l4-5 5 10 4-8 3 3h60" fill="none" stroke="#d7a9ba" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
function SectionTitle({ en, cn, right }: { en: string; cn: string; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-end justify-between">
      <p className="flex items-baseline gap-2">
        <span className="text-[13.5px] font-bold" style={{ color: INK }}>{cn}</span>
        <span className="text-[10px] italic tracking-[0.18em]" style={{ color: SOFT, fontFamily: MONO }}>{en}</span>
      </p>
      {right}
    </div>
  );
}
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-[#5a4450]/25 p-5 backdrop-blur-[2px]" onClick={onClose}>
      <div className={`${CARD} max-h-[86%] w-full max-w-[340px] overflow-y-auto bg-[#fffafc]/95 p-4`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[14.5px] font-bold" style={{ color: INK }}>{title}</p>
          <button onClick={onClose} className="text-[18px] leading-none" style={{ color: SOFT }} aria-label="关闭">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Upload({ label, onPick, className = BTN }: { label: string; onPick: (src: string) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()}>{label}</button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) onPick(await readImage(f));
      }} />
    </>
  );
}

/* ═══ 情侣邀约 ═══ */
const INVITE_TPL = ["想和你有一个只属于我们两个人的地方。", "要不要和我一起，把以后的日子都记下来？", "我开通了情侣空间，第一个想邀请的人就是你。"];

function InviteView({ data, update, me, online, onBound }: { data: CoupleData; update: (fn: (d: CoupleData) => CoupleData) => void; me: Me; online: boolean; onBound: () => void }) {
  const { game, cfg, patchGame } = useGame();
  const g = game!;
  const [pick, setPick] = useState<string | null>(null);
  const [text, setText] = useState(INVITE_TPL[0]);
  const [busy, setBusy] = useState(false);
  const full = data.bindings.length >= MAX_BINDINGS;
  const people = g.npcs.filter((n) => !data.bindings.includes(n.id) && canRomance(g.sim, n.id)); // 家人、子女与不可攻略的人不在邀约名单里
  const target = g.npcs.find((n) => n.id === pick);

  const send = async () => {
    if (!target || !text.trim() || busy) return;
    setBusy(true);
    const inv = { id: uidc(), charId: target.id, text: text.trim(), day: g.sim.day, ts: Date.now() };
    update((d) => ({ ...d, invites: [inv, ...d.invites] }));
    memoOf(patchGame, target.id, "player", `${me.name}通过情侣空间向我发出了绑定邀约：「${inv.text.slice(0, 60)}」`);
    try {
      const p = await askChar<{ accept?: unknown; reply?: unknown }>(cfg, g, target,
        `你是${target.name}。主角${me.name !== g.player.name ? `（在情侣空间里的昵称叫「${me.name}」）` : ""}通过手机里的「情侣空间」App 向你发来绑定邀约——绑定后你们会共享纪念日、信箱和每日问答。邀约留言：「${inv.text}」。
${relLine(g, target)}
请完全依照你的性格与你们真实的关系进度决定是否接受：已是恋人则大概率接受；暧昧中可以害羞地接受或想再等等；关系不到位就委婉拒绝。然后写一段给 TA 的回复（50~180 字，第一人称，口吻贴合人设，不要旁白和动作描写）。
返回 JSON：{"accept": true 或 false, "reply": "回复内容"}`);
      const reply = S(p?.reply, 400);
      const accept = p?.accept === true || p?.accept === "true";
      update((d) => {
        const invites = d.invites.map((x) => (x.id === inv.id ? { ...x, reply: reply || undefined, accept: reply ? accept : undefined, failed: !reply } : x));
        if (!reply || !accept || d.bindings.length >= MAX_BINDINGS) return { ...d, invites };
        const sp = d.spaces[target.id] ? { ...d.spaces[target.id], since: g.sim.day } : newSpace(target.id, g.sim.day);
        return { ...d, invites, bindings: [...d.bindings, target.id], spaces: { ...d.spaces, [target.id]: sp } };
      });
      if (reply) setPick(null);
      if (reply && accept && getCouple(g.id)?.bindings.includes(target.id)) {
        memoOf(patchGame, target.id, "self", `我接受了主角的情侣空间邀约，从今天起我们绑定了情侣空间`);
        settleBond(g.id, target.id, "invite", patchGame);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className={`${CARD} mt-1 px-4 py-5 text-center`}>
        <div className="flex items-center justify-center gap-3">
          <Ava src={me.avatar} name={me.name} />
          <span style={{ color: ROSE }}><IconHeart size={18} /></span>
          {target ? <Ava src={target.avatar} name={target.name} /> : <span className="grid h-14 w-14 place-items-center rounded-full border border-dashed border-[#dcc6cf] text-[20px]" style={{ color: "#d6bfc8" }}>?</span>}
        </div>
        <p className="mt-3 text-[14px] font-bold">{target ? `邀请 ${target.name} 绑定情侣空间` : "选择一位，发出空间邀约"}</p>
        <p className="mt-1 text-[11.5px]" style={{ color: SOFT }}>TA 会依照自己的性格和你们的关系进度决定是否接受</p>
        <Pulse />
      </div>

      {full ? (
        <p className={`${CARD} mt-3 px-4 py-3 text-[12px] leading-relaxed`} style={{ color: SOFT }}>当前一个身份只能绑定一位。后续版本会支持一个身份绑定多位，敬请期待。</p>
      ) : (
        <>
          <SectionTitle cn="选择 TA" en="choose" />
          <div className="grid grid-cols-4 gap-2">
            {people.map((n) => {
              const on = n.id === pick;
              return (
                <button key={n.id} onClick={() => setPick(n.id)} className={`flex flex-col items-center gap-1 rounded-[14px] border px-1 py-2 transition ${on ? "border-[#c4607e]/60 bg-[#c4607e]/10" : "border-transparent"}`}>
                  <Ava src={n.avatar} name={n.name} size={46} />
                  <span className="w-full truncate text-center text-[11px] font-medium">{n.name}</span>
                  <span className="inline-flex items-center gap-0.5 text-[9.5px]" style={{ color: SOFT, fontFamily: MONO }}><IconHeart size={10} /> {n.affinity}</span>
                </button>
              );
            })}
            {!people.length && <p className="col-span-4 py-6 text-center text-[12px]" style={{ color: SOFT }}>还没有认识的人。先去剧情里结识一些人吧。</p>}
          </div>

          {target && (
            <>
              <SectionTitle cn="邀约留言" en="message" />
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 200))} rows={3} className={`${INPUT} resize-none leading-relaxed`} placeholder="写下想对 TA 说的话…" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {INVITE_TPL.map((t) => <button key={t} onClick={() => setText(t)} className="rounded-full border border-[#ecdbe2] bg-white/50 px-2.5 py-1 text-[11px]" style={{ color: SOFT }}>{t.slice(0, 10)}…</button>)}
              </div>
              <button onClick={send} disabled={busy || !online || !text.trim()} className={`${BTN_ROSE} mt-3 w-full`}>{busy ? `${target.name} 正在看你的邀约…` : "发送空间邀约"}</button>
              {!online && <p className="mt-2 text-center text-[11px]" style={{ color: SOFT }}>需要先在游戏设置里接入 AI，TA 才能回复你的邀约。</p>}
            </>
          )}
        </>
      )}

      {data.invites.length > 0 && (
        <>
          <SectionTitle cn="邀约记录" en="history" />
          <div className="space-y-2">
            {data.invites.slice(0, 12).map((inv) => {
              const n = g.npcs.find((x) => x.id === inv.charId);
              const state = inv.reply ? (inv.accept ? "已接受" : "婉拒了") : inv.failed ? "未送达" : "等待回复";
              return (
                <div key={inv.id} className={`${CARD} px-3.5 py-3`}>
                  <div className="flex items-center gap-2">
                    <Ava src={n?.avatar} name={n?.name ?? "?"} size={30} />
                    <p className="flex-1 text-[12.5px] font-bold">{n?.name ?? "已离开"}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] ${inv.accept ? "bg-[#c4607e]/12 text-[#b0506e]" : "bg-[#efe4e8] text-[#a08894]"}`}>{state}</span>
                  </div>
                  <p className="mt-2 text-[11.5px]" style={{ color: SOFT }}>我：{inv.text}</p>
                  {inv.reply && <p className="mt-1.5 border-l-2 border-[#e6c3d0] pl-2 text-[12.5px] leading-relaxed">{inv.reply}</p>}
                  {inv.accept && data.bindings.includes(inv.charId) && <button onClick={onBound} className={`${BTN} mt-2`}>进入我们的空间 →</button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══ 主页 ═══ */
function HomeView({ data, space, npc, me, day, go, todays, celebrated, celebrating, onCelebrate }: {
  data: CoupleData; space: Space; npc: Npc; me: Me; day: number; go: (v: View) => void;
  todays: string[]; celebrated: boolean; celebrating: boolean; onCelebrate: () => void;
}) {
  const together = Math.max(1, day - space.since + 1);
  const unread = space.letters.filter((l) => l.from === "char" && !l.read).length;
  const q = COUPLE_QUESTIONS[space.qa.cur % COUPLE_QUESTIONS.length];
  const answered = space.qa.history.at(-1)?.q === space.qa.cur;
  const lastLetter = [...space.letters].reverse().find((l) => l.from === "char") ?? space.letters.at(-1);
  const next = upcoming(space, day);
  const { m, d, dow } = dayParts(day);
  const WD = ["日", "一", "二", "三", "四", "五", "六"];

  const Tile = ({ v, icon, label, sub, badge }: { v: View; icon: ReactNode; label: string; sub: string; badge?: number }) => (
    <button onClick={() => go(v)} className={`${CARD} relative flex flex-col items-start gap-1 px-3.5 py-3 text-left transition active:scale-[0.98]`}>
      <span className="grid h-9 w-9 place-items-center rounded-[12px] border border-[#dcc6cf] bg-white/70 text-[16px]" style={{ color: ROSE }}>{icon}</span>
      <span className="mt-0.5 text-[13px] font-bold">{label}</span>
      <span className="line-clamp-2 text-[10.5px] leading-snug" style={{ color: SOFT }}>{sub}</span>
      {!!badge && <span className="absolute right-2.5 top-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#c4607e] px-1 text-[10px] font-bold text-white">{badge}</span>}
    </button>
  );

  return (
    <div>
      <div className="mt-1 flex items-start justify-center gap-6">
        <div className="flex flex-col items-center gap-1"><Ava src={me.avatar} name={me.name} size={64} /><span className="max-w-[80px] truncate text-[11.5px] font-medium">{me.name}</span></div>
        <span className="mt-6" style={{ color: ROSE }}><IconHeart size={14} /></span>
        <div className="flex flex-col items-center gap-1"><Ava src={npc.avatar} name={npc.name} size={64} /><span className="max-w-[80px] truncate text-[11.5px] font-medium">{npc.name}</span></div>
      </div>

      {todays.length > 0 && (
        <div className={`${CARD} mt-3 border-[#e7b7c8] bg-[#fff2f6]/70 px-4 py-3 text-center`}>
          <p className="text-[10px] tracking-[0.3em]" style={{ color: ROSE, fontFamily: MONO }}>ANNIVERSARY</p>
          <p className="mt-1 text-[14px] font-bold">今天是 {todays.join(" · ")}</p>
          <button onClick={onCelebrate} disabled={celebrated || celebrating} className={`${BTN_ROSE} mt-2`}>
            {celebrated ? `已和 ${npc.name} 一起过` : celebrating ? `${npc.name} 正在写信给你…` : `和 ${npc.name} 一起过`}
          </button>
        </div>
      )}

      <div className={`${CARD} mt-3 flex items-center gap-3 px-3 py-3`}>
        <Ava src={me.avatar} name={me.name} size={34} />
        <div className="flex-1 text-center">
          <p className="text-[30px] font-bold leading-none" style={{ fontFamily: MONO, color: INK }}>{together}</p>
          <p className="mt-1 text-[9px] tracking-[0.32em]" style={{ color: SOFT, fontFamily: MONO }}>DAYS TOGETHER</p>
          <Pulse />
        </div>
        <Ava src={npc.avatar} name={npc.name} size={34} />
      </div>

      <div className="mt-3 grid grid-cols-[1.15fr_1fr] gap-2.5">
        <div className={`${CARD} px-3.5 py-3`}>
          <p className="text-[28px] font-bold leading-none tracking-wider" style={{ fontFamily: MONO, color: INK }}>{String(m).padStart(2, "0")}.{String(d).padStart(2, "0")}</p>
          <p className="mt-1.5 text-[11px]" style={{ color: SOFT }}>{dayDateLabel(day)} 星期{WD[dow]}</p>
          <p className="mt-1 text-[10.5px] italic" style={{ color: "#c9a3b3", fontFamily: MONO }}>• dreaming of you…</p>
        </div>
        <Tile v="anniv" icon={<IconCalendar size={16} />} label="纪念日" sub={next ? `${next.name} · ${next.text}` : "记下属于你们的日子"} />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Tile v="qa" icon="?" label="每日问答" sub={answered ? "今天已作答 · 去看看 TA 的答案" : q} />
        <Tile v="mail" icon={<IconMail size={16} />} label="信箱" sub={unread ? `TA 寄来了 ${unread} 封新信` : "写一封信给 TA"} badge={unread} />
      </div>

      <button onClick={() => go("mail")} className={`${CARD} relative mt-3 block w-full overflow-hidden px-4 py-3 pl-5 text-left`}>
        <span aria-hidden className="absolute inset-y-3 left-2 w-[3px] rounded-full bg-[#e3a9bd]" />
        <div className="flex items-baseline justify-between">
          <p className="text-[14px] font-bold italic" style={{ color: "#b98aa0", fontFamily: MONO }}>Our Letters</p>
          <p className="text-[10px]" style={{ color: SOFT, fontFamily: MONO }}>{lastLetter ? dayDateLabel(lastLetter.day) : dayDateLabel(day)}</p>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed" style={{ color: INK }}>{lastLetter ? letterText(lastLetter) : "信箱还空着——第一封信，由你来写吧。"}</p>
        <p className="mt-1.5 inline-block rounded-full bg-[#c4607e]/10 px-2 py-0.5 text-[10px] font-bold" style={{ color: ROSE, fontFamily: MONO }}>Day {together}</p>
        {lastLetter && <p className="mt-1 text-[10.5px]" style={{ color: SOFT }}>From {lastLetter.from === "char" ? npc.name : me.name}</p>}
      </button>
      {!data.bg && <p className="mt-3 text-center text-[10.5px]" style={{ color: "#c5b3bb" }}>右上角 可以更换主页背景</p>}
    </div>
  );
}

/* 最近的纪念日（含在一起天数里程碑） */
function annivInfo(a: Anniv, space: Space, today: number): { text: string; future: boolean; delta: number } {
  if (a.builtin) { const n = Math.max(1, today - space.since + 1); return { text: `第 ${n} 天`, future: false, delta: n }; }
  const at = dayOfIso(a.date);
  if (at == null) return { text: "未设日期", future: false, delta: 0 };
  const diff = today - at;
  return diff >= 0 ? { text: `已经 ${diff} 天`, future: false, delta: diff } : { text: `还有 ${-diff} 天`, future: true, delta: -diff };
}
function upcoming(space: Space, today: number): { name: string; text: string } | null {
  const fut = space.annivs.filter((a) => !a.builtin).map((a) => ({ a, i: annivInfo(a, space, today) })).filter((x) => x.i.future).sort((x, y) => x.i.delta - y.i.delta)[0];
  if (fut) return { name: fut.a.name, text: fut.i.text };
  const b = space.annivs.find((a) => a.builtin);
  return b ? { name: b.name, text: annivInfo(b, space, today).text } : null;
}

/* ═══ 每日问答 ═══ */
function QaView({ space, npc, me, day, online, setSpace, memo }: { space: Space; npc: Npc; me: { name: string }; day: number; online: boolean; setSpace: (fn: (s: Space) => Space) => void; memo: (t: string) => void }) {
  const { game, cfg, patchGame } = useGame();
  const [mine, setMine] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const total = COUPLE_QUESTIONS.length;
  const rec = space.qa.history.at(-1);
  const answered = rec?.q === space.qa.cur;

  // 已作答且跨到新的一天 → 换下一题；没答就一直保留这道题
  useEffect(() => {
    if (answered && space.qa.answeredDay != null && day > space.qa.answeredDay) {
      setSpace((s) => ({ ...s, qa: { ...s.qa, cur: s.qa.cur + 1, answeredDay: undefined } }));
    }
  }, [answered, day, space.qa.answeredDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = COUPLE_QUESTIONS[space.qa.cur % total];
  const askTheirs = async (qi: number, myAns: string) => {
    setBusy(true);
    try {
      const p = await askChar<{ answer?: unknown }>(cfg, game!, npc,
        `你是${npc.name}。你们在情侣空间里做每日问答。题目：「${COUPLE_QUESTIONS[qi % total]}」。主角的回答：「${myAns}」。
${relLine(game!, npc)}
请以${npc.name}的身份写下你自己对这道题的回答（30~120 字，第一人称，真诚、贴合人设与你们真实的关系；可以对主角的回答有一点回应，但重点是你自己的答案，不要旁白）。
返回 JSON：{"answer": "你的回答"}`);
      const a = S(p?.answer, 300);
      if (a) {
        setSpace((s) => ({ ...s, qa: { ...s.qa, history: s.qa.history.map((h) => (h.q === qi && !h.theirs ? { ...h, theirs: a } : h)) } }));
        memoOf(patchGame, npc.id, "self", `情侣空间每日问答「${COUPLE_QUESTIONS[qi % total]}」，我答：${a.slice(0, 50)}`);
        settleBond(game!.id, npc.id, "qa", patchGame);
      }
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const t = mine.trim();
    if (!t || answered) return;
    const qi = space.qa.cur;
    setSpace((s) => ({ ...s, qa: { ...s.qa, answeredDay: day, history: [...s.qa.history, { q: qi, mine: t, theirs: "", day }] } }));
    memo(`我们在情侣空间回答了问题「${COUPLE_QUESTIONS[qi % total]}」，${me.name}答：${t.slice(0, 60)}`);
    setMine("");
    if (online) void askTheirs(qi, t);
  };

  return (
    <div>
      <div className={`${CARD} mt-1 px-4 py-5`}>
        <p className="text-[10px] tracking-[0.3em]" style={{ color: SOFT, fontFamily: MONO }}>QUESTION {String((space.qa.cur % total) + 1).padStart(3, "0")} / {total}</p>
        <p className="mt-2 text-[16px] font-bold leading-relaxed">{q}</p>
        <Pulse />
      </div>

      {!answered ? (
        <div className="mt-3">
          <textarea value={mine} onChange={(e) => setMine(e.target.value.slice(0, 300))} rows={4} className={`${INPUT} resize-none leading-relaxed`} placeholder="写下你的答案。只有你作答之后，才能看到 TA 的答案。" />
          <button onClick={submit} disabled={!mine.trim()} className={`${BTN_ROSE} mt-2.5 w-full`}>提交答案</button>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          <AnswerCard who={me.name} text={rec!.mine} />
          {rec!.theirs ? <AnswerCard who={npc.name} text={rec!.theirs} rose /> : (
            <div className={`${CARD} px-4 py-3 text-center text-[12px]`} style={{ color: SOFT }}>
              {busy ? `${npc.name} 正在认真作答…` : online ? <button className={BTN} onClick={() => askTheirs(rec!.q, rec!.mine)}>请 TA 作答</button> : "接入 AI 后，TA 才能写下自己的答案。"}
            </div>
          )}
          <p className="pt-1 text-center text-[11px]" style={{ color: SOFT }}>今天已作答 · 下一道题会在明天出现</p>
        </div>
      )}

      {space.qa.history.length > 1 && (
        <>
          <SectionTitle cn="回答过的题" en="archive" right={<button className="text-[11px]" style={{ color: ROSE }} onClick={() => setShowHist((v) => !v)}>{showHist ? "收起" : `展开 ${space.qa.history.length - (answered ? 1 : 0)} 题`}</button>} />
          {showHist && (
            <div className="space-y-2">
              {space.qa.history.slice(0, answered ? -1 : undefined).reverse().map((h) => (
                <div key={`${h.q}-${h.day}`} className={`${CARD} px-3.5 py-3`}>
                  <p className="text-[10px]" style={{ color: SOFT, fontFamily: MONO }}>{dayDateLabel(h.day)} · Q{(h.q % total) + 1}</p>
                  <p className="mt-1 text-[12.5px] font-bold">{COUPLE_QUESTIONS[h.q % total]}</p>
                  <p className="mt-1.5 text-[12px]"><b>{me.name}：</b>{h.mine}</p>
                  <p className="mt-1 text-[12px]" style={{ color: "#a4566f" }}><b>{npc.name}：</b>{h.theirs || "（未作答）"}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
function AnswerCard({ who, text, rose }: { who: string; text: string; rose?: boolean }) {
  return (
    <div className={`${CARD} px-4 py-3`}>
      <p className="text-[11px] font-bold" style={{ color: rose ? ROSE : SOFT }}>{who} 的答案</p>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{text}</p>
    </div>
  );
}

/* ═══ 信纸：文字块可自由拖动（编辑态），阅读态只读 ═══ */
function Paper({ letter, papers, editable, selected, onSelect, onMove }: {
  letter: Pick<Letter, "paper" | "font" | "color" | "size" | "blocks" | "from">; papers: CoupleData["papers"]; editable?: boolean;
  selected?: string | null; onSelect?: (id: string) => void; onMove?: (id: string, x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const st = paperStyle(letter.paper, papers);
  const fs = `calc(${letter.size} / 300 * 100cqw)`;
  // TA 的回信是一整段文字：用自然排版，长信不会被裁掉
  if (letter.from === "char") {
    return (
      <div className="w-full overflow-hidden rounded-[14px] border border-[#dcc6cf] shadow-[inset_0_0_14px_rgba(236,170,190,0.15)]" style={{ background: st.background, containerType: "inline-size" }}>
        <p className="min-h-[60cqw] whitespace-pre-wrap px-[8%] py-[8%] leading-[1.75]" style={{ fontFamily: fontOf(letter.font), color: letter.color, fontSize: fs }}>{letterText(letter as Letter)}</p>
      </div>
    );
  }
  return (
    <div ref={ref} className="relative aspect-[3/4] w-full overflow-hidden rounded-[14px] border border-[#dcc6cf] shadow-[inset_0_0_14px_rgba(236,170,190,0.15)]" style={{ background: st.background, containerType: "inline-size" }}>
      {letter.blocks.map((b: Block) => (
        <div key={b.id}
          onPointerDown={editable ? (e) => {
            const r = ref.current!.getBoundingClientRect();
            drag.current = { id: b.id, dx: e.clientX - (r.left + (b.x / 100) * r.width), dy: e.clientY - (r.top + (b.y / 100) * r.height) };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onSelect?.(b.id);
          } : undefined}
          onPointerMove={editable ? (e) => {
            const dr = drag.current;
            if (!dr || dr.id !== b.id) return;
            const r = ref.current!.getBoundingClientRect();
            const x = Math.min(90, Math.max(0, ((e.clientX - dr.dx - r.left) / r.width) * 100));
            const y = Math.min(94, Math.max(0, ((e.clientY - dr.dy - r.top) / r.height) * 100));
            onMove?.(b.id, Math.round(x * 10) / 10, Math.round(y * 10) / 10);
          } : undefined}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          className={`absolute whitespace-pre-wrap break-words leading-[1.6] ${editable ? "cursor-grab touch-none select-none rounded-md px-1 active:cursor-grabbing" : ""} ${editable && selected === b.id ? "outline-dashed outline-1 outline-[#c4607e]/70" : ""}`}
          style={{ left: `${b.x}%`, top: `${b.y}%`, maxWidth: `${Math.max(20, 96 - b.x)}%`, fontFamily: fontOf(letter.font), color: letter.color, fontSize: fs }}>
          {b.text || (editable ? <span className="opacity-40">点下方输入文字</span> : "")}
        </div>
      ))}
    </div>
  );
}

/* ═══ 信箱：写信 / 往来信件 ═══ */
type Draft = Pick<Letter, "paper" | "font" | "color" | "size" | "blocks">;
const freshDraft = (): Draft => ({ paper: "lined", font: "longcang", color: PAPERS[1].ink, size: 17, blocks: [{ id: uidc(), text: "", x: 8, y: 7 }] });

function MailView({ data, update, space, npc, me, day, online, setSpace, memo }: {
  data: CoupleData; update: (fn: (d: CoupleData) => CoupleData) => void; space: Space; npc: Npc; me: { name: string }; day: number; online: boolean;
  setSpace: (fn: (s: Space) => Space) => void; memo: (t: string) => void;
}) {
  const { game, cfg, patchGame } = useGame();
  const [tab, setTab] = useState<"write" | "box">(space.letters.some((l) => l.from === "char" && !l.read) ? "box" : "write");
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [sel, setSel] = useState<string | null>(draft.blocks[0]?.id ?? null);
  const [open, setOpen] = useState<Letter | null>(null);
  const [, force] = useState(0);
  const cur = draft.blocks.find((b) => b.id === sel);
  const gameId = game!.id;
  const charFont = charFontOf(npc.id);

  const setBlock = (id: string, p: Partial<Block>) => setDraft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...p } : b)) }));
  const addBlock = () => { const b = { id: uidc(), text: "", x: 10, y: Math.min(80, 10 + draft.blocks.length * 14) }; setDraft((d) => ({ ...d, blocks: [...d.blocks, b] })); setSel(b.id); };
  const delBlock = () => { if (!sel || draft.blocks.length <= 1) return; setDraft((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== sel) })); setSel(draft.blocks.find((b) => b.id !== sel)?.id ?? null); };
  const body = draft.blocks.map((b) => b.text.trim()).filter(Boolean).join("\n");

  const requestReply = async (mine: Letter) => {
    if (inflight.has(mine.id) || !online) return;
    inflight.add(mine.id); force((n) => n + 1);
    const history = space.letters.filter((l) => l.id !== mine.id).slice(-4).map((l) => `${l.from === "me" ? me.name : npc.name}：${letterText(l).slice(0, 120)}`).join("\n");
    try {
      const p = await askChar<{ reply?: unknown }>(cfg, game!, npc,
        `你是${npc.name}。主角${me.name !== game!.player.name ? `（情侣空间昵称「${me.name}」）` : ""}在情侣空间的信箱里给你寄来一封亲笔信：
「${letterText(mine)}」
${history ? `【你们之前的往来信件（节选）】\n${history}\n` : ""}${relLine(game!, npc)}
请以${npc.name}的身份写一封回信（120~380 字，可分段，有称呼与落款；第一人称，口吻贴合人设与你们真实的关系；回应信里的具体内容，不要复述原文，不要旁白）。
返回 JSON：{"reply": "回信正文"}`);
      const reply = S(p?.reply, 1200);
      updateCouple(gameId, (d) => {
        const sp = d.spaces[npc.id];
        if (!sp) return d;
        const letters = sp.letters.map((l) => (l.id === mine.id ? { ...l, status: (reply ? "replied" : "failed") as Letter["status"] } : l));
        if (reply) letters.push({ id: uidc(), from: "char", paper: mine.paper, font: charFont, color: mine.color, size: 15, blocks: [{ id: uidc(), text: reply, x: 8, y: 6 }], day: game!.sim.day, ts: Date.now(), read: false, replyTo: mine.id });
        return { ...d, spaces: { ...d.spaces, [npc.id]: { ...sp, letters } } };
      });
      if (reply) {
        memoOf(patchGame, npc.id, "self", `我在情侣空间给主角回了信：${reply.slice(0, 70)}`);
        const note = settleBond(gameId, npc.id, "letter", patchGame);
        toast(`${npc.name} 的回信到了${note ? ` · ${note}` : ""}`);
      }
    } finally {
      inflight.delete(mine.id); force((n) => n + 1);
    }
  };
  const send = () => {
    if (!body) return;
    const letter: Letter = { ...draft, id: uidc(), from: "me", day, ts: Date.now(), status: "waiting" };
    setSpace((s) => ({ ...s, letters: [...s.letters, letter] }));
    memo(`${me.name}在情侣空间给我寄了一封信：${body.slice(0, 80)}`);
    setDraft(freshDraft()); setSel(null); setTab("box");
    void requestReply(letter);
  };
  const view = (l: Letter) => {
    setOpen(l);
    if (l.from === "char" && !l.read) setSpace((s) => ({ ...s, letters: s.letters.map((x) => (x.id === l.id ? { ...x, read: true } : x)) }));
  };
  const addPaper = (src: string) => { const id = `u_${uidc()}`; update((d) => ({ ...d, papers: [...d.papers, { id, src }] })); setDraft((d) => ({ ...d, paper: id })); };
  const pickPaper = (id: string) => setDraft((d) => ({ ...d, paper: id, color: PAPERS.find((p) => p.id === id)?.ink ?? d.color }));
  const sorted = [...space.letters].sort((a, b) => b.ts - a.ts);

  return (
    <div>
      <div className={`${CARD} mt-1 grid grid-cols-2 p-1`}>
        {(["write", "box"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-[14px] py-2 text-[12.5px] font-bold transition ${tab === t ? "bg-[#c4607e]/12 text-[#b0506e]" : "text-[#a08894]"}`}>
            {t === "write" ? "写信" : `往来信件 · ${space.letters.length}`}
          </button>
        ))}
      </div>

      {tab === "write" ? (
        <div className="mt-3">
          <Paper letter={{ ...draft, from: "me" }} papers={data.papers} editable selected={sel} onSelect={setSel} onMove={(id, x, y) => setBlock(id, { x, y })} />
          <p className="mt-1.5 text-center text-[10.5px]" style={{ color: SOFT }}>按住文字可在信纸上自由拖动摆放</p>

          {cur && (
            <textarea value={cur.text} onChange={(e) => setBlock(cur.id, { text: e.target.value.slice(0, 600) })} rows={3} className={`${INPUT} mt-2 resize-none leading-relaxed`} placeholder="这一段写些什么…" />
          )}
          <div className="mt-2 flex gap-2">
            <button onClick={addBlock} className={BTN} disabled={draft.blocks.length >= 8}>＋ 文字块</button>
            <button onClick={delBlock} className={BTN} disabled={draft.blocks.length <= 1}>删除选中</button>
          </div>

          <SectionTitle cn="信纸" en="paper" right={<Upload label="＋ 上传信纸" onPick={addPaper} className="text-[11px] text-[#c4607e]" />} />
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {[...PAPERS.map((p) => ({ id: p.id, label: p.label, bg: p.bg })), ...data.papers.map((p, i) => ({ id: p.id, label: `自定义${i + 1}`, bg: `center/cover url(${p.src})` }))].map((p) => (
              <button key={p.id} onClick={() => pickPaper(p.id)} className="flex shrink-0 flex-col items-center gap-1">
                <span className={`block h-14 w-11 rounded-[8px] border ${draft.paper === p.id ? "border-[#c4607e] ring-2 ring-[#c4607e]/25" : "border-[#dcc6cf]"}`} style={{ background: p.bg }} />
                <span className="text-[10px]" style={{ color: draft.paper === p.id ? ROSE : SOFT }}>{p.label}</span>
              </button>
            ))}
          </div>

          <SectionTitle cn="字体" en="font" />
          <div className="flex flex-wrap gap-1.5">
            {FONTS.map((f) => (
              <button key={f.id} onClick={() => setDraft((d) => ({ ...d, font: f.id }))} className={`rounded-[10px] border px-2.5 py-1 text-[14px] ${draft.font === f.id ? "border-[#c4607e]/60 bg-[#c4607e]/10 text-[#b0506e]" : "border-[#dcc6cf] bg-white/50"}`} style={{ fontFamily: f.family }}>{f.label}</button>
            ))}
          </div>

          <SectionTitle cn="墨色与字号" en="ink" />
          <div className="flex items-center gap-2">
            {INKS.map((c) => <button key={c} onClick={() => setDraft((d) => ({ ...d, color: c }))} aria-label={c} className={`h-6 w-6 rounded-full border ${draft.color === c ? "ring-2 ring-[#c4607e]/50 ring-offset-1" : ""} border-[#dcc6cf]`} style={{ background: c }} />)}
            <input type="range" min={12} max={26} value={draft.size} onChange={(e) => setDraft((d) => ({ ...d, size: +e.target.value }))} className="ml-1 flex-1 accent-[#c4607e]" aria-label="字号" />
            <span className="w-6 text-right text-[11px]" style={{ color: SOFT, fontFamily: MONO }}>{draft.size}</span>
          </div>

          <button onClick={send} disabled={!body} className={`${BTN_ROSE} mt-4 w-full`}>投递给 {npc.name}</button>
          {!online && <p className="mt-2 text-center text-[11px]" style={{ color: SOFT }}>未接入 AI：信件会先寄出保存，接入后可请 TA 回信。</p>}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {!sorted.length && <p className={`${CARD} px-4 py-8 text-center text-[12px]`} style={{ color: SOFT }}>还没有信件。写下第一封吧。</p>}
          {sorted.map((l) => {
            const waiting = l.from === "me" && l.status !== "replied";
            const pending = inflight.has(l.id);
            return (
              <div key={l.id} className={`${CARD} flex items-start gap-3 px-3.5 py-3`}>
                <button onClick={() => view(l)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <span className="mt-0.5 block h-11 w-8 shrink-0 rounded-[6px] border border-[#dcc6cf]" style={{ background: paperStyle(l.paper, data.papers).background }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold">
                      {l.from === "me" ? `我 → ${npc.name}` : `${npc.name} → 我`}
                      {l.from === "char" && !l.read && <span className="h-1.5 w-1.5 rounded-full bg-[#c4607e]" />}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: SOFT }}>{letterText(l) || "（空白信纸）"}</span>
                    <span className="mt-0.5 block text-[10px]" style={{ color: "#c5b3bb", fontFamily: MONO }}>{dayDateLabel(l.day)}</span>
                  </span>
                </button>
                {waiting && (
                  pending ? <span className="shrink-0 pt-1 text-[10.5px]" style={{ color: ROSE }}>TA 正在回信…</span>
                    : online ? <button onClick={() => requestReply(l)} className={`${BTN} shrink-0 !px-2.5 !py-1 !text-[11px]`}>{l.status === "failed" ? "重新请求回信" : "等待回信"}</button>
                      : <span className="shrink-0 pt-1 text-[10.5px]" style={{ color: SOFT }}>待回信</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <Sheet title={open.from === "me" ? `寄给 ${npc.name}` : `${npc.name} 的来信`} onClose={() => setOpen(null)}>
          <Paper letter={open} papers={data.papers} />
          <p className="mt-2 text-right text-[10.5px]" style={{ color: SOFT, fontFamily: MONO }}>{dayDateLabel(open.day)}</p>
        </Sheet>
      )}
    </div>
  );
}

/* ═══ 纪念日 ═══ */
function AnnivView({ space, day, setSpace }: { space: Space; day: number; setSpace: (fn: (s: Space) => Space) => void }) {
  const [edit, setEdit] = useState<Anniv | null>(null);
  const list = useMemo(() => [...space.annivs].sort((a, b) => Number(!!b.builtin) - Number(!!a.builtin)), [space.annivs]);
  const save = (a: Anniv) => {
    setSpace((s) => ({ ...s, annivs: s.annivs.some((x) => x.id === a.id) ? s.annivs.map((x) => (x.id === a.id ? a : x)) : [...s.annivs, a] }));
    setEdit(null);
  };
  const remove = (id: string) => { setSpace((s) => ({ ...s, annivs: s.annivs.filter((x) => x.id !== id) })); setEdit(null); };

  return (
    <div>
      <div className="mt-1 space-y-2.5">
        {list.map((a) => {
          const info = annivInfo(a, space, day);
          return (
            <button key={a.id} onClick={() => setEdit(a)} className={`${CARD} block w-full overflow-hidden text-left transition active:scale-[0.99]`}>
              {a.img && <img src={(a.img) || undefined} alt="" className="h-28 w-full object-cover" />}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold" style={{ color: a.color }}>{a.name}</p>
                  <p className="mt-0.5 text-[10.5px]" style={{ color: SOFT, fontFamily: MONO }}>{a.builtin ? `since ${dayDateLabel(space.since)}` : a.date ? a.date.replace(/-/g, ".") : "未设日期"}</p>
                </div>
                <p className="text-right">
                  <span className="block text-[22px] font-bold leading-none" style={{ color: a.color, fontFamily: MONO }}>{info.delta}</span>
                  <span className="text-[10px]" style={{ color: SOFT }}>{a.builtin ? "天 · 在一起" : info.future ? "天后" : "天"}</span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <button onClick={() => setEdit({ id: uidc(), name: "", date: isoOfDay(day), color: ANNIV_COLORS[1] })} className={`${BTN_ROSE} mt-3 w-full`}>＋ 新增纪念日</button>
      {edit && <AnnivEditor a={edit} isNew={!space.annivs.some((x) => x.id === edit.id)} onSave={save} onDelete={remove} onClose={() => setEdit(null)} />}
    </div>
  );
}
function AnnivEditor({ a, isNew, onSave, onDelete, onClose }: { a: Anniv; isNew: boolean; onSave: (a: Anniv) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [v, setV] = useState(a);
  return (
    <Sheet title={isNew ? "新增纪念日" : "编辑纪念日"} onClose={onClose}>
      <label className="mb-1 block text-[11.5px] font-bold" style={{ color: SOFT }}>名称</label>
      <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value.slice(0, 20) })} className={INPUT} placeholder="如：第一次约会" style={{ color: v.color }} />
      {!v.builtin && (
        <>
          <label className="mb-1 mt-3 block text-[11.5px] font-bold" style={{ color: SOFT }}>日期（游戏内日历）</label>
          <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={INPUT} />
        </>
      )}
      <label className="mb-1 mt-3 block text-[11.5px] font-bold" style={{ color: SOFT }}>字体颜色</label>
      <div className="flex flex-wrap items-center gap-2">
        {ANNIV_COLORS.map((c) => <button key={c} onClick={() => setV({ ...v, color: c })} aria-label={c} className={`h-6 w-6 rounded-full border border-[#dcc6cf] ${v.color === c ? "ring-2 ring-[#c4607e]/50 ring-offset-1" : ""}`} style={{ background: c }} />)}
        <input type="color" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-[#dcc6cf] bg-transparent" aria-label="自定义颜色" />
      </div>
      <label className="mb-1 mt-3 block text-[11.5px] font-bold" style={{ color: SOFT }}>图片</label>
      {v.img && <img src={(v.img) || undefined} alt="" className="mb-2 h-28 w-full rounded-[12px] border border-[#dcc6cf] object-cover" />}
      <div className="flex gap-2">
        <Upload label={v.img ? "更换图片" : "上传图片"} onPick={(src) => setV({ ...v, img: src })} />
        {v.img && <button className={BTN} onClick={() => setV({ ...v, img: undefined })}>移除</button>}
      </div>
      <div className="mt-4 flex gap-2">
        {!isNew && !v.builtin && <button onClick={() => onDelete(v.id)} className={`${BTN} text-[#c0566d]`}>删除</button>}
        <button onClick={() => onSave({ ...v, name: v.name.trim() || (v.builtin ? "我们在一起" : "纪念日") })} disabled={!v.builtin && !v.date} className={`${BTN_ROSE} flex-1`}>保存</button>
      </div>
    </Sheet>
  );
}

/* ═══ 主页装扮 · 我的身份 · 绑定 ═══ */
function DressView({ data, update, npc, space, onUnbound }: { data: CoupleData; update: (fn: (d: CoupleData) => CoupleData) => void; npc?: Npc; space?: Space; onUnbound: () => void }) {
  const { game } = useGame();
  const g = game!;
  const [confirm, setConfirm] = useState(false);
  const id = data.identity;
  return (
    <div>
      <SectionTitle cn="主页背景" en="background" />
      <div className={`${CARD} p-3`}>
        <div className="h-36 w-full overflow-hidden rounded-[12px] border border-[#dcc6cf]" style={{ background: data.bg ? `center/cover url(${data.bg})` : "linear-gradient(160deg,#ffe8ef,#f3e8f8)" }}>
          {data.bg && <div className="h-full w-full bg-white" style={{ opacity: data.veil }} />}
        </div>
        <div className="mt-2.5 flex gap-2">
          <Upload label={data.bg ? "更换背景" : "上传任意图片"} onPick={(src) => update((d) => ({ ...d, bg: src }))} />
          {data.bg && <button className={BTN} onClick={() => update((d) => ({ ...d, bg: undefined }))}>恢复默认</button>}
        </div>
        {data.bg && (
          <label className="mt-3 flex items-center gap-2 text-[11.5px]" style={{ color: SOFT }}>
            清透度
            <input type="range" min={0} max={85} value={Math.round(data.veil * 100)} onChange={(e) => update((d) => ({ ...d, veil: +e.target.value / 100 }))} className="flex-1 accent-[#c4607e]" />
          </label>
        )}
      </div>

      <SectionTitle cn="我的身份" en="identity" />
      <div className={`${CARD} p-3`}>
        <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-white/50 p-1">
          {(["player", "custom"] as const).map((m) => (
            <button key={m} onClick={() => update((d) => ({ ...d, identity: { ...d.identity, mode: m } }))} className={`rounded-[10px] py-1.5 text-[12px] font-bold ${id.mode === m ? "bg-[#c4607e]/12 text-[#b0506e]" : "text-[#a08894]"}`}>
              {m === "player" ? `主角 · ${g.player.name}` : "自定义身份"}
            </button>
          ))}
        </div>
        {id.mode === "custom" && (
          <div className="mt-3 flex items-center gap-3">
            <Ava src={id.avatar} name={id.name || g.player.name} size={52} />
            <div className="flex-1 space-y-2">
              <input value={id.name} onChange={(e) => update((d) => ({ ...d, identity: { ...d.identity, name: e.target.value.slice(0, 16) } }))} className={INPUT} placeholder="空间昵称" />
              <Upload label={id.avatar ? "更换头像" : "上传头像"} onPick={(src) => update((d) => ({ ...d, identity: { ...d.identity, avatar: src } }))} />
            </div>
          </div>
        )}
        <p className="mt-2.5 text-[10.5px] leading-relaxed" style={{ color: SOFT }}>目前一个身份绑定一位 TA，后续版本将支持一个身份绑定多位。</p>
      </div>

      {npc && space && (
        <>
          <SectionTitle cn="绑定关系" en="binding" />
          <div className={`${CARD} flex items-center gap-3 p-3`}>
            <Ava src={npc.avatar} name={npc.name} size={40} />
            <div className="flex-1">
              <p className="text-[13px] font-bold">{npc.name}</p>
              <p className="text-[10.5px]" style={{ color: SOFT, fontFamily: MONO }}>since {dayDateLabel(space.since)}</p>
            </div>
            <button className={`${BTN} text-[#c0566d]`} onClick={() => setConfirm(true)}>解除绑定</button>
          </div>
        </>
      )}
      {confirm && npc && (
        <Sheet title="解除绑定？" onClose={() => setConfirm(false)}>
          <p className="text-[12.5px] leading-relaxed">解除后将无法继续和 {npc.name} 写信、问答。你们的信件、问答和纪念日会保留，重新绑定后还能看到。</p>
          <div className="mt-4 flex gap-2">
            <button className={`${BTN} flex-1`} onClick={() => setConfirm(false)}>再想想</button>
            <button className={`${BTN_ROSE} flex-1`} onClick={() => { update((d) => ({ ...d, bindings: d.bindings.filter((x) => x !== npc.id) })); setConfirm(false); onUnbound(); }}>确认解除</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
