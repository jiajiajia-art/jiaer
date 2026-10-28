/* 阅读：书城 / 书架 / 逐章阅读 / 打赏作者。
 * 打赏走统一钱包（绑定灵石 / 金币等货币后自动记在该属性上）；作者是圈内人物时，打赏会加好感并写进 TA 的记忆。
 * 书目与续写章节按存档持久化；接入 AI 后书城随剧情上新、章节可续写。 */
import { useState, type ReactNode } from "react";
import { useGame } from "../../store/gameCtx";
import { isConfigured } from "../../lib/ai";
import { loadData, saveData } from "../../lib/saveScope";
import { applyChatEffects } from "../../game/phone";
import { logAct, logNpcNet } from "../../game/phoneLink";
import { wallet } from "../../game/wallet";
import { liveTerm as T } from "../../mods/live";
import { syncJson, useWorldSync } from "./worldSync";
import { IconBook, IconGift, IconPlus, IconSearch } from "./icons";
import type { GameState } from "../../lib/types";

const ACCENT = "#e0662f";
const PAPER = "#f6f1e7";

type Book = { id: string; title: string; author: string; pid?: string; genre: string; blurb: string; cover: string; fans: number };
type Chapter = { t: string; body: string };
type ReadState = { books: Book[]; chapters: Record<string, Chapter[]>; shelf: string[]; at: Record<string, number>; tips: Record<string, number> };

const COVERS = [
  "linear-gradient(160deg,#3b2f63,#c06c84)", "linear-gradient(160deg,#1f4e5f,#7fb7be)", "linear-gradient(160deg,#5b2333,#f7a072)",
  "linear-gradient(160deg,#2d3142,#bfc0c0)", "linear-gradient(160deg,#355c3a,#d6c880)", "linear-gradient(160deg,#6b3e75,#f3c4d6)",
];
/* 打赏档位：数额直接按钱包单位计（人民币 / 灵石 / 金币…） */
const TIPS = [
  { v: 6, n: "一杯奶茶" }, { v: 66, n: "加更符" }, { v: 188, n: "催更锦旗" }, { v: 520, n: "大神认证" }, { v: 1314, n: "盟主令" },
];
const fanTitle = (n: number) => (n >= 2000 ? "盟主" : n >= 500 ? "执事" : n >= 100 ? "铁粉" : n > 0 ? "读者" : "");
const fmtW = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`);

function useReadState() {
  const { game } = useGame();
  const [st, setSt] = useState<ReadState>(() => {
    const saved = loadData<ReadState | null>("read.state", null);
    // 只保留按当前世界生成的书（旧存档里的预设书目直接丢弃）
    if (saved) return { ...saved, books: (saved.books ?? []).filter((b) => !b.id.startsWith("seed-")) };
    return { books: [], chapters: {}, shelf: [], at: {}, tips: {} };
  });
  const save = (fn: (s: ReadState) => ReadState) => setSt((s) => { const n = fn(s); saveData("read.state", n); return n; });
  return [st, save] as const;
}

export default function ReadApp({ onBack }: { onBack: () => void }) {
  const { game, cfg, commitGame, patchGame } = useGame();
  const [st, save] = useReadState();
  const [tab, setTab] = useState<"store" | "shelf">("store");
  const [open, setOpen] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2000); };
  const ai = isConfigured(cfg);

  /* 随剧情上新：圈内人新书、以主角为原型的同人、近期事件改编的连载 */
  useWorldSync("read", async () => {
    const r = await syncJson<{ books?: unknown }>(cfg, game!, "read", "阅读", `生成阅读 App 书城今日上新，返回 JSON：{"books":[{"title":"书名≤14字","author":"作者(圈内人物本名或网文笔名)","genre":"类型≤4字","fans":读者数整数(按作者名气合理估计),"blurb":"简介≤40字","chapter":{"t":"第一章 章节名","body":"第一章正文 300~500 字，分段用\\n\\n"}}]}。给 3 本：可以是圈内人物写的随笔 / 自传、以主角或最近剧情为原型的同人或改编连载，语气各异。`);
    if (!r) return "未配置 AI，无法联动剧情";
    const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
    const stamp = Date.now().toString(36);
    const fresh = (Array.isArray(r.books) ? r.books : []).map((x: any, i: number) => {
      const author = str(x?.author, 16) || "佚名";
      const b: Book = { id: `ai-${stamp}-${i}`, title: str(x?.title, 20), author, pid: game!.npcs.find((n) => n.name === author)?.id, genre: str(x?.genre, 6) || "连载", blurb: str(x?.blurb, 60), cover: COVERS[(i + st.books.length) % COVERS.length], fans: Math.max(0, Math.round(Number(x?.fans) || 0)) };
      const ch: Chapter = { t: str(x?.chapter?.t, 24) || "第一章", body: str(x?.chapter?.body, 2000) };
      return { b, ch };
    }).filter((x) => x.b.title && x.ch.body);
    if (!fresh.length) return "生成失败，请重试";
    save((s) => ({ ...s, books: [...fresh.map((x) => x.b), ...s.books].slice(0, 40), chapters: { ...s.chapters, ...Object.fromEntries(fresh.map((x) => [x.b.id, [x.ch]])) } }));
    patchGame((g) => fresh.reduce((acc, x) => (x.b.pid ? logNpcNet(acc, x.b.pid, "阅读", `出了本书《${x.b.title}》：${x.b.blurb}`) : acc), g));
    return `书城上新 ${fresh.length} 本`;
  });

  const book = open ? st.books.find((b) => b.id === open) : undefined;
  const bal = wallet.balance(game!);
  const price = (n: number) => wallet.fmt(n, game!, (x) => `¥${x.toLocaleString("zh-CN")}`);
  const onShelf = (id: string) => st.shelf.includes(id);
  const toggleShelf = (id: string) => { save((s) => ({ ...s, shelf: onShelf(id) ? s.shelf.filter((x) => x !== id) : [id, ...s.shelf] })); flash(onShelf(id) ? "已移出书架" : "已加入书架"); };

  const tip = (b: Book, t: (typeof TIPS)[number]) => {
    if (bal < t.v) { flash(`${wallet.name(game!, "零钱")}不足，还差 ${price(t.v - bal)}`); return; }
    let g = logAct(wallet.add(game!, -t.v), { app: "阅读", text: `打赏了《${b.title}》的作者${b.author}`, bit: `${t.n}（${price(t.v)}）`, key: `read:tip:${b.id}`, min: 1, pid: b.pid });
    if (b.pid) g = applyChatEffects(g, b.pid, { relDelta: t.v >= 520 ? 2 : 1, memory: `你在阅读 App 给 TA 的书《${b.title}》打赏了「${t.n}」` });
    commitGame(g);
    save((s) => ({ ...s, tips: { ...s.tips, [b.id]: (s.tips[b.id] ?? 0) + t.v } }));
    flash(`打赏成功 · ${t.n}（-${price(t.v)}）`);
  };

  const Toast = toast ? (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-30 flex justify-center"><span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span></div>
  ) : null;

  if (book && reading) return <Reader book={book} st={st} save={save} ai={ai} onBack={() => setReading(false)} onTip={(t) => tip(book, t)} price={price} bal={bal} toast={Toast} />;

  if (book) {
    const chs = st.chapters[book.id] ?? [];
    const mine = st.tips[book.id] ?? 0;
    return (
      <div className="relative flex h-full flex-col" style={{ background: PAPER }}>
        <div className="flex items-center px-3 py-2.5"><button onClick={() => setOpen(null)} className="text-[14px] text-ink-soft">‹ 书城</button></div>
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <div className="flex gap-4">
            <Cover b={book} className="h-36 w-24" />
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-[18px] font-bold leading-snug text-ink">{book.title}</p>
              <p className="mt-1 text-[12.5px] text-ink-soft">{book.author}{book.pid ? " · 圈内人" : ""} · {book.genre}</p>
              <p className="mt-2 text-[12px] text-ink-soft">{fmtW(book.fans + mine)} 人在追 · 已更 {chs.length} 章</p>
              {mine > 0 && <p className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: ACCENT }}>{fanTitle(mine)} · 已打赏 {price(mine)}</p>}
            </div>
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink">{book.blurb}</p>
          <div className="mt-5 rounded-2xl bg-white/70 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink"><IconGift size={15} /> 打赏作者<span className="ml-auto text-[11px] font-normal text-ink-soft">{wallet.name(game!, "零钱")}余额 {price(bal)}</span></p>
            <div className="grid grid-cols-3 gap-1.5">
              {TIPS.map((t) => (
                <button key={t.v} onClick={() => tip(book, t)} disabled={bal < t.v} className="rounded-xl border border-black/5 bg-white px-1 py-2 text-center transition active:scale-95 disabled:opacity-40">
                  <span className="block text-[12.5px] font-semibold text-ink">{t.n}</span>
                  <span className="block text-[11px]" style={{ color: ACCENT }}>{price(t.v)}</span>
                </button>
              ))}
            </div>
            {book.pid && <p className="mt-2 text-[11px] leading-snug text-ink-soft">作者是{book.author}本人，打赏会被 TA 记住，也会提升你们的好感。</p>}
          </div>
          <p className="mb-1.5 mt-5 text-[13px] font-semibold text-ink">目录</p>
          <div className="divide-y divide-black/5 rounded-2xl bg-white/70">
            {chs.map((c, i) => (
              <button key={i} onClick={() => { save((s) => ({ ...s, at: { ...s.at, [book.id]: i } })); setReading(true); }} className="flex w-full items-center px-3 py-2.5 text-left text-[13px] text-ink">
                <span className="min-w-0 flex-1 truncate">{c.t}</span>
                {(st.at[book.id] ?? -1) === i && <span className="text-[11px]" style={{ color: ACCENT }}>上次读到</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 border-t border-black/5 bg-white/80 px-4 py-2.5">
          <button onClick={() => toggleShelf(book.id)} className="flex-1 rounded-full border py-2 text-[13px] font-semibold" style={{ borderColor: ACCENT, color: ACCENT }}>{onShelf(book.id) ? "已在书架" : "加入书架"}</button>
          <button onClick={() => { if (!onShelf(book.id)) save((s) => ({ ...s, shelf: [book.id, ...s.shelf] })); setReading(true); }} className="flex-[2] rounded-full py-2 text-[13px] font-semibold text-white" style={{ background: ACCENT }}>
            {st.at[book.id] !== undefined ? `继续阅读 · ${chs[st.at[book.id]]?.t ?? ""}` : "开始阅读"}
          </button>
        </div>
        {Toast}
      </div>
    );
  }

  const kw = q.trim();
  const list = (tab === "shelf" ? st.shelf.map((id) => st.books.find((b) => b.id === id)).filter(Boolean) as Book[] : st.books)
    .filter((b) => !kw || `${b.title}${b.author}${b.genre}`.includes(kw));
  const totalTips = Object.values(st.tips).reduce((a, b) => a + b, 0);
  return (
    <div className="relative flex h-full flex-col" style={{ background: PAPER }}>
      <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        <button onClick={onBack} className="text-[14px] text-ink-soft">‹ 主屏</button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-ink-soft">
          <IconSearch size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜书名 / 作者 / 类型" className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-soft/70" />
        </div>
      </div>
      <div className="flex gap-5 px-4 text-[15px]">
        {([["store", "书城"], ["shelf", `书架${st.shelf.length ? ` ${st.shelf.length}` : ""}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`pb-1.5 ${tab === k ? "border-b-2 font-bold text-ink" : "text-ink-soft"}`} style={tab === k ? { borderColor: ACCENT } : undefined}>{l}</button>
        ))}
        {totalTips > 0 && <span className="ml-auto self-center text-[11px] text-ink-soft">累计打赏 {price(totalTips)}</span>}
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center text-ink-soft">
            <IconBook size={30} />
            <p className="text-[13px]">{tab === "shelf" ? "书架还空着，去书城挑本书吧" : q ? "没找到相关的书" : ai ? "书城正在按当前世界上新…" : "书城还没有书，接入 AI 后会按当前世界上新"}</p>
            {tab === "shelf" && <button onClick={() => setTab("store")} className="rounded-full px-4 py-1.5 text-[13px] text-white" style={{ background: ACCENT }}>去书城</button>}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((b) => (
              <button key={b.id} onClick={() => setOpen(b.id)} className="flex w-full gap-3 rounded-2xl bg-white/70 p-2.5 text-left transition active:scale-[0.99]">
                <Cover b={b} className="h-24 w-16" />
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{b.title}</p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-soft">{b.blurb}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
                    <span className="truncate">{b.author}</span>
                    <span className="rounded px-1 text-[10.5px]" style={{ color: ACCENT, background: `${ACCENT}14` }}>{b.genre}</span>
                    {b.pid && <span className="rounded bg-black/5 px-1 text-[10.5px]">圈内人</span>}
                    {(st.tips[b.id] ?? 0) > 0 && <span className="ml-auto shrink-0" style={{ color: ACCENT }}>{fanTitle(st.tips[b.id])}</span>}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        {tab === "store" && !ai && <p className="mt-4 text-center text-[11.5px] text-ink-soft">接入 AI 后，书城会随剧情上新，章节也能一直续写下去</p>}
      </div>
      {Toast}
    </div>
  );
}

function Cover({ b, className }: { b: Book; className: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md shadow-[2px_3px_8px_rgba(0,0,0,0.18)] ${className}`} style={{ background: b.cover }}>
      <span className="absolute inset-y-0 left-0 w-1.5 bg-black/15" />
      <span className="absolute inset-x-2 top-2.5 line-clamp-3 font-serif text-[12px] font-bold leading-tight text-white drop-shadow">{b.title}</span>
      <span className="absolute inset-x-2 bottom-2 truncate text-[9.5px] text-white/80">{b.author}</span>
    </div>
  );
}

/* 阅读器：字号三档 · 上一章 / 下一章（接入 AI 后可续写）· 底栏打赏 */
function Reader({ book, st, save, ai, onBack, onTip, price, bal, toast }: {
  book: Book; st: ReadState; save: (fn: (s: ReadState) => ReadState) => void; ai: boolean; onBack: () => void;
  onTip: (t: (typeof TIPS)[number]) => void; price: (n: number) => string; bal: number; toast: ReactNode;
}) {
  const { game, cfg, patchGame } = useGame();
  const [size, setSize] = useState(16);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tipOpen, setTipOpen] = useState(false);
  const chs = st.chapters[book.id] ?? [];
  const i = Math.min(st.at[book.id] ?? 0, Math.max(0, chs.length - 1));
  const ch = chs[i];
  const go = (n: number) => { save((s) => ({ ...s, at: { ...s.at, [book.id]: n } })); document.getElementById("reader-top")?.scrollIntoView(); };

  const next = async () => {
    if (i < chs.length - 1) { go(i + 1); return; }
    if (!ai || busy) return;
    setBusy(true); setErr("");
    try {
      const prev = chs.slice(-2).map((c) => `${c.t}：${c.body.slice(-300)}`).join("\n");
      const r = await syncJson<{ t?: unknown; body?: unknown }>(cfg, game!, "read", "阅读", `续写《${book.title}》（作者 ${book.author}，${book.genre}；简介：${book.blurb}）的第 ${chs.length + 1} 章。前文结尾：\n${prev}\n返回 JSON：{"t":"第${chs.length + 1}章 章节名","body":"正文 500~800 字，分段用\\n\\n，与前文连贯${book.pid ? "；作者是圈内人物本人，可以写到 TA 的真实经历与近况" : ""}"}`);
      const t = typeof r?.t === "string" ? r.t.trim().slice(0, 24) : "";
      const body = typeof r?.body === "string" ? r.body.trim().slice(0, 3000) : "";
      if (!body) { setErr("续写失败，请重试"); return; }
      save((s) => ({ ...s, chapters: { ...s.chapters, [book.id]: [...(s.chapters[book.id] ?? []), { t: t || `第${chs.length + 1}章`, body }] }, at: { ...s.at, [book.id]: chs.length } }));
      document.getElementById("reader-top")?.scrollIntoView();
    } catch { setErr("续写失败，请重试"); } finally { setBusy(false); }
  };
  const markRead = () => patchGame((g) => logAct(g, { app: "阅读", text: `读了《${book.title}》`, bit: ch?.t ?? "", key: `read:${book.id}`, min: 8, pid: book.pid }));

  return (
    <div className="relative flex h-full flex-col" style={{ background: PAPER }}>
      <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2.5">
        <button onClick={() => { markRead(); onBack(); }} className="text-[14px] text-ink-soft">‹</button>
        <span className="min-w-0 flex-1 truncate text-center text-[13px] text-ink-soft">{book.title} · {ch?.t}</span>
        <div className="flex overflow-hidden rounded-full border border-black/10 text-[12px]">
          {[14, 16, 19].map((s, k) => (
            <button key={s} onClick={() => setSize(s)} className={`px-2 py-0.5 ${size === s ? "bg-black/10 font-bold text-ink" : "text-ink-soft"}`} aria-label={`字号${["小", "中", "大"][k]}`}>{["小", "中", "大"][k]}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <span id="reader-top" />
        <h2 className="mb-4 font-serif text-[19px] font-bold text-ink">{ch?.t}</h2>
        <div className="space-y-4 font-serif leading-[1.9] text-[#2b2620]" style={{ fontSize: size }}>
          {(ch?.body ?? "").split(/\n+/).filter(Boolean).map((p, k) => <p key={k} className="indent-[2em]">{p}</p>)}
        </div>
        <div className="mt-8 flex gap-2">
          <button onClick={() => go(i - 1)} disabled={i === 0} className="flex-1 rounded-full border border-black/10 py-2 text-[13px] text-ink disabled:opacity-35">上一章</button>
          <button onClick={next} disabled={busy || (i >= chs.length - 1 && !ai)} className="flex-1 rounded-full py-2 text-[13px] font-semibold text-white disabled:opacity-45" style={{ background: ACCENT }}>
            {busy ? "作者奋笔疾书中…" : i < chs.length - 1 ? "下一章" : ai ? "续写下一章" : "已是最新章"}
          </button>
        </div>
        {err && <p className="mt-2 text-center text-[12px] text-danger">{err}</p>}
        {i >= chs.length - 1 && !ai && <p className="mt-2 text-center text-[11.5px] text-ink-soft">接入 AI 后可以一直续写下去</p>}
      </div>
      {tipOpen && (
        <div className="border-t border-black/5 bg-white px-3 pb-2 pt-3">
          <div className="mb-2 flex items-center text-[12.5px] text-ink"><b>打赏 {book.author}</b><span className="ml-auto text-[11px] text-ink-soft">余额 {price(bal)}</span></div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {TIPS.map((t) => (
              <button key={t.v} onClick={() => onTip(t)} disabled={bal < t.v} className="shrink-0 rounded-xl border border-black/5 bg-[#faf7f1] px-3 py-1.5 text-center disabled:opacity-40">
                <span className="block text-[12px] font-semibold text-ink">{t.n}</span>
                <span className="block text-[10.5px]" style={{ color: ACCENT }}>{price(t.v)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-black/5 bg-white/85 px-4 py-2">
        <span className="flex-1 text-[11.5px] text-ink-soft">第 {i + 1} / {chs.length} 章</span>
        <button onClick={() => setTipOpen((v) => !v)} className="flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white" style={{ background: ACCENT }}>
          {tipOpen ? "收起" : <><IconGift size={14} /> 打赏</>}
        </button>
        {!st.shelf.includes(book.id) && <button onClick={() => save((s) => ({ ...s, shelf: [book.id, ...s.shelf] }))} className="flex items-center gap-0.5 rounded-full border border-black/10 px-2.5 py-1.5 text-[12px] text-ink"><IconPlus size={12} /> 书架</button>}
      </div>
      {toast}
    </div>
  );
}
