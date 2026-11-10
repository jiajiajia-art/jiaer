import { loadData, saveData } from "../../lib/saveScope";
import { useMemo, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { isConfigured } from "../../lib/ai";
import type { AIConfig, GameState, JournalEntry, Npc } from "../../lib/types";
import { syncJson, useWorldSync } from "./worldSync";
import { Avatar } from "../ui";
import { LoadMoreButton } from "./shared";
import { clockLabel, dayDateLabel } from "../../game/logic";
import { APP_ICON } from "./appIcons";
import { useCommsBrand } from "./commsBrand";
import type { ReactNode } from "react";
import { InnerOsLabel, IconGrid, IconHeart, IconLock, IconSearch } from "../../lib/icons";

/* 「视监」：进入角色后打开 TA 自己的独立手机：锁屏 → 主屏 → 各 App。
 * 玩法核心「表里不一」：对主角说的话（表）与心声 / 日记 / 仅自己可见动态（里）形成反差。
 *
 * 数据来源（不做任何 mock）：
 * - 真实：与主角的聊天记录、群聊、通话记录、聊天时 TA 的内心独白（os）、主线互动、聊天里发过的图片 —— 全部读本局存档。
 * - AI 推演：TA 与「本局真实存在的其他人」的私聊、日记、朋友圈、搜索、相册描述、加密备忘；按存档 + 人物分别缓存，可随剧情刷新。
 * - 未接入 AI：只展示真实部分，推演部分如实留空并提示，绝不拼装假内容。 */

type Msg = { me: boolean; t: string; recalled: boolean; time?: string; img?: string; os?: string };
type Chat = { with: string; note: string; msgs: Msg[]; real?: boolean };
type Post = { text: string; date: string; private: boolean };
type Diary = { date: string; title: string; body: string; lockAff: number };
type Secret = { title: string; hint: string; pwd: string; body: string };
type Call = { who: string; info: string; missed: boolean; real?: boolean };
/* AI 推演的部分（只覆盖本局里无法从存档直接读到的「里」） */
type PeekAI = {
  wallpaper: string;
  lock: string;
  surface: string;
  chats: Chat[];
  moments: Post[];
  diary: Diary[];
  secret: Secret | null;
  search: string[];
  album: string[];
  calls: Call[];
};
type App = "home" | "chats" | "inner" | "moments" | "diary" | "search" | "album" | "calls";
const KEY = "star2005.peek.v3";

const WALLS = [
  "linear-gradient(165deg,#2b3a55,#0f1520)", "linear-gradient(165deg,#5b3a4f,#1a1016)",
  "linear-gradient(165deg,#3c5a4a,#0f1a14)", "linear-gradient(165deg,#5a4a33,#1b140c)",
  "linear-gradient(165deg,#3f3a66,#111024)",
];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/* 缓存按「存档 id + 人物 id」隔离，换存档不会串到别人的手机 */
type Cache = Record<string, { day: number; data: PeekAI }>;
function loadAll(): Cache {
  const v = loadData<Cache>(KEY, {}); return v && typeof v === "object" ? v : {};
}
function saveOne(k: string, day: number, data: PeekAI) {
  saveData(KEY, { ...loadAll(), [k]: { day, data } });
}

const S = (v: unknown, n: number, d = "") => (typeof v === "string" || typeof v === "number" ? String(v) : d).trim().slice(0, n);
const strs = (v: unknown, n: number, len = 60) => (Array.isArray(v) ? v.map((x) => S(x, len)).filter(Boolean).slice(0, n) : []);
const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).filter((x) => x && typeof x === "object") : []);
const num = (v: unknown, d: number, lo: number, hi: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d; };

/* 清洗 AI 结果：私聊对象不得是主角本人（与主角的聊天只用真实记录） */
function clean(p: Record<string, unknown>, me: string): PeekAI {
  const sec = p.secret && typeof p.secret === "object" ? (p.secret as Record<string, unknown>) : null;
  return {
    wallpaper: S(p.wallpaper, 30),
    lock: S(p.lock, 40),
    surface: S(p.surface, 80),
    chats: arr(p.chats).slice(0, 5).map((c) => ({
      with: S(c.with, 16, "未知"),
      note: S(c.note, 16),
      msgs: arr(c.msgs).slice(0, 12).map((m) => {
        const t = S(m.t, 140);
        return { me: !!m.me, recalled: !!m.recalled || t.includes("已撤回"), t: t.replace(/[（(]已撤回[)）]/g, "").trim() };
      }).filter((m) => m.t),
    })).filter((c) => c.msgs.length && c.with !== me),
    moments: arr(p.moments).slice(0, 6).map((m) => ({ text: S(m.text, 200), date: S(m.date, 16), private: !!m.private })).filter((m) => m.text),
    diary: arr(p.diary).slice(0, 6).map((d) => ({ date: S(d.date, 16), title: S(d.title, 20, "无题"), body: S(d.body, 400), lockAff: num(d.lockAff, 0, 0, 100) })).filter((d) => d.body),
    secret: sec && S(sec.body, 10) ? { title: S(sec.title, 20, "加密备忘"), hint: S(sec.hint, 40, "你猜"), pwd: S(sec.pwd, 12), body: S(sec.body, 400) } : null,
    search: strs(p.search, 10),
    album: strs(p.album, 9),
    calls: arr(p.calls).slice(0, 6).map((c) => { const info = S(c.info, 30); return { who: S(c.who, 16, "未知"), info, missed: /未接|拒/.test(info) }; }).filter((c) => c.who !== me),
  };
}

/* —— 真实部分：全部从本局存档读出 —— */
type Real = {
  chat: Chat | null; // 与主角的私聊（TA 视角）
  groups: Chat[]; // TA 所在的群聊
  inner: { said: string; os: string; time: string }[]; // 嘴上说的 vs 心里想的
  calls: Call[];
  photos: { src: string; time: string }[];
  moments: { text: string; time: string }[]; // 主线互动里 TA 留下的痕迹
};
function readReal(npc: Npc, g: GameState): Real {
  const me = g.player.name;
  const ph = g.phone;
  const priv = ph?.threads.find((t) => t.kind === "private" && t.personId === npc.id);
  const toMsg = (m: { role: string; text: string; label: string; img?: string; os?: string; from?: string }, mine: boolean): Msg => ({ me: mine, t: m.text, recalled: false, time: m.label, img: m.img, os: m.os });
  const chat: Chat | null = priv && priv.msgs.some((m) => m.role !== "sys")
    ? { with: me, note: me, real: true, msgs: priv.msgs.filter((m) => m.role !== "sys").slice(-40).map((m) => toMsg(m, m.role === "npc")) }
    : null;
  const groups: Chat[] = (ph?.threads ?? [])
    .filter((t) => t.kind === "group" && t.members?.includes(npc.id) && t.msgs.length)
    .map((t) => ({ with: t.title, note: t.title, real: true, msgs: t.msgs.filter((m) => m.role !== "sys").slice(-30).map((m) => toMsg({ ...m, text: m.role === "me" ? `${me}：${m.text}` : m.from && m.from !== npc.id ? `${g.npcs.find((n) => n.id === m.from)?.name ?? "群友"}：${m.text}` : m.text }, m.role === "npc" && (!m.from || m.from === npc.id))) }));
  const allMsgs = [...(priv?.msgs ?? []), ...(ph?.calls ?? []).filter((c) => c.personId === npc.id).flatMap((c) => c.transcript ?? [])];
  const inner = allMsgs.filter((m) => m.role === "npc" && m.os?.trim() && (!m.from || m.from === npc.id)).slice(-20).reverse().map((m) => ({ said: m.text, os: m.os!.trim(), time: m.label }));
  // 通话从 TA 的视角写：主角打来 = 呼入，主角没接通 = TA 这边是未接 / 被拒
  const calls: Call[] = (ph?.calls ?? []).filter((c) => c.personId === npc.id).slice(-12).reverse().map((c) => {
    const mins = Math.max(1, Math.round(c.durationSec / 60));
    const info = c.outcome === "connected" ? `通话 · ${mins} 分钟` : c.outcome === "declined" ? "被挂断" : "未接通";
    return { who: me, info, missed: c.outcome !== "connected", real: true };
  });
  const photos = allMsgs.filter((m) => m.img).slice(-12).reverse().map((m) => ({ src: m.img!, time: m.label }));
  const moments = npc.interactions.slice(-6).reverse().map((i) => ({ text: i.text, time: i.time }));
  return { chat, groups, inner, calls, photos, moments };
}

/* 世界剧情由 syncJson 注入；每个角色独立记忆 peek.<id>，多次视监前后连贯 */
async function aiPeek(cfg: AIConfig, npc: Npc, game: GameState, real: Real): Promise<PeekAI> {
  const me = game.player.name;
  const others = game.npcs.filter((n) => n.id !== npc.id).map((n) => `${n.name}（${n.identity}）`).slice(0, 16);
  const lastChat = real.chat?.msgs.slice(-8).map((m) => `${m.me ? npc.name : me}：${m.t}`).join("\n");
  const task = `「视监」：玩家偷看 ${npc.name} 的私人手机。核心玩法是「表里不一」：
- 表：${npc.name} 平时对主角${me}说的话（下面给出真实聊天记录，不要改写）。
- 里：日记、仅自己可见的动态、和他人的私聊、撤回的消息里流露真实想法——秘密、担忧、对${me}的真实感情（在意、嫉妒、愧疚、利用、算计、动摇，依好感与人设而定），与表面形成反差。不要直白说破，靠细节暗示。
- 私聊对象只能从这些本局真实人物里选：${others.join("、") || "（暂无其他人物）"}；如确需家人/经纪人等未登场者，用「妈妈」「经纪人」这类身份称呼。绝不能是${me}本人。
严禁 OOC，必须紧扣下面的真实信息，并与上次视监内容衔接（延续会话、日记）。
被视监的角色：${npc.name}，${npc.age}，${npc.identity}，与主角关系：${npc.relation}，好感 ${npc.affinity}/100，心情：${npc.mood}
简介：${npc.bio}
${npc.persona?.text ? `人设：${npc.persona.text}\n` : ""}${npc.persona?.voice ? `口吻：${npc.persona.voice}\n` : ""}与主角的主线互动：${npc.interactions.slice(-6).map((i) => i.text).join("；") || "暂无"}
与主角的真实聊天（最近）：\n${lastChat || "暂无"}
${real.inner.length ? `聊天时 TA 的真实心声：${real.inner.slice(0, 5).map((x) => x.os).join("；")}\n` : ""}当前游戏第 ${game.sim.day} 天，日期一律写「第N天」或「第N天 HH:MM」。

只返回 JSON：{"wallpaper":壁纸描述(≤12字),"lock":锁屏签名(≤20字),"surface":一句话概括TA在${me}面前的表面态度(≤30字),
"chats":[{"with":聊天对象,"note":备注名,"msgs":[{"me":是否${npc.name}发的,"t":内容,"recalled":是否已撤回}]}](2~4个会话，每个4~8条，至少1条recalled=true的撤回消息暴露真心),
"moments":[{"text":..,"date":..,"private":是否仅自己可见}](3~5条，至少2条private=true),
"diary":[{"date":..,"title":..,"body":内心独白80~200字,"lockAff":解锁所需好感}](3~4篇；普通篇lockAff=0；最私密的1~2篇lockAff取50~90),
"secret":{"title":加密备忘标题,"hint":密码提示(玩家能凭剧情/人设猜到),"pwd":密码(短),"body":最深的秘密},
"search":[5~8条搜索记录],"album":[3~6条照片描述],"calls":[{"who":非主角的人,"info":如「呼出 · 3分钟」「未接」}](2~4条)}`;
  const p = await syncJson<Record<string, unknown>>(cfg, game, `peek.${npc.id}`, `视监·${npc.name}`, task);
  if (!p) throw new Error("bad json");
  const d = clean(p, me);
  if (!d.chats.length && !d.diary.length) throw new Error("empty");
  return d;
}

/* 与主手机同一套 58×58 满幅图标；主手机没有的（心声 / 相册 / 搜索）按同样的瓷面质感补齐 */
function Tile({ from, to, children }: { from: string; to: string; children: ReactNode }) {
  const gid = `peek-${from.slice(1)}${to.slice(1)}`;
  return (
    <svg viewBox="0 0 58 58" className="h-full w-full" aria-hidden>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient></defs>
      <rect width="58" height="58" fill={`url(#${gid})`} />
      <rect width="58" height="29" fill="#fff" opacity="0.08" />
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{children}</g>
    </svg>
  );
}
const ICON: Record<Exclude<App, "home">, ReactNode> = {
  chats: APP_ICON.wechat,
  calls: APP_ICON.call,
  moments: APP_ICON.moments,
  diary: APP_ICON.notes,
  inner: <Tile from="#d68cff" to="#7a3fd1"><path d="M29 42s-12-7.2-12-15.4A6.6 6.6 0 0 1 29 22a6.6 6.6 0 0 1 12 4.6C41 34.8 29 42 29 42Z" fill="#fff" stroke="none" /><path d="M36 15c2 .6 3.4 2 4 4" strokeWidth="2.2" opacity=".8" /></Tile>,
  album: <Tile from="#fff4f0" to="#ffd9cc"><g strokeWidth="0">{["#ff9f0a", "#ff375f", "#bf5af2", "#0a84ff", "#30d158", "#ffd60a"].map((c, i) => <ellipse key={i} cx="29" cy="19" rx="5" ry="9" fill={c} opacity=".9" transform={`rotate(${i * 60} 29 29)`} />)}</g></Tile>,
  search: <Tile from="#5ac8fa" to="#0a64d6"><circle cx="26" cy="26" r="9" /><path d="m33 33 8 8" /></Tile>,
};
const APPS: { id: Exclude<App, "home">; label: string; ai?: boolean }[] = [
  { id: "moments", label: "朋友圈", ai: true },
  { id: "diary", label: "备忘录", ai: true },
  { id: "search", label: "搜索记录", ai: true },
  { id: "album", label: "相册" },
  { id: "chats", label: "绿信" },
  { id: "inner", label: "心声" },
  { id: "calls", label: "电话" },
];
const DOCK: Exclude<App, "home">[] = ["chats", "inner", "calls", "album"];

/** 功能注释：无局内存档 / 无人可看时的选人空态，与实机文案一致（编辑器小手机也走这里） */
function PeekEmptyShell({ onBack, online }: { onBack: () => void; online: boolean }) {
  return (
    <div className="flex h-full flex-col bg-[#0d0f12] text-white">
      <div className="flex shrink-0 items-center px-3 pb-2 pt-1">
        <button type="button" onClick={onBack} className="w-12 text-left text-[22px] text-white/70">‹</button>
        <div className="flex-1 text-center text-[16px] font-semibold">视监</div>
        <span className="w-12" />
      </div>
      <p className="shrink-0 px-5 pb-2 text-[12px] text-white/45">选一个人，看看 TA 嘴上说的，和心里想的，是不是一回事。</p>
      {!online && (
        <p className="mx-3 mb-2 shrink-0 rounded-xl bg-[#ff9f0a]/15 px-3 py-2 text-[11.5px] leading-relaxed text-[#ffd8a0]">
          未接入 AI：只能看到 TA 和你之间真实留下的聊天、心声、通话与照片；TA 的日记和与别人的私聊需要 AI 推演。
        </p>
      )}
      <p className="mt-16 text-center text-[13px] text-white/40">还没有认识的人。</p>
    </div>
  );
}

export default function PeekApp({ onBack }: { onBack: () => void }) {
  const { game, cfg } = useGame();
  const online = isConfigured(cfg);
  if (!game) return <PeekEmptyShell onBack={onBack} online={online} />;
  return <PeekAppLive onBack={onBack} />;
}

function PeekAppLive({ onBack }: { onBack: () => void }) {
  const { game, cfg, commitGame } = useGame();
  const g = game!;
  const brand = useCommsBrand(); // P4.1：「chats」入口的名字随世界题材（绿信 / 传讯）
  const appLabel = (a: { id: string; label: string }) => (a.id === "chats" ? brand.appName : a.label);
  const [pid, setPid] = useState<string | null>(null);
  const [ai, setAi] = useState<PeekAI | null>(null);
  const [aiDay, setAiDay] = useState<number | null>(null);
  const [locked, setLocked] = useState(true);
  const [app, setApp] = useState<App>("home");
  const [chatIdx, setChatIdx] = useState<number | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwdErr, setPwdErr] = useState(false);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tip, setTip] = useState("");
  const [q, setQ] = useState("");
  // 视监只能看自己认识（已结识）的人
  const knownNpcs = g.npcs.filter((n) => (g.sim?.metPeople ?? []).includes(n.id));
  const npc = knownNpcs.find((n) => n.id === pid);
  const day = g.sim.day;
  const online = isConfigured(cfg);
  const ck = (id: string) => `${g.id}:${id}`;
  const real = useMemo(() => (npc ? readReal(npc, g) : null), [npc, g]);

  const flash = (t: string) => { setTip(t); setTimeout(() => setTip(""), 1600); };

  // 截图存证：把看到的内容记进剧情志（地点备注类），之后可在剧情志回看 / 导出
  const keep = (title: string, text: string) => {
    if (!npc) return;
    const entry: JournalEntry = { id: `peek_${Date.now().toString(36)}`, kind: "note", title: `视监 · ${npc.name} · ${title}`, seed: text, text, when: `${dayDateLabel(day)} ${clockLabel(g.sim.clockMin ?? 480)}`, ts: Date.now() };
    commitGame({ ...g, journal: [entry, ...(g.journal ?? [])] });
    flash("已截图存进剧情志");
  };

  const fetchAI = async (n: Npc, force: boolean): Promise<boolean> => {
    const hit = loadAll()[ck(n.id)];
    if (hit?.data && !force) { setAi(clean(hit.data as unknown as Record<string, unknown>, g.player.name)); setAiDay(hit.day); return true; }
    if (!online) { setAi(null); setAiDay(null); return false; }
    setBusy(true); setErr("");
    if (hit?.data) { setAi(hit.data); setAiDay(hit.day); }
    try { const d = await aiPeek(cfg, n, g, readReal(n, g)); setAi(d); setAiDay(day); saveOne(ck(n.id), day, d); return true; }
    catch { setErr("信号被干扰了，再试一次"); return false; }
    finally { setBusy(false); }
  };

  const open = (n: Npc) => {
    setPid(n.id); setChatIdx(null); setErr(""); setPwd(""); setOpened(false); setLocked(true); setApp("home"); setQ("");
    void fetchAI(n, false);
  };

  useWorldSync("peek", async () => {
    if (!npc) return "先选一个人";
    if (!online) return "未接入 AI：只能看到真实记录";
    if (busy) return "正在读取中";
    return (await fetchAI(npc, true)) ? `已刷新 ${npc.name} 的手机` : "信号被干扰了，再试一次";
  });

  /* 视监内「查看更多」：结合剧情为 TA 续写更早的朋友圈 / 日记，接在末尾并写回缓存 */
  const [moreBusy, setMoreBusy] = useState(false);
  const loadMore = async (kind: "moments" | "diary") => {
    if (!npc || !ai || moreBusy) return;
    if (!online) { flash("未配置 AI，暂无更多"); return; }
    setMoreBusy(true);
    try {
      const seen = (kind === "moments" ? ai.moments.map((m) => m.text) : ai.diary.map((d) => `${d.title}${d.body}`)).slice(-12).map((t) => t.slice(0, 30)).join("｜");
      const task = kind === "moments"
        ? `继续窥探「${npc.name}」手机里更早的朋友圈动态，贴合 TA 的人设与最近剧情，日期一律写「第N天」（早于已有内容）。返回 JSON：{"moments":[{"text":..,"date":..,"private":是否仅自己可见}]}，给 4 条，至少 1 条 private=true；不要与这些已有内容重复：${seen}`
        : `继续窥探「${npc.name}」更早的私密日记，贴合 TA 的人设与最近剧情，日期一律写「第N天」（早于已有内容）。返回 JSON：{"diary":[{"date":..,"title":..,"body":内心独白80~200字,"lockAff":解锁所需好感}]}，给 2~3 篇，普通篇 lockAff=0，最私密的 1 篇取 50~90；不要与这些已有内容重复：${seen}`;
      const p = await syncJson<Record<string, unknown>>(cfg, g, `peek.${npc.id}`, `视监·${npc.name}`, task);
      if (!p) { flash("未配置 AI，暂无更多"); return; }
      const d = clean(p, g.player.name);
      const n = kind === "moments" ? d.moments.length : d.diary.length;
      if (!n) { flash("生成失败，请重试"); return; }
      const next: PeekAI = kind === "moments" ? { ...ai, moments: [...ai.moments, ...d.moments].slice(-60) } : { ...ai, diary: [...ai.diary, ...d.diary].slice(-60) };
      setAi(next); saveOne(ck(npc.id), aiDay ?? day, next);
      flash(`新加载 ${n} 条`);
    } catch { flash("加载失败，请重试"); } finally { setMoreBusy(false); }
  };

  /* 人物列表：标出每个人有多少真实痕迹 */
  if (!npc || !real) {
    const cache = loadAll();
    const list = knownNpcs.filter((n) => !q || n.name.includes(q) || n.identity.includes(q) || n.relation.includes(q));
    return (
      <div className="flex h-full flex-col bg-[#0d0f12] text-white">
        <div className="flex shrink-0 items-center px-3 pb-2 pt-1">
          <button onClick={onBack} className="w-12 text-left text-[22px] text-white/70">‹</button>
          <div className="flex-1 text-center text-[16px] font-semibold">视监</div>
          <span className="w-12" />
        </div>
        <p className="shrink-0 px-5 pb-2 text-[12px] text-white/45">选一个人，看看 TA 嘴上说的，和心里想的，是不是一回事。</p>
        {knownNpcs.length > 4 && (
          <div className="shrink-0 px-3 pb-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名字 / 身份 / 关系" className="w-full rounded-xl bg-white/[0.08] px-3 py-2 text-[13px] outline-none placeholder:text-white/30" />
          </div>
        )}
        {!online && <p className="mx-3 mb-2 shrink-0 rounded-xl bg-[#ff9f0a]/15 px-3 py-2 text-[11.5px] leading-relaxed text-[#ffd8a0]">未接入 AI：只能看到 TA 和你之间真实留下的聊天、心声、通话与照片；TA 的日记和与别人的私聊需要 AI 推演。</p>}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
          {knownNpcs.length === 0 && <p className="mt-16 text-center text-[13px] text-white/40">还没有认识的人。</p>}
          {knownNpcs.length > 0 && !list.length && <p className="mt-16 text-center text-[13px] text-white/40">没有找到「{q}」</p>}
          {list.map((n) => {
            const c = cache[ck(n.id)];
            const r = readReal(n, g);
            const traces = (r.chat?.msgs.length ?? 0) + r.calls.length + r.inner.length;
            return (
              <button key={n.id} onClick={() => open(n)} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5 text-left active:bg-white/10">
                <Avatar src={n.avatar} name={n.name} size={44} editable={false} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold">{n.name}{r.inner.length > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-[#bf5af2]/25 px-1.5 text-[10px] font-medium text-[#e3b8ff]"><IconHeart size={12} /> {r.inner.length} 条心声</span>}</span>
                  <span className="block truncate text-[12px] text-white/45">{n.identity} · {n.relation} · 好感 {n.affinity}</span>
                </span>
                <span className="shrink-0 text-right text-[10.5px] leading-tight text-white/35">
                  {traces ? `${traces} 条痕迹` : "暂无交集"}<br />{c ? (c.day === day ? "今日已看" : `上次 第${c.day}天`) : "未查看"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const wall = WALLS[hash(npc.id) % WALLS.length];
  const exitPhone = () => { setPid(null); setAi(null); };
  const clock = clockLabel(g.sim.clockMin ?? 480);
  const stale = aiDay !== null && aiDay < day;
  const chats: Chat[] = [...(real.chat ? [real.chat] : []), ...real.groups, ...(ai?.chats ?? [])];
  const calls: Call[] = [...real.calls, ...(ai?.calls ?? [])];

  /* 锁屏：与主手机同款（小锁 + 细体大时钟 + 毛玻璃通知），时间 = 游戏内此刻 */
  if (locked) {
    const last = real.chat?.msgs[real.chat.msgs.length - 1];
    const notes: [ReactNode, string, string][] = [
      ...(last ? [[APP_ICON.wechat, `${brand.appName} · ${g.player.name}`, last.t] as [ReactNode, string, string]] : []),
      ...(real.calls[0]?.missed ? [[APP_ICON.call, "电话", `${g.player.name} · ${real.calls[0].info}`] as [ReactNode, string, string]] : []),
    ];
    return (
      <div className="relative flex h-full select-none flex-col items-center text-white" style={{ background: wall }} onClick={() => !busy && setLocked(false)}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/55" />
        <button onClick={(e) => { e.stopPropagation(); exitPhone(); }} className="absolute left-3 top-1 z-10 flex items-center gap-0.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] text-white/85 backdrop-blur-xl">‹ 退出</button>
        <div className="relative z-10 mt-[22%] flex flex-col items-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mb-3 opacity-90">
            <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" fill="currentColor" />
            <path d="M7.6 10.5V8a4.4 4.4 0 0 1 8.8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <p className="text-[14px] font-medium text-white/85">{dayDateLabel(day)}</p>
          <p className="text-[76px] font-extralight leading-none tracking-tight tabular-nums">{clock}</p>
          <p className="mt-2 text-[11.5px] text-white/60">{npc.name} 的手机{ai?.wallpaper ? ` · 壁纸「${ai.wallpaper}」` : ""}</p>
        </div>
        <div className="relative z-10 mt-6 w-full space-y-2 px-3">
          {notes.map(([ic, h, t], i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-[18px] bg-white/18 px-3 py-2.5 backdrop-blur-2xl">
              <span className="block h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[8px]">{ic}</span>
              <span className="min-w-0 flex-1">
                <span className="flex justify-between text-[12px] font-semibold"><span>{h}</span><span className="font-normal text-white/55">现在</span></span>
                <span className="block truncate text-[13px] text-white/90">{t}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="relative z-10 mb-7 mt-auto flex flex-col items-center gap-3 px-8 text-center">
          {ai?.lock && <p className="text-[14px] italic text-white/85">「{ai.lock}」</p>}
          <p className="text-[12px] text-white/55">{busy ? `正在接入 ${npc.name} 的手机…` : err || "轻点屏幕解锁"}</p>
          <span className="h-[5px] w-32 rounded-full bg-white/70" />
        </div>
      </div>
    );
  }

  const count: Record<Exclude<App, "home">, number> = {
    chats: chats.length, inner: real.inner.length, calls: calls.length, album: real.photos.length + (ai?.album.length ?? 0),
    moments: ai?.moments.length ?? 0, diary: (ai?.diary.length ?? 0) + (ai?.secret ? 1 : 0), search: ai?.search.length ?? 0,
  };

  const AppIcon = ({ id, dock }: { id: Exclude<App, "home">; dock?: boolean }) => {
    const a = APPS.find((x) => x.id === id)!;
    const off = a.ai && !ai;
    return (
      <button
        onClick={() => { if (off) { flash(online ? (busy ? "正在读取…" : "还没读到，点右上角刷新") : "需要接入 AI 才能推演"); return; } setApp(id); setChatIdx(null); }}
        className={`group relative flex flex-col items-center gap-1.5 ${off ? "opacity-45 grayscale" : ""}`}
      >
        <span className="relative block">
          <span className="relative block h-[58px] w-[58px] overflow-hidden rounded-[14px] shadow-[0_2px_6px_rgba(0,0,0,0.18)] transition-transform duration-150 group-active:scale-90 group-active:brightness-90">{ICON[id]}</span>
          {count[id] > 0 && <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-[5px] text-[12px] font-medium tabular-nums leading-none text-white">{count[id] > 99 ? "99+" : count[id]}</span>}
          {off && <span className="absolute -bottom-1 -right-1 rounded-full bg-black/60 px-1 text-[9px] leading-[14px]">AI</span>}
        </span>
        {!dock && <span className="max-w-[74px] truncate text-[11.5px] font-medium tracking-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">{appLabel(a)}</span>}
      </button>
    );
  };

  /* 主屏：与主手机同款——小组件 + 4 列图标网格 + 毛玻璃 Dock */
  if (app === "home") {
    return (
      <div className="relative flex h-full flex-col text-white" style={{ background: wall }}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/30" />
        <div className="relative flex shrink-0 items-center justify-between px-3 pb-1 pt-1">
          <button onClick={exitPhone} className="rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] text-white/85 backdrop-blur-xl">‹ 退出</button>
          <span className="text-[11px] text-white/60">{busy ? "读取中…" : ""}</span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-2">
          {err && <p className="mt-2 rounded-2xl bg-[#ff9f0a]/30 px-3 py-1.5 text-[12px] backdrop-blur-xl">{err}</p>}
          {online && stale && !busy && (
            <button onClick={() => fetchAI(npc, true)} className="mt-2 w-full rounded-2xl bg-white/15 px-3 py-2 text-left text-[12px] text-white/85 backdrop-blur-xl">
              推演内容停留在第 {aiDay} 天 · <span className="font-semibold text-white">按最新剧情刷新 ›</span>
            </button>
          )}
          {!online && <p className="mt-2 rounded-2xl bg-black/25 px-3 py-2 text-[11.5px] text-white/75 backdrop-blur-xl">未接入 AI · 标着「AI」的应用暂时打不开，其余都是真实记录</p>}
          <div className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-4 pt-3">
            {APPS.filter((a) => !DOCK.includes(a.id)).map((a) => <AppIcon key={a.id} id={a.id} />)}
          </div>
        </div>
        {tip && <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex justify-center"><span className="rounded-full bg-black/75 px-3.5 py-1.5 text-[12px]">{tip}</span></div>}
        {/* Dock：毛玻璃底座，常用的真实记录类应用 */}
        <div className="relative mx-3 mb-2 flex shrink-0 justify-around rounded-[28px] bg-white/18 px-3 py-3 backdrop-blur-2xl">
          {DOCK.map((id) => <AppIcon key={id} id={id} dock />)}
        </div>
        <button onClick={() => setLocked(true)} className="relative mx-auto mb-2 shrink-0 text-[11px] text-white/50">锁屏</button>
      </div>
    );
  }

  const chat = app === "chats" && chatIdx !== null ? chats[chatIdx] : null;
  const title = chat ? chat.note || chat.with : appLabel(APPS.find((a) => a.id === app)!);
  const back = () => (chat ? setChatIdx(null) : setApp("home"));
  const empty = (t: string) => <p className="mx-8 mt-16 text-center text-[13px] leading-relaxed text-[#8e8e93]">{t}</p>;
  const Tag = ({ realData }: { realData?: boolean }) => <span className={`shrink-0 rounded px-1 text-[9.5px] font-semibold ${realData ? "bg-[#e8f8ee] text-[#1a9b55]" : "bg-[#f2ecff] text-[#7a4fd1]"}`}>{realData ? "真实" : "推演"}</span>;
  const KeepBtn = ({ t, body }: { t: string; body: string }) => <button onClick={() => keep(t, body)} className="shrink-0 text-[11px] text-[#0a84ff]">截图</button>;

  return (
    <div className="relative flex h-full flex-col bg-[#f2f2f7] text-[#1c1c1e]">
      <div className="flex shrink-0 items-center border-b border-black/[0.06] bg-[#f7f7f7]/90 px-2 pb-2 pt-1 backdrop-blur-xl">
        <button onClick={back} className="flex w-16 items-center text-[15px] text-[#0a84ff]"><span className="text-[24px] leading-none">‹</span>{chat ? "返回" : "主屏"}</button>
        <div className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold">{title}</div>
        <span className="w-16 text-right">
          {chat ? <KeepBtn t={`和${chat.with}的聊天`} body={chat.msgs.map((m) => `${m.me ? npc.name : chat.with}：${m.recalled ? "（撤回）" : ""}${m.t}`).join("\n")} /> : <span className="text-[11px] text-[#8e8e93]">{busy ? "读取中" : ""}</span>}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {chat && (
          <div className="min-h-full space-y-2 bg-[#ededed] px-3 py-3">
            {!chat.real && <p className="text-center text-[10.5px] text-[#a0a0a5]">— 推演自 TA 的人设与最近剧情 —</p>}
            {chat.msgs.map((m, i) => m.recalled ? (
              <div key={i} className="text-center">
                <p className="text-[11.5px] text-[#8e8e93]">{m.me ? npc.name : chat.with} 撤回了一条消息</p>
                <p className="mx-auto mt-0.5 max-w-[80%] text-[11.5px] italic text-[#b0b0b5] line-through">{m.t}</p>
              </div>
            ) : (
              <div key={i}>
                {m.time && chat.msgs[i - 1]?.time !== m.time && <p className="my-1 text-center text-[10.5px] text-[#a0a0a5]">{m.time}</p>}
                <div className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
                  <span className={`max-w-[78%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[14px] leading-snug ${m.me ? "bg-[#95ec69]" : "bg-white"}`}>
                    {m.img && <img src={(m.img) || undefined} alt="" className="mb-1 max-h-40 rounded" />}
                    {m.t}
                  </span>
                </div>
                {m.os && (
                  <p className={`mt-0.5 text-[11px] italic text-[#9a6fd6] ${m.me ? "pr-1 text-right" : "pl-1"}`}>
                    <InnerOsLabel text={m.os} colon={false} className={m.me ? "justify-end" : ""} />
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {app === "chats" && !chat && (chats.length ? (
          <div className="bg-white">
            {chats.map((c, i) => (
              <button key={i} onClick={() => setChatIdx(i)} className="flex w-full items-center gap-3 border-b border-black/5 px-3 py-2.5 text-left active:bg-black/5">
                {c.with === g.player.name ? <Avatar src={g.player.avatar} name={c.with} size={44} editable={false} /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#d8e4dc] text-[16px] font-semibold text-[#3d6b4f]">{c.with[0]}</span>}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[15px]"><span className="truncate">{c.note || c.with}</span><Tag realData={c.real} /></span>
                  <span className="block truncate text-[12.5px] text-[#8e8e93]">{(() => { const l = c.msgs[c.msgs.length - 1]; return l?.recalled ? "[消息已撤回]" : l?.t; })()}</span>
                </span>
              </button>
            ))}
          </div>
        ) : empty(online ? "没有聊天记录" : `TA 和你还没在${brand.appName}上聊过。接入 AI 后能推演 TA 和别人的私聊。`))}
        {app === "inner" && (real.inner.length ? (
          <div className="space-y-2.5 px-3 py-3">
            <p className="px-1 text-[11.5px] leading-relaxed text-[#8e8e93]">TA 和你聊天、通话时，嘴上说的和心里想的。全部来自你们真实的对话。</p>
            {real.inner.map((x, i) => (
              <div key={i} className="overflow-hidden rounded-xl bg-white">
                <div className="flex items-center justify-between gap-2 border-b border-black/5 px-3.5 py-2"><span className="text-[11px] text-[#8e8e93]">{x.time}</span><KeepBtn t="心声" body={`嘴上：${x.said}\n心里：${x.os}`} /></div>
                <p className="px-3.5 pt-2 text-[13px]"><span className="mr-1.5 text-[11px] text-[#8e8e93]">嘴上</span>{x.said}</p>
                <p className="px-3.5 pb-2.5 pt-1 text-[13px] text-[#7a4fd1]"><span className="mr-1.5 text-[11px] text-[#b79be6]">心里</span>{x.os}</p>
              </div>
            ))}
          </div>
        ) : empty("还没有捕捉到 TA 的心声。多和 TA 聊聊天、打打电话，TA 的真实想法会留在这里。"))}
        {app === "moments" && ai && (
          <div className="bg-white">
            <div className="relative h-36" style={{ background: wall }}>
              <span className="absolute -bottom-5 right-4 flex items-end gap-2">
                <span className="mb-6 max-w-[180px] truncate text-[15px] font-semibold text-white drop-shadow">{npc.name}</span>
                <Avatar src={npc.avatar} name={npc.name} size={56} editable={false} />
              </span>
            </div>
            <div className="pt-8">
              {ai.moments.length ? ai.moments.map((m, i) => (
                <div key={i} className="border-b border-black/5 px-4 py-3">
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{m.text}</p>
                  <p className="mt-1.5 flex items-center gap-2 text-[11.5px] text-[#8e8e93]">
                    {m.date}
                    {m.private && <span className="rounded bg-[#f2f2f7] px-1.5 py-0.5 text-[10.5px] text-[#636366]">仅自己可见</span>}
                    <span className="ml-auto"><KeepBtn t="朋友圈" body={m.text} /></span>
                  </p>
                </div>
              )) : empty("TA 还没发过动态")}
              <LoadMoreButton loading={moreBusy} onClick={() => void loadMore("moments")} color="#576b95" />
              {real.moments.length > 0 && (
                <div className="bg-[#f7f7f7] px-4 py-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#636366]">和你有关的近况 <Tag realData /></p>
                  {real.moments.map((m, i) => <p key={i} className="py-1 text-[12.5px] leading-relaxed text-[#3a3a3c]"><span className="mr-1.5 text-[11px] text-[#8e8e93]">{m.time}</span>{m.text}</p>)}
                </div>
              )}
            </div>
          </div>
        )}
        {app === "diary" && ai && (
          <div className="space-y-2.5 px-3 py-3">
            {ai.secret && (
              <div className="rounded-xl bg-[#2c2c2e] px-3.5 py-3 text-white">
                <p className="flex items-center gap-1 text-[14.5px] font-semibold"><IconLock size={14} /> {ai.secret.title}</p>
                {opened ? (
                  <>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">{ai.secret.body}</p>
                    <div className="mt-1.5 text-right"><KeepBtn t={ai.secret.title} body={ai.secret.body} /></div>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-[12px] text-white/55">密码提示：{ai.secret.hint}</p>
                    <div className="mt-2 flex gap-2">
                      <input value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="输入密码" className="min-w-0 flex-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[13px] outline-none placeholder:text-white/35" />
                      <button
                        onClick={() => {
                          const ok = !ai.secret!.pwd || pwd.trim().toLowerCase() === ai.secret!.pwd.toLowerCase();
                          if (ok) setOpened(true); else { setPwd(""); setPwdErr(true); setTimeout(() => setPwdErr(false), 1500); }
                        }}
                        className="rounded-lg bg-[#ffd60a] px-3 text-[13px] font-semibold text-black"
                      >解锁</button>
                    </div>
                    {pwdErr && <p className="mt-1 text-[11.5px] text-[#ff6961]">密码错误</p>}
                  </>
                )}
              </div>
            )}
            {ai.diary.map((d, i) => {
              const lockedD = npc.affinity < d.lockAff;
              return (
                <div key={i} className="rounded-xl bg-[#fff9db] px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[14.5px] font-semibold">{lockedD ? "" : ""}{d.title}</p>
                    <span className="shrink-0 text-[11px] text-[#8e8e93]">{d.date}</span>
                  </div>
                  {lockedD ? (
                    <p className="mt-1 select-none text-[13px] leading-relaxed text-[#3a3a3c] blur-[4px]">{d.body.slice(0, 60)}</p>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#3a3a3c]">{d.body}</p>
                  )}
                  {lockedD ? <p className="mt-1 text-[11.5px] text-[#b26a00]">TA 还没那么信任你（好感 {npc.affinity}/{d.lockAff}）</p> : <div className="mt-1 text-right"><KeepBtn t={d.title} body={d.body} /></div>}
                </div>
              );
            })}
            {!ai.diary.length && !ai.secret && empty("空空如也")}
            <LoadMoreButton loading={moreBusy} onClick={() => void loadMore("diary")} color="#b26a00" dark />
          </div>
        )}
        {app === "search" && ai && (
          <div className="mx-3 my-3 overflow-hidden rounded-xl bg-white">
            {ai.search.length ? ai.search.map((s, i) => <div key={i} className="flex items-center gap-2.5 border-b border-black/5 px-3.5 py-2.5 text-[14px] last:border-0"><span className="shrink-0 text-[#c7c7cc]"><IconSearch size={14} /></span><span className="min-w-0 break-all">{s}</span></div>) : empty("无记录")}
          </div>
        )}
        {app === "album" && (count.album ? (
          <div className="p-1">
            {real.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-1">
                {real.photos.map((p, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-[#c7c7cc]">
                    <img src={(p.src) || undefined} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-[10px] leading-tight text-white">{p.time}</span>
                  </div>
                ))}
              </div>
            )}
            {ai && ai.album.length > 0 && (
              <>
                <p className="px-2 pb-1 pt-3 text-[11.5px] text-[#8e8e93]">相册里的其他照片（只能看到缩略描述）</p>
                <div className="grid grid-cols-3 gap-1">
                  {ai.album.map((a, i) => (
                    <div key={i} className="flex aspect-square flex-col justify-end overflow-hidden rounded-md p-2 text-white" style={{ background: WALLS[(i + hash(npc.name)) % WALLS.length] }}>
                      <span className="mb-auto opacity-60"><IconGrid size={18} /></span>
                      <span className="text-[10.5px] leading-tight">{a}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : empty(online ? "相册是空的" : "你们聊天时还没互发过照片。"))}
        {app === "calls" && (calls.length ? (
          <div className="mx-3 my-3 overflow-hidden rounded-xl bg-white">
            {calls.map((c, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-black/5 px-3.5 py-2.5 last:border-0">
                <span className={`min-w-0 flex-1 truncate text-[14.5px] ${c.missed ? "text-[#ff3b30]" : ""}`}>{c.who}</span>
                <Tag realData={c.real} />
                <span className="ml-1 shrink-0 text-[12.5px] text-[#8e8e93]">{c.info}</span>
              </div>
            ))}
          </div>
        ) : empty("没有通话记录"))}
      </div>
      {tip && <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center"><span className="rounded-full bg-black/75 px-3.5 py-1.5 text-[12px] text-white">{tip}</span></div>}
    </div>
  );
}
