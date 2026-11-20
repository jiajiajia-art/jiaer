/* 老板直聘 —— 仿真招聘 App。进入先选身份：我要找工作（求职者）/ 我要招人（企业）。
 * 视觉自绘、内容全部虚构。求职端职位来自游戏内 8 家经纪公司（签约艺人 + 幕后/运营真实岗位）；
 * 企业端你以「工作室」身份发布职位、翻牌候选艺人。薪资/门槛按公司声望确定性推导，不结算真实数值。 */
import { complete } from "../../lib/ai";
import { loadConfig } from "../../lib/store";
import { loadData, saveData, removeData, SAVE_SWITCH_EVENT } from "../../lib/saveScope";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorldSync, syncJson, loadFeed, saveFeed } from "./worldSync";
import { LoadMoreButton, seenOf } from "./shared";
import { useGame } from "../../store/gameCtx";
import { COMPANIES, companyMeta } from "../../worlds/star2005/content";
import { STAT_LABELS, STAT_ORDER } from "../../game/data";
import { Avatar } from "../ui";
import { IconSearch, IconChevron } from "./icons";
import { liveTerm as T } from "../../mods/live";
import { IconBriefcase, IconCheck, IconUser } from "../../lib/icons";

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
  workLocation?: string;
  exp: string;
  edu: string;
  tags: string[];
  fameReq: number; // 仅艺人岗
  duties: string[];
  reqs: string[];
};

const fallbackBoss: Boss = { name: "招聘负责人", title: "HR", age: 38, style: "务实", quote: "先聊聊，看合不合适。", bio: "" };

function artistTitle(prestige: number): string {
  return prestige >= 72 ? "签约当红艺人 · 一线咖位"
    : prestige >= 56 ? "签约艺人 · 重点资源位"
    : prestige >= 42 ? "签约新人 · 重点培养" : "签约练习生 / 新人艺人";
}
function makeArtistJob(companyId: string, prestige: number): Job {
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
    salary: prestige >= 56 ? `保底 ${low}万/月 · 项目分成` : `保底 ${low}-${high}千/月 · ${T("gig")}分成`,
    exp: "新人可投", edu: "形象气质佳",
    tags: [prestige >= 60 ? "重点捧" : "长线培养", "艺人经纪", `声望${prestige}`],
    fameReq,
    duties: ["按公司规划参与影视/音乐/综艺等项目", `配合宣传、${T("gig")}与商务活动`, "持续打磨专业能力与舞台表现"],
    reqs: [`名气达到 ${fameReq} 以上者优先`, "肯吃苦、可塑性强、无不良记录", "认同公司培养方向与合约条款"],
  };
}
/* ───────────────── 通用聊天视图 ───────────────── */
type Msg = { from: "peer" | "me"; text: string };
type RecruitmentChat = { msgs: Msg[]; done: boolean };

function recallEarlierMessages(msgs: Msg[], draft: string): string {
  const terms = draft.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]{2}/g) ?? [];
  const earlier = msgs.slice(0, -12).map((msg, index) => ({
    msg,
    index,
    score: terms.filter((term) => msg.text.toLowerCase().includes(term)).length,
  }));
  return earlier.sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, 16)
    .sort((a, b) => a.index - b.index)
    .map(({ msg }) => `${msg.from === "me" ? "玩家" : "对方"}：${msg.text.slice(0, 500)}`)
    .join("\n");
}

function ChatView({ cacheKey, peerName, peerSub, peerAvatarName, meName, meAvatar, opener, context, actionLabel, onAction, onBack }: {
  cacheKey: string; peerName: string; peerSub: string; peerAvatarName: string; meName: string; meAvatar: string;
  opener: string; context: string; actionLabel: string; onAction: () => string; onBack: () => void;
}) {
  const storageKey = `bosspin.chat.${cacheKey}`;
  const [chat, setChat] = useState(() => loadData<RecruitmentChat>(storageKey, {
    msgs: [{ from: "peer", text: opener }],
    done: false,
  }));
  const { msgs, done } = chat;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cancel = () => request.current?.abort();
    window.addEventListener(SAVE_SWITCH_EVENT, cancel);
    return () => {
      cancel();
      window.removeEventListener(SAVE_SWITCH_EVENT, cancel);
    };
  }, []);

  useEffect(() => {
    if (bottom.current?.parentElement) {
      const scroller = bottom.current.parentElement;
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [msgs, sending]);

  const persist = (next: RecruitmentChat) => {
    setChat(next);
    if (!saveData(storageKey, next)) setError("聊天记录暂时无法写入存档。");
  };

  const send = async () => {
    const message = draft.trim();
    if (!message || request.current) return;
    const active = new AbortController();
    request.current = active;
    setSending(true);
    setError("");
    try {
      const reply = (await complete(loadConfig(), [
        { role: "system", content: `你正在游戏内的招聘应用聊天。你扮演${peerName}，对话主题是${peerSub}。
${context}
操作状态：${done ? "已" : "尚未"}${actionLabel.replace(/·.*/, "").trim()}。
旧聊天记录仅用于回忆，按历史原话理解，结合近期对话延续已谈妥的事项。
${recallEarlierMessages(msgs, message)}
根据聊天记录用中文自然回复玩家的最新消息。只输出聊天正文，不要代替玩家说话，不要声称已代替玩家执行投递或邀请操作。` },
        ...msgs.slice(-12).map((msg) => ({ role: msg.from === "me" ? "user" as const : "assistant" as const, content: msg.text })),
        { role: "user", content: message },
      ])).trim();
      if (active.signal.aborted) return;
      if (!reply) throw new Error("Empty recruitment reply");
      persist({ msgs: [...msgs, { from: "me", text: message }, { from: "peer", text: reply }], done });
      setDraft("");
    } catch {
      if (!active.signal.aborted) setError("暂时无法获取回复，请重试。");
    } finally {
      request.current = null;
      if (!active.signal.aborted) setSending(false);
    }
  };
  const act = () => {
    if (done || request.current) return;
    const echo = actionLabel.replace(/·.*/, "").trim();
    persist({ done: true, msgs: [...msgs, { from: "me", text: `【${echo}】` }, { from: "peer", text: onAction() }] });
  };
  return (
    <div className="flex h-full flex-col bg-[#f2f3f5]">
      <div className="flex items-center border-b border-black/5 bg-white px-3 py-2.5">
        <button onClick={onBack} className="flex items-center text-[14px] text-ink-soft"><IconChevron size={16} className="rotate-180" /></button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[15px] font-semibold text-ink">{peerName}</p>
          <p className="truncate text-[11px] text-ink-soft">{peerSub} · 在线</p>
        </div>
        <span className="w-6" />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.from === "me" ? "flex-row-reverse" : ""}`}>
            <Avatar src={m.from === "me" ? meAvatar : ""} name={m.from === "me" ? meName : peerAvatarName} size={32} editable={false} />
            <div className={`max-w-[74%] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl px-3 py-2 text-[13.5px] leading-snug ${m.from === "me" ? "text-white" : "bg-white text-ink ring-1 ring-black/5"}`} style={m.from === "me" ? { background: ACCENT } : undefined}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && <p role="status" className="text-[12px] text-ink-soft">对方正在回复…</p>}
        <div ref={bottom} />
      </div>
      <div className="border-t border-black/5 bg-white px-3 py-2.5">
        {error && <p role="alert" className="mb-1 text-[12px] text-rose-700">{error}</p>}
        <form className="mb-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <input aria-label="自定义回复" placeholder="输入自定义回复…" value={draft} maxLength={500} disabled={sending}
            onChange={(e) => setDraft(e.target.value)} className="min-w-0 flex-1 rounded-full bg-black/[0.05] px-3 py-2 text-[13px] text-ink" />
          <button type="submit" disabled={sending || !draft.trim()} className="shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-45" style={{ background: ACCENT }}>
            {sending ? "等待回复…" : "发送"}
          </button>
        </form>
        <div className="flex justify-end">
          <button onClick={act} disabled={done || sending} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-45" style={{ background: ACCENT }}>
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
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#e3f6f2", color: ACCENT }}><IconUser size={22} /></span>
          <div className="flex-1"><p className="text-[16px] font-bold text-ink">我要找工作</p><p className="text-[12px] text-ink-soft">浏览岗位，直接和老板聊</p></div>
          <IconChevron size={18} />
        </button>
        <button onClick={() => onPick("employer")} className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#fdf0d9", color: "#c47a12" }}><IconBriefcase size={22} /></span>
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
        <p className="min-w-0 text-[15.5px] font-semibold text-ink">{job.title}</p>
        <span className="shrink-0 text-[13.5px] font-bold" style={{ color: ACCENT }}>{job.salary.split(" · ")[0]}</span>
      </div>
      <p className="mt-1 text-[11.5px] text-ink-soft">{[job.workLocation, job.exp, job.edu].filter(Boolean).join(" · ")}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {job.tags.map((t) => <span key={t} className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[11px] text-ink-soft">{t}</span>)}
        {job.kind === "artist" && (
          <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: artistOk ? "#dcf5ee" : "#fdeaea", color: artistOk ? "#0a7d5f" : "#e5484d" }}>
            {artistOk ? "名气达标 " : `名气门槛 ${job.fameReq}`}
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
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-[18px] font-bold text-ink">{job.title}</p>
            <span className="shrink-0 text-[16px] font-bold" style={{ color: ACCENT }}>{job.salary.split(" · ")[0]}</span>
          </div>
          <p className="mt-1 text-[12px] text-ink-soft">{[job.workLocation, job.exp, job.edu].filter(Boolean).join(" · ")}</p>
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
function SeekerApp({ jobs, fame, playerName, playerAvatar, desc, stats, moreLoading, onLoadMore, onBack, onSwitch }: {
  jobs: Job[]; fame: number; playerName: string; playerAvatar: string; desc: string; stats: Record<string, number>; moreLoading: boolean; onLoadMore: () => Promise<string>; onBack: () => void; onSwitch: () => void;
}) {
  const [toast, setToast] = useState("");
  const flash = (t: string) => { if (!t) return; setToast(t); setTimeout(() => setToast(""), 1800); };
  const [tab, setTab] = useState<"jobs" | "msg" | "me">("jobs");
  const [cat, setCat] = useState<"推荐" | "艺人" | "幕后" | "运营">("推荐");
  const [detail, setDetail] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const job = (id: string | null) => jobs.find((j) => j.id === id);
  if (chat) {
    const j = job(chat);
    if (j) return <ChatView key={j.id} cacheKey={`seek_${j.id}`}
      peerName={j.boss.name} peerSub={`${j.company} · ${j.title}`} peerAvatarName={j.boss.name}
      meName={playerName} meAvatar={playerAvatar}
      opener={`我是${j.company}的${j.boss.name}。${j.kind === "artist" ? j.boss.quote : `「${j.title}」还在招，你的情况方便说说吗？`}`}
      context={`招聘方风格：${j.boss.style}。薪资：${j.salary}。职责：${j.duties.join("、")}。要求：${j.reqs.join("、")}。玩家当前名气：${fame}。`}
      actionLabel="投递简历 · 申请"
      onAction={() => (j.kind === "artist" ? (fame >= j.fameReq ? `简历收到，条件不错。我让助理拟合同，改天约你到${j.company}详谈。` : `简历先留下了，等你名气到 ${j.fameReq}，我第一个签你。`) : `简历收到，${j.title}这边我们尽快安排面试，保持手机畅通。`)}
      onBack={() => setChat(null)} />;
  }
  if (detail) {
    const j = job(detail);
    if (j) return <JobDetail job={j} fame={fame} onBack={() => setDetail(null)} onChat={() => { setVisited((v) => v.includes(j.id) ? v : [...v, j.id]); setChat(j.id); setDetail(null); }} />;
  }

  const kw = q.trim().toLowerCase();
  const shown = jobs.filter((j) => (cat === "推荐" ? true : j.cat === cat) && (!kw || `${j.title}${j.company}${j.tags.join("")}`.toLowerCase().includes(kw)));
  const top = [...STAT_ORDER].sort((a, b) => (stats[b] ?? 0) - (stats[a] ?? 0)).slice(0, 4);

  return (
    <div className="relative flex h-full flex-col bg-[#f2f3f5]">
      <div className="bg-white px-4 pb-2.5 pt-3">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-[14px] text-ink-soft">‹ 主屏</button>
          <p className="text-[15px] font-bold" style={{ color: ACCENT }}>老板直聘 · 求职</p>
          <span className="text-[13px] text-ink-soft">{T("city")}</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 rounded-full bg-black/[0.05] px-3.5 py-2 text-ink-soft">
          <IconSearch size={16} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setTab("jobs"); }} placeholder="搜索职位 · 经纪公司" className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-soft" />
          {q && <button onClick={() => setQ("")} aria-label="清除" className="text-[13px]"></button>}
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
            {shown.length === 0 && <p className="px-6 py-16 text-center text-[13px] text-ink-soft">{kw ? `没有找到与「${q.trim()}」相关的职位` : "该分类暂时没有职位"}</p>}
            {shown.map((j) => <JobCard key={j.id} job={j} fame={fame} onOpen={() => setDetail(j.id)} />)}
            {!kw && <LoadMoreButton loading={moreLoading} onClick={() => void onLoadMore().then(flash)} color={ACCENT} dark />}
          </div>
          {toast && <div className="pointer-events-none absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-lg bg-black/75 px-3 py-1.5 text-[12.5px] text-white">{toast}</div>}
        </>
      )}

      {tab === "msg" && (
        <div className="flex-1 overflow-y-auto py-1">
          {visited.length === 0
            ? <p className="px-6 py-16 text-center text-[13px] text-ink-soft">还没有沟通记录，去「职位」页找老板聊聊吧。</p>
            : visited.filter((id) => job(id)).map((id) => { const j = job(id)!; return (
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
              <div><p className="text-[19px] font-bold">{T("city")}</p><p className="text-[11px] text-white/80">意向城市</p></div>
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
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{desc || `怀揣着成为主角的梦想，正在${T("city")}寻找愿意栽培的经纪公司。台前幕后都肯学，能吃苦，等一个被看见的机会。`}</p>
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

function EmployerApp({ candidates, studio, myFame, playerName, playerAvatar, companyName, onBack, onSwitch }: {
  candidates: { id: string; name: string; fame: number; personality: string; company: string; topStat: string }[];
  studio: string; myFame: number; playerName: string; playerAvatar: string; companyName: string; onBack: () => void; onSwitch: () => void;
}) {
  const [tab, setTab] = useState<"posts" | "talent" | "me">("posts");
  const [postings, setPostings] = useState<Posting[]>([]) /* 职位只来自玩家自己发布 */;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", salary: "", desc: "" });
  const [chat, setChat] = useState<string | null>(null);
  const [contacted, setContacted] = useState<string[]>([]);

  if (chat) {
    const c = candidates.find((x) => x.id === chat);
    if (c) return <ChatView key={c.id} cacheKey={`emp_${c.id}`}
      peerName={c.name} peerSub={`名气 ${c.fame} · 擅长${c.topStat}`} peerAvatarName={c.name}
      meName={playerName} meAvatar={playerAvatar}
      opener={`你好，我是${studio}的负责人。冒昧打扰——留意你挺久了。`}
      context={`你是候选人，性格：${c.personality}，名气：${c.fame}。对方来自${studio}，名气：${myFame}。`}
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
          <span className="text-[13px] text-ink-soft">{T("city")}</span>
        </div>
      </div>

      {tab === "posts" && (
        <div className="flex-1 overflow-y-auto py-3">
          <div className="mx-3 mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink">我发布的职位</p>
            <button onClick={() => setAdding(true)} className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: ACCENT }}>+ 发布职位</button>
          </div>
          {postings.length === 0 && <p className="px-6 py-16 text-center text-[13px] text-ink-soft">还没有发布职位，点右上角「发布职位」开始招人。</p>}
          {postings.map((p) => (
            <div key={p.id} className="mx-3 mb-2.5 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-all text-[15px] font-semibold text-ink">{p.title}</p>
                <span className="shrink-0 text-[13.5px] font-bold" style={{ color: ACCENT }}>{p.salary}</span>
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{p.desc}</p>
              <div className="mt-2.5 flex items-center justify-between border-t border-black/[0.06] pt-2.5">
                <span className={`text-[11.5px] font-medium ${p.on ? "text-emerald-600" : "text-ink-soft"}`}>{p.on ? "● 招聘中" : "○ 已暂停"}</span>
                <span className="flex items-center gap-4">
                  <button onClick={() => setPostings((ps) => ps.filter((x) => x.id !== p.id))} className="text-[12px] text-ink-soft">删除</button>
                  <button onClick={() => setPostings((ps) => ps.map((x) => x.id === p.id ? { ...x, on: !x.on } : x))} className="text-[12px] font-medium" style={{ color: ACCENT }}>
                    {p.on ? "暂停招聘" : "开启招聘"}
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "talent" && (
        <div className="flex-1 overflow-y-auto py-2">
          <p className="px-4 pb-1 text-[12px] text-ink-soft">为你推荐 · {T("city")}在圈艺人</p>
          {candidates.length === 0 && <p className="px-6 py-16 text-center text-[13px] text-ink-soft">暂时没有可推荐的人才，过几天再来看看。</p>}
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
  const { game, cfg } = useGame();
  const sim = game!.sim;
  const [aiJobs, setAiJobs] = useState<Job[]>(() => loadFeed<Job[]>("bosspin") ?? []);

  const parseJobs = (raw: unknown, pfx: string): Job[] => {
    const str = (v: unknown, d: string, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : d);
    const list = (v: unknown, n: number) => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, n).map((x) => x.trim().slice(0, 40));
    const now = Date.now();
    return (Array.isArray(raw) ? raw : []).filter((x): x is Record<string, unknown> => !!x && typeof x === "object").slice(0, 8).map((x, i) => {
      const kind: Job["kind"] = x.kind === "crew" ? "crew" : "artist";
      const cat: Job["cat"] = kind === "artist" ? "艺人" : x.cat === "幕后" ? "幕后" : "运营";
      const fr = Number(x.fameReq);
      const bossName = str(x.bossName, "招聘负责人", 12);
      return {
        id: `${pfx}_${now}_${i}`, kind, cat, companyId: "", company: str(x.company, `${T("city")}某剧组`, 20),
        boss: { ...fallbackBoss, name: bossName, title: str(x.bossTitle, "HR", 12), quote: str(x.quote, fallbackBoss.quote, 50) },
        title: str(x.title, "", 24), salary: str(x.salary, "面议", 20), workLocation: str(x.workLocation, "", 40) || undefined,
        exp: str(x.exp, "经验不限", 12), edu: "不限", tags: ["剧情新岗", ...list(x.tags, 3)],
        fameReq: kind === "artist" && Number.isFinite(fr) ? Math.max(0, Math.min(100, Math.round(fr))) : 0,
        duties: list(x.duties, 4).length ? list(x.duties, 4) : ["按项目安排开展工作"], reqs: list(x.reqs, 4).length ? list(x.reqs, 4) : ["认真负责"],
      };
    }).filter((j) => j.title);
  };
  // 底部「查看更多」：结合剧情再生成一批岗位，接在列表末尾（持久化）
  const [moreJobs, setMoreJobs] = useState<Job[]>(() => loadFeed<Job[]>("bosspin.more") ?? []);
  const [moreLoading, setMoreLoading] = useState(false);
  const loadMore = async (seenTitles: string[]): Promise<string> => {
    if (moreLoading) return "";
    setMoreLoading(true);
    try {
      const seen = seenOf(seenTitles);
      const r = await syncJson<{ jobs?: unknown }>(cfg, game!, "bosspin", "老板直聘", `主角当前名气 ${sim.fame ?? 0}。再生成 5 条符合主角职业阶段的招聘/试镜/选角/${T("gig")}岗位，可紧扣最近剧情，也可是行业日常岗位；不要与这些已有岗位重复：${seen}。返回 {"jobs":[{"kind":"artist(艺人试镜/签约)|crew(幕后运营)","cat":"艺人|幕后|运营","company":"公司/剧组","bossName":"招聘人","bossTitle":"职位","quote":"招聘人一句话","title":"岗位名","salary":"薪资","workLocation":"明确的工作或试镜地点；未确定留空","exp":"经验要求","tags":["≤3个"],"fameReq":30,"duties":["2-3条"],"reqs":["2-3条"]}]}`);
      if (!r) return "未配置 AI，暂无更多";
      const fresh = parseJobs(r.jobs, "aim");
      if (!fresh.length) return "生成失败，请重试";
      const next = [...moreJobs, ...fresh].slice(-60);
      setMoreJobs(next); saveFeed("bosspin.more", next);
      return `新加载 ${fresh.length} 个岗位`;
    } catch { return "加载失败，请重试"; } finally { setMoreLoading(false); }
  };

  useWorldSync("bosspin", async () => {
    const r = await syncJson<{ jobs?: unknown }>(cfg, game!, "bosspin", "老板直聘", `主角当前名气 ${sim.fame ?? 0}。生成 4 条紧扣当前世界剧情、符合主角职业阶段的新招聘/试镜/选角/${T("gig")}岗位（可来自剧情中出现的公司、剧组、导演、节目）。返回 {"jobs":[{"kind":"artist(艺人试镜/签约)|crew(幕后运营)","cat":"艺人|幕后|运营","company":"公司/剧组","bossName":"招聘人","bossTitle":"职位","quote":"招聘人一句话","title":"岗位名","salary":"薪资","workLocation":"明确的工作或试镜地点；未确定留空","exp":"经验要求","tags":["≤3个"],"fameReq":30,"duties":["2-3条"],"reqs":["2-3条"]}]}`);
    if (!r) return "未配置 AI，无法联动剧情";
    const fresh = parseJobs(r.jobs, "ai").slice(0, 6);
    if (!fresh.length) return "这次没有新岗位，请稍后再试";
    const next = [...fresh, ...aiJobs].slice(0, 16);
    setAiJobs(next); saveFeed("bosspin", next);
    return `新增 ${fresh.length} 个剧情相关岗位`;
  });
  const fame = sim.fame ?? 0;
  const playerName = game!.player.name || sim.char.name || "我";
  const playerAvatar = game!.player.avatar || "";

  const [role, setRole] = useState<Role | null>(() => {
    const v = loadData<string | null>(ROLE_KEY, null); return v === "seeker" || v === "employer" ? v : null;
  });
  const setPersistRole = (r: Role | null) => {
    setRole(r);
    if (r) saveData(ROLE_KEY, r); else removeData(ROLE_KEY);
  };

  const jobs = useMemo<Job[]>(() => {
    const cos = (sim.companies ?? []).length ? sim.companies : COMPANIES.map((c, i) => ({ id: `co_${i}`, prestige: c.prestige }));
    const sorted = [...cos].sort((a, b) => b.prestige - a.prestige);
    const artist = sorted.map((c) => makeArtistJob(c.id, c.prestige));
    // 艺人岗来自世界里真实的公司；幕后 / 运营岗只由 AI 按当前剧情生成，不再用模板岗位
    return [...aiJobs, ...artist, ...moreJobs];
  }, [sim.companies, aiJobs, moreJobs]);

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
    return <SeekerApp jobs={jobs} fame={fame} playerName={playerName} playerAvatar={playerAvatar} desc={game!.player.description} stats={sim.stats} moreLoading={moreLoading} onLoadMore={() => loadMore(jobs.map((j) => j.title))} onBack={onBack} onSwitch={() => setPersistRole("employer")} />;
  return <EmployerApp candidates={candidates} studio={studio} myFame={fame} playerName={playerName} playerAvatar={playerAvatar} companyName={companyName} onBack={onBack} onSwitch={() => setPersistRole("seeker")} />;
}
