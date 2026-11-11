/* 编辑器工作台：对齐「美化 / 模组编辑台」统一设计语言
 * 顶部紧凑世界摘要卡 + 单行横滑编号胶囊导航 + 编号分组双列卡片 / 聚焦直编画布 */
import { useState, type ReactNode } from "react";
import { IconExternal } from "../lib/icons";

export type HubTool = {
  id: string;
  label: string;
  en: string;
  hint: string;
  icon: (p: { className?: string }) => ReactNode;
  stat?: string; // 状态文字，如「12 条」
  done?: boolean; // 已有自定义内容
  onOpen: () => void;
  panel?: () => ReactNode; // 直接在编辑台主工作区内嵌渲染
};
export type HubGroup = { id: string; title: string; scope: string; tools: HubTool[] };

const GROUP_EN: Record<string, string> = {
  now: "LIVE REVISION",
  story: "STORY DIRECTOR",
  mod: "WORLD & MODS",
};

export default function EditorHub({ project, stats, groups }: { project: string; stats: { k: string; v: number | string }[]; groups: HubGroup[] }) {
  const all = groups.flatMap((g) => g.tools);
  const custom = all.filter((t) => t.done && t.id !== "mods");
  const [activeId, setActiveId] = useState<string>("all");

  const activeIdx = all.findIndex((t) => t.id === activeId);
  const activeTool = activeIdx >= 0 ? all[activeIdx] : undefined;
  const nextTool = activeIdx >= 0 && activeIdx < all.length - 1 ? all[activeIdx + 1] : undefined;

  const selectTool = (t: HubTool) => {
    if (t.panel) {
      setActiveId(t.id);
    } else {
      t.onOpen();
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. 顶部世界摘要卡：只在「全部」总览里出现，进入单个模块后不占位 */}
      {!activeTool && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-gradient-to-r from-jade/10 via-paper to-coral/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[10.5px] font-bold tracking-[0.2em] text-ink-soft">正在游玩的世界</span>
            <span className="truncate font-serif text-[16px] font-bold text-ink">{project}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {custom.length > 0 ? (
              <>
                <span className="mr-0.5 text-[11px] text-ink-soft">已改 {custom.length} 处：</span>
                {custom.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTool(t)}
                    className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-medium text-ink transition hover:border-jade hover:text-jade"
                  >
                    {t.label}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-[11px] text-ink-soft">人设、场景、规则、剧情与外观均可随时改写，即时生效</span>
            )}
          </div>
        </div>

        {/* 右侧四维统计紧凑数字排 */}
        <div className="flex shrink-0 items-center divide-x divide-line rounded-xl border border-line bg-paper/90 shadow-sm">
          {stats.map((s) => (
            <div key={s.k} className="px-2.5 py-1.5 text-center">
              <p className="font-serif text-[14px] font-bold leading-none tabular-nums text-ink">{s.v}</p>
              <p className="mt-0.5 text-[10px] text-ink-soft">{s.k}</p>
            </div>
          ))}
        </div>
      </div>}

      {/* 2. 单行横滑胶囊导航条（对齐 BeautyNav / ModEditorPanel，不乱折行） */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-paper-2/95 px-4 py-2 backdrop-blur-md sm:-mx-5 sm:px-5">
        <div role="tablist" aria-label="编辑器模块" className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <button
            type="button"
            role="tab"
            aria-selected={activeId === "all"}
            onClick={() => setActiveId("all")}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-bold transition ${
              activeId === "all"
                ? "border-jade bg-jade text-white shadow-[0_6px_14px_-8px_var(--jade)]"
                : "border-line bg-paper text-ink-soft hover:border-jade hover:text-jade"
            }`}
          >
            全部
          </button>
          {all.map((t, idx) => {
            const cur = activeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={cur}
                onClick={() => selectTool(t)}
                className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-bold transition ${
                  cur
                    ? "border-jade bg-jade text-white shadow-[0_6px_14px_-8px_var(--jade)]"
                    : "border-line bg-paper text-ink-soft hover:border-jade hover:text-jade"
                }`}
              >
                <span className={`font-serif text-[10px] tabular-nums ${cur ? "text-white/75" : "text-jade/50"}`}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span>{t.label}</span>
                {t.done && t.id !== "mods" && (
                  <span className={`h-1.5 w-1.5 rounded-full ${cur ? "bg-white" : "bg-coral"}`} />
                )}
              </button>
            );
          })}
        </div>

        {activeTool && (
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
            <button type="button" onClick={() => setActiveId("all")} className="font-semibold text-ink-soft hover:text-jade">
              ‹ 返回全部模块
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={activeTool.onOpen}
                className="text-ink-soft hover:text-jade"
                title="在独立弹窗中打开"
              >
                <span className="inline-flex items-center gap-0.5">独立窗口 <IconExternal size={12} /></span>
              </button>
              {nextTool && (
                <button type="button" onClick={() => selectTool(nextTool)} className="font-semibold text-jade hover:underline">
                  下一项：{nextTool.label} ›
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. 内容区：选中单项时直接平铺渲染对应编辑器；「全部」时按编号分组展示双列工作台卡片 */}
      {activeTool?.panel ? (
        <div className="space-y-3">
          {/* 当前模块标题：只留名称与状态，说明文字不再重复铺开 */}
          <div className="flex items-center justify-between gap-2 border-b border-line px-1 pb-1.5">
            <span className="text-[15px] font-bold text-ink">{activeTool.label}</span>
            {activeTool.stat && (
              <span className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-[11px] font-semibold text-jade">{activeTool.stat}</span>
            )}
          </div>

          {/* 直接渲染子编辑器（不额外套边框盒子，避免与子面板自带内边距/边框冲突） */}
          <div>{activeTool.panel()}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g, gi) => (
            <section key={g.id} className="space-y-2.5">
              {/* 编号分组头（完全对齐 BeautyGroup 样式） */}
              <div className="flex items-end gap-3 px-1 pt-2 first:pt-0">
                <span className="font-serif text-[26px] font-black leading-none tabular-nums text-jade/30">
                  {String(gi + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1 border-b border-line pb-1.5">
                  <p className="flex items-baseline gap-2">
                    <span className="text-[15px] font-bold tracking-[0.08em] text-ink">{g.title}</span>
                    <span className="text-[9.5px] font-bold tracking-[0.25em] text-ink-soft/70">
                      {GROUP_EN[g.id] ?? g.id.toUpperCase()}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">{g.scope}</p>
                </div>
              </div>

              {/* 双列工作台入口卡（对齐 SettingBranch 质感） */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.tools.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTool(t)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-3.5 py-3 text-left transition hover:border-jade/60 hover:bg-paper-2"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${
                        t.done
                          ? "bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-sm"
                          : "bg-gradient-to-br from-[var(--jade)]/15 to-[var(--coral)]/15 text-jade group-hover:from-[var(--jade)] group-hover:to-[var(--coral)] group-hover:text-white"
                      }`}
                    >
                      <t.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold tracking-[0.04em] text-ink group-hover:text-jade-deep">
                        {t.label}
                      </span>
                      <span className="mt-0.5 block line-clamp-1 text-[11px] text-ink-soft" title={t.hint}>
                        {t.hint}
                      </span>
                    </div>
                    {t.stat && (
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          t.done
                            ? "border-jade/30 bg-jade/10 text-jade"
                            : "border-line bg-paper-2 text-ink-soft"
                        }`}
                      >
                        {t.stat}
                      </span>
                    )}
                    <span className="shrink-0 text-[16px] leading-none text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-jade">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
