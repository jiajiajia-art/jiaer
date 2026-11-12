import { useGame } from "../store/gameCtx";
import type { WorldBookEntry } from "../lib/types";
import { defaultWorldBook } from "../game/worldbook";
import { useState } from "react";
import { modeOf } from "../game/worldbookPick";
import WorldBookRules, { WorldBookModePills } from "./WorldBookRules";
import { getWorld, getWorldRooms } from "../mods/registry";
import { EmptyState, ScopeBanner, SearchBox, matches, useConfirm } from "./EditorKit";
import { AuditBadge, AuditBar, AuditList, auditDomId } from "./EditorKit";
import { auditGame, issuesAt } from "../game/refAudit";
import { StatusMark } from "../lib/icons";
import { blankWorldBookEntry, withWorldBookDeps } from "../lib/worldBookDeps";

/* 世界书（与模组编辑器同一份数据约定）：名称 · 正文 · 关键词；地点/人物可选挂靠。
 * 玩家在地点 / 人物在场 / 提到关键词时注入。不回退娱乐圈地点表。 */
const isConstant = (e: WorldBookEntry) => modeOf(e) === "constant";

export default function WorldBookPanel() {
  const { game, setWorldBook } = useGame();
  const [confirm, confirmEl] = useConfirm();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!game) return null;
  // 未初始化时展示内置的世界设定条目；任一编辑动作会把当前列表落库
  const raw = game.worldBook ?? defaultWorldBook();
  // 按插入顺序展示（与注入顺序一致，所见即所得）
  const book = [...raw].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  // 功能注释：只列本局生效世界自己的地点/人物；作品未写地点时为空，绝不拼娱乐圈默认表
  const worldRooms = getWorld().content.rooms ?? {};
  const roomOpts = Object.keys(worldRooms).map((id) => ({ id, name: worldRooms[id]?.name || getWorldRooms()[id]?.name || id }));
  const npcOpts = game.npcs.map((n) => ({ id: n.id, name: n.name }));
  const audit = auditGame(game, { worldBook: book });
  const wbIssues = audit.issues.filter((x) => x.at?.startsWith("wb:"));
  const groups = Array.from(new Set(raw.map((e) => e.group?.trim()).filter((g): g is string => !!g)));
  const update = (id: string, patch: Partial<WorldBookEntry>) => {
    // 功能注释：地点/人物可选；开启条目不再因未挂依赖被拒绝或自动停用
    setWorldBook(book.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const remove = async (id: string) => {
    const t = book.find((e) => e.id === id)?.title || "未命名条目";
    if (await confirm(`确定删除世界书条目「${t}」？`)) setWorldBook(book.filter((e) => e.id !== id));
  };
  // 上下移动：交换相邻条目的 order 并重新编号，保持排序稳定
  const move = (idx: number, d: number) => {
    const j = idx + d;
    if (j < 0 || j >= book.length) return;
    const next = [...book];
    [next[idx], next[j]] = [next[j], next[idx]];
    setWorldBook(next.map((e, i) => ({ ...e, order: (i + 1) * 10 })));
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(book, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "worldbook.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = (f?: File) => {
    if (!f) return;
    f.text().then((txt) => {
      try {
        const data = JSON.parse(txt);
        const arr: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : Object.values(data?.entries ?? {});
        const base = book.reduce((m, e) => Math.max(m, e.order ?? 100), 0);
        const fresh: WorldBookEntry[] = arr.filter((x): x is Record<string, any> => !!x && typeof x === "object").map((x, i) => {
          const rooms = Array.isArray(x.bindRooms) ? x.bindRooms.map(String) : x.scope === "room" && x.scopeId ? [String(x.scopeId)] : [];
          const npcs = Array.isArray(x.bindNpcs) ? x.bindNpcs.map(String) : x.scope === "npc" && x.scopeId ? [String(x.scopeId)] : [];
          return withWorldBookDeps({
            ...blankWorldBookEntry(base + (i + 1) * 10),
            title: String(x.title ?? x.comment ?? ""),
            keywords: Array.isArray(x.keywords) ? x.keywords.map(String) : Array.isArray(x.key) ? x.key.map(String) : [],
            content: String(x.content ?? ""),
            enabled: x.enabled !== false && x.disable !== true,
            constant: !!x.constant,
            probability: typeof x.probability === "number" ? x.probability : undefined,
            ...(["keyword", "constant", "once"].includes(x.mode) ? { mode: x.mode } : {}),
            ...(Number(x.duration) > 1 ? { duration: Math.trunc(Number(x.duration)) } : {}),
            ...(x.group ? { group: String(x.group) } : {}),
            ...(Number(x.weight) > 0 ? { weight: Number(x.weight) } : {}),
          }, rooms, npcs);
        }).filter((e) => e.content.trim() || e.title.trim());
        if (!fresh.length) return setMsg({ ok: false, text: "文件中没有可导入的条目。" });
        setWorldBook([...book, ...fresh]);
        setMsg({ ok: true, text: `已导入 ${fresh.length} 条。` });
      } catch {
        setMsg({ ok: false, text: "导入失败：不是有效的 JSON 文件。" });
      }
    });
  };
  const add = () => {
    const maxOrder = book.reduce((m, e) => Math.max(m, e.order ?? 100), 0);
    // 功能注释：新建默认停用，填好正文后再手动开启；地点/人物可选
    setWorldBook([...book, { ...blankWorldBookEntry(maxOrder + 10), enabled: false }]);
  };

  const activeCount = book.filter((e) => e.enabled && e.content.trim()).length;
  const constantCount = book.filter((e) => e.enabled && e.content.trim() && isConstant(e)).length;
  const constantOver = constantCount > 3;

  return (
    <div className="space-y-4">
      {confirmEl}
      <ScopeBanner scope="save">世界书属于当前存档：修改即时保存、下回合起生效。模组自带的世界书只在新开局时作为初始内容写入；与模组编辑器是同一份字段。</ScopeBanner>
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        一条设定只写一遍（名称 · 正文 · 关键词）；地点与人物可选手动挂靠。
        有挂靠时：玩家在该地点、人物在场或正文提到关键词才注入。数字越小的条目越靠前。
        始终生效的铁律请写进剧本基调。
      </p>

      {/* 统计条 + 蓝灯护栏 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper/40 px-3.5 py-2.5">
        <span className="text-[11px] font-bold tracking-[0.22em] text-ink-soft">LOREBOOK</span>
        <span className="h-3 w-px bg-line" />
        <span className="text-[12px] text-ink-soft">
          共 <span className="font-bold text-ink">{book.length}</span> 条 · 生效 <span className="font-bold text-jade-deep">{activeCount}</span> 条
        </span>
        <span className="h-3 w-px bg-line" />
        <span className={`text-[12px] ${constantOver ? "text-danger" : "text-ink-soft"}`}>
          蓝灯常驻 <span className="font-bold">{constantCount}</span> 条{constantOver ? " · 偏多，易挤占剧情，建议改用绿灯" : ""}
        </span>
      </div>

      {book.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-paper/30 px-4 py-8 text-center text-[12.5px] text-ink-soft">
          还没有世界书条目。点击下方按钮，写下你的第一条世界设定。
        </div>
      )}

      {book.length > 0 && <AuditBar issues={wbIssues} onJump={() => setQ("")} />}
      {book.length > 4 && <SearchBox value={q} onChange={setQ} placeholder="搜索条目名 / 关键词 / 正文" count={book.filter((e) => matches(q, e.title, e.content, e.keywords.join(" "))).length} />}
      {q && !book.some((e) => matches(q, e.title, e.content, e.keywords.join(" "))) && <EmptyState>没有匹配「{q}」的条目。</EmptyState>}

      <div className="space-y-3">
        {book.map((e, idx) => {
          if (!matches(q, e.title, e.content, e.keywords.join(" "))) return null;
          const constant = isConstant(e);
          return (
            <div key={e.id} id={auditDomId(`wb:${e.id}`)} className={`scroll-mt-3 rounded-2xl border p-3.5 transition ${e.enabled ? "border-line bg-paper/40" : "border-line bg-paper/20 opacity-60"}`}>
              {issuesAt(audit, `wb:${e.id}`).length > 0 && <div className="mb-2.5"><AuditList issues={issuesAt(audit, `wb:${e.id}`)} /></div>}
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                {/* 排序序号（可编辑）——越小越靠前 */}
                <input
                  type="number"
                  value={e.order ?? 100}
                  onChange={(ev) => update(e.id, { order: Number(ev.target.value) || 0 })}
                  aria-label="插入顺序（越小越靠前）"
                  title="插入顺序：越小越靠前、越受模型重视"
                  className="h-7 w-11 shrink-0 rounded-md border border-line bg-paper-2 text-center font-mono text-[12px] font-bold text-ink-soft focus:border-jade focus:outline-none"
                />
                <input
                  value={e.title}
                  onChange={(ev) => update(e.id, { title: ev.target.value })}
                  placeholder="条目名（如：帝都夜生活 / 顾氏家规）"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[13.5px] font-bold text-ink placeholder:font-normal placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                />
                {/* 功能注释：剧情记忆自动写入的关键往事，可改可删 */}
                {e._mem && <span title="剧情中自动记下的关键往事，可修改或删除" className="shrink-0 rounded-full bg-coral/12 px-2 py-0.5 text-[10.5px] font-bold text-coral">剧情记忆</span>}
                <AuditBadge issues={issuesAt(audit, `wb:${e.id}`)} />
                <button
                  onClick={() => update(e.id, { enabled: !e.enabled })}
                  aria-label={e.enabled ? "停用该条" : "启用该条"}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${e.enabled ? "bg-jade" : "bg-line"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${e.enabled ? "left-[18px]" : "left-0.5"}`} />
                </button>
                <button onClick={() => move(idx, -1)} disabled={idx === 0 || !!q} aria-label="上移" className="shrink-0 rounded-md border border-line px-1.5 py-1 text-[11px] text-ink-soft disabled:opacity-30">↑</button>
                <button onClick={() => move(idx, 1)} disabled={idx === book.length - 1 || !!q} aria-label="下移" className="shrink-0 rounded-md border border-line px-1.5 py-1 text-[11px] text-ink-soft disabled:opacity-30">↓</button>
                <button
                  onClick={() => remove(e.id)}
                  aria-label="删除该条"
                  className="shrink-0 rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft transition hover:border-danger/60 hover:text-danger"
                >
                  删除
                </button>
              </div>

              {/* 注入模式：检索命中 / 每轮全局 / 一次性 */}
              <div className="mb-2.5"><WorldBookModePills e={e} onChange={(p) => update(e.id, p)} /></div>

              {constant ? (
                <p className="mb-2.5 text-[11.5px] leading-snug text-ink-soft">该条常驻注入，无需关键词。请尽量精简，避免挤占剧情上下文。</p>
              ) : (
                <>
                  <label className="mb-1 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">关键词（逗号分隔 · 含全名/简称/别名命中率更高）</label>
                  <input
                    value={e.keywords.join("，")}
                    onChange={(ev) => update(e.id, { keywords: ev.target.value.split(/[,，、\s]+/).map((k) => k.trim()).filter(Boolean) })}
                    placeholder="顾沉，别墅，家宴"
                    className="mb-2.5 w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                  />
                  {e.keywords.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-1.5">
                      {e.keywords.map((k) => (
                        <span key={k} className="rounded-full border border-jade/40 bg-jade/10 px-2 py-0.5 text-[10.5px] text-jade-deep">{k}</span>
                      ))}
                    </div>
                  )}
                  {/* 触发概率：命中关键词后仍按此概率决定是否注入（100=必触发） */}
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <label className="shrink-0 text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">触发概率</label>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={e.probability ?? 100}
                      onChange={(ev) => update(e.id, { probability: Number(ev.target.value) })}
                      aria-label="触发概率"
                      className="min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-line/60"
                      style={{ color: "var(--jade)", accentColor: "var(--jade)", height: "6px" }}
                    />
                    <span className="w-10 shrink-0 text-right font-mono text-[12px] font-bold text-jade-deep">{e.probability ?? 100}%</span>
                  </div>
                </>
              )}

              <div className="mb-2.5"><WorldBookRules e={e} onChange={(p) => update(e.id, p)} npcs={npcOpts} rooms={roomOpts} groups={groups} /></div>
              <label className="mb-1 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">设定正文（建议 3~5 句、能独立读懂）</label>
              {e.enabled && !e.content.trim() && <p className="mb-1 text-[11px] text-danger">正文为空，此条不会生效。</p>}
              <textarea
                value={e.content}
                onChange={(ev) => update(e.id, { content: ev.target.value })}
                placeholder="在此写下这段世界设定的具体规则、背景或约束……"
                rows={3}
                className="w-full resize-y rounded-lg border border-line bg-paper-2 px-2.5 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
              />
            </div>
          );
        })}
      </div>

      {msg && <p className={`text-[12px] ${msg.ok ? "text-jade-deep" : "text-danger"}`}><StatusMark kind={msg.ok ? "ok" : "warn"}>{msg.text}</StatusMark></p>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={exportJson} disabled={book.length === 0} className="rounded-xl border border-line bg-paper/40 py-2 text-[12.5px] font-bold text-ink disabled:opacity-40">导出 JSON</button>
        <label className="cursor-pointer rounded-xl border border-line bg-paper/40 py-2 text-center text-[12.5px] font-bold text-ink">
          导入 JSON
          <input type="file" accept="application/json,.json" className="hidden" onChange={(ev) => { importJson(ev.target.files?.[0]); ev.target.value = ""; }} />
        </label>
      </div>

      <button
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-jade/50 bg-jade/5 py-3 text-[13.5px] font-bold text-jade-deep transition hover:bg-jade/10"
      >
        <span className="text-[16px] leading-none">＋</span>新增一条世界书条目
      </button>
    </div>
  );
}
