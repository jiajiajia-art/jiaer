/* 直播：分区列表 + 直播间（弹幕自动流 + 我发弹幕 + 主播互动 + 打赏） */
import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { applyChatEffects, msgId } from "../../game/phone";
import { TopBar } from "./shared";
import { IconGift, IconVideo, IconFire } from "./icons";

const LIVE_ZONES = ["颜值", "音乐", "影视", "游戏", "户外"];
const GIFTS = [{ n: "小心心", v: 1 }, { n: "棒棒糖", v: 6 }, { n: "跑车", v: 520 }, { n: "火箭", v: 1314 }];
const DANMU_SEED = ["主播好漂亮！", "关注了关注了", "666666", "求唱一首", "第一次来，好宝藏", "声音也太好听了吧", "已三连", "妈妈问我为什么跪着看"];

type Room = { name: string; pid?: string; title: string };

function LiveRoom({ room, onBack }: { room: Room; onBack: () => void }) {
  const { game, commitGame } = useGame();
  const [danmu, setDanmu] = useState<{ id: string; who: string; text: string; me?: boolean; gift?: boolean }[]>([]);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const npc = room.pid ? game!.npcs.find((n) => n.id === room.pid) : undefined;

  useEffect(() => {
    let i = 0;
    const seedNames = ["路人甲", "追光少年", "夜猫子", "阿豪", "小鱼干", "momo"];
    const iv = setInterval(() => {
      setDanmu((d) => [...d.slice(-40), { id: msgId(), who: seedNames[i % seedNames.length], text: DANMU_SEED[i % DANMU_SEED.length] }]);
      i++;
    }, 1800);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [danmu.length]);

  const react = (gift?: boolean) => {
    const reactions = gift
      ? [`谢谢${game!.player.name}的礼物！么么哒！`, "哇塞大哥有品位，鞠躬感谢！", "这就是今晚的榜一大哥吗！"]
      : [`欢迎${game!.player.name}！`, "谢谢这位宝子的弹幕～", "哈哈说到我心坎里了", "这位说得对，安排！"];
    setTimeout(() => {
      setDanmu((d) => [...d.slice(-40), { id: msgId(), who: room.name, text: reactions[Math.floor(Math.random() * reactions.length)] }]);
    }, 700);
  };

  const send = () => {
    if (!draft.trim()) return;
    const t = draft.trim(); setDraft("");
    setDanmu((d) => [...d.slice(-40), { id: msgId(), who: game!.player.name, text: t, me: true }]);
    react();
  };

  const gift = (g: { n: string; v: number }) => {
    const cost = g.v * 100;
    if (game!.sim.money < cost) { setToast("余额不足，钱包空空~"); setTimeout(() => setToast(""), 1800); return; }
    const spent = { ...game!, sim: { ...game!.sim, money: game!.sim.money - cost } };
    commitGame(spent);
    setDanmu((d) => [...d.slice(-40), { id: msgId(), who: game!.player.name, text: `送出了 ${g.n} ×1`, me: true, gift: true }]);
    react(true);
    if (room.pid) commitGame(applyChatEffects(spent, room.pid, { relDelta: g.v >= 520 ? 2 : 1, memory: `你在直播间给 TA 打赏了${g.n}` }));
    setToast(`打赏成功 · ${g.n}（-¥${cost.toLocaleString()}）`); setTimeout(() => setToast(""), 2000);
  };

  return (
    <div className="flex h-full flex-col bg-black text-white">
      <div className="relative flex h-52 items-center justify-center bg-gradient-to-br from-fuchsia-800/70 to-sky-800/60">
        <button onClick={onBack} className="absolute left-3 top-3 text-[14px] text-white/80">‹ 返回</button>
        <div className="flex flex-col items-center">
          <Avatar src={npc?.avatar} name={room.name} size={64} editable={false} />
          <p className="mt-2 text-[15px] font-semibold">{room.name}</p>
          <p className="text-[12px] text-white/70">{room.title}</p>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold">● LIVE</span>
      </div>

      <div ref={box} className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-[13px]">
        {danmu.map((d) => (
          <p key={d.id} className={d.me ? (d.gift ? "text-amber-300" : "text-sky-300") : d.who === room.name ? "text-fuchsia-300" : "text-white/85"}>
            <span className="opacity-70">{d.who}：</span>{d.text}
          </p>
        ))}
      </div>

      {toast && <p className="bg-amber-500/20 px-3 py-1.5 text-center text-[12px] text-amber-300">{toast}</p>}

      <div className="flex gap-2 overflow-x-auto px-3 py-2">
        {GIFTS.map((g) => (
          <button key={g.n} onClick={() => gift(g)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px]"><IconGift size={14} /> {g.n}<span className="ml-1 text-amber-300">{g.v}</span></button>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="发条弹幕…" className="flex-1 rounded-full bg-white/10 px-4 py-2 text-[13px] text-white outline-none placeholder:text-white/50" />
        <button onClick={send} className="rounded-full bg-fuchsia-500 px-4 py-2 text-[13px] font-semibold">发送</button>
      </div>
    </div>
  );
}

export default function LiveApp({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const [zone, setZone] = useState(LIVE_ZONES[0]);
  const [room, setRoom] = useState<Room | null>(null);

  const rooms = useMemo(() => {
    const npcs = game!.npcs;
    return LIVE_ZONES.reduce((acc, z, zi) => {
      acc[z] = [0, 1, 2, 3].map((i) => {
        const n = npcs[(zi + i) % Math.max(1, npcs.length)];
        return {
          name: n?.name ?? `主播${zi}${i}`,
          pid: n?.id,
          title: [`${z}｜今晚不见不散`, `${z}专场 · 唠嗑`, `深夜${z}电台`, `${z}挑战赛`][i],
          heat: 1200 - i * 180 - zi * 30,
        };
      });
      return acc;
    }, {} as Record<string, { name: string; pid?: string; title: string; heat: number }[]>);
  }, [game]);

  if (room) return <LiveRoom room={room} onBack={() => setRoom(null)} />;

  return (
    <div className="flex h-full flex-col bg-[#0f1115] text-white">
      <TopBar title="直播" onBack={onBack} dark />
      <div className="flex gap-2 overflow-x-auto px-3 py-2 text-[13px]">
        {LIVE_ZONES.map((z) => (
          <button key={z} onClick={() => setZone(z)} className={`shrink-0 rounded-full px-3 py-1 ${zone === z ? "bg-fuchsia-500 text-white" : "bg-white/10 text-white/70"}`}>{z}</button>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto px-3 pb-3">
        {rooms[zone].map((r, i) => (
          <button key={i} onClick={() => setRoom(r)} className="overflow-hidden rounded-xl bg-white/5 text-left">
            <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-fuchsia-700/60 to-sky-700/50 text-white/80"><IconVideo size={30} />
              <span className="absolute left-1.5 top-1.5 rounded bg-red-500 px-1 text-[10px] font-bold">LIVE</span>
              <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/40 px-1 text-[10px]"><IconFire size={10} />{r.heat}</span>
            </div>
            <div className="p-2">
              <p className="truncate text-[12.5px]">{r.title}</p>
              <p className="truncate text-[11px] text-white/60">{r.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
