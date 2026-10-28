import { getWorld } from "../mods/registry";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useGame } from "../store/gameCtx";
import { useMods } from "../mods/registry";
import type { ThemePref } from "../lib/store";
import ImagePicker from "./ImagePicker";
import { SlotImage } from "./FreeStylePanel";
import { useConfirm } from "./EditorKit";
import { IconArrowUp, IconPlus } from "../lib/icons";
import TopbarView, { topbarDataOf } from "./TopbarView";
import {
  BUILTIN_TOPBAR_PRESETS, MODULE_LABELS, REGEX_TARGETS, SAMPLE_REGEX_RULES, SAMPLE_TEMPLATE, SAMPLE_TEMPLATE_CSS, SAMPLE_TOPBAR_DATA,
  TEMPLATE_VARS, applyTopbarPreset, applyTopbarRegex, compileRegex, loadSavedTopbars, newTopbarId, parseTopbarFile, rawBarText,
  regexFileOf, regexPaused, resolveTopbarDiy, saveTopbars, styleFileOf, targetLabel, topbarFieldText,
  type SavedTopbarPreset, type TopbarBg, type TopbarData, type TopbarDiy, type TopbarLayout, type TopbarModuleKey, type TopbarRegexRule,
} from "../lib/topbarDiy";

/* 美化 · 顶栏 DIY：实时预览 + 六个分页（组合 / 名牌 / 状态栏 / 配色 / 正则 / 上传）。
 * 所有改动即时写入 theme.topbarDiy；文本框防抖提交，避免逐字写存储。 */

const chip = (on: boolean) =>
  `rounded-[6px] border px-2 py-1.5 text-[12px] transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink hover:border-jade/60"}`;
const btn = "inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const inp = "w-full rounded-xl border border-line bg-paper px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-jade";
const mono = "w-full rounded-xl border border-line bg-paper px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink outline-none focus:border-jade";
const lab = "mb-1 flex items-baseline gap-2 text-[11.5px] font-bold text-ink";
const iconBtn = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink-soft transition hover:border-jade hover:text-jade disabled:opacity-30";

function Sec({ t, d, right, children }: { t: string; d?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-paper p-3">
      <div className="mb-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold tracking-[0.06em] text-ink">{t}</p>
          {d && <p className="mt-0.5 text-[10.5px] leading-snug text-ink-soft">{d}</p>}
        </div>
        {right}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Switch({ on, onChange, label, small }: { on: boolean; onChange: (v: boolean) => void; label: string; small?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative shrink-0 rounded-full transition ${small ? "h-5 w-9" : "h-6 w-11"} ${on ? "bg-jade" : "bg-line"}`}>
      <span className={`absolute top-0.5 rounded-full bg-white shadow transition-all ${small ? "h-4 w-4" : "h-5 w-5"} ${on ? (small ? "left-[18px]" : "left-[22px]") : "left-0.5"}`} />
    </button>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${on ? "border-line bg-paper" : "border-line bg-paper-2/50"}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-ink">{label}</span>
        {hint && <span className="block truncate text-[10px] text-ink-soft">{hint}</span>}
      </span>
      <Switch small on={on} onChange={onChange} label={label} />
    </div>
  );
}

function Options<T extends string>({ value, options, onPick, cols = "grid-cols-3 sm:grid-cols-5", disabled }: {
  value: T; options: readonly (readonly [T, string, string?])[]; onPick: (v: T) => void; cols?: string; disabled?: boolean;
}) {
  return (
    <div className={`grid gap-1.5 ${cols}`}>
      {options.map(([v, l, d]) => (
        <button key={v} type="button" aria-pressed={value === v} disabled={disabled} onClick={() => onPick(v)} className={`${chip(value === v)} text-center`}>
          <span className="block">{l}</span>
          {d && <span className={`block truncate text-[10px] font-normal ${value === v ? "text-jade/80" : "text-ink-soft"}`}>{d}</span>}
        </button>
      ))}
    </div>
  );
}

function ColorField({ label, value, fb = "#ffffff", onChange }: { label: string; value?: string; fb?: string; onChange: (v?: string) => void }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${value ? "border-jade/60 bg-jade/5" : "border-line bg-paper-2/50"}`}>
      <input type="color" value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : fb} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="h-5 w-5 shrink-0 cursor-pointer border-0 bg-transparent p-0" />
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{label}</span>
      {value ? (
        <button type="button" onClick={() => onChange(undefined)} aria-label={`重置${label}`} className="text-[11px] text-ink-soft hover:text-danger">×</button>
      ) : (
        <span className="text-[10px] text-ink-soft">默认</span>
      )}
    </div>
  );
}

function RangeField({ label, value, min, max, step = 1, unit = "", dflt, onChange }: {
  label: string; value?: number; min: number; max: number; step?: number; unit?: string; dflt: number; onChange: (v?: number) => void;
}) {
  return (
    <div>
      <p className="mb-0.5 flex items-center justify-between text-[11.5px] text-ink">
        <span>{label}</span>
        <span className="flex items-center gap-1.5 tabular-nums text-ink-soft">
          {value != null ? `${value}${unit}` : "默认"}
          {value != null && <button type="button" onClick={() => onChange(undefined)} aria-label={`重置${label}`} className="hover:text-danger">×</button>}
        </span>
      </p>
      <input type="range" min={min} max={max} step={step} value={value ?? dflt} onChange={(e) => onChange(+e.target.value)} aria-label={label} className="w-full accent-[var(--jade)]" />
    </div>
  );
}

/* 防抖文本框：本地即时回显，停顿 400ms / 失焦 / 卸载时才提交 */
function DraftText({ value, onCommit, multiline, rows = 4, className = inp, placeholder, maxLength, label, inputRef }: {
  value: string; onCommit: (v: string) => void; multiline?: boolean; rows?: number; className?: string; placeholder?: string; maxLength?: number; label: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [v, setV] = useState(value);
  const committed = useRef(value);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const vRef = useRef(v);
  vRef.current = v;
  useEffect(() => {
    if (value !== committed.current) { committed.current = value; setV(value); }
  }, [value]);
  useEffect(() => {
    if (v === committed.current) return;
    const t = window.setTimeout(() => { committed.current = v; commitRef.current(v); }, 400);
    return () => window.clearTimeout(t);
  }, [v]);
  useEffect(() => () => { if (vRef.current !== committed.current) commitRef.current(vRef.current); }, []);
  const flush = () => { if (v !== committed.current) { committed.current = v; commitRef.current(v); } };
  return multiline ? (
    <textarea ref={inputRef} value={v} rows={rows} spellCheck={false} placeholder={placeholder} maxLength={maxLength} aria-label={label}
      onChange={(e) => setV(e.target.value)} onBlur={flush} className={className} />
  ) : (
    <input value={v} placeholder={placeholder} maxLength={maxLength} aria-label={label} onChange={(e) => setV(e.target.value)} onBlur={flush} className={className} />
  );
}

/* 缩略预览：把真实顶栏按 50% 缩放塞进卡片 */
function Thumb({ diy, data, topbar, topbarText }: { diy?: TopbarDiy; data: TopbarData; topbar?: TopbarBg; topbarText?: string }) {
  return (
    <span className="pointer-events-none relative block h-[58px] overflow-hidden bg-paper-2" aria-hidden>
      <span className="absolute left-0 top-0 block w-[200%] origin-top-left scale-50">
        <TopbarView preview data={data} diy={diy} topbar={topbar} topbarText={topbarText} />
      </span>
    </span>
  );
}

function GRow({ children }: { children: ReactNode }) {
  return <span className="flex w-full items-center gap-1">{children}</span>;
}
function LayoutGlyph({ v }: { v: TopbarLayout }) {
  const dot = <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-jade/70" />;
  const line = <span className="h-1.5 w-5 rounded-full bg-ink-soft/40" />;
  const bar = <span className="h-2 flex-1 rounded-full border border-jade/40 bg-jade/10" />;
  const menu = <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-coral/70" />;
  return (
    <span className="mb-1 flex h-8 w-full flex-col justify-center gap-1 rounded-md bg-paper-2 px-1.5" aria-hidden>
      {v === "double" && <><GRow>{dot}{line}{menu}</GRow><GRow>{bar}</GRow></>}
      {v === "reverse" && <><GRow>{bar}{menu}</GRow><GRow>{dot}{line}</GRow></>}
      {v === "single" && <GRow>{dot}{bar}{menu}</GRow>}
      {v === "statusOnly" && <GRow>{bar}{menu}</GRow>}
      {v === "profileOnly" && <GRow>{dot}{line}{menu}</GRow>}
    </span>
  );
}

const LAYOUTS: [TopbarLayout, string, string][] = [
  ["double", "双层", "名牌在上 · 状态在下"], ["reverse", "反转", "状态在上 · 名牌在下"], ["single", "单行", "全部压成一行"],
  ["statusOnly", "只留状态", "收起名牌"], ["profileOnly", "只留名牌", "收起状态栏"],
];

/* 单条正则：折叠卡片 + 就地试跑 */
function RuleCard({ r, i, n, data, onChange, onMove, onRemove }: {
  r: TopbarRegexRule; i: number; n: number; data: TopbarData; onChange: (p: Partial<TopbarRegexRule>) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sample, setSample] = useState<string | null>(null);
  const { error } = compileRegex(r.pattern, r.flags);
  const paused = regexPaused(r);
  const input = sample ?? topbarFieldText(r.target, data, getWorld().chain[0]?.name || "未命名作品");
  const res = applyTopbarRegex(input, r.target === "all" ? "location" : r.target, [{ ...r, enabled: true }]);
  return (
    <div className={`overflow-hidden rounded-xl border ${r.enabled ? "border-line bg-paper" : "border-dashed border-line bg-paper-2/40"}`}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <Switch small on={r.enabled} onChange={(v) => onChange({ enabled: v })} label={`启用「${r.name}」`} />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className={`block truncate text-[12.5px] font-bold ${r.enabled ? "text-ink" : "text-ink-soft"}`}>{r.name || "未命名规则"}</span>
          <span className="block truncate font-mono text-[10.5px] text-ink-soft">{targetLabel(r.target)} · /{r.pattern}/{r.flags ?? "g"}</span>
        </button>
        {error && <span className="shrink-0 rounded-full bg-danger/12 px-1.5 py-0.5 text-[10px] font-bold text-danger">语法错误</span>}
        {paused && !error && <span className="shrink-0 rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold" title="这条正则执行太慢，已自动暂停；修改后恢复">已暂停</span>}
        <button type="button" onClick={() => onMove(-1)} disabled={i === 0} aria-label="上移" className={iconBtn}><IconArrowUp width={12} height={12} /></button>
        <button type="button" onClick={() => onMove(1)} disabled={i === n - 1} aria-label="下移" className={iconBtn}><IconArrowUp width={12} height={12} className="rotate-180" /></button>
        <button type="button" onClick={onRemove} aria-label={`删除「${r.name}」`} className={`${iconBtn} hover:border-danger hover:text-danger`}>×</button>
      </div>
      {open && (
        <div className="space-y-2.5 border-t border-line bg-paper-2/30 p-2.5">
          <div>
            <p className={lab}>名称</p>
            <DraftText label="规则名称" value={r.name} maxLength={40} onCommit={(v) => onChange({ name: v })} />
          </div>
          <div>
            <p className={lab}>作用于</p>
            <div className="flex flex-wrap gap-1">
              {REGEX_TARGETS.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={r.target === k} onClick={() => { onChange({ target: k }); setSample(null); }}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition ${r.target === k ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink hover:border-jade/60"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_4.5rem] gap-1.5">
            <div>
              <p className={lab}>查找（正则）</p>
              <DraftText label="查找正则" value={r.pattern} className={mono} placeholder="例如 (\d+)" onCommit={(v) => onChange({ pattern: v })} />
            </div>
            <div>
              <p className={lab}>标志</p>
              <DraftText label="正则标志" value={r.flags ?? "g"} className={mono} placeholder="g" maxLength={6} onCommit={(v) => onChange({ flags: v })} />
            </div>
          </div>
          {error && <p className="text-[11px] text-danger">{error}</p>}
          <div>
            <p className={lab}>替换为 <span className="font-normal text-ink-soft">$1 引用分组 · 可写 HTML</span></p>
            <DraftText multiline rows={3} label="替换内容" value={r.replacement} className={mono} placeholder={"<b style=\"color:var(--gold)\">$1</b>"} onCommit={(v) => onChange({ replacement: v })} />
          </div>
          <div>
            <p className={lab}>附带 CSS <span className="font-normal text-ink-soft">可选 · 规则启用时生效</span></p>
            <DraftText multiline rows={2} label="附带 CSS" value={r.css ?? ""} className={mono} placeholder=".app-topbar .my-class { color: var(--coral); }" onCommit={(v) => onChange({ css: v.trim() ? v : undefined })} />
          </div>
          <div className="rounded-lg border border-dashed border-jade/40 bg-jade/[0.04] p-2">
            <p className="mb-1 flex items-center justify-between text-[11px] font-bold text-ink">
              试一试
              <span className={`font-normal ${res.changed ? "text-jade" : "text-ink-soft"}`}>{error ? "无法运行" : res.changed ? "已匹配" : "未匹配"}</span>
            </p>
            <input value={input} onChange={(e) => setSample(e.target.value)} aria-label="测试文本" className={inp} />
            <div className="mt-1.5 min-h-8 overflow-x-auto rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink" dangerouslySetInnerHTML={{ __html: res.html }} />
            <p className="mt-1 text-[10px] text-ink-soft">附带 CSS 的效果以上方实时预览为准</p>
          </div>
        </div>
      )}
    </div>
  );
}

type TabKey = "combo" | "profile" | "bar" | "color" | "regex" | "upload";

export default function TopbarDiyPanel() {
  const { theme, setTheme, game } = useGame();
  const { world } = useMods();
  const [confirm, confirmEl] = useConfirm();
  // 始终基于最新外观提交：防抖文本框与连续操作不会互相覆盖
  const tRef = useRef(theme);
  tRef.current = theme;
  const commit = (t: ThemePref) => { tRef.current = t; setTheme(t); };
  const patch = (fn: (d: TopbarDiy) => TopbarDiy) => { const t = tRef.current; commit({ ...t, topbarDiy: fn({ ...(t.topbarDiy ?? {}) }) }); };
  const set = (p: Partial<TopbarDiy>) => patch((d) => ({ ...d, on: true, ...p }));
  const setOpt = <K extends keyof TopbarDiy>(k: K, v: TopbarDiy[K] | undefined) =>
    patch((d) => {
      const n: TopbarDiy = { ...d, on: true };
      if (v === undefined || v === "") delete n[k];
      else n[k] = v;
      return n;
    });
  const setTheme2 = (p: Partial<ThemePref>) => commit({ ...tRef.current, ...p });

  const d: TopbarDiy = theme.topbarDiy ?? {};
  const enabled = d.on !== false;
  const c = resolveTopbarDiy({ ...d, on: true });
  const data: TopbarData = game ? topbarDataOf(game, world.chain[0]?.name) : SAMPLE_TOPBAR_DATA;
  const rules = d.regexRules ?? [];
  const [tab, setTab] = useState<TabKey>("combo");
  const [orient, setOrient] = useState<"portrait" | "landscape">(theme.orient === "landscape" ? "landscape" : "portrait");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [lib, setLib] = useState<SavedTopbarPreset[]>(loadSavedTopbars);
  const [styleName, setStyleName] = useState("");
  const [author, setAuthor] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);

  const persist = (l: SavedTopbarPreset[]) => { setLib(l); if (!saveTopbars(l)) setMsg({ ok: false, t: "存储空间不足，未能保存到「我的顶栏样式」" }); };
  const download = (name: string, payload: unknown, ext: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    a.download = `${name.replace(/[\\/:*?"<>|]/g, "_") || "topbar"}${ext}`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const snapshot = (): SavedTopbarPreset => ({
    id: newTopbarId("tbs"), name: styleName.trim() || "我的顶栏", author: author.trim() || undefined, at: Date.now(),
    topbar: theme.topbar, topbarText: theme.topbarText, diy: { ...d, on: true },
  });
  // 套用整套样式；样式里没带正则时保留玩家自己的正则
  const applySaved = (s: SavedTopbarPreset) => {
    const t = tRef.current;
    const cur = t.topbarDiy?.regexRules;
    commit({
      ...t, topbar: s.topbar ?? t.topbar, topbarText: s.topbarText ?? t.topbarText,
      topbarDiy: { ...s.diy, on: true, regexRules: s.diy.regexRules?.length ? s.diy.regexRules : cur },
    });
    setMsg({ ok: true, t: `已套用「${s.name}」` });
  };
  const onImport = async (f: File) => {
    try {
      const r = parseTopbarFile(await f.text(), f.name);
      const parts: string[] = [];
      if (r.styles.length) {
        persist([...r.styles, ...lib.filter((x) => !r.styles.some((s) => s.name === x.name))]);
        applySaved(r.styles[0]);
        parts.push(`样式 ${r.styles.length} 套（已套用「${r.styles[0].name}」）`);
      }
      if (r.rules.length) {
        patch((x) => ({ ...x, on: true, regexRules: [...(x.regexRules ?? []), ...r.rules] }));
        parts.push(`样式正则 ${r.rules.length} 条`);
      }
      if (r.html != null || r.css != null) {
        patch((x) => ({ ...x, on: true, ...(r.html != null ? { customHtml: r.html, templateOn: true } : {}), ...(r.css != null ? { customCss: r.css } : {}) }));
        parts.push([r.html != null && "HTML 模板", r.css != null && "CSS"].filter(Boolean).join(" + "));
      }
      setMsg({ ok: true, t: `已导入：${parts.join("、")}` });
      if (r.rules.length && !r.styles.length) setTab("regex");
    } catch (e) {
      setMsg({ ok: false, t: `导入失败：${e instanceof Error ? e.message : "文件格式错误"}` });
    }
  };
  const setRules = (fn: (rs: TopbarRegexRule[]) => TopbarRegexRule[]) => patch((x) => ({ ...x, on: true, regexRules: fn(x.regexRules ?? []) }));
  const moveIn = <T,>(list: T[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  };
  const insertVar = (k: string) => {
    const el = htmlRef.current;
    const token = `{{${k}}}`;
    const cur = el?.value ?? d.customHtml ?? "";
    const s = el?.selectionStart ?? cur.length;
    const e = el?.selectionEnd ?? cur.length;
    set({ customHtml: cur.slice(0, s) + token + cur.slice(e) });
    window.setTimeout(() => { el?.focus(); el?.setSelectionRange(s + token.length, s + token.length); }, 30);
  };
  const tplOn = c.templateOn && !!d.customHtml?.trim();

  const TABS: [TabKey, string][] = [
    ["combo", "组合"], ["profile", "名牌"], ["bar", "状态栏"], ["color", "配色"], ["regex", rules.length ? `正则 ${rules.length}` : "正则"], ["upload", "上传"],
  ];

  return (
    <div className="space-y-3 text-ink">
      {confirmEl}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] leading-relaxed text-ink-soft">
          版式、名牌、状态栏模块与配色自由组合；也能上传自己的样式文件、HTML 模板和样式正则。关闭开关即恢复默认顶栏，设置保留。
        </p>
        <Switch on={enabled} onChange={(v) => patch((x) => ({ ...x, on: v }))} label="启用顶栏 DIY" />
      </div>

      {/* 实时预览：与主界面同一个组件 */}
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-2">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
          <span className="text-[11px] font-bold tracking-[0.2em] text-ink-soft">实时预览{!enabled && " · DIY 已关闭"}</span>
          <div role="tablist" aria-label="预览方向" className="flex gap-0.5 rounded-full border border-line bg-paper p-0.5">
            {([["portrait", "竖屏"], ["landscape", "横屏"]] as const).map(([v, l]) => (
              <button key={v} type="button" role="tab" aria-selected={orient === v} onClick={() => setOrient(v)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${orient === v ? "bg-jade text-white" : "text-ink-soft hover:text-ink"}`}>{l}</button>
            ))}
          </div>
        </div>
        <TopbarView preview data={data} diy={theme.topbarDiy} topbar={theme.topbar} topbarText={theme.topbarText} compact={orient === "landscape"} />
        <div className="h-6 bg-gradient-to-b from-jade/10 to-transparent" aria-hidden />
      </div>

      <div role="tablist" aria-label="顶栏 DIY 分页" className="flex gap-1 overflow-x-auto rounded-full border border-line bg-paper-2 p-1 [scrollbar-width:none]">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition ${tab === k ? "bg-paper text-jade shadow-sm" : "text-ink-soft hover:text-ink"}`}>{l}</button>
        ))}
      </div>

      {tplOn && tab !== "upload" && tab !== "regex" && (
        <p className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[11.5px] text-ink">
          正在使用自定义 HTML 模板，组合式设置暂不生效（配色与正则仍生效）。
          <button type="button" onClick={() => setTab("upload")} className="ml-1 font-bold text-jade hover:underline">去「上传」页管理模板 ›</button>
        </p>
      )}
      {msg && <p className={`rounded-xl px-3 py-2 text-[11.5px] ${msg.ok ? "bg-jade/10 text-jade" : "bg-danger/10 text-danger"}`}>{msg.t}</p>}

      {tab === "combo" && (<>
        <Sec t="一键组合" d="套用后仍可在各分页逐项微调；颜色、贴图、正则与代码会保留">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BUILTIN_TOPBAR_PRESETS.map((p) => {
              const cur = (d.preset ?? "glass") === p.id;
              const next = applyTopbarPreset(d, p);
              return (
                <button key={p.id} type="button" aria-pressed={cur} onClick={() => commit({ ...tRef.current, topbarDiy: applyTopbarPreset(tRef.current.topbarDiy, p) })}
                  className={`overflow-hidden rounded-xl border text-left transition ${cur ? "border-jade ring-2 ring-jade/30" : "border-line hover:border-jade/60"}`}>
                  <Thumb diy={next} data={data} topbar={theme.topbar} topbarText={theme.topbarText} />
                  <span className="block border-t border-line bg-paper px-2.5 py-1.5">
                    <span className={`block text-[12.5px] font-bold ${cur ? "text-jade" : "text-ink"}`}>{p.name}</span>
                    <span className="block truncate text-[10px] text-ink-soft">{p.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Sec>
        <Sec t="版式" d="名牌、标题与状态栏怎么摆；横屏会自动压成单行">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {LAYOUTS.map(([v, l, desc]) => (
              <button key={v} type="button" aria-pressed={c.layout === v} onClick={() => set({ layout: v })} className={`${chip(c.layout === v)} text-center`}>
                <LayoutGlyph v={v} />
                <span className="block">{l}</span>
                <span className={`block truncate text-[10px] font-normal ${c.layout === v ? "text-jade/80" : "text-ink-soft"}`}>{desc}</span>
              </button>
            ))}
          </div>
        </Sec>
        <Sec t="背景效果与底图">
          <Options value={theme.topbar ?? "gradient"} cols="grid-cols-3"
            options={[["gradient", "流光渐变", "柔和斜向渐变"], ["aurora", "极光幻彩", "浓郁多彩光晕"], ["plain", "简约纯色", "干净无渐变"]]}
            onPick={(v) => setTheme2({ topbar: v })} />
          <div>
            <p className={lab}>顶栏底图</p>
            <SlotImage slot="topbar" label="顶栏底图" />
          </div>
        </Sec>
        <Sec t="标语" d="填写后替换居中标题，显示为流光渐变字；留空则显示世界名与主标题">
          <DraftText label="顶栏标语" value={theme.topbarText ?? ""} maxLength={12} placeholder="例如：星光之城" onCommit={(v) => setTheme2({ topbarText: v })} />
        </Sec>
      </>)}

      {tab === "profile" && (<>
        <Sec t="头像">
          <div>
            <p className={lab}>形状</p>
            <Options value={c.avatarShape} cols="grid-cols-4" options={[["circle", "圆形"], ["rounded", "圆角方"], ["diamond", "菱形"], ["hidden", "不显示"]]} onPick={(v) => set({ avatarShape: v })} />
          </div>
          <div>
            <p className={lab}>外框</p>
            <Options value={c.avatarFrame} cols="grid-cols-5" disabled={c.avatarShape === "hidden"}
              options={[["halo", "流光"], ["gold", "鎏金"], ["white", "白边"], ["solid", "主色"], ["none", "无"]]} onPick={(v) => set({ avatarFrame: v })} />
          </div>
          <RangeField label="头像大小" value={d.avatarSize} min={24} max={60} unit="px" dflt={40} onChange={(v) => setOpt("avatarSize", v)} />
          <div>
            <p className={lab}>头像框贴图 <span className="font-normal text-ink-soft">透明 PNG，叠在头像外圈</span></p>
            <ImagePicker value={d.avatarFrameImg} label="头像框贴图" onChange={(u) => setOpt("avatarFrameImg", u)} />
          </div>
          {d.avatarFrameImg && <RangeField label="贴图大小" value={d.frameScale} min={100} max={200} step={5} unit="%" dflt={145} onChange={(v) => setOpt("frameScale", v)} />}
        </Sec>
        <Sec t="名牌">
          <Options value={c.cardStyle} cols="grid-cols-5" options={[["none", "无底衬"], ["glass", "磨砂卡"], ["pill", "胶囊"], ["card", "卡片"], ["tag", "名签"]]} onPick={(v) => set({ cardStyle: v })} />
          <div>
            <p className={lab}>名牌底图</p>
            <ImagePicker value={d.cardImg} label="名牌底图" onChange={(u) => setOpt("cardImg", u)} />
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <Toggle label="名字" on={c.showName} onChange={(v) => set({ showName: v })} />
            <Toggle label="年龄" on={c.showAge} onChange={(v) => set({ showAge: v })} />
            <Toggle label="查看档案按钮" on={c.showArchiveBtn} onChange={(v) => set({ showArchiveBtn: v })} />
          </div>
          {c.showArchiveBtn && (
            <div>
              <p className={lab}>档案按钮文字</p>
              <DraftText label="档案按钮文字" value={d.archiveText ?? ""} maxLength={16} placeholder="查看档案 ›" onCommit={(v) => setOpt("archiveText", v.trim() || undefined)} />
            </div>
          )}
        </Sec>
        <Sec t="居中标题" d="宽屏时显示在顶栏正中；「组合」页的标语会替换它" right={<Switch small on={c.showCenterTitle} onChange={(v) => set({ showCenterTitle: v })} label="显示居中标题" />}>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <p className={lab}>副标</p>
              <DraftText label="居中副标" value={d.titleSub ?? ""} maxLength={24} placeholder={data.world || "世界名"} onCommit={(v) => setOpt("titleSub", v.trim() || undefined)} />
            </div>
            <div>
              <p className={lab}>主标</p>
              <DraftText label="居中主标" value={d.titleMain ?? ""} maxLength={24} placeholder="留空用当前作品名" onCommit={(v) => setOpt("titleMain", v.trim() || undefined)} />
            </div>
          </div>
        </Sec>
        <Sec t="右上角">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <Toggle label="行动点胶囊" hint="也可以放进状态栏（状态栏分页）" on={c.apRight} onChange={(v) => set({ apRight: v })} />
            <Toggle label="结束按钮" hint="菜单按钮始终保留" on={c.showEndBtn} onChange={(v) => set({ showEndBtn: v })} />
            <Toggle label="顶栏下方提示行" hint="世界状态的一行说明文字" on={!d.hideNote} onChange={(v) => setOpt("hideNote", v ? undefined : true)} />
          </div>
        </Sec>
      </>)}

      {tab === "bar" && (<>
        <Sec t="样式">
          <Options value={c.barStyle} options={[["pill", "一体胶囊"], ["grid", "分格"], ["chips", "散卡徽章"], ["minimal", "纯文字"], ["underline", "下划线"]]} onPick={(v) => set({ barStyle: v })} />
          <div>
            <p className={lab}>排布 {c.barStyle === "grid" && <span className="font-normal text-ink-soft">分格样式自动均分</span>}</p>
            <Options value={c.align} cols="grid-cols-3" disabled={c.barStyle === "grid"} options={[["between", "两端撑满"], ["left", "靠左"], ["center", "居中"]]} onPick={(v) => set({ align: v })} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Toggle label="小图标" on={c.showIcons} onChange={(v) => set({ showIcons: v })} />
            <Toggle label="小标题" hint="日期 / 地点 / 天气…" on={c.showLabels} onChange={(v) => set({ showLabels: v })} />
          </div>
        </Sec>
        <Sec t="模块与顺序" d="箭头调整顺序，开关决定显示；本局没有数据的模块会自动隐藏"
          right={(d.modules || d.hiddenModules) && <button type="button" className={btn} onClick={() => patch((x) => { const n = { ...x }; delete n.modules; delete n.hiddenModules; return n; })}>恢复默认</button>}>
          <div className="space-y-1.5">
            {c.modules.map((k: TopbarModuleKey, i) => {
              const shown = !c.hidden[k];
              const value = k === "days" ? (data.daysLeft != null ? `主线剩 ${data.daysLeft} 天` : "本局没有主线期限") : k === "ap" ? (data.ap != null ? `${data.ap}/${data.apMax}` : "—") : topbarFieldText(k, data, d.titleMain?.trim() || getWorld().chain[0]?.name || "未命名作品") || "—";
              return (
                <div key={k} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${shown ? "border-line bg-paper" : "border-dashed border-line bg-paper-2/50"}`}>
                  <span className="w-4 text-center font-serif text-[11px] tabular-nums text-jade/60">{i + 1}</span>
                  <span className={`shrink-0 text-[12.5px] font-bold ${shown ? "text-ink" : "text-ink-soft"}`}>{MODULE_LABELS[k]}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">{value}</span>
                  <button type="button" onClick={() => set({ modules: moveIn(c.modules, i, -1) })} disabled={i === 0} aria-label={`上移${MODULE_LABELS[k]}`} className={iconBtn}><IconArrowUp width={12} height={12} /></button>
                  <button type="button" onClick={() => set({ modules: moveIn(c.modules, i, 1) })} disabled={i === c.modules.length - 1} aria-label={`下移${MODULE_LABELS[k]}`} className={iconBtn}><IconArrowUp width={12} height={12} className="rotate-180" /></button>
                  <Switch small on={shown} onChange={(v) => set({ hiddenModules: { ...c.hidden, [k]: !v } })} label={`显示${MODULE_LABELS[k]}`} />
                </div>
              );
            })}
          </div>
        </Sec>
        <Sec t="底衬与字号" d={c.barStyle === "chips" ? "散卡样式下作用到每一枚徽章" : "留空跟随皮肤"}>
          <div className="grid grid-cols-2 gap-1.5">
            <ColorField label="底色" value={d.barBg} onChange={(v) => setOpt("barBg", v)} />
            <ColorField label="描边" value={d.barBorder} fb="#cccccc" onChange={(v) => setOpt("barBorder", v)} />
          </div>
          <RangeField label="底色不透明度" value={d.barAlpha} min={0} max={100} step={5} unit="%" dflt={65} onChange={(v) => setOpt("barAlpha", v)} />
          <RangeField label="圆角" value={d.barRadius} min={0} max={40} unit="px" dflt={16} onChange={(v) => setOpt("barRadius", v)} />
          <RangeField label="字号" value={d.fontSize} min={10} max={18} step={0.5} unit="px" dflt={12} onChange={(v) => setOpt("fontSize", v)} />
          <div>
            <p className={lab}>状态栏底图</p>
            <ImagePicker value={d.barImg} label="状态栏底图" onChange={(u) => setOpt("barImg", u)} />
          </div>
        </Sec>
      </>)}

      {tab === "color" && (<>
        <Sec t="顶栏底色与质感" d="留空跟随皮肤">
          <div className="grid grid-cols-2 gap-1.5">
            <ColorField label="底色" value={d.bg} onChange={(v) => setOpt("bg", v)} />
            <ColorField label="底边线" value={d.border} fb="#cccccc" onChange={(v) => setOpt("border", v)} />
          </div>
          <RangeField label="不透明度" value={d.bgAlpha} min={0} max={100} step={5} unit="%" dflt={92} onChange={(v) => setOpt("bgAlpha", v)} />
          <ImagePicker value={d.bgImg} label="顶栏背景图" onChange={(u) => setOpt("bgImg", u)} />
          {d.bgImg && <RangeField label="背景图不透明度" value={d.bgImgAlpha} min={0} max={100} step={5} unit="%" dflt={100} onChange={(v) => setOpt("bgImgAlpha", v)} />}
          <RangeField label="毛玻璃模糊" value={d.blur} min={0} max={30} unit="px" dflt={24} onChange={(v) => setOpt("blur", v)} />
          <RangeField label="底边线粗细" value={d.borderW} min={0} max={6} unit="px" dflt={1} onChange={(v) => setOpt("borderW", v)} />
          <RangeField label="上下留白" value={d.padY} min={0} max={24} unit="px" dflt={10} onChange={(v) => setOpt("padY", v)} />
          <div>
            <p className={lab}>阴影</p>
            <Options value={d.shadow ?? "soft"} cols="grid-cols-4" options={[["none", "无"], ["soft", "柔和"], ["glow", "主色光晕"], ["strong", "浓重"]]} onPick={(v) => set({ shadow: v })} />
          </div>
        </Sec>
        <Sec t="右侧按钮" d="行动点、结束、菜单按钮">
          <div className="grid grid-cols-2 gap-1.5">
            <ColorField label="按钮底色" value={d.btnBg} onChange={(v) => setOpt("btnBg", v)} />
            <ColorField label="按钮文字" value={d.btnText} fb="#333333" onChange={(v) => setOpt("btnText", v)} />
          </div>
          <RangeField label="圆角" value={d.btnRadius} min={0} max={20} unit="px" dflt={20} onChange={(v) => setOpt("btnRadius", v)} />
        </Sec>
        <Sec t="文字与强调色" d="只作用于顶栏，不影响其它界面">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <ColorField label="主要文字" value={d.text} fb="#333333" onChange={(v) => setOpt("text", v)} />
            <ColorField label="次要文字" value={d.textSoft} fb="#888888" onChange={(v) => setOpt("textSoft", v)} />
            <ColorField label="强调色" value={d.accent} fb="#a855f7" onChange={(v) => setOpt("accent", v)} />
          </div>
        </Sec>
      </>)}

      {tab === "regex" && (<>
        <Sec t="样式正则" d="显示前用正则改写顶栏文字：$1 引用分组，可写 HTML 与内联样式（脚本、事件属性会被过滤）。兼容 SillyTavern 酒馆正则 JSON。">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btn}
              onClick={() => setRules((rs) => [...rs, { id: newTopbarId("rx"), name: `规则 ${rs.length + 1}`, enabled: true, target: "all", pattern: "", flags: "g", replacement: "" }])}>
              <IconPlus width={13} height={13} />新建规则
            </button>
            <button type="button" className={btn} onClick={() => fileRef.current?.click()}>导入正则文件</button>
            <button type="button" className={btn} disabled={!rules.length} onClick={() => download("顶栏样式正则", regexFileOf(rules), ".regex.json")}>导出全部</button>
          </div>
          {rules.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">还没有规则：新建一条、导入正则文件，或从下方示例里挑一条</p>
          ) : (
            <div className="space-y-1.5">
              {rules.map((r, i) => (
                <RuleCard key={r.id} r={r} i={i} n={rules.length} data={data}
                  onChange={(p) => setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...p } : x)))}
                  onMove={(dir) => setRules((rs) => moveIn(rs, rs.findIndex((x) => x.id === r.id), dir))}
                  onRemove={async () => { if (await confirm(`删除正则「${r.name}」？`)) setRules((rs) => rs.filter((x) => x.id !== r.id)); }} />
              ))}
            </div>
          )}
        </Sec>
        <Sec t="示例规则" d="点一下加入列表，再按需修改">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {SAMPLE_REGEX_RULES.map((s) => (
              <button key={s.name} type="button" onClick={() => setRules((rs) => [...rs, { ...s, id: newTopbarId("rx") }])}
                className="flex items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-left transition hover:border-jade">
                <IconPlus width={13} height={13} className="shrink-0 text-jade" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{s.name}</span>
                <span className="shrink-0 rounded-full bg-paper-2 px-1.5 py-0.5 text-[10px] text-ink-soft">{targetLabel(s.target)}</span>
              </button>
            ))}
          </div>
        </Sec>
        <Sec t="作用范围">
          <ul className="space-y-1 text-[11px] leading-relaxed text-ink-soft">
            <li><b className="text-ink">单个字段</b>：名字、标题、周数、日期、地点、天气、资产、倒计时、行动点各自独立改写；「全部文字」对它们都生效。</li>
            <li><b className="text-ink">整条状态栏</b>：输入固定 6 段，用「 | 」分隔，替换结果直接取代整条状态栏：</li>
            <li className="break-all rounded-lg bg-paper-2 px-2 py-1 font-mono text-[10.5px] text-ink">{rawBarText(data)}</li>
            <li>规则按列表顺序依次执行；执行过慢（回溯失控）的规则会自动暂停。</li>
          </ul>
        </Sec>
      </>)}

      {tab === "upload" && (<>
        <Sec t="我的顶栏样式" d="把当前组合收藏或导出为 .topbar.json；导入他人分享的样式文件即刻套用。也支持导入美化主题包、HTML / CSS 模板与正则文件。">
          <div className="grid grid-cols-2 gap-1.5">
            <input value={styleName} maxLength={24} onChange={(e) => setStyleName(e.target.value)} placeholder="样式名，如：粉钻千金" aria-label="样式名" className={inp} />
            <input value={author} maxLength={24} onChange={(e) => setAuthor(e.target.value)} placeholder="作者（可选）" aria-label="作者" className={inp} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btn} onClick={() => { const s = snapshot(); persist([s, ...lib.filter((x) => x.name !== s.name)]); setMsg({ ok: true, t: `已收藏「${s.name}」` }); }}>收藏当前</button>
            <button type="button" className={btn} onClick={() => { const s = snapshot(); download(s.name, styleFileOf(s), ".topbar.json"); }}>导出当前</button>
            <span className="ml-auto" />
            <button type="button" className={btn} onClick={() => fileRef.current?.click()}>上传样式文件</button>
          </div>
          {lib.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">还没有收藏的顶栏样式</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {lib.map((s) => (
                <div key={s.id} className="overflow-hidden rounded-xl border border-line bg-paper">
                  <Thumb diy={{ ...s.diy, on: true }} data={data} topbar={s.topbar ?? theme.topbar} topbarText={s.topbarText} />
                  <div className="flex items-center gap-1.5 border-t border-line px-2.5 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-ink">{s.name}</p>
                      <p className="truncate text-[10px] text-ink-soft">
                        {[s.author, s.diy.customHtml ? "HTML 模板" : "", s.diy.regexRules?.length ? `正则 ${s.diy.regexRules.length}` : "", new Date(s.at).toLocaleDateString()].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <button type="button" className={btn} onClick={() => applySaved(s)}>套用</button>
                    <button type="button" className={btn} onClick={() => download(s.name, styleFileOf(s), ".topbar.json")}>导出</button>
                    <button type="button" aria-label={`删除「${s.name}」`} className={`${iconBtn} hover:border-danger hover:text-danger`}
                      onClick={async () => { if (await confirm(`删除顶栏样式「${s.name}」？`)) persist(lib.filter((x) => x.id !== s.id)); }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Sec>
        <Sec t="自定义模板（HTML）" d="填写后整块替换组合式顶栏，右侧菜单按钮保留。脚本与 on* 事件会被过滤。"
          right={<Switch small on={c.templateOn} onChange={(v) => set({ templateOn: v })} label="启用自定义模板" />}>
          <DraftText multiline rows={8} label="顶栏 HTML 模板" inputRef={htmlRef} value={d.customHtml ?? ""} className={mono}
            placeholder={"<div class=\"my-bar\">{{avatarImg}} <b>{{name}}</b> {{date}} · {{location}}</div>"}
            onCommit={(v) => setOpt("customHtml", v.trim() ? v : undefined)} />
          <div>
            <p className={lab}>插入占位符 <span className="font-normal text-ink-soft">{"{{x}} 已套样式正则 · {{x:raw}} 原始文字，适合写进属性"}</span></p>
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => insertVar(k)} title={`插入 {{${k}}}`}
                  className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink transition hover:border-jade hover:text-jade">{l}</button>
              ))}
            </div>
          </div>
          <p className="text-[10.5px] leading-relaxed text-ink-soft">
            给元素加 <code className="rounded bg-paper-2 px-1 font-mono">data-action="menu"</code>（菜单）/ <code className="rounded bg-paper-2 px-1 font-mono">end</code>（结束）/ <code className="rounded bg-paper-2 px-1 font-mono">schedule</code>（日程）/ <code className="rounded bg-paper-2 px-1 font-mono">none</code>（不响应）；其余位置点按打开人物档案。
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btn} onClick={async () => {
              if (d.customHtml?.trim() && !(await confirm("用示例模板替换当前模板与专属 CSS？", { ok: "替换", danger: false }))) return;
              set({ customHtml: SAMPLE_TEMPLATE, customCss: SAMPLE_TEMPLATE_CSS, templateOn: true });
            }}>填入示例模板</button>
            {d.customHtml && <button type="button" className={`${btn} hover:border-danger hover:text-danger`} onClick={() => setOpt("customHtml", undefined)}>清空模板</button>}
          </div>
          <Toggle label="保留右侧按钮" hint="关闭后需在模板里自己放 data-action=menu 的元素，否则仍自动保留" on={c.keepActions} onChange={(v) => set({ keepActions: v })} />
        </Sec>
        <Sec t="专属 CSS" d="只为顶栏写样式；组合式与模板都适用。可用类名：.app-topbar · .topbar-profile-card · .topbar-status-bar · .topbar-chip · .topbar-week · .topbar-title · .topbar-ap · .tb-tpl">
          <DraftText multiline rows={6} label="顶栏专属 CSS" value={d.customCss ?? ""} className={mono}
            placeholder={".app-topbar .topbar-status-bar { letter-spacing: .04em; }"} onCommit={(v) => setOpt("customCss", v.trim() ? v : undefined)} />
        </Sec>
        <details className="rounded-xl border border-line bg-paper px-3 py-2 text-[11px] text-ink-soft">
          <summary className="cursor-pointer font-bold text-ink">样式文件格式（给创作者）</summary>
          <p className="mt-2 leading-relaxed">导出的 .topbar.json 结构如下，diy 里的字段都可省略（省略即用默认值）；做好后直接在这里上传即可：</p>
          <pre className="mt-1.5 overflow-x-auto rounded-lg bg-paper-2 p-2 font-mono text-[10.5px] leading-relaxed text-ink">{`{
  "format": "star-topbar-style", "version": 1,
  "name": "粉钻千金", "author": "你的名字",
  "topbar": "aurora",
  "diy": {
    "layout": "double", "barStyle": "chips", "avatarShape": "diamond",
    "avatarFrame": "gold", "modules": ["week", "date", "location", "money"],
    "accent": "#d16ba5", "regexRules": [ … ], "customHtml": "…", "customCss": "…"
  }
}`}</pre>
          <p className="mt-1.5 leading-relaxed">正则文件：<code className="font-mono">{`{ "format": "star-topbar-regex", "rules": [ { "name", "target", "pattern", "flags", "replacement", "css" } ] }`}</code>，也可以直接上传酒馆导出的正则 JSON。</p>
        </details>
      </>)}

      <input ref={fileRef} type="file" accept=".json,.html,.htm,.css,.txt,application/json,text/html,text/css" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ""; }} />

      <div className="flex justify-end">
        <button type="button" className={`${btn} hover:border-danger hover:text-danger`} onClick={async () => {
          if (await confirm("清空全部顶栏 DIY（组合、配色、贴图、正则、模板）？\n「我的顶栏样式」里的收藏不受影响。", { ok: "清空" })) {
            const t = { ...tRef.current };
            delete t.topbarDiy;
            commit(t);
            setMsg({ ok: true, t: "已恢复默认顶栏" });
          }
        }}>清空顶栏 DIY</button>
      </div>
    </div>
  );
}
