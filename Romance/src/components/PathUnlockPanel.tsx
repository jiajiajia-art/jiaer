import { useEffect, useState } from "react";
import { STAT_LABELS, STAT_ORDER, creationCopy, loadPathLocks, savePathLock, clearPathLocks, type CreationPath } from "../game/data";
import { LIVE_LOCATIONS, LIVE_PEOPLE, getWorld } from "../mods/registry";
import { FIXED_METRICS } from "../game/fixedEvents";
import { formatPathLockHint, sanitizePathLockConds } from "../lib/pathDeps";
import { IconCheck, IconChevronDown, IconChevronUp, IconLock } from "../lib/icons";
import RoutePerks from "./RoutePerks";
import { EventPick, PathLockCondsEditor, RouteFxEditor } from "./ModPathsEditor";

/* 功能注释：游玩态「人物线路解锁」面板（GameShell）——读取当前生效世界 LIVE_*，仅服务已保存世界的运行时；
 * 模组编辑器的 ModPathsEditor 禁止依赖 LIVE_*，故拆到本文件，避免编辑器串入娱乐圈人物/地点。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const liveEvents = () => (getWorld().content.fixedEvents ?? []).map((e) => ({ id: e.id, name: e.name }));

/* 游戏内编辑器 · 人物线路解锁管理面板：
 * 让创作者或玩家直接在编辑器里将各条人物线路设为「已解锁」或「🔒 未解锁」，并可填写未解锁角标与解锁条件说明 */
export function PathUnlockPanel() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick((n) => n + 1);
    window.addEventListener("star:path-locks", h);
    return () => window.removeEventListener("star:path-locks", h);
  }, []);

  const cc = creationCopy();
  const paths = cc.paths ?? [];
  const locks = loadPathLocks();
  const hasOverrides = Object.keys(locks).length > 0;

  if (!paths.length) {
    return <p className="py-6 text-center text-[12.5px] text-ink-soft">当前世界观未配置人物线路。</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper-2/60 px-3.5 py-2.5">
        <p className="text-[12px] leading-relaxed text-ink-soft">
          管理开局可选人物线路：配置线路解锁状态、预设主角档案、开局地点、前置记忆、开局触发事件。可单独设置线路为<b className="text-jade">解锁</b> / <b className="text-coral">锁定</b>，锁定后支持自定义提示文案，新局选择线路时即时生效。
        </p>
        {hasOverrides && (
          <button
            type="button"
            onClick={() => clearPathLocks()}
            className="shrink-0 rounded-full border border-line bg-paper px-3 py-1 text-[11px] font-semibold text-ink-soft transition hover:border-danger hover:text-danger"
          >
            恢复默认状态
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {paths.map((p) => {
          const open = p.open;
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-3.5 transition ${
                open ? "border-line bg-paper" : "border-dashed border-coral/45 bg-coral/[0.03]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14.5px] font-bold text-ink">{p.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                        open ? "bg-jade/12 text-jade" : "bg-coral/15 text-coral"
                      }`}
                    >
                      {open ? <span className="inline-flex items-center gap-0.5"><IconCheck size={12} /> 已解锁</span> : <span className="inline-flex items-center gap-0.5"><IconLock size={12} /> {p.lockTag || "未解锁"}</span>}
                    </span>
                  </div>
                  {p.blurb && <p className="mt-1 text-[12px] text-ink-soft">{p.blurb}</p>}
                  <RoutePerks className="mt-1.5" label={p.perksLabel} text={p.perks} />
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => savePathLock(p.id, { open: true })}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-bold transition ${
                      open
                        ? "border-jade bg-jade text-white shadow-sm"
                        : "border-line bg-paper text-ink-soft hover:border-jade hover:text-jade"
                    }`}
                  >
                    已解锁
                  </button>
                  <button
                    type="button"
                    onClick={() => savePathLock(p.id, { open: false, lockTag: p.lockTag || "未解锁" })}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-bold transition ${
                      !open
                        ? "border-coral bg-coral text-white shadow-sm"
                        : "border-line bg-paper text-ink-soft hover:border-coral hover:text-coral"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1"><IconLock size={12} /> 设为未解锁</span>
                  </button>
                </div>
              </div>

              {!open && (
                <div className="mt-3 space-y-2 border-t border-line/60 pt-2.5">
                  <label className="block text-[11px] text-ink-soft">
                    未解锁角标文字
                    <input
                      className={`${inp} mt-1 max-w-[10rem]`}
                      value={p.lockTag ?? ""}
                      placeholder="未解锁"
                      onChange={(e) => savePathLock(p.id, { open: false, lockTag: e.target.value || undefined })}
                    />
                  </label>
                  <PathLockCondsEditor
                    value={Array.isArray(p.lockConds) ? p.lockConds : []}
                    pools={{
                      stats: STAT_ORDER.map((k) => ({ id: k, label: STAT_LABELS[k] || k })),
                      metrics: FIXED_METRICS.filter((m) => m.key !== "week").map((m) => ({ id: m.key, label: m.label })),
                      people: LIVE_PEOPLE.map((x) => ({ id: x.id, label: x.name })),
                      rooms: LIVE_LOCATIONS.map((x) => ({ id: x.id, label: x.name })),
                      events: liveEvents().map((e) => ({ id: e.id, label: e.name || e.id })),
                    }}
                    onChange={(lockConds) => {
                      const pools = {
                        stats: STAT_ORDER.map((k) => ({ id: k, label: STAT_LABELS[k] || k })),
                        metrics: FIXED_METRICS.filter((m) => m.key !== "week").map((m) => ({ id: m.key, label: m.label })),
                        people: LIVE_PEOPLE.map((x) => ({ id: x.id, label: x.name })),
                        rooms: LIVE_LOCATIONS.map((x) => ({ id: x.id, label: x.name })),
                        events: liveEvents().map((e) => ({ id: e.id, label: e.name || e.id })),
                      };
                      const cleaned = sanitizePathLockConds(lockConds, pools);
                      savePathLock(p.id, {
                        open: false,
                        lockConds: cleaned,
                        lockHint: formatPathLockHint(cleaned, pools) || undefined,
                      });
                    }}
                  />
                </div>
              )}
              <RouteStateEditor p={p} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 游戏内 · 线路开局状态：预设主角 / 开局地点 / 前置记忆 / 绑定事件（本地覆盖，开新局时生效） */
function RouteStateEditor({ p }: { p: CreationPath }) {
  const [open, setOpen] = useState(false);
  const save = (k: "hero" | "room" | "memory" | "event" | "eventId" | "name" | "blurb", v: string) => savePathLock(p.id, { [k]: v });
  const people = LIVE_PEOPLE.map((x) => ({ id: x.id, name: x.name }));
  const relationOf = (t: string) => {
    const rel = p.npcs?.find((n) => people.find((x) => x.id === n.id)?.name === t)?.relation;
    return typeof rel === "string" ? rel.trim() : "";
  };
  const hero = LIVE_PEOPLE.find((x) => x.id === p.hero)?.name;
  const room = LIVE_LOCATIONS.find((x) => x.id === p.room)?.name;
  const summary = [hero && `主角 ${hero}`, room && `开局在${room}`, p.memory && "有前置记忆", (p.event || p.eventId) && "有开局事件"].filter(Boolean).join(" · ");
  return (
    <div className="mt-3 border-t border-line/60 pt-2.5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left text-[11.5px]">
        <span><b className="font-semibold text-ink">开局状态</b><span className="ml-1.5 text-ink-soft">{summary || "未设定（玩家自建主角 · 默认起点）"}</span></span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-ink-soft">{open ? <>收起 <IconChevronUp size={12} /></> : <>编辑 <IconChevronDown size={12} /></>}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <label className="block text-[11px] text-ink-soft">线路名称
            <input className={`${inp} mt-1`} value={p.name} placeholder="如：灵根出世" onChange={(e) => save("name", e.target.value)} />
          </label>
          <label className="block text-[11px] text-ink-soft">线路叙事简介（纯文字背景介绍，不写数值）
            <textarea rows={2} className={`${inp} mt-1`} value={p.blurb} placeholder="如：天生五灵根，修行起步缓慢，但悟性极佳" onChange={(e) => save("blurb", e.target.value)} />
          </label>
          <RouteFxEditor value={p.fx} npcs={people} relationOf={relationOf} label={p.perksLabel}
            onLabel={(v) => savePathLock(p.id, { perksLabel: v ?? "" })}
            onChange={(fx, text) => savePathLock(p.id, { fx, perks: text })} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-[11px] text-ink-soft">预设主角（没选中的预设角色照常作为 NPC 生活）
              <select className={`${inp} mt-1`} value={p.hero ?? ""} onChange={(e) => save("hero", e.target.value)}>
                <option value="">不绑定（玩家自建主角）</option>
                {p.hero && !hero && <option value={p.hero}>{p.hero}（已失效）</option>}
                {LIVE_PEOPLE.map((x) => <option key={x.id} value={x.id}>{x.name}{x.role ? ` · ${x.role}` : ""}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-ink-soft">开局地点
              <select className={`${inp} mt-1`} value={p.room ?? ""} onChange={(e) => save("room", e.target.value)}>
                <option value="">地图默认起点</option>
                {p.room && !room && <option value={p.room}>{p.room}（已失效）</option>}
                {LIVE_LOCATIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-[11px] text-ink-soft">专属前置记忆（写进主角档案，AI 可读）
            <textarea rows={2} className={`${inp} mt-1`} value={p.memory ?? ""} placeholder="如：三年前在雨夜救过一只流浪猫" onChange={(e) => save("memory", e.target.value)} />
          </label>
          <EventPick value={p.eventId} events={liveEvents()} onChange={(v) => save("eventId", v ?? "")} />
        </div>
      )}
    </div>
  );
}
