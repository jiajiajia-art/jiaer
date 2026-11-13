import { useCallback, useRef, useState, type ReactNode } from "react";
import { Modal } from "./ui";
import { IconChevronDown, IconChevronUp } from "../lib/icons";

/* 编辑器通用小部件：游戏内确认框 · 作用范围横幅 · 搜索框 · 空状态 · 字段说明 */

type ConfirmOpts = { title?: string; ok?: string; danger?: boolean };
type Pending = ConfirmOpts & { message: string; resolve: (v: boolean) => void };

/* 用法：const [confirm, confirmEl] = useConfirm(); … if (await confirm("确定？")) … ；并在 JSX 中渲染 {confirmEl} */
export function useConfirm(): [(message: string, opts?: ConfirmOpts) => Promise<boolean>, ReactNode] {
  const [p, setP] = useState<Pending | null>(null);
  const ref = useRef<Pending | null>(null);
  ref.current = p;
  const confirm = useCallback(
    (message: string, opts: ConfirmOpts = {}) => new Promise<boolean>((resolve) => setP({ danger: true, ...opts, message, resolve })),
    [],
  );
  const close = (v: boolean) => { ref.current?.resolve(v); setP(null); };
  const el = p ? (
    <Modal panelClassName="ui-dialog-game" title={p.title ?? "请确认"} onClose={() => close(false)} heavyBackdrop>
      <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{p.message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" autoFocus onClick={() => close(false)} className="ui-btn ui-btn-sm">取消</button>
        <button
          type="button"
          onClick={() => close(true)}
          className={`ui-btn ui-btn-sm ui-btn-primary ${p.danger ? "tone-danger" : ""}`}
        >
          {p.ok ?? (p.danger ? "删除" : "确定")}
        </button>
      </div>
    </Modal>
  ) : null;
  return [confirm, el];
}

/* 作用范围：save=只改当前存档（即时生效）；newgame=模组，下次开新局生效 */
export function ScopeBanner({ scope, children }: { scope: "save" | "newgame"; children?: ReactNode }) {
  const save = scope === "save";
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11.5px] leading-snug ${save ? "border-jade/50 bg-jade/10" : "border-gold/60 bg-gold/10"}`}>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white ${save ? "bg-jade" : "bg-gold"}`}>{save ? "当前存档" : "新开局"}</span>
      <span className="text-ink-soft">
        {children ?? (save ? "此处修改只作用于当前存档，保存即时生效；不会改动模组，也不影响其他存档。" : "此处修改写入模组，在下次开新局时生效；当前存档不受影响。")}
      </span>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "搜索…", count }: { value: string; onChange: (v: string) => void; placeholder?: string; count?: number }) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-xl border border-line bg-paper-2 px-3 py-1.5 pr-16 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
      />
      <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[10.5px] text-ink-soft">
        {value && count !== undefined && <span>{count} 条</span>}
        {value && <button onClick={() => onChange("")} aria-label="清空搜索" className="px-1 text-[13px] hover:text-ink">×</button>}
      </span>
    </div>
  );
}

export const matches = (q: string, ...fields: (string | undefined | null)[]) => {
  // 功能注释：搜索词/字段偶发非字符串时禁止 .trim/.toLowerCase 崩页
  const s = String(q ?? "").trim().toLowerCase();
  return !s || fields.some((f) => String(f ?? "").toLowerCase().includes(s));
};

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-paper/30 px-4 py-6 text-center text-[12.5px] text-ink-soft">{children}</div>;
}

export function Help({ children }: { children: ReactNode }) {
  return <p className="mt-0.5 text-[10.5px] leading-snug text-ink-soft">{children}</p>;
}

export function FieldErr({ children }: { children?: ReactNode }) {
  return children ? <p className="mt-0.5 text-[11px] text-danger">{children}</p> : null;
}

export function Dirty({ on }: { on: boolean }) {
  return on ? <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-bold text-gold">● 未保存</span> : null;
}

/* 属性颜色：四个主题色（随皮肤变化）+ 自定义色 */
const SWATCH = [
  { v: "jade", l: "主题绿" }, { v: "coral", l: "珊瑚" }, { v: "gold", l: "金" }, { v: "danger", l: "警示红" },
];
export function ColorPick({ value, onChange, fallback = "jade" }: { value?: string; onChange: (v?: string) => void; fallback?: string }) {
  const cur = value ?? fallback;
  const custom = cur.startsWith("#");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SWATCH.map((s) => (
        <button key={s.v} type="button" title={s.l} aria-label={s.l} onClick={() => onChange(s.v === fallback ? undefined : s.v)}
          className={`h-6 w-6 rounded-full border-2 transition ${cur === s.v ? "border-ink scale-110" : "border-transparent"}`} style={{ background: `var(--${s.v})` }} />
      ))}
      <label title="自定义颜色" className={`relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 ${custom ? "border-ink scale-110" : "border-line"}`}
        style={{ background: custom ? cur : "conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)" }}>
        <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={custom ? cur : "#c084fc"} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

/* 关键词输入：逗号 / 顿号 / 空格分隔；本地保留原文，失焦时再规范化，避免打字时分隔符被吞 */
export const splitKw = (t: string) => t.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
export function KwInput({ value, onChange, placeholder, className }: { value?: string[]; onChange: (v?: string[]) => void; placeholder: string; className?: string }) {
  const [raw, setRaw] = useState((value ?? []).join("、"));
  return (
    <input value={raw} placeholder={placeholder}
      onChange={(ev) => { setRaw(ev.target.value); const k = splitKw(ev.target.value); onChange(k.length ? k : undefined); }}
      onBlur={() => setRaw((value ?? []).join("、"))}
      className={className ?? "w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[13px] text-ink"} />
  );
}

/* ——— 填错就提示：引用校验结果挂到编辑器上（数据见 game/refAudit） ——— */
type Issue = { level: "error" | "warn"; text: string; from?: string; at?: string };
export const auditDomId = (at: string) => `audit-${at.replace(/[^\w-]/g, "_")}`;

/** 条目标题旁的小徽标：红 = 有错误，金 = 只有提醒 */
export function AuditBadge({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  const err = issues.filter((x) => x.level === "error").length;
  return (
    <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold ${err ? "bg-danger/12 text-danger" : "bg-gold/15 text-gold"}`} title={issues.map((x) => x.text).join("\n")}>
      {err ? `${err} 个错误` : `${issues.length} 个提醒`}
    </span>
  );
}

/** 展开的条目里：逐条列出问题 */
export function AuditList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="space-y-1" aria-label="校验提示">
      {issues.map((x, i) => (
        <li key={i} className={`flex gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] leading-snug ${x.level === "error" ? "bg-danger/10 text-danger" : "bg-gold/10 text-ink"}`}>
          <span className="shrink-0 font-bold">{x.level === "error" ? "错误" : "提醒"}</span>
          <span className="min-w-0">
            {x.text}
            {x.from && /·(选项|断点|判定|失败|后续|触发|收尾场景|激活)/.test(x.from) && <span className="text-ink-soft">（{x.from.split("·").slice(2).join("·")}）</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 面板顶部的汇总条：数一数还有多少问题，点「定位」展开并滚到对应条目 */
export function AuditBar({ issues, onJump }: { issues: Issue[]; onJump?: (at: string) => void }) {
  const [open, setOpen] = useState(false);
  const err = issues.filter((x) => x.level === "error").length;
  const warn = issues.length - err;
  if (!issues.length) return <p className="rounded-xl bg-jade/8 px-3 py-2 text-[12px] font-semibold text-jade">检查通过：没有失效引用、死循环或永远不会触发的设置。</p>;
  const jump = (at: string) => {
    onJump?.(at);
    window.setTimeout(() => document.getElementById(auditDomId(at))?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${err ? "border-danger/40 bg-danger/5" : "border-gold/40 bg-gold/5"}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-[12.5px]">
        <span className={`font-bold ${err ? "text-danger" : "text-gold"}`}>{err ? `${err} 个错误` : ""}{err && warn ? " · " : ""}{warn ? `${warn} 个提醒` : ""}</span>
        <span className="min-w-0 flex-1 truncate text-ink-soft">{err ? "有设置在游戏里不会按预期生效" : "可以玩，但有些地方值得再看一眼"}</span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11.5px] text-ink-soft">{open ? <>收起 <IconChevronUp size={12} /></> : <>查看 <IconChevronDown size={12} /></>}</span>
      </button>
      {open && (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {issues.slice(0, 100).map((x, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] leading-snug">
              <span className={`mt-px shrink-0 font-bold ${x.level === "error" ? "text-danger" : "text-gold"}`}>{x.level === "error" ? "错误" : "提醒"}</span>
              <span className="min-w-0 flex-1"><span className="font-semibold text-ink">{x.from?.split("·").slice(1, 2).join("") || ""}</span>{x.from ? "：" : ""}<span className="text-ink-soft">{x.text}</span></span>
              {x.at && onJump && <button type="button" onClick={() => jump(x.at!)} className="shrink-0 font-semibold text-jade hover:underline">定位</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
