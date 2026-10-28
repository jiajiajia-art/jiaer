/* 信息：仿 iOS「信息」（大标题、搜索栏、圆头像列表、蓝色强调、iMessage 气泡由 ChatView 提供） */
import { useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { ensurePhone, phoneNumber, openThread, threadFor, pushMsg, msgId, gameMinutes, gameTimeLabel, type ChatMsg } from "../../game/phone";
import { useWorldSync, syncJson, loadFeed, saveFeed } from "./worldSync";
import { Empty } from "./shared";
import { ChatView } from "./chat";
import { IconEdit, IconSearch, IconClose } from "./icons";
import { liveTerm as T } from "../../mods/live";

const IOS_BLUE = "#0b8aff";

function timeLabel(m?: ChatMsg) {
  if (!m?.label) return "";
  return m.label.split(" ").pop() ?? "";
}

/* 服务号短信（经纪公司 / 剧组 / 银行 / 快递…）：只读会话，localStorage 持久化 */
type SvcMsg = { id: string; text: string; label: string; ts: number };
type SvcThread = { id: string; title: string; msgs: SvcMsg[]; unread: number; lastTs: number };
const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

function SvcView({ t, onBack }: { t: SvcThread; onBack: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center border-b border-black/5 px-4 py-2 text-[15px]">
        <button onClick={onBack} className="w-16 text-left" style={{ color: IOS_BLUE }}>‹ 信息</button>
        <span className="flex-1 truncate text-center font-semibold text-ink">{t.title}</span>
        <span className="w-16" />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {t.msgs.map((m) => (
          <div key={m.id}>
            <p className="mb-1 text-center text-[11px] text-ink-soft/70">{m.label}</p>
            <div className="max-w-[80%] rounded-2xl bg-[#e9e9eb] px-3 py-2 text-[14.5px] text-ink">{m.text}</div>
          </div>
        ))}
      </div>
      <p className="border-t border-black/5 py-2 text-center text-[12px] text-ink-soft">此号码不支持回复</p>
    </div>
  );
}

export default function SmsApp({ onBack }: { onBack: () => void }) {
  const { game, cfg, commitGame, patchGame } = useGame();
  const ph = ensurePhone(game!).phone!;
  const [svc, setSvc] = useState<SvcThread[]>(() => { const f = loadFeed<SvcThread[]>("sms"); return Array.isArray(f) ? f : []; });
  const putSvc = (next: SvcThread[]) => { setSvc(next); saveFeed("sms", next); };

  /* 右上角刷新：联动剧情生成新短信（服务号通知 + 联系人短信） */
  useWorldSync("sms", async () => {
    const g0 = ensurePhone(game!);
    const people = g0.phone!.contacts.map((id) => g0.npcs.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
    const res = await syncJson<{ notices?: unknown; texts?: unknown }>(cfg, g0, "sms", "信息",
      `为手机短信生成新内容。1) notices：1~3 条服务号/机构短信（如经纪公司、剧组${T("gig")}、片方、银行、快递、运营商），sender 为机构名（≤12 字），text ≤90 字，内容需与当前剧情/行程相关；2) texts：0~2 条联系人发来的短信，pid 只能从【联系人】中选。
【联系人】${people.map((n) => `${n.id}=${n.name}`).join("、") || "（无）"}
返回 {"notices":[{"sender":"","text":""}],"texts":[{"pid":"","text":""}]}`);
    if (!res) return "未配置 AI，无法联动剧情";
    const label = gameTimeLabel(g0);
    let next = [...svc];
    let nSvc = 0;
    for (const raw of Array.isArray(res.notices) ? res.notices.slice(0, 4) : []) {
      const m = raw as { sender?: unknown; text?: unknown };
      const title = str(m?.sender, 16), text = str(m?.text, 200);
      if (!title || !text) continue;
      const ts = Date.now() + nSvc;
      const msg: SvcMsg = { id: msgId(), text, label, ts };
      const ex = next.find((t) => t.title === title);
      next = ex
        ? next.map((t) => (t === ex ? { ...t, msgs: [...t.msgs, msg].slice(-30), unread: t.unread + 1, lastTs: ts } : t))
        : [{ id: `svc_${msgId()}`, title, msgs: [msg], unread: 1, lastTs: ts }, ...next];
      nSvc++;
    }
    const ok = new Set(people.map((n) => n.id));
    const texts = (Array.isArray(res.texts) ? res.texts.slice(0, 3) : []).map((raw) => {
      const m = raw as { pid?: unknown; text?: unknown };
      return { pid: str(m?.pid, 60), text: str(m?.text, 200) };
    }).filter((m) => ok.has(m.pid) && m.text);
    const nTxt = texts.length;
    if (nSvc) putSvc(next.slice(0, 30));
    // 落库基于最新存档：AI 生成要几秒，期间调过的好感 / 爱慕、刚聊的消息不能被发起刷新时的旧快照覆盖
    if (nTxt) patchGame((cur) => {
      let g = ensurePhone(cur);
      for (const [i, m] of texts.entries()) {
        if (!threadFor(g.phone!, m.pid)) g = openThread(g, m.pid);
        g = pushMsg(g, threadFor(g.phone!, m.pid)!.id, { id: msgId(), role: "npc", text: m.text, ts: Date.now() + 10 + i, gt: gameMinutes(g), label });
      }
      return g;
    });
    return nSvc + nTxt ? `收到 ${nSvc + nTxt} 条新信息` : "暂时没有新信息";
  });

  const [svcOpen, setSvcOpen] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const thread = open ? ph.threads.find((t) => t.id === open) : null;
  const svcThread = svcOpen ? svc.find((t) => t.id === svcOpen) : null;
  if (svcThread) return <SvcView t={svcThread} onBack={() => setSvcOpen(null)} />;
  if (thread) return <ChatView thread={thread} onBack={() => setOpen(null)} sms />;
  if (picking) {
    const people = ph.contacts.map((id) => game!.npcs.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="flex items-center px-4 py-2 text-[15px]">
          <span className="flex-1 text-[17px] font-semibold text-ink">新信息</span>
          <button onClick={() => setPicking(false)} style={{ color: IOS_BLUE }}>取消</button>
        </div>
        <p className="border-b border-black/5 px-4 pb-2 text-[13px] text-ink-soft">收件人：</p>
        <div className="flex-1 overflow-y-auto">
          {people.length === 0 ? <Empty text="通讯录还是空的。先在「人脉」交换联系方式。" /> : people.map((n) => (
            <button key={n.id} onClick={() => { commitGame(openThread(game!, n.id)); setPicking(false); setOpen(`th_${n.id}`); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-black/5">
              <Avatar src={n.avatar} name={n.name} size={38} editable={false} />
              <div className="min-w-0 flex-1 border-b border-black/5 pb-2.5">
                <p className="text-[15px] text-ink">{n.name}</p>
                <p className="text-[12px] tabular-nums text-ink-soft">{phoneNumber(n.id)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  const q = query.trim();
  const threads = [...ph.threads]
    .filter((t) => t.kind === "private" && (!q || t.title.includes(q)))
    .sort((a, b) => b.lastTs - a.lastTs);
  const svcShown = svc.filter((t) => !q || t.title.includes(q));
  const openSvc = (id: string) => { putSvc(svc.map((t) => (t.id === id ? { ...t, unread: 0 } : t))); setSvcOpen(id); };
  type Row = { kind: "chat"; t: (typeof threads)[number]; ts: number } | { kind: "svc"; t: SvcThread; ts: number };
  const rows: Row[] = [...threads.map((t) => ({ kind: "chat" as const, t, ts: t.lastTs })), ...svcShown.map((t) => ({ kind: "svc" as const, t, ts: t.lastTs }))].sort((a, b) => b.ts - a.ts);

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* iOS 顶栏：编辑 / 标题 / 新建 */}
      <div className="flex items-center justify-between px-4 pb-1 pt-1 text-[15px]" style={{ color: IOS_BLUE }}>
        <button onClick={onBack}>‹ 主屏</button>
        <button onClick={() => setPicking(true)} aria-label="新建"><IconEdit size={20} /></button>
      </div>
      <div className="px-4 pb-2">
        <h1 className="text-[30px] font-bold tracking-tight text-ink">信息</h1>
        <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-black/[0.06] px-2.5 py-1.5 text-[14px]">
          <span className="text-ink-soft"><IconSearch size={16} /></span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索" className="flex-1 bg-transparent text-ink outline-none placeholder:text-ink-soft/70" />
          {query && <button onClick={() => setQuery("")} className="text-ink-soft/60" aria-label="清除"><IconClose size={15} /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <Empty text={q ? "没有匹配的会话。" : "没有信息。先在「人脉」交换联系方式，才能收发短信。"} />
        ) : (
          rows.map((r) => {
            if (r.kind === "svc") {
              const t = r.t;
              const last = t.msgs[t.msgs.length - 1];
              return (
                <button key={t.id} onClick={() => openSvc(t.id)} className="flex w-full items-center gap-3 pl-4 text-left active:bg-black/5">
                  <div className="relative shrink-0">
                    <Avatar name={t.title} size={50} editable={false} />
                    {t.unread > 0 && <span className="absolute -left-0.5 top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-3 rounded-full" style={{ background: IOS_BLUE }} />}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center border-b border-black/[0.07] py-2.5 pr-4">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[16px] font-semibold text-ink">{t.title}</span>
                      <span className="ml-auto shrink-0 text-[12.5px] text-ink-soft/70">{last?.label.split(" ").pop()} ›</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-soft">{last?.text}</p>
                  </div>
                </button>
              );
            }
            const t = r.t;
            const npc = game!.npcs.find((n) => n.id === t.personId);
            const last = [...t.msgs].reverse().find((m) => m.role !== "sys");
            return (
              <button key={t.id} onClick={() => setOpen(t.id)} className="flex w-full items-center gap-3 pl-4 text-left active:bg-black/5">
                <div className="relative shrink-0">
                  <Avatar src={npc?.avatar} name={t.title} size={50} editable={false} />
                  {t.unread > 0 && <span className="absolute -left-0.5 top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-3 rounded-full" style={{ background: IOS_BLUE }} />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center border-b border-black/[0.07] py-2.5 pr-4">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[16px] font-semibold text-ink">{t.title}</span>
                    <span className="ml-auto shrink-0 text-[12.5px] text-ink-soft/70">{timeLabel(last)} ›</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-soft">{last?.text ?? phoneNumber(t.personId!)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
