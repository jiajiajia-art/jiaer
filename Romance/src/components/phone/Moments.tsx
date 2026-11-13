/* 朋友圈：好友动态流（点赞 / 评论 / NPC 回复 / 自己发圈 / 封面与签名），微信「发现」与独立 App 共用 */
import { commTerm } from "../../lib/commSkin";
import { isBlocked } from "../../game/msgPref";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useGame } from "../../store/gameCtx";
import { toggleLike, ensurePhone, type UserComment } from "../../game/phone";
import { Avatar } from "../ui";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID } from "../../mods/registry";
import { TopBar, Lightbox, LoadMoreButton } from "./shared";
import { loadFeed, saveFeed, syncJson } from "./worldSync";
import { onClearPlayerMemory } from "../../lib/saveScope";
import { IconHeart, IconComment } from "./icons";
import ProfileView from "./ProfileView";
import type { GameState, Npc } from "../../lib/types";
import { logAct } from "../../game/phoneLink";

const MM_IMG = (id: string, w = 300, h = 300) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=75`;
const COVER = "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=560&h=280&fit=crop&auto=format&q=75";
// 与九宫格配图对齐的素材池（片场 / 港风 / 咖啡 / 红毯 / 夜景 / 花絮）
const GRID_POOL = [
  "1612544409025-e1f6a56c1152", "1636936291087-2972edf08f14", "1532800783378-1bed60adaf58",
  "1527189919029-aeb3d997547d", "1484251065541-c9770829890f", "1547592180-85f173990554",
  "1748543668676-ea8241cb3886", "1522798514-97ceb8c4f1c8", "1517841905240-472988babdf9",
];
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const poolImgs = (seed: string, n: number) => { const h = hash(seed); return Array.from({ length: n }, (_, k) => MM_IMG(GRID_POOL[(h + k * 4) % GRID_POOL.length])); };

/* ── 动态存储（由绿信刷新 / 朋友圈下拉刷新 / 玩家发圈写入，localStorage 持久化） ── */
export type FeedMoment = { id: string; pid: string; text: string; imgCount: number; ts: number; likers: string[]; imgs?: string[] };
const MM_FEED = "wechat.moments";
const ME = "me";
let mmCache: FeedMoment[] | null = null;
export function getFeedMoments(): FeedMoment[] {
  if (!mmCache) { const f = loadFeed<FeedMoment[]>(MM_FEED); mmCache = Array.isArray(f) ? f : []; }
  return mmCache;
}
function writeFeed(list: FeedMoment[]) {
  // 玩家自己的动态不被挤出
  const mine = list.filter((m) => m.pid === ME), other = list.filter((m) => m.pid !== ME).slice(0, 40);
  mmCache = [...mine, ...other].sort((a, b) => b.ts - a.ts);
  try { saveFeed(MM_FEED, mmCache); } catch { /* 忽略 */ }
  emit();
}
/* 底部「查看更多」加载的动态：单独存储，按加载顺序接在信息流末尾，上限 60 */
const MM_MORE = "wechat.moments.more";
let moreCache: FeedMoment[] | null = null;
const getMoreMoments = (): FeedMoment[] => {
  if (!moreCache) { const f = loadFeed<FeedMoment[]>(MM_MORE); moreCache = Array.isArray(f) ? f : []; }
  return moreCache;
};
function addMoreMoments(items: FeedMoment[]) { moreCache = [...getMoreMoments(), ...items].slice(-60); saveFeed(MM_MORE, moreCache); emit(); }
export function addFeedMoments(items: FeedMoment[]) { writeFeed([...items, ...getFeedMoments()]); }

/* 社交数据：NPC 追加点赞 + 评论线程（含 NPC 回复） */
type MmComment = { id: string; from: string; to?: string; text: string; ts: number };
type Social = Record<string, { likers?: string[]; comments?: MmComment[] }>;
const MM_SOCIAL = "wechat.moments.social";
let socCache: Social | null = null;
const getSocial = (): Social => (socCache ??= loadFeed<Social>(MM_SOCIAL) ?? {});
/* 互动写入游戏存档：评论存 phone.comments["mm:<key>"]（带 from/to），NPC 点赞存 phone.comments["mmlk:<key>"]（id = pid）。
 * 老档 localStorage 的 social 只读合并显示。 */
type StoredC = UserComment & { from?: string; to?: string };
const cKey = (key: string) => `mm:${key}`;
const lkKey = (key: string) => `mmlk:${key}`;
function mmComments(g: GameState, key: string): MmComment[] {
  const stored = ((g.phone?.comments?.[cKey(key)] ?? []) as StoredC[]).map((c) => ({ id: c.id, from: c.from ?? ME, to: c.to, text: c.text, ts: c.ts }));
  const legacy = getSocial()[key]?.comments ?? [];
  return [...legacy, ...stored].sort((a, b) => a.ts - b.ts);
}
function mmLikers(g: GameState, key: string): string[] {
  return [...(getSocial()[key]?.likers ?? []), ...((g.phone?.comments?.[lkKey(key)] ?? []).map((c) => c.id))];
}
function addMmComment(g: GameState, key: string, c: MmComment): GameState {
  const ph = ensurePhone(g).phone!;
  const k = cKey(key);
  const row: StoredC = { id: c.id, text: c.text, ts: c.ts, from: c.from, ...(c.to ? { to: c.to } : {}) };
  return { ...g, phone: { ...ph, comments: { ...ph.comments, [k]: [...(ph.comments[k] ?? []), row] } } };
}
function addMmLiker(g: GameState, key: string, pid: string): GameState {
  const ph = ensurePhone(g).phone!;
  const k = lkKey(key);
  const cur = ph.comments[k] ?? [];
  if (cur.some((c) => c.id === pid)) return g;
  return { ...g, phone: { ...ph, comments: { ...ph.comments, [k]: [...cur, { id: pid, text: "", ts: Date.now() }] } } };
}

/* 个人主页：封面 + 个性签名 */
type Profile = { cover?: string; sign?: string };
const MM_PROFILE = "wechat.moments.profile";
let profCache: Profile | null = null;
const getProfile = (): Profile => (profCache ??= loadFeed<Profile>(MM_PROFILE) ?? {});
function setProfile(p: Profile) { profCache = { ...getProfile(), ...p }; saveFeed(MM_PROFILE, profCache); emit(); }

const subs = new Set<() => void>();
let ver = 0;
function emit() { ver++; subs.forEach((f) => f()); }
// 切档：清空朋友圈全部模块级缓存，下次读取时从新存档专属数据重新装载
onClearPlayerMemory(() => { mmCache = null; moreCache = null; socCache = null; profCache = null; emit(); });
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function agoLabel(ts: number) {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  return m < 60 ? `${m} 分钟前` : m < 1440 ? `${Math.round(m / 60)} 小时前` : `${Math.round(m / 1440)} 天前`;
}
const personaOf = (n: Npc) => `${n.id}=${n.name}（${n.identity}${n.persona?.text ? `，人设：${n.persona.text}` : ""}${n.persona?.voice ? `，口吻：${n.persona.voice}` : ""}）`;
/* 朋友圈是公开场合：数值与私密心意都不能写出来，心动只能含蓄流露（各生成任务统一附上） */
const MOMENT_RULE = "朋友圈与评论区对共同好友公开：严禁出现好感、爱慕等任何数值或游戏术语，不得写出私聊内容、内心想法或未公开的心意；对主角有爱慕的人最多含蓄流露在意（如格外积极地点赞、评论里多一句关心），不当众表白或说破；爱慕为 0 或不可攻略的人不暧昧；主角的家人只有亲情。";

/* 图片读取并压缩为 dataURL，避免 localStorage 爆额 */
function readImage(f: File, max = 900): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => {
      const src = String(r.result);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        try { res(c.toDataURL("image/jpeg", 0.8)); } catch { res(src); }
      };
      img.onerror = () => res(src);
      img.src = src;
    };
    r.readAsDataURL(f);
  });
}

/* ── 本地兜底文案 ── */

export function Moments({ onOpenProfile }: { onOpenProfile?: (pid: string) => void }) {
  const { game, cfg, commitGame } = useGame();
  useSyncExternalStore(subscribe, () => ver);
  const g = game!;
  const gRef = useRef(g);
  gRef.current = g;
  const later = (ms: number, fn: (g: GameState) => GameState) => setTimeout(() => commitGame(fn(gRef.current)), ms);
  const feed = getFeedMoments();
  const moreFeed = getMoreMoments();
  const [moreLoading, setMoreLoading] = useState(false);
  const prof = getProfile();
  const likeSet = new Set(g.phone?.likes ?? []);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ key: string; to: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [editSign, setEditSign] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [pull, setPull] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchY = useRef<number | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // 朋友圈只看得到绿信好友：作者、点赞、评论都只从好友里出（被禁止发消息的人也不出现）
  const friendIds = new Set(friendsOf(g).map((n) => n.id));
  const npcById = (id: string) => g.npcs.find((n) => n.id === id);
  const nameOf = (id: string) => (id === ME ? g.player.name : npcById(id)?.name ?? "好友");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); };

  const posts = useMemo(() => {
    const fresh = feed.filter((f) => f.pid === ME || friendIds.has(f.pid)).map((f) => ({
      pid: f.pid, key: f.id, text: f.text, ts: f.ts,
      imgs: f.imgs?.length ? f.imgs : poolImgs(f.id + f.text, f.imgCount),
      when: agoLabel(f.ts), seedLikes: f.likers.filter((x) => friendIds.has(x)),
    }));
    const more = moreFeed.filter((f) => friendIds.has(f.pid)).map((f) => ({
      pid: f.pid, key: f.id, text: f.text, ts: f.ts,
      imgs: f.imgs?.length ? f.imgs : poolImgs(f.id + f.text, f.imgCount),
      when: agoLabel(f.ts), seedLikes: f.likers.filter((x) => friendIds.has(x)),
    }));
    return [...fresh, ...more];
  }, [g.npcs, g.phone?.contacts, g.phone?.msgPref, feed, moreFeed]);

  /* 底部「查看更多」：结合剧情再生成一批更早的动态，接在末尾 */
  const loadMore = async () => {
    if (moreLoading) return;
    if (!cfg) { flash("未配置 AI，暂无更多"); return; }
    setMoreLoading(true);
    try {
      const pool = friendsOf(g).slice(0, 12);
      if (!pool.length) { flash(`还没有${commTerm("app")}好友`); return; }
      const ok = new Set(pool.map((n) => n.id));
      const seen = posts.slice(-12).map((p) => p.text.slice(0, 30)).join("｜");
      const res = await syncJson<{ moments?: unknown }>(cfg, g, "wechat-moments", "朋友圈",
        `再生成 4 条稍早些的朋友圈动态，作者只能从下列人物中选（用 pid），内容贴合人设与最近剧情，也可是日常生活，text ≤80 字，images 为配图张数 0~6，likers 为点赞者 pid 数组；不要与这些已有内容重复：${seen}
【人物】${pool.map(personaOf).join("、")}
${MOMENT_RULE}
返回 {"moments":[{"pid":"","text":"","images":0,"likers":[]}]}`);
      if (!res) { flash("未配置 AI，暂无更多"); return; }
      const last = posts.reduce((m, p) => (p.ts && p.ts < m ? p.ts : m), Date.now());
      const out: FeedMoment[] = [];
      for (const raw of Array.isArray(res.moments) ? res.moments.slice(0, 6) : []) {
        const m = raw as { pid?: unknown; text?: unknown; images?: unknown; likers?: unknown };
        const pid = str(m?.pid, 60), text = str(m?.text, 140);
        if (!ok.has(pid) || !text) continue;
        const n = Number(m?.images);
        const likers = Array.isArray(m?.likers) ? m.likers.filter((x): x is string => typeof x === "string" && ok.has(x) && x !== pid).slice(0, 6) : [];
        out.push({ id: `mmm_${uid()}`, pid, text, imgCount: Number.isFinite(n) ? Math.max(0, Math.min(6, Math.round(n))) : 1, ts: last - (out.length + 1) * 3 * 3600_000, likers });
      }
      if (!out.length) { flash("生成失败，请重试"); return; }
      addMoreMoments(out);
      flash(`新加载 ${out.length} 条`);
    } catch { flash("加载失败，请重试"); } finally { setMoreLoading(false); }
  };

  /* 下拉刷新：AI 生成新动态，失败本地兜底 */
  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pool = friendsOf(g).slice(0, 12);
      if (!pool.length) { flash(`还没有${commTerm("app")}好友，加了好友才能看到 TA 的${commTerm("moments")}`); return; }
      const ok = new Set(pool.map((n) => n.id));
      const res = cfg ? await syncJson<{ moments?: unknown }>(cfg, g, "wechat-moments", "朋友圈",
        `生成 1~3 条新的朋友圈动态，作者只能从下列人物中选（用 pid），内容贴合人设与当前剧情，text ≤80 字，images 为配图张数 0~6，likers 为点赞者 pid 数组。
【人物】${pool.map(personaOf).join("、")}
${MOMENT_RULE}
返回 {"moments":[{"pid":"","text":"","images":0,"likers":[]}]}`).catch(() => null) : null;
      const out: FeedMoment[] = [];
      for (const raw of res && Array.isArray(res.moments) ? res.moments.slice(0, 4) : []) {
        const m = raw as { pid?: unknown; text?: unknown; images?: unknown; likers?: unknown };
        const pid = str(m?.pid, 60), text = str(m?.text, 140);
        if (!ok.has(pid) || !text) continue;
        const n = Number(m?.images);
        const likers = Array.isArray(m?.likers) ? m.likers.filter((x): x is string => typeof x === "string" && ok.has(x) && x !== pid).slice(0, 6) : [];
        out.push({ id: `mm_${uid()}`, pid, text, imgCount: Number.isFinite(n) ? Math.max(0, Math.min(6, Math.round(n))) : 1, ts: Date.now() - out.length * 90000, likers });
      }
      if (out.length) addFeedMoments(out);
      flash(out.length ? `${out.length} 条新动态` : cfg ? "暂时没有新动态" : "接入 AI 后，好友会按剧情发朋友圈");
    } finally { setBusy(false); setPull(0); }
  };

  /* 玩家评论后：作者（偶尔其他 NPC）回复 */
  const npcReply = async (key: string, author: string, postText: string, myText: string, to?: string) => {
    const authorNpc = npcById(author === ME ? to ?? "" : author);
    const responder = author === ME ? (to ? npcById(to) : undefined) : authorNpc;
    if (!responder) return;
    const others = friendsOf(g).slice(0, 10).filter((n) => n.id !== responder.id);
    const history = mmComments(gRef.current, key).slice(-8).map((c) => `${nameOf(c.from)}${c.to ? `回复${nameOf(c.to)}` : ""}：${c.text}`).join("\n");
    let replies: { pid: string; text: string }[] = [];
    if (cfg) {
      const res = await syncJson<{ replies?: unknown }>(cfg, g, "wechat-moments", "朋友圈",
        `朋友圈动态（作者：${nameOf(author)}）：「${postText}」
评论区：\n${history}
主角${g.player.name}刚评论：「${myText}」。请 ${personaOf(responder)} 以本人口吻回复主角（≤40 字）；可选 0~1 位其他人物也插话回复主角（从：${others.map((n) => `${n.id}=${n.name}`).join("、")}）。
${MOMENT_RULE}
返回 {"replies":[{"pid":"${responder.id}","text":""}]}`).catch(() => null);
      const okIds = new Set([responder.id, ...others.map((n) => n.id)]);
      replies = (res && Array.isArray(res.replies) ? res.replies : []).map((r) => r as { pid?: unknown; text?: unknown })
        .map((r) => ({ pid: str(r?.pid, 60), text: str(r?.text, 80) })).filter((r) => okIds.has(r.pid) && r.text).slice(0, 2);
    }
    replies.forEach((r, i) => later(1200 + i * 1500, (gg) => addMmComment(gg, key, { id: uid(), from: r.pid, to: ME, text: r.text, ts: Date.now() })));
  };

  const submit = (key: string, author: string, postText: string) => {
    const t = draft.trim();
    if (!t) return;
    const to = replyTo?.key === key ? replyTo.to : undefined;
    commitGame(addMmComment(g, key, { id: uid(), from: ME, to, text: t, ts: Date.now() }));
    setDraft(""); setOpenComment(null); setReplyTo(null);
    void npcReply(key, author, postText, t, to);
  };

  /* 玩家发圈 → NPC 点赞 / 评论 */
  const publish = async (text: string, imgs: string[]) => {
    const id = `me_${uid()}`;
    addFeedMoments([{ id, pid: ME, text, imgCount: imgs.length, imgs, ts: Date.now(), likers: [] }]);
    commitGame(logAct(gRef.current, { app: "朋友圈", text: `发了条朋友圈${imgs.length ? `（配图 ${imgs.length} 张）` : ""}`, bit: text || "（仅图片）", min: 5 }));
    setComposing(false);
    const pool = friendsOf(g).slice(0, 12);
    const ok = new Set(pool.map((n) => n.id));
    let likers: string[] = [], comments: { pid: string; text: string }[] = [];
    if (cfg) {
      const res = await syncJson<{ likers?: unknown; comments?: unknown }>(cfg, g, "wechat-moments", "朋友圈",
        `主角${g.player.name}刚发了朋友圈：「${text || "（仅图片）"}」${imgs.length ? `，配图 ${imgs.length} 张` : ""}。请决定哪些人物点赞（likers，pid 数组）以及 0~3 条评论（各自口吻，≤40 字），人物从：${pool.map(personaOf).join("、")}
${MOMENT_RULE}
返回 {"likers":[],"comments":[{"pid":"","text":""}]}`).catch(() => null);
      if (res) {
        likers = Array.isArray(res.likers) ? res.likers.filter((x): x is string => typeof x === "string" && ok.has(x)).slice(0, 8) : [];
        comments = (Array.isArray(res.comments) ? res.comments : []).map((r) => r as { pid?: unknown; text?: unknown })
          .map((r) => ({ pid: str(r?.pid, 60), text: str(r?.text, 80) })).filter((r) => ok.has(r.pid) && r.text).slice(0, 3);
      }
    }
    likers.forEach((pid, i) => later(800 + i * 700, (gg) => addMmLiker(gg, id, pid)));
    comments.forEach((c, i) => later(2000 + i * 1600, (gg) => addMmComment(gg, id, { id: uid(), from: c.pid, text: c.text, ts: Date.now() })));
  };

  /* 下拉手势 */
  const scrollTop = () => (rootRef.current?.parentElement?.scrollTop ?? 0);
  const onTouchStart = (e: React.TouchEvent) => { touchY.current = scrollTop() <= 0 ? e.touches[0].clientY : null; };
  const onTouchMove = (e: React.TouchEvent) => { if (touchY.current != null && !busy) setPull(Math.max(0, Math.min(90, (e.touches[0].clientY - touchY.current) * 0.5))); };
  const onTouchEnd = () => { touchY.current = null; if (pull > 55) void refresh(); else setPull(0); };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>, cb: (url: string) => void, max: number) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void readImage(f, max).then(cb);
  };

  return (
    <div ref={rootRef} className="relative min-h-full bg-white" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {(pull > 0 || busy) && (
        <div className="flex items-center justify-center bg-[#2b2f36] text-[12px] text-white/80" style={{ height: busy ? 36 : pull }}>
          {busy ? "正在刷新…" : pull > 55 ? "松开刷新" : "下拉刷新"}
        </div>
      )}
      {/* 相册封面 + 头像 */}
      <div className="relative h-56 bg-[#2b2f36]">
        <button onClick={() => coverRef.current?.click()} className="block h-full w-full" aria-label="更换朋友圈背景">
          <img src={(prof.cover || COVER) || undefined} alt="朋友圈封面" className="h-full w-full object-cover" />
        </button>
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e, (url) => setProfile({ cover: url }), 1100)} />
        <div className="absolute right-3 top-3 flex gap-2">
          <button onClick={() => void refresh()} disabled={busy} className="rounded-full bg-black/35 px-2.5 py-1 text-[12px] text-white disabled:opacity-50">{busy ? "刷新中" : "刷新"}</button>
          <button onClick={() => { rootRef.current?.parentElement?.scrollTo({ top: 0 }); setComposing(true); }} className="rounded-full bg-black/35 px-2.5 py-1 text-[12px] text-white">发表</button>
        </div>
        <div className="absolute -bottom-7 right-3 flex items-end gap-2.5">
          <span className="pb-9 text-right text-[16px] font-semibold text-white drop-shadow">{g.player.name}</span>
          {/* 功能注释：主角头像统一在角色资料里更换，朋友圈只展示 */}
          <span className="overflow-hidden rounded-[10px] ring-2 ring-white">
            <Avatar src={g.player.avatar} name={g.player.name} size={66} editable={false} />
          </span>
        </div>
      </div>
      <div className="mt-9 px-4 text-right">
        {editSign != null ? (
          <div className="flex items-center gap-2">
            <input value={editSign} onChange={(e) => setEditSign(e.target.value.slice(0, 40))} autoFocus placeholder="写点个性签名…" className="flex-1 rounded-md bg-[#f2f2f2] px-3 py-1.5 text-[13px] text-[#111] outline-none" onKeyDown={(e) => { if (e.key === "Enter") { setProfile({ sign: editSign.trim() }); setEditSign(null); } }} />
            <button onClick={() => { setProfile({ sign: editSign.trim() }); setEditSign(null); }} className="rounded-md bg-[#07c160] px-3 py-1.5 text-[13px] text-white">保存</button>
          </div>
        ) : (
          <button onClick={() => setEditSign(prof.sign ?? "")} className="text-[12.5px] text-[#8a8a8a] active:opacity-60">{prof.sign || "点击设置个性签名"}</button>
        )}
      </div>

      <div className="mt-3 divide-y divide-black/[0.06]">
        {posts.map((p) => {
          const isMe = p.pid === ME;
          const npc = isMe ? undefined : npcById(p.pid);
          const likeKey = `mm:${p.key}`;
          const liked = likeSet.has(likeKey);
          const likeIds = Array.from(new Set([...p.seedLikes, ...mmLikers(g, p.key)])).filter((x) => x !== ME);
          const likeNames = [...(liked ? [g.player.name] : []), ...likeIds.map(nameOf)];
          const cs = mmComments(g, p.key);
          return (
            <div key={p.key} className="flex gap-3 px-3 py-3.5">
              <button onClick={() => !isMe && onOpenProfile?.(p.pid)} className="h-[42px] w-[42px] shrink-0 self-start overflow-hidden rounded-[6px]"><Avatar src={isMe ? g.player.avatar : npc?.avatar} name={nameOf(p.pid)} size={42} editable={false} /></button>
              <div className="min-w-0 flex-1">
                <button onClick={() => !isMe && onOpenProfile?.(p.pid)} className="text-[15px] font-semibold text-[#576b95] active:opacity-70">{nameOf(p.pid)}</button>
                {p.text && <p className="mt-1 whitespace-pre-wrap break-words text-[14.5px] leading-snug text-[#111]">{p.text}</p>}
                {p.imgs.length > 0 && (
                  <div className={`mt-2 grid gap-1 ${p.imgs.length === 1 ? "w-2/3 grid-cols-1" : p.imgs.length === 4 || p.imgs.length === 2 ? "w-full max-w-[160px] grid-cols-2" : "w-full max-w-[240px] grid-cols-3"}`}>
                    {p.imgs.map((src, k) => (
                      <button key={k} onClick={() => setLightbox(src)} className={`overflow-hidden bg-black/5 ${p.imgs.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}>
                        <img src={(src) || undefined} alt="" loading="lazy" className="h-full w-full object-cover transition active:scale-95" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center">
                  <span className="text-[12px] text-[#b2b2b2]">{p.when}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => commitGame(toggleLike(g, likeKey))} className={`flex items-center gap-1 rounded bg-[#f7f7f7] px-2 py-1 text-[12px] ${liked ? "text-[#fa5151]" : "text-[#576b95]"}`}><IconHeart size={13} filled={liked} /></button>
                    <button onClick={() => { setOpenComment(openComment === p.key ? null : p.key); setReplyTo(null); }} className="flex items-center gap-1 rounded bg-[#f7f7f7] px-2 py-1 text-[12px] text-[#576b95]"><IconComment size={13} /></button>
                  </div>
                </div>
                {(likeNames.length > 0 || cs.length > 0) && (
                  <div className="mt-2 space-y-1 rounded-[4px] bg-[#f7f7f7] px-2.5 py-2">
                    {likeNames.length > 0 && (
                      <p className="flex items-start gap-1.5 text-[12.5px] text-[#576b95]"><span className="mt-[3px]"><IconHeart size={12} filled /></span><span>{likeNames.join("，")}</span></p>
                    )}
                    {likeNames.length > 0 && cs.length > 0 && <div className="h-px bg-black/[0.05]" />}
                    {cs.map((c) => (
                      <button key={c.id} onClick={() => { if (c.from !== ME) { setOpenComment(p.key); setReplyTo({ key: p.key, to: c.from }); } }} className="block w-full text-left text-[12.5px] leading-snug text-[#111] active:bg-black/5">
                        <span className="text-[#576b95]">{nameOf(c.from)}</span>
                        {c.to && <>{" 回复 "}<span className="text-[#576b95]">{c.to === ME ? "你" : nameOf(c.to)}</span></>}：{c.text}
                      </button>
                    ))}
                  </div>
                )}
                {openComment === p.key && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(p.key, p.pid, p.text); }} autoFocus placeholder={replyTo?.key === p.key ? `回复 ${nameOf(replyTo.to)}…` : "评论…"} className="min-w-0 flex-1 rounded-md bg-[#f2f2f2] px-3 py-1.5 text-[13px] text-[#111] outline-none placeholder:text-[#b2b2b2]" />
                    <button onClick={() => submit(p.key, p.pid, p.text)} disabled={!draft.trim()} className="rounded-md bg-[#07c160] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40">发送</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <LoadMoreButton loading={moreLoading} onClick={loadMore} color="#576b95" />
      {toast && <div className="pointer-events-none absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-lg bg-black/75 px-3 py-1.5 text-[12.5px] text-white">{toast}</div>}
      {composing && <Composer onCancel={() => setComposing(false)} onPublish={(t, imgs) => void publish(t, imgs)} />}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function Composer({ onCancel, onPublish }: { onCancel: () => void; onPublish: (text: string, imgs: string[]) => void }) {
  const [text, setText] = useState("");
  const [imgs, setImgs] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const add = async (files: FileList | null) => {
    const list = Array.from(files ?? []).slice(0, 9 - imgs.length);
    const urls = await Promise.all(list.map((f) => readImage(f)));
    setImgs((a) => [...a, ...urls].slice(0, 9));
  };
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white" style={{ minHeight: "100%" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onCancel} className="text-[15px] text-[#111]">取消</button>
        <button onClick={() => onPublish(text.trim(), imgs)} disabled={!text.trim() && !imgs.length} className="rounded-md bg-[#07c160] px-3.5 py-1.5 text-[14px] font-medium text-white disabled:opacity-40">发表</button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} autoFocus placeholder="这一刻的想法…" rows={4} className="mx-4 resize-none text-[15px] text-[#111] outline-none placeholder:text-[#b2b2b2]" />
      <div className="mx-4 mt-3 grid max-w-[300px] grid-cols-3 gap-1.5">
        {imgs.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden bg-black/5">
            <img src={(src) || undefined} alt="" className="h-full w-full object-cover" />
            <button onClick={() => setImgs((a) => a.filter((_, k) => k !== i))} className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-black/55 text-[12px] leading-5 text-white">×</button>
          </div>
        ))}
        {imgs.length < 9 && (
          <button onClick={() => ref.current?.click()} className="flex aspect-square items-center justify-center bg-[#f2f2f2] text-[30px] text-[#b2b2b2]">＋</button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

export default function MomentsApp({ onBack }: { onBack: () => void }) {
  const [profile, setProfileView] = useState<string | null>(null);
  if (profile) return <ProfileView pid={profile} onBack={() => setProfileView(null)} />;
  return (
    <div className="relative flex h-full flex-col bg-[#ededed]">
      <TopBar title="朋友圈" onBack={onBack} />
      <div className="flex-1 overflow-y-auto"><Moments onOpenProfile={setProfileView} /></div>
    </div>
  );
}

/* 朋友圈可见范围：主角的绿信好友（去掉被设为禁止发消息的人） */
function friendsOf(g: GameState) {
  return (g.phone?.contacts ?? []).map((id) => g.npcs.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n && !isBlocked(g, n.id));
}
