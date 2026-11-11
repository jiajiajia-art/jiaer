/* 邮箱：角色来信、平台 / 机构通知；可回复与写信。
 * 主角发给角色的邮件会标记「等待回复」，线下剧情会在合适的时机让对方回信。
 * 右上角刷新：结合主角最近的手机操作与剧情，生成平台 / 机构邮件。 */
import { useMemo, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { ensurePhone, type Mail } from "../../game/phone";
import { logAct, mailUnread, readMail, receiveMail, sendMail } from "../../game/phoneLink";
import { useWorldSync, syncJson } from "./worldSync";
import { Empty } from "./shared";

const BLUE = "#0a84ff";
const str = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
const day = (label: string) => label.split(" ").slice(0, -1).join(" ") || label;
const clock = (label: string) => label.split(" ").pop() ?? "";

export default function MailApp({ onBack }: { onBack: () => void }) {
  const { game, cfg, commitGame, patchGame } = useGame();
  const ph = ensurePhone(game!).phone!;
  const mails = ph.mails ?? [];
  const [box, setBox] = useState<"in" | "sent">("in");
  const [openId, setOpenId] = useState<string | null>(null);
  const [compose, setCompose] = useState<{ to?: string; subject?: string; replyTo?: string } | null>(null);
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); };

  useWorldSync("mail", async () => {
    const g0 = ensurePhone(game!);
    const recent = (g0.phone!.acts ?? []).slice(-12).map((a) => `${a.app}：${a.text}`).join("\n") || "（暂无）";
    const res = await syncJson<{ mails?: unknown }>(cfg, g0, "mail", "邮箱",
      `生成 1~3 封刚收到的邮件，来自平台或机构（订单与物流通知、平台活动、工作 / 合作邀约、粉丝来信、学校 / 公司通知、银行账单等），紧扣当前剧情与主角最近的手机操作：\n${recent}\n不要冒充圈内具体人物（人物的私人来信由剧情决定）。body 80~260 字，像真实邮件，有称呼与落款。\n返回 {"mails":[{"from":"发件机构名","subject":"主题(≤24字)","body":"正文"}]}`);
    if (!res) return "未配置 AI，无法联动剧情";
    const mails = (Array.isArray(res.mails) ? res.mails.slice(0, 3) : []).map((raw) => {
      const m = raw as { from?: unknown; subject?: unknown; body?: unknown };
      return { fromName: str(m?.from, 20) || "系统通知", subject: str(m?.subject, 40), body: str(m?.body, 1200) };
    }).filter((m) => m.subject || m.body);
    if (!mails.length) return "暂时没有新邮件";
    // 落库基于最新存档：AI 生成要几秒，期间调过的好感 / 爱慕、刚聊的消息不能被发起刷新时的旧快照覆盖
    patchGame((cur) => mails.reduce((g, m) => receiveMail(g, { from: m.fromName, fromName: m.fromName, to: "me", subject: m.subject || "（无主题）", body: m.body, kind: "org" }), ensurePhone(cur)));
    return `收到 ${mails.length} 封新邮件`;
  });

  const inbox = mails.filter((m) => m.to === "me");
  const sent = mails.filter((m) => m.from === "me");
  const list = box === "in" ? inbox : sent;
  const unread = mailUnread(game!);
  const open = openId ? mails.find((m) => m.id === openId) : undefined;
  const people = useMemo(() => game!.npcs.filter((n) => n.name && !n.id.startsWith("stranger")).slice(0, 60), [game]);
  const npcOf = (id: string) => game!.npcs.find((n) => n.id === id);

  if (compose) {
    return <Composer init={compose} people={people} onCancel={() => setCompose(null)} onSend={(to, subject, body) => {
      patchGame((g) => sendMail(g, to, subject, body, compose.replyTo));
      setCompose(null); setOpenId(null); setBox("sent");
      flash(`已发送。${npcOf(to)?.name ?? "对方"}会在之后的剧情里择机回信`);
    }} />;
  }

  if (open) {
    const mine = open.from === "me";
    const npc = mine ? npcOf(open.to) : npcOf(open.from);
    const thread = [open, ...mails.filter((m) => m.replyTo === open.id || m.id === open.replyTo)].sort((a, b) => a.ts - b.ts);
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="flex items-center justify-between border-b border-black/5 px-3 py-2.5">
          <button onClick={() => setOpenId(null)} className="text-[15px]" style={{ color: BLUE }}>‹ {box === "in" ? "收件箱" : "已发送"}</button>
          {!mine && open.kind === "person" && npc && (
            <button onClick={() => setCompose({ to: npc.id, subject: open.subject.startsWith("回复：") ? open.subject : `回复：${open.subject}`, replyTo: open.id })} className="rounded-full px-3 py-1 text-[13px] font-semibold text-white" style={{ background: BLUE }}>回复</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <h2 className="px-4 pb-2 pt-4 text-[20px] font-semibold leading-snug text-[#1c1c1e]">{open.subject}</h2>
          {thread.map((m) => {
            const me = m.from === "me";
            const who = me ? game!.player : npcOf(m.from);
            return (
              <article key={m.id} className="border-t border-black/[0.06] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar src={who?.avatar} name={me ? game!.player.name : m.fromName} size={36} editable={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-[#1c1c1e]">{me ? `我 → ${m.toName ?? npcOf(m.to)?.name ?? ""}` : m.fromName}</p>
                    <p className="text-[11.5px] text-[#8a8a8e]">{m.label}{me && m.awaiting ? " · 等待回复" : ""}</p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-[1.7] text-[#1c1c1e]">{m.body || "（无正文）"}</p>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[#f2f2f7]">
      <div className="flex items-end justify-between bg-[#f2f2f7] px-4 pb-2 pt-2">
        <div>
          <button onClick={onBack} className="text-[14px]" style={{ color: BLUE }}>‹ 主屏</button>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight text-[#1c1c1e]">{box === "in" ? "收件箱" : "已发送"}</h1>
          <p className="text-[12px] text-[#8a8a8e]">{box === "in" ? (unread ? `${unread} 封未读` : "全部已读") : `${sent.filter((m) => m.awaiting).length} 封等待回复`}</p>
        </div>
        <button onClick={() => setCompose({})} aria-label="写邮件" className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5" style={{ color: BLUE }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </button>
      </div>
      <div className="mx-4 mb-2 grid grid-cols-2 rounded-[9px] bg-black/[0.06] p-0.5 text-[13px] font-medium">
        {(["in", "sent"] as const).map((b) => (
          <button key={b} onClick={() => setBox(b)} className={`rounded-[7px] py-1.5 transition ${box === b ? "bg-white text-[#1c1c1e] shadow-sm" : "text-[#6c6c70]"}`}>{b === "in" ? `收件箱${unread ? ` · ${unread}` : ""}` : "已发送"}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {!list.length ? (
          <Empty text={box === "in" ? "还没有邮件。剧情推进、使用各个 App 时都可能收到来信；右上角刷新也能拉取新邮件。" : "还没发过邮件。点右上角的笔，给认识的人写一封。"} />
        ) : (
          <div className="mx-4 mb-6 overflow-hidden rounded-[12px] bg-white">
            {list.map((m: Mail) => {
              const me = m.from === "me";
              const who = me ? npcOf(m.to) : npcOf(m.from);
              return (
                <button key={m.id} onClick={() => { setOpenId(m.id); if (!me && !m.read) { commitGame(logAct(readMail(game!, m.id), { app: "邮箱", text: "读了邮件", bit: `《${m.subject}》${m.fromName}`, key: "mail:read", min: 2 })); } }}
                  className="flex w-full gap-3 border-b border-black/[0.06] px-3 py-3 text-left last:border-b-0 active:bg-black/[0.03]">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: !me && !m.read ? BLUE : "transparent" }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`min-w-0 flex-1 truncate text-[15px] ${!me && !m.read ? "font-semibold" : "font-medium"} text-[#1c1c1e]`}>{me ? `致 ${m.toName ?? who?.name ?? ""}` : m.fromName}</span>
                      <span className="shrink-0 text-[11.5px] text-[#8a8a8e]" title={m.label}>{clock(m.label)}</span>
                    </div>
                    <p className="truncate text-[13.5px] text-[#1c1c1e]">{m.subject}</p>
                    <p className="line-clamp-2 text-[12.5px] leading-snug text-[#8a8a8e]">{m.body}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-[10.5px]">
                      <span className="text-[#8a8a8e]">{day(m.label)}</span>
                      {m.kind === "org" && <span className="rounded-[4px] bg-black/[0.05] px-1 text-[#6c6c70]">通知</span>}
                      {me && m.awaiting && <span className="rounded-[4px] px-1 font-medium" style={{ color: BLUE, background: "#0a84ff14" }}>等待回复</span>}
                      {m.replyTo && !me && <span className="rounded-[4px] bg-emerald-500/10 px-1 font-medium text-emerald-600">回信</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {toast && <div className="pointer-events-none absolute inset-x-6 bottom-8 rounded-full bg-black/75 px-4 py-2 text-center text-[12.5px] text-white">{toast}</div>}
    </div>
  );
}

function Composer({ init, people, onCancel, onSend }: {
  init: { to?: string; subject?: string; replyTo?: string };
  people: { id: string; name: string; avatar?: string }[];
  onCancel: () => void;
  onSend: (to: string, subject: string, body: string) => void;
}) {
  const [to, setTo] = useState(init.to ?? "");
  const [subject, setSubject] = useState(init.subject ?? "");
  const [body, setBody] = useState("");
  const ok = !!to && (subject.trim() || body.trim());
  const row = "flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 text-[14.5px]";
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-black/5 px-3 py-2.5">
        <button onClick={onCancel} className="text-[15px]" style={{ color: BLUE }}>取消</button>
        <span className="text-[15px] font-semibold text-[#1c1c1e]">{init.replyTo ? "回复邮件" : "新邮件"}</span>
        <button disabled={!ok} onClick={() => onSend(to, subject, body)} className="rounded-full px-3 py-1 text-[13px] font-semibold text-white disabled:opacity-35" style={{ background: BLUE }}>发送</button>
      </div>
      <label className={row}>
        <span className="shrink-0 text-[#8a8a8e]">收件人</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} disabled={!!init.replyTo} className="min-w-0 flex-1 bg-transparent text-[#1c1c1e] outline-none">
          <option value="">选择认识的人</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className={row}>
        <span className="shrink-0 text-[#8a8a8e]">主题</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 40))} className="min-w-0 flex-1 bg-transparent text-[#1c1c1e] outline-none" />
      </label>
      <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 1500))} placeholder="写点什么……对方读到后，会在之后的剧情里择机回信。" className="min-h-0 flex-1 resize-none px-4 py-3 text-[14.5px] leading-[1.7] text-[#1c1c1e] outline-none placeholder:text-[#b0b0b5]" />
    </div>
  );
}
