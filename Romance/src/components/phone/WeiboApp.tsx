/* 微博：仿原生（微博橙 #ff8140、顶部搜索、热搜榜、信息流三键操作栏 转发/评论/赞）
 * 热搜与话题详情由 AI 依据「当前剧情」实时生成；右上角刷新可联动最新剧情重刷热搜。
 * 生成结果按话题词缓存到 ref，二次点开复用；未配置 AI 时回退到本地确定性生成。 */
import { useMemo, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { setFollow, toggleLike, addPost } from "../../game/phone";
import { complete, isConfigured, buildSimSnapshot } from "../../lib/ai";
import { Avatar } from "../ui";
import { CommentSheet, PullToRefresh, delay } from "./shared";
import { weiboPost } from "./persona";
import { IconRepost, IconComment, IconHeart, IconSearch, IconPlus, IconFire, IconVerified } from "./icons";

const WB_ORANGE = "#ff8140";

type HotItem = { t: string; heat: number; tag: string };
type HotPost = { who: string; pid?: string; verified: boolean; from: string; text: string; when: string; reposts: number; comments: number; likes: number };
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

/* ——— 本地确定性兜底（未配置 AI 时使用），按话题词播种，保证同词稳定 ——— */
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const MEDIA = ["娱乐播报姬", "内娱观察室", "星闻速递", "热搜风向标"];
const NETIZEN = ["吃瓜前排", "追剧的猫", "夜航船", "十级学者", "路人甲的日常", "奶茶续命中", "海风咸咸", "无糖气泡水"];
const POST_TPL = [
  (t: string) => `#${t}# 冲上热搜第一了，评论区已经吵翻，蹲一个后续。`,
  (t: string) => `说句公道话，#${t}# 这事还是让子弹飞一会儿，别急着下结论。`,
  (t: string) => `#${t}# 不管怎样，还是希望大家理性讨论，别上升到个人。`,
  (t: string) => `刚点进 #${t}# 的话题广场，信息量属实有点大，先码后看。`,
  (t: string) => `#${t}# 看到现在，只想说娱乐圈每天都不缺新故事。`,
];

export default function WeiboApp({ onBack }: { onBack: () => void }) {
  const { game, commitGame, cfg } = useGame();
  const [tab, setTab] = useState<"home" | "hot" | "mine">("home");
  const s = game!.sim;

  const baseHot = useMemo<HotItem[]>(() => {
    const base: HotItem[] = [
      { t: `${game!.player.name} 新作预告`, heat: 120 + s.fame * 3, tag: s.fame > 200 ? "爆" : "热" },
      { t: "今夜颁奖礼红毯造型", heat: 380, tag: "热" },
      { t: "选秀总决赛结果", heat: 356, tag: "沸" },
      { t: `${game!.npcs[0]?.name ?? "顶流"} 恋情疑云`, heat: 298, tag: "" },
      { t: "年度剧王提名公布", heat: 240, tag: "新" },
      { t: `${game!.npcs[1]?.name ?? "某小花"} 工作室声明`, heat: 190, tag: "" },
      { t: "内娱内卷现状", heat: 150, tag: "" },
      { t: "复古港风妆容教程", heat: 120, tag: "" },
    ];
    return base.sort((a, b) => b.heat - a.heat);
  }, [game, s.fame]);

  // 关注流：由 NPC 生成的博文
  const home = useMemo(() => {
    return game!.npcs.slice(0, 8).map((n, i) => ({
      who: n.name,
      pid: n.id,
      badge: i % 3 === 0,
      text: weiboPost(n),
      when: `${(n.name.charCodeAt(0) % 12) + 1}分钟前`,
      from: ["iPhone 客户端", "冲浪网页版", "HUAWEI", "vivo 智能手机"][i % 4],
      reposts: (n.name.charCodeAt(0) % 40) + 3,
      comments: (n.name.charCodeAt(1 % n.name.length) % 90) + 12,
      likes: (n.name.charCodeAt(0) % 900) + 60,
    }));
  }, [game]);

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
  const [commentOn, setCommentOn] = useState<{ count: number; cid: string } | null>(null);
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };

  // 热搜榜：默认本地兜底榜，配置 AI 后可联动剧情刷新
  const [hotList, setHotList] = useState<HotItem[]>(baseHot);
  const [hotLoading, setHotLoading] = useState(false);
  // 热搜详情：点开生成对应话题内容，缓存到 ref，二次点开复用同一份
  const topicCache = useRef<Record<string, Topic>>({});
  const [openHot, setOpenHot] = useState<string | null>(null);
  const [topicLoading, setTopicLoading] = useState(false);

  // 把当前剧情压成一段上下文，喂给模型，确保生成内容与剧情强关联
  const plotContext = () => {
    const npcLine = game!.npcs.slice(0, 10).map((n) => `${n.name}（${n.identity}，与主角${n.relation}，好感${n.affinity}）`).join("、");
    const last = game!.story.slice(-2).map((t) => t.segments.map((sg) => (sg.kind === "dialogue" ? `${sg.speaker}：${sg.text}` : sg.text)).join(" ")).join("\n");
    return `${buildSimSnapshot(game!)}\n主角：${game!.player.name}（${game!.player.identity}）\n圈内人物：${npcLine}\n剧情摘要：${game!.memory || "（游戏刚开始）"}\n最近剧情：${last || "（暂无）"}`;
  };

  // 本地兜底话题（未配置 AI）：按话题词播种，保证同词稳定
  const genTopicLocal = (h: HotItem): Topic => {
    const rnd = mulberry(hashSeed(h.t));
    const readW = Math.round(h.heat * (26 + rnd() * 20));
    const discussW = Math.round(h.heat * (0.3 + rnd() * 0.5));
    const npcNames = game!.npcs.slice(0, 6).map((n) => ({ name: n.name, pid: n.id }));
    const count = 4 + Math.floor(rnd() * 3);
    const posts: HotPost[] = [{
      who: MEDIA[Math.floor(rnd() * MEDIA.length)], verified: true, from: "冲浪网页版",
      text: `【${h.t}】相关话题今日登上热搜榜，引发全网热议。截至目前话题阅读量已突破 ${readW} 万，讨论量 ${discussW} 万，多位网友与业内人士参与讨论。`,
      when: `${5 + Math.floor(rnd() * 55)}分钟前`,
      reposts: Math.round(h.heat * (2 + rnd() * 6)), comments: Math.round(h.heat * (1 + rnd() * 4)), likes: Math.round(h.heat * (8 + rnd() * 20)),
    }];
    for (let i = 0; i < count; i++) {
      const useNpc = rnd() < 0.5 && npcNames.length > 0;
      const author = useNpc ? npcNames[Math.floor(rnd() * npcNames.length)] : { name: NETIZEN[Math.floor(rnd() * NETIZEN.length)], pid: undefined };
      posts.push({
        who: author.name, pid: author.pid, verified: useNpc, from: ["iPhone 客户端", "冲浪网页版", "HUAWEI", "vivo 智能手机"][Math.floor(rnd() * 4)],
        text: POST_TPL[Math.floor(rnd() * POST_TPL.length)](h.t),
        when: `${1 + Math.floor(rnd() * 59)}分钟前`,
        reposts: Math.floor(rnd() * 60), comments: Math.floor(rnd() * 120) + 3, likes: Math.floor(rnd() * 2000) + 20,
      });
    }
    return { title: h.t, tag: h.tag, reads: `${readW}万`, discuss: `${discussW}万`, original: `${Math.floor(rnd() * 800) + 40}`, posts };
  };

  // 右上角刷新：AI 联动当前剧情生成最新热搜榜；旧话题缓存作废
  const refreshHot = async () => {
    if (hotLoading) return;
    if (!isConfigured(cfg)) { setHotList(baseHot.slice()); flash("未配置 AI · 展示本地热搜"); return; }
    setHotLoading(true);
    try {
      const out = await complete(cfg, [
        { role: "system", content: "你是《女明星养成沉浸式模拟器》里的冲浪热榜引擎。只输出 JSON，不要任何多余文字或解释。" },
        { role: "user", content: `${plotContext()}\n\n请依据以上「当前剧情」，生成 8 条与剧情强相关的娱乐圈热搜（可围绕主角近况、圈内人物、正在发生的事件、作品、绯闻、颁奖、争议等，须像真实冲浪热榜词，简洁有话题性）。返回 JSON 数组，每条格式：{"t":"热搜词(≤15字)","heat":整数(80~500，越劲爆越高),"tag":"爆"或"沸"或"新"或"热"或""}。按 heat 从高到低排序。只返回 JSON 数组。` },
      ]);
      const parsed = parseJson<HotItem[]>(out);
      if (Array.isArray(parsed) && parsed.length) {
        const clean = parsed
          .filter((x) => x && x.t)
          .map((x) => ({ t: String(x.t).slice(0, 20), heat: Number(x.heat) || 120, tag: ["爆", "沸", "新", "热"].includes(String(x.tag)) ? String(x.tag) : "" }))
          .sort((a, b) => b.heat - a.heat);
        setHotList(clean);
        topicCache.current = {}; // 剧情已更新，旧话题内容作废
        flash("已联动当前剧情刷新热搜");
      } else flash("生成失败，请重试");
    } catch {
      flash("刷新失败 · 网络或接口错误");
    } finally {
      setHotLoading(false);
    }
  };

  // 点开热搜：优先用缓存；否则 AI 结合剧情生成话题页，存入缓存
  const openTopic = async (h: HotItem) => {
    setOpenHot(h.t);
    if (topicCache.current[h.t]) return; // 命中缓存，直接复用
    if (!isConfigured(cfg)) { topicCache.current[h.t] = genTopicLocal(h); return; }
    setTopicLoading(true);
    try {
      const out = await complete(cfg, [
        { role: "system", content: "你是微博话题页内容引擎。只输出 JSON，不要任何多余文字。" },
        { role: "user", content: `${plotContext()}\n\n针对冲浪热榜话题 #${h.t}#，结合「当前剧情」生成话题页内容。返回 JSON 对象：{"reads":"阅读量如 3621万","discuss":"讨论量如 12万","original":"原创数如 340","posts":[{"who":"博主名(可用上面出现的圈内人物名或网友昵称)","verified":true或false,"from":"如 iPhone 客户端","text":"博文正文，必须与当前剧情关联","reposts":整数,"comments":整数,"likes":整数}]}。posts 给 5~7 条：第一条为蓝V媒体的头条报道，其余为网友与圈内人的讨论，立场多元、贴合剧情。只返回 JSON 对象。` },
      ]);
      const parsed = parseJson<{ reads?: string; discuss?: string; original?: string | number; posts?: Partial<HotPost>[] }>(out);
      if (parsed && Array.isArray(parsed.posts) && parsed.posts.length) {
        const posts: HotPost[] = parsed.posts.map((p) => {
          const who = String(p.who ?? "网友");
          const pid = game!.npcs.find((n) => n.name === who)?.id;
          return {
            who, pid, verified: !!p.verified || !!pid, from: String(p.from ?? "冲浪网页版"),
            text: String(p.text ?? ""), when: String(p.when ?? `${1 + Math.floor(Math.random() * 59)}分钟前`),
            reposts: Number(p.reposts) || Math.floor(Math.random() * 60), comments: Number(p.comments) || Math.floor(Math.random() * 120) + 3, likes: Number(p.likes) || Math.floor(Math.random() * 2000) + 20,
          };
        });
        topicCache.current[h.t] = { title: h.t, tag: h.tag, reads: String(parsed.reads ?? `${Math.round(h.heat * 30)}万`), discuss: String(parsed.discuss ?? `${Math.round(h.heat * 0.4)}万`), original: String(parsed.original ?? Math.floor(h.heat)), posts };
      } else {
        topicCache.current[h.t] = genTopicLocal(h);
        flash("生成失败 · 展示本地内容");
      }
    } catch {
      topicCache.current[h.t] = genTopicLocal(h);
      flash("生成失败 · 展示本地内容");
    } finally {
      setTopicLoading(false);
    }
  };

  const ActionBar = ({ id, reposts, comments, likes }: { id: string; reposts: number; comments: number; likes: number }) => {
    const on = isLiked(id);
    const rp = reposted[id];
    return (
      <div className="mt-2 flex items-center text-[12.5px] text-ink-soft">
        <button onClick={() => setReposted((r) => ({ ...r, [id]: !r[id] }))} className="flex flex-1 items-center justify-center gap-1.5" style={{ color: rp ? WB_ORANGE : undefined }}><IconRepost size={15} />{reposts + (rp ? 1 : 0)}</button>
        <button onClick={() => setCommentOn({ count: comments, cid: `wb:${id}` })} className="flex flex-1 items-center justify-center gap-1.5"><IconComment size={15} />{comments}</button>
        <button onClick={() => flip(id)} className="flex flex-1 items-center justify-center gap-1.5" style={{ color: on ? WB_ORANGE : undefined }}>
          <IconHeart size={15} filled={on} />{likes + (on ? 1 : 0)}
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
      {commentOn !== null && <CommentSheet count={commentOn.count} onClose={() => setCommentOn(null)} accent={WB_ORANGE} cid={commentOn.cid} />}
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
            {!tp ? (
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
                  <span>{tp.reads} 阅读</span>
                  <span>{tp.discuss} 讨论</span>
                  <span>{tp.original} 原创</span>
                </div>
              </div>
              <div className="border-b border-black/5 bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-soft">热门讨论</div>
              <div className="divide-y divide-black/[0.06]">
                {tp.posts.map((p, i) => {
                  const npc = p.pid ? game!.npcs.find((n) => n.id === p.pid) : undefined;
                  return (
                    <div key={i} className="bg-white px-3.5 py-3">
                      <div className="flex gap-2.5">
                        <Avatar src={npc?.avatar} name={p.who} size={40} editable={false} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 text-[14.5px] font-semibold" style={{ color: WB_ORANGE }}>
                            {p.who}{p.verified && <IconVerified size={13} style={{ color: WB_ORANGE }} />}
                          </p>
                          <p className="text-[11px] text-ink-soft">{p.when} · 来自 {p.from}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{p.text}</p>
                      <ActionBar id={`t${tp.title}-${i}`} reposts={p.reposts} comments={p.comments} likes={p.likes} />
                    </div>
                  );
                })}
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
        onRefresh={async () => { if (tab === "hot") { await refreshHot(); } else { await delay(700); flash("已经是最新内容"); } }}
      >
        {tab === "hot" && (
          <div className="bg-white">
            <div className="flex items-center gap-1.5 border-b border-black/5 px-3.5 py-2.5 text-[14px] font-bold" style={{ color: WB_ORANGE }}>
              <IconFire size={16} /> 冲浪热榜
              <button onClick={refreshHot} disabled={hotLoading} className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium disabled:opacity-60" style={{ color: WB_ORANGE, background: `${WB_ORANGE}14` }}>
                <span className={hotLoading ? "inline-block animate-spin" : "inline-block"} style={{ fontSize: 13 }}>↻</span>
                {hotLoading ? "生成中…" : "刷新"}
              </button>
            </div>
            {hotList.map((h, i) => (
              <button key={i} onClick={() => openTopic(h)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition active:bg-black/[0.03]">
                <span className={`w-4 text-center text-[15px] font-bold tabular-nums ${i < 3 ? "" : "text-ink-soft/60"}`} style={i < 3 ? { color: WB_ORANGE } : undefined}>{i + 1}</span>
                <span className="flex-1 truncate text-[14px] text-ink">{h.t}</span>
                {h.tag && <span className={`rounded-[3px] px-1 text-[10px] font-bold text-white ${h.tag === "爆" ? "bg-[#e60012]" : h.tag === "沸" ? "bg-[#ff8140]" : h.tag === "新" ? "bg-[#3a8ffe]" : "bg-[#faa]"}`}>{h.tag}</span>}
                <span className="w-14 text-right text-[11.5px] tabular-nums text-ink-soft">{Math.round(h.heat)}万</span>
              </button>
            ))}
          </div>
        )}

        {tab === "home" && (
          <div className="divide-y divide-black/[0.06]">
            {home.map((p, i) => {
              const npc = game!.npcs.find((n) => n.id === p.pid);
              return (
                <div key={i} className="bg-white px-3.5 py-3">
                  <div className="flex gap-2.5">
                    <Avatar src={npc?.avatar} name={p.who} size={40} editable={false} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-[14.5px] font-semibold" style={{ color: WB_ORANGE }}>
                        {p.who}{p.badge && <IconVerified size={13} style={{ color: WB_ORANGE }} />}
                      </p>
                      <p className="text-[11px] text-ink-soft">{p.when} · 来自 {p.from}</p>
                    </div>
                    <button onClick={() => commitGame(setFollow(game!, p.pid, !followSet.has(p.pid)))} className="rounded-full border px-2.5 py-0.5 text-[12px]" style={followSet.has(p.pid) ? { borderColor: "#00000018", color: "#999" } : { borderColor: WB_ORANGE, color: WB_ORANGE }}>{followSet.has(p.pid) ? "已关注" : "+ 关注"}</button>
                  </div>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{p.text}</p>
                  <ActionBar id={`h${i}`} reposts={p.reposts} comments={p.comments} likes={p.likes} />
                </div>
              );
            })}
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
                onClick={() => { const t = draft.trim(); if (!t) return; setDraft(""); flash("已发布"); commitGame(addPost({ ...game!, sim: { ...s, fame: Math.min(1000, s.fame + 1) } }, "weibo", t, Math.round(s.fame * 8 + 50))); }}
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
                  <ActionBar id={`m${p.id}`} reposts={Math.round(p.likes / 8)} comments={Math.round(p.likes / 5)} likes={p.likes} />
                </div>
              ))}
            </div>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
