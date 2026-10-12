import { useGame } from "../store/gameCtx";
import type { WorldBookEntry } from "../lib/types";
import { defaultWorldBook } from "../game/worldbook";

/* 世界书（借鉴酒馆 SillyTavern 世界书机制）：为世界设定写规则片段，供模型查阅。
 * · 蓝灯（常驻）：每回合必注入，适合世界宪法级设定，建议严格控制在 1~3 条；
 * · 绿灯（关键词）：仅当最近对话/行动命中关键词才注入，绝大多数条目都该是绿灯；
 * · 排序：数字越小越靠前、越受模型重视，核心世界观在前、枝节在后。 */
const isConstant = (e: WorldBookEntry) => e.constant || e.keywords.length === 0;

function newEntry(order: number): WorldBookEntry {
  return { id: `wb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: "", keywords: [], content: "", enabled: true, constant: false, order };
}

export default function WorldBookPanel() {
  const { game, setWorldBook } = useGame();
  if (!game) return null;
  // 未初始化时展示内置的世界设定条目；任一编辑动作会把当前列表落库
  const raw = game.worldBook ?? defaultWorldBook();
  // 按插入顺序展示（与注入顺序一致，所见即所得）
  const book = [...raw].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  const update = (id: string, patch: Partial<WorldBookEntry>) =>
    setWorldBook(book.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => setWorldBook(book.filter((e) => e.id !== id));
  const add = () => {
    const maxOrder = book.reduce((m, e) => Math.max(m, e.order ?? 100), 0);
    setWorldBook([...book, newEntry(maxOrder + 10)]);
  };

  const activeCount = book.filter((e) => e.enabled && e.content.trim()).length;
  const constantCount = book.filter((e) => e.enabled && e.content.trim() && isConstant(e)).length;
  const constantOver = constantCount > 3;

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        为世界设定写规则片段，供模型查阅。
        <span className="text-jade-deep">蓝灯</span>条目每回合常驻注入（世界宪法级设定，建议 ≤3 条）；
        <span className="text-jade-deep">绿灯</span>条目仅当最近对话或行动命中关键词时才注入。数字越小的条目越靠前、越受模型重视。
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

      <div className="space-y-3">
        {book.map((e) => {
          const constant = isConstant(e);
          return (
            <div key={e.id} className={`rounded-2xl border p-3.5 transition ${e.enabled ? "border-line bg-paper/40" : "border-line bg-paper/20 opacity-60"}`}>
              <div className="mb-2.5 flex items-center gap-2">
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
                <button
                  onClick={() => update(e.id, { enabled: !e.enabled })}
                  aria-label={e.enabled ? "停用该条" : "启用该条"}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${e.enabled ? "bg-jade" : "bg-line"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${e.enabled ? "left-[18px]" : "left-0.5"}`} />
                </button>
                <button
                  onClick={() => remove(e.id)}
                  aria-label="删除该条"
                  className="shrink-0 rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft transition hover:border-danger/60 hover:text-danger"
                >
                  删除
                </button>
              </div>

              {/* 蓝灯 / 绿灯 触发方式切换 */}
              <div className="mb-2.5 inline-flex rounded-lg border border-line bg-paper-2 p-0.5 text-[11.5px] font-bold">
                <button
                  onClick={() => update(e.id, { constant: false })}
                  className={`rounded-md px-2.5 py-1 transition ${constant ? "text-ink-soft hover:text-ink" : "bg-jade/15 text-jade-deep"}`}
                >
                  🟢 绿灯 · 关键词触发
                </button>
                <button
                  onClick={() => update(e.id, { constant: true })}
                  className={`rounded-md px-2.5 py-1 transition ${constant ? "bg-[var(--gold)]/20 text-ink" : "text-ink-soft hover:text-ink"}`}
                >
                  🔵 蓝灯 · 常驻
                </button>
              </div>

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

              <label className="mb-1 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">设定正文（建议 3~5 句、能独立读懂）</label>
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

      <button
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-jade/50 bg-jade/5 py-3 text-[13.5px] font-bold text-jade-deep transition hover:bg-jade/10"
      >
        <span className="text-[16px] leading-none">＋</span>新增一条世界书条目
      </button>
    </div>
  );
}
