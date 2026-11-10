/* 来电层：线下剧情里角色主动打来的语音 / 视频电话（phone.ringing）。
 * 接听 → 进入绿信通话（对方先开口说明来意）；拒接 → 记为未接来电，并记入手机流水。 */
import { commTerm } from "../../lib/commSkin";
import { useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { ensurePhone, logCall, msgId, threadFor, type IncomingCall as Ring, type Thread } from "../../game/phone";
import { logAct } from "../../game/phoneLink";
import { VoiceCall } from "./chat";

export default function IncomingCall() {
  const { game, patchGame } = useGame();
  const [live, setLive] = useState<Ring | null>(null);
  if (!game) return null;
  const ph = ensurePhone(game).phone!;
  if (live) {
    const npc = game.npcs.find((n) => n.id === live.pid);
    const thread: Thread = threadFor(ph, live.pid) ?? { id: `call_${live.pid}`, kind: "private", personId: live.pid, title: live.name, msgs: [], unread: 0, lastTs: Date.now() };
    return <div className="absolute inset-0 z-[70]"><VoiceCall thread={thread} name={live.name} avatar={npc?.avatar} incoming={live.reason} video={live.video} onClose={() => setLive(null)} /></div>;
  }
  const r = ph.ringing;
  if (!r) return null;
  const npc = game.npcs.find((n) => n.id === r.pid);
  const clear = (g: typeof game) => ({ ...g, phone: { ...ensurePhone(g).phone!, ringing: undefined } });
  const decline = () => patchGame((g) => logAct(
    logCall(clear(g), { id: msgId(), personId: r.pid, name: r.name, number: `${commTerm("app")}${commTerm(r.video ? "video" : "voice")}`, ts: Date.now(), durationSec: 0, outcome: "missed" }),
    { app: commTerm("app"), text: `挂断了${r.name}打来的${commTerm(r.video ? "video" : "voice")}`, min: 0, pid: r.pid },
  ));
  const accept = () => { patchGame(clear); setLive(r); };
  return (
    <div className="absolute inset-0 z-[70] flex flex-col items-center overflow-hidden text-white" style={{ background: "linear-gradient(180deg,#24303d 0%,#121820 100%)" }} role="alertdialog" aria-label={`${r.name}来电`}>
      {npc?.avatar && <img src={npc.avatar} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-2xl" />}
      <div className="relative mt-20 flex flex-col items-center">
        <div className="relative">
          <span aria-hidden className="absolute -inset-3 animate-ping rounded-[28px] bg-white/10 [animation-duration:1.8s]" />
          <div className="relative overflow-hidden rounded-[24px] ring-4 ring-white/10"><Avatar src={npc?.avatar} name={r.name} size={96} editable={false} /></div>
        </div>
        <p className="mt-6 text-[26px] font-semibold tracking-wide">{r.name}</p>
        <p className="mt-1.5 text-[14px] text-white/65">邀请你{r.video ? "视频" : "语音"}通话…</p>
      </div>
      <div className="relative mt-auto mb-16 grid w-full grid-cols-2 px-12">
        <div className="flex flex-col items-center gap-2">
          <button onClick={decline} aria-label="拒接" className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#ff3b30] shadow-[0_10px_28px_-8px_rgba(255,59,48,0.8)] transition active:scale-90">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="rotate-[135deg]"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
          </button>
          <span className="text-[12px] text-white/70">拒接</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button onClick={accept} aria-label="接听" className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#34c759] shadow-[0_10px_28px_-8px_rgba(52,199,89,0.8)] transition active:scale-90">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
          </button>
          <span className="text-[12px] text-white/70">接听</span>
        </div>
      </div>
    </div>
  );
}
