/* 老板直聘 —— 仿真招聘 App。进入先选身份：我要找工作（求职者）/ 我要招人（企业）。
 * 视觉自绘、内容全部虚构。求职端职位来自游戏内 8 家经纪公司（签约艺人 + 幕后/运营真实岗位）；
 * 企业端你以「工作室」身份发布职位、翻牌候选艺人。薪资/门槛按公司声望确定性推导，不结算真实数值。 */
import { useMemo, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { COMPANIES, companyMeta } from "../../worlds/star2005/content";
import { STAT_LABELS, STAT_ORDER } from "../../game/data";
import { Avatar } from "../ui";
import { IconSearch, IconChevron } from "./icons";

const ACCENT = "#0f9e94";
const ROLE_KEY = "bosspin.role";
type Role = "seeker" | "employer";

/* ───────────────── 岗位数据 ───────────────── */
type Boss = { name: string; title: string; age: number; style: string; quote: string; bio: string };
type Job = {
  id: string;
  kind: "artist" | "crew";
  cat: "艺人" | "幕后" | "运营";
  companyId: string;
  company: string;
  boss: Boss;
  title: string;
  salary: string;
  area: string;
  exp: string;
  edu: string;
  tags: string[];
  fameReq: number; // 仅艺人岗
  duties: string[];
  reqs: string[];
};

const AREAS = ["星城·云台区", "星城·滨江新区", "星城·老城厢", "星城·影视基地", "星城·文创园"];
const fallbackBoss: Boss = { name: "招聘负责人", title: "HR", age: 38, style: "务实", quote: "先聊聊，看合不合适。", bio: "" };

type CrewTpl = { key: string; title: string; cat: "幕后" | "运营"; salary: string; exp: string; edu: string; tags: string[]; duties: string[]; reqs: string[] };
const CREW: CrewTpl[] = [
  { key: "assist", title: "艺人私人助理", cat: "运营", salary: "3-5千/月", exp: "经验不限", edu: "大专", tags: ["包食宿", "五险", "跟组"], duties: ["安排艺人日常行程与通告接送", "对接剧组、化妆、宣传等各方", "处理证件、机票、酒店等事务"], reqs: ["细心负责、抗压能力强", "能适应不规律作息与出差", "会开车者优先"] },
  { key: "pr", title: "宣传企划专员", cat: "运营", salary: "4-7千/月", exp: "1-3年", edu: "本科", tags: ["双休", "五险一金", "带项目"], duties: ["策划艺人及作品的宣传物料与话题", "维护媒体、平台与合作方关系", "撰写通稿、跟进热搜与投放"], reqs: ["文案功底扎实、熟悉娱乐生态", "有媒体或公关资源者优先", "反应快、执行力强"] },
  { key: "makeup", title: "妆发造型师", cat: "幕后", salary: "5-9千/月", exp: "2年以上", edu: "不限", tags: ["跟组", "作品分成", "包住"], duties: ["负责艺人妆容与发型设计", "配合造型总监完成整体风格", "现场随时补妆、保持状态"], reqs: ["精通影视/舞台妆", "有代表作或艺人合作经历", "审美在线、手速快"] },
  { key: "photo", title: "摄影摄像", cat: "幕后", salary: "6千-1万/月", exp: "2-4年", edu: "不限", tags: ["器材齐全", "项目奖金"], duties: ["拍摄写真、物料、幕后花絮", "配合宣传节奏产出成片", "基础调色与素材整理"], reqs: ["熟练使用专业相机与灯光", "有人像/时尚拍摄经验", "有个人作品集"] },
  { key: "editor", title: "后期剪辑", cat: "幕后", salary: "5-8千/月", exp: "1-3年", edu: "大专", tags: ["弹性工时", "五险"], duties: ["剪辑物料、预告与短视频", "配合宣传产出适配各平台内容", "基础包装与字幕"], reqs: ["精通 Premiere / AE", "节奏感与叙事感俱佳", "能扛短周期交付"] },
  { key: "writer", title: "编剧 / 编审", cat: "幕后", salary: "8千-1.5万/月", exp: "3年以上", edu: "本科", tags: ["署名", "版权分成"], duties: ["剧本创作、改稿与围读", "把控人物与剧情逻辑", "配合导演与制片调整"], reqs: ["有已播出/上映作品", "文字功底与结构能力强", "耐得住长线创作"] },
  { key: "vocal", title: "声乐老师", cat: "幕后", salary: "6千-1万/月", exp: "3年以上", edu: "本科（音乐类）", tags: ["课时费", "带练习生"], duties: ["为练习生/艺人做声乐训练", "制定阶段性教学计划", "配合团体出道备赛"], reqs: ["科班出身、教学经验丰富", "能因材施教、有耐心", "有学员成材案例优先"] },
  { key: "dance", title: "舞蹈老师", cat: "幕后", salary: "6千-1万/月", exp: "2年以上", edu: "不限", tags: ["课时费", "编舞奖金"], duties: ["编舞与舞蹈基本功教学", "配合舞台与 MV 排练", "把控团体队形与整齐度"], reqs: ["舞种功底扎实、能编能教", "有舞台或团体经验", "体能好、示范能力强"] },
  { key: "manager", title: "经纪人助理", cat: "运营", salary: "5-8千/月", exp: "1-3年", edu: "本科", tags: ["五险一金", "晋升快"], duties: ["协助经纪人对接资源与谈判", "维护艺人档期与合同事务", "跟进项目落地"], reqs: ["沟通谈判能力强、情商高", "熟悉行业规则", "能扛事、守得住秘密"] },
  { key: "social", title: "新媒体运营", cat: "运营", salary: "4-7千/月", exp: "经验不限", edu: "大专", tags: ["双休", "内容奖金"], duties: ["运营艺人官方账号矩阵", "策划日常内容与互动", "监测数据、优化涨粉"], reqs: ["熟悉各大内容平台玩法", "有账号从 0 做起的经验优先", "网感好、会追热点"] },
  { key: "fans", title: "粉丝运营", cat: "运营", salary: "4-6千/月", exp: "经验不限", edu: "大专", tags: ["带团队", "活动奖金"], duties: ["维护官方后援会与粉丝社群", "组织应援、生日会等活动", "引导粉丝氛围、处理舆情"], reqs: ["熟悉饭圈文化、共情力强", "组织协调能力好", "情绪稳定、有分寸"] },
  { key: "event", title: "活动执行", cat: "运营", salary: "4-7千/月", exp: "1-3年", edu: "大专", tags: ["项目制", "出差补贴"], duties: ["统筹发布会、红毯、见面会执行", "对接场地、供应商与流程", "现场把控与应急处理"], reqs: ["细致、抗压、擅长多线程", "有大型活动执行经验", "能接受不定时加班"] },
];

function artistTitle(prestige: number): string {
  return prestige >= 72 ? "签约当红艺人 · 一线咖位"
    : prestige >= 56 ? "签约艺人 · 重点资源位"
    : prestige >= 42 ? "签约新人 · 重点培养" : "签约练习生 / 新人艺人";
}
function makeArtistJob(companyId: string, prestige: number, i: number): Job {
  const meta = companyMeta(companyId);
  const boss = meta.boss ?? fallbackBoss;
  const low = Math.max(1, Math.round(prestige * 0.4));
  const high = Math.round(prestige * 1.1);
  const fameReq = Math.max(0, Math.round(prestige * 1.35 - 28));
  return {
    id: `art_${companyId}`,
    kind: "artist", cat: "艺人",
    companyId, company: meta.name, boss,
    title: artistTitle(prestige),
    salary: prestige >= 56 ? `保底 ${low}万/月 · 项目分成` : `保底 ${low}-${high}千/月 · 通告分成`,
    area: AREAS[i % AREAS.length],
    exp: "新人可投", edu: "形象气质佳",
    tags: [prestige >= 60 ? "重点捧" : "长线培养", "艺人经纪", `声望${prestige}`],
    fameReq,
    duties: ["按公司规划参与影视/音乐/综艺等项目", "配合宣传、通告与商务活动", "持续打磨专业能力与舞台表现"],
    reqs: [`名气达到 ${fameReq} 以上者优先`, "肯吃苦、可塑性强、无不良记录", "认同公司培养方向与合约条款"],
  };
}
function makeCrewJob(tpl: CrewTpl, companyId: string, i: number): Job {
  const meta = companyMeta(companyId);
  const boss = meta.boss ?? fallbackBoss;
  return {
    id: `crew_${tpl.key}`,
    kind: "crew", cat: tpl.cat,
    companyId, company: meta.name, boss,
    title: tpl.title, salary: tpl.salary, area: AREAS[i % AREAS.length],
    exp: tpl.exp, edu: tpl.edu, tags: tpl.tags, fameReq: 0,
    duties: tpl.duties, reqs: tpl.reqs,
  };
}

/* ───────────────── 老板回复（求职端）───────────────── */
const GREETS = ["您好，我对这个职位很感兴趣～", "我的条件符合要求吗？", "方便介绍下具体工作/培养吗？"];
function bossReply(job: Job, greet: string, fame: number): string {
  const s = job.boss.style;
  if (greet === GREETS[0]) {
    if (job.kind === "crew") return `你好，${job.company}这个「${job.title}」正缺人。方便发下简历/作品，我们约个时间面聊。`;
    if (s.includes("铁腕") || s.includes("挑剔") || s.includes("严")) return `${job.boss.quote}\n进${job.company}规矩不能破，你有底子的话，我们不缺资源。`;
    if (s.includes("商") || s.includes("激进") || s.includes("弄潮")) return `好眼光。${job.company}最会把人推上风口，就看你敢不敢接住这波流量。`;
    return `${job.boss.quote}\n${job.company}不玩虚的，来了我把你当自家人带。`;
  }
  if (greet === GREETS[1]) {
    if (job.kind === "crew") return `${job.exp}、${job.edu}起。有相关经验和作品就好谈，薪资 ${job.salary}，具体看能力定。`;
    if (fame >= job.fameReq) return `你现在名气 ${fame}，够了。这个位子（门槛 ${job.fameReq}）给你留着，什么时候方便过来签？`;
    return `实话说门槛 ${job.fameReq}，你现在 ${fame}，还差 ${job.fameReq - fame}。再攒攒名气，我这门随时开着。`;
  }
  if (job.kind === "crew") return `主要负责：${job.duties[0]}。做得好有项目奖金，团队年轻、上手快，来了不会亏待你。`;
  if (s.includes("教") || s.includes("学院") || s.includes("儒雅")) return "不急着捧。先打磨基本功，慢工出细活，十年磨一戏。";
  if (s.includes("偶像") || s.includes("团")) return "进训练室系统培养，练不出来不上台——练出来了，出道那天你会哭。";
  return `资源主攻影视线，${job.salary}。前期我亲自跟，帮你把第一个代表作立起来。`;
}

/* ───────────────── 候选人回复（企业端）───────────────── */
const EMP_GREETS = ["你好，看了你的资料，很合适～", "有兴趣加入我的工作室吗？", "期望的资源/待遇是？"];
function candidateReply(fame: number, personality: string, greet: string, studio: string, myFame: number): string {
  const bigshot = fame > myFame * 1.4 + 60;
  if (greet === EMP_GREETS[0]) {
    if (bigshot) return "谢谢抬爱。不过我这边档期排得比较满，得看看具体是什么资源。";
    return `${personality.includes("高冷") ? "嗯，" : "谢谢！"}我确实在看新机会，${studio}是做什么方向的呀？`;
  }
  if (greet === EMP_GREETS[1]) {
    if (bigshot) return `${studio}我有耳闻。诚意够的话可以谈，但合约细节我得让团队把关。`;
    return "有兴趣的！只要资源靠谱、待人真诚，我不怕从头拼。";
  }
  if (bigshot) return "资源要能进主流项目，分成也得对得起我现在的咖位，其余好说。";
  return "待遇能保底、有作品机会就行，我更看重能不能被好好培养。";
}

/* ───────────────── 通用聊天视图 ───────────────── */
type Msg = { from: "peer" | "me"; text: string };
function ChatView({ peerName, peerSub, peerAvatarName, meName, meAvatar, opener, greets, reply, actionLabel, onAction, onBack }: {
  peerName: string; peerSub: string; peerAvatarName: string; meName: string; meAvatar: string;
  opener: string; greets: string[]; reply: (g: string) => string; actionLabel: string; onAction: () => string; onBack: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "peer", text: opener }]);
  const [used, setUsed] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const send = (g: string) => {
    setUsed((u) => [...u, g]);
    setMsgs((m) => [...m, { from: "me", text: g }]);
    setTimeout(() => setMsgs((m) => [...m, { from: "peer", text: reply(g) }]), 420);
  };
  const act = () => {
    if (done) return;
    setDone(true);
    const echo = actionLabel.replace(/·.*/, "").trim();
    setMsgs((m) => [...m, { from: "me", text: `【${echo}】` }]);
    setTimeout(() => setMsgs((m) => [...m, { from: "peer", text: onAction() }]), 460);
  };
  const remaining = greets.filter((g) => !used.includes(g));
  return (
    <div className="flex h-full flex-col bg-[#f2f3f5]">
      <div className="flex items-center border-b border-black/5 bg-white px-3 py-2.5">
        <button onClick={onBack} className="flex items-center text-[14px] text-ink-soft"><IconChevron size={16} className="rotate-180" /></button>
        <div className="flex-1 text-center">
          <p className="text-[15px] font-semibold text-ink">{peerName}</p>
          <p className="text-[11px] text-ink-soft">{peerSub} · 在线</p>
        </div>
        <span className="w-6" />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.from === "me" ? "flex-row-reverse" : ""}`}>
            <Avatar src={m.from === "me" ? meAvatar : ""} name={m.from === "me" ? meName : peerAvatarName} size={32} editable={false} />
            <div className={`max-w-[74%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13.5px] leading-snug ${m.from === "me" ? "text-white" : "bg-white text-ink ring-1 ring-black/5"}`} style={m.from === "me" ? { background: ACCENT } : undefined}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-black/5 bg-white px-3 py-2.5">
        <div className="flex flex-wrap gap-2">
          {remaining.map((g) => (
            <button key={g} onClick={() => send(g)} className="rounded-full bg-black/[0.05] px-3 py-1.5 text-[12.5px] text-ink">{g}</button>
          ))}
          <button onClick={act} disabled={done} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-45" style={{ background: ACCENT }}>
            {done ? "已发送" : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── 身份选择页 ───────────────── */
function RoleChooser({ onBack, onPick }: { onBack: () => void; onPick: (r: Role) => void }) {
  return (
    <div className="flex h-full flex-col" style={{ background: `linear-gradient(160deg, ${ACCENT}, #0a6f68)` }}>
      <div className="px-4 pt-3"><button onClick={onBack} className="text-[14px] text-white/85">‹ 主屏</button></div>
      <div className="flex flex-1 flex-col justify-center px-7">
        <p className="text-[28px] font-black text-white">老板直聘</p>
        <p className="mt-1 text-[13.5px] text-white/85">找工作 / 招人，都来直接谈</p>
        <p className="mt-8 text-[13px] font-medium text-white/90">请选择你的身份</p>
        <button onClick={() => onPick("seeker")} className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-full text-[20px]" style={{ background: "#e3f6f2" }}>🙋‍♀️</span>
          <div className="flex-1"><p className="text-[16px] font-bold text-ink">我要找工作</p><p className="text-[12px] text-ink-soft">浏览岗位，直接和老板聊</p></div>
          <IconChevron size={18} />
        </button>
        <button onClick={() => onPick("employer")} className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-full text-[20px]" style={{ background: "#fdf0d9" }}>💼</span>
          <div className="flex-1"><p className="text-[16px] font-bold text-ink">我要招人</p><p className="text-[12px] text-ink-soft">发布职位，翻牌心仪的候选人</p></div>
          <IconChevron size={18} />
        </button>
        <p className="mt-6 text-center text-[11px] text-white/70">身份可随时在「我的」里切换</p>
      </div>
    </div>
  );
}

/* ───────────────── 岗位卡 & 详情（求职端）───────────────── */
function JobCard({ job, fame, onOpen }: { job: Job; fame: number; onOpen: () => void }) {
  const artistOk = job.kind === "artist" && fame >= job.fameReq;
  return (
    <button onClick={onOpen} className="mx-3 mb-2.5 block w-[calc(100%-1.5rem)] rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15.5px] font-semibold text-ink">{job.title}</p>
        <span className="shrink-0 text-[13.5px] font-bold" style={{ color: ACCENT }}>{job.salary.split(" · ")[0]}</span>
      </div>
      <p className="mt-1 text-[11.5px] text-ink-soft">{job.area} · {job.exp} · {job.edu}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {job.tags.map((t) => <span key={t} className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[11px] text-ink-soft">{t}</span>)}
        {job.kind === "artist" && (
          <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: artistOk ? "#dcf5ee" : "#fdeaea", color: artistOk ? "#0a7d5f" : "#e5484d" }}>
            {artistOk ? "名气达标 ✓" : `名气门槛 ${job.fameReq}`}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2.5 border-t border-black/[0.06] pt-2.5">
        <Avatar src="" name={job.boss.name} size={30} editable={false} />
        <p className="min-w-0 flex-1 truncate text-[12px] text-ink-soft">{job.boss.name} · {job.boss.title} · {job.company}</p>
        <span className="shrink-0 text-[12px] font-semibold" style={{ color: ACCENT }}>沟通 ›</span>
      </div>
    </button>
  );
}
function JobDetail({ job, fame, onChat, onBack }: { job: Job; fame: number; onChat: () => void; onBack: () => void }) {
  const artistOk = job.kind === "artist" && fame >= job.fameReq;
  return (
    <div className="flex h-full flex-col bg-[#f2f3f5]">
      <div className="flex items-center border-b border-black/5 bg-white px-3 py-2.5">
        <button onClick={onBack} className="flex items-center text-[14px] text-ink-soft"><IconChevron size={16} className="rotate-180" /> 返回</button>
        <span className="flex-1 text-center text-[15px] font-semibold text-ink">职位详情</span><span className="w-12" />
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="bg-white px-4 py-4">
          <div className="flex items-start justify-between">
            <p className="text-[18px] font-bold text-ink">{job.title}</p>
            <span className="text-[16px] font-bold" style={{ color: ACCENT }}>{job.salary.split(" · ")[0]}</span>
          </div>
          <p className="mt-1 text-[12px] text-ink-soft">{job.area} · {job.exp} · {job.edu}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.tags.map((t) => <span key={t} className="rounded-md bg-black/[0.05] px-2 py-0.5 text-[11.5px] text-ink-soft">{t}</span>)}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 bg-white px-4 py-3">
          <Avatar src="" name={job.boss.name} size={40} editable={false} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ink">{job.boss.name} · {job.boss.title}</p>
            <p className="truncate text-[12px] text-ink-soft">{job.company} · {job.boss.style}</p>
          </div>
        </div>
        <div className="mt-2 bg-white px-4 py-4">
          <p className="text-[14px] font-semibold text-ink">岗位职责</p>
          <ul className="mt-2 space-y-1.5">{job.duties.map((d, i) => <li key={i} className="flex gap-2 text-[13px] leading-snug text-ink/85"><span style={{ color: ACCENT }}>·</span>{d}</li>)}</ul>
          <p className="mt-4 text-[14px] font-semibold text-ink">任职要求</p>
          <ul className="mt-2 space-y-1.5">{job.reqs.map((d, i) => <li key={i} className="flex gap-2 text-[13px] leading-snug text-ink/85"><span style={{ color: ACCENT }}>·</span>{d}</li>)}</ul>
          {job.kind === "artist" && (
            <p className={`mt-4 rounded-lg px-3 py-2 text-[12.5px] ${artistOk ? "text-emerald-700" : "text-rose-600"}`} style={{ background: artistOk ? "#dcf5ee" : "#fdeaea" }}>
              {artistOk ? `你当前名气 ${fame}，已达签约门槛 ${job.fameReq}。` : `签约门槛 ${job.fameReq}，你当前名气 ${fame}，还差 ${job.fameReq - fame}。`}
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-black/5 bg-white p-3">
        <button onClick={onChat} className="w-full rounded-full py-2.5 text-[15px] font-semibold text-white" style={{ background: ACCENT }}>立即沟通</button>
      </div>
    </div>
  );
}

/* ───────────────── 求职端 ───────────────── */
function SeekerApp({ jobs, fame, playerName, playerAvatar, desc, stats, onBack, onSwitch }: {
  jobs: Job[]; fame: number; playerName: string; playerAvatar: string; desc: string; stats: Record<string, number>; onBack: () => void; onSwitch: () => void;
}) {
  const [tab, setTab] = useState<"jobs" | "msg" | "me">("jobs");
  const [cat, setCat] = useState<"推荐" | "艺人" | "幕后" | "运营">("推荐");
  const [detail, setDetail] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);

  const job = (id: string | null) => jobs.find((j) => j.id === id);
  if (chat) {
    const j = job(chat);
    if (j) return <ChatView
      peerName={j.boss.name} peerSub={`${j.company} · ${j.title}`} peerAvatarName={j.boss.name}
      meName={playerName} meAvatar={playerAvatar}
      opener={`我是${j.company}的${j.boss.name}。${j.kind === "artist" ? j.boss.quote : `「${j.title}」还在招，你的情况方便说说吗？`}`}
      greets={GREETS} reply={(g) => bossReply(j, g, fame)}
      actionLabel="投递简历 · 申请"
      onAction={() => (j.kind === "artist" ? (fame >= j.fameReq ? `简历收到，条件不错。我让助理拟合同，改天约你到${j.company}详谈。` : `简历先留下了，等你名气到 ${j.fameReq}，我第一个签你。`) : `简历收到，${j.title}这边我们尽快安排面试，保持手机畅通。`)}
      onBack={() => setChat(null)} />;
  }
  if (detail) {
    const j = job(detail);
    if (j) return <JobDetail job={j} fame={fame} onBack={() => setDetail(null)} onChat={() => { setVisited((v) => v.includes(j.id) ? v : [...v, j.id]); setChat(j.id); setDetail(null); }} />;
  }

  const shown = jobs.filter((j) => cat === "推荐" ? true : j.cat === cat);
  const top = [...STAT_ORDER].sort((a, b) => (stats[b] ?? 0) - (stats[a] ?? 0)).slice(0, 4);

  return (
    <div className="flex h-full flex-col bg-[#f2f3f5]">
      <div className="bg-white px-4 pb-2.5 pt-3">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-[14px] text-ink-soft">‹ 主屏</button>
          <p className="text-[15px] font-bold" style={{ color: ACCENT }}>老板直聘 · 求职</p>
          <span className="text-[13px] text-ink-soft">星城 ▾</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 rounded-full bg-black/[0.05] px-3.5 py-2 text-ink-soft">
          <IconSearch size={16} /><span className="text-[13px]">搜索职位 · 经纪公司</span>
        </div>
      </div>

      {tab === "jobs" && (
        <>
          <div className="flex gap-2 bg-white px-4 pb-2.5">
            {(["推荐", "艺人", "幕后", "运营"] as const).map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${cat === c ? "text-white" : "bg-black/[0.05] text-ink-soft"}`} style={cat === c ? { background: ACCENT } : undefined}>{c}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto py-2.5">
            {shown.map((j) => <JobCard key={j.id} job={j} fame={fame} onOpen={() => setDetail(j.id)} />)}
          </div>
        </>
      )}

      {tab === "msg" && (
        <div className="flex-1 overflow-y-auto py-1">
          {visited.length === 0
            ? <p className="px-6 py-16 text-center text-[13px] text-ink-soft">还没有沟通记录，去「职位」页找老板聊聊吧。</p>
            : visited.map((id) => { const j = job(id)!; return (
                <button key={id} onClick={() => setChat(id)} className="flex w-full items-center gap-3 border-b border-black/[0.05] bg-white px-4 py-3 text-left">
                  <Avatar src="" name={j.boss.name} size={44} editable={false} />
                  <div className="min-w-0 flex-1"><p className="text-[14px] font-medium text-ink">{j.boss.name} · {j.boss.title}</p><p className="truncate text-[12px] text-ink-soft">{j.company} · {j.title}</p></div>
                  <IconChevron size={16} />
                </button>); })}
        </div>
      )}

      {tab === "me" && (
        <div className="flex-1 overflow-y-auto bg-[#f2f3f5] pb-4">
          <div className="px-4 pb-5 pt-6 text-white" style={{ background: `linear-gradient(135deg, ${ACCENT}, #0a6f68)` }}>
            <div className="flex items-center gap-3">
              <Avatar src={playerAvatar} name={playerName} size={56} editable={false} />
              <div><p className="text-[18px] font-semibold">{playerName}</p><p className="text-[12.5px] text-white/85">求职意向 · 签约艺人</p></div>
            </div>
            <div className="mt-4 flex gap-6">
              <div><p className="text-[19px] font-bold">{fame}</p><p className="text-[11px] text-white/80">当前名气</p></div>
              <div><p className="text-[19px] font-bold">在找</p><p className="text-[11px] text-white/80">求职状态</p></div>
              <div><p className="text-[19px] font-bold">星城</p><p className="text-[11px] text-white/80">意向城市</p></div>
            </div>
          </div>
          <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-[13.5px] font-semibold text-ink">个人优势</p>
            <div className="mt-3 space-y-2.5">
              {top.map((k) => { const v = stats[k] ?? 0; return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-14 text-[12.5px] text-ink-soft">{STAT_LABELS[k as keyof typeof STAT_LABELS]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, v)}%`, background: ACCENT }} /></div>
                  <span className="w-7 text-right text-[12px] tabular-nums text-ink-soft">{v}</span>
                </div>); })}
            </div>
          </div>
          <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-[13.5px] font-semibold text-ink">自我介绍</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{desc || "怀揣着成为主角的梦想，正在星城寻找愿意栽培的经纪公司。台前幕后都肯学，能吃苦，等一个被看见的机会。"}</p>
          </div>
          <button onClick={onSwitch} className="mx-3 mt-3 w-[calc(100%-1.5rem)] rounded-2xl border py-2.5 text-[13.5px] font-medium" style={{ borderColor: ACCENT, color: ACCENT }}>切换为「我要招人」</button>
        </div>
      )}

      <div className="flex border-t border-black/5 bg-white">
        {(["jobs", "msg", "me"] as const).map((id) => (
          <button key={id} onClick={() => setTab(id)} className="flex-1 py-2.5 text-[12px] font-medium" style={{ color: tab === id ? ACCENT : "#9aa0a6" }}>
            {id === "jobs" ? "职位" : id === "msg" ? "消息" : "我的"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── 企业端 ───────────────── */
type Posting = { id: string; title: string; salary: string; on: boolean; desc: string };
const DEFAULT_POSTINGS: Posting[] = [
  { id: "p1", title: "私人助理", salary: "3-5千/月", on: true, desc: "安排行程、对接各方、处理杂务，细心抗压能出差。" },
  { id: "p2", title: "宣传统筹", salary: "5-8千/月", on: true, desc: "策划话题与物料，维护媒体资源，网感与执行力强。" },
  { id: "p3", title: "妆发造型师", salary: "5-9千/月", on: false, desc: "负责妆容造型，跟组随场补妆，有作品集优先。" },
];

function EmployerApp({ candidates, studio, myFame, playerName, playerAvatar, companyName, onBack, onSwitch }: {
  candidates: { id: string; name: string; fame: number; personality: string; company: string; topStat: string }[];
  studio: string; myFame: number; playerName: string; playerAvatar: string; companyName: string; onBack: () => void; onSwitch: () => void;
}) {
  const [tab, setTab] = useState<"posts" | "talent" | "me">("posts");
  const [postings, setPostings] = useState<Posting[]>(DEFAULT_POSTINGS);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", salary: "", desc: "" });
  const [chat, setChat] = useState<string | null>(null);
  const [contacted, setContacted] = useState<string[]>([]);

  if (chat) {
    const c = candidates.find((x) => x.id === chat);
    if (c) return <ChatView
      peerName={c.name} peerSub={`名气 ${c.fame} · 擅长${c.topStat}`} peerAvatarName={c.name}
      meName={playerName} meAvatar={playerAvatar}
      opener={`你好，我是${studio}的负责人。冒昧打扰——留意你挺久了。`}
      greets={EMP_GREETS} reply={(g) => candidateReply(c.fame, c.personality, g, studio, myFame)}
      actionLabel="发送 offer · 邀约"
      onAction={() => (c.fame > myFame * 1.4 + 60 ? "谢谢诚意，我先和团队商量一下，回头给你答复。" : "好呀！那我们找个时间正式聊聊合约细节？")}
      onBack={() => setChat(null)} />;
  }

  const addPost = () => {
    if (!form.title.trim()) return;
    setPostings((p) => [{ id: `p${Date.now()}`, title: form.title.trim(), salary: form.salary.trim() || "面议", on: true, desc: form.desc.trim() || "详情面聊。" }, ...p]);
    setForm({ title: "", salary: "", desc: "" }); setAdding(false);
  };

  return (
    <div className="relative flex h-full flex-col bg-[#f2f3f5]">
      <div className="bg-white px-4 pb-2.5 pt-3">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-[14px] text-ink-soft">‹ 主屏</button>
          <p className="text-[15px] font-bold" style={{ color: ACCENT }}>老板直聘 · 招聘</p>
          <span className="text-[13px] text-ink-soft">星城 ▾</span>
        </div>
      </div>

      {tab === "posts" && (
        <div className="flex-1 overflow-y-auto py-3">
          <div className="mx-3 mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink">我发布的职位</p>
            <button onClick={() => setAdding(true)} className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: ACCENT }}>+ 发布职位</button>
          </div>
          {postings.map((p) => (
            <div key={p.id} className="mx-3 mb-2.5 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5">
              <div className="flex items-start justify-between">
                <p className="text-[15px] font-semibold text-ink">{p.title}</p>
                <span className="text-[13.5px] font-bold" style={{ color: ACCENT }}>{p.salary}</span>
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{p.desc}</p>
              <div className="mt-2.5 flex items-center justify-between border-t border-black/[0.06] pt-2.5">
                <span className={`text-[11.5px] font-medium ${p.on ? "text-emerald-600" : "text-ink-soft"}`}>{p.on ? "● 招聘中" : "○ 已暂停"}</span>
                <button onClick={() => setPostings((ps) => ps.map((x) => x.id === p.id ? { ...x, on: !x.on } : x))} className="text-[12px] font-medium" style={{ color: ACCENT }}>
                  {p.on ? "暂停招聘" : "开启招聘"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "talent" && (
        <div className="flex-1 overflow-y-auto py-2">
          <p className="px-4 pb-1 text-[12px] text-ink-soft">为你推荐 · 星城在圈艺人</p>
          {candidates.map((c) => (
            <div key={c.id} className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
              <Avatar src="" name={c.name} size={42} editable={false} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">{c.name}</p>
                <p className="truncate text-[12px] text-ink-soft">名气 {c.fame} · 擅长{c.topStat} · {c.company}</p>
              </div>
              <button onClick={() => { setContacted((v) => v.includes(c.id) ? v : [...v, c.id]); setChat(c.id); }} className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white" style={{ background: ACCENT }}>
                {contacted.includes(c.id) ? "继续聊" : "打招呼"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "me" && (
        <div className="flex-1 overflow-y-auto pb-4">
          <div className="px-4 pb-5 pt-6 text-white" style={{ background: "linear-gradient(135deg, #caa24a, #9a742a)" }}>
            <div className="flex items-center gap-3">
              <Avatar src={playerAvatar} name={playerName} size={56} editable={false} />
              <div><p className="text-[18px] font-semibold">{studio}</p><p className="text-[12.5px] text-white/85">负责人 · {playerName}（{companyName}旗下）</p></div>
            </div>
            <div className="mt-4 flex gap-6">
              <div><p className="text-[19px] font-bold">{postings.filter((p) => p.on).length}</p><p className="text-[11px] text-white/80">招聘中职位</p></div>
              <div><p className="text-[19px] font-bold">{contacted.length}</p><p className="text-[11px] text-white/80">已联系</p></div>
              <div><p className="text-[19px] font-bold">{myFame}</p><p className="text-[11px] text-white/80">主理人名气</p></div>
            </div>
          </div>
          <div className="mx-3 mt-3 rounded-2xl bg-white p-4 text-[13px] leading-relaxed text-ink-soft shadow-sm ring-1 ring-black/5">
            以工作室主理人的身份组建你的团队：发布职位、翻牌心仪的艺人与幕后，一句「打招呼」就能直接谈。
          </div>
          <button onClick={onSwitch} className="mx-3 mt-3 w-[calc(100%-1.5rem)] rounded-2xl border py-2.5 text-[13.5px] font-medium" style={{ borderColor: ACCENT, color: ACCENT }}>切换为「我要找工作」</button>
        </div>
      )}

      {adding && (
        <div className="absolute inset-0 z-40 flex items-end bg-black/40" onClick={() => setAdding(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl bg-white p-5">
            <p className="text-[15px] font-semibold text-ink">发布新职位</p>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="职位名称，如：舞蹈老师" className="mt-3 w-full rounded-lg bg-black/[0.05] px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-soft/70" />
            <input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="薪资，如：6千-1万/月" className="mt-2 w-full rounded-lg bg-black/[0.05] px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-soft/70" />
            <textarea value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="岗位描述…" rows={3} className="mt-2 w-full resize-none rounded-lg bg-black/[0.05] px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-soft/70" />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 rounded-full border border-black/10 py-2.5 text-[14px] text-ink-soft">取消</button>
              <button onClick={addPost} disabled={!form.title.trim()} className="flex-1 rounded-full py-2.5 text-[14px] font-semibold text-white disabled:opacity-45" style={{ background: ACCENT }}>发布</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex border-t border-black/5 bg-white">
        {(["posts", "talent", "me"] as const).map((id) => (
          <button key={id} onClick={() => setTab(id)} className="flex-1 py-2.5 text-[12px] font-medium" style={{ color: tab === id ? ACCENT : "#9aa0a6" }}>
            {id === "posts" ? "职位管理" : id === "talent" ? "找人才" : "我的"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── 入口 ───────────────── */
export default function BossZhipinApp({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const sim = game!.sim;
  const fame = sim.fame ?? 0;
  const playerName = game!.player.name || sim.char.name || "我";
  const playerAvatar = game!.player.avatar || "";

  const [role, setRole] = useState<Role | null>(() => {
    try { const v = localStorage.getItem(ROLE_KEY); return v === "seeker" || v === "employer" ? v : null; } catch { return null; }
  });
  const setPersistRole = (r: Role | null) => {
    setRole(r);
    try { if (r) localStorage.setItem(ROLE_KEY, r); else localStorage.removeItem(ROLE_KEY); } catch { /* 无痕模式忽略 */ }
  };

  const jobs = useMemo<Job[]>(() => {
    const cos = (sim.companies ?? []).length ? sim.companies : COMPANIES.map((c, i) => ({ id: `co_${i}`, prestige: c.prestige }));
    const sorted = [...cos].sort((a, b) => b.prestige - a.prestige);
    const artist = sorted.map((c, i) => makeArtistJob(c.id, c.prestige, i));
    const crew = CREW.map((tpl, k) => makeCrewJob(tpl, sorted[k % sorted.length].id, k));
    return [...artist, ...crew];
  }, [sim.companies]);

  const candidates = useMemo(() => {
    return (sim.npcs ?? [])
      .slice()
      .sort((a, b) => b.fame - a.fame)
      .slice(0, 24)
      .map((n) => {
        const topKey = [...STAT_ORDER].sort((a, b) => (n.stats[b] ?? 0) - (n.stats[a] ?? 0))[0];
        return { id: n.id, name: n.name, fame: n.fame, personality: n.personality, company: companyMeta(n.companyId).name, topStat: STAT_LABELS[topKey] };
      });
  }, [sim.npcs]);

  const companyName = game!.contract?.company ?? "自由艺人";
  const studio = `${playerName}工作室`;

  if (!role) return <RoleChooser onBack={onBack} onPick={setPersistRole} />;
  if (role === "seeker")
    return <SeekerApp jobs={jobs} fame={fame} playerName={playerName} playerAvatar={playerAvatar} desc={game!.player.description} stats={sim.stats} onBack={onBack} onSwitch={() => setPersistRole("employer")} />;
  return <EmployerApp candidates={candidates} studio={studio} myFame={fame} playerName={playerName} playerAvatar={playerAvatar} companyName={companyName} onBack={onBack} onSwitch={() => setPersistRole("seeker")} />;
}
