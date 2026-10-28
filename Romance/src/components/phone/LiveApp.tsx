/* 直播：分区列表 + 直播间（弹幕自动流 + 我发弹幕 + 主播互动 + 打赏） */
import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { applyChatEffects, msgId } from "../../game/phone";
import { TopBar, LoadMoreButton, seenOf } from "./shared";
import { syncJson, loadFeed, saveFeed } from "./worldSync";
import { isConfigured } from "../../lib/ai";
import { IconGift, IconVideo, IconFire } from "./icons";
import { wallet } from "../../game/wallet";
import { logAct } from "../../game/phoneLink";

const LIVE_ZONES = ["颜值", "音乐", "影视", "游戏", "户外"];
const GIFTS = [{ n: "小心心", v: 1 }, { n: "棒棒糖", v: 6 }, { n: "跑车", v: 520 }, { n: "火箭", v: 1314 }];

type Room = { name: string; pid?: string; title: string };

function LiveRoom({ room, onBack }: { room: Room; onBack: () => void }) {
  const { game, cfg, commitGame } = useGame();
  const [danmu, setDanmu] = useState<{ id: string; who: string; text: string; me?: boolean; gift?: boolean }[]>([]);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const npc = room.pid ? game!.npcs.find((n) => n.id === room.pid) : undefined;

  /* 弹幕：进直播间时按当前世界与这场直播生成一批，再逐条滚动 */
  const [dmNote, setDmNote] = useState("");
  useEffect(() => {
    if (!isConfigured(cfg)) { setDmNote("接入 AI 后会有观众弹幕"); return; }
    let dead = false, iv: ReturnType<typeof setInterval> | undefined;
    setDmNote("观众陆续进场…");
    syncJson<{ danmu?: unknown }>(cfg, game!, "live", "直播", `「${room.name}」正在直播「${room.title}」。生成观众弹幕，返回 {"danmu":[{"who":"观众昵称","text":"弹幕≤16字"}]}，12 条，贴合主播身份、这场直播与最近剧情。`)
      .then((r) => {
        if (dead) return;
        const list = (Array.isArray(r?.danmu) ? r!.danmu : []).map((x: any) => ({ who: String(x?.who ?? "").slice(0, 12), text: String(x?.text ?? "").slice(0, 24) })).filter((x) => x.who && x.text);
        if (!list.length) { setDmNote("弹幕加载失败"); return; }
        setDmNote("");
        let i = 0;
        iv = setInterval(() => { if (i >= list.length) { clearInterval(iv); return; } const x = list[i++]; setDanmu((d) => [...d.slice(-40), { id: msgId(), ...x }]); }, 1800);
      }).catch(() => { if (!dead) setDmNote("弹幕加载失败"); });
    return () => { dead = true; if (iv) clearInterval(iv); };
  }, [room.name, room.title]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [danmu.length]);

  /* 主播回应：AI 以主播口吻回应主角的弹幕 / 礼物；没接 AI 就不回应 */
  const react = (what: string) => {
    syncJson<{ reply?: unknown }>(cfg, game!, "live", "直播", `你是正在直播「${room.title}」的主播「${room.name}」。观众「${game!.player.name}」${what}。以主播本人口吻在直播里回应一句（≤24字），返回 {"reply":"…"}`)
      .then((r) => { const t = typeof r?.reply === "string" ? r.reply.trim().slice(0, 40) : ""; if (t) setDanmu((d) => [...d.slice(-40), { id: msgId(), who: room.name, text: t }]); })
      .catch(() => {});
  };

  const send = () => {
    if (!draft.trim()) return;
    const t = draft.trim(); setDraft("");
    setDanmu((d) => [...d.slice(-40), { id: msgId(), who: game!.player.name, text: t, me: true }]);
    react(`发弹幕：「${t}」`);
  };

  const gift = (g: { n: string; v: number }) => {
    const cost = g.v * 100;
    if (wallet.balance(game!) < cost) { setToast(`${wallet.name(game!, "零钱")}不足，钱包空空~`); setTimeout(() => setToast(""), 1800); return; }
    const spent = logAct(wallet.add(game!, -cost), { app: "直播间", text: `在${room.name}的直播间打赏`, bit: `${g.n}（${wallet.fmt(cost, game!, (x) => `¥${x.toLocaleString()}`)}）`, key: `live:${room.name}`, min: 1, pid: room.pid });
    commitGame(spent);
    setDanmu((d) => [...d.slice(-40), { id: msgId(), who: game!.player.name, text: `送出了 ${g.n} ×1`, me: true, gift: true }]);
    react(`送出了礼物「${g.n}」`);
    if (room.pid) commitGame(applyChatEffects(spent, room.pid, { relDelta: g.v >= 520 ? 2 : 1, memory: `你在直播间给 TA 打赏了${g.n}` }));
    setToast(`打赏成功 · ${g.n}（-${wallet.fmt(cost, game!, (x) => `¥${x.toLocaleString()}`)}）`); setTimeout(() => setToast(""), 2000);
  };

  return (
    <div className="flex h-full flex-col bg-black text-white">
      <div className="relative flex h-52 items-center justify-center bg-gradient-to-br from-fuchsia-800/70 to-sky-800/60">
        <button onClick={onBack} className="absolute left-3 top-3 text-[14px] text-white/80">‹ 返回</button>
        <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/30 px-2 py-0.5 text-[10.5px] text-white/80">余额 {wallet.fmt(wallet.balance(game!), game!, (x) => `¥${x.toLocaleString()}`)}</span>
        <div className="flex flex-col items-center">
          <Avatar src={npc?.avatar} name={room.name} size={64} editable={false} />
          <p className="mt-2 text-[15px] font-semibold">{room.name}</p>
          <p className="text-[12px] text-white/70">{room.title}</p>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold">● LIVE</span>
      </div>

      <div ref={box} className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-[13px]">
        {dmNote && <p className="py-2 text-center text-[11.5px] text-white/50">{dmNote}</p>}
        {danmu.map((d) => (
          <p key={d.id} className={d.me ? (d.gift ? "text-amber-300" : "text-sky-300") : d.who === room.name ? "text-fuchsia-300" : "text-white/85"}>
            <span className="opacity-70">{d.who}：</span>{d.text}
          </p>
        ))}
      </div>

      {toast && <p className="bg-amber-500/20 px-3 py-1.5 text-center text-[12px] text-amber-300">{toast}</p>}

      <div className="flex gap-2 overflow-x-auto px-3 py-2">
        {GIFTS.map((g) => (
          <button key={g.n} onClick={() => gift(g)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px]"><IconGift size={14} /> {g.n}<span className="ml-1 text-amber-300">¥{(g.v * 100).toLocaleString()}</span></button>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="发条弹幕…" className="flex-1 rounded-full bg-white/10 px-4 py-2 text-[13px] text-white outline-none placeholder:text-white/50" />
        <button onClick={send} className="rounded-full bg-fuchsia-500 px-4 py-2 text-[13px] font-semibold">发送</button>
      </div>
    </div>
  );
}

export default function LiveApp({ onBack, embedded }: { onBack: () => void; embedded?: boolean }) {
  const { game, cfg } = useGame();
  const [zone, setZone] = useState(LIVE_ZONES[0]);
  const [more, setMore] = useState<Record<string, (Room & { heat: number })[]>>(() => loadFeed<Record<string, (Room & { heat: number })[]>>("live.more") ?? {});
  const [moreLoading, setMoreLoading] = useState(false);
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };
  const [room, setRoom] = useState<Room | null>(null);

  /* 底部「查看更多」：结合剧情再生成一批当前分区的直播间，接在列表末尾（持久化） */
  const loadMore = async () => {
    if (moreLoading) return;
    setMoreLoading(true);
    try {
      const cur = (more[zone] ?? []);
      const seen = seenOf(cur.map((r) => `${r.name}:${r.title}`));
      const r = await syncJson<{ rooms?: unknown }>(cfg, game!, "live", "直播", `再生成 4 个「${zone}」分区正在开播的直播间，主播可以是圈内人物（用其本名）或网红主播，标题贴合最近剧情或分区日常。返回 JSON：{"rooms":[{"name":"主播名","title":"直播间标题≤16字","heat":整数200~3000}]}；不要与这些已有直播间重复：${seen}`);
      if (!r) { flash("未配置 AI，暂无更多"); return; }
      const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
      const fresh = (Array.isArray(r.rooms) ? r.rooms : []).map((x: any) => {
        const name = str(x?.name, 16) || "主播";
        const h = Number(x?.heat);
        return { name, pid: game!.npcs.find((n) => n.name === name)?.id, title: str(x?.title, 24), heat: Number.isFinite(h) && h > 0 ? Math.round(h) : 300 };
      }).filter((x) => x.title);
      if (!fresh.length) { flash("生成失败，请重试"); return; }
      const next = { ...more, [zone]: [...(more[zone] ?? []), ...fresh].slice(-60) };
      setMore(next); saveFeed("live.more", next);
      flash(`新加载 ${fresh.length} 个直播间`);
    } catch { flash("加载失败，请重试"); } finally { setMoreLoading(false); }
  };

  // 当前分区还没有直播间时，按当前世界自动生成一批（不再让每个 NPC 都在每个分区开播）
  useEffect(() => { if (!(more[zone]?.length) && isConfigured(cfg)) void loadMore(); }, [zone]); // eslint-disable-line react-hooks/exhaustive-deps

  if (room) return <LiveRoom room={room} onBack={() => setRoom(null)} />;

  return (
    <div className="relative flex h-full flex-col bg-[#0f1115] text-white">
      {!embedded && <TopBar title="直播" onBack={onBack} dark />}
      <div className="flex gap-2 overflow-x-auto px-3 py-2 text-[13px]">
        {LIVE_ZONES.map((z) => (
          <button key={z} onClick={() => setZone(z)} className={`shrink-0 rounded-full px-3 py-1 ${zone === z ? "bg-fuchsia-500 text-white" : "bg-white/10 text-white/70"}`}>{z}</button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-min content-start grid-cols-2 gap-2 overflow-y-auto px-3 pb-3">
        {(more[zone] ?? []).map((r, i) => (
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
        {!(more[zone]?.length) && <p className="col-span-2 py-10 text-center text-[12px] text-white/50">{isConfigured(cfg) ? (moreLoading ? "正在按当前世界寻找开播的直播间…" : "这个分区暂时没人开播") : "接入 AI 后，会按当前世界出现开播的直播间"}</p>}
        <div className="col-span-2"><LoadMoreButton loading={moreLoading} onClick={loadMore} color="#e879f9" dark /></div>
      </div>
      {toast && <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center"><span className="rounded-full bg-black/75 px-3.5 py-1.5 text-[12px] text-white">{toast}</span></div>}
    </div>
  );
}
