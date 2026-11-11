import { useEffect, useMemo, useRef, useState } from "react";
import type { OpeningCopy } from "../mods/types";
import { friendlyAIError } from "../lib/aiError";
import { loadGlobal, saveGlobal } from "../lib/saveScope";
import { loadAssets } from "../lib/freeStyle";
import { SAMPLE_OPENING, extractHtml, openingSrcDoc, postOpening, type OpeningPageData } from "../lib/openingPage";
import { readFunloomAuthToken } from "../lib/platformAvatarLibrary";
import { completeViaPlatform, type PlatformWorldGenChatMsg } from "../lib/platformWorldGenAi";
import { AssetLibrary } from "./FreeStylePanel";
import { AiModelBillingBadge, AssistantMsg, ChatThread, Composer, PlusMenu, Suggestions, UserMsg, ViewSwitch, WorkLine, type GenView } from "./CodexChat";

/* 模组编辑器 · 自定义开场页样式：对话式让 AI 生成整页 HTML，多轮微调；版本 / 撤销 / 粘贴代码 / 模拟流式预览。
 * 生效的只有 opening.page 一份；对话与历史版本存在本机（按模组 id），不进模组文件。
 * 功能注释：AI 走平台文案模型（运营 text-llm / world-gen/complete），禁止读本机「AI 配置」个人 Key。 */
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink";
const PRESETS: [string, string][] = [
  ["电影胶片感", "电影胶片感：黑底、胶片齿孔边框与轻微颗粒噪点，标题像片头字幕淡入，正文以宽银幕字幕的节奏逐段出现，暖黄色调。"],
  ["古风水墨卷轴", "古风水墨卷轴：宣纸底色与晕染的远山水墨，正文竖排或卷轴展开式呈现，朱砂印章点缀标题，毛笔感字体。"],
  ["星空宇宙", "星空宇宙：深蓝到紫的星云渐变背景、缓慢漂移的粒子星点，标题带微光，正文在半透明玻璃面板里逐段浮现。"],
  ["打字机逐行", "打字机逐行：米白纸张与等宽字体，正文一字一字打出、带闪烁光标与轻微的打字机节奏，段落间换行。"],
  ["像素复古", "像素复古：8-bit 像素字体与像素边框对话框，CRT 扫描线，正文像 RPG 对话框逐字出现，按钮做成像素按键。"],
];
type Turn = { role: "user" | "assistant"; text: string; ver?: number; failed?: boolean };
type Version = { html: string; note: string; at: number };
type Studio = { turns: Turn[]; versions: Version[] };
const keyOf = (modId: string) => `star2005.openingStudio.${modId}`;
/** 功能注释：开场页 HTML 较长，抬高 max_tokens，避免截断缺 </html> */
const OPENING_STYLE_MAX_TOKENS = 8000;

const SYS = (modName: string, o: OpeningCopy | undefined) => {
  const assets = loadAssets();
  const web = assets.filter((a) => /^https?:\/\//.test(a.url)).slice(0, 30);
  const local = assets.length - web.length;
  return `你是文字游戏的视觉设计师兼前端工程师，为剧本「${modName || "未命名剧本"}」设计「开场页」：玩家建角后、正式开局前全屏展示的序章页，承载 AI 实时书写的序章正文（约 500 字）。

【输出格式】
- 先用一两句中文说明这一版的设计（不超过 80 字），然后输出一个完整 HTML 文档，放在 \`\`\`html 代码块里。每次都输出完整文档，不要只给片段或 diff。
- 单文件：内联 <style> 与 <script>；可用 Google Fonts 等公开 CDN；图片 / 视频只能用下方素材库地址、数据里的 image / video，或公开 https 地址。不要写 localStorage / cookie / alert / 表单（沙箱里不可用）。
- 全屏铺满（html,body{height:100%;margin:0}），手机竖屏 375×700 到桌面都要好看；正文区域可滚动，不要被按钮遮挡。尊重 prefers-reduced-motion。

【数据接口 · 不要写死正文】
- 序章数据由游戏注入：window.addEventListener("opening", e => render(e.detail))；脚本启动时若 window.OPENING 已有值先渲染一次。
- detail 字段：kicker 顶部小字 · title 标题 · subtitle 副标题 · name 主角名 · location 开局地点 · time 开局时间 · paragraphs 正文段落数组 · html 作者写的固定笔记 HTML（非空时用它替代 paragraphs）· writing 是否正在书写 · ready 是否写完 · failed 是否失败 · stage 书写阶段提示 · waiting 写完后的提示语 · cta 按钮文案 · image 头图 · video 头图视频（都可能为空字符串）。
- 事件会多次触发：AI 流式书写时 paragraphs 逐渐变长且 writing=true，写完 ready=true。渲染必须幂等：已显示的段落不要重播动画，只给新增段落做入场效果；writing 时显示书写中的状态（如光标 / stage 文案）。
- 开始按钮：ready 为 true 才可点，文案用 cta，点击调用 window.startGame()（等价 parent.postMessage("start","*")）。failed 为 true 时提示「序章没能写出来」，给一个按钮调用 window.retryOpening()，同时允许开始。

【素材库】${web.length ? `\n${web.map((a) => `- ${a.name}：${a.url}`).join("\n")}` : "（暂无可引用的网络地址）"}${local ? `\n另有 ${local} 张仅存本机的图片无法在开场页里引用，如需使用请先在素材库配置图床。` : ""}

【剧本现有序章设定】标题「${o?.title ?? "序章"}」· 顶部小字「${o?.kicker ?? "Prologue"}」· 按钮「${o?.cta ?? "开始"}」${o?.image ? " · 已配置头图（detail.image）" : ""}${o?.video ? " · 已配置视频（detail.video）" : ""}`;
};

function samplePara(o?: OpeningCopy): string[] {
  const ps = (o?.paragraphs ?? []).filter((t) => typeof t === "string" && t.trim());
  return ps.length ? ps.map((t) => t.replace(/\{name\}/g, SAMPLE_OPENING.name).replace(/\{money\}/g, "5,000").replace(/\{\w+\}/g, "……")) : SAMPLE_OPENING.paragraphs;
}

export default function OpeningStyleStudio({ value, onPage, modId, modName }: {
  value?: OpeningCopy; onPage: (page?: string) => void; modId: string; modName: string;
}) {
  const page = value?.page;
  const [st, setSt] = useState<Studio>(() => {
    const s = loadGlobal<Studio>(keyOf(modId), { turns: [], versions: [] });
    const versions = Array.isArray(s?.versions) ? s.versions : [];
    // 导入的模组自带开场页但本机没有历史：当作第 1 版
    return { ...s, turns: Array.isArray(s?.turns) ? s.turns : [], versions: page && !versions.some((v) => v.html === page) ? [...versions, { html: page, note: "已保存的版本", at: Date.now() }] : versions };
  });
  useEffect(() => { if (!saveGlobal(keyOf(modId), { ...st, turns: st.turns.slice(-30), versions: st.versions.slice(-15) })) saveGlobal(keyOf(modId), { ...st, turns: st.turns.slice(-10), versions: st.versions.slice(-5) }); }, [st, modId]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [chars, setChars] = useState(0);
  const [err, setErr] = useState("");
  const [paste, setPaste] = useState<string | null>(null);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [replay, setReplay] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const [started, setStarted] = useState(0);

  // 功能注释：平台登录态决定能否调文案模型；不读本机 AI 配置
  const loggedIn = !!readFunloomAuthToken();

  const curIdx = page ? st.versions.findIndex((v) => v.html === page) : -1;
  const apply = (html?: string) => { onPage(html); setReplay((n) => n + 1); };
  const addVersion = (html: string, note: string) => {
    const versions = [...st.versions, { html, note, at: Date.now() }].slice(-15);
    setSt((s) => ({ ...s, versions }));
    apply(html);
    return versions.length;
  };
  const undo = () => { if (curIdx > 0) apply(st.versions[curIdx - 1].html); else if (page) apply(undefined); };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    if (!readFunloomAuthToken()) { setErr("请先登录平台账号后再生成开场页。"); return; }
    const hist: Turn[] = [...st.turns, { role: "user", text: t }];
    setSt((s) => ({ ...s, turns: hist })); setInput(""); setBusy(true); setErr(""); setChars(0); setStarted(Date.now());
    const ctl = new AbortController(); abort.current = ctl;
    try {
      // 历史只带文字说明；当前版本代码随本轮要求一起发，省 token 也避免模型改旧版
      const prior: PlatformWorldGenChatMsg[] = st.turns.slice(-8).map((x) => ({ role: x.role, content: x.role === "assistant" ? `${x.text}${x.ver ? `（已生成第 ${x.ver} 版）` : ""}` : x.text }));
      const ask = page ? `当前开场页代码如下。在此基础上按要求修改，没提到的部分保持不变，输出完整文档：\n\`\`\`html\n${page}\n\`\`\`\n\n修改要求：${t}` : `请设计开场页：${t}`;
      const messages: PlatformWorldGenChatMsg[] = [{ role: "system", content: SYS(modName, value) }, ...prior, { role: "user", content: ask }];
      const completed = await completeViaPlatform(messages, {
        moduleId: "opening-style",
        feature: "editor:opening-style",
        max_tokens: OPENING_STYLE_MAX_TOKENS,
        signal: ctl.signal,
      });
      const full = completed.text;
      setChars(full.length);
      const html = extractHtml(full);
      const note = full.replace(/```[\s\S]*?(```|$)/g, "").replace(/<!doctype[\s\S]*$/i, "").trim().slice(0, 240);
      if (html) {
        const ver = addVersion(html, (note || t).slice(0, 60));
        setSt((s) => ({ ...s, turns: [...hist, { role: "assistant", text: note || "已生成新版本。", ver }] }));
      } else {
        setSt((s) => ({ ...s, turns: [...hist, { role: "assistant", text: note || "这次没拿到完整的 HTML。", failed: true }] }));
        setErr("没解析到完整的 HTML 文档：可能输出被截断。可以说「请重新输出完整代码」。");
      }
    } catch (e) {
      if (ctl.signal.aborted) setSt((s) => ({ ...s, turns: [...hist, { role: "assistant", text: "已停止生成。", failed: true }] }));
      else { setErr(friendlyAIError(e).text); setSt((s) => ({ ...s, turns: st.turns })); setInput(t); }
    } finally { setBusy(false); abort.current = null; }
  };

  // 预览：注入样例数据并模拟一次流式书写（逐段变长 → 写完）
  const frame = useRef<HTMLIFrameElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const paras = useMemo(() => samplePara(value), [value]);
  const simulate = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    const base: OpeningPageData = { ...SAMPLE_OPENING, kicker: value?.kicker ?? SAMPLE_OPENING.kicker, title: value?.title ?? SAMPLE_OPENING.title, subtitle: value?.subtitle ?? "",
      waiting: value?.waiting ?? SAMPLE_OPENING.waiting, cta: value?.cta ?? SAMPLE_OPENING.cta, image: value?.image ?? "", video: value?.video ?? "" };
    const w = () => frame.current?.contentWindow;
    postOpening(w(), { ...base, paragraphs: [], writing: true, ready: false, stage: "正在落笔……" });
    paras.forEach((_, i) => timers.current.push(setTimeout(() => postOpening(w(), { ...base, paragraphs: paras.slice(0, i + 1), writing: true, ready: false }), 700 + i * 900)));
    timers.current.push(setTimeout(() => postOpening(w(), { ...base, paragraphs: paras, writing: false, ready: true }), 900 + paras.length * 900));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const status = busy ? `生成中 · ${chars ? `${(chars / 1000).toFixed(1)}k 字符` : "等待模型"}` : curIdx >= 0 ? `v${curIdx + 1} · 生效中` : page ? "自定义 · 生效中" : "未生成";

  const [view, setView] = useState<GenView>("preview");

  // 功能注释：直接排在「开场剧情」下，不再套一层圆角卡片大框
  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[13.5px] font-black text-ink">自定义开场页样式</h4>
          <AiModelBillingBadge mode="platform" />
          {/* 功能注释：禁止 span.rounded-full.bg-paper——world-gen 开关规则会刷成近白底，暗色壳里字看不清 */}
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${page ? "bg-jade/15 text-coral ring-jade/35" : "bg-ink/10 text-ink-soft ring-line"}`}>{status}</span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
          在「AI 对话」里描述版式与氛围、连续微调，到「实时预览」看效果和切换版本。要用真实图片 / 视频时先打开
          <button type="button" onClick={() => setAssetsOpen((o) => !o)} className="mx-0.5 font-bold text-jade underline underline-offset-2">素材库</button>
          上传，AI 会写入 CDN 地址。
        </p>
        {assetsOpen && <div className="mt-2 rounded-xl border border-line bg-paper-2 p-2.5"><AssetLibrary /></div>}
      </div>

      <ViewSwitch value={view} onChange={setView} />

      {view === "chat" ? (
        /* —— 对话：Codex 式，占满主区 —— */
        <div className="codex-ui flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5 px-1">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-snug text-ink">开场页助手</p>
              <p className="mt-0.5 truncate text-xs text-ink-soft">{st.turns.length ? `已对话 ${st.turns.filter((x) => x.role === "user").length} 轮 · 每次生成存为一个版本` : "描述想要的开场页，AI 生成整页样式；效果去「实时预览」看"}</p>
            </div>
            {!!st.turns.length && !busy && (
              <button type="button" onClick={() => setSt((s) => ({ ...s, turns: [] }))} className="ui-btn ui-btn-sm ui-btn-ghost shrink-0 px-2.5">新对话</button>
            )}
          </div>
          <ChatThread className="h-[min(56dvh,34rem)]" tick={`${st.turns.length}:${busy}:${chars > 0}`}
            empty={!st.turns.length && !busy ? (loggedIn
              ? <Suggestions title="想要什么样的开场页？" hint="点一个风格起步，或直接描述版式、配色、字体与正文出现的方式。" items={PRESETS} onPick={(d) => setInput(page ? `整体改成${d}` : d)} />
              : <p className="px-1 py-6 text-center text-[12px] text-ink-soft">请先登录平台账号（使用运营后台「文案配置」模型）；也可以到「实时预览」里直接粘贴 HTML。</p>) : undefined}>
            {st.turns.map((x, i) => x.role === "user" ? <UserMsg key={i} text={x.text} /> : (
              <AssistantMsg key={i} text={x.text} failed={x.failed}>
                {x.ver && (
                  <button type="button" onClick={() => { apply(st.versions[x.ver! - 1]?.html); setView("preview"); }} disabled={!st.versions[x.ver - 1]}
                    className="rounded-full bg-jade/12 px-2.5 py-0.5 text-[11px] font-bold text-jade transition hover:bg-jade/20 disabled:opacity-40">
                    v{x.ver} · 去预览 ›
                  </button>
                )}
              </AssistantMsg>
            ))}
            {busy && <WorkLine running label={chars ? `正在排版 · ${(chars / 1000).toFixed(1)}k 字符` : "正在思考"} start={started} />}
          </ChatThread>
          {err && <p role="alert" className="rounded-[var(--radius-ui-sm)] border border-danger/25 bg-danger/5 px-3 py-2 text-xs leading-relaxed text-danger">{err}</p>}
          <Composer value={input} onChange={setInput} onSend={() => void send(input)} onStop={() => abort.current?.abort()} busy={busy} disabled={!loggedIn}
            placeholder={page ? "继续微调：如「标题再大一点」「正文改成竖排」「按钮换成朱砂印章」…" : "描述开场页风格；生成后可多轮连续微调…"}
            tools={<>
              <PlusMenu title="快捷风格" items={PRESETS.map(([l, d]) => [l, page ? `整体改成${d}` : d] as [string, string])} onPick={setInput} disabled={busy} />
              <span className="min-w-0 truncate text-[10.5px] text-ink-soft" title="与管理面板「文案配置」同一套模型">平台文案模型</span>
            </>} />
          <p className="px-1 text-[10.5px] text-ink-soft/80">Enter 发送 · Shift + Enter 换行 · 对话与历史版本只存在本机 · 模型走平台文案配置</p>
        </div>
      ) : (
        /* —— 预览：只看效果 + 版本管理 —— */
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-bold text-ink">开场页预览</span>
            <span className="flex-1" />
            <button type="button" className={btn} disabled={!page || busy} onClick={undo} title={curIdx > 0 ? `回到 v${curIdx}` : "回到内置排版"}>撤销</button>
            <select value={page ? String(curIdx) : "none"} disabled={busy || (!st.versions.length && !page)} aria-label="版本"
              onChange={(e) => { const v = e.target.value; if (v === "none") apply(undefined); else if (st.versions[Number(v)]) apply(st.versions[Number(v)].html); }}
              className="max-w-36 rounded-full border border-line bg-paper px-2 py-1 text-[11.5px] font-semibold text-ink focus:border-jade focus:outline-none disabled:opacity-40">
              <option value="none">版本 · 内置排版</option>
              {page && curIdx < 0 && <option value="-1">当前（未存档）</option>}
              {st.versions.map((v, i) => <option key={i} value={i}>v{i + 1} · {v.note.slice(0, 14)}</option>)}
            </select>
            <button type="button" className={btn} disabled={busy} onClick={() => setPaste(paste === null ? page ?? "" : null)}>{paste === null ? "粘贴代码" : "收起"}</button>
          </div>
          {paste !== null && (
            <div className="space-y-1.5">
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={8} spellCheck={false}
                placeholder={"<!doctype html>\n<html>…\n<script>\n  addEventListener(\"opening\", e => render(e.detail))\n</script>"}
                className="w-full rounded-xl border border-line bg-paper-2 px-2.5 py-2 font-mono text-[11px] text-ink focus:border-jade focus:outline-none" />
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 text-[10.5px] leading-snug text-ink-soft">监听 <code className="font-mono">opening</code> 事件取序章数据，按钮调 <code className="font-mono">startGame()</code>。</span>
                <button type="button" className={btn} onClick={() => setPaste(null)}>取消</button>
                <button type="button" className={btn} disabled={!paste.trim() || paste === page} onClick={() => { addVersion(paste.trim(), "手动粘贴"); setPaste(null); }}>应用为新版本</button>
              </div>
            </div>
          )}
          {page ? (
            <div className="relative overflow-hidden rounded-[14px] border border-line bg-black shadow-inner">
              <iframe key={`${replay}:${curIdx}`} ref={frame} title="开场页预览" sandbox="allow-scripts" srcDoc={openingSrcDoc(page)} onLoad={simulate}
                className="block h-[min(70dvh,560px)] w-full border-0" />
              <button type="button" onClick={() => setReplay((n) => n + 1)}
                className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur transition hover:bg-black/65">↻ 重播书写</button>
            </div>
          ) : (
            <div className="grid h-[min(70dvh,460px)] place-items-center rounded-[14px] border border-dashed border-line bg-paper-2 px-6 text-center">
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-ink">还没有开场页样式</p>
                <p className="text-[11.5px] leading-relaxed text-ink-soft">到「AI 对话」里描述版式与氛围，AI 会生成开场页；不做也行，剧本会用内置排版。</p>
                <div className="flex justify-center gap-3">
                  <button type="button" onClick={() => setView("chat")} className="text-[12px] font-bold text-jade underline underline-offset-2">去 AI 对话</button>
                  <button type="button" onClick={() => setPaste("")} className="text-[12px] font-bold text-ink-soft underline underline-offset-2">直接粘贴 HTML</button>
                </div>
              </div>
            </div>
          )}
          {busy && <p className="text-[11.5px] text-ink-soft"><span className="animate-pulse">▍</span> AI 正在生成新版本，完成后自动刷新预览</p>}
          <p className="text-[10.5px] leading-relaxed text-ink-soft">预览用样例主角演示「AI 逐段书写 → 写完可开始」；正式游玩时注入真实序章。版本与对话只存在本机，模组里只保存当前生效的一版。</p>
        </div>
      )}
    </div>
  );
}
