import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { complete, isConfigured, buildSimSnapshot } from "../../lib/ai";
import type { AIConfig, GameState } from "../../lib/types";

/* 「星潮」饭圈论坛：论坛正文是一个完全自包含的 HTML 模块（纯 HTML+CSS+JS，无外部依赖），
 * 通过 iframe srcdoc 注入、固定尺寸（width 100% / max-width 450px / height 550px）、正文可上下翻动。
 *
 * 内容接入 AI：本 React 外壳持有游戏上下文与 AI 配置，依据「当前剧情」实时生成主帖与楼层，
 * 通过 postMessage 注入 iframe 渲染；「AI 盖楼」增量续写、「正主下场」由 AI 以主角人设亲自回帖。
 * 未配置 AI 时回退到本地示例帖（100 层），保证离线也能正常交互。
 *
 * 记忆分割：论坛的「番外操作」（改名 / 点赞 / 回帖 / 正主下场）只写入独立的 localStorage 键
 * （star2005.forum.extra），与正文剧情存档（GameState）完全不互通、互不影响，也不计入记事本。 */

const EXTRA_KEY = "star2005.forum.extra";

type ForumExtra = { name?: string; log?: string[] };

function loadExtra(): ForumExtra {
  try {
    const raw = localStorage.getItem(EXTRA_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function saveExtra(v: ForumExtra) {
  try {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(v));
  } catch {
    /* 忽略隐私模式下的写入异常 */
  }
}

/* 从模型回复里安全提取 JSON（对象或数组） */
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

const BADGES = ["安利", "CP", "路人", "代拍", "黑", "外", "正主", "数据"];
const LANGS = ["EN", "JP", "KR"];

/* 把模型返回的任意楼层对象整形成可靠的 Floor（防脏数据、防越界） */
function cleanFloor(x: Record<string, unknown>, forceBadge?: Floor["badge"]): Floor | null {
  if (!x || typeof x.c !== "string" || !x.c.trim()) return null;
  const rawBadge = String(x.badge ?? "");
  const badge = (forceBadge ?? (BADGES.includes(rawBadge) ? rawBadge : "路人")) as Floor["badge"];
  const f: Floor = {
    u: String(x.u ?? "网友").slice(0, 18),
    badge,
    c: String(x.c).slice(0, 500),
    likes: Number.isFinite(Number(x.likes)) ? Math.max(0, Math.round(Number(x.likes))) : Math.floor(Math.random() * 280) + 20,
  };
  if (typeof x.lang === "string" && LANGS.includes(x.lang) && typeof x.tr === "string" && x.tr.trim()) {
    f.lang = x.lang as Floor["lang"];
    f.tr = String(x.tr).slice(0, 500);
  }
  if (Array.isArray(x.re)) {
    const re = (x.re as Record<string, unknown>[])
      .filter((r) => r && typeof r.c === "string" && r.c.trim())
      .slice(0, 3)
      .map((r) => ({ u: String(r.u ?? "网友").slice(0, 18), c: String(r.c).slice(0, 260) }));
    if (re.length) f.re = re;
  }
  return f;
}

/* 把当前剧情压成上下文，喂给模型，保证论坛内容与本局剧情强关联 */
function plotContext(game: GameState, star: string): string {
  const npcLine = game.npcs.slice(0, 8).map((n) => `${n.name}（${n.identity}，与主角${n.relation}）`).join("、");
  const last = game.story.slice(-2).map((t) => t.segments.map((s) => (s.kind === "dialogue" ? `${s.speaker}：${s.text}` : s.text)).join(" ")).join("\n");
  return `${buildSimSnapshot(game)}\n主角：${star}（${game.player.identity}）\n人设：${game.player.description || "（未填写）"}\n特质：${game.player.traits.map((t) => t.name).join("、") || "暂无"}\n圈内人物：${npcLine || "（暂无）"}\n剧情摘要：${game.memory || "（游戏刚开始）"}\n最近剧情：${last || "（暂无）"}`;
}

const FORUM_SYS =
  "你是养成游戏《女明星养成沉浸式模拟器》里的饭圈论坛「星潮」内容引擎，围绕主角生成拟真、耐读、排版整齐的粉丝盖楼内容。" +
  "规则：氛围可爱、轻松、有梗；视角多元（安利/CP粉安利/路人理性分析/数据组/代拍花絮/少量黑粉质疑，但黑粉要被理性反驳或自己转粉）；" +
  "适当穿插外国粉丝（英语/日语/韩语，可模拟韩娱粉丝安利口吻）；可涉及少量成年向的表演与角色分析，但须克制、尊重演员、不低俗、不物化；" +
  "每一层楼都要具体、有信息量、贴合主角当前剧情，严禁重复、严禁空洞灌水；尊重主角人设、禁止 OOC，禁止娇妻/油腻/霸总式发言。只输出 JSON，不要任何多余解释。";

const FLOOR_SCHEMA =
  '楼层对象字段：{"u":昵称,"badge":"安利"|"CP"|"路人"|"代拍"|"黑"|"数据","c":正文,"likes":整数(20~600),"re":[{"u":昵称,"c":楼中楼内容}](可省略,0~2条)}。' +
  '若为外国粉丝，把 badge 设为"外"，c 写该语言原文，并额外给出 "lang":"EN"|"JP"|"KR" 与 "tr":中文翻译。';

async function aiGenInit(cfg: AIConfig, game: GameState, star: string): Promise<{ op: { u: string; title: string; c: string }; floors: Floor[] }> {
  const out = await complete(cfg, [
    { role: "system", content: FORUM_SYS },
    { role: "user", content: `${plotContext(game, star)}\n\n请围绕主角「${star}」生成一个「日常向安利」论坛主帖及首批楼层：\n1) 主楼 op：{"u":楼主昵称,"title":帖子标题(≤28字),"c":正文(80~160字，讲一件具体的日常小事/花絮，可爱有梗，贴合当前剧情)}。\n2) floors：22 条不同网友的回复，视角多元、内容各异、彼此不重复；其中至少 3 条外国粉丝（英/日/韩，带翻译），1~2 条黑粉质疑（语气不恶毒，会被随后的楼层理性反驳），1~2 条克制的成年向表演分析；部分楼层可带 1~2 条楼中楼 re。\n${FLOOR_SCHEMA}\n返回 JSON：{"op":{...},"floors":[...]}。只返回 JSON。` },
  ]);
  const p = parseJson<{ op?: Record<string, unknown>; floors?: Record<string, unknown>[] }>(out);
  if (!p || !Array.isArray(p.floors)) throw new Error("bad json");
  const floors = p.floors.map((x) => cleanFloor(x)).filter((f): f is Floor => !!f);
  if (!floors.length) throw new Error("empty");
  const op = {
    u: String(p.op?.u ?? "楼主").slice(0, 18),
    title: String(p.op?.title ?? `【日常安利】关于${star}的一件小事`).slice(0, 40),
    c: String(p.op?.c ?? "").slice(0, 400) || `今天又被${star}可爱到了，来盖个楼慢慢说🌸`,
  };
  return { op, floors };
}

async function aiGenMore(cfg: AIConfig, game: GameState, star: string, count: number, recentNames: string): Promise<Floor[]> {
  const out = await complete(cfg, [
    { role: "system", content: FORUM_SYS },
    { role: "user", content: `${plotContext(game, star)}\n\n这是一个关于主角「${star}」的安利帖，已经盖到第 ${count} 层。请续写接下来的 20 层楼，推进讨论的走向（例如：新剧集/舞台播出后的反响、黑粉被有理有据打脸、外国字幕组进场、CP 线升温、一段克制的成年向细节分析、路人被逐渐圈粉等），让楼层之间有承接、有发展。\n严格要求：昵称与内容都不得与前文重复；最近出现过的昵称有：${recentNames || "（无）"}，请避开。\n${FLOOR_SCHEMA}\n返回 JSON：{"floors":[...20 条...]}。只返回 JSON。` },
  ]);
  const p = parseJson<{ floors?: Record<string, unknown>[] }>(out);
  if (!p || !Array.isArray(p.floors)) throw new Error("bad json");
  const floors = p.floors.map((x) => cleanFloor(x)).filter((f): f is Floor => !!f);
  if (!floors.length) throw new Error("empty");
  return floors;
}

async function aiGenStar(cfg: AIConfig, game: GameState, star: string): Promise<Floor[]> {
  const out = await complete(cfg, [
    { role: "system", content: FORUM_SYS },
    { role: "user", content: `${plotContext(game, star)}\n\n现在「正主下场」：请让主角「${star}」本人亲自在这个安利帖里回帖，生成 2~3 层楼。语气必须完全符合主角的人设与当前处境，真诚、谦逊、可爱不做作，可以回应前面粉丝的讨论、感谢大家，也可以害羞或俏皮；严禁 OOC，严禁娇妻/油腻/霸总腔。\n每层楼对象：{"u":"${star}（正主已认证）","c":正文,"likes":整数(200~800),"re":[{"u":粉丝昵称,"c":激动的回复}](可选0~2条)}。\n返回 JSON：{"floors":[...]}。只返回 JSON。` },
  ]);
  const p = parseJson<{ floors?: Record<string, unknown>[] }>(out);
  if (!p || !Array.isArray(p.floors)) throw new Error("bad json");
  const floors = p.floors.map((x) => cleanFloor(x, "正主")).filter((f): f is Floor => !!f);
  if (!floors.length) throw new Error("empty");
  return floors;
}

export default function ForumApp({ onBack }: { onBack: () => void }) {
  const { game, cfg } = useGame();
  const star = (game?.player.name || "她").trim();
  const aiOn = isConfigured(cfg);
  const [extra] = useState<ForumExtra>(loadExtra);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  // 用 ref 持有最新的 game / cfg，供异步生成使用（避免闭包拿到旧值）
  const gRef = useRef(game); gRef.current = game;
  const cfgRef = useRef(cfg); cfgRef.current = cfg;

  // 生成状态用 ref 管控，避免并发重复请求
  const busyRef = useRef(false);
  const initedRef = useRef(false);
  const starDoneRef = useRef(false);
  const floorsRef = useRef<Floor[]>([]);

  useEffect(() => {
    const post = (msg: unknown) => frameRef.current?.contentWindow?.postMessage(msg, "*");
    const status = (busy: boolean, msg = "") => post({ __forum_status: true, busy, msg });

    const doInit = async () => {
      if (initedRef.current) return;
      initedRef.current = true;
      const g = gRef.current;
      const c = cfgRef.current;
      if (!g || !isConfigured(c)) {
        floorsRef.current = FLOORS.slice();
        post({ __forum_set: true, op: OP, floors: floorsRef.current, ai: false });
        return;
      }
      status(true, "AI 正在依据当前剧情写帖子…");
      try {
        const d = await aiGenInit(c, g, (g.player.name || "她").trim());
        floorsRef.current = d.floors;
        post({ __forum_set: true, op: d.op, floors: d.floors, ai: true });
      } catch {
        floorsRef.current = FLOORS.slice();
        post({ __forum_set: true, op: OP, floors: floorsRef.current, ai: false, err: "AI 生成失败，已回退本地示例帖" });
      } finally {
        status(false);
      }
    };

    const doMore = async () => {
      if (busyRef.current) return;
      const g = gRef.current;
      const c = cfgRef.current;
      if (!g || !isConfigured(c)) { post({ __forum_toast: true, msg: "未配置 AI，无法继续盖楼" }); return; }
      busyRef.current = true;
      status(true, "AI 正在盖楼…");
      try {
        const names = floorsRef.current.slice(-8).map((f) => f.u).join("、");
        const more = await aiGenMore(c, g, (g.player.name || "她").trim(), floorsRef.current.length, names);
        floorsRef.current = floorsRef.current.concat(more);
        post({ __forum_add: true, floors: more });
      } catch {
        post({ __forum_toast: true, msg: "盖楼失败，请重试" });
      } finally {
        busyRef.current = false;
        status(false);
      }
    };

    const doStar = async () => {
      if (busyRef.current || starDoneRef.current) return;
      busyRef.current = true;
      status(true, "正主正在赶来…");
      const g = gRef.current;
      const c = cfgRef.current;
      try {
        const sf = g && isConfigured(c)
          ? await aiGenStar(c, g, (g.player.name || "她").trim())
          : STAR_FLOORS.slice();
        starDoneRef.current = true;
        floorsRef.current = floorsRef.current.concat(sf);
        post({ __forum_add: true, floors: sf, star: true });
      } catch {
        post({ __forum_toast: true, msg: "正主没能赶来，稍后再试" });
      } finally {
        busyRef.current = false;
        status(false);
      }
    };

    function onMsg(e: MessageEvent) {
      const d = e.data as { __forum?: boolean; name?: string; log?: string[]; __forum_req?: string };
      if (!d) return;
      if (d.__forum) { saveExtra({ name: d.name, log: d.log }); return; }
      if (d.__forum_req === "ready") { void doInit(); return; }
      if (d.__forum_req === "more") { void doMore(); return; }
      if (d.__forum_req === "star") { void doStar(); return; }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const srcDoc = useMemo(() => buildForumHtml(star, extra), [star, extra]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="text-[16px] font-medium text-blue-500 active:opacity-60 transition-opacity">‹ 返回</button>
        <span className="ml-1 text-[16px] font-semibold text-gray-900 truncate">星潮 · 饭圈论坛</span>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-1 text-[12px] font-medium ${aiOn ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}>{aiOn ? "AI 联动" : "本地示例"}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={frameRef}
          title="星潮论坛"
          className="h-full w-full border-0"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
        />
      </div>
    </div>
  );
}

/* ————————————————————————————————————————————————————————————————
 * 论坛内容 & 完整 HTML 模块
 * ———————————————————————————————————————————————————————————————— */

type Reply = { u: string; c: string };
type Floor = {
  u: string;
  badge: "安利" | "CP" | "路人" | "代拍" | "黑" | "外" | "正主" | "数据";
  c: string;
  likes: number;
  lang?: "EN" | "JP" | "KR";
  tr?: string; // 译文
  re?: Reply[];
};

/* 占位符 {n} = 正主名字（渲染时全局替换）。 */
const OP = {
  u: "夜市蹲点选手",
  title: "【日常安利】昨晚在夜市偶遇{n}，可爱到我当场原地螺旋",
  c: "家人们谁懂啊😭 昨晚下班路过老城夜市，看到一个戴渔夫帽的女生蹲在烤肠摊前，跟老板说“要那根最焦的”，转头我一看这不是{n}嘛！她排队排得特别自然，被认出来也没跑，笑眯眯比了个嘘的手势，还小声说“你也吃一根呀”。就……这谁顶得住。新剧《春潮》也定档下周三了，先码住这楼，慢慢盖。图我不敢乱发，尊重隐私，就口述一下这份可爱🌸",
};

const FLOORS: Floor[] = [
  { u: "第一个沙发", badge: "路人", c: "沙发！路过被楼主的“原地螺旋”笑到，这形容词好草。求蹲后续。", likes: 41 },
  { u: "焦香烤肠批", badge: "安利", c: "要最焦那根这个细节太真实了，说明是真的会吃、不端着。我们家女明星就是接地气🥺", likes: 88, re: [{ u: "夜市蹲点选手", c: "对！她还跟老板唠了两句说这家比上次那家香，熟客感拉满。" }] },
  { u: "只磕业务", badge: "路人", c: "先不谈人品，就说《春潮》预告里那段哭戏，眼泪在眼眶里打转就是不掉，这个控制力路人也能看出来是有东西的。", likes: 132 },
  { u: "CP第一战舰", badge: "CP", c: "《春潮》里她和男二那场雨里对峙，我不管，这就是我今年的年度CP！眼神拉丝，导演你把镜头给我怼近一点啊喂", likes: 27, re: [{ u: "理智追剧", c: "姐妹先看完再嗑，别又是预告剪辑出来的糖，最后正片十分钟😅" }, { u: "CP第一战舰", c: "让我先做会儿美梦！" }] },
  { u: "半年潜水党", badge: "路人", c: "被安利来的。刚去翻了她三年前那部小成本文艺片，演一个聋哑绣娘，全程没几句台词全靠手，看完我坐了五分钟没缓过来。这不是流量该有的水平吧。", likes: 205 },
  { u: "嘴硬观察员", badge: "黑", c: "行吧又开始了，一个买烤肠都能吹三十层。演技这东西等《春潮》播完再说，别到时候扑了又删帖。", likes: 12, re: [
    { u: "只磕业务", c: "人家没说封神，就说预告有质感，你紧张什么🤨" },
    { u: "第一个沙发", c: "买烤肠碍着你了兄弟，深呼吸。" },
  ] },
  { u: "数据小组织", badge: "数据", c: "客观补一下：《春潮》是正午团队的班底，剧本改编自获奖中篇，她这次是女一，戏份占比大。扑不扑先不说，至少不是来划水的配置。", likes: 96 },
  { u: "普通妈粉", badge: "安利", c: "我第一次喜欢她是采访里，记者问“最想感谢谁”，她愣了下说“想感谢那个没在最难的时候把自己弄丢的我”。就这一句，妈粉预定了。", likes: 178 },
  { u: "路过的编剧", badge: "路人", c: "从业者说句公道话：素人在夜市被拍到还能笑着比嘘，情绪管理是童子功。很多人红了之后连排队都做不到。", likes: 143 },
  { u: "Sarah_fromLA", badge: "外", lang: "EN", c: "I don't even understand Chinese but the trailer of Spring Tide made me cry. Her eyes tell the whole story. Please someone tell me where to watch with subs!", tr: "我根本看不懂中文，但《春潮》的预告直接把我看哭了。她的眼睛就能讲完整个故事。求求谁告诉我哪里能看带字幕的版本！", likes: 64, re: [{ u: "字幕野生搬运", c: "Wednesday it airs, unofficial subs usually up within a day, DM me（周三开播，字幕一般一天内就有）" }] },
  { u: "焦香烤肠批", badge: "安利", c: "补个冷知识：她好像真的很爱吃夜市，之前直播说过收工后最治愈的就是一个人蹲路边摊，说“坐在小板凳上，谁也不认识你，特别踏实”。", likes: 121 },
  { u: "理性黑转粉", badge: "路人", c: "我原来是来看笑话的，结果翻资料翻到她给聋哑学校捐钱这事捂了四年没曝光，是记者去采访才被扒出来的。……行吧，我错了，这楼我留着。", likes: 260 },
  { u: "CP第二舰队", badge: "CP", c: "楼上磕男二的先别急，我磕的是她和女三的姐妹线！预告里那个互相理头发的两秒钟，姐狂喜。女性情谊才是本命好吗", likes: 55 },
  { u: "阴阳怪气协会", badge: "黑", c: "捐款不宣传？现在不就宣传上了吗，营销号闻着味就来。", likes: 8, re: [
    { u: "理性黑转粉", c: "是记者扒的，人家本人到现在一个字没提过，你上网搜她本人有回应吗？没有吧。" },
    { u: "路过的编剧", c: "这就叫欲加之罪，做也不是不做也不是。" },
  ] },
  { u: "たなか_ちひろ", badge: "外", lang: "JP", c: "予告編を見て一目惚れしました。彼女の泣き演技、涙を『こらえる』芝居が本当に上手。日本でも配信されますように🙏", tr: "看了预告一见钟情。她的哭戏，那种“强忍着不掉泪”的表演真的太厉害了。希望在日本也能上线🙏", likes: 73 },
  { u: "考据老饭", badge: "数据", c: "帮日本朋友答一下：海外应该会走正版流媒体，具体平台没官宣，等定档物料。别催搬运资源啦，支持正版她才有下一部💰", likes: 47 },
  { u: "夜市蹲点选手", badge: "安利", c: "楼主回来了。再补一个：她走的时候把板凳还给老板，还顺手把旁边翻倒的辣椒罐扶正了。小动作骗不了人的，这人是真的稳。", likes: 189 },
  { u: "只磕颜的", badge: "安利", c: "别的不说，渔夫帽+素颜还能被认出来，这个骨相是真的顶。姐姐你把口红色号发一下我可以给你打钱（不是）", likes: 66 },
  { u: "谨慎乐观", badge: "路人", c: "希望《春潮》别被剪崩。这种现实题材最怕后期乱动刀，前面铺垫全废。演员再好也扛不住剪辑。", likes: 58 },
  { u: "十八线场务", badge: "路人", c: "剧组待过一阵，说个亲历：她收工最晚走，因为会等灯光和场务一起收，还给夜班的买过奶茶。剧组口碑这东西装不出来，装一天可以，装三个月不可能。", likes: 231, re: [{ u: "普通妈粉", c: "呜呜呜这段我截图了，谢谢你来作证。" }] },
  { u: "박지은_KR", badge: "外", lang: "KR", c: "예고편 보고 팬 됐어요. 이 배우 눈빛 연기가 미쳤다… 한국 팬들한테도 빨리 알려지면 좋겠어요💕", tr: "看了预告就成粉了。这演员的眼神戏绝了……真希望能快点让韩国粉丝也知道她💕", likes: 61, re: [{ u: "CP第二舰队", c: "韩饭欢迎！我们这有专门的应援翻译楼，晚点整理个生肉合集给你们～" }] },
  { u: "剪刀手爱观察", badge: "路人", c: "客观说她台词功底在同龄里算好的，气口很稳，不飘。就是有时候情绪太满会稍微用力，希望这次收着点会更高级。", likes: 84 },
  { u: "嘴硬观察员", badge: "黑", c: "……好吧场务那段我信了。我关注下《春潮》，播了再来。", likes: 39, re: [{ u: "第一个沙发", c: "欢迎回头是岸兄弟🤝" }] },
  { u: "夜猫子学生", badge: "安利", c: "凌晨三点睡不着来盖楼。想起她那句“没把自己弄丢”，我最近考研压力好大，看到这句突然就不那么慌了。谢谢你姐姐，虽然你不认识我。", likes: 156, re: [{ u: "普通妈粉", c: "考研加油！先把楼盖完再去睡，明天六点就别赖床了哈🥹" }] },
  { u: "CP第一战舰", badge: "CP", c: "回楼上理智党：正片出来了！第三集雨戏是真的，不是预告骗人，我磕对了！！！（截图.jpg）（此处应有尖叫）", likes: 44 },
  { u: "反诈老陈同款", badge: "路人", c: "提醒一句楼里的：最近有假的“{n}后援会”收钱代拍，官方唯一渠道认准蓝V，别被割韭菜。理智追星，钱包要紧。", likes: 112 },
  { u: "细节控放大师", badge: "数据", c: "《春潮》第三集有个封神细节：她听到坏消息时手在抖，但硬是把茶倒满没洒。这个“手抖却不失控”的设计，要么是演员自己加的，要么是导演真的懂。演技拆解楼➕1", likes: 137 },
  { u: "微醺不上头", badge: "路人", c: "说个可能被喷的：我觉得她不算顶级美女，但她“会用脸”，同一张脸能演出天真和阴狠两种，这比单纯好看值钱多了。", likes: 71 },
  { u: "老母亲式操心", badge: "安利", c: "看到她夜市吃烤肠我第一反应是：孩子你按时吃饭了吗，别老是收工才吃。演艺圈作息太伤了，希望团队好好照顾她的胃。", likes: 93 },
  { u: "Mika_Osaka", badge: "外", lang: "JP", c: "第3話の雨のシーン、何回も見返してます。感情の爆発じゃなくて、静かに壊れていく感じがすごい。彼女は本物です。", tr: "第三集的雨戏我反复看了好多遍。不是那种情绪大爆发，而是安安静静地一点点崩塌，太厉害了。她是真材实料的。", likes: 58 },
  { u: "隔壁家族路人", badge: "黑", c: "别的粉丝路过。你们这个真的不炒作？我怎么感觉有点用力过猛，一个夜市买烤肠盖到三十几层了。", likes: 15, re: [
    { u: "十八线场务", c: "楼主自己都说不敢发图、尊重隐私了，这也叫炒作？那全网都别夸人了呗。" },
    { u: "微醺不上头", c: "家人这是自来水盖楼，玩过论坛就知道，真炒作图早满天飞了。" },
  ] },
  { u: "追了十年剧", badge: "路人", c: "阅剧无数说句话：现实题材女主最难的是“不表演的表演”，她第三集吃饭那场戏，就正常扒饭，但你能看出她在走神、在难过。这个太难了，很多老戏骨都做不到。", likes: 168 },
  { u: "CP第三方观察", badge: "CP", c: "我不磕CP我磕她和导演，这对合作真的合拍，导演采访里说“她会问角色为什么这么做，而不是这场戏怎么哭”。有想法的演员和懂她的导演，绝配。", likes: 89 },
  { u: "手工耿的粉", badge: "安利", c: "楼主说她扶正辣椒罐那段，我信。因为她之前拿奖感言只说了四十秒，把时间让给了没被念到的幕后名单，还念了灯光师的名字。细节见人品。", likes: 147 },
  { u: "英专在读", badge: "外", lang: "EN", c: "As a Chinese learner, watching her show is my favorite way to study. Her enunciation is so clean I can actually catch the words. Educational AND emotional damage lol.", tr: "作为一个学中文的人，看她的剧是我最喜欢的学习方式。她咬字太清楚了，我真的能听懂。既能学习又能受到情感暴击哈哈。", likes: 52, re: [{ u: "英专在读", c: "顺便说她笑起来有个小虎牙，救命，谁扛得住。" }] },
  { u: "客观理中客", badge: "路人", c: "泼盆冷水：演技我认，但一部剧不能说明什么，希望她别飘，选剧本继续这么稳。捧杀比黑更可怕，粉丝理智点。", likes: 124, re: [{ u: "反诈老陈同款", c: "这个真中肯，理智夸，别造神。" }] },
  { u: "夜市蹲点选手", badge: "安利", c: "楼主再冒个泡：有人问后续，没有后续了哈哈，人家吃完就低调走了，我也没跟拍，跟拍就不礼貌了。喜欢一个人是希望她能好好生活，不是被围观。", likes: 214 },
  { u: "破防大学生", badge: "安利", c: "“喜欢一个人是希望她能好好生活”——楼主这句话我要抄在本子上。这才是追星该有的样子，隔壁天天代拍蹲酒店的看看。", likes: 133 },
  { u: "老年追星团", badge: "路人", c: "我五十多了跟着女儿看《春潮》，本来是陪看，结果比她还上头。这姑娘演的农村媳妇，那个隐忍劲儿，像极了我年轻时候。好演员是能照见人的。", likes: 196 },
  { u: "이수민_seoul", badge: "外", lang: "KR", c: "저 배우 웃을 때 덧니 진짜 심장 아프게 귀엽다… 근데 우는 연기 보면 완전 다른 사람 같아요. 갭 미쳤어.", tr: "那个演员笑起来的小虎牙真是可爱到让人心疼……可一看她的哭戏又完全像换了个人。这个反差绝了。", likes: 67 },
  { u: "拉踩举报侠", badge: "黑", c: "笑死，一个虎牙都能跨国夸。你们粉丝滤镜厚度可以申报吉尼斯了。", likes: 6, re: [
    { u: "破防大学生", c: "夸自家爱豆虎牙碍着你了？你不喜欢可以划走，没人拦你。" },
    { u: "客观理中客", c: "人家韩国网友真情实感，你阴阳怪气图啥呢。" },
  ] },
  { u: "配音圈边角料", badge: "数据", c: "业内补料：《春潮》是原声，没配音。现在敢用原声的年轻女演员不多了，敢用=对自己台词有底气。这点值得夸。", likes: 108 },
  { u: "深夜放毒手", badge: "CP", c: "郑重安利她和女二的“互穿外套”名场面：下雨女二把外套给她，她第二天默默洗好叠整齐还回去。没有一句台词，全是戏。姐妹们冲！", likes: 76 },
  { u: "写论文逃避中", badge: "路人", c: "本来开着当背景音写论文，结果论文没写完，剧倒是追平了。她一个眼神我DDL就又往后推一天，她是我的学业杀手（褒义）。", likes: 84 },
  { u: "冷静分析帝", badge: "数据", c: "热度数据同步：《春潮》第三集后，她的角色片段单条播放破千万，评论区“自来水”占比很高。这种没买热搜、靠内容发酵的走势，比硬砸的健康多了。", likes: 97 },
  { u: "成年人的凝视", badge: "路人", c: "成年向分析一下（正经）：第五集那段感情戏，镜头没拍露骨的，但两个人呼吸的节奏、手指停在纽扣上又收回的犹豫，把“想要又克制”演得比直给高级一百倍。留白才是高手。", likes: 158, re: [
    { u: "追了十年剧", c: "对，克制的情欲比直白的更有张力，这场调度是真的懂。" },
    { u: "剪刀手爱观察", c: "而且没有物化女演员，镜头是平视的，尊重感拉满。" },
  ] },
  { u: "端水大师兄", badge: "路人", c: "客观说，她也不是没缺点，比如上综艺有点放不开、偶尔冷场。但人家本来就是靠作品的，综艺尴尬就尴尬吧，能演戏就行。", likes: 62 },
  { u: "自来水一枚", badge: "安利", c: "刚给我妈安利完，我妈现在比我还狂热，天天催更。我算是给自己找了个搭子（叹气但幸福）。", likes: 71 },
  { u: "Diego_Madrid", badge: "外", lang: "EN", c: "Spanish fan here! The scene where she folds the jacket and returns it — no words, just respect. That's storytelling. We need more actors like her worldwide.", tr: "西班牙粉丝报到！她把外套叠好还回去那段——没有台词，只有尊重。这才是讲故事。全世界都需要更多像她这样的演员。", likes: 55 },
  { u: "夜市蹲点选手", badge: "安利", c: "五十楼了！谢谢家人们把这楼盖得这么干净，没有对骂没有引战，还有这么多国家的朋友。突然觉得喜欢同一个人的感觉真好，像夜市那根烤肠，热乎乎的。", likes: 241 },
  { u: "路人转粉ing", badge: "路人", c: "五十楼打卡。我是被这个楼的氛围圈粉的，不是被剧圈的，哈哈。一个爱豆的粉丝什么样，能看出这个爱豆什么样。", likes: 118 },
  { u: "考据老饭", badge: "数据", c: "补个时间线给新来的：她出道七年，前四年都是配角龙套，演过丫鬟、护士、女尸（真的躺了一集）。不是一夜爆红，是熬出来的。这种我服。", likes: 174 },
  { u: "丫鬟专业户", badge: "安利", c: "还记得她演女尸那集吗！弹幕都在刷“这女尸好像在呼吸”，结果人家真的憋着气演，敬业到有点好笑又有点心疼。", likes: 129, re: [{ u: "考据老饭", c: "对！那条“会呼吸的女尸”当年还上过小热搜，笑死。" }] },
  { u: "冷眼旁观者", badge: "黑", c: "熬七年就一定是好演员？多少熬十年还是没演技的。你们这逻辑有问题。", likes: 9, re: [
    { u: "追了十年剧", c: "没人说熬=好，是说她既熬了又演得好，两件事。别偷换概念。" },
    { u: "端水大师兄", c: "而且她作品在那摆着，你可以去看完再来评。" },
  ] },
  { u: "山田_はると", badge: "外", lang: "JP", c: "死体役の話、めっちゃ好き（笑）。無名時代からちゃんと役に向き合ってたんだね。こういう積み重ねがある俳優は信頼できる。", tr: "女尸那段我太喜欢了哈哈。原来她默默无闻的时候就已经在认真对待每个角色了。有这种积累的演员真的值得信任。", likes: 63 },
  { u: "第二现场", badge: "代拍", c: "（非蹲酒店那种代拍）今天官方物料放了《春潮》花絮，她NG之后自己蹲在角落对着剧本念叨，工作人员说她每条NG都会先怪自己。这个态度……我先哭为敬。", likes: 142 },
  { u: "花絮考古队", badge: "安利", c: "接楼上：花絮里她还给对手戏的小演员讲戏，蹲下来跟小孩平视说话。跟小朋友都愿意蹲下来的人，心里是软的。", likes: 133 },
  { u: "理智追剧", badge: "路人", c: "回最开始那个CP战舰：我追平了，道歉，雨戏确实是真糖不是预告骗人。是我格局小了，磕就磕吧我陪你磕。", likes: 58, re: [{ u: "CP第一战舰", c: "欢迎上船！！！早说让你先看的吧哈哈哈🚢" }] },
  { u: "数据组打工人", badge: "数据", c: "更新：《春潮》豆瓣开分8.4，她的表演在长评里被提及率最高。开分能上8的现实题材今年不多，稳住别飘，继续看后续走势。", likes: 104 },
  { u: "毒舌但真诚", badge: "路人", c: "我这人从不夸流量，但这个我破例。不是因为她红，是因为她把“认真”这件最不稀奇的事做成了稀奇事。行业病了，她像个没病的。", likes: 187 },
  { u: "Anna_Berlin", badge: "外", lang: "EN", c: "8.4 on Douban?! Okay I'm officially obsessed. Started a subtitle thread on our fan discord. She's about to blow up internationally, mark my words.", tr: "豆瓣8.4？！好吧我正式入坑了。已经在我们粉丝 Discord 开了个字幕帖。她要在国际上火了，记住我说的话。", likes: 49 },
  { u: "夜市蹲点选手", badge: "安利", c: "楼主小小声：其实我发这个帖只是想记录一个普通又美好的夜晚，没想到能盖这么高。谢谢每一个认真打字的你。喜欢一个人真好，喜欢一群喜欢同一个人的人，更好。", likes: 233 },
  { u: "六十楼纪念", badge: "路人", c: "六十楼！这楼建议置顶当追星教科书：不撕不黑不代拍，只夸作品和人品。别家该学学。", likes: 121 },
  { u: "养生追星", badge: "安利", c: "提醒楼里熬夜盖楼的家人：她自己都说过“先照顾好自己再来爱我”。别学我，我盖楼盖到凌晨两点了，睡了睡了，明天继续。", likes: 88 },
  { u: "偶尔清醒", badge: "路人", c: "说点不一样的：捧得越高摔得越狠，希望她团队悠着点接综艺和代言，别把一个好演员做成带货机器。见过太多好苗子被资本催熟了。", likes: 96, re: [{ u: "冷静分析帝", c: "同担忧。目前看她团队还算克制，商务没乱接，保持住就好。" }] },
  { u: "김하늘_KR", badge: "外", lang: "KR", c: "한국에서도 이제 클립 돌기 시작했어요! 여배우 연기 논란 없는 배우 오랜만이라 신기함. 우리 이 배우 소중히 하자 제발🥹", tr: "在韩国也开始有片段流传了！好久没见过演技零争议的女演员了，好新奇。求求我们一定要好好珍惜这位演员🥹", likes: 71 },
  { u: "被安利到了", badge: "路人", c: "六十多楼了我从头看到尾，一条重复的都没有，你们是有多爱她能写出这么多不一样的夸。行，我信了，这就去看《春潮》。", likes: 108, re: [{ u: "毒舌但真诚", c: "去吧孩子，回来记得回帖汇报观后感。" }] },
  { u: "补番中毒", badge: "安利", c: "看完《春潮》回来汇报：楼主没骗我，甚至夸少了。第八集她无实物表演给一封不存在的信念内容，念着念着声音就哑了，我跟着一起哑。", likes: 126 },
  { u: "台词课代表", badge: "数据", c: "接楼上：第八集那段我逐帧看了，她念信时有三次极细微的哽咽，节奏都不一样，不是套路化的哭腔。这是真的进到角色里了。演技拆解楼再➕1", likes: 99 },
  { u: "阴阳大师退散", badge: "黑", c: "（前面阴阳的那个我）看完第八集了。……那封信我确实破防了。以后不阴阳她了，删前面几楼我做不到，就挂着当我道歉吧。", likes: 87, re: [
    { u: "夜市蹲点选手", c: "欢迎你，真心的。喜欢就大方喜欢，不用别扭😊" },
    { u: "破防大学生", c: "这才是成年人，服气。" },
  ] },
  { u: "野生翻译君", badge: "外", lang: "JP", c: "第8話の手紙のシーン、日本語字幕付けながら3回泣きました。翻訳者なのに手が震えて進まなかった…彼女の演技は国境を越える。", tr: "第八集那封信的戏，我边打日文字幕边哭了三次。明明是做翻译的，手抖到根本打不下去……她的演技是跨越国界的。", likes: 78 },
  { u: "七十楼观光", badge: "路人", c: "七十楼纪念。这楼从一根烤肠盖到跨国字幕组，见证了一场很温柔的自来水。收藏了，以后追星迷茫了就回来看看。", likes: 132 },
  { u: "只想她幸福", badge: "安利", c: "盖到这里我只有一个愿望：希望她能一直这样，接好剧本，好好吃饭，被爱她的人温柔对待。红不红是其次，健康快乐最重要。", likes: 161 },
  { u: "路人甲乙丙", badge: "路人", c: "从不追星的我，第一次想为一个演员写这么长一段。不是因为她完美，是因为她真实。这年头，真实太稀缺了。", likes: 114 },
  { u: "夜市蹲点选手", badge: "安利", c: "楼主坐标已收到私信问那家烤肠摊在哪——不告诉你们哈哈哈！让姐姐能安安静静吃根烤肠不好吗😆 保护她的普通生活，也是一种喜欢。", likes: 178 },
  { u: "森林里的鹿", badge: "CP", c: "最后强推一遍她和女二线：不是爱情不是塑料，是两个女人在难处里互相递了一把伞。这种关系太珍贵了，编剧和演员都功不可没。", likes: 92 },
  { u: "退圈又回坑", badge: "路人", c: "退坑三年，被这个楼一句一句拉回来了。原来还有这么干净的追星氛围。谢谢楼主，谢谢这一整层楼的温柔。", likes: 103 },
  { u: "Yuki_Tokyo", badge: "外", lang: "JP", c: "この掲示板、罵り合いが一つもない…みんな作品と人柄だけを語ってる。こんなファンダム、日本でもなかなか見ないよ。彼女は幸せ者だね。", tr: "这个论坛，一句对骂都没有……大家只聊作品和人品。这样的粉丝圈，在日本也不多见。她真是个幸福的人。", likes: 84 },
  { u: "八十楼路过", badge: "路人", c: "八十楼！有没有一种可能，正主其实在偷偷看这个楼……姐姐如果你看到了，眨一下眼（不是）。", likes: 96, re: [{ u: "只想她幸福", c: "别，让她好好休息，看到会害羞的哈哈哈。" }] },
  { u: "夜读人", badge: "安利", c: "深夜再来盖一层。今天心情很糟，翻到这个楼，看着大家认真夸一个认真演戏的人，突然就觉得世界还挺可爱的。谢谢你们，也谢谢她。", likes: 137 },
  { u: "剧抛脸鉴定", badge: "数据", c: "总结陈词：从聋哑绣娘到会呼吸的女尸到《春潮》的农村媳妇，她是真正的“剧抛脸”——每个角色都不像她自己。这才是演员，不是明星。", likes: 145 },
  { u: "理智夸夸团", badge: "路人", c: "八十多楼了做个理性小结：她的优点是真实、敬业、有作品；短板是综艺感一般、需警惕过度曝光。夸要夸得清醒，这样的喜欢才长久。", likes: 121 },
  { u: "Léa_Paris", badge: "外", lang: "EN", c: "This thread is 80+ floors of pure love with actual film analysis and zero drama. I'm screenshotting this to show people what a healthy fandom looks like. Bravo everyone.", tr: "这个帖子八十多层楼全是纯粹的爱、真正的影视分析，一点撕逼都没有。我要截图给别人看看什么叫健康的粉丝圈。给大家点赞。", likes: 68 },
  { u: "催更狂魔", badge: "安利", c: "《春潮》要大结局了呜呜呜舍不得。已经开始戒断反应了。姐姐你下一部什么时候定啊，我卑微等待.jpg", likes: 88 },
  { u: "定档雷达", badge: "数据", c: "回楼上：目前没官宣新项目，别信小道消息。她这种人大概率会先歇一阵挑本子，不会连轴转。耐心等，好饭不怕晚。", likes: 79 },
  { u: "九十楼倒计时", badge: "路人", c: "九十楼！离楼主说的一百层不远了，大家有序盖楼，别水，把最想说的话留在这儿。", likes: 94 },
  { u: "初心不忘", badge: "安利", c: "想说的其实很简单：谢谢你在最难的时候没把自己弄丢，也谢谢你让我们这些陌生人，因为你聚在一起，认认真真地温柔了一整个帖子。", likes: 152 },
  { u: "박서준팬_KR", badge: "外", lang: "KR", c: "이 배우 덕분에 중국 드라마 정주행 시작했어요. 다음 작품도 꼭 볼 거예요. 우리 오래오래 응원하자구요, 세계 각지에서!💕", tr: "多亏了这位演员，我开始追中国剧了。下一部我也一定会看。我们一起长长久久地应援她吧，来自世界各地！💕", likes: 73 },
  { u: "扫楼总结帝", badge: "路人", c: "九十多楼扫下来最大的感受：一个人值不值得喜欢，看她的粉丝就知道了。这一楼没有戾气，只有欣赏。这本身就是对她最好的证明。", likes: 128 },
  { u: "夜市蹲点选手", badge: "安利", c: "楼主含泪冒泡：马上一百层了，我从没想过一根烤肠能盖出一座这么暖的楼。谢谢每一位家人。如果正主哪天真的看到——姐姐，我们都在，慢慢来，不着急。", likes: 208 },
  { u: "服化道的朋友", badge: "数据", c: "剧组服化透露一嘴：《春潮》她那身洗得发白的旧棉袄是提前两周就穿在身上“养”出来的褶皱，不是做旧喷的。为了一件戏服较这个真，现在真不多见。", likes: 111 },
  { u: "配乐党上头", badge: "安利", c: "被这楼安利后二刷，这次专门听配乐。第八集念信那段背景只有很轻的钢琴，几乎听不见，全靠她的声音撑，导演敢这么留白，是真信她的台词功底。", likes: 96 },
  { u: "Chloe_Sydney", badge: "外", lang: "EN", c: "Just finished all episodes at 4am. No regrets. The old worn coat detail someone mentioned above — you can literally FEEL the years on her character. Costume + acting in perfect sync. Masterclass.", tr: "凌晨四点刚追完全集，不后悔。楼上有人提到那件旧棉袄的细节——你真的能从她的角色身上“感觉到”岁月。服装和表演完美同步，教科书级别。", likes: 59 },
  { u: "键盘影评人", badge: "路人", c: "冷静评一句：这剧不是没瑕疵，中段第六集节奏拖了点。但女主的表演稳定性撑住了这个坑，换个演员可能就弃了。她是这剧的地基。", likes: 88 },
  { u: "手账少女心", badge: "安利", c: "把这楼里的金句都摘抄进手账了：“没把自己弄丢”“喜欢是希望她好好生活”“真实太稀缺”。一个论坛能产出这么多治愈的句子，也是绝了。", likes: 104 },
  { u: "渡辺_さくら", badge: "外", lang: "JP", c: "手帳に名言をまとめてる方、素敵すぎます。この掲示板全体が一つの作品みたい。彼女を好きになった人たちが、こんなに優しい言葉を書けるって、それが答えだと思う。", tr: "把金句整理进手账的那位，太棒了。整个论坛就像一件作品。喜欢上她的人能写出这么温柔的话，我觉得这本身就是答案。", likes: 72 },
  { u: "追光的人", badge: "路人", c: "从第一楼看到这里花了我一个通勤加一个午休。值。这不只是在夸一个演员，是一群陌生人在互相确认：认真和善良，还是有人会看见、会珍惜的。", likes: 127 },
  { u: "夜市蹲点选手", badge: "安利", c: "楼主最后再说一句：这楼我会一直留着。哪天你们追星累了、被饭圈的乌烟瘴气恶心到了，就回来看看——原来喜欢一个人，也可以这么干净、这么有力气。九十八楼，稳稳的。", likes: 183 },
  { u: "第九十九层", badge: "路人", c: "九十九楼！把一百楼这个吉利数留给最想留的人。有没有可能……正主真的会来（狗头）。", likes: 116 },
  { u: "百楼见证者", badge: "安利", c: "一百楼达成！🎉 这一整座楼，从夜市烤肠到跨国字幕组，没有一句重复的废话，全是真心。这就是我们喜欢她的方式——认真、干净、长久。撒花🌸", likes: 264 },
];

/* 正主下场时追加的楼层（点击“让正主下场”后揭示，属于番外操作）。 */
const STAR_FLOORS: Floor[] = [
  { u: "{n}（正主已认证）", badge: "正主", c: "……我我我我怎么真的划到这一层了。团队小妹把链接发我说“你自己看”。看到第一层烤肠我就绷不住了，那天真的超好吃，那根最焦的。谢谢你们把我的一个普通夜晚，说得这么温柔。", likes: 512, re: [
    { u: "夜市蹲点选手", c: "！！！！！！！正主真的来了？？？我我我手在抖（此刻正在原地螺旋）" },
    { u: "破防大学生", c: "姐姐我考研上岸了会回来还愿的，谢谢你那句‘没把自己弄丢’。" },
  ] },
  { u: "{n}（正主已认证）", badge: "正主", c: "看到有人担心我会飘、会被做成带货机器——放心。演戏是我唯一确定自己没弄丢的东西，这个我会攥紧。综艺尴尬就尴尬吧，我本来就不擅长（挠头）。会好好挑本子的，也会好好吃饭，答应你们。", likes: 488, re: [{ u: "偶尔清醒", c: "……姐你居然看到了这条。行，那我们就慢慢等你的好本子。" }] },
  { u: "{n}（正主已认证）", badge: "正主", c: "还有那些海外的朋友，翻译辛苦了，我看到有人边打字幕边哭，别哭啦，我给你们比个心。也谢谢一开始质疑我、后来认真看完剧的那几位——被认真看见，比被无脑夸更让我安心。晚安，都早点睡，别熬夜盖楼了。💗", likes: 531, re: [
    { u: "阴阳大师退散", c: "……被正主点名了。行，那封信确实封神，我彻底服了。" },
    { u: "野生翻译君", c: "先生我要哭第二次了。" },
  ] },
];

function buildForumHtml(star: string, extra: ForumExtra): string {
  const init = {
    star,
    name: extra.name || "星潮 · 追星广场",
    log: extra.log || [],
  };
  const initJson = JSON.stringify(init).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
    background: #f9fafb;
    color: #111827;
    display: flex;
    justify-content: center;
  }
  #root {
    width: 100%;
    max-width: 450px;
    height: 100%;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  /* 顶栏 */
  .bar { flex: 0 0 auto; padding: 16px; background: #ffffff; color: #111827; border-bottom: 1px solid #f3f4f6; }
  .bar .title { display: flex; align-items: center; gap: 8px; font-size: 20px; line-height: 1.4; font-weight: 700; }
  .bar .edit { margin-left: auto; font-size: 12px; line-height: 1.4; background: #f3f4f6; border: 0; color: #374151; padding: 4px 12px; border-radius: 999px; cursor: pointer; }
  .bar .sub { font-size: 12px; line-height: 1.4; color: #6b7280; margin-top: 8px; }
  .tabs { flex: 0 0 auto; display: flex; gap: 8px; padding: 8px 16px; background: #ffffff; border-bottom: 1px solid #f3f4f6; }
  .tab { flex: 1; text-align: center; font-size: 14px; line-height: 1.6; font-weight: 600; padding: 8px 0; border-radius: 8px; cursor: pointer; color: #6b7280; background: #f9fafb; border: 0; }
  .tab.on { background: #111827; color: #ffffff; }
  /* 滚动区 */
  .scroll { flex: 1 1 auto; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 16px 16px 24px; background: #f9fafb; }
  .scroll::-webkit-scrollbar { width: 4px; }
  .scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 2px; }
  /* 主楼 */
  .op { background: #ffffff; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .op h1 { font-size: 20px; line-height: 1.4; margin: 0 0 16px; color: #111827; }
  .op .who { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .op .body { font-size: 16px; line-height: 1.6; color: #374151; white-space: pre-wrap; }
  /* 楼层 */
  .floor { background: #ffffff; border-radius: 12px; padding: 16px; margin-bottom: 8px; border: 1px solid #f3f4f6; position: relative; }
  .floor .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .ava { width: 32px; height: 32px; border-radius: 50%; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 14px; font-weight: 700; }
  .nm { font-size: 14px; line-height: 1.6; font-weight: 600; color: #111827; }
  .badge { font-size: 12px; line-height: 1.4; padding: 2px 8px; border-radius: 8px; font-weight: 500; }
  .b-安利 { background: #fee2e2; color: #e11d48; }
  .b-CP { background: #f3e8ff; color: #7e22ce; }
  .b-路人 { background: #f3f4f6; color: #4b5563; }
  .b-代拍 { background: #e0f2fe; color: #2563eb; }
  .b-数据 { background: #d1fae5; color: #059669; }
  .b-黑 { background: #1f2937; color: #f9fafb; }
  .b-外 { background: #fef3c7; color: #d97706; }
  .b-正主 { background: linear-gradient(135deg,#fcd34d,#f59e0b); color: #78350f; }
  .fl-no { margin-left: auto; font-size: 12px; line-height: 1.4; color: #9ca3af; }
  .c { font-size: 14px; line-height: 1.6; color: #374151; white-space: pre-wrap; }
  .lang-tag { font-size: 12px; line-height: 1.4; color: #d97706; background: #fef3c7; padding: 2px 8px; border-radius: 8px; margin-left: 8px; }
  .orig { font-size: 14px; line-height: 1.6; color: #6b7280; font-style: italic; }
  .tr { display: none; margin-top: 8px; font-size: 14px; line-height: 1.6; color: #059669; background: #ecfdf5; border-left: 4px solid #10b981; padding: 8px 12px; border-radius: 0 8px 8px 0; }
  .tr.show { display: block; }
  .ops { display: flex; align-items: center; gap: 16px; margin-top: 16px; }
  .op-btn { font-size: 12px; line-height: 1.4; color: #6b7280; background: none; border: 0; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 0; }
  .op-btn.liked { color: #ef4444; font-weight: 600; }
  .re { margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6; }
  .re .item { font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 8px; }
  .re .item:last-child { margin-bottom: 0; }
  .re .rn { color: #111827; font-weight: 600; }
  .composer { margin-top: 16px; display: none; gap: 8px; }
  .composer.show { display: flex; }
  .composer input { flex: 1; font-size: 14px; line-height: 1.6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 16px; outline: none; }
  .composer button { font-size: 14px; line-height: 1.6; border: 0; background: #111827; color: #ffffff; border-radius: 8px; padding: 8px 16px; cursor: pointer; }
  .star-zone { text-align: center; margin: 16px 0 24px; }
  .star-btn { font-size: 16px; line-height: 1.6; font-weight: 700; color: #78350f; background: linear-gradient(135deg,#fcd34d,#f59e0b); border: 0; padding: 12px 32px; border-radius: 999px; cursor: pointer; box-shadow: 0 4px 12px rgba(245,158,11,.3); }
  .star-btn:disabled { opacity: .55; cursor: default; }
  .hint { text-align: center; font-size: 12px; line-height: 1.4; color: #9ca3af; margin-top: 8px; }
  /* 番外记录页 */
  .log-empty { text-align: center; color: #9ca3af; font-size: 14px; line-height: 1.6; margin-top: 48px; }
  .log-item { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 8px; font-size: 14px; line-height: 1.6; color: #374151; }
  .log-item .t { font-size: 12px; line-height: 1.4; color: #9ca3af; }
  .note { font-size: 12px; color: #6b7280; text-align: center; line-height: 1.4; margin: 8px 0 16px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6; }
  /* AI 状态条 / 加载 / 提示 */
  .status { flex: 0 0 auto; display: none; align-items: center; gap: 8px; padding: 8px 16px; background: #eff6ff; border-bottom: 1px solid #dbeafe; font-size: 12px; line-height: 1.4; color: #1d4ed8; }
  .status.show { display: flex; }
  .spin { width: 16px; height: 16px; border: 2px solid #bfdbfe; border-top-color: #2563eb; border-radius: 50%; animation: sp .8s linear infinite; flex: 0 0 auto; }
  @keyframes sp { to { transform: rotate(360deg); } }
  .loading { text-align: center; color: #9ca3af; font-size: 14px; line-height: 1.6; margin-top: 64px; }
  .loading .spin { margin: 0 auto 16px; width: 24px; height: 24px; border-width: 3px; }
  .more-btn { display: block; width: 100%; font-size: 14px; line-height: 1.6; font-weight: 600; color: #111827; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 0; margin: 8px 0 16px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .more-btn:disabled { opacity: .55; cursor: default; }
  .toast { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(16px); background: rgba(17,24,39,.9); color: #ffffff; font-size: 14px; line-height: 1.6; padding: 8px 24px; border-radius: 999px; opacity: 0; transition: opacity .25s, transform .25s; pointer-events: none; z-index: 20; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
</style>
</head>
<body>
<div id="root">
  <div class="bar">
    <div class="title"><span>💬</span><span id="forumName"></span><button class="edit" id="renameBtn">✎ 改名</button></div>
    <div class="sub">创作者可自定义论坛名 · 番外操作独立记忆，不影响正文剧情</div>
  </div>
  <div class="tabs">
    <button class="tab on" data-view="thread">🔥 热帖</button>
    <button class="tab" data-view="extra">🗂 我的番外</button>
  </div>
  <div class="status" id="statusBar"><span class="spin"></span><span id="statusMsg"></span></div>
  <div class="scroll" id="scroll"></div>
  <div class="toast" id="toast"></div>
</div>
<script>
(function(){
  var INIT = ${initJson};
  var STAR = INIT.star;
  var forumName = INIT.name;
  var log = Array.isArray(INIT.log) ? INIT.log.slice() : [];
  var liked = {};       // floorIndex -> bool
  var likeDelta = {};   // floorIndex -> extra likes
  var userReplies = {}; // floorIndex -> [text]
  var starDown = false;
  var view = "thread";

  // —— 内容由父级（React + AI）通过 postMessage 注入 ——
  var op = null;        // 主楼
  var floors = [];      // 全部楼层（含正主下场后追加的）
  var aiMode = false;   // 是否 AI 联动模式
  var busy = false;     // 是否正在生成
  var loaded = false;   // 首帖是否已到达

  function fill(s){ return String(s).replace(/\\{n\\}/g, STAR); }
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  var COLORS = ["#fb5a5f","#ff8aa0","#8a4fd6","#3f7fd0","#2e9d7a","#c9902a","#e0405a","#5aa0d6","#d67fae"];
  function colorFor(name){ var h=0; for(var i=0;i<name.length;i++){h=(h*31+name.charCodeAt(i))>>>0;} return COLORS[h%COLORS.length]; }

  function pushLog(text){
    log.unshift("["+new Date().toLocaleString("zh-CN",{hour12:false})+"] "+text);
    persist();
  }
  function persist(){
    try { window.parent.postMessage({ __forum:true, name: forumName, log: log }, "*"); } catch(e){}
  }

  function scroll(){ return document.getElementById("scroll"); }
  function allFloors(){ return floors; }

  var toastTimer = null;
  function toast(msg){
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 2200);
  }
  function setStatus(b, msg){
    busy = b;
    var bar = document.getElementById("statusBar");
    document.getElementById("statusMsg").textContent = msg || "";
    if (b) bar.classList.add("show"); else bar.classList.remove("show");
    if (view === "thread") { var mb = document.getElementById("moreBtn"); if (mb) mb.disabled = b; var sb = document.getElementById("starBtn"); if (sb && !starDown) sb.disabled = b; }
  }

  function renderThread(){
    var el = scroll();
    if (!loaded){
      el.innerHTML = '<div class="loading"><div class="spin"></div>正在为你连接论坛…<br/>' + (aiMode ? 'AI 正依据当前剧情写帖子🌸' : '加载中🌸') + '</div>';
      return;
    }
    var html = "";
    html += '<div class="op">';
    html += '<div class="who"><span class="ava" style="background:'+colorFor(op.u)+'">'+esc(op.u[0])+'</span><span class="nm">'+esc(op.u)+'</span><span class="badge b-安利">楼主</span></div>';
    html += '<h1>'+esc(fill(op.title))+'</h1>';
    html += '<div class="body">'+esc(fill(op.c))+'</div>';
    html += '</div>';

    var fs = allFloors();
    for (var i=0;i<fs.length;i++){
      html += renderFloor(fs[i], i);
    }

    // AI 盖楼（增量续写，只在 AI 模式出现）
    if (aiMode){
      html += '<button class="more-btn" id="moreBtn"'+(busy?' disabled':'')+'>'+(busy?'AI 正在盖楼…':'＋ 加载更多楼层（AI 盖楼）')+'</button>';
    }

    // 正主下场按钮
    html += '<div class="star-zone">';
    html += '<button class="star-btn" id="starBtn"'+(starDown||busy?' disabled':'')+'>'+(starDown?'✅ 正主已下场':'👑 让正主下场')+'</button>';
    html += '<div class="hint">'+(starDown?'正主的回复已追加在楼层末尾':(aiMode?'点一下，正主会以本人身份亲自回帖～（属于番外操作）':'点一下，看看正主会不会亲自回帖～（属于番外操作）'))+'</div>';
    html += '</div>';

    el.innerHTML = html;
    bindThread();
  }

  function renderFloor(f, i){
    var no = i+1;
    var extraLikes = likeDelta[i]||0;
    var isLiked = !!liked[i];
    var h = '<div class="floor" data-i="'+i+'">';
    h += '<div class="head">';
    h += '<span class="ava" style="background:'+colorFor(f.u)+'">'+esc(fill(f.u)[0])+'</span>';
    h += '<span class="nm">'+esc(fill(f.u))+'</span>';
    h += '<span class="badge b-'+f.badge+'">'+f.badge+'</span>';
    if (f.lang) h += '<span class="lang-tag">'+f.lang+'</span>';
    h += '<span class="fl-no">'+no+'楼</span>';
    h += '</div>';
    if (f.lang && f.tr){
      h += '<div class="orig">'+esc(fill(f.c))+'</div>';
      h += '<div class="tr" data-tr="'+i+'">🌐 '+esc(fill(f.tr))+'</div>';
    } else {
      h += '<div class="c">'+esc(fill(f.c))+'</div>';
    }
    // 楼中楼（原始回复 + 用户番外回复）
    var reHtml = "";
    if (f.re && f.re.length){
      for (var k=0;k<f.re.length;k++){ reHtml += '<div class="item"><span class="rn">'+esc(fill(f.re[k].u))+'：</span>'+esc(fill(f.re[k].c))+'</div>'; }
    }
    if (userReplies[i]){
      for (var m=0;m<userReplies[i].length;m++){ reHtml += '<div class="item"><span class="rn">'+esc(STAR)+'（正主）：</span>'+esc(userReplies[i][m])+'</div>'; }
    }
    if (reHtml) h += '<div class="re">'+reHtml+'</div>';
    // 操作条
    h += '<div class="ops">';
    h += '<button class="op-btn like'+(isLiked?' liked':'')+'" data-like="'+i+'">'+(isLiked?'❤️':'🤍')+' <span>'+(f.likes+extraLikes)+'</span></button>';
    h += '<button class="op-btn" data-reply="'+i+'">💬 以正主身份回复</button>';
    if (f.lang && f.tr) h += '<button class="op-btn" data-toggle="'+i+'">🌐 翻译</button>';
    h += '</div>';
    h += '<div class="composer" data-comp="'+i+'"><input type="text" placeholder="以「'+esc(STAR)+'」的身份，温柔地回一句…" maxlength="80" /><button data-send="'+i+'">发送</button></div>';
    h += '</div>';
    return h;
  }

  function bindThread(){
    var el = scroll();
    el.querySelectorAll("[data-like]").forEach(function(b){
      b.addEventListener("click", function(){
        var i = +b.getAttribute("data-like");
        if (liked[i]){ liked[i]=false; likeDelta[i]=(likeDelta[i]||0)-1; }
        else { liked[i]=true; likeDelta[i]=(likeDelta[i]||0)+1; var fs=allFloors(); pushLog("点赞了 "+fill(fs[i].u)+" 的 "+(i+1)+"楼"); }
        renderThread();
      });
    });
    el.querySelectorAll("[data-toggle]").forEach(function(b){
      b.addEventListener("click", function(){
        var i = b.getAttribute("data-toggle");
        var t = el.querySelector('[data-tr="'+i+'"]');
        if (t) t.classList.toggle("show");
      });
    });
    el.querySelectorAll("[data-reply]").forEach(function(b){
      b.addEventListener("click", function(){
        var i = b.getAttribute("data-reply");
        var c = el.querySelector('[data-comp="'+i+'"]');
        if (c){ c.classList.toggle("show"); var inp=c.querySelector("input"); if(inp) inp.focus(); }
      });
    });
    el.querySelectorAll("[data-send]").forEach(function(b){
      b.addEventListener("click", function(){
        var i = +b.getAttribute("data-send");
        var c = el.querySelector('[data-comp="'+i+'"]');
        var inp = c.querySelector("input");
        var v = (inp.value||"").trim();
        if (!v) return;
        if (!userReplies[i]) userReplies[i]=[];
        userReplies[i].push(v);
        var fs=allFloors();
        pushLog("以正主身份回复了 "+(i+1)+"楼："+v);
        renderThread();
      });
    });
    var mb = document.getElementById("moreBtn");
    if (mb) mb.addEventListener("click", function(){
      if (busy) return;
      req("more");
    });
    var sb = document.getElementById("starBtn");
    if (sb) sb.addEventListener("click", function(){
      if (starDown || busy) return;
      pushLog("选择了「正主下场」——正主亲自回帖");
      req("star");
    });
  }

  function req(kind){ try { window.parent.postMessage({ __forum_req: kind }, "*"); } catch(e){} }

  function renderExtra(){
    var el = scroll();
    var h = '<div class="note">这里只记录你在论坛里的「番外操作」（点赞 / 回帖 / 正主下场 / 改名）。<br/>它与正文剧情记忆完全分割、互不影响，也不会写进记事本。</div>';
    if (!log.length){
      h += '<div class="log-empty">还没有任何番外操作～<br/>去热帖点个赞、回一句，或让正主下场试试吧🌸</div>';
    } else {
      for (var i=0;i<log.length;i++){
        var s = log[i];
        var idx = s.indexOf("]");
        var t = idx>0 ? s.slice(1, idx) : "";
        var body = idx>0 ? s.slice(idx+1).trim() : s;
        h += '<div class="log-item">'+esc(body)+'<div class="t">'+esc(t)+'</div></div>';
      }
    }
    el.innerHTML = h;
  }

  function render(){
    document.getElementById("forumName").textContent = forumName;
    if (view === "thread") renderThread(); else renderExtra();
  }

  // 顶栏 / 标签事件
  document.getElementById("renameBtn").addEventListener("click", function(){
    var v = prompt("给这个论坛起个名字（创作者自定义）：", forumName);
    if (v && v.trim()){ forumName = v.trim().slice(0,20); pushLog("把论坛名改成了「"+forumName+"」"); document.getElementById("forumName").textContent = forumName; }
  });
  document.querySelectorAll(".tab").forEach(function(t){
    t.addEventListener("click", function(){
      document.querySelectorAll(".tab").forEach(function(x){x.classList.remove("on");});
      t.classList.add("on");
      view = t.getAttribute("data-view");
      scroll().scrollTop = 0;
      render();
    });
  });

  // —— 接收父级（AI）注入的内容 ——
  window.addEventListener("message", function(e){
    var d = e.data || {};
    if (d.__forum_set){
      op = d.op; floors = Array.isArray(d.floors) ? d.floors.slice() : [];
      aiMode = !!d.ai; loaded = true;
      if (d.err) toast(d.err);
      if (view === "thread") renderThread();
      return;
    }
    if (d.__forum_add){
      var keepScroll = scroll().scrollTop;
      var add = Array.isArray(d.floors) ? d.floors : [];
      floors = floors.concat(add);
      if (d.star) starDown = true;
      if (view === "thread"){
        renderThread();
        if (d.star) setTimeout(function(){ scroll().scrollTop = scroll().scrollHeight; }, 60);
        else scroll().scrollTop = keepScroll;
      }
      return;
    }
    if (d.__forum_status){ setStatus(!!d.busy, d.msg); return; }
    if (d.__forum_toast){ toast(d.msg || ""); return; }
  });

  render();
  req("ready");
})();
</script>
</body>
</html>`;
}
