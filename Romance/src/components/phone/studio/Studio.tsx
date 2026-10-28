import { useEffect, useRef, useState, type ReactNode } from "react";
import { complete, isConfigured, type ChatMsg } from "../../../lib/ai";
import { friendlyAIError } from "../../../lib/aiError";
import { loadConfig } from "../../../lib/store";
import {
  CATEGORIES, ICON_RULE, LAYOUT_OPTS, LEVEL_LABEL, LEVEL_TONE, REQUIREMENTS, SKILLS, STATUS_LABEL, STATUS_TONE, layoutOf, layoutText, loadHabits, saveHabits,
  autoFitIcon, autoFix, checkIconFile, makeIcon, makeShot, mergeSpec, missingReqs, neededSkills, newApp,
  patchApp, readAsDataURL, removeApp, reviewApp, runChecks, saveApps, skillById, useUserApps,
  type AppSpec, type CheckItem, type Layout, type SkillId, type UserApp,
} from "./core";
import { SlimeFace } from "./Slime";
import Runner from "./Runner";
import { REVIEW_STEPS, recoverStaleReviews, requestStudio, startReview, useReviewProgress } from "./review";
import { IconCheck } from "../../../lib/icons";

/* ═══ 开发者工坊：对话生成 → 资料 → 填写 → 完整性检查 → 审核中心 → 发布 ═══ */
type Tab = "chat" | "info" | "skill" | "check" | "review";
const TABS: { id: Tab; label: string }[] = [{ id: "chat", label: "对话" }, { id: "info", label: "资料" }, { id: "skill", label: "填写" }, { id: "check", label: "检查" }, { id: "review", label: "审核" }];
const MINT = "#3fb68b";
const inp = "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13.5px] text-[#222] outline-none focus:border-[#3fb68b]";
const chip = "shrink-0 whitespace-nowrap rounded-full border border-[#3fb68b]/25 bg-[#effaf5] px-3 py-1.5 text-[12px] font-semibold text-[#2a8c68] transition active:scale-95 disabled:opacity-40";
const pill = "rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-semibold text-[#333] active:scale-95 disabled:opacity-40";
const passed = (a: UserApp) => !!a.report?.pass && ["pending", "reviewing", "approved", "rejected", "listed", "delisted"].includes(a.status);

export default function Studio({ onClose, developer, onSlime, initial }: { onClose: () => void; developer: string; onSlime?: (t: string) => void; initial?: { id?: string; tab: Tab } }) {
  const apps = useUserApps();
  const [curId, setCurId] = useState<string | null>(initial?.id ?? null);
  const [tab, setTab] = useState<Tab>(initial?.tab ?? "chat");
  const [seed, setSeed] = useState<string>();
  const app = apps.find((a) => a.id === curId) ?? null;
  useEffect(() => { recoverStaleReviews(apps); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = () => { const a = newApp(developer); saveApps([a, ...apps]); setCurId(a.id); setTab("chat"); };
  if (!app) return (
    <Shell title="开发者工坊" sub="和小珠聊聊，就能做出自己的应用" onClose={onClose}>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3 rounded-[22px] bg-gradient-to-br from-[#e6fff4] to-[#fff0f6] p-4">
          <SlimeFace size={58} />
          <div className="min-w-0 flex-1"><p className="text-[15px] font-bold text-[#2b2140]">想做个什么应用呀？</p><p className="text-[12px] leading-relaxed text-[#6b6080]">记账本、小说阅读器、待办清单、宠物养成……告诉我，我帮你一步步做出来，还能上架到应用商店哦。</p></div>
        </div>
        <button onClick={create} className="w-full rounded-2xl py-3 text-[15px] font-bold text-white shadow-[0_6px_18px_rgba(63,182,139,.35)]" style={{ background: MINT }}>＋ 新建应用</button>
        {apps.length > 0 && <p className="pt-2 text-[13px] font-bold text-[#555]">我的应用</p>}
        {apps.map((a) => (
          <button key={a.id} onClick={() => { setCurId(a.id); setTab(a.status === "draft" && !a.turns.length ? "chat" : passed(a) ? "review" : "chat"); }} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-[0_1px_6px_rgba(0,0,0,.05)]">
            <AppIcon a={a} size={46} />
            <span className="min-w-0 flex-1"><b className="block truncate text-[14.5px] text-[#222]">{a.spec.name || "未命名应用"}</b><span className="block truncate text-[11.5px] text-[#999]">v{a.meta.version} · {new Date(a.updatedAt).toLocaleDateString("zh-CN")}</span></span>
            <StatusChip s={a.status} />
          </button>
        ))}
      </div>
    </Shell>
  );

  return (
    <Shell title={app.spec.name || "未命名应用"} sub={<StatusChip s={app.status} />} onClose={onClose} onBack={() => setCurId(null)}>
      <div className="sticky top-0 z-10 flex gap-1 border-b border-black/5 bg-[#f7f8fa]/95 px-3 py-2 backdrop-blur">
        {TABS.map((t) => {
          const locked = t.id === "review" && !passed(app);
          return <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 rounded-full py-1.5 text-[12.5px] font-bold transition ${tab === t.id ? "bg-white text-[#2b2140] shadow-sm" : "text-[#999]"}`}>{t.label}{locked ? " ·锁" : ""}</button>;
        })}
      </div>
      {tab === "chat" && <Chat app={app} onSlime={onSlime} goCheck={() => setTab("check")} seed={seed} onSeedUsed={() => setSeed(undefined)} />}
      {tab === "info" && <Info app={app} />}
      {tab === "skill" && <SkillTab app={app} />}
      {tab === "check" && <Check app={app} onSlime={onSlime} goTab={setTab} askAI={(t) => { setSeed(t); setTab("chat"); }} />}
      {tab === "review" && (passed(app) ? <ReviewPanel app={app} onSlime={onSlime} onEdit={() => setTab("chat")} /> : <Locked onGo={() => setTab("check")} />)}
    </Shell>
  );
}

/* ——— 外框 ——— */
function Shell({ title, sub, onClose, onBack, children }: { title: string; sub?: ReactNode; onClose: () => void; onBack?: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#f7f8fa] animate-[slimePop_.25s_ease-out]">
      <header className="flex items-center gap-2 border-b border-black/5 bg-white px-3 py-2.5">
        {onBack ? <button onClick={onBack} className="text-[14px] font-semibold text-[#3fb68b]">‹ 我的应用</button> : <SlimeFace size={30} />}
        <div className="min-w-0 flex-1 text-center"><p className="truncate text-[15px] font-bold text-[#222]">{title}</p>{sub && <div className="flex justify-center text-[11px] text-[#999]">{sub}</div>}</div>
        <button onClick={onClose} className="rounded-full bg-black/[0.06] px-3 py-1 text-[12px] font-semibold text-[#555]">收起</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
export function StatusChip({ s }: { s: UserApp["status"] }) {
  return <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: STATUS_TONE[s] }}>{STATUS_LABEL[s]}</span>;
}
export function AppIcon({ a, size }: { a: UserApp; size: number }) {
  const col = /^#[0-9a-f]{6}$/i.test(a.spec.color) ? a.spec.color : "#c9ccd3";
  return a.meta.icon ? <img src={a.meta.icon || undefined} alt="" className="shrink-0 rounded-[22%] object-cover" style={{ width: size, height: size }} />
    : <span className="grid shrink-0 place-items-center rounded-[22%] font-bold text-white" style={{ width: size, height: size, background: col, fontSize: size * 0.42 }}>{(a.spec.name || "?").charAt(0)}</span>;
}
function Locked({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <SlimeFace size={72} mood="worry" />
      <p className="text-[15px] font-bold text-[#2b2140]">审核中心还没解锁</p>
      <p className="text-[12.5px] leading-relaxed text-[#777]">应用要先通过完整性检查，才能进入审核中心哦。</p>
      <button onClick={onGo} className="rounded-full px-5 py-2 text-[13px] font-bold text-white" style={{ background: MINT }}>去做完整性检查</button>
    </div>
  );
}

/* 任何改动都会让已检查/已审核的结果失效（上架中的应用改动后需要重新审核） */
const edit = (a: UserApp, p: Partial<UserApp>) => patchApp(a.id, { ...p, ...(a.status !== "draft" && a.status !== "reviewing" ? { status: "draft" as const, report: undefined } : {}) });
const editSpec = (a: UserApp, spec: AppSpec) => {
  const auto = neededSkills(spec).map((k) => k.id);
  edit(a, { spec: { ...spec, skills: Array.from(new Set([...spec.skills, ...auto])) as SkillId[] } });
};

/* ——— 对话 ——— */
const QUESTIONS: Record<string, { q: string; chips?: string[] }> = {
  name: { q: "先给应用起个名字吧～（12 个字以内）" },
  type: { q: "它属于哪种类型呢？", chips: ["工具", "效率", "生活", "阅读", "养成", "财务"] },
  features: { q: "主要有哪些功能？用顿号隔开告诉我～", chips: ["记录、统计、查看", "添加、勾选、提醒"] },
  pages: { q: "需要哪几个页面？比如「首页、记录、我的」", chips: ["首页、记录、我的", "首页、设置"] },
  tabs: { q: "底部导航要放哪些页面？", chips: ["全部页面", "只放首页", "不要底部导航"] },
  interaction: { q: "主要怎么操作呢？", chips: ["点按与表单输入", "列表浏览", "拖动与勾选"] },
  storage: { q: "数据要保存吗？", chips: ["保存在本机", "不需要保存", "云端同步"] },
  login: { q: "需要登录吗？", chips: ["需要登录", "不需要"] },
  network: { q: "需要联网吗？", chips: ["需要联网", "不联网"] },
  iconDesc: { q: "图标想要什么样子？描述一下就好，资料页可以上传或一键生成", chips: ["主题色渐变 + 名称首字", "可爱的小动物"] },
  color: { q: "主题颜色喜欢哪种？", chips: ["樱花粉", "薄荷绿", "天空蓝", "奶油黄", "葡萄紫"] },
  intro: { q: "用一两句话介绍一下这个应用吧（至少 10 个字）" },
  layout: { q: "你平时用手机的习惯是怎样的？导航放哪、喜欢紧凑还是宽松、卡片还是列表、单手用哪只手？", chips: ["按我上次的习惯", "底部导航、卡片、右手单手", "顶部导航、列表、紧凑"] },
};
const SYS = (s: AppSpec) => `你是小手机里的「小珠」应用设计助手，用可爱、简短的中文和玩家对话，帮她做一个能在小手机里运行的应用。
## 必须确认的 12 项需求（未确认的要主动追问，一次最多问 2 项，不能编造玩家没说的关键信息）
${REQUIREMENTS.map((r) => `- ${r.key}：${r.label}`).join("\n")}
当前还缺：${missingReqs(s).map((r) => r.label).join("、") || "无"}
## 内置 Skill（根据需求自动选择组合，写进 skills；需要配置的写进 skillConfig）
${SKILLS.filter((k) => !k.system).map((k) => `- ${k.id}「${k.name}」：${k.desc}${k.config ? `；配置 ${k.config.map((c) => c.key + "=" + c.label).join("，")}` : ""}`).join("\n")}
## 页面积木（pages[].blocks[].type 只能用这些）
text{title,text} / stat{title,items:["标签:数值"]} / list{title,items} / todo{title,items} / note{title} / form{title,store,fields:[{key,label,kind:text|number|date}]} / records{title,store}（展示同 store 表单保存的数据）/ counter{title} / button{text,action:navigate|toast|save,target:页面id} / image{title}
## 接入游戏世界（重要）
应用运行在游戏里的小手机上，内容必须来自当前游戏世界，禁止编造写死的示例数据。
text / list / stat 积木用 "source" 接数据：status=时间地点天气资金，attrs=主角属性，people=人物关系，story=最近剧情，worldbook=世界书，ai=按 "prompt" 结合当前世界现写（如书架上的书、新闻、商品、帖子）。
写了 source 的积木不要写 items；玩家点刷新会重新读取 / 重写。只有说明性的固定文字才不写 source。
规则：玩家不要底部导航时写 "noTabs":true、"tabs":[]，此时页面之间必须用 button(navigate) 互相跳转；每个页面至少 1 个积木；表单要配同 store 的 records；按钮必须有 action；不要写「待定/TODO/…」。
## 布局习惯（必须按玩家习惯来，不能自作主张）
layout 字段：${(Object.keys(LAYOUT_OPTS) as (keyof Layout)[]).map((k) => `${k}=${LAYOUT_OPTS[k].opts.map(([v, t]) => `${JSON.stringify(v)}(${t})`).join("|")}`).join("；")}
${loadHabits() ? `玩家以往确认过的习惯：${layoutText(loadHabits()!)}（${JSON.stringify(loadHabits())}）。先向玩家确认是否沿用，玩家同意才写入；玩家说「按上次习惯」即原样写入。` : "玩家还没有记录过习惯，必须先问清楚导航位置、信息密度、卡片/列表、单手习惯等，再写入 layout。"}
页面结构也要贴合习惯：单手右手→主操作放右下；紧凑→每页多放信息；宽松→少而大的模块。
## 当前规格
${JSON.stringify(s).slice(0, 5000)}
## 回复格式
先用不超过 120 字说明本轮做了什么、追问什么。需求确认齐全时，必须在同一轮直接输出完整的 pages（至少 2 个页面、每页 2~5 个积木，贴合功能）与其余全部字段，不要只说「这就生成」而不给 JSON。如有改动，再输出一个 \`\`\`json 代码块：AppSpec 的部分字段，如 {"name":"","type":"","features":[],"pages":[{"id":"home","name":"首页","blocks":[...]}],"tabs":["home"],"interaction":"","storage":"local|none|cloud","login":false,"network":false,"iconDesc":"","color":"#rrggbb","intro":"","layout":{"nav":"bottom","density":"comfortable","style":"card","radius":"round","font":"md","hand":"right","header":"small","dark":false},"skills":["ui","db"],"skillConfig":{"db":{"table":"records"}}}。pages 按 id 合并。`;

function parsePatch(raw: string): Partial<AppSpec> | null | "bad" {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/```(?:json)?\s*([\s\S]*)$/);
  if (!m) return null;
  try { const v = JSON.parse(m[1].trim().replace(/,\s*([}\]])/g, "$1")); return v && typeof v === "object" ? v : "bad"; } catch { return "bad"; }
}
const visible = (t: string) => t.replace(/```(?:json)?[\s\S]*?(```|$)/g, "").trim();

function Chat({ app, onSlime, goCheck, seed, onSeedUsed }: { app: UserApp; onSlime?: (t: string) => void; goCheck: () => void; seed?: string; onSeedUsed?: () => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const ai = isConfigured(loadConfig());
  const turns = app.turns;
  const miss = missingReqs(app.spec);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.length, busy]);
  useEffect(() => { if (seed) { onSeedUsed?.(); void send(seed); } }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text: string) {
    const t = text.trim(); if (!t || busy) return;
    const hist = [...turns, { role: "user" as const, text: t }];
    patchApp(app.id, { turns: hist }); setInput(""); setErr("");
    if (!ai) { setErr("小珠需要接入 AI 才能生成应用：请先在菜单「AI 配置」里接入模型。"); patchApp(app.id, { turns }); setInput(t); return; }
    setBusy(true);
    try {
      const msgs: ChatMsg[] = [{ role: "system", content: SYS(app.spec) }, ...hist.slice(-10).map((x) => ({ role: x.role, content: x.text }))];
      const raw = await complete(loadConfig(), msgs);
      const p = parsePatch(raw);
      let note = "";
      if (p && p !== "bad") {
        let next = mergeSpec(app.spec, p);
        // 需求问齐了却还没有页面：自动追加一轮「出页面」，不让玩家停在「这就生成」却什么都没有
        const onlyPagesLeft = missingReqs(next).every((r) => r.key === "pages" || r.key === "tabs");
        if (!next.pages.length && onlyPagesLeft) {
          setErr(""); onSlime?.("需求齐啦，正在搭页面～");
          const raw2 = await complete(loadConfig(), [
            { role: "system", content: SYS(next) },
            ...hist.slice(-10).map((x) => ({ role: x.role, content: x.text })),
            { role: "assistant", content: visible(raw) || "好的～" },
            { role: "user", content: "需求已全部确认，请现在直接输出完整的 ```json 代码块：pages（至少 2 个页面，每页 2~5 个积木，紧扣主要功能）、tabs 或 noTabs，以及仍缺的字段。正文只说一句话。" },
          ]);
          const p2 = parsePatch(raw2);
          if (p2 && p2 !== "bad") next = mergeSpec(next, p2);
        }
        editSpec(app, next);
        editSpec(app, next);
        if (p.layout) saveHabits(layoutOf(next)); // 记住玩家确认过的布局习惯
        note = next.pages.length && !app.spec.pages.length
          ? `\n\n（已生成「${next.name || "应用"}」：${next.pages.map((pg) => pg.name).join("、")}，点上方「预览应用」看看～）`
          : next.pages.length ? "\n\n（已更新应用）" : "\n\n（已记下，页面还没搭好）";
        if (!missingReqs(next).length && missingReqs(app.spec).length) onSlime?.("需求都齐啦，做得好！");
      }
      else if (p === "bad") note = "\n\n（这轮的数据格式没读懂，应用没变哦，可以让我「重新输出」）";
      patchApp(app.id, { turns: [...hist, { role: "assistant", text: (visible(raw) || "好的～") + note }] });
    } catch (e) { setErr(friendlyAIError(e).text); patchApp(app.id, { turns }); setInput(t); }
    finally { setBusy(false); }
  }

  const chips = miss[0] ? QUESTIONS[miss[0].key].chips : undefined;
  const [reqOpen, setReqOpen] = useState(false);
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-3 mt-3 rounded-2xl bg-white p-3 shadow-[0_1px_6px_rgba(0,0,0,.05)]">
        <div className="flex items-center justify-between text-[12px]"><b className="text-[#333]">需求确认 {REQUIREMENTS.length - miss.length}/{REQUIREMENTS.length}</b>
          <span className="flex gap-1.5"><button className={pill} disabled={!app.spec.pages.length} onClick={() => setPreview(true)}>预览应用</button><button className={pill} onClick={goCheck}>去检查</button></span></div>
        {/* 精简：只显示进度条 + 下一项待确认，完整清单点开再看 */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f2f2f5]"><div className="h-full rounded-full transition-all" style={{ width: `${((REQUIREMENTS.length - miss.length) / REQUIREMENTS.length) * 100}%`, background: MINT }} /></div>
        <button type="button" onClick={() => setReqOpen((v) => !v)} className="mt-1.5 flex w-full items-center justify-between text-[11px] text-[#999]">
          <span>{miss.length ? <>小珠接下来会问：<b className="text-[#555]">{miss[0].label}</b></> : "需求都确认好啦"}</span>
          <span>{reqOpen ? "收起" : "查看全部"}</span>
        </button>
        {reqOpen && <div className="mt-2 flex flex-wrap gap-1">{REQUIREMENTS.map((r) => { const ok = r.ok(app.spec); return <span key={r.key} className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: ok ? "#e5f7ef" : "#f2f2f5", color: ok ? MINT : "#aaa" }}>{ok ? "" : ""}{r.label}</span>; })}</div>}
      </div>
      <div className="flex-1 space-y-3 px-3 py-3.5">
        {!turns.length && <Bubble me={false} text={ai ? "嗨，我是小珠！告诉我你想做什么应用吧～\n比如「帮我生成一个记账应用」「我想做一个宠物养成组件」。布局会按你的使用习惯来哦。" : "嗨，我是小珠！我要接入 AI 才能帮你生成应用哦～\n请先在菜单「AI 配置」里接入模型，再回来找我。"} />}
        {turns.map((t, i) => <Bubble key={i} me={t.role === "user"} text={t.text} />)}
        {busy && <Typing />}
        {err && <p className="rounded-xl bg-[#fff0f0] px-3 py-2 text-[12px] text-[#d33]">{err}</p>}
        <div ref={end} />
      </div>
      <div className="sticky bottom-0 space-y-2 border-t border-black/5 bg-white/95 p-2.5 backdrop-blur">
        {!ai && <p className="rounded-xl bg-[#fff4e5] px-3 py-2 text-[12px] text-[#c66a00]">需要接入 AI：生成应用的页面、布局和代码都由 AI 完成。</p>}
        {ai && !turns.length && <div className="-mx-2.5 flex gap-1.5 overflow-x-auto px-2.5 pb-0.5 [scrollbar-width:none]">{["帮我生成一个记账应用", "帮我做一个小说阅读器", "帮我生成一个待办事项应用", "我想做一个宠物养成组件"].map((c) => <button key={c} className={chip} onClick={() => send(c)}>{c}</button>)}</div>}
        {ai && turns.length > 0 && chips && <div className="-mx-2.5 flex gap-1.5 overflow-x-auto px-2.5 pb-0.5 [scrollbar-width:none]">{chips.map((c) => <button key={c} className={chip} disabled={busy} onClick={() => send(c)}>{c}</button>)}</div>}
        <div className="flex items-center gap-2 rounded-full bg-[#f4f5f7] py-1 pl-1 pr-1">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(input); }} disabled={!ai} placeholder={ai ? "和小珠说说你的想法…" : "接入 AI 后才能对话生成"} className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-[13.5px] text-[#222] outline-none placeholder:text-[#aaa]" />
          <button disabled={!ai || busy || !input.trim()} onClick={() => send(input)} aria-label="发送" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-[0_4px_10px_-4px_rgba(63,182,139,.8)] transition active:scale-90 disabled:opacity-40 disabled:shadow-none" style={{ background: MINT }}><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 1z" /></svg></button>
        </div>
      </div>
      {preview && <Runner app={app} preview onClose={() => setPreview(false)} />}
    </div>
  );
}
function Typing() {
  return (
    <div className="flex items-end gap-1.5">
      <SlimeFace size={28} />
      <span className="flex items-center gap-1 rounded-[18px] rounded-bl-sm bg-white px-3.5 py-3 shadow-[0_1px_4px_rgba(0,0,0,.06)]" aria-label="小珠正在想">
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: MINT, animationDelay: `${i * 0.15}s` }} />)}
      </span>
    </div>
  );
}
function Bubble({ me, text }: { me: boolean; text: string }) {
  return (
    <div className={`flex items-end gap-1.5 ${me ? "justify-end" : "justify-start"}`}>
      {!me && <SlimeFace size={28} />}
      <p className={`max-w-[78%] whitespace-pre-wrap rounded-[18px] px-3.5 py-2.5 text-[13px] leading-[1.65] ${me ? "rounded-br-sm text-white" : "rounded-bl-sm bg-white text-[#333] shadow-[0_1px_4px_rgba(0,0,0,.06)]"}`} style={me ? { background: MINT } : undefined}>{text}</p>
    </div>
  );
}

/* ——— 资料 ——— */
function Info({ app }: { app: UserApp }) {
  const { spec: s, meta: m } = app;
  const [iconMsg, setIconMsg] = useState<{ ok: boolean; text: string; raw?: string } | null>(null);
  const setMeta = (p: Partial<UserApp["meta"]>) => edit(app, { meta: { ...m, ...p } });
  const onIcon = async (f?: File) => {
    if (!f) return;
    const r = await checkIconFile(f);
    if (r.ok) { setMeta({ icon: r.url }); setIconMsg({ ok: true, text: `图标符合规范（${r.w}×${r.h}）` }); }
    else setIconMsg({ ok: false, text: r.problems.join("；"), raw: r.problems.includes("图片无法读取") ? undefined : r.url });
  };
  const onShots = async (fs: FileList | null) => {
    if (!fs) return;
    const urls = await Promise.all(Array.from(fs).slice(0, 5 - m.screenshots.length).map(readAsDataURL));
    setMeta({ screenshots: [...m.screenshots, ...urls] });
  };
  return (
    <div className="space-y-3 p-3">
      <Card title="应用图标" hint={`PNG / JPG / WebP · 正方形 · ${ICON_RULE.min}~${ICON_RULE.max} 像素 · 不超过 ${ICON_RULE.maxKB} KB`}>
        <div className="flex items-center gap-3">
          <AppIcon a={app} size={64} />
          <div className="flex flex-wrap gap-1.5">
            <label className={`${pill} cursor-pointer`}>上传图标<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { onIcon(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <button className={pill} onClick={() => { setMeta({ icon: makeIcon(s) }); setIconMsg({ ok: true, text: "已按主题色生成 512×512 图标" }); }}>一键生成</button>
          </div>
        </div>
        {iconMsg && (
          <div className="mt-2 rounded-xl px-3 py-2 text-[12px]" style={{ background: iconMsg.ok ? "#e5f7ef" : "#fff4e5", color: iconMsg.ok ? MINT : "#c66a00" }}>
            {iconMsg.ok ? "" : "图标不符合要求："}{iconMsg.text}
            {!iconMsg.ok && iconMsg.raw && <button className={`${pill} ml-2`} onClick={async () => { setMeta({ icon: await autoFitIcon(iconMsg.raw!) }); setIconMsg({ ok: true, text: "已自动裁剪为 512×512 PNG" }); }}>自动裁剪适配</button>}
            {!iconMsg.ok && <span className="block pt-1 text-[11px] opacity-80">请重新上传，或使用自动裁剪 / 一键生成。</span>}
          </div>
        )}
      </Card>
      <Card title="布局习惯" hint="AI 生成时严格按这里来；改动会记住，下个应用默认沿用">
        {s.layout ? <div className="grid grid-cols-2 gap-2">{(Object.keys(LAYOUT_OPTS) as (keyof Layout)[]).map((k) => (
          <Field key={k} label={LAYOUT_OPTS[k].label}>
            <select className={inp} value={String(layoutOf(s)[k])} onChange={(e) => { const opt = (LAYOUT_OPTS[k].opts as [unknown, string][]).find(([v]) => String(v) === e.target.value)!; const l = { ...layoutOf(s), [k]: opt[0] } as Layout; editSpec(app, { ...s, layout: l }); saveHabits(l); }}>
              {(LAYOUT_OPTS[k].opts as [unknown, string][]).map(([v, t]) => <option key={String(v)} value={String(v)}>{t}</option>)}
            </select>
          </Field>))}</div>
          : <p className="text-[12px] text-[#999]">还没确认。在对话里告诉小珠你的使用习惯{loadHabits() ? "，或" : ""}{loadHabits() && <button className={`${pill} ml-1`} onClick={() => editSpec(app, { ...s, layout: loadHabits() })}>沿用上次习惯</button>}</p>}
      </Card>
      <Card title="基本资料">
        <Field label="应用名称"><input className={inp} value={s.name} maxLength={12} onChange={(e) => editSpec(app, { ...s, name: e.target.value })} placeholder="1~12 个字" /></Field>
        <Field label="应用简介"><textarea className={`${inp} min-h-[70px]`} value={s.intro} maxLength={200} onChange={(e) => editSpec(app, { ...s, intro: e.target.value })} placeholder="至少 10 个字，说说它能做什么" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="应用分类"><select className={inp} value={m.category} onChange={(e) => setMeta({ category: e.target.value })}><option value="">请选择</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="版本号"><input className={inp} value={m.version} onChange={(e) => setMeta({ version: e.target.value.trim() })} placeholder="1.0.0" /></Field>
        </div>
        <Field label="开发者"><input className={inp} value={m.developer} maxLength={20} onChange={(e) => setMeta({ developer: e.target.value })} /></Field>
        <Field label="主题颜色"><div className="flex items-center gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#3fb68b"} onChange={(e) => editSpec(app, { ...s, color: e.target.value })} className="h-9 w-12 rounded-lg border border-black/10" /><span className="text-[12px] text-[#999]">{s.color || "未选择"}</span></div></Field>
      </Card>
      <Card title={`应用截图（${m.screenshots.length}/5）`} hint="至少 1 张才能提交，审核建议 2 张以上">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {m.screenshots.map((u, i) => (
            <div key={i} className="relative shrink-0"><img src={u || undefined} alt="" className="h-36 w-[72px] rounded-lg object-cover ring-1 ring-black/10" />
              <button onClick={() => setMeta({ screenshots: m.screenshots.filter((_, j) => j !== i) })} className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[11px] text-white">×</button></div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <label className={`${pill} cursor-pointer`}>上传截图<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onShots(e.target.files); e.target.value = ""; }} /></label>
          <button className={pill} disabled={!s.pages.length} onClick={() => setMeta({ screenshots: s.pages.slice(0, 5).map((p) => makeShot(s, p)) })}>按页面生成截图</button>
        </div>
      </Card>
    </div>
  );
}
function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <section className="space-y-2 rounded-2xl bg-white p-3.5 shadow-[0_1px_6px_rgba(0,0,0,.05)]"><div><p className="text-[14px] font-bold text-[#222]">{title}</p>{hint && <p className="text-[11px] text-[#999]">{hint}</p>}</div>{children}</section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1"><span className="text-[11.5px] font-semibold text-[#777]">{label}</span>{children}</label>;
}

/* ——— 填写：只展示需要玩家手填的内容，功能组合由小珠在后台自动完成 ——— */
function SkillTab({ app }: { app: UserApp }) {
  const s = app.spec;
  const setCfg = (id: SkillId, key: string, v: string) => edit(app, { spec: { ...s, skillConfig: { ...s.skillConfig, [id]: { ...(s.skillConfig[id] ?? {}), [key]: v } } } });
  const fields = neededSkills(s).flatMap((k) => (k.config ?? []).map((c) => ({ k, c })));
  return (
    <div className="space-y-3 p-3">
      {!fields.length ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center"><SlimeFace size={60} mood="party" /><p className="text-[14px] font-bold text-[#2b2140]">没有需要你手填的内容</p><p className="text-[12px] text-[#999]">小珠都帮你配好啦，可以直接去「检查」。</p></div>
      ) : (
        <Card title="还需要你填写" hint="其余功能小珠会自动配好">
          {fields.map(({ k, c }) => {
            const v = s.skillConfig[k.id]?.[c.key] ?? "";
            return <Field key={k.id + c.key} label={`${c.label}${v.trim() ? "" : " · 未填"}`}><input className={inp} value={v} placeholder={c.placeholder} onChange={(e) => setCfg(k.id, c.key, e.target.value)} /></Field>;
          })}
        </Card>
      )}
    </div>
  );
}

/* ——— 完整性检查 ——— */
function Check({ app, onSlime, goTab, askAI }: { app: UserApp; onSlime?: (t: string) => void; goTab: (t: Tab) => void; askAI: (t: string) => void }) {
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState(false);
  const r = app.report;
  const submit = () => {
    setRunning(true);
    setTimeout(() => {
      let rep; try { rep = runChecks(app); } catch (e) { rep = { items: [{ group: "数据" as const, level: "fail" as const, title: "检查程序出错", hint: String(e) }], at: Date.now(), pass: false, summary: { done: 0, risk: 0, must: 0, fail: 1 } }; }
      patchApp(app.id, { report: rep, status: rep.pass ? "pending" : "needs_fix" });
      onSlime?.(rep.pass ? "检查通过！可以去审核中心啦～" : `还有 ${rep.summary.must + rep.summary.fail} 处要补全哦`);
      setRunning(false);
    }, 900);
  };
  const ai = isConfigured(loadConfig());
  /* 自动补全：资料类（图标/截图/版本等）本地补齐；页面、交互、布局等应用内容一律交给 AI 按报告生成 */
  const fix = () => {
    const meta = autoFix(app).meta;
    patchApp(app.id, { meta: { ...app.meta, icon: app.meta.icon || meta.icon, category: app.meta.category || meta.category, version: /^\d+\.\d+\.\d+$/.test(app.meta.version) ? app.meta.version : meta.version, developer: app.meta.developer || meta.developer, screenshots: app.meta.screenshots.length >= 2 ? app.meta.screenshots : app.spec.pages.length ? meta.screenshots : app.meta.screenshots }, status: "draft", report: undefined });
    const appProblems = blockers.filter((b) => b.group !== "资料" || /需求未确认|名称|简介/.test(b.title));
    if (!appProblems.length) { onSlime?.("资料补好啦，再提交一次看看"); return; }
    if (!ai) { onSlime?.("要接入 AI 我才能补全应用内容哦"); return; }
    askAI(`请根据完整性检查报告补全应用，布局继续遵守我的习惯：\n${appProblems.map((b, i) => `${i + 1}. ${b.title}${b.hint ? `（${b.hint}）` : ""}`).join("\n")}\n如果有需要我决定的地方，请先问我。`);
  };
  const groups = r ? (["资料", "Skill", "页面", "交互", "数据", "体验"] as const).map((g) => [g === "Skill" ? "功能配置" : g, r.items.filter((x) => x.group === g)] as const).filter(([, l]) => l.length) : [];
  const blockers = r?.items.filter((x) => x.level === "must" || x.level === "fail") ?? [];
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_1px_6px_rgba(0,0,0,.05)]">
        <SlimeFace size={52} mood={running ? "think" : !r ? "happy" : r.pass ? "party" : "worry"} />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold text-[#222]">{running ? "正在逐页打开、点按钮、读写数据…" : !r ? "提交前，小珠会帮你做完整性检查" : r.pass ? "完整性检查通过" : "应用还不完整，暂时不能提交审核"}</p>
          {r && <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px]">{(["done", "risk", "must", "fail"] as const).map((l) => <span key={l} style={{ color: LEVEL_TONE[l] }}>{LEVEL_LABEL[l]} {r.summary[l]}</span>)}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <button disabled={running} onClick={submit} className="flex-1 rounded-2xl py-3 text-[14px] font-bold text-white disabled:opacity-50" style={{ background: MINT }}>{r ? "重新检查" : "提交应用"}</button>
        <button disabled={!app.spec.pages.length} onClick={() => setPreview(true)} className="rounded-2xl border border-black/10 bg-white px-4 text-[13px] font-bold text-[#333] disabled:opacity-40">预览</button>
      </div>
      {r && !r.pass && (
        <div className="space-y-2 rounded-2xl border border-[#ffd6d6] bg-[#fff7f7] p-3.5">
          <p className="text-[13.5px] font-bold text-[#d33]">需要先处理 {blockers.length} 项，才能提交审核</p>
          <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-[#444]">{blockers.slice(0, 8).map((b, i) => <li key={i}><b>{b.title}</b>{b.hint && <span className="block text-[11.5px] text-[#888]">下一步：{b.hint}</span>}</li>)}</ol>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button onClick={fix} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold text-white" style={{ background: "#ff8fab" }}>{ai ? "让 AI 自动补全" : "自动补全（需接入 AI）"}</button>
            <button className={pill} onClick={() => goTab("chat")}>回到对话修改</button>
            <button className={pill} onClick={() => goTab("info")}>去补资料</button>
            <button className={pill} onClick={() => goTab("skill")}>去补充填写</button>
          </div>
        </div>
      )}
      {r?.pass && <button onClick={() => goTab("review")} className="w-full rounded-2xl bg-[#5e5ce6] py-3 text-[14px] font-bold text-white">进入审核中心</button>}
      {r && <p className="px-1 pt-1 text-[13px] font-bold text-[#555]">应用完整性检查报告</p>}
      {groups.map(([g, list]) => <ReportGroup key={g} title={g} list={list} />)}
      {preview && <Runner app={app} preview onClose={() => setPreview(false)} />}
    </div>
  );
}
function ReportGroup({ title, list }: { title: string; list: readonly CheckItem[] }) {
  return (
    <section className="rounded-2xl bg-white p-3 shadow-[0_1px_6px_rgba(0,0,0,.05)]">
      <p className="mb-1 text-[12.5px] font-bold text-[#888]">{title}</p>
      {list.map((x, i) => (
        <div key={i} className="flex items-start gap-2 border-b border-black/5 py-1.5 last:border-0">
          <span className="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: LEVEL_TONE[x.level] }}>{LEVEL_LABEL[x.level]}</span>
          <span className="min-w-0 text-[12.5px] text-[#333]">{x.title}{x.hint && x.level !== "done" && <span className="block text-[11px] text-[#999]">{x.hint}</span>}</span>
        </div>
      ))}
    </section>
  );
}

/* ——— 审核中心（也挂在「设置 · 审核中心」） ——— */
export function ReviewPanel({ app, onSlime, onEdit }: { app: UserApp; onSlime?: (t: string) => void; onEdit?: () => void }) {
  const [shot, setShot] = useState<string | null>(null);
  const step = useReviewProgress(app.id);
  const r = app.report;
  const pick = (g: CheckItem["group"][]) => r?.items.filter((x) => g.includes(x.group)) ?? [];
  const skillOk = pick(["Skill"]).every((x) => x.level === "done" || x.level === "risk");
  const testOk = pick(["页面", "交互", "数据"]).every((x) => x.level === "done" || x.level === "risk");
  const last = app.reviews?.[0];
  const submit = () => { patchApp(app.id, { reviewError: undefined }); void startReview(app, onSlime); };
  const edit = onEdit ?? (() => requestStudio(app.id, "chat"));
  const publish = () => { patchApp(app.id, { status: "listed", publishedAt: Date.now(), rating: realRating(app) }); onSlime?.("上架成功！撒花～去「今天」看看你的应用吧"); };
  // 流程条：草稿 → 检查 → 待审核 → 审核中 → 结果 → 上架
  const FLOW: { label: string; on: boolean }[] = [
    { label: "完整性检查", on: !!r?.pass },
    { label: "提交审核", on: ["reviewing", "approved", "rejected", "listed", "delisted"].includes(app.status) },
    { label: app.status === "rejected" ? "审核驳回" : "审核通过", on: ["approved", "rejected", "listed", "delisted"].includes(app.status) },
    { label: "已上架", on: app.status === "listed" },
  ];
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_1px_6px_rgba(0,0,0,.05)]">
        <AppIcon a={app} size={60} />
        <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-bold text-[#222]">{app.spec.name}</p><p className="text-[11.5px] text-[#999]">v{app.meta.version} · {app.meta.category} · {app.meta.developer}</p><div className="mt-1"><StatusChip s={app.status} /></div></div>
      </div>
      <div className="flex items-center rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_6px_rgba(0,0,0,.05)]">
        {FLOW.map((f, i) => (
          <div key={f.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: f.on ? (f.label === "审核驳回" ? "#ff3b30" : MINT) : "#d8d8de" }}>{i + 1}</span>
              <span className="whitespace-nowrap text-[10px]" style={{ color: f.on ? "#333" : "#aaa" }}>{f.label}</span>
            </div>
            {i < FLOW.length - 1 && <span className="mx-1 mb-4 h-px flex-1" style={{ background: FLOW[i + 1].on ? MINT : "#e2e2e6" }} />}
          </div>
        ))}
      </div>
      <p className="rounded-2xl bg-white p-3.5 text-[12.5px] leading-relaxed text-[#555] shadow-[0_1px_6px_rgba(0,0,0,.05)]">{app.spec.intro}</p>
      {app.meta.screenshots.length > 0 && <div className="flex gap-2 overflow-x-auto">{app.meta.screenshots.map((u, i) => <button key={i} onClick={() => setShot(u)} className="shrink-0"><img src={u || undefined} alt="" className="h-40 w-20 rounded-lg object-cover ring-1 ring-black/10" /></button>)}</div>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Res label="完整性检查" ok={!!r?.pass} />
        <Res label="功能配置" ok={!!r && skillOk} />
        <Res label="功能测试" ok={!!r && testOk} />
      </div>
      {r && <ReportGroup title="功能测试结果" list={pick(["页面", "交互", "数据"])} />}

      {app.status === "reviewing" && (
        <section className="space-y-2 rounded-2xl bg-white p-3.5 shadow-[0_1px_6px_rgba(0,0,0,.05)]">
          <p className="flex items-center gap-2 text-[13px] font-bold text-[#0a84ff]"><SlimeFace size={26} mood="think" />审核中…</p>
          {REVIEW_STEPS.map((s, i) => { const st = step ?? 0; const done = i < st, cur = i === st; return (
            <p key={s} className="flex items-center gap-2 text-[12.5px]" style={{ color: done ? MINT : cur ? "#0a84ff" : "#bbb" }}>
              <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] text-white ${cur ? "animate-pulse" : ""}`} style={{ background: done ? MINT : cur ? "#0a84ff" : "#ddd" }}>{done ? "" : i + 1}</span>{s}
            </p>); })}
        </section>
      )}
      {app.reviewError && app.status === "pending" && <p className="rounded-xl bg-[#fff4e5] px-3 py-2 text-[12px] text-[#c66a00]">{app.reviewError}</p>}

      {last && app.status !== "reviewing" && (
        <section className="rounded-2xl p-3.5" style={{ background: last.ok ? "#f0fbf6" : "#fff7f7" }}>
          <p className="flex items-center justify-between text-[13px] font-bold" style={{ color: last.ok ? MINT : "#d33" }}>审核意见<span className="text-[10.5px] font-normal text-[#999]">{last.by} · {new Date(last.at).toLocaleString("zh-CN")}</span></p>
          <p className="mt-1 text-[12.5px] text-[#444]">{last.opinion}</p>
          {last.scores && <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">{Object.entries(last.scores).map(([k, n]) => <div key={k} className="rounded-lg bg-white/70 py-1"><b className="block text-[14px]" style={{ color: n >= 60 ? MINT : "#ff3b30" }}>{n}</b><span className="text-[10px] text-[#999]">{k}</span></div>)}</div>}
          {last.reasons.length > 0 && <><p className="mt-2 text-[12px] font-bold text-[#d33]">驳回原因</p><ol className="list-decimal space-y-0.5 pl-5 text-[12px] text-[#555]">{last.reasons.map((x, i) => <li key={i}>{x}</li>)}</ol></>}
          {last.suggestions.length > 0 && <><p className="mt-2 text-[12px] font-bold text-[#555]">修改建议</p><ul className="list-disc space-y-0.5 pl-5 text-[12px] text-[#555]">{last.suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
        </section>
      )}

      {app.status === "pending" && <Big onClick={submit} c="#5e5ce6">提交审核</Big>}
      {app.status === "rejected" && <div className="flex gap-2"><Big onClick={edit} c={MINT}>回到对话修改</Big><Big onClick={() => requestStudioOr(onEdit, app.id)} c="#ff9500">重新检查</Big></div>}
      {app.status === "approved" && <Big onClick={publish} c="#ff8fab">发布到应用商店</Big>}
      {app.status === "listed" && <Big onClick={() => patchApp(app.id, { status: "delisted" })} c="#8e8e93">下架</Big>}
      {app.status === "delisted" && <Big onClick={() => patchApp(app.id, { status: "listed", publishedAt: Date.now() })} c="#30b0c7">重新上架</Big>}

      {(app.reviews?.length ?? 0) > 1 && (
        <section className="rounded-2xl bg-white p-3 shadow-[0_1px_6px_rgba(0,0,0,.05)]">
          <p className="mb-1 text-[12.5px] font-bold text-[#888]">审核记录</p>
          {app.reviews!.map((x, i) => (
            <div key={i} className="flex items-start gap-2 border-b border-black/5 py-1.5 text-[12px] last:border-0">
              <span className="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: x.ok ? MINT : "#ff3b30" }}>{x.ok ? "通过" : "驳回"}</span>
              <span className="min-w-0 flex-1 text-[#444]">v{x.version} · {x.opinion}<span className="block text-[10.5px] text-[#aaa]">{x.by} · {new Date(x.at).toLocaleString("zh-CN")}</span></span>
            </div>
          ))}
        </section>
      )}
      {!["listed", "reviewing"].includes(app.status) && <button onClick={() => { if (confirm(`删除「${app.spec.name}」？`)) removeApp(app.id); }} className="w-full py-2 text-[12px] text-[#d33]">删除应用</button>}
      {shot && <button onClick={() => setShot(null)} className="absolute inset-0 z-50 grid place-items-center bg-black/80"><img src={shot || undefined} alt="" className="max-h-[90%] max-w-[90%] rounded-xl" /></button>}
    </div>
  );
}
/* 驳回后重新检查：工坊内直接切到「检查」，设置里则跳回工坊 */
const requestStudioOr = (onEdit: (() => void) | undefined, id: string) => { patchApp(id, { status: "draft", report: undefined }); if (!onEdit) requestStudio(id, "check"); };
const Res = ({ label, ok }: { label: string; ok: boolean }) => <div className="rounded-2xl bg-white py-2.5 shadow-[0_1px_6px_rgba(0,0,0,.05)]"><p className="text-[16px] font-bold" style={{ color: ok ? MINT : "#ff3b30" }}>{ok ? "通过" : "未通过"}</p><p className="text-[11px] text-[#999]">{label}</p></div>;
const Big = ({ onClick, c, children }: { onClick: () => void; c: string; children: ReactNode }) => <button onClick={onClick} className="flex-1 w-full rounded-2xl py-3 text-[14px] font-bold text-white" style={{ background: c }}>{children}</button>;

/* ——— 应用商店里的「玩家作品」 ——— */
export function PlayerApps({ variant }: { variant: "today" | "list" }) {
  const apps = useUserApps().filter((a) => a.status === "listed");
  const [detail, setDetail] = useState<UserApp | null>(null);
  const [run, setRun] = useState<UserApp | null>(null);
  if (!apps.length) return null;
  return (
    <>
      {variant === "today" ? (
        <div className="overflow-hidden rounded-[18px] bg-gradient-to-br from-[#e6fff4] to-[#fff0f6] p-4 shadow-[0_2px_20px_rgba(0,0,0,0.08)]">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#3fb68b]">玩家作品</p>
          <p className="text-[22px] font-extrabold leading-tight text-[#2b2140]">开发者工坊出品</p>
          <div className="mt-3 space-y-2">{apps.slice(0, 4).map((a) => <AppRow key={a.id} a={a} onOpen={() => setDetail(a)} onRun={() => setRun(a)} />)}</div>
        </div>
      ) : (
        <>
          <p className="px-4 pb-0 pt-4 text-[18px] font-bold text-ink">玩家作品</p>
          <p className="px-4 text-[12.5px] text-ink-soft">通过审核、由开发者工坊发布的应用</p>
          <div className="mx-4 divide-y divide-black/[0.06]">{apps.map((a) => <AppRow key={a.id} a={a} onOpen={() => setDetail(a)} onRun={() => setRun(a)} />)}</div>
        </>
      )}
      {detail && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-white animate-[slimePop_.2s_ease-out]">
          <button onClick={() => setDetail(null)} className="px-4 pt-3 text-[15px] text-[#0a84ff]">‹ 返回</button>
          <div className="flex gap-4 px-4 pt-3">
            <AppIcon a={detail} size={96} />
            <div className="min-w-0 flex-1"><p className="text-[20px] font-bold text-[#222]">{detail.spec.name}</p><p className="text-[13px] text-[#888]">{detail.meta.developer}</p>
              <button onClick={() => setRun(detail)} className="mt-3 rounded-full bg-[#0a84ff] px-6 py-1.5 text-[14px] font-bold text-white">使用</button></div>
          </div>
          <div className="mx-4 mt-4 grid grid-cols-3 border-y border-black/[0.06] py-2 text-center text-[11px] text-[#999]">
            <span><b className="block text-[15px] text-[#555]">{detail.rating?.toFixed(1) ?? "—"}</b>评分</span>
            <span><b className="block text-[15px] text-[#555]">v{detail.meta.version}</b>版本</span>
            <span><b className="block text-[15px] text-[#555]">{detail.meta.category}</b>分类</span>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-3">{detail.meta.screenshots.map((u, i) => <img key={i} src={u || undefined} alt="" className="h-64 w-32 shrink-0 rounded-xl object-cover ring-1 ring-black/10" />)}</div>
          <p className="px-4 text-[13.5px] leading-relaxed text-[#444]">{detail.spec.intro}</p>
          <p className="px-4 pb-8 pt-3 text-[11.5px] text-[#aaa]">更新于 {new Date(detail.publishedAt ?? detail.updatedAt).toLocaleString("zh-CN")}</p>
        </div>
      )}
      {run && <Runner app={run} onClose={() => setRun(null)} />}
    </>
  );
}
function AppRow({ a, onOpen, onRun }: { a: UserApp; onOpen: () => void; onRun: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onOpen} className="flex cursor-pointer items-center gap-3 py-2">
      <AppIcon a={a} size={54} />
      <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold text-[#222]">{a.spec.name}</p><p className="truncate text-[12px] text-[#888]">{a.spec.intro}</p><p className="text-[11px] text-[#aaa]">{a.rating != null ? `${a.rating.toFixed(1)} 分 · ` : ""}{a.meta.developer} · v{a.meta.version}</p></div>
      <button onClick={(e) => { e.stopPropagation(); onRun(); }} className="shrink-0 rounded-full bg-[#e9e9ef] px-4 py-1.5 text-[13px] font-bold text-[#0a84ff]">使用</button>
    </div>
  );
}

/* ——— 设置 · 审核中心：列出全部应用，未通过检查的显示锁定 ——— */
export function ReviewCenter() {
  const apps = useUserApps();
  useEffect(() => { recoverStaleReviews(apps); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [id, setId] = useState<string | null>(null);
  const app = apps.find((a) => a.id === id);
  if (app) return (<div className="relative"><button onClick={() => setId(null)} className="px-4 pt-2 text-[14px] text-[#0a84ff]">‹ 全部应用</button>{passed(app) ? <ReviewPanel app={app} /> : <div className="p-6 text-center text-[13px] text-[#888]">「{app.spec.name || "未命名"}」还没通过完整性检查。<br /><button onClick={() => requestStudio(app.id, "check")} className="mt-3 rounded-full px-4 py-1.5 text-[13px] font-bold text-white" style={{ background: MINT }}>去开发者工坊检查</button></div>}</div>);
  return (
    <div className="space-y-2 p-3">
      {!apps.length && <p className="py-12 text-center text-[13px] text-[#999]">还没有应用。去应用商店点一下小珠，开始做第一个吧。</p>}
      {apps.map((a) => (
        <button key={a.id} onClick={() => setId(a.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left">
          <AppIcon a={a} size={42} /><span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#222]">{a.spec.name || "未命名应用"}</span>
          {!passed(a) && <span className="text-[11px] text-[#aaa]">未解锁</span>}<StatusChip s={a.status} />
        </button>
      ))}
    </div>
  );
}

/* 评分来自审核员的真实打分（0~100 → 5 分制），没有打分就不显示 */
function realRating(a: UserApp): number | undefined {
  const sc = a.reviews?.find((r) => r.ok && r.scores)?.scores;
  const v = sc ? Object.values(sc).filter((x) => typeof x === "number") : [];
  return v.length ? Math.round((v.reduce((x, y) => x + y, 0) / v.length / 20) * 10) / 10 : undefined;
}
