import { loadData, saveData } from "../../../lib/saveScope";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AppSpec, Block, UserApp } from "./core";
import { layoutOf, readAsDataURL, type Layout } from "./core";
import { useGame } from "../../../store/gameCtx";
import { complete, isConfigured } from "../../../lib/ai";
import { isLive, liveItems, worldContext } from "./live";
import type { GameState } from "../../../lib/types";

/* 玩家应用运行器：把 AppSpec 解释成可用的小手机应用。数据按应用 id 隔离存于本机。 */
const k = (app: string, key: string) => `uapp.${app}.${key}`;
function useStored<T>(app: string, key: string, init: T): [T, (v: T) => void] {
  // 玩家应用里录入的数据属于当前存档 → 按 saveId 隔离
  const [v, setV] = useState<T>(() => loadData<T>(k(app, key), init));
  const set = (n: T) => { setV(n); saveData(k(app, key), n); };
  return [v, set];
}

export default function Runner({ app, onClose, preview }: { app: UserApp; onClose: () => void; preview?: boolean }) {
  const s = app.spec, col = /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#7cc8a6";
  const L = layoutOf(s);
  const [drawer, setDrawer] = useState(false);
  const [page, setPage] = useState(s.tabs[0] ?? s.pages[0]?.id ?? "");
  const [toast, setToast] = useState("");
  const [user, setUser] = useStored<string>(app.id, "__user", "");
  const { game, cfg } = useGame();
  const [nonce, setNonce] = useState(0); // 刷新：实时数据重读、AI 内容重写
  const liveOn = s.pages.some((p) => p.blocks.some((b) => isLive(b.source) || b.type === "list" || b.type === "stat"));
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); }, [toast]);
  const cur = s.pages.find((p) => p.id === page) ?? s.pages[0];

  const tabsOn = s.tabs.length > 1 && (!s.login || !!user);
  const navBtns = (vertical: boolean) => s.tabs.map((t) => { const p = s.pages.find((x) => x.id === t); const on = t === cur?.id; return (
    <button key={t} onClick={() => { setPage(t); setDrawer(false); }} className={vertical ? "block w-full rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold" : "flex-1 py-2.5 text-[12px] font-semibold"}
      style={{ color: on ? col : L.dark ? "#888" : "#999", background: vertical && on ? `${col}22` : undefined }}>
      {!vertical && <span className="mx-auto mb-0.5 block h-1.5 w-1.5 rounded-full" style={{ background: on ? col : "transparent" }} />}{p?.name ?? t}
    </button>); });
  const bar = L.dark ? "bg-[#1c1c1e] border-white/10" : "bg-white border-black/5";
  // 本页有 AI 积木才会重新生成；否则刷新只是重读本存档里的数据
  const aiOnPage = !!cur?.blocks.some((b) => ((b.type === "list" || b.type === "stat") && !b.source) || ((b.type === "text" || b.type === "list" || b.type === "stat") && b.source === "ai"));
  const refresh = () => {
    setNonce((n) => n + 1);
    setToast(aiOnPage ? (isConfigured(cfg) ? "正在按当前世界重新生成…" : "需要先接入 AI 才能生成内容") : "已刷新");
  };
  // 挂到小手机整块应用区，盖住宿主应用（如应用商店）自己的底栏，避免底部漏出一截
  const root = typeof document !== "undefined" ? document.getElementById("phone-app-root") : null;
  const view = (
    <div className={`absolute inset-0 z-50 flex flex-col ${L.dark ? "bg-[#111] text-[#eee]" : "bg-[#f6f7f9] text-[#222]"}`} style={{ fontSize: FONT[L.font] }}>
      <header className={`flex items-center gap-2 px-3 text-white ${L.header === "large" ? "pb-4 pt-3" : "pb-2.5 pt-2.5"}`} style={{ background: col }}>
        {tabsOn && L.nav === "side" && <button onClick={() => setDrawer(true)} aria-label="菜单" className="rounded-full bg-white/20 px-2.5 py-1 text-[13px]">≡</button>}
        <button onClick={onClose} className="rounded-full bg-white/20 px-3 py-1 text-[12.5px] font-semibold">{preview ? "退出预览" : "退出"}</button>
        <p className={`min-w-0 flex-1 truncate font-bold ${L.header === "large" ? "text-left text-[22px]" : "text-center text-[16px]"}`}>{cur?.name ?? s.name}</p>
        {liveOn || cur?.blocks.some((b) => b.type === "records") ? (
          <button onClick={refresh} aria-label="刷新" title="刷新"
            className="grid h-7 w-7 place-items-center rounded-full bg-white/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          </button>
        ) : <span className="w-12 text-right text-[11px] opacity-80">{preview ? "预览" : `v${app.meta.version}`}</span>}
      </header>
      {tabsOn && L.nav === "top" && <nav className={`flex border-b ${bar}`}>{navBtns(false)}</nav>}
      <div className={`min-h-0 flex-1 overflow-y-auto ${GAP[L.density]}`}>
        {s.login && !user ? <Login col={col} onLogin={setUser} mode={s.skillConfig.auth?.mode} L={L} />
          : !cur ? <p className="py-16 text-center text-[13px] text-[#999]">这个应用还没有页面</p>
          : cur.blocks.map((b) => <BlockView key={b.id} b={b} app={app.id} spec={s} col={col} go={setPage} toast={setToast} L={L} game={game} nonce={nonce} />)}
      </div>
      {tabsOn && L.nav === "bottom" && <nav className={`flex border-t ${bar}`}>{navBtns(false)}</nav>}
      {drawer && (
        <div className="absolute inset-0 z-10 flex" onClick={() => setDrawer(false)}>
          <div className={`h-full w-2/3 space-y-1 p-3 pt-14 shadow-xl ${L.dark ? "bg-[#1c1c1e]" : "bg-white"}`} onClick={(e) => e.stopPropagation()}>{navBtns(true)}</div>
          <div className="flex-1 bg-black/30" />
        </div>
      )}
      {toast && <div className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-center"><span className="rounded-full bg-black/75 px-4 py-2 text-[13px] text-white">{toast}</span></div>}
    </div>
  );
  return root ? createPortal(view, root) : view;
}
const FONT: Record<Layout["font"], number> = { sm: 13, md: 14, lg: 16 };
const GAP: Record<Layout["density"], string> = { compact: "space-y-1.5 p-2", comfortable: "space-y-3 p-3", loose: "space-y-5 p-5" };
const RAD: Record<Layout["radius"], string> = { sharp: "rounded-md", round: "rounded-2xl", pill: "rounded-[28px]" };
const cardOf = (L: Layout) => L.style === "flat" ? "bg-transparent px-1 py-2" : L.style === "list" ? `${L.dark ? "bg-[#1c1c1e] border-white/10" : "bg-white border-black/5"} border-y px-3.5 py-3` : `${RAD[L.radius]} ${L.dark ? "bg-[#1c1c1e]" : "bg-white shadow-[0_1px_6px_rgba(0,0,0,.05)]"} ${L.density === "compact" ? "p-2.5" : "p-3.5"}`;
const btnWrap = (L: Layout) => (L.hand === "right" ? "flex justify-end" : L.hand === "left" ? "flex justify-start" : "");
const btnCls = (L: Layout) => `${L.hand === "center" ? "w-full" : "min-w-[44%] px-6"} ${L.radius === "pill" ? "rounded-full" : RAD[L.radius]}`;

function Login({ col, onLogin, mode, L }: { col: string; onLogin: (u: string) => void; mode?: string; L: Layout }) {
  const [n, setN] = useState("");
  return (
    <div className={`mt-10 space-y-3 ${cardOf(L)}`}>
      <p className="text-[18px] font-bold">登录</p>
      <input value={n} onChange={(e) => setN(e.target.value)} placeholder={mode || "昵称"} className="w-full rounded-xl bg-[#8882] px-3 py-2.5 text-[14px] outline-none" />
      <button disabled={!n.trim()} onClick={() => onLogin(n.trim())} className="w-full rounded-xl py-2.5 text-[14px] font-bold text-white disabled:opacity-40" style={{ background: col }}>进入</button>
    </div>
  );
}

function BlockView({ b: bRaw, app, spec, col, go, toast, L, game, nonce }: { b: Block; app: string; spec: AppSpec; col: string; go: (p: string) => void; toast: (t: string) => void; L: Layout; game: GameState | null; nonce: number }) {
  const card = cardOf(L);
  // 旧应用里写死的列表 / 数据卡：运行时一律改为按当前世界现写，不展示假数据
  const b0: Block = (bRaw.type === "list" || bRaw.type === "stat") && !bRaw.source
    ? { ...bRaw, source: "ai", prompt: bRaw.prompt || `${bRaw.title || "内容"}：结合当前游戏世界写真实内容${bRaw.items?.length ? `（原先的写法仅供参考格式：${bRaw.items.slice(0, 3).join("、")}）` : ""}` }
    : bRaw;
  const live = (b0.type === "text" || b0.type === "list" || b0.type === "stat") && isLive(b0.source);
  const ai = useAiContent(live && b0.source === "ai" ? b0 : null, app, spec, game, nonce);
  // 接了数据源的积木：内容来自当前存档（或 AI 按世界现写），不再用写死的 items
  const b: Block = !live ? b0 : b0.source === "ai"
    ? { ...b0, items: ai.items, text: ai.text }
    : { ...b0, items: liveItems(game, b0.source!, b0.type), text: liveItems(game, b0.source!, "list").join("\n") };
  if (live && (b0.source === "ai" ? ai.state !== "ok" : !game || !(b.items ?? []).length)) {
    const msg = b0.source === "ai"
      ? ai.state === "busy" ? "正在按当前世界生成…" : ai.state === "noai" ? "需要先接入 AI 才能生成内容" : ai.state === "nogame" ? "进入游戏后才能读取世界内容" : `生成失败，点右上角刷新重试${ai.err ? `（${ai.err}）` : ""}`
      : !game ? "进入游戏后才能读取世界内容" : "当前世界里还没有这类内容";
    return <div className={card}>{b0.title && <p className="mb-1.5 text-[1em] font-bold">{b0.title}</p>}<p className="py-3 text-center text-[12.5px] text-[#aaa]">{msg}</p></div>;
  }
  const Title = () => (b.title ? <p className="mb-1.5 text-[1em] font-bold">{b.title}</p> : null);
  switch (b.type) {
    case "text": return <div className={card}><Title /><p className="whitespace-pre-wrap text-[0.96em] leading-relaxed opacity-80">{b.text}</p></div>;
    case "stat": return (
      <div className={card}><Title />
        <div className="grid grid-cols-2 gap-2">{(b.items ?? []).map((it, i) => { const [l, v] = it.split(/[:：]/); return (
          <div key={i} className="rounded-xl px-3 py-2" style={{ background: `${col}18` }}><p className="text-[11px] text-[#888]">{l}</p><p className="text-[18px] font-bold" style={{ color: col }}>{v ?? "-"}</p></div>); })}</div>
      </div>);
    case "list": return <div className={card}><Title /><ul className="divide-y divide-black/5">{(b.items ?? []).map((it, i) => <li key={i} className="py-2 text-[0.96em]">{it}</li>)}</ul></div>;
    case "todo": return <Todo card={card} b={b} app={app} col={col} />;
    case "note": return <Note card={card} b={b} app={app} />;
    case "counter": return <Counter card={card} b={b} app={app} col={col} />;
    case "form": return <Form card={card} b={b} app={app} col={col} toast={toast} />;
    case "records": return <Records card={card} b={b} app={app} nonce={nonce} />;
    case "image": return <ImageBlock card={card} b={b} app={app} max={Number(spec.skillConfig.upload?.maxMB) || 2} toast={toast} />;
    case "button": return (
      <div className={btnWrap(L)}><button onClick={() => (b.action === "navigate" && b.target ? go(b.target) : b.action === "toast" ? toast(b.text || "好的") : b.action === "save" ? toast("已保存") : undefined)}
        className={`${btnCls(L)} py-3 text-[14px] font-bold text-white active:scale-[.98]`} style={{ background: col }}>{b.text || "按钮"}</button></div>);
    default: return <div className={`${card} text-[12px] text-[#c33]`}>不支持的组件：{String(b.type)}</div>;
  }
}
function Todo({ card, b, app, col }: { card: string; b: Block; app: string; col: string }) {
  const [list, setList] = useStored<{ t: string; d: boolean }[]>(app, `todo.${b.id}`, (b.items ?? []).map((t) => ({ t, d: false })));
  const [v, setV] = useState("");
  return (
    <div className={card}>{b.title && <p className="mb-1.5 text-[1em] font-bold">{b.title}</p>}
      {list.map((x, i) => (
        <label key={i} className="flex items-center gap-2 py-1.5 text-[0.96em]">
          <input type="checkbox" checked={x.d} onChange={() => setList(list.map((y, j) => (j === i ? { ...y, d: !y.d } : y)))} style={{ accentColor: col }} />
          <span className={`flex-1 ${x.d ? "text-[#aaa] line-through" : ""}`}>{x.t}</span>
          <button onClick={() => setList(list.filter((_, j) => j !== i))} className="text-[11px] text-[#bbb]">删除</button>
        </label>))}
      <div className="mt-2 flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="添加一项" className="min-w-0 flex-1 rounded-lg bg-[#8882] px-2.5 py-1.5 text-[13px] outline-none" />
        <button disabled={!v.trim()} onClick={() => { setList([...list, { t: v.trim(), d: false }]); setV(""); }} className="rounded-lg px-3 text-[13px] font-bold text-white disabled:opacity-40" style={{ background: col }}>添加</button>
      </div>
    </div>);
}
function Note({ card, b, app }: { card: string; b: Block; app: string }) {
  const [t, setT] = useStored<string>(app, `note.${b.id}`, b.text ?? "");
  return <div className={card}>{b.title && <p className="mb-1.5 text-[1em] font-bold">{b.title}</p>}<textarea value={t} onChange={(e) => setT(e.target.value)} rows={6} placeholder="写点什么，自动保存" className="w-full resize-none rounded-lg bg-[#8881] p-2.5 text-[0.96em] outline-none" /></div>;
}
function Counter({ card, b, app, col }: { card: string; b: Block; app: string; col: string }) {
  const [n, setN] = useStored<number>(app, `cnt.${b.id}`, 0);
  return (
    <div className={`${card} flex items-center justify-between`}><span className="text-[14px] font-bold">{b.title || "计数"}</span>
      <span className="flex items-center gap-3"><button onClick={() => setN(Math.max(0, n - 1))} className="h-8 w-8 rounded-full bg-[#8882] text-[18px]">-</button>
        <b className="w-8 text-center text-[20px] tabular-nums" style={{ color: col }}>{n}</b>
        <button onClick={() => setN(n + 1)} className="h-8 w-8 rounded-full text-[18px] text-white" style={{ background: col }}>+</button></span>
    </div>);
}
function Form({ card, b, app, col, toast }: { card: string; b: Block; app: string; col: string; toast: (t: string) => void }) {
  const [rows, setRows] = useStored<Record<string, string>[]>(app, `tbl.${b.store || b.id}`, []);
  const [v, setV] = useState<Record<string, string>>({});
  const fields = b.fields ?? [];
  return (
    <div className={card}>{b.title && <p className="mb-1.5 text-[1em] font-bold">{b.title}</p>}
      <div className="space-y-2">{fields.map((f) => (
        <input key={f.key} type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} placeholder={f.label}
          className="w-full rounded-lg bg-[#8882] px-2.5 py-2 text-[0.96em] outline-none" />))}</div>
      <button disabled={!fields.some((f) => v[f.key]?.trim())} onClick={() => { setRows([{ ...v, __t: new Date().toLocaleString("zh-CN") }, ...rows]); setV({}); toast("已保存"); }}
        className="mt-2.5 w-full rounded-xl py-2.5 text-[14px] font-bold text-white disabled:opacity-40" style={{ background: col }}>保存</button>
    </div>);
}
function Records({ card, b, app, nonce }: { card: string; b: Block; app: string; nonce: number }) {
  const [rows, setRows] = useStored<Record<string, string>[]>(app, `tbl.${b.store || b.id}`, []);
  // 与表单共享同一键：切页回来时重新读一次
  useEffect(() => { setRows(loadData<Record<string, string>[]>(k(app, `tbl.${b.store || b.id}`), [])); }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={card}>{b.title && <p className="mb-1.5 text-[1em] font-bold">{b.title}</p>}
      {!rows.length && <p className="py-4 text-center text-[12.5px] text-[#aaa]">还没有记录</p>}
      {rows.map((r, i) => (
        <div key={i} className="border-b border-black/5 py-2 text-[13px] last:border-0">
          <p>{Object.entries(r).filter(([x]) => x !== "__t").map(([, y]) => y).join(" · ")}</p><p className="text-[10.5px] text-[#aaa]">{r.__t}</p>
        </div>))}
    </div>);
}
function ImageBlock({ card, b, app, max, toast }: { card: string; b: Block; app: string; max: number; toast: (t: string) => void }) {
  const [imgs, setImgs] = useStored<string[]>(app, `img.${b.id}`, []);
  return (
    <div className={card}>{b.title && <p className="mb-1.5 text-[1em] font-bold">{b.title}</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {imgs.map((u, i) => <img key={i} src={u || undefined} alt="" className="aspect-square w-full rounded-lg object-cover" />)}
        <label className="grid aspect-square cursor-pointer place-items-center rounded-lg bg-[#8882] text-[22px] text-[#bbb]">+
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > max * 1048576) return toast(`图片不能超过 ${max} MB`); setImgs([...imgs, await readAsDataURL(f)]); }} />
        </label>
      </div>
    </div>);
}

/* source = "ai"：结合当前世界现写内容，按存档缓存；刷新（nonce 变化）时重写 */
type AiCache = { items?: string[]; text?: string; n: number; at: number };
function useAiContent(b: Block | null, app: string, spec: AppSpec, game: GameState | null, nonce: number) {
  const { cfg } = useGame();
  const [cache, setCache] = useStored<AiCache | null>(app, `ai.${b?.id ?? "_"}`, null);
  const [state, setState] = useState<"ok" | "busy" | "err" | "noai" | "nogame">(cache ? "ok" : "busy");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!b) return;
    if (!game) { if (!cache) setState("nogame"); return; }
    if (cache && nonce === 0) { setState("ok"); return; }
    if (!isConfigured(cfg)) { setState(cache ? "ok" : "noai"); return; }
    let dead = false;
    setState("busy"); setErr("");
    const shape = b.type === "stat" ? "JSON 字符串数组，每项「标签:数值」，4 项以内" : b.type === "list" ? "JSON 字符串数组，每项一条，3~8 项，每项 40 字以内" : "纯文本，200 字以内";
    complete(cfg, [
      { role: "system", content: `你在为游戏世界里小手机上的应用「${spec.name}」（${spec.type}：${spec.intro}）生成真实内容。内容必须属于下面这个游戏世界，贴合时代、地点、人物与最近剧情，不要出现现实世界的品牌或与世界观冲突的事物，不要写示例/占位。\n${worldContext(game)}` },
      { role: "user", content: `为「${b.title || "内容"}」生成：${b.prompt || b.title || "相关内容"}\n输出格式：${shape}。只输出内容本身。` },
    ], 60000).then((raw) => {
      if (dead) return;
      const t = raw.replace(/```(?:json)?/g, "").trim();
      if (b.type === "text") { setCache({ text: t, n: nonce, at: Date.now() }); setState("ok"); return; }
      let items: string[] = [];
      try { const j = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1)); if (Array.isArray(j)) items = j.map(String); } catch { items = t.split(/\n+/).map((x) => x.replace(/^[-*\d.、\s]+/, "").trim()).filter(Boolean); }
      if (!items.length) { setState("err"); return; }
      setCache({ items: items.slice(0, 8), n: nonce, at: Date.now() }); setState("ok");
    }).catch((e) => { if (!dead) { setErr(String((e as Error)?.message ?? e).slice(0, 40)); setState(cache ? "ok" : "err"); } });
    return () => { dead = true; };
  }, [b?.id, nonce, !!game]); // eslint-disable-line react-hooks/exhaustive-deps
  return { items: cache?.items, text: cache?.text, state, err };
}
