/* 视频：推荐流 / 直播 / 我的。播放页含进度条、弹幕、点赞收藏、评论与「充电」打赏。
 * 充电与直播打赏都走统一钱包（绑定灵石 / 金币等货币后自动记在该属性上）；
 * UP 主是圈内人物时，充电会加好感并写进 TA 的记忆。接入 AI 后推荐流随剧情更新。 */
import { useEffect, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { isConfigured } from "../../lib/ai";
import { loadData, saveData } from "../../lib/saveScope";
import { applyChatEffects, msgId } from "../../game/phone";
import { logAct, logNpcNet } from "../../game/phoneLink";
import { wallet } from "../../game/wallet";
import { liveTerm as T } from "../../mods/live";
import { syncJson, useWorldSync } from "./worldSync";
import { IconComment, IconGift, IconHeart, IconPlay, IconStar } from "./icons";
import { fmtDur } from "./shared";
import LiveApp from "./LiveApp";
import type { GameState } from "../../lib/types";

const ACCENT = "#fb7299";
const IMG = (id: string) => `https://images.unsplash.com/photo-${id}?w=640&h=360&fit=crop&auto=format&q=75`;
const POOL = [
  "1612544409025-e1f6a56c1152", "1532800783378-1bed60adaf58", "1484251065541-c9770829890f", "1632187981988-40f3cbaeef5e",
  "1527189919029-aeb3d997547d", "1517841905240-472988babdf9", "1522798514-97ceb8c4f1c8", "1470225620780-dba8ba36b745",
];
const ZONES = ["全部", "日常", "幕后", "音乐", "吃瓜", "知识"];
/* 充电档位：数额直接按钱包单位计 */
const CHARGES = [{ v: 6, n: "小电池" }, { v: 30, n: "能量块" }, { v: 128, n: "满格电" }, { v: 648, n: "发电站" }];

type Video = { id: string; title: string; up: string; pid?: string; zone: string; dur: number; views: number; img: string; desc: string; danmu: string[] };
type Cmt = { id: string; who: string; text: string; me?: boolean };
type VidState = { vids: Video[]; liked: string[]; saved: string[]; charged: Record<string, number>; cmts: Record<string, Cmt[]> };

const fmtN = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`);

function useVidState() {
  const { game } = useGame();
  const [st, setSt] = useState<VidState>(() => {
    const s = loadData<VidState | null>("video.state", null);
    // 只保留按当前世界生成的投稿（旧存档里的预设视频直接丢弃）
    return s ? { ...s, vids: (s.vids ?? []).filter((v) => !v.id.startsWith("seed-")) } : { vids: [], liked: [], saved: [], charged: {}, cmts: {} };
  });
  const save = (fn: (s: VidState) => VidState) => setSt((s) => { const n = fn(s); saveData("video.state", n); return n; });
  return [st, save] as const;
}

export default function VideoApp({ onBack }: { onBack: () => void }) {
  const { game, cfg, patchGame } = useGame();
  const [st, save] = useVidState();
  const [tab, setTab] = useState<"home" | "live" | "me">("home");
  const [zone, setZone] = useState(ZONES[0]);
  const [open, setOpen] = useState<string | null>(null);

  useWorldSync("video", async () => {
    const r = await syncJson<{ videos?: unknown }>(cfg, game!, "video", "视频", `生成视频 App 推荐流最新投稿，返回 JSON：{"videos":[{"up":"UP 主(圈内人物本名或网友昵称)","title":"标题≤24字","zone":"日常/幕后/音乐/吃瓜/知识 之一","desc":"简介≤40字","views":播放量整数(按热度合理估计),"danmu":["弹幕≤12字",...6条]}]}。给 5 条：围绕最近剧情、主角近况与人物关系，可以有圈内人物本人投稿、路人二创与吃瓜盘点。`);
    if (!r) return "未配置 AI，无法联动剧情";
    const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
    const stamp = Date.now();
    const fresh: Video[] = (Array.isArray(r.videos) ? r.videos : []).map((x: any, i: number) => {
      const up = str(x?.up, 16) || "路人UP";
      const dm = (Array.isArray(x?.danmu) ? x.danmu : []).map((d: unknown) => str(d, 16)).filter(Boolean);
      return { id: `ai-${stamp.toString(36)}-${i}`, up, pid: game!.npcs.find((n) => n.name === up)?.id, title: str(x?.title, 30), zone: ZONES.includes(str(x?.zone, 4)) ? str(x?.zone, 4) : "日常", desc: str(x?.desc, 60), dur: 60 + ((stamp + i * 97) % 540), views: Math.max(0, Math.round(Number(x?.views) || 0)), img: IMG(POOL[(i + st.vids.length) % POOL.length]), danmu: dm };
    }).filter((v) => v.title);
    if (!fresh.length) return "生成失败，请重试";
    save((s) => ({ ...s, vids: [...fresh, ...s.vids].slice(0, 50) }));
    patchGame((g) => fresh.reduce((acc, v) => (v.pid ? logNpcNet(acc, v.pid, "视频", `投稿了视频「${v.title}」`) : acc), g));
    return `推荐流更新了 ${fresh.length} 条`;
  });

  const vid = open ? st.vids.find((v) => v.id === open) : undefined;
  if (vid) return <Player v={vid} st={st} save={save} onBack={() => setOpen(null)} />;

  const list = st.vids.filter((v) => zone === "全部" || v.zone === zone);
  const charged = Object.entries(st.charged).filter(([, n]) => n > 0);
  const price = (n: number) => wallet.fmt(n, game!, (x) => `¥${x.toLocaleString("zh-CN")}`);
  return (
    <div className="relative flex h-full flex-col bg-[#f4f4f6]">
      <div className="flex items-center gap-3 bg-white px-3 pb-1 pt-2.5">
        <button onClick={onBack} className="text-[14px] text-ink-soft">‹ 主屏</button>
        <div className="flex flex-1 justify-center gap-5 text-[15px]">
          {([["home", "推荐"], ["live", "直播"], ["me", "我的"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`border-b-2 pb-1.5 ${tab === k ? "font-bold text-ink" : "border-transparent text-ink-soft"}`} style={tab === k ? { borderColor: ACCENT } : undefined}>{l}</button>
          ))}
        </div>
        <span className="w-10" />
      </div>
      {tab === "live" && <div className="min-h-0 flex-1"><LiveApp embedded onBack={() => setTab("home")} /></div>}
      {tab === "home" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto bg-white px-3 pb-2 pt-1 [scrollbar-width:none]">
            {ZONES.map((z) => (
              <button key={z} onClick={() => setZone(z)} className={`shrink-0 rounded-full px-3 py-0.5 text-[12.5px] ${zone === z ? "font-semibold text-white" : "bg-[#f1f2f3] text-ink-soft"}`} style={zone === z ? { background: ACCENT } : undefined}>{z}</button>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-min grid-cols-2 content-start gap-2 overflow-y-auto p-2">
            {list.map((v) => (
              <button key={v.id} onClick={() => setOpen(v.id)} className="overflow-hidden rounded-lg bg-white text-left shadow-sm transition active:scale-[0.98]">
                <div className="relative aspect-video bg-[#ddd]">
                  <img src={v.img} alt={v.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-[10.5px] text-white">
                    <span className="flex items-center gap-0.5"><IconPlay size={10} />{fmtN(v.views)}</span>
                    <span>{fmtDur(v.dur)}</span>
                  </div>
                </div>
                <div className="p-1.5">
                  <p className="line-clamp-2 h-[34px] text-[12.5px] leading-[17px] text-ink">{v.title}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-ink-soft">
                    <span className="rounded-sm border px-0.5 text-[9.5px] leading-tight" style={{ borderColor: ACCENT, color: ACCENT }}>UP</span>
                    <span className="truncate">{v.up}</span>
                  </p>
                </div>
              </button>
            ))}
            {!isConfigured(cfg) && <p className="col-span-2 py-3 text-center text-[11.5px] text-ink-soft">接入 AI 后，推荐流会随剧情更新</p>}
          </div>
        </>
      )}
      {tab === "me" && (
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
            <Avatar src={game!.player.avatar} name={game!.player.name} size={48} editable={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-ink">{game!.player.name}</p>
              <p className="text-[11.5px] text-ink-soft">{wallet.name(game!, "零钱")}余额 {price(wallet.balance(game!))}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-black/5 rounded-2xl bg-white py-2.5 text-center">
            {[["点赞", st.liked.length], ["收藏", st.saved.length], ["充电", charged.length]].map(([k, n]) => (
              <div key={k}><p className="text-[16px] font-bold tabular-nums text-ink">{n}</p><p className="text-[11px] text-ink-soft">{k}</p></div>
            ))}
          </div>
          <p className="px-1 pt-1 text-[12.5px] font-semibold text-ink">充电记录</p>
          {charged.length === 0 ? <p className="rounded-2xl bg-white px-4 py-6 text-center text-[12.5px] text-ink-soft">还没给 UP 主充过电</p> : (
            <div className="divide-y divide-black/5 rounded-2xl bg-white">
              {charged.map(([id, n]) => { const v = st.vids.find((x) => x.id === id); return v && (
                <button key={id} onClick={() => setOpen(id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{v.up} ·「{v.title}」</span>
                  <span className="shrink-0 text-[12px] font-semibold" style={{ color: ACCENT }}>{price(n)}</span>
                </button>
              ); })}
            </div>
          )}
          {st.saved.length > 0 && <>
            <p className="px-1 pt-1 text-[12.5px] font-semibold text-ink">我的收藏</p>
            <div className="divide-y divide-black/5 rounded-2xl bg-white">
              {st.saved.map((id) => { const v = st.vids.find((x) => x.id === id); return v && (
                <button key={id} onClick={() => setOpen(id)} className="block w-full truncate px-3 py-2.5 text-left text-[12.5px] text-ink">{v.title}<span className="ml-1 text-ink-soft">· {v.up}</span></button>
              ); })}
            </div>
          </>}
        </div>
      )}
    </div>
  );
}

type Fly = { id: string; text: string; lane: number; me?: boolean };

function Player({ v, st, save, onBack }: { v: Video; st: VidState; save: (fn: (s: VidState) => VidState) => void; onBack: () => void }) {
  const { game, commitGame, patchGame } = useGame();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fly, setFly] = useState<Fly[]>([]);
  const [draft, setDraft] = useState("");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [toast, setToast] = useState("");
  const flash = (s: string) => { setToast(s); setTimeout(() => setToast(""), 2000); };
  const k = useRef(0);
  const npc = v.pid ? game!.npcs.find((n) => n.id === v.pid) : undefined;
  const liked = st.liked.includes(v.id), saved = st.saved.includes(v.id);
  const mine = st.charged[v.id] ?? 0;
  const bal = wallet.balance(game!);
  const price = (n: number) => wallet.fmt(n, game!, (x) => `¥${x.toLocaleString("zh-CN")}`);

  // 打开即记一笔观看（同一视频 30 分钟内合并）
  useEffect(() => { patchGame((g) => logAct(g, { app: "视频", text: `看了${v.up}的视频`, bit: v.title, key: `video:${v.id}`, min: Math.max(2, Math.round(v.dur / 60)), pid: v.pid })); }, [v.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // 播放计时 + 弹幕飘过
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      setT((x) => { if (x + 1 >= v.dur) { setPlaying(false); return v.dur; } return x + 1; });
      if (Math.random() < 0.7) { const n = k.current++; setFly((f) => [...f.slice(-7), { id: msgId(), text: v.danmu[n % v.danmu.length], lane: n % 4 }]); }
    }, 1000);
    return () => clearInterval(iv);
  }, [playing, v.dur, v.danmu]);

  const cmts = st.cmts[v.id] ?? [];
  const send = () => {
    const s = draft.trim(); if (!s) return;
    setDraft("");
    setFly((f) => [...f.slice(-7), { id: msgId(), text: s, lane: k.current++ % 4, me: true }]);
    save((x) => ({ ...x, cmts: { ...x.cmts, [v.id]: [{ id: msgId(), who: game!.player.name, text: s, me: true }, ...(x.cmts[v.id] ?? [])] } }));
    patchGame((g) => logAct(g, { app: "视频", text: `在${v.up}的视频下评论`, bit: s, key: `video:c:${v.id}`, min: 1, pid: v.pid }));
  };
  const charge = (c: (typeof CHARGES)[number]) => {
    if (bal < c.v) { flash(`${wallet.name(game!, "零钱")}不足，还差 ${price(c.v - bal)}`); return; }
    let g = logAct(wallet.add(game!, -c.v), { app: "视频", text: `给 UP 主${v.up}充电`, bit: `${c.n}（${price(c.v)}）`, key: `video:tip:${v.id}`, min: 1, pid: v.pid });
    if (v.pid) g = applyChatEffects(g, v.pid, { relDelta: c.v >= 128 ? 2 : 1, memory: `你给 TA 的视频「${v.title}」充了电（${c.n}）` });
    commitGame(g);
    save((x) => ({ ...x, charged: { ...x.charged, [v.id]: (x.charged[v.id] ?? 0) + c.v } }));
    setFly((f) => [...f.slice(-7), { id: msgId(), text: `${game!.player.name} 充了 ${c.n}`, lane: k.current++ % 4, me: true }]);
    flash(`充电成功 · ${c.n}（-${price(c.v)}）`);
  };

  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-black [container-type:inline-size]">
        <img src={v.img} alt={v.title} className={`absolute inset-0 h-full w-full object-cover transition ${playing ? "opacity-100" : "opacity-60"}`} />
        <button onClick={onBack} className="absolute left-2 top-2 z-10 rounded-full bg-black/35 px-2.5 py-0.5 text-[13px] text-white">‹</button>
        {fly.map((d) => (
          <span key={d.id} onAnimationEnd={() => setFly((f) => f.filter((x) => x.id !== d.id))}
            className={`pointer-events-none absolute left-full whitespace-nowrap text-[13px] font-semibold [animation:vd-danmu_7s_linear_forwards] [text-shadow:0_1px_2px_rgba(0,0,0,.8)] ${d.me ? "rounded border px-1" : ""}`}
            style={{ top: 10 + d.lane * 22, color: d.me ? "#fff" : "#fff", borderColor: d.me ? ACCENT : undefined }}>{d.text}</span>
        ))}
        <button onClick={() => { if (t >= v.dur) setT(0); setPlaying((p) => !p); }} aria-label={playing ? "暂停" : "播放"} className="absolute inset-0 grid place-items-center">
          {!playing && <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white"><IconPlay size={22} /></span>}
        </button>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-1.5 pt-5 text-[10.5px] tabular-nums text-white">
          <span>{fmtDur(t)}</span>
          <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30"><div className="h-full rounded-full" style={{ width: `${(t / v.dur) * 100}%`, background: ACCENT }} /></div>
          <span>{fmtDur(v.dur)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-2.5 px-3 pt-3">
          <Avatar src={npc?.avatar} name={v.up} size={36} editable={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold" style={{ color: ACCENT }}>{v.up}</p>
            <p className="text-[11px] text-ink-soft">{npc ? npc.identity || "圈内人" : "UP 主"}{mine > 0 ? ` · 你已充电 ${price(mine)}` : ""}</p>
          </div>
        </div>
        <p className="px-3 pt-2.5 text-[15px] font-semibold leading-snug text-ink">{v.title}</p>
        <p className="px-3 pt-1 text-[11.5px] text-ink-soft">{fmtN(v.views)} 播放 · {v.zone}{v.desc ? ` · ${v.desc}` : ""}</p>
        <div className="mt-3 grid grid-cols-4 px-2 text-center text-[11.5px] text-ink-soft">
          <button onClick={() => save((x) => ({ ...x, liked: liked ? x.liked.filter((i) => i !== v.id) : [...x.liked, v.id] }))} className="flex flex-col items-center gap-0.5" style={liked ? { color: ACCENT } : undefined}><IconHeart size={22} filled={liked} />{liked ? "已赞" : "点赞"}</button>
          <button onClick={() => { save((x) => ({ ...x, saved: saved ? x.saved.filter((i) => i !== v.id) : [...x.saved, v.id] })); flash(saved ? "已取消收藏" : "已收藏，可在「我的」查看"); }} className="flex flex-col items-center gap-0.5" style={saved ? { color: ACCENT } : undefined}><IconStar size={22} filled={saved} />{saved ? "已收藏" : "收藏"}</button>
          <button onClick={() => setChargeOpen((o) => !o)} className="flex flex-col items-center gap-0.5" style={chargeOpen || mine ? { color: ACCENT } : undefined}><IconGift size={22} />充电</button>
          <button onClick={() => document.getElementById("vd-cmts")?.scrollIntoView({ behavior: "smooth" })} className="flex flex-col items-center gap-0.5"><IconComment size={22} />{cmts.length}</button>
        </div>
        {chargeOpen && (
          <div className="mx-3 mt-3 rounded-2xl bg-[#fff4f7] p-3">
            <p className="mb-2 flex items-center text-[12.5px] text-ink"><b>为 {v.up} 充电</b><span className="ml-auto text-[11px] text-ink-soft">{wallet.name(game!, "零钱")}余额 {price(bal)}</span></p>
            <div className="grid grid-cols-4 gap-1.5">
              {CHARGES.map((c) => (
                <button key={c.v} onClick={() => charge(c)} disabled={bal < c.v} className="rounded-xl bg-white px-1 py-2 text-center transition active:scale-95 disabled:opacity-40">
                  <span className="block text-[12px] font-semibold text-ink">{c.n}</span>
                  <span className="block text-[10.5px]" style={{ color: ACCENT }}>{price(c.v)}</span>
                </button>
              ))}
            </div>
            {v.pid && <p className="mt-2 text-[11px] text-ink-soft">UP 主是{v.up}本人，充电会被 TA 记住，也会提升好感。</p>}
          </div>
        )}
        <p id="vd-cmts" className="px-3 pb-1 pt-4 text-[13px] font-semibold text-ink">评论 {cmts.length}</p>
        <div className="divide-y divide-black/5 px-3 pb-3">
          {cmts.map((c) => (
            <div key={c.id} className="py-2.5">
              <p className="text-[11.5px]" style={{ color: c.me ? ACCENT : "#999" }}>{c.who}{c.me ? "（我）" : ""}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink">{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-black/5 px-3 py-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="发条弹幕 / 评论…" className="min-w-0 flex-1 rounded-full bg-[#f1f2f3] px-3 py-1.5 text-[12.5px] text-ink outline-none" />
        <button onClick={send} disabled={!draft.trim()} className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40" style={{ background: ACCENT }}>发送</button>
      </div>
      {toast && <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center"><span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span></div>}
    </div>
  );
}
