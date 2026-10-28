/* 微博：仿原生（微博橙 #ff8140、顶部搜索、热搜榜、信息流三键操作栏 转发/评论/赞）
 * 热搜与话题详情由 AI 依据「当前剧情」实时生成；右上角刷新可联动最新剧情重刷热搜。
 * 生成结果按话题词缓存到 ref，二次点开复用；未配置 AI 时显示「需要接入 AI」提示。 */
import { useMemo, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { setFollow, toggleLike, addPost } from "../../game/phone";
import { complete, isConfigured } from "../../lib/ai";
import { useWorldSync, syncJson, phoneContext, loadFeed, saveFeed } from "./worldSync";
import { Avatar } from "../ui";
import { CommentSheet, PullToRefresh, LoadMoreButton, NeedAI } from "./shared";
import { IconRepost, IconComment, IconHeart, IconSearch, IconPlus, IconFire, IconVerified } from "./icons";
import { liveTerm as T } from "../../mods/live";
import { logAct, logNpcNet } from "../../game/phoneLink";

const WB_ORANGE = "#ff8140";

type HotItem = { t: string; heat?: number; tag: string };
type HotPost = { who: string; pid?: string; verified: boolean; from: string; text: string; when: string; reposts?: number; comments?: number; likes?: number };
type Topic = { title: string; tag: string; reads: string; discuss: string; original: string; posts: HotPost[] };

/* 从模型回复里安全提取 JSON（数组或对象） */
function parseJson<T>(raw: string): T | null {
  let str = "";
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) str = fence[1];
  else {
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
    if (start >= 0 && end > start) str = raw.slice(start, end + 1);
  }
  if (!str.trim()) return null;
  try { return JSON.parse(str) as T; } catch { return null; }
}

export default function WeiboApp({ onBack }: { onBack: () => void }) {
  const { game, commitGame, cfg, patchGame } = useGame();
  /* 线上联动：角色以本名发的博文写进角色本人的记忆（线上线下都记得） */
  const noteNpcPosts = (list: { pid?: string; text: string }[], where = "冲浪") => patchGame((g) => list.reduce((x, p) => (p.pid ? logNpcNet(x, p.pid, where, `发博文：${p.text}`) : x), g));
  const [tab, setTab] = useState<"home" | "hot" | "mine">("home");
  const s = game!.sim;
  const aiOn = isConfigured(cfg);
  const [topicErr, setTopicErr] = useState<string | null>(null);

  // 世界剧情同步缓存：热搜榜 + 联动生成的新博文（持久化，重进不丢）
  type SyncPost = { id: string; who: string; pid?: string; badge: boolean; text: string; when: string; from: string; reposts?: number; comments?: number; likes?: number };
  const [synced, setSynced] = useState<{ hot: HotItem[]; posts: SyncPost[]; more?: SyncPost[] }>(() => loadFeed<{ hot: HotItem[]; posts: SyncPost[]; more?: SyncPost[] }>("weibo") ?? { hot: [], posts: [] });
  const [moreLoading, setMoreLoading] = useState(false);

  // 关注流：只展示联动生成并持久化的博文
  const home = useMemo(() => [...synced.posts, ...(synced.more ?? [])], [synced.posts, synced.more]);

  // 我发布的微博：随存档持久（game.phone.posts.weibo），跨会话保留
  const myPosts = game!.phone?.posts?.weibo ?? [];
  const [draft, setDraft] = useState("");
  // 点赞/关注落地到 game.phone，跨 App 一致且持久；转发仍为本会话轻交互
  const likedSet = new Set(game!.phone?.likes ?? []);
  const followSet = new Set(game!.phone?.follows ?? []);
  const isLiked = (id: string) => likedSet.has(id);
  const flip = (id: string) => commitGame(toggleLike(game!, id));
  const [reposted, setReposted] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");
  const [commentOn, setCommentOn] = useState<{ count: number; cid: string; topic?: string } | null>(null);
  // 个人主页：点头像 / 昵称打开（NPC 或网友 / 媒体号）
  const [user, setUser] = useState<{ who: string; pid?: string; verified?: boolean } | null>(null);
  const [userMore, setUserMore] = useState<Record<string, SyncPost[]>>(() => loadFeed<Record<string, SyncPost[]>>("weibo-users") ?? {});
  const [userLoading, setUserLoading] = useState(false);
  const openUser = (who: string, pid?: string, verified?: boolean) => {
    if (who === game!.player.name) { setOpenHot(null); setTab("mine"); return; }
    setUser({ who, pid, verified });
  };
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };

  // 热搜榜：只展示 AI 联动生成并持久化的榜单
  const [hotList, setHotList] = useState<HotItem[]>(synced.hot);
  const [hotLoading, setHotLoading] = useState(false);
  // 热搜详情：点开生成对应话题内容，缓存到 ref，二次点开复用同一份
  const topicCache = useRef<Record<string, Topic>>({});
  const [openHot, setOpenHot] = useState<string | null>(null);
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicMoreLoading, setTopicMoreLoading] = useState(false);
  const [, setTopicTick] = useState(0); // 话题缓存在 ref 里，追加后手动触发重渲染

  const plotContext = () => phoneContext(game!);

  // 状态栏右上角刷新：经 syncJson 联动世界剧情（含主线记忆与本应用记忆），生成热搜榜 + 新博文
  const refreshHot = async (): Promise<string> => {
    if (hotLoading) return "";
    setHotLoading(true);
    try {
      const r = await syncJson<{ hot?: unknown; posts?: unknown }>(cfg, game!, "weibo", "冲浪", `生成冲浪（类微博）最新内容，返回 JSON 对象：{"hot":[{"t":"热搜词(≤15字)","tag":"爆|沸|新|热|空串"}],"posts":[{"who":"博主名(圈内人物名或网友昵称/媒体号)","verified":true或false,"text":"博文正文(≤120字)","from":"如 iPhone 客户端"}]}。hot 给 8 条，紧扣主角近况、圈内人物与最近剧情事件；posts 给 5~6 条新博文，围绕最近剧情，立场多元。`);
      if (!r) return "未配置 AI，无法联动剧情";
      const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
      const num = (v: unknown, _d?: number) => { if (v == null || v === "") return undefined; const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x) : undefined; };
      const hot: HotItem[] = (Array.isArray(r.hot) ? r.hot : [])
        .map((x: any) => ({ t: str(x?.t, 20), heat: num(x?.heat, 120), tag: ["爆", "沸", "新", "热"].includes(String(x?.tag)) ? String(x.tag) : "" }))
        .filter((x) => x.t).sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0)).slice(0, 10);
      const stamp = Date.now();
      const posts: SyncPost[] = (Array.isArray(r.posts) ? r.posts : [])
        .map((p: any, i: number) => {
          const who = str(p?.who, 20) || "网友";
          const pid = game!.npcs.find((n) => n.name === who)?.id;
          return { id: `ws${stamp}-${i}`, who, pid, badge: !!p?.verified || !!pid, text: str(p?.text, 300), when: str(p?.when, 12), from: str(p?.from, 16), reposts: num(p?.reposts, 10), comments: num(p?.comments, 30), likes: num(p?.likes, 200) };
        })
        .filter((p) => p.text).slice(0, 8);
      if (!hot.length && !posts.length) return "生成失败，请重试";
      const next = { ...synced, hot: hot.length ? hot : synced.hot, posts: [...posts, ...synced.posts].slice(0, 30) };
      setSynced(next); saveFeed("weibo", next);
      noteNpcPosts(posts);
      if (hot.length) { setHotList(hot); topicCache.current = {}; }
      return `已更新 ${hot.length} 条热搜、${posts.length} 条博文`;
    } finally {
      setHotLoading(false);
    }
  };
  useWorldSync("weibo", refreshHot);

  // 底部「查看更多」：结合剧情再生成一批博文，接在信息流末尾（持久化）
  const loadMore = async () => {
    if (moreLoading) return;
    setMoreLoading(true);
    try {
      const seen = home.slice(-12).map((p) => p.text.slice(0, 30)).join("｜");
      const r = await syncJson<{ posts?: unknown }>(cfg, game!, "weibo", "冲浪", `再生成一批冲浪（类微博）信息流博文，返回 JSON 对象：{"posts":[{"who":"博主名(圈内人物名或网友昵称/媒体号)","verified":true或false,"text":"博文正文(≤120字)","from":"如 iPhone 客户端"}]}。给 6 条，围绕主角近况与最近剧情，也可有圈内日常与路人吃瓜，立场多元；不要与这些已有内容重复：${seen}`);
      if (!r) { flash("未配置 AI，暂无更多"); return; }
      const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
      const num = (v: unknown, _d?: number) => { if (v == null || v === "") return undefined; const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x) : undefined; };
      const stamp = Date.now();
      const posts: SyncPost[] = (Array.isArray(r.posts) ? r.posts : [])
        .map((p: any, i: number) => {
          const who = str(p?.who, 20) || "网友";
          const pid = game!.npcs.find((n) => n.name === who)?.id;
          return { id: `wm${stamp}-${i}`, who, pid, badge: !!p?.verified || !!pid, text: str(p?.text, 300), when: str(p?.when, 12), from: str(p?.from, 16), reposts: num(p?.reposts, 10), comments: num(p?.comments, 30), likes: num(p?.likes, 200) };
        })
        .filter((p) => p.text);
      if (!posts.length) { flash("生成失败，请重试"); return; }
      const next = { ...synced, more: [...(synced.more ?? []), ...posts].slice(-60) };
      setSynced(next); saveFeed("weibo", next);
      noteNpcPosts(posts);
      flash(`新加载 ${posts.length} 条`);
    } catch {
      flash("加载失败，请重试");
    } finally {
      setMoreLoading(false);
    }
  };

  // 点开热搜：优先用缓存；否则 AI 结合剧情生成话题页，存入缓存
  const openTopic = async (h: HotItem) => {
    setOpenHot(h.t);
    setTopicErr(null);
    if (topicCache.current[h.t]) return; // 命中缓存，直接复用
    if (!isConfigured(cfg)) return; // 未接入 AI：话题页显示接入提示
    setTopicLoading(true);
    try {
      const out = await complete(cfg, [
        { role: "system", content: "你是微博话题页内容引擎。只输出 JSON，不要任何多余文字。" },
        { role: "user", content: `${plotContext()}\n\n针对冲浪热榜话题 #${h.t}#，结合「当前剧情」生成话题页内容。返回 JSON 对象：{"posts":[{"who":"博主名(可用上面出现的圈内人物名或网友昵称)","verified":true或false,"from":"如 iPhone 客户端","text":"博文正文，必须与当前剧情关联"}]}。posts 给 5~7 条：第一条为蓝V媒体的头条报道，其余为网友与圈内人的讨论，立场多元、贴合剧情。只返回 JSON 对象。` },
      ]);
      const parsed = parseJson<{ reads?: string; discuss?: string; original?: string | number; posts?: Partial<HotPost>[] }>(out);
      const num = (v: unknown) => { if (v == null || v === "") return undefined; const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x) : undefined; };
      if (parsed && Array.isArray(parsed.posts) && parsed.posts.length) {
        const posts: HotPost[] = parsed.posts.map((p) => {
          const who = String(p.who ?? "网友");
          const pid = game!.npcs.find((n) => n.name === who)?.id;
          return {
            who, pid, verified: !!p.verified || !!pid, from: String(p.from ?? ""),
            text: String(p.text ?? ""), when: String(p.when ?? ""),
            reposts: num(p.reposts), comments: num(p.comments), likes: num(p.likes),
          };
        });
        noteNpcPosts(posts, `冲浪话题 #${h.t}#`);
        topicCache.current[h.t] = { title: h.t, tag: h.tag, reads: String(parsed.reads ?? ""), discuss: String(parsed.discuss ?? ""), original: String(parsed.original ?? ""), posts };
      } else {
        setTopicErr(h.t);
      }
    } catch {
      setTopicErr(h.t);
    } finally {
      setTopicLoading(false);
    }
  };

  // 话题页触底「加载更多」：AI 结合剧情续写新讨论（不重复已有）
  const loadMoreTopic = async (title: string) => {
    const tp = topicCache.current[title];
    if (!tp || topicMoreLoading) return;
    setTopicMoreLoading(true);
    const num = (v: unknown, _d?: number) => { if (v == null || v === "") return undefined; const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x) : undefined; };
    try {
      let add: HotPost[] = [];
      if (isConfigured(cfg)) {
        const seen = tp.posts.slice(-10).map((p) => p.text.slice(0, 24)).join("｜");
        const out = await complete(cfg, [
          { role: "system", content: "你是微博话题页内容引擎。只输出 JSON，不要任何多余文字。" },
          { role: "user", content: `${plotContext()}\n\n继续为冲浪热榜话题 #${title}# 生成更多「热门讨论」博文。返回 JSON 对象：{"posts":[{"who":"博主名(圈内人物名或网友昵称/媒体号)","verified":true或false,"from":"如 iPhone 客户端","when":"如 1小时前","text":"博文正文(≤120字)，与话题和当前剧情相关"}]}。给 6 条，立场与角度多元（科普、吐槽、站队、路人、圈内人），不要与这些已有内容重复：${seen}` },
        ]);
        const parsed = parseJson<{ posts?: Partial<HotPost>[] }>(out);
        add = (parsed?.posts ?? []).filter((p) => p?.text).map((p, i) => {
          const who = String(p.who ?? "网友").slice(0, 20);
          const pid = game!.npcs.find((n) => n.name === who)?.id;
          return { who, pid, verified: !!p.verified || !!pid, from: String(p.from ?? ""), text: String(p.text).slice(0, 300), when: String(p.when ?? ""), reposts: num(p.reposts, 10), comments: num(p.comments, 20), likes: num(p.likes, 200) };
        });
      } else { setTopicMoreLoading(false); return; }
      if (!add.length) { flash("生成失败，请重试"); return; }
      noteNpcPosts(add, `冲浪话题 #${title}#`);
      topicCache.current[title] = { ...tp, posts: [...tp.posts, ...add].slice(-80) };
      setTopicTick((x) => x + 1);
      flash(`新加载 ${add.length} 条讨论`);
    } catch {
      flash("加载失败，请重试");
    } finally {
      setTopicMoreLoading(false);
    }
  };

  const ActionBar = ({ id, reposts, comments, likes, topic }: { id: string; reposts?: number; comments?: number; likes?: number; topic?: string }) => {
    const on = isLiked(id);
    const rp = reposted[id];
    return (
      <div className="mt-2 flex items-center text-[12.5px] text-ink-soft">
        <button onClick={() => setReposted((r) => ({ ...r, [id]: !r[id] }))} className="flex flex-1 items-center justify-center gap-1.5" style={{ color: rp ? WB_ORANGE : undefined }}><IconRepost size={15} />{reposts != null ? reposts + (rp ? 1 : 0) : rp ? 1 : ""}</button>
        <button onClick={() => setCommentOn({ count: comments ?? 0, cid: `wb:${id}`, topic })} className="flex flex-1 items-center justify-center gap-1.5"><IconComment size={15} />{comments ?? ""}</button>
        <button onClick={() => flip(id)} className="flex flex-1 items-center justify-center gap-1.5" style={{ color: on ? WB_ORANGE : undefined }}>
          <IconHeart size={15} filled={on} />{likes != null ? likes + (on ? 1 : 0) : on ? 1 : ""}
        </button>
      </div>
    );
  };

  return (
    <div className="relative flex h-full flex-col bg-[#f2f2f5]">
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span>
        </div>
      )}
      {commentOn !== null && <CommentSheet count={commentOn.count} onClose={() => setCommentOn(null)} accent={WB_ORANGE} cid={commentOn.cid} topic={commentOn.topic} />}
      {user && (() => {
        const npc = user.pid ? game!.npcs.find((n) => n.id === user.pid) : game!.npcs.find((n) => n.name === user.who);
        const pid = npc?.id;
        const key = pid ?? user.who;
        const isMedia = /播报|观察|速递|风向|日报|娱乐|官方|工作室/.test(user.who);
        const verified = !!user.verified || !!npc || isMedia;
        // 该博主的全部博文：信息流 + 已生成的话题页 + 主页里「加载更多」的
        const fromTopics = Object.values(topicCache.current).flatMap((tp) => tp.posts.map((p, i) => ({ ...p, id: `t${tp.title}-${i}` })).filter((p) => p.who === user.who));
        const posts = [...(userMore[key] ?? []), ...home.filter((p) => p.who === user.who), ...fromTopics.map((p) => ({ id: p.id, who: p.who, pid: p.pid, badge: p.verified, text: p.text, when: p.when, from: p.from, reposts: p.reposts, comments: p.comments, likes: p.likes }))];
        const bio = npc?.identity ?? "";
        const followed = !!pid && followSet.has(pid);
        const loadUser = async () => {
          if (userLoading) return;
          setUserLoading(true);
          try {
            const r = await syncJson<{ posts?: unknown }>(cfg, game!, "weibo", "冲浪", `为冲浪（类微博）博主「${user.who}」${npc ? `（${npc.identity}，与主角关系：${npc.relation}）` : isMedia ? "（娱乐媒体号）" : "（普通网友）"}生成其个人主页上的近期博文，返回 JSON 对象：{"posts":[{"text":"博文正文(≤120字)，第一人称，贴合其身份口吻，可涉及最近剧情","when":"如 3小时前 / 昨天 / 2天前","from":"如 iPhone 客户端"}]}。给 5 条，时间由近到远，不要与这些已有内容重复：${posts.slice(0, 8).map((p) => p.text.slice(0, 24)).join("｜")}`);
            if (!r) { flash("未配置 AI，暂无更多"); return; }
            const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
            const num = (v: unknown, _d?: number) => { if (v == null || v === "") return undefined; const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x) : undefined; };
            const stamp = Date.now();
            const got: SyncPost[] = (Array.isArray(r.posts) ? r.posts : []).map((p: any, i: number) => ({ id: `wu${stamp}-${i}`, who: user.who, pid, badge: verified, text: str(p?.text, 300), when: str(p?.when, 12), from: str(p?.from, 16), reposts: num(p?.reposts, 5), comments: num(p?.comments, 20), likes: num(p?.likes, 100) })).filter((p) => p.text);
            if (!got.length) { flash("生成失败，请重试"); return; }
            const next = { ...userMore, [key]: [...(userMore[key] ?? []), ...got].slice(-30) };
            setUserMore(next); saveFeed("weibo-users", next);
            flash(`新加载 ${got.length} 条`);
          } catch { flash("加载失败，请重试"); } finally { setUserLoading(false); }
        };
        return (
          <div className="absolute inset-0 z-40 flex flex-col bg-[#f2f2f5]">
            <div className="flex-1 overflow-y-auto">
              <div className="relative h-32" style={{ background: `linear-gradient(135deg, ${WB_ORANGE}, #ffb37a)` }}>
                <button onClick={() => setUser(null)} className="absolute left-3 top-2 rounded-full bg-black/20 px-2.5 py-1 text-[13px] text-white">‹ 返回</button>
              </div>
              <div className="bg-white px-4 pb-3">
                <div className="-mt-9 flex items-end justify-between">
                  <span className="rounded-full border-[3px] border-white"><Avatar src={npc?.avatar} name={user.who} size={68} editable={false} /></span>
                  {pid ? (
                    <button onClick={() => commitGame(setFollow(game!, pid, !followed))} className="mb-1 rounded-full border px-4 py-1 text-[13px] font-semibold" style={followed ? { borderColor: "#00000018", color: "#999" } : { borderColor: WB_ORANGE, color: "#fff", background: WB_ORANGE }}>{followed ? "已关注" : "+ 关注"}</button>
                  ) : (
                    <span className="mb-1 rounded-full border border-black/10 px-3 py-1 text-[12px] text-ink-soft">路人博主</span>
                  )}
                </div>
                <p className="mt-2 flex items-center gap-1 text-[18px] font-bold text-ink">{user.who}{verified && <IconVerified size={15} style={{ color: WB_ORANGE }} />}</p>
                {bio && <p className="mt-0.5 text-[12.5px] text-ink-soft">{npc ? "认证：" : "简介："}{bio}</p>}
                <div className="mt-2.5 flex gap-5 text-[13px] text-ink">
                  <span><b className="tabular-nums">{posts.length}</b> <span className="text-ink-soft">微博</span></span>
                </div>
              </div>
              <div className="mt-2 border-b border-black/5 bg-white px-3.5 py-2 text-[13px] font-semibold" style={{ color: WB_ORANGE }}>TA 的冲浪</div>
              <div className="divide-y divide-black/[0.06]">
                {posts.length === 0 && aiOn && <p className="bg-white px-3.5 py-8 text-center text-[13px] text-ink-soft">TA 还没有公开的微博，点下方加载看看</p>}
                {posts.map((p) => (
                  <div key={p.id} className="bg-white px-3.5 py-3">
                    <p className="text-[11px] text-ink-soft">{[p.when, p.from && `来自 ${p.from}`].filter(Boolean).join(" · ")}</p>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-ink">{p.text}</p>
                    <ActionBar id={p.id} reposts={p.reposts} comments={p.comments} likes={p.likes} topic={p.text} />
                  </div>
                ))}
                {aiOn ? <LoadMoreButton loading={userLoading} onClick={loadUser} color={WB_ORANGE} /> : <div className="bg-white"><NeedAI compact what={`${user.who} 的微博`} accent={WB_ORANGE} /></div>}
              </div>
            </div>
          </div>
        );
      })()}
      {/* 热搜话题详情页（AI 结合剧情生成，内容缓存，二次点开复用同一份） */}
      {openHot && (() => {
        const tp = topicCache.current[openHot];
        return (
          <div className="absolute inset-0 z-30 flex flex-col bg-[#f2f2f5]">
            <div className="text-white" style={{ background: `linear-gradient(180deg, ${WB_ORANGE}, #ff9d5c)` }}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => setOpenHot(null)} className="text-[15px] text-white/95">‹ 返回</button>
                <span className="flex-1 truncate text-center text-[14px] font-semibold">话题</span>
                <span className="w-10" />
              </div>
            </div>
            {!tp && !aiOn ? (
              <div className="flex-1 overflow-y-auto bg-white"><NeedAI what={`#${openHot}# 的话题讨论`} accent={WB_ORANGE} /></div>
            ) : !tp && topicErr === openHot ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-soft">
                <p className="max-w-[260px] text-center text-[13px] leading-relaxed">#{openHot}# 的讨论这一次没能生成出来，可能是网络或 AI 打了个小盹。别担心，点一下重新生成就好～</p>
                <button onClick={() => { const h = hotList.find((x) => x.t === openHot); if (h) void openTopic(h); }} className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-white" style={{ background: WB_ORANGE }}>重新生成</button>
              </div>
            ) : !tp ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-soft">
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-black/10" style={{ borderTopColor: WB_ORANGE }} />
                <p className="text-[13px]">正在结合当前剧情生成 #{openHot}# 的话题…</p>
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto">
              {/* 话题头 */}
              <div className="px-4 py-4 text-white" style={{ background: `linear-gradient(135deg, ${WB_ORANGE}, #ffab6b)` }}>
                <div className="flex items-center gap-1.5">
                  {tp.tag && <span className={`rounded-[3px] px-1 text-[10px] font-bold ${tp.tag === "爆" ? "bg-[#e60012]" : tp.tag === "沸" ? "bg-white/25" : tp.tag === "新" ? "bg-[#3a8ffe]" : "bg-white/25"}`}>{tp.tag}</span>}
                  <h2 className="text-[18px] font-bold">#{tp.title}#</h2>
                </div>
                <div className="mt-2 flex gap-5 text-[12px] text-white/90">
                  {tp.reads && <span>{tp.reads} 阅读</span>}
                  {tp.discuss && <span>{tp.discuss} 讨论</span>}
                  {tp.original && <span>{tp.original} 原创</span>}
                </div>
              </div>
              <div className="border-b border-black/5 bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-soft">热门讨论</div>
              <div className="divide-y divide-black/[0.06]">
                {tp.posts.map((p, i) => {
                  const npc = p.pid ? game!.npcs.find((n) => n.id === p.pid) : undefined;
                  return (
                    <div key={i} className="bg-white px-3.5 py-3">
                      <div className="flex gap-2.5">
                        <button onClick={() => openUser(p.who, p.pid, p.verified)} aria-label={`${p.who} 的主页`}><Avatar src={npc?.avatar} name={p.who} size={40} editable={false} /></button>
                        <div className="min-w-0 flex-1">
                          <button onClick={() => openUser(p.who, p.pid, p.verified)} className="flex items-center gap-1 text-left text-[14.5px] font-semibold" style={{ color: WB_ORANGE }}>
                            {p.who}{p.verified && <IconVerified size={13} style={{ color: WB_ORANGE }} />}
                          </button>
                          <p className="text-[11px] text-ink-soft">{[p.when, p.from && `来自 ${p.from}`].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{p.text}</p>
                      <ActionBar id={`t${tp.title}-${i}`} reposts={p.reposts} comments={p.comments} likes={p.likes} topic={p.text} />
                    </div>
                  );
                })}
                {aiOn ? <LoadMoreButton loading={topicMoreLoading} onClick={() => loadMoreTopic(tp.title)} color={WB_ORANGE} /> : <div className="bg-white"><NeedAI compact what="更多讨论" accent={WB_ORANGE} /></div>}
              </div>
            </div>
            )}
          </div>
        );
      })()}
      {/* 顶栏：品牌橙 + 搜索框 */}
      <div className="text-white" style={{ background: `linear-gradient(180deg, ${WB_ORANGE}, #ff9d5c)` }}>
        <div className="flex items-center gap-2 px-3 pb-2 pt-1">
          <button onClick={onBack} className="text-[14px] text-white/90">‹ 主屏</button>
          <button onClick={() => setTab("hot")} className="flex flex-1 items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-left text-[12.5px] text-white/90">
            <IconSearch size={16} /><span className="truncate">大家正在搜：{hotList[0]?.t}</span>
          </button>
          <button onClick={() => setTab("mine")}><IconPlus size={20} /></button>
        </div>
        <div className="flex text-[14px]">
          {([["home", "关注"], ["hot", "热搜"], ["mine", "我"]] as const).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className="relative flex-1 py-2 font-medium">
              <span className={tab === id ? "text-white" : "text-white/70"}>{l}</span>
              {tab === id && <span className="absolute inset-x-[38%] -bottom-0 h-0.5 rounded-full bg-white" />}
            </button>
          ))}
        </div>
      </div>

      <PullToRefresh
        className="flex-1"
        accent={WB_ORANGE}
        tint="light"
        onRefresh={async () => { const t = await refreshHot(); if (t) flash(t); }}
      >
        {tab === "hot" && !aiOn && <div className="bg-white"><NeedAI what="冲浪热搜榜" accent={WB_ORANGE} /></div>}
        {tab === "hot" && aiOn && (
          <div className="bg-white">
            <div className="flex items-center gap-1.5 border-b border-black/5 px-3.5 py-2.5 text-[14px] font-bold" style={{ color: WB_ORANGE }}>
              <IconFire size={16} /> 冲浪热榜
            </div>
            {!hotList.length && <p className="px-3.5 py-8 text-center text-[13px] text-ink-soft">{hotLoading ? "正在联动剧情生成热搜…" : "还没有热搜，下拉刷新联动当前剧情生成"}</p>}
            {hotList.map((h, i) => (
              <button key={i} onClick={() => openTopic(h)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition active:bg-black/[0.03]">
                <span className={`w-4 text-center text-[15px] font-bold tabular-nums ${i < 3 ? "" : "text-ink-soft/60"}`} style={i < 3 ? { color: WB_ORANGE } : undefined}>{i + 1}</span>
                <span className="flex-1 truncate text-[14px] text-ink">{h.t}</span>
                {h.tag && <span className={`rounded-[3px] px-1 text-[10px] font-bold text-white ${h.tag === "爆" ? "bg-[#e60012]" : h.tag === "沸" ? "bg-[#ff8140]" : h.tag === "新" ? "bg-[#3a8ffe]" : "bg-[#ff9406]"}`}>{h.tag}</span>}
                <span className="w-14 text-right text-[11.5px] tabular-nums text-ink-soft">{h.heat != null ? `${Math.round(h.heat)}万` : ""}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "home" && !aiOn && <div className="bg-white"><NeedAI what="关注信息流" accent={WB_ORANGE} /></div>}
        {tab === "home" && aiOn && (
          <div className="divide-y divide-black/[0.06]">
            {!home.length && <p className="bg-white px-3.5 py-8 text-center text-[13px] text-ink-soft">还没有博文，下拉刷新或点下方加载，联动当前剧情生成</p>}
            {home.map((p, i) => {
              const npc = game!.npcs.find((n) => n.id === p.pid);
              return (
                <div key={p.id} className="bg-white px-3.5 py-3">
                  <div className="flex gap-2.5">
                    <button onClick={() => openUser(p.who, p.pid, p.badge)} aria-label={`${p.who} 的主页`}><Avatar src={npc?.avatar} name={p.who} size={40} editable={false} /></button>
                    <div className="min-w-0 flex-1">
                      <button onClick={() => openUser(p.who, p.pid, p.badge)} className="flex items-center gap-1 text-left text-[14.5px] font-semibold" style={{ color: WB_ORANGE }}>
                        {p.who}{p.badge && <IconVerified size={13} style={{ color: WB_ORANGE }} />}
                      </button>
                      <p className="text-[11px] text-ink-soft">{[p.when, p.from && `来自 ${p.from}`].filter(Boolean).join(" · ")}</p>
                    </div>
                    {p.pid && <button onClick={() => commitGame(setFollow(game!, p.pid!, !followSet.has(p.pid!)))} className="rounded-full border px-2.5 py-0.5 text-[12px]" style={followSet.has(p.pid!) ? { borderColor: "#00000018", color: "#999" } : { borderColor: WB_ORANGE, color: WB_ORANGE }}>{followSet.has(p.pid!) ? "已关注" : "+ 关注"}</button>}
                  </div>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{p.text}</p>
                  <ActionBar id={p.id} reposts={p.reposts} comments={p.comments} likes={p.likes} topic={p.text} />
                </div>
              );
            })}
            <LoadMoreButton loading={moreLoading} onClick={loadMore} color={WB_ORANGE} />
          </div>
        )}

        {tab === "mine" && (
          <div>
            <div className="text-white" style={{ background: `linear-gradient(160deg, ${WB_ORANGE}, #ffb37a)` }}>
              <div className="flex items-center gap-3 px-4 pb-4 pt-3">
                <Avatar src={game!.player.avatar} name={game!.player.name} size={56} editable={false} />
                <div>
                  <p className="text-[18px] font-bold">{game!.player.name}</p>
                  <p className="text-[12px] text-white/85">签名：认真演戏，好好生活</p>
                </div>
              </div>
              <div className="flex px-4 pb-3 text-center text-[13px]">
                <div className="flex-1"><p className="text-[16px] font-bold tabular-nums">{myPosts.length}</p><p className="text-white/80">冲浪</p></div>
                <div className="flex-1"><p className="text-[16px] font-bold tabular-nums">{Math.round(s.fame * 0.12) + followSet.size}</p><p className="text-white/80">关注</p></div>
                <div className="flex-1"><p className="text-[16px] font-bold tabular-nums">{(s.fame * 1.2).toFixed(1)}万</p><p className="text-white/80">粉丝</p></div>
              </div>
            </div>
            <div className="flex gap-2 bg-white px-3.5 py-3">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="分享新鲜事…" className="flex-1 rounded-full bg-[#f0f1f3] px-3.5 py-2 text-[13px] outline-none" />
              <button
                onClick={() => { const t = draft.trim(); if (!t) return; setDraft(""); flash("已发布"); commitGame(logAct(addPost({ ...game!, sim: { ...s, fame: Math.min(1000, s.fame + 1) } }, "weibo", t), { app: "冲浪", text: "发了条博文", bit: t, min: 5 })); }}
                className="rounded-full px-4 text-[13px] font-semibold text-white" style={{ background: WB_ORANGE }}>发布</button>
            </div>
            <div className="divide-y divide-black/[0.06]">
              {myPosts.length === 0 && <p className="bg-white px-3.5 py-8 text-center text-[13px] text-ink-soft">还没有发过帖，在上面写点什么吧～</p>}
              {myPosts.map((p) => (
                <div key={p.id} className="bg-white px-3.5 py-3">
                  <div className="flex gap-2.5">
                    <Avatar src={game!.player.avatar} name={game!.player.name} size={40} editable={false} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-semibold" style={{ color: WB_ORANGE }}>{game!.player.name}</p>
                      <p className="text-[11px] text-ink-soft">刚刚 · 来自 iPhone 客户端</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{p.text}</p>
                  <ActionBar id={`m${p.id}`} likes={p.likes || undefined} topic={p.text} />
                </div>
              ))}
            </div>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
