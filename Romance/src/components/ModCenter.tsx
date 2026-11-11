/* ═══════════════ MOD 中心：.nmod 导入审阅 · 体检 · 引用链 · 配置 · 冲突裁决 · 日志 · 功能面板 ═══════════════
 * 只调用 mods/nmod 与 mods/ext 的声明式接口；不改原生编辑器、调度器或渲染流程。 */
import { useMemo, useState } from "react";
import { KIND_LABEL, PERM_LABEL, authRows, callChains, exportTable, modName, nsName, setProjectAuth, subKey, subscribersOf, useProjectAuth, versionIssues } from "../mods/comm";
import type { GameState } from "../lib/types";
import type { Mod } from "../mods/types";
import { modById } from "../mods/registry";
import { cfgValue, getModRegistry, modCategory, modVarValue, regSummary, resetCfg, setCfgValue, setResolution, useModExt, useModLogs, clearModLogs, getResolutions } from "../mods/ext";
import { IconChevronDown, IconChevronUp, StatusMark } from "../lib/icons";
import {
  CATEGORY_LABEL, applyImport, contentsLine, installTemplate, modDependents, modHealth, packNmod, projectToMod, safeId, skinCss,
  templateExternalRefs, templateOwned, uninstallTemplate, type ImportOpts, type ImportPreview,
} from "../mods/nmod";

const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const card = "rounded-2xl border border-line bg-paper/60 p-3";
const TONE = { error: "text-danger", warn: "text-gold", ok: "text-jade", info: "text-ink-soft" } as const;

export function downloadText(name: string, text: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const exportNmod = (m: Mod) => downloadText(`${m.id}-${m.version}.nmod`, packNmod(m));

export function CategoryChip({ m }: { m: Mod }) {
  const c = modCategory(m);
  const cls = c === "feature" ? "border-coral/50 bg-coral/10 text-coral" : c === "world" ? "border-jade/50 bg-jade/10 text-jade" : "border-gold/50 bg-gold/10 text-gold";
  return <span className={`rounded-full border px-1.5 py-px text-[10px] font-bold ${cls}`}>{CATEGORY_LABEL[c]}</span>;
}
/* 来源标记：内置 / .nmod 安装 / 本机创作 */
export function SourceChip({ m }: { m: Mod }) {
  const t = m.builtin ? "内置" : m.origin?.source === "nmod" ? ".nmod 安装" : m.origin?.source === "project" ? "工程打包" : "本机创作";
  return <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-ink-soft">{t}</span>;
}

/* —— 导入审阅：依赖 / 冲突策略 / 增量更新 —— */
export function NmodImportReview({ preview, warnings, onDone, onCancel }: { preview: ImportPreview; warnings: string[]; onDone: (msg: string) => void; onCancel: () => void }) {
  const [strategy, setStrategy] = useState<ImportOpts["strategy"]>("rename");
  const [keepEdits, setKeepEdits] = useState(true);
  const [force, setForce] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const { mod, existing, deps, conflicts, diff, blocked } = preview;
  const go = () => {
    const r = applyImport(preview, { strategy, keepEdits });
    if (!r.ok) { setErrs(r.errors); return; }
    onDone(`${existing ? "已更新" : "已安装"}「${mod.name}」v${mod.version}${r.notes.length ? `：${r.notes.join("；")}` : ""}`);
  };
  const opt = (k: ImportOpts["strategy"], t: string, d: string) => (
    <label className={`flex cursor-pointer items-start gap-2 rounded-xl border px-2.5 py-2 ${strategy === k ? "border-jade bg-jade/10" : "border-line"}`}>
      <input type="radio" checked={strategy === k} onChange={() => setStrategy(k)} className="mt-0.5 accent-[var(--jade)]" />
      <span><span className="block text-[12px] font-bold">{t}</span><span className="block text-[11px] text-ink-soft">{d}</span></span>
    </label>
  );
  return (
    <div role="dialog" aria-label="导入 .nmod 审阅" className="space-y-2.5 rounded-2xl border border-jade/50 bg-jade/5 p-3.5">
      <div className="flex items-start gap-3">
        {(mod.cover || mod.icon) && <img src={mod.cover || mod.icon} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5"><b className="text-[14px]">{mod.name}</b><span className="text-[11px] text-ink-soft">v{mod.version}</span><CategoryChip m={mod} /></div>
          <p className="text-[11px] text-ink-soft">{mod.author ? `作者 ${mod.author} · ` : ""}{existing ? `更新：本机 v${existing.version} → v${mod.version}` : "全新安装"}</p>
          {mod.description && <p className="mt-1 text-[11.5px] text-ink">{mod.description}</p>}
          <p className="mt-1 text-[11px] text-ink-soft">包含：{contentsLine(mod)}</p>
        </div>
      </div>
      {warnings.map((w, i) => <p key={i} className="text-[11px] text-gold"><StatusMark kind="warn">{w}</StatusMark></p>)}
      {deps.length > 0 && (
        <div><p className="text-[11.5px] font-bold">前置依赖</p>
          <ul className="mt-0.5 space-y-0.5 text-[11.5px]">{deps.map((d) => <li key={d.id} className={d.ok ? "text-jade" : "text-danger"}><StatusMark kind={d.ok ? "ok" : "err"}>{d.text}</StatusMark></li>)}</ul>
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11.5px] font-bold">ID 冲突 {conflicts.length} 项</p>
          <ul className="max-h-28 overflow-auto text-[11px] text-ink-soft">{conflicts.map((c, i) => <li key={i}>{c.kind}「{c.name}」（{c.id}）与「{c.other}」重复</li>)}</ul>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {opt("rename", "自动重命名", "冲突 ID 加后缀，包内引用同步改写")}
            {opt("skip", "跳过", "不导入冲突的资源")}
            {opt("overwrite", "覆盖", "保留同名，按加载顺序后者生效")}
          </div>
        </div>
      )}
      {diff && (
        <div className="text-[11.5px]"><p className="font-bold">增量差异</p>
          <p className="text-ink-soft">新增 {diff.added.length} · 变更 {diff.changed.length} · 移除 {diff.removed.length}</p>
          {diff.edited.length > 0 && <>
            <p className="text-gold">你二次修改过：{diff.edited.slice(0, 8).join("、")}{diff.edited.length > 8 ? " …" : ""}</p>
            <label className="mt-1 flex items-center gap-2"><input type="checkbox" checked={keepEdits} onChange={(e) => setKeepEdits(e.target.checked)} className="accent-[var(--jade)]" />保留我的修改（取消勾选 = 用新版本替换）</label>
          </>}
        </div>
      )}
      {blocked && <label className="flex items-center gap-2 text-[11.5px] text-danger"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />缺少前置：仍然导入（补齐依赖前无法启用）</label>}
      {errs.map((e, i) => <p key={i} className="text-[11.5px] text-danger">· {e}</p>)}
      <div className="flex gap-2">
        <button className="rounded-full bg-jade px-3.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-40" disabled={blocked && !force} onClick={go}>{existing ? "确认更新" : "确认安装"}</button>
        <button className={btn} onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

/* —— 单个 MOD 的工具抽屉 —— */
export function ModTools({ m, game, patchGame, confirm, onNotice }: {
  m: Mod; game: GameState | null | undefined; patchGame: (fn: (g: GameState) => GameState) => void;
  confirm: (msg: string, o?: { ok?: string }) => Promise<boolean>; onNotice: (t: string) => void;
}) {
  const reg = useModExt();
  const [tab, setTab] = useState<"health" | "refs" | "cfg" | "tpl" | "log">("health");
  const health = useMemo(() => (tab === "health" ? modHealth(m) : []), [m, tab, reg]);
  const refs = useMemo(() => (tab === "refs" ? modDependents(m.id, game) : []), [m.id, game, tab]);
  const logs = useModLogs().filter((l) => l.mod === m.id).slice(-40).reverse();
  const e = m.ext ?? {};
  const cat = modCategory(m);
  const owned = game ? templateOwned(game, m.id) : 0;
  const tabs = [["health", "体检"], ["refs", "引用链"], ...(e.config?.length || e.grants?.length || e.vars?.length ? [["cfg", "配置 / 权限"]] : []), ...(cat === "template" && game ? [["tpl", "装入存档"]] : []), ["log", "日志"]] as [typeof tab, string][];
  const install = async (s: ImportOpts["strategy"]) => {
    if (!game) return;
    let notes: string[] = [];
    patchGame((g) => { const r = installTemplate(g, m, s); notes = r.notes; return r.game; });
    onNotice(`「${m.name}」已装入当前存档${notes.length ? `：${notes.join("，")}` : ""}`);
  };
  const uninstall = async () => {
    if (!game) return;
    const ext = templateExternalRefs(game, m.id);
    if (ext.length) { await confirm(`不能卸载：以下非本 MOD 的内容仍在引用它的资源，请先解除引用。\n\n${ext.slice(0, 12).join("\n")}`, { ok: "知道了" }); return; }
    if (await confirm(`从当前存档卸载「${m.name}」装入的 ${owned} 个资源？其余内容不受影响。`, { ok: "卸载" })) { patchGame((g) => uninstallTemplate(g, m.id)); onNotice(`已卸载「${m.name}」的存档资源`); }
  };
  return (
    <div className="mt-2 rounded-xl border border-line bg-paper p-2.5 text-[11.5px]">
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map(([k, t]) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-2.5 py-0.5 font-semibold ${tab === k ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}>{t}</button>)}
        <span className="ml-auto self-center text-[10.5px] text-ink-soft">{regSummary(m)}</span>
      </div>
      {tab === "health" && <ul className="space-y-0.5">{health.map((h, i) => <li key={i} className={TONE[h.level]}><StatusMark kind={h.level === "ok" ? "ok" : h.level === "error" ? "err" : "warn"}>{h.text}</StatusMark></li>)}</ul>}
      {tab === "refs" && (refs.length ? <ul className="space-y-0.5 text-gold">{refs.map((r, i) => <li key={i}><StatusMark kind="warn">{r}</StatusMark></li>)}</ul> : <p className="text-jade"><StatusMark kind="ok">没有其他 MOD 或存档内容依赖它，可安全关闭 / 卸载</StatusMark></p>)}
      {tab === "cfg" && (
        <div className="space-y-2">
          {(e.config ?? []).map((c) => {
            const v = cfgValue(m.id, c.key);
            return (
              <label key={c.key} className="flex items-center justify-between gap-2">
                <span>{c.label || c.key}</span>
                {c.type === "toggle" ? <input type="checkbox" checked={v !== 0} onChange={(x) => setCfgValue(m.id, c.key, x.target.checked ? 1 : 0)} className="accent-[var(--jade)]" />
                  : c.type === "choice" ? <select value={v} onChange={(x) => setCfgValue(m.id, c.key, Number(x.target.value))} className="rounded-lg border border-line bg-paper px-1.5 py-0.5">{(c.options ?? []).map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</select>
                    : <input type="number" value={v} min={c.min} max={c.max} onChange={(x) => setCfgValue(m.id, c.key, Number(x.target.value) || 0)} className="w-20 rounded-lg border border-line bg-paper px-1.5 py-0.5 text-right" />}
              </label>
            );
          })}
          {!!e.config?.length && <button className={btn} onClick={() => resetCfg(m.id)}>恢复默认配置</button>}
          {!!e.vars?.length && <p className="text-ink-soft">私有数据域：{e.vars.map((v) => `${v.label || v.key}${game ? `=${modVarValue(game.sim.modData, m.id, v.key)}` : ""}`).join("、")}（与原生 flag 隔离）</p>}
          <p className="text-ink-soft">跨 MOD 授权：{e.grants?.length ? e.grants.map((g) => `${modById(g.mod)?.name ?? g.mod}（${g.access === "rw" ? "读写" : "只读"}）`).join("、") : "无（默认隔离，其他 MOD 无法读写本 MOD 数据）"}</p>
          {game && !!e.vars?.length && <button className={btn} onClick={async () => { if (await confirm(`清空「${m.name}」在当前存档的私有数据？`, { ok: "清空" })) patchGame((g) => { const d = { ...(g.sim.modData ?? {}) }; delete d[m.id]; return { ...g, sim: { ...g.sim, modData: d } }; }); }}>清空本存档私有数据</button>}
        </div>
      )}
      {tab === "tpl" && (
        <div className="space-y-1.5">
          <p className="text-ink-soft">把模板里的剧情 / 结局 / 世界书 / CG / 阵营装入当前存档，每个资源都会打上归属标记；卸载时只移除这些资源。{owned ? `当前已装入 ${owned} 个。` : ""}</p>
          <div className="flex flex-wrap gap-1.5">
            <button className={btn} onClick={() => install("rename")}>装入（冲突重命名）</button>
            <button className={btn} onClick={() => install("skip")}>装入（冲突跳过）</button>
            <button className={btn} onClick={() => install("overwrite")}>装入（冲突覆盖）</button>
            {owned > 0 && <button className={`${btn} hover:!border-danger hover:!text-danger`} onClick={uninstall}>卸载已装入资源</button>}
          </div>
        </div>
      )}
      {tab === "log" && (logs.length ? <ul className="max-h-40 space-y-0.5 overflow-auto font-mono text-[10.5px]">{logs.map((l, i) => <li key={i} className={TONE[l.level]}>{new Date(l.t).toLocaleTimeString()} {l.text}</li>)}</ul> : <p className="text-ink-soft">暂无日志</p>)}
    </div>
  );
}

/* —— 注册冲突裁决：优先 A / 优先 B / 停用 —— */
export function ModConflicts() {
  const reg = useModExt();
  const res = getResolutions();
  const off = Object.entries(res).filter(([, v]) => v.startsWith("off:"));
  if (!reg.conflicts.length && !off.length) return null;
  const name = (id: string) => modById(id)?.name ?? id;
  return (
    <div className={`${card} border-gold/50`}>
      <p className="text-[12.5px] font-bold">注册冲突裁决</p>
      <p className="text-[11px] text-ink-soft">多个 MOD 注册了同一 ID。默认加载顺序靠后者胜出；可以手动指定，或停用其中一个。</p>
      <ul className="mt-2 space-y-2">
        {reg.conflicts.map((c) => {
          const win = c.winner ?? c.mods[c.mods.length - 1];
          return (
            <li key={c.key} className="rounded-xl border border-line px-2.5 py-2 text-[11.5px]">
              <p>{c.kind}「<b>{c.id}</b>」：{c.mods.map(name).join(" / ")}{!c.winner && <span className="text-ink-soft">（未裁决，按顺序）</span>}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {c.mods.map((id) => <button key={id} className={`${btn} ${win === id ? "!border-jade !text-jade" : ""}`} onClick={() => setResolution(c.key, id)}>优先「{name(id)}」</button>)}
                {c.mods.map((id) => <button key={`off${id}`} className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => setResolution(`off:${id}`, `off:${id}`)}>停用「{name(id)}」</button>)}
                {c.winner && <button className={btn} onClick={() => setResolution(c.key, undefined)}>恢复默认</button>}
              </div>
            </li>
          );
        })}
        {off.map(([k, v]) => <li key={k} className="flex items-center gap-2 text-[11.5px] text-ink-soft">「{name(v.slice(4))}」的扩展已因冲突停用<button className={btn} onClick={() => setResolution(k, undefined)}>重新启用</button></li>)}
      </ul>
    </div>
  );
}

/* —— MOD 全局日志 / 调试 —— */
export function ModLogView() {
  const logs = useModLogs();
  const [open, setOpen] = useState(false);
  return (
    <div className={card}>
      <div className="flex items-center gap-2">
        <button className="text-[12.5px] font-bold" onClick={() => setOpen(!open)} aria-expanded={open}>MOD 运行日志 <span className="inline-flex items-center gap-0.5 text-[11px] font-normal text-ink-soft">{logs.length} 条 {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}</span></button>
        {open && logs.length > 0 && <button className={`${btn} ml-auto`} onClick={clearModLogs}>清空</button>}
      </div>
      {open && (logs.length ? (
        <ul className="mt-2 max-h-56 space-y-0.5 overflow-auto font-mono text-[10.5px]">
          {[...logs].reverse().map((l, i) => <li key={i} className={TONE[l.level]}>{new Date(l.t).toLocaleTimeString()} [{l.src}] {l.text}{l.trace ? ` ⟨${l.trace.from || "原生"}→${l.trace.to} ${l.trace.op} ${l.trace.target}${l.trace.perm ? ` 权限:${l.trace.perm}` : ""}${l.trace.args ? ` 参数:${l.trace.args}` : ""} ${l.trace.ok ? "成功" : l.trace.code}⟩` : ""}</li>)}
        </ul>
      ) : <p className="mt-1 text-[11px] text-ink-soft">暂无日志。启用、注册、冲突、动作执行都会记录在这里。</p>)}
    </div>
  );
}

/* —— MOD 间通信：导出总表 / 本工程授权 / 版本不匹配 / 订阅 / 调用链路 —— */
const AUTH_TONE: Record<string, string> = { preset: "text-jade", allow: "text-jade", deny: "text-danger", pending: "text-amber-600", missing: "text-danger", offline: "text-ink-soft", version: "text-danger" };
const AUTH_TEXT: Record<string, string> = { preset: "包内预设", allow: "已授权", deny: "已拒绝", pending: "待授权", missing: "对方未导出", offline: "对方未启用", version: "版本不符" };
export function ModCommPanel() {
  const reg = useModExt();
  const auth = useProjectAuth();
  useModLogs();
  const [open, setOpen] = useState(false);
  const rows = authRows(undefined);
  const vers = versionIssues(undefined);
  const pending = rows.filter((r) => r.status === "pending").length;
  const exps = exportTable();
  const chains = callChains();
  const events = [...new Set(reg.subs.map((s) => `${s.def.mod}|${s.def.event}`))];
  if (!exps.length && !rows.length && !reg.subs.length) return null;
  const h = "mt-2 text-[11.5px] font-bold text-ink";
  return (
    <div className={card}>
      <button className="text-[12.5px] font-bold" onClick={() => setOpen(!open)} aria-expanded={open}>
        MOD 间通信 <span className="inline-flex items-center gap-0.5 text-[11px] font-normal text-ink-soft">导出 {exps.length} · 申请 {rows.length}{pending ? ` · ${pending} 项待授权` : ""}{vers.length ? ` · ${vers.length} 项版本不符` : ""} {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}</span>
      </button>
      {open && (
        <div className="text-[11.5px]">
          <p className="mt-1 text-ink-soft">默认隔离：MOD 只能使用对方 exports 声明、自己 imports 申请、且经包内预设或本工程授权的条目。授权只保存在本工程，关闭 MOD 即刻下线。</p>
          {vers.length > 0 && (<>
            <div className={h}>版本不匹配</div>
            {vers.map((v) => (
              <div key={v.key} className="flex flex-wrap items-center gap-2">
                <span>「{modName(v.from)}」需要「{modName(v.to)}」{v.range}，当前 {v.have}</span>
                <button className={btn} aria-pressed={v.state === "allow"} onClick={() => setProjectAuth(v.key, v.state === "allow" ? undefined : "allow")}>{v.state === "allow" ? "已强制继续" : "强制继续"}</button>
                <button className={btn} aria-pressed={v.state === "deny"} onClick={() => setProjectAuth(v.key, v.state === "deny" ? undefined : "deny")}>{v.state === "deny" ? "已禁用导入" : "禁用此导入"}</button>
              </div>
            ))}
          </>)}
          {rows.length > 0 && (<>
            <div className={h}>本工程授权</div>
            <ul className="space-y-0.5">
              {rows.map((r) => (
                <li key={r.key} className="flex flex-wrap items-center gap-2">
                  <span>[{modName(r.from)}] → <code>{nsName(r.to, r.name)}</code> <span className="text-ink-soft">{r.label} · {PERM_LABEL[r.perm]}</span></span>
                  <span className={`font-semibold ${AUTH_TONE[r.status]}`}>{AUTH_TEXT[r.status]}</span>
                  {(r.status === "pending" || r.status === "allow" || r.status === "deny" || r.status === "preset") && (<>
                    <button className={btn} aria-pressed={auth[r.key] === "allow"} onClick={() => setProjectAuth(r.key, auth[r.key] === "allow" ? undefined : "allow")}>允许</button>
                    <button className={btn} aria-pressed={auth[r.key] === "deny"} onClick={() => setProjectAuth(r.key, auth[r.key] === "deny" ? undefined : "deny")}>拒绝</button>
                  </>)}
                </li>
              ))}
            </ul>
          </>)}
          {exps.length > 0 && (<>
            <div className={h}>导出总表</div>
            <ul className="space-y-0.5 font-mono text-[10.5px]">
              {exps.map((x) => <li key={`${x.mod}:${x.kind}:${x.name}`}><span className="text-ink-soft">[{modName(x.mod)}] {KIND_LABEL[x.kind]}</span> {nsName(x.mod, x.name)} {x.detail}{x.label ? ` · ${x.label}` : ""}</li>)}
            </ul>
          </>)}
          {events.length > 0 && (<>
            <div className={h}>事件订阅（按投递顺序）</div>
            {events.map((k) => { const [mod, ev] = k.split("|"); return (
              <div key={k}><code>{nsName(mod, ev)}</code> →{" "}
                {subscribersOf(undefined, undefined, mod, ev).map((s) => <span key={subKey(s.mod, s.def.id)} className={s.access.ok ? "" : "text-ink-soft line-through"} title={s.access.ok ? "" : s.access.msg}> {modName(s.mod)}（优先级 {s.prio}）</span>)}
              </div>
            ); })}
          </>)}
          <div className={h}>调用链路</div>
          {chains.length ? (
            <ul className="space-y-0.5 font-mono text-[10.5px]">
              {chains.map((c) => <li key={`${c.from}>${c.to}.${c.target}:${c.op}`} className={c.fails ? "text-danger" : ""}>{c.from ? modName(c.from) : "原生"} —{c.op}→ {nsName(c.to, c.target)} ×{c.n}{c.fails ? `（失败 ${c.fails}，最近 ${c.lastCode}）` : ""}</li>)}
            </ul>
          ) : <p className="text-ink-soft">暂无跨 MOD 调用。</p>}
        </div>
      )}
    </div>
  );
}

/* —— 功能 MOD 独立面板：每个 MOD 的皮肤 / 动画限定在自己的 data-nmod 容器里 —— */
export function ModFeaturePanels({ game, previewMod }: { game?: GameState | null; previewMod?: Mod }) {
  const reg = useModExt();
  const panels = previewMod
    ? (previewMod.ext?.panels ?? []).map((p) => ({ mod: previewMod.id, def: p }))
    : [...reg.panels.values()];
  if (!panels.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {panels.map(({ mod, def }) => {
        const m = previewMod ?? modById(mod);
        const e = m?.ext ?? {};
        const sid = safeId(mod);
        const comps = def.components.map((id) => (previewMod ? e.components?.find((c) => c.id === id) : (reg.components.get(id)?.mod === mod ? reg.components.get(id)!.def : e.components?.find((c) => c.id === id)))).filter((c) => !!c);
        const val = (k?: string) => (k ? (previewMod ? game?.sim?.modData?.[mod]?.[k] ?? e.vars?.find((v) => v.key === k)?.init ?? 0 : modVarValue(game?.sim?.modData, mod, k)) : 0);
        return (
          <div key={`${mod}:${def.id}`} data-nmod={sid} className="contents">
            <style>{skinCss(mod, e.skin)}</style>
            <section className="nm-panel p-3" aria-label={def.title}>
              <header className="mb-2 flex items-center justify-between"><b className="text-[13px]">{def.title}</b><span className="text-[10px] opacity-60">{m?.name}</span></header>
              <div className="space-y-1.5">
                {comps.map((c) => {
                  const v = val(c.var);
                  const max = c.max ?? e.vars?.find((x) => x.key === c.var)?.max ?? 100;
                  if (c.type === "meter") return (
                    <div key={c.id} className="nm-comp">
                      <div className="flex justify-between text-[11.5px]"><span>{c.label}</span><span className="nm-accent font-bold tabular-nums">{v}/{max}</span></div>
                      <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-black/10"><div className="nm-fill h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%` }} /></div>
                    </div>
                  );
                  if (c.type === "counter") return <div key={c.id} className="nm-comp flex justify-between text-[12px]"><span>{c.label}</span><b className="nm-accent tabular-nums">{v}</b></div>;
                  if (c.type === "badge") return <span key={c.id} className="nm-comp nm-accent mr-1 inline-block border border-current px-2 py-0.5 text-[11px] font-bold">{c.label} {v}</span>;
                  if (c.type === "text") return <p key={c.id} className="nm-comp text-[11.5px] opacity-80">{c.text}</p>;
                  const t = e.tables?.find((x) => x.id === c.table);
                  return t ? (
                    <table key={c.id} className="nm-comp w-full text-[11px]"><thead><tr>{t.columns.map((h) => <th key={h} className="text-left opacity-70">{h}</th>)}</tr></thead>
                      <tbody>{t.rows.slice(0, 20).map((r, i) => <tr key={i}>{t.columns.map((h) => <td key={h}>{String(r[h] ?? "")}</td>)}</tr>)}</tbody></table>
                  ) : null;
                })}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}

/* —— 工程反向打包：当前存档 → 模板库 .nmod —— */
export function ReversePack({ game }: { game: GameState }) {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState({ id: "my-project", name: "我的工程", version: "1.0.0", author: "", description: "" });
  const [onlyMine, setOnlyMine] = useState(true);
  const m = useMemo(() => open ? projectToMod(game, meta, onlyMine) : null, [open, game, meta, onlyMine]);
  const okId = /^[a-z0-9][a-z0-9_-]{1,40}$/.test(meta.id);
  const f = (k: keyof typeof meta, label: string) => (
    <label className="block text-[11px] text-ink-soft">{label}
      <input value={meta[k]} onChange={(e) => setMeta({ ...meta, [k]: e.target.value })} className="mt-0.5 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-jade" />
    </label>
  );
  if (!open) return <button className={btn} onClick={() => setOpen(true)}>把当前存档反向打包为 .nmod</button>;
  return (
    <div className={card}>
      <p className="text-[12.5px] font-bold">工程反向打包</p>
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">{f("id", "MOD id")}{f("name", "名称")}{f("version", "版本")}{f("author", "作者")}</div>
      {f("description", "简介")}
      <label className="mt-1.5 flex items-center gap-2 text-[11.5px]"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="accent-[var(--jade)]" />只打包我自己创作的（排除其他 MOD 装入的资源）</label>
      {m && <p className="mt-1 text-[11px] text-ink-soft">将包含：{contentsLine(m)}</p>}
      <div className="mt-2 flex gap-2">
        <button className="rounded-full bg-jade px-3 py-1 text-[12px] font-bold text-white disabled:opacity-40" disabled={!okId || !meta.name.trim() || !m} onClick={() => m && exportNmod({ ...m, origin: { source: "project" } })}>导出 .nmod</button>
        <button className={btn} onClick={() => setOpen(false)}>收起</button>
      </div>
      {!okId && <p className="mt-1 text-[11px] text-danger">id 只能用小写字母、数字、- 和 _（2–41 位）</p>}
    </div>
  );
}

export const activeExtCount = () => getModRegistry().mods.length;
