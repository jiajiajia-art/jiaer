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
import { ShareSheet, speakOut, stopSpeech } from "./screenShare";
import { speakerGender } from "./wxFeatures";
import { bpmOf } from "../../game/phone";
import { isConfigured } from "../../lib/ai";
import type { GameState } from "../../lib/types";
import { useWorldSync, syncJson } from "./worldSync";
import { TopBar, BottomTabs, Empty, delay, fmtDur } from "./shared";
import { IconCallOut, IconClose, IconPhone, IconBackspace } from "./icons";
import { EmotionBadge, InnerOsLabel } from "../../lib/icons";
import { emitInterrupt, logAct, rollInterrupt } from "../../game/phoneLink";

type CallTarget = { pid?: string; name: string; number: string };

function RecentCalls({ calls, onCall }: { calls: CallRecord[]; onCall: (t: CallTarget) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const rec = calls.find((c) => c.id === open);
  if (rec) {
    return (
      <div className="bg-white">
        <button onClick={() => setOpen(null)} className="px-3 py-2 text-[13px] text-ink-soft">‹ 通话记录</button>
        <div className="border-y border-black/5 px-4 py-3 text-center">
          <p className="font-semibold text-ink">{rec.name}</p>
          <p className="text-[12px] text-ink-soft">{rec.number} · {rec.outcome === "connected" ? `通话 ${fmtDur(rec.durationSec)}` : rec.outcome === "declined" ? "对方未接" : "未接来电"}</p>
          <button onClick={() => onCall({ pid: rec.personId, name: rec.name, number: rec.number })} className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-4 py-1.5 text-[12.5px] font-semibold text-white"><IconPhone size={14} /> 回拨</button>
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
            <p className={`truncate font-medium ${c.outcome === "missed" ? "text-red-500" : "text-ink"}`}>{c.name}</p>
            <p className="text-[11.5px] text-ink-soft">{c.outcome === "connected" ? `通话 ${fmtDur(c.durationSec)}` : c.outcome === "declined" ? "对方未接" : "未接来电"} · {c.number}</p>
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
  const [shareOpen, setShareOpen] = useState(false);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const known = !!target.pid;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const rel = target.pid ? gRef.current.sim.rel[target.pid] ?? 0 : 0;
      const chance = known ? Math.min(0.95, 0.6 + rel / 200) : 0.15;
      // 当面在一起还打电话：对方直接挂断、转身跟你说话
      if (target.pid && rollInterrupt(gRef.current, target.pid, 0.5)) {
        commitGame(logAct(gRef.current, { app: "电话", text: `当着${target.name}的面给 TA 打电话`, min: 1, pid: target.pid }));
        emitInterrupt({ pid: target.pid, name: target.name, what: "打电话" });
        onEnd();
        return;
      }
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
    stopSpeech();
    if (timer.current) clearInterval(timer.current);
    if (target.pid && (phase === "live" || sec > 0)) {
      const rec: CallRecord = {
        id: msgId(), personId: target.pid, name: target.name, number: target.number,
        ts: Date.now(), durationSec: sec, outcome: phase === "declined" ? "declined" : "connected",
        transcript: msgs,
      };
      let g = logCall(gRef.current, rec);
      if (phase === "live" && sec > 5) g = applyChatEffects(g, target.pid, { relDelta: Math.min(4, 1 + Math.floor(sec / 60)), stressDelta: -3, memory: `一通${fmtDur(sec)}的电话` });
      if (phase === "live") {
        const gist = msgs.slice(0, 4).map((m) => `${m.role === "me" ? "我" : target.name}：${m.text}`).join(" / ");
        g = logAct(g, { app: "电话", text: `给${target.name}打了电话（${fmtDur(sec)}）${gist ? `：${gist}` : ""}`, min: Math.max(1, Math.ceil(sec / 60)), pid: target.pid });
      }
      commitGame(g);
    } else if (target.pid && phase === "declined") {
      commitGame(logCall(gRef.current, { id: msgId(), personId: target.pid, name: target.name, number: target.number, ts: Date.now(), durationSec: 0, outcome: "declined" }));
    }
    onEnd();
  };

  const speak = async (img?: string) => {
    if ((!draft.trim() && !img) || !target.pid || phase !== "live") return;
    const text = draft.trim(); setDraft("");
    const mine: ChatMsg = { id: msgId(), role: "me", text, ts: Date.now(), gt: gameMinutes(gRef.current), label: gameTimeLabel(gRef.current), ...(img ? { img } : {}) };
    const local = [...msgs, mine];
    setMsgs(local);
    if (!isConfigured(cfg)) { setNote("需要先接入 AI，对方才能回应"); return; }
    setTyping(true);
    const thread = gRef.current.phone?.threads.find((t) => t.personId === target.pid);
    const pseudo: Thread = { id: `call_${target.pid}`, kind: "private", personId: target.pid, title: target.name, msgs: local, unread: 0, lastTs: Date.now(), custom: thread?.custom };
    try {
      const reply = await requestChatReply(cfg, gRef.current, pseudo, text, img);
      // 整段一次念完，按气泡分句（各句自带停顿与语调）
      speakOut(reply.bubbles.join("\n"), speakerGender(gRef.current, target.pid), target.pid, gRef.current.npcs.find((n) => n.id === target.pid)?.persona?.ttsVoice, reply.emotion);
      for (const [i, b] of reply.bubbles.entries()) {
        await delay(500 + Math.min(1200, b.length * 40));
        const last = i === reply.bubbles.length - 1;
        setMsgs((cur) => [...cur, {
          id: msgId(), role: "npc", text: b, ts: Date.now(), gt: gameMinutes(gRef.current), label: gameTimeLabel(gRef.current),
          ...(last && reply.emotion ? { emo: reply.emotion, bpm: bpmOf(reply.emotion) } : {}),
          ...(last && reply.inner_os ? { os: reply.inner_os } : {}),
        }]);
      }
    } catch { setNote(img ? "对方没能看到画面：当前模型可能不支持识图" : "信号不好，对方没听清"); }
    setTyping(false);
  };

  const npc = target.pid ? game!.npcs.find((n) => n.id === target.pid) : undefined;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#0b1220] text-white">
      {/* 背景：头像色晕 + 暗角，营造通话界面的沉浸氛围 */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {npc?.avatar && <img src={npc.avatar} alt="" className="h-full w-full scale-125 object-cover opacity-30 blur-2xl" />}
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,rgba(56,189,248,0.28),transparent_60%),linear-gradient(to_bottom,rgba(11,18,32,0.2),#0b1220_85%)]" />
      </div>
      {shareOpen && <ShareSheet dark onClose={() => setShareOpen(false)} onError={setNote} onPick={(img) => void speak(img)} />}
      <div className="relative flex flex-col items-center pt-14">
        <div className="relative flex h-28 w-28 items-center justify-center">
          {phase === "ringing" && <>
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-sky-300/20 [animation-duration:1.8s]" />
            <span aria-hidden className="absolute -inset-3 animate-ping rounded-full bg-sky-300/10 [animation-delay:0.6s] [animation-duration:1.8s]" />
          </>}
          <span className={`relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-400/40 to-indigo-500/40 text-[34px] font-semibold text-white/95 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)] ${phase === "declined" ? "grayscale opacity-70" : ""}`}>
            {npc?.avatar ? <img src={npc.avatar} alt={target.name} className="h-full w-full object-cover" /> : target.name.slice(0, 1)}
          </span>
        </div>
        <p className="mt-5 text-[24px] font-semibold tracking-wide">{target.name}</p>
        <p className="mt-1 text-[13px] tabular-nums tracking-[0.12em] text-white/55">{target.number}</p>
        <p className={`mt-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] ${phase === "declined" ? "bg-red-500/15 text-red-200" : "bg-white/10 text-white/85"}`}>
          {phase === "live" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          {phase === "ringing" ? "正在呼叫…" : phase === "declined" ? "对方无法接听，请稍后再拨" : <span className="tabular-nums">通话中 {fmtDur(sec)}</span>}
        </p>
      </div>

      {phase === "live" && (
        <div ref={scroller} className="relative mt-4 flex-1 space-y-2 overflow-y-auto px-4">
          {!known && <p className="text-center text-[12px] text-white/60">陌生号码，通话不会记录关系。</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[78%] flex-col ${m.role === "me" ? "items-end" : "items-start"}`}>
                <span className={`rounded-2xl px-3 py-2 text-[13.5px] ${m.role === "me" ? "bg-sky-500" : "bg-white/15"}`}>
                  {m.img && <img src={(m.img) || undefined} alt="屏幕共享" className={`max-h-40 rounded-lg ${m.text ? "mb-1.5" : ""}`} />}
                  {m.text}
                </span>
                {m.emo && <span className="mt-1 text-[10.5px] text-white/75"><EmotionBadge id={m.emo} bpm={m.bpm} /></span>}
                {m.os && <span className="mt-1 rounded-xl border border-dashed border-violet-300/60 bg-violet-400/15 px-2.5 py-1 text-[11.5px] text-violet-100"><InnerOsLabel text={m.os} /></span>}
              </div>
            </div>
          ))}
          {typing && <p className="text-[12px] text-white/60">对方正在说话…</p>}
          {note && <p className="text-center text-[11.5px] text-amber-200">{note}</p>}
        </div>
      )}
      {phase !== "live" && <div className="relative flex-1" />}

      {phase === "live" && known && (
        <div className="relative flex items-center gap-2 px-3 pb-2">
          <button onClick={() => { setNote(""); setShareOpen(true); }} className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-[12.5px]" aria-label="屏幕共享"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg> 共享</button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void speak(); }} placeholder="说点什么…" className="flex-1 rounded-full bg-white/15 px-4 py-2 text-[13.5px] text-white outline-none placeholder:text-white/50" />
          <button onClick={() => void speak()} className="rounded-full bg-sky-500 px-4 py-2 text-[13px] font-semibold">说</button>
        </div>
      )}

      <div className="relative flex flex-col items-center gap-2 pb-10 pt-4">
        <button onClick={end} className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#ff3b30] text-white shadow-[0_10px_28px_-8px_rgba(255,59,48,0.8)] transition active:scale-90" aria-label="挂断">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="rotate-[135deg]"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
        </button>
        <span className="text-[11.5px] text-white/55">{phase === "declined" ? "返回" : "挂断"}</span>
      </div>
    </div>
  );
}

const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

export default function CallApp({ onBack }: { onBack: () => void }) {
  const { game, cfg, commitGame, patchGame } = useGame();
  const ph = ensurePhone(game!).phone!;

  /* 右上角刷新：联动剧情生成新的来电记录（未接来电 / 已接来电及通话要点） */
  useWorldSync("call", async () => {
    const g0 = ensurePhone(game!);
    const people = g0.phone!.contacts.map((id) => g0.npcs.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
    const res = await syncJson<{ calls?: unknown }>(cfg, g0, "call", "电话",
      `生成 1~3 条刚发生的来电记录，紧扣当前剧情。来电者优先从【联系人】中选（用 pid）；也可以是陌生/机构来电（pid 留空，name 写如「经纪公司前台」「未知号码」）。outcome 为 "missed"（未接）或 "connected"（已接）；已接的给 durationSec（10~600）和 lines：2~4 句对方在电话里说的话；未接的 lines 可给 1 句对方之后留的语音留言。
【联系人】${people.map((n) => `${n.id}=${n.name}`).join("、") || "（无）"}
返回 {"calls":[{"pid":"","name":"","outcome":"missed","durationSec":0,"lines":[""]}]}`);
    if (!res) return "未配置 AI，无法联动剧情";
    const ok = new Map(people.map((n) => [n.id, n.name]));
    const calls = Array.isArray(res.calls) ? res.calls.slice(0, 4) : [];
    if (!calls.length) return "暂时没有新来电";
    let n = 0, missed = 0;
    // 落库基于最新存档：AI 生成要几秒，期间调过的好感 / 爱慕、刚聊的消息不能被发起刷新时的旧快照覆盖
    patchGame((cur) => {
      let g = ensurePhone(cur);
      for (const raw of calls) {
        const c = raw as { pid?: unknown; name?: unknown; outcome?: unknown; durationSec?: unknown; lines?: unknown };
        const pid = str(c?.pid, 60);
        const known = ok.has(pid);
        const name = known ? ok.get(pid)! : str(c?.name, 16) || "未知号码";
        const outcome = c?.outcome === "connected" ? "connected" : "missed";
        const d = Number(c?.durationSec);
        const ts = Date.now() - (2 - n) * 1000;
        const transcript: ChatMsg[] = (Array.isArray(c?.lines) ? c.lines : []).map((x) => str(x, 160)).filter(Boolean).slice(0, 4)
          .map((text) => ({ id: msgId(), role: "npc" as const, text, ts, gt: gameMinutes(g), label: gameTimeLabel(g) }));
        g = logCall(g, {
          id: msgId(), ...(known ? { personId: pid } : {}), name,
          number: known ? phoneNumber(pid) : `${150 + (name.length % 40)} ${String(1000 + ((name.charCodeAt(0) * 37) % 9000))} ${String(1000 + ((ts / 1000) % 9000 | 0))}`,
          ts, durationSec: outcome === "connected" && Number.isFinite(d) ? Math.max(5, Math.min(1800, Math.round(d))) : 0,
          outcome, transcript,
        });
        n++;
        if (outcome === "missed") missed++;
      }
      return g;
    });
    return missed ? `新增 ${n} 条通话记录，其中 ${missed} 个未接来电` : `新增 ${n} 条通话记录`;
  });
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
            <div className="mb-5 flex h-10 items-center text-center text-[34px] font-light leading-none tracking-[0.06em] tabular-nums text-[#1c1c1e]">{dial || <span className="text-[#adadb2] text-[26px]">输入号码</span>}</div>
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
                  <span className="text-[32px] font-normal leading-none text-[#1c1c1e]">{k}</span>
                  {s && <span className="mt-0.5 text-[10px] font-semibold leading-none tracking-[0.18em] text-[#7c7c82]">{s}</span>}
                </button>
              ))}
            </div>
            <div className="mt-6 grid w-full max-w-[300px] grid-cols-3 items-center">
              <span />
              <button onClick={dialCall} disabled={!dial} className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition active:scale-90 disabled:opacity-40" aria-label="拨号"><IconPhone size={30} /></button>
              <button onClick={() => setDial((d) => d.slice(0, -1))} className={`mx-auto text-[#7c7c82] transition active:scale-90 ${dial ? "opacity-100" : "opacity-0"}`} aria-label="删除"><IconBackspace size={28} /></button>
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
          ph.calls.length === 0 ? <Empty text="还没有通话记录。" /> : <RecentCalls calls={ph.calls} onCall={setCalling} />
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
