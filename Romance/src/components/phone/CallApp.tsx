/* 电话：拨号盘 / 联系人 / 通话记录 + 接通会话（AI 驱动 + 计时 + 通话记录回看） */
import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import {
  applyChatEffects,
  ensurePhone,
  gameMinutes,
  gameTimeLabel,
  logCall,
  msgId,
  phoneNumber,
  type CallRecord,
  type ChatMsg,
  type Thread,
} from "../../game/phone";
import { requestChatReply } from "../../lib/phoneChat";
import { isConfigured } from "../../lib/ai";
import type { GameState } from "../../lib/types";
import { TopBar, BottomTabs, Empty, delay, fmtDur } from "./shared";
import { IconCallOut, IconClose, IconPhone, IconBackspace } from "./icons";

type CallTarget = { pid?: string; name: string; number: string };

function RecentCalls({ calls }: { calls: CallRecord[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const rec = calls.find((c) => c.id === open);
  if (rec) {
    return (
      <div className="bg-white">
        <button onClick={() => setOpen(null)} className="px-3 py-2 text-[13px] text-ink-soft">‹ 通话记录</button>
        <div className="border-y border-black/5 px-4 py-3 text-center">
          <p className="font-semibold text-ink">{rec.name}</p>
          <p className="text-[12px] text-ink-soft">{rec.number} · 通话 {fmtDur(rec.durationSec)}</p>
        </div>
        <div className="space-y-1.5 px-3 py-3">
          {(rec.transcript ?? []).filter((m) => m.role !== "sys").map((m) => (
            <div key={m.id} className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}>
              <span className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-[13px] ${m.role === "me" ? "bg-sky-500 text-white" : "bg-black/5 text-ink"}`}>{m.text}</span>
            </div>
          ))}
          {!(rec.transcript ?? []).length && <p className="text-center text-[12px] text-ink-soft">通话未产生对话。</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white">
      {calls.map((c) => (
        <button key={c.id} onClick={() => setOpen(c.id)} className="flex w-full items-center gap-3 border-b border-black/5 px-3 py-2.5 text-left">
          <span className={c.outcome === "connected" ? "text-emerald-500" : "text-red-500"}>{c.outcome === "connected" ? <IconCallOut size={18} /> : <IconClose size={18} />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{c.name}</p>
            <p className="text-[11.5px] text-ink-soft">{c.outcome === "connected" ? `通话 ${fmtDur(c.durationSec)}` : c.outcome === "declined" ? "对方未接" : "未接通"} · {c.number}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/* 接通后计时 + 对话框（AI 驱动，收尾写入通话记录） */
function CallSession({ target, onEnd }: { target: CallTarget; onEnd: () => void }) {
  const { game, cfg, commitGame } = useGame();
  const gRef = useRef<GameState>(game!);
  gRef.current = game!;
  const [phase, setPhase] = useState<"ringing" | "live" | "declined">("ringing");
  const [sec, setSec] = useState(0);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const known = !!target.pid;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const rel = target.pid ? gRef.current.sim.rel[target.pid] ?? 0 : 0;
      const chance = known ? Math.min(0.95, 0.6 + rel / 200) : 0.15;
      if (Math.random() < chance) {
        setPhase("live");
        timer.current = setInterval(() => setSec((s) => s + 1), 1000);
      } else {
        setPhase("declined");
      }
    }, 1600);
    return () => { clearTimeout(t); if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [msgs.length, typing]);

  const end = () => {
    if (timer.current) clearInterval(timer.current);
    if (target.pid && (phase === "live" || sec > 0)) {
      const rec: CallRecord = {
        id: msgId(), personId: target.pid, name: target.name, number: target.number,
        ts: Date.now(), durationSec: sec, outcome: phase === "declined" ? "declined" : "connected",
        transcript: msgs,
      };
      let g = logCall(gRef.current, rec);
      if (phase === "live" && sec > 5) g = applyChatEffects(g, target.pid, { relDelta: Math.min(4, 1 + Math.floor(sec / 60)), stressDelta: -3, memory: `一通${fmtDur(sec)}的电话` });
      commitGame(g);
    } else if (target.pid && phase === "declined") {
      commitGame(logCall(gRef.current, { id: msgId(), personId: target.pid, name: target.name, number: target.number, ts: Date.now(), durationSec: 0, outcome: "declined" }));
    }
    onEnd();
  };

  const speak = async () => {
    if (!draft.trim() || !target.pid || phase !== "live") return;
    const text = draft.trim(); setDraft("");
    const mine: ChatMsg = { id: msgId(), role: "me", text, ts: Date.now(), gt: gameMinutes(gRef.current), label: gameTimeLabel(gRef.current) };
    const local = [...msgs, mine];
    setMsgs(local);
    if (!isConfigured(cfg)) return;
    setTyping(true);
    const pseudo: Thread = { id: `call_${target.pid}`, kind: "private", personId: target.pid, title: target.name, msgs: local, unread: 0, lastTs: Date.now() };
    try {
      const reply = await requestChatReply(cfg, gRef.current, pseudo, text);
      for (const b of reply.bubbles) {
        await delay(500 + Math.min(1200, b.length * 40));
        setMsgs((cur) => [...cur, { id: msgId(), role: "npc", text: b, ts: Date.now(), gt: gameMinutes(gRef.current), label: gameTimeLabel(gRef.current) }]);
      }
    } catch { /* 忽略 */ }
    setTyping(false);
  };

  const npc = target.pid ? game!.npcs.find((n) => n.id === target.pid) : undefined;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-sky-900 to-slate-900 text-white">
      <div className="flex flex-col items-center pt-10">
        <Avatar src={npc?.avatar} name={target.name} size={88} editable={false} />
        <p className="mt-3 text-xl font-semibold">{target.name}</p>
        <p className="text-[12px] tabular-nums text-white/70">{target.number}</p>
        <p className="mt-2 text-[13px] text-white/80">
          {phase === "ringing" ? "正在呼叫…" : phase === "declined" ? "对方无法接听" : `通话中 ${fmtDur(sec)}`}
        </p>
      </div>

      {phase === "live" && (
        <div ref={scroller} className="mt-4 flex-1 space-y-2 overflow-y-auto px-4">
          {!known && <p className="text-center text-[12px] text-white/60">陌生号码，通话不会记录关系。</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}>
              <span className={`max-w-[78%] rounded-2xl px-3 py-2 text-[13.5px] ${m.role === "me" ? "bg-sky-500" : "bg-white/15"}`}>{m.text}</span>
            </div>
          ))}
          {typing && <p className="text-[12px] text-white/60">对方正在说话…</p>}
        </div>
      )}
      {phase !== "live" && <div className="flex-1" />}

      {phase === "live" && known && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void speak(); }} placeholder="说点什么…" className="flex-1 rounded-full bg-white/15 px-4 py-2 text-[13.5px] text-white outline-none placeholder:text-white/50" />
          <button onClick={() => void speak()} className="rounded-full bg-sky-500 px-4 py-2 text-[13px] font-semibold">说</button>
        </div>
      )}

      <div className="flex justify-center pb-8 pt-3">
        <button onClick={end} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg" aria-label="挂断"><IconClose size={26} /></button>
      </div>
    </div>
  );
}

export default function CallApp({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const ph = ensurePhone(game!).phone!;
  const [tab, setTab] = useState<"keypad" | "contacts" | "recents">("keypad");
  const [dial, setDial] = useState("");
  const [calling, setCalling] = useState<CallTarget | null>(null);

  const numMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const pid of ph.contacts) m[phoneNumber(pid).replace(/\D/g, "")] = pid;
    return m;
  }, [ph.contacts]);

  if (calling) return <CallSession target={calling} onEnd={() => { setCalling(null); setDial(""); }} />;

  const dialCall = () => {
    const digits = dial.replace(/\D/g, "");
    const pid = numMap[digits];
    if (pid) setCalling({ pid, name: game!.npcs.find((n) => n.id === pid)?.name ?? "联系人", number: phoneNumber(pid) });
    else setCalling({ name: "未知号码", number: dial });
  };

  return (
    <div className="flex h-full flex-col bg-[#f7f8fa]">
      <TopBar title="电话" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        {tab === "keypad" && (
          <div className="flex flex-col items-center px-5 pt-5">
            <div className="mb-5 flex h-10 items-center text-center text-[34px] font-light leading-none tracking-[0.06em] tabular-nums text-ink">{dial || <span className="text-ink-soft/35 text-[26px]">输入号码</span>}</div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
              {[
                { k: "1", s: "" }, { k: "2", s: "ABC" }, { k: "3", s: "DEF" },
                { k: "4", s: "GHI" }, { k: "5", s: "JKL" }, { k: "6", s: "MNO" },
                { k: "7", s: "PQRS" }, { k: "8", s: "TUV" }, { k: "9", s: "WXYZ" },
                { k: "*", s: "" }, { k: "0", s: "+" }, { k: "#", s: "" },
              ].map(({ k, s }) => (
                <button
                  key={k}
                  onClick={() => setDial((d) => (d + k).slice(0, 13))}
                  className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition active:scale-90 active:bg-black/[0.06]"
                >
                  <span className="text-[32px] font-normal leading-none text-ink">{k}</span>
                  {s && <span className="mt-0.5 text-[10px] font-semibold leading-none tracking-[0.18em] text-ink-soft">{s}</span>}
                </button>
              ))}
            </div>
            <div className="mt-6 grid w-full max-w-[300px] grid-cols-3 items-center">
              <span />
              <button onClick={dialCall} disabled={!dial} className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition active:scale-90 disabled:opacity-40" aria-label="拨号"><IconPhone size={30} /></button>
              <button onClick={() => setDial((d) => d.slice(0, -1))} className={`mx-auto text-ink-soft transition active:scale-90 ${dial ? "opacity-100" : "opacity-0"}`} aria-label="删除"><IconBackspace size={28} /></button>
            </div>
          </div>
        )}
        {tab === "contacts" && (
          ph.contacts.length === 0 ? <Empty text="没有联系人。交换联系方式后可直接拨号。" /> : (
            <div className="bg-white">
              {ph.contacts.map((pid) => {
                const npc = game!.npcs.find((n) => n.id === pid);
                return (
                  <div key={pid} className="flex items-center gap-3 border-b border-black/5 px-3 py-2.5">
                    <Avatar src={npc?.avatar} name={npc?.name ?? pid} size={40} editable={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{npc?.name}</p>
                      <p className="text-[11.5px] tabular-nums text-ink-soft">{phoneNumber(pid)}</p>
                    </div>
                    <button onClick={() => setCalling({ pid, name: npc?.name ?? "", number: phoneNumber(pid) })} className="rounded-full bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white">呼叫</button>
                  </div>
                );
              })}
            </div>
          )
        )}
        {tab === "recents" && (
          ph.calls.length === 0 ? <Empty text="还没有通话记录。" /> : <RecentCalls calls={ph.calls} />
        )}
      </div>
      <BottomTabs
        tabs={[{ id: "contacts", label: "联系人" }, { id: "keypad", label: "拨号" }, { id: "recents", label: "通话记录" }]}
        active={tab}
        onPick={(id) => setTab(id as typeof tab)}
      />
    </div>
  );
}
