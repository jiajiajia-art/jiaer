/* 星潮 · 追星饭圈论坛（原生 React）
 * 版块 / 帖子列表（置顶·精华·热·吃瓜指数）/ 帖子详情（楼层、楼中楼、只看楼主、热门排序、引用回复、外语翻译、投票）
 * 玩家以论坛昵称发帖、回帖、楼中楼；正主下场；AI 联动世界剧情（useWorldSync + syncJson），未配置 AI 时不展示任何预设帖。
 * 所有论坛数据仅存 localStorage，与主线存档互不影响。 */
import { loadData, saveData } from "../../lib/saveScope";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useGame } from "../../store/gameCtx";
import { useConfirm } from "../EditorKit";
import { isConfigured } from "../../lib/ai";
import { syncJson, useWorldSync, loadFeed, saveFeed } from "./worldSync";
import { logAct, logNpcNet } from "../../game/phoneLink";
import { Empty, PullToRefresh, delay, LoadMoreButton, seenOf, NeedAI } from "./shared";
import type { AIConfig, GameState } from "../../lib/types";
import { IconChart, IconClose, IconEye, IconFlame, IconGlobe, IconHeart, IconMessage, IconStar } from "../../lib/icons";

const BRAND = "#6d4aff";
const FEED = "forum.v2";
const USER_KEY = "star2005.forum.user.v2";
const CAP = 40;

/* ───────── 类型 ───────── */
type BoardId = "star" | "gua" | "cp" | "lutou" | "data" | "tucao" | "global";
const BOARDS: { id: BoardId; name: string; desc: string; color: string }[] = [
  { id: "star", name: "主角超话", desc: "安利楼 · 日常 · 舞台", color: "#6d4aff" },
  { id: "gua", name: "瓜田", desc: "八卦爆料 · 理性吃瓜", color: "#16a34a" },
  { id: "cp", name: "CP楼", desc: "嗑糖 · 磕学家", color: "#ec4899" },
  { id: "lutou", name: "路透代拍", desc: "片场 · 机场 · 生图", color: "#f59e0b" },
  { id: "data", name: "数据组", desc: "打榜 · 控评 · 做数据", color: "#0ea5e9" },
  { id: "tucao", name: "对线吐槽", desc: "黑粉对线 · 文明发言", color: "#ef4444" },
  { id: "global", name: "海外粉", desc: "EN · JP · KR", color: "#14b8a6" },
];
const BOARD_IDS = BOARDS.map((b) => b.id);
const boardOf = (id: BoardId) => BOARDS.find((b) => b.id === id) ?? BOARDS[0];

const TAGS = ["爆", "水", "求助", "精", "讨论", "安利", "路透", "数据", "瓜", "糖", "海外", "投票"];
const TAG_COLOR: Record<string, string> = { 爆: "#ef4444", 精: "#f59e0b", 瓜: "#16a34a", 糖: "#ec4899", 求助: "#0ea5e9", 投票: "#6d4aff" };

type Flair = "唯粉" | "CP粉" | "路人" | "黑子" | "代拍" | "数据" | "海外" | "正主" | "认证" | "吃瓜";
const FLAIRS: Flair[] = ["唯粉", "CP粉", "路人", "黑子", "代拍", "数据", "海外", "正主", "认证", "吃瓜"];
const FLAIR_STYLE: Record<Flair, string> = {
  唯粉: "bg-violet-100 text-violet-700",
  CP粉: "bg-pink-100 text-pink-700",
  路人: "bg-gray-100 text-gray-600",
  黑子: "bg-neutral-800 text-white",
  代拍: "bg-amber-100 text-amber-700",
  数据: "bg-sky-100 text-sky-700",
  海外: "bg-teal-100 text-teal-700",
  正主: "bg-gradient-to-r from-amber-400 to-rose-500 text-white",
  认证: "bg-blue-500 text-white",
  吃瓜: "bg-green-100 text-green-700",
};
const LANGS = ["EN", "JP", "KR"] as const;
type Lang = (typeof LANGS)[number];

type Reply = { id: string; u: string; c: string; to?: string; mine?: boolean; star?: boolean; ts: number };
type Floor = {
  id: string;
  u: string;
  lv: number;
  flair: Flair;
  c: string;
  likes: number;
  ts: number;
  lang?: Lang;
  tr?: string;
  re: Reply[];
  del?: boolean;
  upd?: boolean;
  quote?: { u: string; c: string };
  mine?: boolean;
};
type Poll = { q: string; opts: { t: string; n: number }[] };
type Thread = {
  id: string;
  board: BoardId;
  title: string;
  tags: string[];
  author: string;
  lv: number;
  flair: Flair;
  c: string;
  ts: number;
  lastTs: number;
  views: number;
  likes: number;
  hot: number; // 吃瓜指数 0~100
  pin?: boolean;
  elite?: boolean;
  poll?: Poll;
  floors: Floor[];
  mine?: boolean;
  starCame?: boolean;
  /** 由底部「查看更多」加载，按加载顺序排在列表末尾 */
  more?: boolean;
};
type User = { name: string; liked: string[]; votes: Record<string, number> };

/* ───────── 工具 ───────── */
const uid = () => Math.random().toString(36).slice(2, 10);
const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const lvOf = (name: string) => 1 + (hash(name) % 15);
const MIN = 60_000;

function ago(ts: number) {
  const d = Date.now() - ts;
  if (d < MIN) return "刚刚";
  if (d < 60 * MIN) return `${Math.floor(d / MIN)}分钟前`;
  if (d < 24 * 60 * MIN) return `${Math.floor(d / 60 / MIN)}小时前`;
  const t = new Date(ts);
  return `${t.getMonth() + 1}-${t.getDate()}`;
}
const fmtN = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}w` : String(n));
const replyCount = (t: Thread) => t.floors.reduce((s, f) => s + 1 + f.re.length, 0);

const NICK_A = ["今天也在", "熬夜", "月亮", "柠檬", "一颗", "芝士", "午夜", "不吃香菜的", "电子", "退休", "卑微", "理性", "冲浪", "社恐", "搬砖"];
const NICK_B = ["吃瓜人", "嗑糖机", "小土豆", "代拍组长", "数据女工", "考古学家", "路人甲", "磕学家", "柚子", "猫猫", "打工人", "啵啵", "星星", "观察员", "哨兵"];
const nick = () => `${pick(NICK_A)}${pick(NICK_B)}${Math.random() < 0.4 ? rand(1, 999) : ""}`;

function loadUser(): User {
  try {
    const v = loadData<any>(USER_KEY, null);
    if (v && typeof v === "object") return { name: typeof v.name === "string" && v.name ? v.name : "", liked: Array.isArray(v.liked) ? v.liked.filter((x: unknown) => typeof x === "string") : [], votes: v.votes && typeof v.votes === "object" ? v.votes : {} };
  } catch { /* 忽略 */ }
  return { name: "", liked: [], votes: {} };
}
function saveUser(u: User) {
  saveData(USER_KEY, { ...u, liked: u.liked.slice(-800) });
}

function mkFloor(u: string, flair: Flair, c: string, extra: Partial<Floor> = {}): Floor {
  return { id: uid(), u, lv: flair === "正主" || flair === "认证" ? 18 : lvOf(u), flair, c, likes: rand(3, 260), ts: Date.now() - rand(1, 300) * MIN, re: [], ...extra };
}
const rp = (u: string, c: string, extra: Partial<Reply> = {}): Reply => ({ id: uid(), u, c, ts: Date.now() - rand(1, 200) * MIN, ...extra });

/* ───────── AI ───────── */
const FORUM_SYS =
  "你在为饭圈论坛「星潮」生成拟真内容（类似豆瓣小组/贴吧/虎扑/NGA 的混合口吻）。围绕主角当前剧情：有梗、具体、有信息量，严禁空洞灌水和重复。" +
  "视角多元：唯粉安利/CP粉嗑糖（不上升真人）/路人理性/数据组/代拍路透/少量黑子（会被理性反驳或自己转粉）/海外粉（英日韩原文+中文翻译）。尊重主角人设，禁止 OOC、禁止低俗物化。只输出 JSON。";
const FLOOR_SCHEMA =
  '楼层对象：{"u":昵称,"flair":"唯粉|CP粉|路人|黑子|代拍|数据|海外|吃瓜","c":内容(15~120字),"likes":整数,"lang":"EN|JP|KR"(仅海外粉),"tr":中文翻译(仅海外粉),"op":true(仅当楼主本人回帖/更新),"del":true(极少数被管理员删除的楼),"re":[{"u":昵称,"c":楼中楼内容}](可选0~4条)}';

function forumCall<T extends object>(cfg: AIConfig, game: GameState, task: string) {
  const extra = `主角人设：${game.player.description || "（未填写）"}`;
  return syncJson<T>(cfg, game, "forum", "星潮论坛", `${FORUM_SYS}\n${extra}\n\n${task}`);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function cleanReply(x: unknown, npcNames: Set<string>): Reply | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const c = str(r.c, 260);
  if (!c) return null;
  const u = str(r.u, 18) || nick();
  return rp(u, npcNames.has(u) ? `${c}` : c);
}

function cleanFloor(x: unknown, ctx: { author?: string; npcNames: Set<string>; star?: string; force?: Flair }): Floor | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const del = r.del === true;
  const c = str(r.c, 500);
  if (!c && !del) return null;
  let u = str(r.u, 18) || nick();
  const isOp = r.op === true && !!ctx.author;
  if (isOp) u = ctx.author!;
  let flair: Flair = ctx.force ?? (FLAIRS.includes(r.flair as Flair) ? (r.flair as Flair) : "路人");
  if (flair === "正主" && !ctx.force) flair = "路人";
  if (ctx.npcNames.has(u)) flair = "认证";
  const f = mkFloor(u, flair, del ? "" : c, {
    likes: Number.isFinite(Number(r.likes)) ? clamp(Math.round(Number(r.likes)), 0, 99999) : rand(5, 300),
    re: Array.isArray(r.re) ? r.re.map((y) => cleanReply(y, ctx.npcNames)).filter((y): y is Reply => !!y).slice(0, 6) : [],
    del: del || undefined,
    upd: isOp || undefined,
  });
  if (typeof r.lang === "string" && (LANGS as readonly string[]).includes(r.lang) && str(r.tr, 500)) {
    f.lang = r.lang as Lang;
    f.tr = str(r.tr, 500);
    if (!ctx.force && !ctx.npcNames.has(u)) f.flair = "海外";
  }
  return f;
}

function cleanThread(x: unknown, npcNames: Set<string>): Thread | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const title = str(r.title, 40).replace(/^【[^】]*】/, "");
  const c = str(r.c, 800);
  if (!title || !c) return null;
  const author = str(r.u, 18) || nick();
  const board = (BOARD_IDS.includes(r.board as BoardId) ? r.board : "star") as BoardId;
  const tags = (Array.isArray(r.tags) ? r.tags : []).map((t) => String(t).replace(/[【】]/g, "")).filter((t) => TAGS.includes(t)).slice(0, 2);
  const now = Date.now();
  const ts = now - rand(5, 180) * MIN;
  const floors = (Array.isArray(r.floors) ? r.floors : []).map((y) => cleanFloor(y, { author, npcNames })).filter((f): f is Floor => !!f).slice(0, 20);
  floors.forEach((f, i) => { f.ts = ts + (i + 1) * rand(1, 6) * MIN; if (f.ts > now) f.ts = now - rand(0, 3) * MIN; });
  let poll: Poll | undefined;
  const pr = r.poll as Record<string, unknown> | undefined;
  if (pr && typeof pr === "object" && Array.isArray(pr.opts)) {
    const opts = pr.opts.map((o) => str(o, 24)).filter(Boolean).slice(0, 4);
    if (opts.length >= 2 && str(pr.q, 40)) poll = { q: str(pr.q, 40), opts: opts.map((t) => ({ t, n: rand(30, 900) })) };
  }
  const hot = clamp(Number(r.hot) || rand(20, 90), 0, 100);
  return {
    id: uid(), board, title, tags: poll && !tags.includes("投票") ? [...tags, "投票"].slice(0, 3) : tags, author, lv: lvOf(author),
    flair: npcNames.has(author) ? "认证" : FLAIRS.includes(r.flair as Flair) && r.flair !== "正主" ? (r.flair as Flair) : "路人",
    c, ts, lastTs: floors.length ? Math.max(...floors.map((f) => f.ts)) : ts, views: rand(800, 40000), likes: rand(20, 2000), hot,
    elite: tags.includes("精") || undefined, poll, floors,
  };
}

/* ───────── 小组件 ───────── */
function Lv({ n }: { n: number }) {
  const c = n >= 15 ? "bg-rose-500" : n >= 10 ? "bg-orange-400" : n >= 5 ? "bg-sky-500" : "bg-gray-400";
  return <span className={`rounded px-1 text-[9px] font-bold leading-[14px] text-white ${c}`}>Lv{n}</span>;
}
function FlairTag({ f }: { f: Flair }) {
  return <span className={`inline-flex items-center gap-0.5 rounded px-1 text-[9px] leading-[14px] ${FLAIR_STYLE[f]}`}>{f === "认证" ? "认证" : f === "正主" ? <><IconStar size={10} /> 正主</> : f}</span>;
}
function Ava({ name, size = 32 }: { name: string; size?: number }) {
  const hue = hash(name) % 360;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 60% 62%)` }}>
      {name.slice(0, 1)}
    </span>
  );
}
function TagChips({ tags }: { tags: string[] }) {
  return <>{tags.map((t) => <span key={t} className="mr-0.5 font-bold" style={{ color: TAG_COLOR[t] ?? "#6b7280" }}>【{t}】</span>)}</>;
}
function HotMeter({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-green-700">
      <IconFlame size={12} />
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-green-100"><span className="block h-full rounded-full bg-gradient-to-r from-green-400 to-red-500" style={{ width: `${v}%` }} /></span>
      {v}
    </span>
  );
}
const floorLabel = (n: number) => (n === 2 ? "沙发" : n === 3 ? "板凳" : n === 4 ? "地板" : `${n}楼`);

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="max-h-[85%] overflow-y-auto rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-gray-900">{title}</span>
          <button onClick={onClose} className="text-[13px] text-gray-500">关闭</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───────── 主组件 ───────── */
export default function ForumApp({ onBack }: { onBack: () => void }) {
  const { game, cfg, patchGame } = useGame();
  /* 线上联动：主角在论坛的浏览 / 发帖 / 回帖记入手机流水；角色以本名发的帖与回复写进角色本人的记忆 */
  const act = (text: string, min: number, key?: string, bit?: string) => patchGame((g) => logAct(g, { app: "论坛", text, min, key, bit }));
  const noteNpcPosts = (list: Thread[]) => patchGame((g) => {
    const byName = new Map(g.npcs.map((n) => [n.name, n.id]));
    let x = g;
    for (const t of list) {
      const op = byName.get(t.author);
      if (op) x = logNpcNet(x, op, "论坛", `发帖《${t.title}》：${t.c}`);
      for (const f of t.floors) {
        const pid = byName.get(f.u);
        if (pid && !f.del && f.c) x = logNpcNet(x, pid, "论坛", `在帖子《${t.title}》下回复：${f.c}`);
      }
    }
    return x;
  });
  const star = (game?.player.name || "她").trim();
  const aiOn = isConfigured(cfg);
  const gRef = useRef(game); gRef.current = game;
  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  const npcNames = useMemo(() => new Set((game?.npcs ?? []).map((n) => n.name)), [game?.npcs]);

  const [threads, setThreads] = useState<Thread[]>(() => {
    const saved = loadFeed<Thread[]>(FEED);
    return Array.isArray(saved) && saved.length ? saved.filter((t) => t && Array.isArray(t.floors)) : [];
  });
  useEffect(() => { saveFeed(FEED, threads); }, [threads]);
  const threadsRef = useRef(threads); threadsRef.current = threads;
  const [user, setUser] = useState<User>(loadUser);
  useEffect(() => { saveUser(user); }, [user]);
  const myName = user.name || `星潮网友${hash(star) % 9000 + 1000}`;

  const [board, setBoard] = useState<BoardId | "all">("all");
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "post" | "me">(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const toastT = useRef<number | undefined>(undefined);
  // 生成失败：温柔提示 + 重新生成（不再用模板套话顶替）
  const [fail, setFail] = useState<{ msg: string; retry: () => void } | null>(null);
  const failSoft = (what: string, retry: () => void) => setFail({ msg: `${what}这一次没能生成出来，可能是网络或 AI 打了个小盹。别担心，你的内容都还在，点一下重新生成就好～`, retry });
  const say = (s: string) => { setToast(s); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(""), 2200); };

  const patch = (id: string, fn: (t: Thread) => Thread) => setThreads((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
  const liked = useMemo(() => new Set(user.liked), [user.liked]);
  const toggleLike = (id: string) => setUser((u) => ({ ...u, liked: u.liked.includes(id) ? u.liked.filter((x) => x !== id) : [...u.liked, id] }));

  /* AI：刷新键生成新帖 */
  const genThreads = async (): Promise<string> => {
    const g = gRef.current, c = cfgRef.current;
    if (!g || !isConfigured(c)) return "未配置 AI，无法联动剧情";
    const names = [...npcNames].slice(0, 8).join("、");
    const p = await forumCall<{ threads?: unknown[] }>(c, g, `请根据当前剧情，为论坛生成 5 个新帖子，分布在不同版块（board 取值：star=主角超话/安利楼, gua=八卦瓜田, cp=CP楼, lutou=路透代拍, data=数据组, tucao=黑粉对线吐槽, global=海外粉）。
主角是「${g.player.name}」。圈内人物：${names || "（无）"}；这些人物偶尔可以用本名作为认证账号回帖（u 用本名）。
每个帖子：{"board":..,"tags":["爆|水|求助|精|讨论|安利|路透|数据|瓜|糖|海外"中1~2个],"title":标题(≤28字,不要带【】),"u":楼主昵称,"flair":身份,"c":主楼正文(80~200字),"hot":吃瓜指数0~100,"poll":{"q":问题,"opts":[2~4个选项]}(仅1个帖子带),"floors":[10~16 层]}
楼层里要有：楼主更新（op:true）1次、至少一条被删除的楼（del:true,c 可为空）、部分楼带楼中楼 re、黑子被反驳、海外粉原文+翻译。
${FLOOR_SCHEMA}
返回 JSON：{"threads":[...]}`);
    const list = (Array.isArray(p?.threads) ? p!.threads : []).map((x) => cleanThread(x, npcNames)).filter((t): t is Thread => !!t);
    if (!list.length) { failSoft("新的热帖", () => void genThreads().then((m) => m && say(m))); return ""; }
    setFail(null);
    noteNpcPosts(list);
    setThreads((ts) => {
      const keep = ts.filter((t) => t.pin || t.mine);
      const rest = ts.filter((t) => !t.pin && !t.mine && !t.more);
      const more = ts.filter((t) => t.more && !t.pin && !t.mine);
      return [...[...keep, ...list, ...rest].slice(0, Math.max(CAP, keep.length + list.length)), ...more];
    });
    return `星潮新增 ${list.length} 个热帖`;
  };
  useWorldSync("forum", genThreads);

  /* 底部「查看更多」：结合剧情再生成一批帖子，接在列表末尾（持久化） */
  const [moreLoading, setMoreLoading] = useState(false);
  const loadMore = async () => {
    if (moreLoading) return;
    const g = gRef.current, c = cfgRef.current;
    if (!g || !isConfigured(c)) { say("未配置 AI，暂无更多"); return; }
    setMoreLoading(true);
    try {
      const seen = seenOf(threads.map((t) => t.title));
      const bd = board === "all" ? "分布在不同版块" : `全部放在版块 ${board}`;
      const p = await forumCall<{ threads?: unknown[] }>(c, g, `请根据当前剧情，再为论坛生成 4 个新帖子，${bd}（board 取值：star=主角超话/安利楼, gua=八卦瓜田, cp=CP楼, lutou=路透代拍, data=数据组, tucao=黑粉对线吐槽, global=海外粉）。
主角是「${g.player.name}」。也可以是圈内日常与路人闲聊。不要与这些已有帖子重复：${seen}
每个帖子：{"board":..,"tags":["爆|水|求助|精|讨论|安利|路透|数据|瓜|糖|海外"中1~2个],"title":标题(≤28字,不要带【】),"u":楼主昵称,"flair":身份,"c":主楼正文(80~200字),"hot":吃瓜指数0~100,"floors":[6~10 层]}
${FLOOR_SCHEMA}
返回 JSON：{"threads":[...]}`);
      const list = (Array.isArray(p?.threads) ? p!.threads : []).map((x) => cleanThread(x, npcNames)).filter((t): t is Thread => !!t).map((t) => ({ ...t, more: true, pin: false }));
      if (!list.length) { failSoft("更多帖子", () => void loadMore()); return; }
      setFail(null);
      noteNpcPosts(list);
      setThreads((ts) => {
        const more = ts.filter((t) => t.more && !t.pin && !t.mine);
        const drop = new Set(more.slice(0, Math.max(0, more.length + list.length - 60)).map((t) => t.id));
        return [...ts.filter((t) => !drop.has(t.id)), ...list];
      });
      say(`新加载 ${list.length} 个帖子`);
    } catch { failSoft("更多帖子", () => void loadMore()); } finally { setMoreLoading(false); }
  };

  const pullRefresh = async () => {
    if (!aiOn) { await delay(500); say("未配置 AI，展示本地帖子"); return; }
    const m = await genThreads(); if (m) say(m);
  };

  /* 玩家发帖后：网友反应 */
  const reactTo = async (tid: string, content: string, kind: "thread" | "floor") => {
    const g = gRef.current, c = cfgRef.current;
    let floors: Floor[] = [];
    if (g && isConfigured(c)) {
      const p = await forumCall<{ floors?: unknown[] }>(c, g, `论坛用户「${myName}」刚刚${kind === "thread" ? "发了新帖" : "回了一层楼"}，内容：「${content.slice(0, 300)}」。请生成 3~4 条其他网友对此的真实反应（赞同/调侃/反驳/补充信息，口吻各异），可带楼中楼。\n${FLOOR_SCHEMA}\n返回 JSON：{"floors":[...]}`).catch(() => null);
      floors = (Array.isArray(p?.floors) ? p!.floors : []).map((x) => cleanFloor(x, { npcNames })).filter((f): f is Floor => !!f).slice(0, 5);
    }
    if (!g || !isConfigured(c)) return;
    if (!floors.length) { failSoft("网友们的回应", () => void reactTo(tid, content, kind)); return; }
    setFail(null);
    const now = Date.now();
    floors.forEach((f, i) => { f.ts = now + i * 1000; f.c = f.del ? "" : f.c; if (kind === "floor") f.quote = { u: myName, c: content.slice(0, 40) }; });
    patch(tid, (t) => ({ ...t, floors: [...t.floors, ...floors], lastTs: now, hot: clamp(t.hot + 6, 0, 100), views: t.views + rand(50, 400) }));
    say(`有 ${floors.length} 位网友回应了你`);
  };

  const createThread = (b: BoardId, tag: string, title: string, c: string, pollOpts: string[]) => {
    const now = Date.now();
    const t: Thread = {
      id: uid(), board: b, title: title.slice(0, 40), tags: tag ? [tag] : [], author: myName, lv: lvOf(myName), flair: "唯粉", c, ts: now, lastTs: now,
      views: 1, likes: 0, hot: 10, floors: [], mine: true,
      poll: pollOpts.length >= 2 ? { q: "投票", opts: pollOpts.map((x) => ({ t: x, n: 0 })) } : undefined,
    };
    setThreads((ts) => [t, ...ts].slice(0, CAP + 10));
    act(`在论坛发帖《${t.title}》：${c.slice(0, 60)}`, 8);
    setSheet(null);
    setOpenId(t.id);
    void reactTo(t.id, `${title}\n${c}`, "thread");
  };

  /* 楼中楼：被回复的网友回一句 */
  const subReact = async (tid: string, fid: string, content: string) => {
    const g = gRef.current, c = cfgRef.current;
    if (!g || !isConfigured(c)) return;
    const t0 = threadsRef.current.find((t) => t.id === tid);
    const f0 = t0?.floors.find((f) => f.id === fid);
    const p = await forumCall<{ re?: { u?: string; c?: string }[] }>(c, g, `论坛帖子《${t0?.title ?? ""}》里，「${f0?.u ?? "网友"}」的楼层（${(f0?.c ?? "").slice(0, 80)}）下，用户「${myName}」回复了：「${content.slice(0, 120)}」。请生成 1 条楼中楼回复（可以是被回复者本人或路过网友），口吻自然。返回 JSON：{"re":[{"u":昵称,"c":内容(≤60字)}]}`).catch(() => null);
    const x = Array.isArray(p?.re) ? p!.re.find((y) => y?.c) : undefined;
    if (!x?.c) { failSoft("楼中楼的回复", () => void subReact(tid, fid, content)); return; }
    setFail(null);
    patch(tid, (t) => ({ ...t, floors: t.floors.map((f) => (f.id === fid ? { ...f, re: [...f.re, rp(String(x.u || nick()).slice(0, 16), `回复 ${myName}：${String(x.c).slice(0, 120)}`, { ts: Date.now() })] } : f)) }));
  };

  /* 继续盖楼 */
  const moreFloors = async (tid: string) => {
    if (busy) return;
    const t0 = threadsRef.current.find((t) => t.id === tid);
    const g = gRef.current, c = cfgRef.current;
    if (!t0 || !g || !isConfigured(c)) return;
    setBusy("more");
    const recent = t0.floors.slice(-8).map((f) => `${f.u}：${f.c.slice(0, 30)}`).join("；");
    const p = await forumCall<{ floors?: unknown[] }>(c, g, `帖子《${t0.title}》（版块：${boardOf(t0.board).name}，楼主：${t0.author}）主楼：${t0.c.slice(0, 200)}\n已盖到 ${t0.floors.length + 1} 楼，最近楼层：${recent || "（无）"}。\n请续写 8~10 层楼，推进讨论走向，昵称和内容不得与前文重复，可含 1 次楼主更新(op:true)。\n${FLOOR_SCHEMA}\n返回 JSON：{"floors":[...]}`).catch(() => null);
    const more = (Array.isArray(p?.floors) ? p!.floors : []).map((x) => cleanFloor(x, { author: t0.author, npcNames })).filter((f): f is Floor => !!f);
    setBusy("");
    if (!more.length) { failSoft("新的楼层", () => void moreFloors(tid)); return; }
    setFail(null);
    const now = Date.now();
    more.forEach((f, i) => { f.ts = now - (more.length - i) * MIN; });
    patch(tid, (t) => ({ ...t, floors: [...t.floors, ...more], lastTs: now, views: t.views + rand(100, 900) }));
    say(`新盖了 ${more.length} 层楼`);
  };

  /* 正主下场 */
  const starReply = async (tid: string) => {
    const t0 = threadsRef.current.find((t) => t.id === tid);
    const g = gRef.current, c = cfgRef.current;
    if (busy || !t0 || t0.starCame || !g || !isConfigured(c)) return;
    setBusy("star");
    const vname = `${star}`;
    const p = await forumCall<{ floors?: unknown[] }>(c, g, `「正主下场」：主角「${star}」本人用认证账号在帖子《${t0.title}》里回帖（主楼：${t0.c.slice(0, 160)}）。生成 1~2 层，语气完全符合主角人设与当前处境，真诚、可爱、不做作，可以回应楼里的讨论；每层带 3~4 条网友激动的楼中楼 re。严禁 OOC。\n楼层对象：{"c":正文,"likes":整数(2000~9000),"re":[{"u":昵称,"c":内容}]}\n返回 JSON：{"floors":[...]}`).catch(() => null);
    const fl = (Array.isArray(p?.floors) ? p!.floors : []).map((x) => cleanFloor(x, { npcNames, force: "正主" })).filter((f): f is Floor => !!f).slice(0, 2);
    setBusy("");
    if (!fl.length) { failSoft("正主的回帖", () => void starReply(tid)); return; }
    setFail(null);
    const now = Date.now();
    fl.forEach((f) => { f.u = vname; f.lv = 18; f.flair = "正主"; f.ts = now; f.likes = Math.max(f.likes, rand(2000, 6000)); });
    patch(tid, (t) => ({ ...t, starCame: true, floors: [...t.floors, ...fl], hot: 100, views: t.views + rand(20000, 80000), lastTs: now, tags: t.tags.includes("爆") ? t.tags : ["爆", ...t.tags].slice(0, 3) }));
    say("正主下场！这楼炸了");
  };

  const open = threads.find((t) => t.id === openId) ?? null;

  return (
    <div className="relative flex h-full flex-col bg-[#f4f4f7] text-gray-900">
      {open ? (
        <ThreadView
          key={open.id}
          t={open}
          star={star}
          myName={myName}
          aiOn={aiOn}
          liked={liked}
          vote={user.votes[open.id]}
          busy={busy}
          onBack={() => setOpenId(null)}
          onLike={toggleLike}
          onVote={(i) => {
            if (user.votes[open.id] !== undefined || !open.poll) return;
            setUser((u) => ({ ...u, votes: { ...u.votes, [open.id]: i } }));
            patch(open.id, (t) => ({ ...t, poll: t.poll && { ...t.poll, opts: t.poll.opts.map((o, j) => (j === i ? { ...o, n: o.n + 1 } : o)) } }));
          }}
          onReply={(c, quote) => {
            const f = mkFloor(myName, "唯粉", c, { likes: 0, ts: Date.now(), mine: true, quote });
            patch(open.id, (t) => ({ ...t, floors: [...t.floors, f], lastTs: Date.now() }));
            act(`在帖子《${open.title}》下回帖`, 3, `forum:${open.id}`, c);
            void reactTo(open.id, c, "floor");
          }}
          onSubReply={(fid, c, to) => {
            patch(open.id, (t) => ({ ...t, lastTs: Date.now(), floors: t.floors.map((f) => (f.id === fid ? { ...f, re: [...f.re, rp(myName, c, { to, mine: true, ts: Date.now() })] } : f)) }));
            act(`在帖子《${open.title}》的楼中楼回复${to ? ` ${to}` : ""}`, 2, `forum:${open.id}`, c);
            void subReact(open.id, fid, c);
          }}
          onMore={() => void moreFloors(open.id)}
          onStar={() => void starReply(open.id)}
        />
      ) : !aiOn ? (
        <div className="flex h-full flex-col bg-white">
          <div className="flex items-center border-b border-black/5 px-3 py-2.5">
            <button onClick={onBack} className="text-[14px] text-[#555]">‹ 主屏</button>
          </div>
          <div className="flex-1 overflow-y-auto"><NeedAI what="论坛的帖子、楼层与网友回复" accent="#5b6cff" /></div>
        </div>
      ) : (
        <Home
          threads={threads}
          board={board}
          sort={sort}
          myName={myName}
          onBack={onBack}
          onBoard={setBoard}
          onSort={setSort}
          onOpen={(id) => { setOpenId(id); patch(id, (t) => ({ ...t, views: t.views + 1 })); const t = threads.find((x) => x.id === id); if (t) act("看了帖子", 3, "forum:read", t.title); }}
          onPost={() => setSheet("post")}
          onMe={() => setSheet("me")}
          onRefresh={pullRefresh}
          moreLoading={moreLoading}
          onLoadMore={loadMore}
        />
      )}

      {sheet === "post" && <PostSheet defBoard={board === "all" ? "star" : board} onClose={() => setSheet(null)} onSubmit={createThread} />}
      {sheet === "me" && (
        <MeSheet
          name={myName}
          threads={threads}
          onClose={() => setSheet(null)}
          onRename={(n) => { setUser((u) => ({ ...u, name: n })); say("昵称已更新"); }}
          onOpen={(id) => { setSheet(null); setOpenId(id); }}
          onReset={() => { setThreads([]); setSheet(null); say("已清空，将按当前剧情重新生成"); if (aiOn) void genThreads().then((m) => m && say(m)); }}
        />
      )}
      {fail && (
        <div className="absolute inset-x-3 bottom-4 z-50 flex items-start gap-2.5 rounded-2xl border border-[#5b6cff]/20 bg-white/95 p-3 shadow-[0_10px_30px_-12px_rgba(60,70,160,0.45)] backdrop-blur">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#5b6cff]/12 text-[#5b6cff]"><IconHeart size={14} /></span>
          <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-[#444]">{fail.msg}</p>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button onClick={() => { const f = fail; setFail(null); f.retry(); }} className="rounded-full bg-[#5b6cff] px-3 py-1.5 text-[12px] font-semibold text-white active:scale-95">重新生成</button>
            <button onClick={() => setFail(null)} className="text-[11px] text-[#999]">稍后再说</button>
          </div>
        </div>
      )}
      {toast && <div className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-[12px] text-white">{toast}</div>}
    </div>
  );
}

/* ───────── 首页 ───────── */
function Home(p: {
  threads: Thread[]; board: BoardId | "all"; sort: "hot" | "new"; myName: string;
  onBack: () => void; onBoard: (b: BoardId | "all") => void; onSort: (s: "hot" | "new") => void;
  onOpen: (id: string) => void; onPost: () => void; onMe: () => void; onRefresh: () => Promise<void>;
  moreLoading: boolean; onLoadMore: () => void;
}) {
  const list = useMemo(() => {
    const all = p.threads.filter((t) => p.board === "all" || t.board === p.board);
    const ls = all.filter((t) => !t.more);
    const score = (t: Thread) => t.hot * 3 + replyCount(t) * 2 + t.views / 800 - (Date.now() - t.lastTs) / (60 * MIN);
    return [...ls].sort((a, b) => (a.pin === b.pin ? 0 : a.pin ? -1 : 1) || (p.sort === "hot" ? score(b) - score(a) : b.lastTs - a.lastTs)).concat(all.filter((t) => t.more));
  }, [p.threads, p.board, p.sort]);
  const cur = p.board === "all" ? null : boardOf(p.board);

  return (
    <>
      <div className="flex items-center gap-2 bg-white px-3 py-2.5">
        <button onClick={p.onBack} className="text-[14px] text-gray-500">‹</button>
        <span className="text-[19px] font-black tracking-tight" style={{ color: BRAND }}>星潮</span>
        <span className="rounded bg-violet-50 px-1.5 text-[10px] text-violet-500">饭圈论坛</span>
        <span className="flex-1" />
        <button onClick={p.onMe} className="flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-2 text-[11px] text-gray-600">
          <Ava name={p.myName} size={20} />
          <span className="max-w-[80px] truncate">{p.myName}</span>
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-b border-black/5 bg-white px-3 pb-2 [scrollbar-width:none]">
        {[{ id: "all" as const, name: "全部", color: "#111" }, ...BOARDS].map((b) => (
          <button key={b.id} onClick={() => p.onBoard(b.id)} className={`shrink-0 rounded-full px-3 py-1 text-[12px] ${p.board === b.id ? "font-semibold text-white" : "bg-gray-100 text-gray-600"}`} style={p.board === b.id ? { background: b.color } : undefined}>
            {b.name}
          </button>
        ))}
      </div>
      {cur && (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-white" style={{ background: `linear-gradient(90deg, ${cur.color}, ${cur.color}aa)` }}>
          <span className="shrink-0 text-[14px] font-bold">{cur.name}</span>
          <span className="min-w-0 flex-1 truncate opacity-85">{cur.desc}</span>
          <span className="shrink-0">{p.threads.filter((t) => t.board === cur.id).length} 帖</span>
        </div>
      )}
      <div className="flex items-center gap-3 bg-white px-3 py-1.5 text-[12px]">
        {(["hot", "new"] as const).map((s) => (
          <button key={s} onClick={() => p.onSort(s)} className={p.sort === s ? "font-semibold text-gray-900" : "text-gray-400"}>
            {s === "hot" ? <span className="inline-flex items-center gap-0.5"><IconFlame size={12} /> 热门</span> : "最新回复"}
          </button>
        ))}
        <span className="flex-1" />
        <span className="text-[10px] text-gray-400">下拉刷新</span>
      </div>
      <PullToRefresh onRefresh={p.onRefresh} className="flex-1" accent={BRAND} tint="light">
        {list.length === 0 && <Empty text={p.threads.length ? "这个版块还没有帖子，来发第一帖吧" : "还没有帖子，下拉刷新按当前剧情生成（需接入 AI），也可以自己发第一帖"} />}
        {list.map((t) => {
          const rc = replyCount(t);
          const isHot = t.hot >= 75 || rc >= 30;
          return (
            <button key={t.id} onClick={() => p.onOpen(t.id)} className="block w-full border-b border-black/5 bg-white px-3 py-2.5 text-left active:bg-gray-50">
              <div className="text-[14px] leading-snug">
                {t.pin && <span className="mr-1 rounded bg-red-500 px-1 text-[10px] text-white">置顶</span>}
                {t.elite && <span className="mr-1 rounded bg-amber-500 px-1 text-[10px] text-white">精</span>}
                {isHot && <span className="mr-1 rounded bg-orange-500 px-1 text-[10px] text-white">热</span>}
                {t.mine && <span className="mr-1 rounded bg-violet-500 px-1 text-[10px] text-white">我的</span>}
                <TagChips tags={t.tags} />
                <span className="font-medium">{t.title}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] text-gray-500">{t.c}</p>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="max-w-[90px] truncate text-gray-600">{t.author}</span>
                <Lv n={t.lv} />
                {p.board === "all" && <span style={{ color: boardOf(t.board).color }}>· {boardOf(t.board).name}</span>}
                <span className="flex-1" />
                <span className="inline-flex items-center gap-0.5"><IconMessage size={12} />{fmtN(rc)}</span>
                <span className="inline-flex items-center gap-0.5"><IconEye size={12} />{fmtN(t.views)}</span>
                <span>{ago(t.lastTs)}</span>
              </div>
              {t.hot >= 40 && <div className="mt-1"><HotMeter v={t.hot} /></div>}
            </button>
          );
        })}
        <LoadMoreButton loading={p.moreLoading} onClick={p.onLoadMore} color={BRAND} />
        <p className="py-4 text-center text-[11px] text-gray-400">— 星潮 · 文明追星 理性吃瓜 —</p>
      </PullToRefresh>
      <button onClick={p.onPost} className="absolute bottom-5 right-4 flex h-12 w-12 items-center justify-center rounded-full text-[26px] text-white shadow-lg" style={{ background: BRAND }} aria-label="发帖">+</button>
    </>
  );
}

/* ───────── 帖子详情 ───────── */
function ThreadView(p: {
  t: Thread; star: string; myName: string; aiOn: boolean; liked: Set<string>; vote?: number; busy: string;
  onBack: () => void; onLike: (id: string) => void; onVote: (i: number) => void;
  onReply: (c: string, quote?: { u: string; c: string }) => void; onSubReply: (fid: string, c: string, to?: string) => void;
  onMore: () => void; onStar: () => void;
}) {
  const { t } = p;
  const [onlyOp, setOnlyOp] = useState(false);
  const [order, setOrder] = useState<"asc" | "hot" | "desc">("asc");
  const [quote, setQuote] = useState<{ u: string; c: string } | null>(null);
  const [sub, setSub] = useState<{ fid: string; to?: string } | null>(null);
  const [text, setText] = useState("");
  const [tr, setTr] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const numbered = t.floors.map((f, i) => ({ f, n: i + 2 }));
  const shown = useMemo(() => {
    let ls = onlyOp ? numbered.filter((x) => x.f.u === t.author) : numbered;
    if (order === "hot") ls = [...ls].sort((a, b) => b.f.likes + b.f.re.length * 20 - (a.f.likes + a.f.re.length * 20));
    if (order === "desc") ls = [...ls].reverse();
    return ls;
  }, [t.floors, onlyOp, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = replyCount(t);
  const totalVotes = t.poll ? t.poll.opts.reduce((s, o) => s + o.n, 0) : 0;

  const send = () => {
    const c = text.trim();
    if (!c) return;
    if (sub) p.onSubReply(sub.fid, c, sub.to);
    else p.onReply(c, quote ?? undefined);
    if (sub) setOpen((s) => new Set(s).add(sub.fid));
    setText(""); setQuote(null); setSub(null);
  };
  const focus = () => window.setTimeout(() => inputRef.current?.focus(), 30);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-black/5 bg-white px-3 py-2.5">
        <button onClick={p.onBack} className="text-[14px] text-gray-500">‹ 返回</button>
        <span className="flex-1 truncate text-center text-[13px] font-semibold" style={{ color: boardOf(t.board).color }}>{boardOf(t.board).name}</span>
        <button onClick={() => setOnlyOp((v) => !v)} className={`rounded-full px-2 py-0.5 text-[11px] ${onlyOp ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600"}`}>只看楼主</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* 主楼 */}
        <div className="bg-white px-3 pb-3 pt-3">
          <h2 className="text-[16px] font-bold leading-snug"><TagChips tags={t.tags} />{t.title}</h2>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-400">
            <span className="inline-flex items-center gap-0.5"><IconEye size={12} /> {fmtN(t.views)}</span><span className="inline-flex items-center gap-0.5"><IconMessage size={12} /> {fmtN(total)}</span><HotMeter v={t.hot} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Ava name={t.author} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[12px] font-medium">
                <span className="truncate">{t.author}</span><Lv n={t.lv} /><FlairTag f={t.flair} />
                <span className="rounded bg-violet-600 px-1 text-[9px] leading-[14px] text-white">楼主</span>
              </div>
              <div className="text-[10px] text-gray-400">1楼 · {ago(t.ts)}</div>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-gray-800">{t.c}</p>
          {t.poll && (
            <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
              <div className="mb-2 inline-flex items-center gap-1 text-[12px] font-semibold text-violet-700"><IconChart size={12} /> {t.poll.q} <span className="font-normal text-gray-400">· {totalVotes} 人参与</span></div>
              {t.poll.opts.map((o, i) => {
                const pct = totalVotes ? Math.round((o.n / totalVotes) * 100) : 0;
                const voted = p.vote !== undefined;
                return (
                  <button key={i} disabled={voted} onClick={() => p.onVote(i)} className="relative mb-1.5 block w-full overflow-hidden rounded-lg bg-white px-3 py-2 text-left text-[12px]">
                    {voted && <span className="absolute inset-y-0 left-0 bg-violet-200/70" style={{ width: `${pct}%` }} />}
                    <span className="relative flex justify-between gap-2">
                      <span className="min-w-0 break-all">{o.t}{p.vote === i && " "}</span>
                      {voted && <span className="shrink-0 text-gray-500">{pct}%</span>}
                    </span>
                  </button>
                );
              })}
              {p.vote === undefined && <p className="text-[10px] text-gray-400">投票后查看结果</p>}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => p.onLike(t.id)} className={`rounded-full border px-3 py-1 text-[12px] ${p.liked.has(t.id) ? "border-rose-300 bg-rose-50 text-rose-500" : "border-gray-200 text-gray-500"}`}>
              <span className="inline-flex items-center gap-0.5"><IconHeart size={12} /> {t.likes + (p.liked.has(t.id) ? 1 : 0)}</span>
            </button>
            <button onClick={() => { setQuote({ u: t.author, c: t.c.slice(0, 40) }); setSub(null); focus(); }} className="rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-500">引用回复</button>
            <span className="flex-1" />
            <button disabled={!!p.busy || t.starCame} onClick={p.onStar} className="rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-40">
              {p.busy === "star" ? "正主赶来中…" : t.starCame ? "正主已下场" : "正主下场"}
            </button>
          </div>
        </div>

        <div className="sticky top-0 z-10 flex items-center gap-3 border-y border-black/5 bg-gray-50 px-3 py-1.5 text-[12px]">
          <span className="font-semibold">全部回复 {total}</span>
          <span className="flex-1" />
          {([["asc", "正序"], ["hot", "热门"], ["desc", "倒序"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setOrder(k)} className={order === k ? "font-semibold text-violet-600" : "text-gray-400"}>{l}</button>
          ))}
        </div>

        {shown.length === 0 && <Empty text={onlyOp ? "楼主还没有回帖" : "还没有人回复，来抢沙发"} />}
        {shown.map(({ f, n }) => {
          if (f.del) {
            return <div key={f.id} className="border-b border-black/5 bg-white px-3 py-3 text-[12px] italic text-gray-400">{floorLabel(n)} · 该楼层已被管理员删除（涉嫌引战/人身攻击）</div>;
          }
          const isOp = f.u === t.author;
          const isStar = f.flair === "正主";
          const showTr = tr.has(f.id);
          const expanded = open.has(f.id);
          const reShown = expanded ? f.re : f.re.slice(0, 2);
          const lk = p.liked.has(f.id);
          return (
            <div key={f.id} className={`border-b border-black/5 px-3 py-3 ${isStar ? "bg-gradient-to-br from-amber-50 to-rose-50" : f.mine ? "bg-violet-50/40" : "bg-white"}`}>
              <div className="flex items-center gap-2">
                <Ava name={f.u} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1 text-[12px] font-medium">
                    <span className={`max-w-[120px] truncate ${isStar ? "text-rose-600" : ""}`}>{f.u}</span><Lv n={f.lv} /><FlairTag f={f.flair} />
                    {isOp && <span className="rounded bg-violet-600 px-1 text-[9px] leading-[14px] text-white">楼主</span>}
                    {f.mine && <span className="rounded bg-gray-800 px-1 text-[9px] leading-[14px] text-white">我</span>}
                  </div>
                  <div className="text-[10px] text-gray-400">{floorLabel(n)} · {ago(f.ts)}</div>
                </div>
                <button onClick={() => p.onLike(f.id)} className={`text-[12px] ${lk ? "text-rose-500" : "text-gray-400"}`}><span className="inline-flex items-center gap-0.5"><IconHeart size={12} /> {f.likes + (lk ? 1 : 0)}</span></button>
              </div>
              {f.upd && <div className="ml-9 mt-1.5 inline-block rounded bg-violet-100 px-1.5 text-[10px] text-violet-700">楼主更新了</div>}
              {f.quote && (
                <div className="ml-9 mt-1.5 rounded border-l-2 border-gray-300 bg-gray-50 px-2 py-1 text-[11px] text-gray-500">引用 @{f.quote.u}：{f.quote.c}</div>
              )}
              <p className="ml-9 mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-gray-800">{f.c}</p>
              {f.lang && f.tr && (
                <div className="ml-9 mt-1">
                  <button onClick={() => setTr((s) => { const x = new Set(s); if (x.has(f.id)) x.delete(f.id); else x.add(f.id); return x; })} className="text-[11px] text-teal-600">
                    {showTr ? "收起翻译" : <span className="inline-flex items-center gap-0.5"><IconGlobe size={12} /> 翻译（{f.lang}）</span>}
                  </button>
                  {showTr && <p className="mt-0.5 text-[12.5px] text-gray-600">{f.tr}</p>}
                </div>
              )}
              <div className="ml-9 mt-1.5 flex gap-4 text-[11px] text-gray-400">
                <button onClick={() => { setSub({ fid: f.id }); setQuote(null); focus(); }}>回复</button>
                <button onClick={() => { setQuote({ u: f.u, c: f.c.slice(0, 40) }); setSub(null); focus(); }}>引用</button>
              </div>
              {f.re.length > 0 && (
                <div className="ml-9 mt-2 space-y-1 rounded-lg bg-gray-100/80 px-2.5 py-2 text-[12px]">
                  {reShown.map((r) => (
                    <button key={r.id} onClick={() => { setSub({ fid: f.id, to: r.u }); setQuote(null); focus(); }} className="block w-full text-left leading-snug">
                      <span className={`font-medium ${r.mine ? "text-violet-600" : "text-sky-700"}`}>{r.u}{r.u === t.author ? "(楼主)" : ""}</span>
                      {r.to && <span className="text-gray-500"> 回复 <span className="text-sky-700">{r.to}</span></span>}
                      <span className="text-gray-700">：{r.c}</span>
                    </button>
                  ))}
                  {f.re.length > 2 && (
                    <button onClick={() => setOpen((s) => { const x = new Set(s); if (x.has(f.id)) x.delete(f.id); else x.add(f.id); return x; })} className="text-[11px] text-sky-700">
                      {expanded ? "收起回复" : `查看全部 ${f.re.length} 条回复 ›`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="px-3 py-4 text-center">
          <button disabled={!!p.busy} onClick={p.onMore} className="rounded-full border border-violet-200 bg-white px-4 py-1.5 text-[12px] text-violet-600 disabled:opacity-50">
            {p.busy === "more" ? "网友正在盖楼…" : t.floors.length < 12 ? "加载更多楼层" : "继续盖楼"}{!p.aiOn && "（本地）"}
          </button>
        </div>
      </div>
      <div className="border-t border-black/5 bg-white px-3 py-2">
        {(quote || sub) && (
          <div className="mb-1.5 flex items-center gap-2 rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-500">
            <span className="flex-1 truncate">{sub ? `楼中楼回复${sub.to ? ` @${sub.to}` : ""}` : `引用 @${quote!.u}：${quote!.c}`}</span>
            <button onClick={() => { setQuote(null); setSub(null); }} aria-label="取消"><IconClose size={14} /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()} placeholder={`以「${p.myName}」身份回复…`} className="h-9 min-w-0 flex-1 rounded-full bg-gray-100 px-3 text-[13px] outline-none" />
          <button onClick={send} disabled={!text.trim()} className="h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: BRAND }}>发送</button>
        </div>
      </div>
    </>
  );
}

/* ───────── 发帖 ───────── */
function PostSheet({ defBoard, onClose, onSubmit }: { defBoard: BoardId; onClose: () => void; onSubmit: (b: BoardId, tag: string, title: string, c: string, poll: string[]) => void }) {
  const [b, setB] = useState<BoardId>(defBoard);
  const [tag, setTag] = useState("水");
  const [title, setTitle] = useState("");
  const [c, setC] = useState("");
  const [pollOn, setPollOn] = useState(false);
  const [opts, setOpts] = useState(["", ""]);
  const poll = pollOn ? opts.map((o) => o.trim()).filter(Boolean) : [];
  const ok = title.trim() && c.trim() && (!pollOn || poll.length >= 2);
  return (
    <Sheet title="发新帖" onClose={onClose}>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {BOARDS.map((x) => (
          <button key={x.id} onClick={() => setB(x.id)} className={`rounded-full px-2.5 py-0.5 text-[11px] ${b === x.id ? "text-white" : "bg-gray-100 text-gray-600"}`} style={b === x.id ? { background: x.color } : undefined}>{x.name}</button>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {["水", "求助", "讨论", "安利", "爆", "瓜", "糖", "路透"].map((x) => (
          <button key={x} onClick={() => setTag(x)} className={`rounded px-1.5 text-[11px] ${tag === x ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500"}`}>【{x}】</button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} placeholder="标题（≤30字）" className="mb-2 w-full rounded-lg bg-gray-100 px-3 py-2 text-[13px] outline-none" />
      <textarea value={c} onChange={(e) => setC(e.target.value)} rows={5} maxLength={600} placeholder="说点什么…（文明追星，不拉踩不引战）" className="w-full resize-none rounded-lg bg-gray-100 px-3 py-2 text-[13px] outline-none" />
      <label className="mt-2 flex items-center gap-2 text-[12px] text-gray-600">
        <input type="checkbox" checked={pollOn} onChange={(e) => setPollOn(e.target.checked)} /> 附带投票
      </label>
      {pollOn && (
        <div className="mt-1 space-y-1">
          {opts.map((o, i) => (
            <input key={i} value={o} onChange={(e) => setOpts((s) => s.map((x, j) => (j === i ? e.target.value : x)))} maxLength={20} placeholder={`选项 ${i + 1}`} className="w-full rounded bg-gray-100 px-2 py-1.5 text-[12px] outline-none" />
          ))}
          {opts.length < 4 && <button onClick={() => setOpts((s) => [...s, ""])} className="text-[11px] text-violet-600">+ 添加选项</button>}
        </div>
      )}
      <button disabled={!ok} onClick={() => onSubmit(b, tag, title.trim(), c.trim(), poll)} className="mt-3 w-full rounded-full py-2.5 text-[14px] font-semibold text-white disabled:opacity-40" style={{ background: BRAND }}>发布</button>
    </Sheet>
  );
}

/* ───────── 我的 ───────── */
function MeSheet({ name, threads, onClose, onRename, onOpen, onReset }: { name: string; threads: Thread[]; onClose: () => void; onRename: (n: string) => void; onOpen: (id: string) => void; onReset: () => void }) {
  const [v, setV] = useState(name);
  const [confirm, confirmEl] = useConfirm();
  const mine = threads.filter((t) => t.mine);
  const myFloors = threads.flatMap((t) => t.floors.filter((f) => f.mine).map((f) => ({ t, f })));
  return (
    <Sheet title="我的星潮" onClose={onClose}>
      {confirmEl}
      <div className="mb-3 flex items-center gap-3">
        <Ava name={name} size={44} />
        <div>
          <div className="flex items-center gap-1 text-[14px] font-semibold">{name}<Lv n={lvOf(name)} /></div>
          <div className="text-[11px] text-gray-400">发帖 {mine.length} · 回帖 {myFloors.length}</div>
        </div>
      </div>
      <div className="mb-3 flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} maxLength={16} placeholder="论坛昵称" className="h-9 min-w-0 flex-1 rounded-lg bg-gray-100 px-3 text-[13px] outline-none" />
        <button disabled={!v.trim() || v.trim() === name} onClick={() => onRename(v.trim())} className="rounded-lg px-3 text-[12px] text-white disabled:opacity-40" style={{ background: BRAND }}>改名</button>
      </div>
      <div className="mb-1 text-[12px] font-semibold text-gray-700">我的帖子</div>
      {mine.length === 0 && <p className="mb-2 text-[12px] text-gray-400">还没有发过帖</p>}
      {mine.map((t) => <button key={t.id} onClick={() => onOpen(t.id)} className="block w-full truncate border-b border-black/5 py-1.5 text-left text-[12px]"><TagChips tags={t.tags} />{t.title} <span className="text-gray-400">· {replyCount(t)} 回复</span></button>)}
      <div className="mb-1 mt-3 text-[12px] font-semibold text-gray-700">我的回帖</div>
      {myFloors.length === 0 && <p className="text-[12px] text-gray-400">还没有回过帖</p>}
      {myFloors.slice(-8).reverse().map(({ t, f }) => <button key={f.id} onClick={() => onOpen(t.id)} className="block w-full truncate border-b border-black/5 py-1.5 text-left text-[12px] text-gray-600">{f.c} <span className="text-gray-400">· 《{t.title}》</span></button>)}
      <button onClick={async () => { if (await confirm("将清空所有帖子（含你发的帖与回帖），之后按当前剧情重新生成，确定吗？", { ok: "清空" })) onReset(); }} className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-[12px] text-gray-500">恢复默认帖子</button>
    </Sheet>
  );
}
