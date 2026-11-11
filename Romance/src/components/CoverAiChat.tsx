import { lazyPanel } from "../lib/lazyPanel";
import { getWorld } from "../mods/registry";
import { useEffect, useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import type { CoverDiy } from "../lib/store";
import { generateImage, imageConfigured, isConfigured, streamChat, type ChatMsg } from "../lib/ai";
import { friendlyAIError } from "../lib/aiError";
import { loadGlobal, saveGlobal } from "../lib/saveScope";
import { loadAssets } from "../lib/freeStyle";
import type { CoverCopy } from "../mods/types";
import { applyCoverPatch, coverForPrompt, extractCoverJson, sanitizeCoverPatch } from "../lib/coverAi";
const AIConfigPanel = lazyPanel(() => import("./AIConfigPanel"));
import { IconChevronDown, IconUndo } from "../lib/icons";
import { AssistantMsg, ChangeCard, ChatThread, Composer, LinePill, PlusMenu, StreamText, Suggestions, UserMsg, WorkLine, type ChatChange } from "./CodexChat";

/* 装扮封面 · 对话式生成：选线路（AI 接口 + 模型）→ 描述想要的封面 → AI 回「DIY 字段补丁 + 封面 CSS」→ 立刻套用、预览实时变化。
 * 结果仍是普通 DIY 配置，可在其它页签继续手动搭配；每次套用前留快照，可逐步撤销。 */
const keyOf = (k: string) => (k === "player" ? "star2005.coverChat.v1" : `star2005.coverChat.v1.${k}`); // 玩家一份；每个模组各一份
const QUICK: [string, string][] = [
  ["古风仙侠", "古风仙侠：水墨远山的意境，标题用毛笔字、居中，金色细边的文字卡片，按钮做成玉牌式的圆角描边，花瓣缓缓飘落。"],
  ["赛博霓虹", "赛博朋克霓虹：深蓝紫夜色、标题霓虹发光描边、按钮直角玻璃质感带青色辉光，排在一行，萤火当作电子粒子。"],
  ["清新校园", "清新校园：明亮通透、压暗很浅，标题圆润可爱的樱粉色，文字放在纸质卡片里，按钮胶囊形实底。"],
  ["暗黑哥特", "暗黑哥特：几乎纯黑的压暗、酒红点缀，标题典雅宋体加大并带细微血色光晕，文字菜单式按钮在底部。"],
  ["港风胶片", "九十年代港风胶片：暖琥珀色调、轻微模糊、标题流金渐变特大号，按钮描边圆角，加一点胶片颗粒感。"],
  ["乙女恋爱", "乙女恋爱游戏标题画面：粉紫梦幻、爱心飘落、标题居中特大、毛玻璃卡片、按钮梦幻渐变竖排。"],
];
const LABEL: Record<string, string> = {
  cgMode: "背景类型", bgPreset: "画布底景", bgPattern: "画布纹理", image: "背景图", cgs: "轮播图", cgInterval: "轮播间隔", cgFx: "切换效果", video: "背景视频", dim: "压暗", blur: "模糊", tint: "叠色", tintColor: "叠色",
  kicker: "顶部小字", title: "标题", subtitle: "副标题", intro: "简介", hideTitle: "隐藏标题区", hideKicker: "顶部小字显隐", hideSubtitle: "副标题显隐", hideIntro: "简介显隐", logo: "标题图",
  titleFont: "标题字体", titleColor: "标题颜色", titleCustom: "标题颜色", titleSize: "标题大小", align: "对齐", vpos: "位置", panel: "文字底板",
  btnStyle: "按钮风格", btnShape: "按钮形状", btnLayout: "按钮排列", labels: "按钮文字", hide: "按钮显示", fx: "氛围特效", css: "封面 CSS", cgShuffle: "随机顺序", cgHideDots: "页码点",
};
/* changes：逐项「改前 → 改后」；changed：旧版只记了改动项名称（兼容显示） */
type Turn = { id?: number; role: "user" | "assistant"; text: string; changes?: ChatChange[]; changed?: string[]; failed?: boolean; ms?: number; undone?: boolean };
const VAL: Record<string, Record<string, string>> = {
  bgPreset: { starlight: "星夜流光", dawn: "晨曦微露", noir: "霓虹夜幕", inkwash: "水墨山岚", cyber: "赛博幻境", minimal: "极简画廊" },
  bgPattern: { none: "无", grid: "细网格", dots: "星点阵", lines: "斜纹线", frame: "画报内框", astrolabe: "星盘罗盘" },
  tint: { night: "夜紫", rose: "玫瑰", ocean: "深海", gold: "琥珀", none: "纯黑", custom: "自定" },
  titleFont: { default: "跟随界面", song: "典雅宋体", hei: "现代黑体", round: "圆润可爱", elegant: "清瘦雅致", brush: "手写毛笔", hand: "行书手札", cursive: "潇洒草书", pixel: "复古像素" },
  titleColor: { white: "纯白", gold: "流金渐变", pink: "樱粉渐变", accent: "主题色渐变", custom: "自定" },
  titleSize: { s: "小", m: "标准", l: "大", xl: "特大" }, align: { left: "居左", center: "居中", right: "居右" }, vpos: { top: "偏上", center: "居中", bottom: "偏下" },
  panel: { none: "无", glass: "毛玻璃", dark: "暗色底板", paper: "纸质卡片" },
  btnStyle: { dream: "梦幻渐变", solid: "实底", glass: "毛玻璃", outline: "描边", text: "文字菜单" }, btnShape: { pill: "胶囊", rounded: "圆角", square: "直角" }, btnLayout: { grid: "两列", stack: "竖排", row: "横排" },
  fx: { none: "无", stars: "星光", petals: "花瓣", snow: "细雪", fireflies: "萤火", hearts: "爱心" },
  cgMode: { fixed: "固定 CG", carousel: "轮播", video: "视频" }, cgFx: { fade: "淡入淡出", slide: "滑动", zoom: "缓推" },
};
const fmt = (k: string, v: unknown): string | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (k === "css") return `${String(v).length} 字符`;
  if (typeof v === "string") return v.startsWith("data:") ? "本地图片" : /^https?:/.test(v) ? "图片链接" : VAL[k]?.[v] ?? (v.length > 16 ? `${v.slice(0, 16)}…` : v);
  if (typeof v === "boolean") return v ? "是" : "否";
  if (typeof v === "number") return `${v}${k === "dim" ? "%" : k === "blur" ? "px" : k === "cgInterval" ? "s" : ""}`;
  if (Array.isArray(v)) return `${v.length} 张`;
  const s = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined && x !== "").map(([a, b]) => `${a}:${b === true ? "隐藏" : b}`).join(" ");
  return s ? (s.length > 22 ? `${s.slice(0, 22)}…` : s) : undefined;
};
/** 两份配置的逐项差异（只看动到的键） */
function diffCover(a: CoverDiy, b: CoverDiy, keys: string[]): ChatChange[] {
  const A = a as Record<string, unknown>, B = b as Record<string, unknown>;
  return [...new Set(keys)].filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k])).map((k) => {
    const from = fmt(k, A[k]), to = fmt(k, B[k]);
    return { label: LABEL[k] ?? k, from, to, kind: from === undefined ? "add" : to === undefined ? "del" : "edit" };
  });
}
type Store = { turns: Turn[]; model?: string; open?: boolean }; // open：对话区是否展开（默认收起）

const SYS = (d: CoverDiy, img: boolean, cv: CoverCopy, author: boolean) => {
  const web = loadAssets().filter((a) => /^https:\/\//.test(a.url)).slice(0, 24);
  const who = author ? "剧本作者" : "玩家";
  return `你是游戏开局封面的视觉设计师。${who}用对话描述想要的封面，你通过修改「封面 DIY 配置」来实现，${who}会在旁边实时预览，并可能继续手动微调。${author ? "这是剧本的作者封面，所有玩家进入游戏都会先看到它：标题、副标题、简介要贴合剧本题材，可以直接帮作者写好。" : ""}

【每次回复】先用一两句中文说明这次改了什么（不超过 60 字），再给一个 \`\`\`json 代码块：只写要修改的字段；值写 null 表示恢复默认。没提到的部分保持不变。

【可用字段】
- 背景：bgPreset 画布底景 "starlight"星夜流光|"dawn"晨曦微露|"noir"霓虹夜幕|"inkwash"水墨山岚|"cyber"赛博幻境|"minimal"极简画廊 · bgPattern 画布纹理 "none"|"grid"|"dots"|"lines"|"frame"|"astrolabe" · cgMode "fixed"|"carousel"|"video" · image 固定 CG（https 图片地址）· cgs 轮播图地址数组 · cgInterval 2~30 秒 · cgFx "fade"|"slide"|"zoom" · video 背景视频 https · dim 压暗 0~80 · blur 模糊 0~16 · tint 叠色 "night"夜紫|"rose"玫瑰|"ocean"深海|"gold"琥珀|"none"纯黑|"custom"（配 tintColor "#hex"）
- 文字：kicker ≤40 字 · title ≤20 字 · subtitle ≤30 字 · intro ≤300 字 · hideKicker / hideSubtitle / hideIntro 布尔 · titleFont "default"|"song"典雅宋体|"hei"现代黑体|"round"圆润可爱|"elegant"清瘦雅致|"brush"手写毛笔|"hand"行书手札|"cursive"潇洒草书|"pixel"复古像素 · titleColor "white"|"gold"流金渐变|"pink"樱粉渐变|"accent"主题色渐变|"custom"（配 titleCustom "#hex"）· titleSize "s"|"m"|"l"|"xl"
- 版式：align "left"|"center"|"right" · vpos "top"|"center"|"bottom" · panel "none"|"glass"毛玻璃|"dark"暗色底板|"paper"纸质卡片
- 按钮：btnStyle "dream"梦幻渐变|"solid"实底|"glass"毛玻璃|"outline"描边|"text"文字菜单 · btnShape "pill"|"rounded"|"square" · btnLayout "grid"|"stack"|"row" · labels {start,continue,config} 各 ≤10 字 · hide {continue,config} 布尔（start 不能隐藏）
- 特效：fx "none"|"stars"|"petals"|"snow"|"fireflies"|"hearts"
- css：封面专属 CSS（整段替换旧的，≤8000 字符），系统会自动只作用于封面。可用类名：.cover-root 整体 · .cover-bg 背景图层 · .cover-panel 文字区 · .cover-kicker · .cover-title · .cover-logo · .cover-subtitle · .cover-intro · .cover-btns · .cover-btn · .cover-btn-main 开始按钮 · .cover-btn-sub 次按钮 · .cover-fx 特效层。可写 @keyframes / @media，可 @import Google Fonts。优先用上面的预设字段；预设做不到的（自定义按钮配色、标题描边 / 发光、装饰边框、伪元素纹样、入场动画等）再写 css，并保证文字清晰可读、尊重 prefers-reduced-motion。
${img ? "- bgPrompt：想换背景画面而素材库里没有合适的图时，写一段生图提示词（描述主体、场景、光线、画风，竖屏构图，画面里不要文字），系统会调用生图模型画好并设为固定 CG。" : "- 当前线路没配置生图模型：不能新画背景图，只能用素材库地址或保持现有背景；需要时可提醒${who}在线路设置里配置生图模型。"}

【素材库可用图片】${web.length ? `\n${web.map((a) => `- ${a.name}：${a.url}`).join("\n")}` : "（暂无网络地址）"}
不要编造图片地址：只能用素材库、${who}给出的 https 地址，或 bgPrompt。

${author ? "" : `【作品封面当前文字】标题「${cv.title || getWorld().chain[0]?.name || "未命名作品"}」· 副标题「${cv.subtitle || "（未填）"}」${cv.style ? `\n【世界作者已设样式】${JSON.stringify(coverForPrompt(cv.style))}（玩家配置会叠在上面）` : ""}`}
【当前封面配置】${JSON.stringify(coverForPrompt(d))}`;
};

export default function CoverAiChat({ d, setCover, author = false, storeKey = "player", cover = {}, full = false }: {
  d: CoverDiy; setCover: (n: CoverDiy | undefined) => void;
  author?: boolean; storeKey?: string; cover?: CoverCopy; // cover：玩家端参考的世界封面
  full?: boolean; // full：独立的对话式界面——对话常驻展开、占满主区，不带收起开关
}) {
  const { cfg } = useGame();
  const KEY = keyOf(storeKey);
  const [st, setSt] = useState<Store>(() => { const s = loadGlobal<Store>(KEY, { turns: [] }); return { ...s, turns: Array.isArray(s?.turns) ? s.turns : [] }; });
  useEffect(() => { saveGlobal(KEY, { ...st, turns: st.turns.slice(-24) }); }, [st, KEY]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"" | "chat" | "img">("");
  const [started, setStarted] = useState(0);
  const [live, setLive] = useState("");
  const [err, setErr] = useState("");
  const [line, setLine] = useState(false);
  // 撤销栈只在本次打开期间有效：快照可能含本地大图，不进本地存储
  const [undo, setUndo] = useState<{ id: number; snap: CoverDiy }[]>([]);
  const abort = useRef<AbortController | null>(null);
  const dRef = useRef(d); dRef.current = d;

  const ok = isConfigured(cfg);
  const img = imageConfigured(cfg);
  const models = [cfg.model, ...(cfg.models ?? []).filter((m) => m && m !== cfg.model)].filter(Boolean);
  const model = st.model && models.includes(st.model) ? st.model : cfg.model;
  const host = (() => { try { return new URL(cfg.baseUrl).host; } catch { return cfg.baseUrl || "未接入"; } })();

  /** 套用一次改动并登记撤销点；返回逐项差异 */
  const commit = (next: CoverDiy, id: number, keys: string[]): ChatChange[] => {
    const prev = dRef.current;
    const n = { ...next }; delete n.on;
    const changes = diffCover(prev, n, keys);
    if (!changes.length) return changes;
    setUndo((u) => [...u.slice(-19), { id, snap: prev }]);
    dRef.current = n;
    setCover(Object.keys(n).length ? n : undefined);
    return changes;
  };
  const undoTop = () => {
    const top = undo[undo.length - 1];
    if (!top) return;
    setUndo(undo.slice(0, -1));
    setCover(Object.keys(top.snap).length ? top.snap : undefined);
    setSt((s) => ({ ...s, turns: s.turns.map((t) => (t.id === top.id ? { ...t, undone: true } : t)) }));
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    if (!ok) { setLine(true); setErr("先接入线路（AI 接口与模型），才能对话生成。"); return; }
    const hist: Turn[] = [...st.turns, { role: "user", text: t }];
    const t0 = Date.now();
    setSt((s) => ({ ...s, turns: hist })); setInput(""); setErr(""); setBusy("chat"); setLive(""); setStarted(t0);
    const ctl = new AbortController(); abort.current = ctl;
    try {
      const prior: ChatMsg[] = st.turns.slice(-8).map((x) => ({ role: x.role, content: x.role === "assistant" ? `${x.text}${x.changes?.length || x.changed?.length ? `（已改：${(x.changes?.map((c) => c.label) ?? x.changed ?? []).join("、")}${x.undone ? "，后被撤销" : ""}）` : ""}` : x.text }));
      const full = await streamChat({ ...cfg, model, temperature: 0.8 }, [{ role: "system", content: SYS(dRef.current, img, cover, author) }, ...prior, { role: "user", content: t }],
        (_c, f) => setLive(f.replace(/```[\s\S]*$/, "").trim()), ctl.signal);
      const note = full.replace(/```[\s\S]*?(```|$)/g, "").trim().slice(0, 200);
      const r = sanitizeCoverPatch(extractCoverJson(full));
      const id = Date.now();
      const changes = commit(applyCoverPatch(dRef.current, r), id, [...Object.keys(r.patch), ...r.clear]);
      const extra = r.dropped.length ? `\n（有 ${r.dropped.length} 项不合法，已忽略）` : "";
      setSt((s) => ({ ...s, turns: [...hist, { id, role: "assistant", ms: Date.now() - t0, text: (note || (changes.length ? "已按你的描述调整。" : "这次没有给出可用的改动。")) + extra, changes, failed: !changes.length && !r.bgPrompt }] }));
      setLive("");
      if (r.bgPrompt) {
        if (!img) { setErr("AI 想重画背景，但当前线路没配置生图模型：可在线路设置里填写生图模型。"); return; }
        setBusy("img"); setStarted(Date.now());
        const t1 = Date.now();
        try {
          const url = await generateImage(cfg, r.bgPrompt);
          const id2 = Date.now();
          const ch = commit({ ...dRef.current, image: url, cgMode: "fixed" }, id2, ["image", "cgMode"]);
          setSt((s) => ({ ...s, turns: [...s.turns, { id: id2, role: "assistant", ms: Date.now() - t1, text: "背景图画好了，已设为固定 CG。", changes: ch }] }));
        } catch (e) { setErr(`背景图没画出来：${(e as Error).message}`); }
      }
    } catch (e) {
      setLive("");
      if (ctl.signal.aborted) setSt((s) => ({ ...s, turns: [...hist, { role: "assistant", text: "已停止。", failed: true, ms: Date.now() - t0 }] }));
      else { setErr(friendlyAIError(e).text); setSt((s) => ({ ...s, turns: st.turns })); setInput(t); }
    } finally { setBusy(""); abort.current = null; }
  };

  const top = undo[undo.length - 1]?.id;
  const empty = !st.turns.length && !busy;
  const open = full || !!st.open;
  const setOpen = (v: boolean) => setSt((s) => ({ ...s, open: v }));
  const last = [...st.turns].reverse().find((x) => x.role === "assistant");
  const lastLive = live.split("\n").filter(Boolean).pop() ?? "";
  const rounds = st.turns.filter((x) => x.role === "user").length;
  const ghost = "ui-btn ui-btn-sm ui-btn-ghost shrink-0 gap-1 px-2.5";
  return (
    <div className="codex-ui flex flex-col gap-2.5">
      {/* 标题区：常驻。收起时兼作摘要条（进度 / 上一次结果 / 撤销） */}
      <div className="flex items-center gap-2.5 px-1">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-ink">封面助手</p>
          <div className="mt-0.5 min-w-0 text-xs text-ink-soft">
            {busy && !open ? (
              <div className="flex min-w-0 items-center gap-2">
                <WorkLine running label={busy === "img" ? "正在绘制背景图" : live ? "正在搭配" : "正在思考"} start={started} />
                {busy === "chat" && lastLive && <span className="min-w-0 truncate">{lastLive}</span>}
              </div>
            ) : !open && last ? (
              <p className="truncate">
                <span className={last.failed ? "text-danger" : ""}>{last.text.split("\n")[0]}</span>
                {!!last.changes?.length && <span className="text-ink-soft/80"> · {last.undone ? "已撤销" : `已修改 ${last.changes.length} 项`}</span>}
              </p>
            ) : (
              <p className="truncate">{rounds ? `已对话 ${rounds} 轮` : full ? "描述想要的封面，AI 会直接改好；效果去「实时预览」看" : "描述想要的封面，左侧预览会同步更新"}</p>
            )}
          </div>
        </div>
        {!open && top !== undefined && top === last?.id && !busy && (
          <button type="button" onClick={undoTop} className={ghost}><IconUndo width={13} height={13} />撤销</button>
        )}
        {open && !!st.turns.length && !busy && (
          <button type="button" onClick={() => { setSt((s) => ({ ...s, turns: [] })); setUndo([]); }} className={ghost}>新对话</button>
        )}
        {!full && <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={ghost}>
          {open ? "收起" : st.turns.length ? "展开记录" : "展开对话"}
          <IconChevronDown width={13} height={13} className={`transition ${open ? "rotate-180" : ""}`} />
        </button>}
      </div>
      {line && (
        <div className="ui-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="ui-label">线路设置</span>
            <button type="button" onClick={() => setLine(false)} className={ghost}>完成</button>
          </div>
          <AIConfigPanel />
        </div>
      )}
      {open && (
        <ChatThread className={full ? "h-[min(56dvh,34rem)]" : "max-h-[18rem] min-h-[6rem]"} tick={`${st.turns.length}:${live.length}:${busy}`}
          empty={empty ? <Suggestions title={author ? "想给剧本做什么样的封面？" : "想要什么样的封面？"} hint="点一个风格起步，或直接描述氛围、配色、字体、按钮与动效。" items={QUICK} onPick={setInput} /> : undefined}>
          {st.turns.map((x, i) => x.role === "user" ? <UserMsg key={i} text={x.text} /> : (
            <div key={i} className="space-y-1.5">
              {x.ms !== undefined && <WorkLine running={false} label={x.failed ? "已结束" : "已完成"} ms={x.ms} />}
              <AssistantMsg text={x.text} failed={x.failed}>
                {!!x.changes?.length && <ChangeCard title={`已修改 ${x.changes.length} 项`} changes={x.changes} undone={x.undone} onUndo={x.id === top && !busy ? undoTop : undefined} />}
                {!x.changes && !!x.changed?.length && <ChangeCard title={`已修改 ${x.changed.length} 项`} changes={x.changed.map((label) => ({ label }))} />}
              </AssistantMsg>
            </div>
          ))}
          {busy === "chat" && <div className="space-y-1.5"><WorkLine running label={live ? "正在搭配封面" : "正在思考"} start={started} /><StreamText text={live} /></div>}
          {busy === "img" && <WorkLine running label="正在绘制背景图（可能要几十秒）" start={started} />}
        </ChatThread>
      )}
      {err && <p role="alert" className="rounded-[var(--radius-ui-sm)] border border-danger/25 bg-danger/5 px-3 py-2 text-xs leading-relaxed text-danger">{err}</p>}
      <Composer compact={!open} value={input} onChange={setInput} onSend={() => void send(input)} onStop={() => abort.current?.abort()} busy={!!busy} canStop={busy === "chat"}
        placeholder={st.turns.length ? "接着改，比如「标题再大一点」" : "描述你想要的封面…"}
        tools={<>
          <PlusMenu title="快捷风格" items={QUICK} onPick={setInput} disabled={!!busy} />
          {open && <LinePill ok={ok} host={host} model={model} models={models} badge={ok ? (img ? "可生图" : "未配生图") : undefined}
            onModel={(m) => setSt((s) => ({ ...s, model: m }))} onSettings={() => setLine(true)} />}
        </>} />
      {/* 收起且还没对话时：快捷风格直接摆出来，点一下填进输入框，再点取消 */}
      {!open && empty && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="mr-0.5 text-[11.5px] text-ink-soft">示例</span>
          {QUICK.map(([l, p]) => (
            <button key={l} type="button" title={p} aria-pressed={input === p} onClick={() => setInput(input === p ? "" : p)}
              className={`codex-chip ${input === p ? "is-on" : ""}`}>{l}</button>
          ))}
        </div>
      )}
      {open && <p className="px-1 text-[10.5px] text-ink-soft/80">Enter 发送 · Shift + Enter 换行 · {full ? "改完可切到「实时预览」查看和手动微调" : "改完可在其它页签继续手动调"}</p>}
    </div>
  );
}
