import { useEffect, useState } from "react";
import {
  STAT_LABELS, creationCopy, loadPathLocks, savePathLock, clearPathLocks,
  type CreationCopy, type CreationPath, type Option, type PathCardPart, type PathNpc,
} from "../game/data";
import { complete, isConfigured } from "../lib/ai";
import { loadConfig } from "../lib/store";
import { LIVE_LOCATIONS, LIVE_PEOPLE } from "../mods/registry";
import { FIXED_METRICS } from "../game/fixedEvents";
import IntInput from "./IntInput";
import { normRouteFx, routeFxText, type RouteFx, type RouteNum } from "../game/routeFx";
import RoutePerks from "./RoutePerks";
import { getWorld, getWorldSlot } from "../mods/registry";
import { valueSources } from "../game/valueSources";
import { IconCheck, IconChevronDown, IconChevronUp, IconClose, IconLock, IconSpark } from "../lib/icons";

const livePool = () => [...new Set(valueSources({ stats: getWorldSlot("stats"), attrs: getWorldSlot("customAttrs"), paths: creationCopy().paths }).map((s) => s.label))];
const liveEvents = () => (getWorld().content.fixedEvents ?? []).map((e) => ({ id: e.id, name: e.name }));
/* 绑定事件库里的固定事件（可选）：开局序章按该事件演绎 */
function EventPick({ value, events, onChange }: { value?: string; events: { id: string; name: string }[]; onChange: (v: string | undefined) => void }) {
  return (
    <label className="block text-[10.5px] text-ink-soft">绑定开局事件（事件库，可选）
      <select className="mt-0.5 w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink focus:border-jade focus:outline-none" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">不绑定</option>
        {value && !events.some((x) => x.id === value) && <option value={value}>{value}（已失效）</option>}
        {events.map((x) => <option key={x.id} value={x.id}>{x.name || x.id}</option>)}
      </select>
    </label>
  );
}

/* 模组编辑器 · 人物线路：建角第一步的路径卡片（creation.paths）+ 对应的开局数值加成（identities，id 一一对应）。
 * 可手动逐条配置，也可让 AI 按世界观一键生成整套路径。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const num = (v: unknown) => Math.round(Number(v) || 0);

/* 弹窗卡片里可以对玩家隐藏的内容块 */
const CARD_PARTS: { k: PathCardPart; label: string }[] = [
  { k: "about", label: "开局处境" }, { k: "choose", label: "可自由决定" }, { k: "fixed", label: "固定不可改" },
  { k: "perks", label: "开局数值" }, { k: "npcs", label: "开局人际" }, { k: "soon", label: "未解锁路径" },
];

export default function ModPathsEditor({ creation, identities, world, npcs = [], rooms = [], events = [], statsValue, attrsValue, onChange }: {
  creation?: CreationCopy; identities?: Option[]; world: string;
  npcs?: { id: string; name: string }[]; // 可配开局人际 / 预设主角的固定人物
  rooms?: { id: string; name: string }[]; // 可选的开局地点
  events?: { id: string; name: string }[]; // 事件库（绑定开局事件）
  statsValue?: import("../game/data").StatsSlot; attrsValue?: import("../lib/types").AttrDef[]; // 全局属性池来源（正在编辑的模组）
  onChange: (p: { creation: CreationCopy; identities: Option[] }) => void;
}) {
  events = events.length ? events : liveEvents();
  const pool = statsValue || attrsValue ? [...new Set(valueSources({ stats: statsValue, attrs: attrsValue, paths: creation?.paths }).map((s) => s.label))] : undefined;
  rooms = rooms.length ? rooms : LIVE_LOCATIONS.map((l) => ({ id: l.id, name: l.name })); // 模组没自建地点时用依赖世界的地图
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cc = creation ?? {};
  const paths = Array.isArray(cc.paths) ? cc.paths : [];
  const ids = Array.isArray(identities) ? identities : [];
  const startFactions = Array.isArray(cc.startFactions) ? cc.startFactions : [];
  const idOf = (id: string): Option => ids.find((o) => o.id === id) ?? { id, name: "", desc: "", tag: "" };
  const commit = (np: CreationPath[], ni: Option[], extra: Partial<CreationCopy> = {}) => onChange({ creation: { ...cc, ...extra, paths: np }, identities: ni });
  const setPath = (i: number, p: Partial<CreationPath>) => commit(paths.map((x, j) => (j === i ? { ...x, ...p } : x)), ids);
  const remove = (i: number) => { const id = paths[i].id; commit(paths.filter((_, j) => j !== i), ids.filter((o) => o.id !== id)); };
  const add = () => {
    const id = `path${Date.now().toString(36).slice(-4)}`;
    commit([...paths, { id, name: "", tag: "", blurb: "", open: true, about: "", fixed: [], choose: [], perks: "" }], [...ids, { id, name: "", desc: "", tag: "" }]);
  };

  const aiGen = async () => {
    const cfg = loadConfig();
    if (!isConfigured(cfg)) { setErr("尚未配置 AI，请先在菜单「AI 配置」里接入模型。"); return; }
    setBusy(true); setErr("");
    try {
      const raw = await complete(cfg, [
        { role: "system", content: "你是女性向模拟游戏的剧情与数值策划。只输出 JSON，不要任何解释或代码块标记。" },
        { role: "user", content: `为下面的世界观设计「人物线路」（建角第一步，决定玩家的人生开局）。\n世界观：${world}\n本世界已有的属性 / 词条名（优先沿用，也可按题材新起名字）：${[...Object.values(STAT_LABELS), ...FIXED_METRICS.filter((m) => m.key !== "week").map((m) => m.label)].join("、")}\n输出格式：{"paths":[{"id":"英文id","name":"四字左右的路径名","tag":"短标签","blurb":"一句话卖点","about":"80~150字的开局处境，用第二人称「你」","fixed":["该路径锁定的设定"],"choose":["玩家仍可自由决定的项"],"fx":{"attr":[{"name":"属性名","val":整数}],"favor":[{"target":"人物名","val":整数}],"reputation":[{"name":"声望词条名","val":整数}],"note":"一句概括，如：专业底子厚，但还没名气"},"hero":"预设主角的人物 id 或空串","room":"开局地点 id 或空串","memory":"30~80字的专属前置记忆","event":"一句序章里必定发生的开局小事件"}]}\n要求：3~5 条差异明显的路径，各有优劣；不要写页面标题、引导语、身份字段名或人物描述初始值。属性单项 -20~80，好感 -20~30，声望词条 -15~45，全部为整数，数值克制且与 note 一致；favor 的 target 只能用下面列出的人物名。\n可选预设主角（id=名字，适合当主角的才绑定，每人最多绑定一条线路，不合适就留空）：${npcs.map((n) => `${n.id}=${n.name}`).join("，") || "无"}\n可选开局地点（id=名字）：${rooms.map((r) => `${r.id}=${r.name}`).join("，") || "无"}` },
      ]);
      const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {
        paths?: (Partial<CreationPath> & { fx?: unknown })[];
      };
      const list = (j.paths ?? []).filter((p) => p?.name);
      if (!list.length) throw new Error("AI 没有返回可用的路径，请重试。");
      const np: CreationPath[] = list.map((p, i) => ({
        id: (p.id || `path${i}`).toLowerCase().replace(/[^a-z0-9_-]+/g, "-"), name: p.name!, tag: p.tag ?? "", blurb: p.blurb ?? "", open: true,
        about: p.about ?? "", fixed: Array.isArray(p.fixed) ? p.fixed.map(String) : [], choose: Array.isArray(p.choose) ? p.choose.map(String) : [],
        ...(() => { const fx = normRouteFx(p.fx); if (fx) fx.favor = fx.favor?.filter((f) => npcs.some((n) => n.name === f.target)); return fx ? { fx, perks: routeFxText(fx) } : { perks: p.perks ?? "" }; })(),
        ...(p.hero && npcs.some((n) => n.id === p.hero) && !list.slice(0, i).some((q) => q.hero === p.hero) ? { hero: p.hero } : {}),
        ...(p.room && rooms.some((r) => r.id === p.room) ? { room: p.room } : {}),
        ...(typeof p.memory === "string" && p.memory.trim() ? { memory: p.memory.trim() } : {}),
        ...(typeof p.event === "string" && p.event.trim() ? { event: p.event.trim() } : {}),
      }));
      const ni: Option[] = np.map((p) => ({ id: p.id, name: p.name, tag: p.tag, desc: p.perks })); // 数值全在线路 fx 里，身份表只留名称
      // 功能注释：建角页标题和引导语不再由这里改写。AI 只换路径；已经保存的旧句子原样留在 creation 上。
      commit(np, ni);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "生成失败，请稍后再试。");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-jade/10 to-coral/10 px-3 py-2">
        <p className="text-[11.5px] leading-snug text-ink-soft">让 AI 按这个世界观生成一整套人物线路（文案 + 开局数值 + 预设主角 / 地点 / 前置记忆 / 开局事件），生成后仍可逐项修改。</p>
        <button className={`${btn} shrink-0 inline-flex items-center gap-1 !border-transparent bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] !text-white`} disabled={busy} onClick={aiGen}>{busy ? "生成中…" : <><IconSpark size={14} /> AI 生成</>}</button>
      </div>
      {err && <p className="text-[11px] text-danger">{err}</p>}

      <div className="space-y-2 rounded-xl border border-line bg-paper p-2.5">
        <p className="text-[12px] font-bold text-ink">玩家可见 <span className="font-normal text-ink-soft">· 开局要不要让玩家挑路径、弹窗里给玩家看什么</span></p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-soft">路径选择</span>
          {([["modal", "开局弹窗 · 玩家自选"], ["off", "不显示 · 直接用第一条开放路径"]] as const).map(([k, t]) => {
            const on = (cc.pathPicker ?? "modal") === k;
            return <button key={k} type="button" aria-pressed={on} className={`${btn} ${on ? "!border-jade bg-jade/10 !text-jade" : ""}`} onClick={() => commit(paths, ids, { pathPicker: k === "modal" ? undefined : k })}>{t}</button>;
          })}
        </div>
        <div className={`flex flex-wrap items-center gap-1.5 ${cc.pathPicker === "off" ? "pointer-events-none opacity-40" : ""}`}>
          <span className="text-[11px] text-ink-soft">卡片显示</span>
          {CARD_PARTS.map(({ k, label }) => {
            const on = !cc.pathHide?.[k];
            return <button key={k} type="button" aria-pressed={on} className={`${btn} ${on ? "!border-jade bg-jade/10 !text-jade" : "line-through"}`}
              onClick={() => { const h = { ...cc.pathHide, [k]: on || undefined }; if (!on) delete h[k]; commit(paths, ids, { pathHide: Object.keys(h).length ? h : undefined }); }}>{on ? <IconCheck size={12} className="mr-0.5 inline" /> : null}{label}</button>;
          })}
        </div>
        {cc.pathPicker === "off" && <p className="text-[10.5px] leading-snug text-ink-soft">玩家看不到路径弹窗；开局加成、开局人际等仍按第一条「已开放」路径生效。</p>}
      </div>

      {/* 开局势力：玩家在建角「开局」页勾选加入；开局时全部装入阵营系统（声望 / 好感波及 / 调价 / 世界书关键词） */}
      <div className="space-y-2 rounded-xl border border-line bg-paper-2/50 p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-[12.5px] font-bold text-ink">开局势力（玩家勾选加入）</p>
          <label className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft">
            <span className="whitespace-nowrap">最多可选</span>
            <input type="number" min={0} aria-label="最多可选" className={`${inp} !w-16 shrink-0 text-center`} value={cc.factionPickMax ?? ""} placeholder="不限"
              onChange={(e) => { const n = Math.max(0, Math.round(Number(e.target.value))); commit(paths, ids, { factionPickMax: e.target.value && n ? n : undefined }); }} />
          </label>
        </div>
        {startFactions.map((f, i, all) => {
          const put = (p: Partial<typeof f>) => commit(paths, ids, { startFactions: all.map((x, j) => (j === i ? { ...x, ...p } : x)) });
          return (
            <div key={f.id} className="grid gap-1.5 rounded-lg border border-line/70 bg-paper p-2">
              <div className="flex gap-1.5">
                <input className={inp} value={f.name} placeholder="势力名称" onChange={(e) => put({ name: e.target.value })} />
                <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft">初始声望
                  <input type="number" min={-100} max={100} className={`${inp} w-16`} value={f.rep ?? 20} onChange={(e) => put({ rep: Math.max(-100, Math.min(100, Math.round(Number(e.target.value) || 0))) })} />
                </label>
                <button className={btn} onClick={() => commit(paths, ids, { startFactions: all.filter((_, j) => j !== i) })}>删除</button>
              </div>
              <textarea rows={2} className={inp} value={f.desc ?? ""} placeholder="势力设定（建角页展示，也作为世界书正文注入剧情）" onChange={(e) => put({ desc: e.target.value || undefined })} />
              <input className={inp} key={Array.isArray(f.tags) ? f.tags.join("、") : ""} defaultValue={Array.isArray(f.tags) ? f.tags.join("、") : ""} placeholder="标签 / 别称，用顿号分隔（剧情里提到即触发）" onBlur={(e) => put({ tags: e.target.value.split(/[、,，]/).map((t) => t.trim()).filter(Boolean) })} />
            </div>
          );
        })}
        <button className={btn} onClick={() => commit(paths, ids, { startFactions: [...startFactions, { id: `sf_${Date.now().toString(36)}`, name: "", rep: 20 }] })}>＋ 新增势力</button>
      </div>

      {paths.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-3 text-center text-[11.5px] text-ink-soft">
          还没有路径。用上面的 AI 生成，或在下面添加路径。
        </div>
      )}

      {paths.map((p, i) => {
        const b = idOf(p.id);
        return (
          <div key={p.id + i} className="space-y-1.5 rounded-xl border border-line bg-paper-2 p-2">
            <div className="flex items-center gap-1.5">
              <input className={`${inp} ${String(p.name ?? "").trim() ? "" : "!border-danger"}`} value={String(p.name ?? "")} placeholder="路径名（如：科班出道）" onChange={(e) => { const name = e.target.value; commit(paths.map((x, j) => (j === i ? { ...x, name } : x)), ids.some((o) => o.id === p.id) ? ids.map((o) => (o.id === p.id ? { ...o, name } : o)) : [...ids, { ...b, name }]); }} />
              <input className={`${inp} !w-28 shrink-0`} value={String(p.tag ?? "")} placeholder="标签" onChange={(e) => setPath(i, { tag: e.target.value })} />
              <button
                type="button"
                className={`${btn} shrink-0 ${p.open ? "!border-jade bg-jade/10 !text-jade" : "!border-coral/50 bg-coral/10 !text-coral"}`}
                onClick={() => setPath(i, { open: !p.open })}
              >
                {p.open ? <><IconCheck size={14} /> 已解锁</> : <><IconLock size={14} /> {p.lockTag || "未解锁"}</>}
              </button>
              <button className={`${btn} shrink-0`} onClick={() => remove(i)} aria-label="删除"><IconClose size={14} /></button>
            </div>
            {!p.open && (
              <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-dashed border-coral/40 bg-coral/[0.04] p-2 sm:grid-cols-[140px_minmax(0,1fr)]">
                <label className="text-[10.5px] text-ink-soft">
                  未解锁角标
                  <input
                    className={`${inp} mt-0.5`}
                    value={p.lockTag ?? ""}
                    placeholder="未解锁"
                    onChange={(e) => setPath(i, { lockTag: e.target.value || undefined })}
                  />
                </label>
                <label className="text-[10.5px] text-ink-soft">
                  解锁条件 / 提示语（在建角卡片上显示）
                  <input
                    className={`${inp} mt-0.5`}
                    value={p.lockHint ?? ""}
                    placeholder="如：达成任意一周目结局后解锁"
                    onChange={(e) => setPath(i, { lockHint: e.target.value || undefined })}
                  />
                </label>
              </div>
            )}
            <textarea rows={2} className={inp} value={String(p.blurb ?? "")} placeholder="线路简介（卡片上显示，自由书写）" onChange={(e) => setPath(i, { blurb: e.target.value })} />
            <textarea rows={3} className={inp} value={String(p.about ?? "")} placeholder="展开详情：开局处境（第二人称「你」）" onChange={(e) => setPath(i, { about: e.target.value })} />
            <div className="grid grid-cols-2 gap-1.5">
              <label className="text-[11px] text-ink-soft">玩家可自由决定（每行一项，可留空）
                <textarea rows={3} className={`${inp} mt-0.5`} value={(Array.isArray(p.choose) ? p.choose : []).join("\n")} onChange={(e) => setPath(i, { choose: lines(e.target.value) })} />
              </label>
              <label className="text-[11px] text-ink-soft">固定不可改（每行一项，可留空）
                <textarea rows={3} className={`${inp} mt-0.5`} value={(Array.isArray(p.fixed) ? p.fixed : []).join("\n")} onChange={(e) => setPath(i, { fixed: lines(e.target.value) })} />
              </label>
            </div>
            <RouteFxEditor pool={pool} label={p.perksLabel} onLabel={(perksLabel) => setPath(i, { perksLabel })} value={p.fx} npcs={npcs} relationOf={(t) => { const rel = p.npcs?.find((n) => npcs.find((x) => x.id === n.id)?.name === t)?.relation; return typeof rel === "string" ? rel.trim() : ""; }}
              onChange={(fx, text) => setPath(i, { fx, perks: text })} />
            <div className="space-y-1.5 rounded-lg border border-line/70 bg-paper p-2">
              <p className="text-[11px] text-ink-soft"><b className="font-semibold text-ink">开局状态</b> · 选这条线路时专属的主角与开局；没被选中的预设主角照常作为 NPC 生活</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <label className="text-[10.5px] text-ink-soft">预设主角
                  <select className={`${inp} mt-0.5`} value={p.hero ?? ""} onChange={(e) => setPath(i, { hero: e.target.value || undefined })}>
                    <option value="">不绑定（玩家自建主角）</option>
                    {p.hero && !npcs.some((x) => x.id === p.hero) && <option value={p.hero}>{p.hero}（已失效）</option>}
                    {npcs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </label>
                <label className="text-[10.5px] text-ink-soft">开局地点
                  <select className={`${inp} mt-0.5`} value={p.room ?? ""} onChange={(e) => setPath(i, { room: e.target.value || undefined })}>
                    <option value="">地图默认起点</option>
                    {p.room && !rooms.some((x) => x.id === p.room) && <option value={p.room}>{p.room}（已失效）</option>}
                    {rooms.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-[10.5px] text-ink-soft">专属前置记忆（写进主角档案，AI 可读）
                <textarea rows={2} className={`${inp} mt-0.5`} value={p.memory ?? ""} placeholder="如：三年前在雨夜救过一只流浪猫，至今记得那家便利店" onChange={(e) => setPath(i, { memory: e.target.value || undefined })} />
              </label>
              <label className="block text-[10.5px] text-ink-soft">开局独有小事件（序章里必定发生）
                <textarea rows={2} className={`${inp} mt-0.5`} value={p.event ?? ""} placeholder="如：出门时撞见邻居搬家，箱子里掉出一张旧照片" onChange={(e) => setPath(i, { event: e.target.value || undefined })} />
              </label>
              <EventPick value={p.eventId} events={events} onChange={(eventId) => setPath(i, { eventId })} />
            </div>
            <PathNpcsEditor value={Array.isArray(p.npcs) ? p.npcs : []} npcs={npcs} onChange={(v) => setPath(i, { npcs: v.length ? v : undefined })} />
            {hasLegacy(b) && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gold/50 bg-gold/5 px-2 py-1.5 text-[11px] text-ink-soft">
                <span className="min-w-0 flex-1">这条线路还有旧版固定加成（{legacyText(b)}），开局仍会生效。</span>
                <button type="button" className={`${btn} shrink-0`} onClick={() => { const fx = mergeLegacy(p.fx, b); commit(paths.map((x, j) => (j === i ? { ...x, fx, perks: routeFxText(fx) } : x)), ids.map((o) => (o.id === p.id ? { ...o, stats: undefined, fame: undefined, reputation: undefined, money: undefined } : o))); }}>转为动态数值</button>
              </div>
            )}
          </div>
        );
      })}
      <button className={btn} onClick={add}>＋ 添加路径</button>
    </div>
  );
}

/* 旧版固定加成（identities 里的八维 / 名气 / 口碑 / 资金万元）：只用于兼容展示与一键转换 */
const hasLegacy = (b: Option) => !!(b.fame || b.reputation || b.money || Object.values(b.stats ?? {}).some(Boolean));
const legacyRows = (b: Option): { attr: RouteNum[]; reputation: RouteNum[] } => ({
  attr: Object.entries(b.stats ?? {}).filter(([, v]) => v).map(([k, v]) => ({ name: STAT_LABELS[k as keyof typeof STAT_LABELS] ?? k, val: num(v) })),
  reputation: [
    ...(b.fame ? [{ name: "名气", val: num(b.fame) }] : []),
    ...(b.reputation ? [{ name: "口碑", val: num(b.reputation) }] : []),
    ...(b.money ? [{ name: "现金", val: num(b.money) * 10000 }] : []),
  ],
});
const legacyText = (b: Option) => { const r = legacyRows(b); return [...r.attr, ...r.reputation].map((x) => `${x.name} ${x.val > 0 ? "+" : ""}${x.val}`).join("、"); };
const mergeLegacy = (fx: RouteFx | undefined, b: Option): RouteFx => {
  const r = legacyRows(b);
  const add = (cur: RouteNum[] = [], more: RouteNum[]) => { const out = cur.map((x) => ({ ...x })); for (const m of more) { const h = out.find((x) => x.name === m.name); if (h) h.val += m.val; else out.push(m); } return out; };
  return { ...fx, attr: add(fx?.attr, r.attr), reputation: add(fx?.reputation, r.reputation) };
};

/* 可增删、可拖拽排序的数值行（名称 + 整数）；拖拽之外也给上下移动按钮，方便触屏与键盘 */
function NumRows<T extends { val: number }>({ title, hint, rows, nameOf, setName, placeholder, list, warn, onChange }: {
  title: string; hint: string; rows: T[]; nameOf: (r: T) => string; setName: (r: T, v: string) => T; placeholder: string;
  list?: string; warn?: (name: string) => string | null; onChange: (rows: T[]) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => { if (to < 0 || to >= rows.length || from === to) return; const n = rows.slice(); const [x] = n.splice(from, 1); n.splice(to, 0, x); onChange(n); };
  const set = (i: number, r: T) => onChange(rows.map((x, j) => (j === i ? r : x)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-soft"><b className="font-semibold text-ink">{title}</b> · {hint}</p>
        <button type="button" className={`${btn} shrink-0`} onClick={() => onChange([...rows, setName({ val: 0 } as T, "")])}>＋ 添加一行</button>
      </div>
      {rows.map((r, i) => {
        const w = warn?.(nameOf(r));
        return (
          <div key={i}
            onDragOver={(e) => { if (drag !== null) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); }}
            className={`rounded-lg ${drag === i ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-1">
              <span draggable onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDrag(null)}
                className="cursor-grab select-none px-0.5 text-[13px] leading-none text-ink-soft active:cursor-grabbing" title="拖动排序" aria-hidden>⋮⋮</span>
              <input className={`${inp} ${String(nameOf(r) ?? "").trim() ? "" : "!border-danger/60"}`} value={String(nameOf(r) ?? "")} placeholder={placeholder} list={list} aria-label={`${title}名称`} onChange={(e) => set(i, setName(r, e.target.value))} />
              <IntInput value={r.val} label={`${title}数值`} onChange={(val) => set(i, { ...r, val })} />
              <button type="button" className={`${btn} shrink-0 !px-1.5`} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="上移">↑</button>
              <button type="button" className={`${btn} shrink-0 !px-1.5`} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} aria-label="下移">↓</button>
              <button type="button" className={`${btn} shrink-0 !px-2 hover:!border-danger hover:!text-danger`} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="删除这一行">×</button>
            </div>
            {w && <p className="ml-4 mt-0.5 text-[10.5px] text-gold">{w}</p>}
          </div>
        );
      })}
      {!rows.length && <p className="text-[10.5px] text-ink-soft/80">（暂无，点「＋ 添加一行」）</p>}
    </div>
  );
}

/* 人物线路 · 开局数值：动态 JSON（属性 / 好感 / 声望词条全部自定义名称），下方实时预览成玩家看到的「数值倾向」 */
function RouteFxEditor({ label, onLabel, value, npcs, relationOf, onChange, pool }: {
  label?: string; onLabel: (v: string | undefined) => void;
  pool?: string[]; // 全局属性池名称（与人脉卡片、结局评定共用）；缺省取当前世界
  value?: RouteFx; npcs: { id: string; name: string }[]; relationOf: (target: string) => string;
  onChange: (fx: RouteFx | undefined, text: string) => void;
}) {
  const fx = value ?? {};
  const [listId] = useState(() => `route-npcs-${Math.random().toString(36).slice(2, 8)}`);
  const poolNames = pool ?? livePool();
  const [poolId] = useState(() => `route-pool-${Math.random().toString(36).slice(2, 8)}`);
  const known = new Set([...Object.values(STAT_LABELS), ...FIXED_METRICS.map((m) => m.label), ...poolNames]);
  const commitFx = (p: Partial<RouteFx>) => {
    const next = { ...fx, ...p };
    const clean = normRouteFx(next);
    // 编辑中的空名行先保留在表单里；存档与预览只用清洗后的数据
    const keep: RouteFx = {
      attr: next.attr ?? [], favor: next.favor ?? [], reputation: next.reputation ?? [], note: next.note || undefined,
      ...(next.mode === "free" ? { mode: "free" as const } : {}), ...(next.text ? { text: next.text } : {}), ...(next.favorWord !== undefined ? { favorWord: next.favorWord } : {}),
    };
    onChange(keep.attr!.length || keep.favor!.length || keep.reputation!.length || keep.note || keep.text ? keep : undefined, routeFxText(clean, relationOf));
  };
  const preview = routeFxText(normRouteFx(fx), relationOf);
  // 功能注释：线路数值行常缺 name，渲染时 warn 回调直接 n.trim() 会在角色页崩成 reading 'trim'
  const newAttr = (n: string) => {
    const s = String(n ?? "").trim();
    return s && !known.has(s) ? `本世界还没有「${s}」，开局时会自动新建为自定义属性` : null;
  };
  return (
    <div className="space-y-2 rounded-lg border border-line/70 bg-paper p-2">
      <p className="text-[11px] text-ink-soft"><b className="font-semibold text-ink">开局数值</b> · 名称取自全局属性池或自由新建（与人脉卡片、结局评定共用），数值为整数，可正可负</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <label className="text-[10.5px] text-ink-soft">卡片预览方式
          <select className={`${inp} mt-0.5`} value={fx.mode ?? "list"} onChange={(e) => commitFx({ mode: e.target.value === "free" ? "free" : undefined })}>
            <option value="list">简洁罗列（名称 +数值）</option>
            <option value="free">自由备注（原样显示描述）</option>
          </select>
        </label>
        <label className="text-[10.5px] text-ink-soft">小标题（可空，不显示）
          <input className={`${inp} mt-0.5`} value={label ?? ""} placeholder="留空 = 无标题" onChange={(e) => onLabel(e.target.value || undefined)} />
        </label>
        <label className="text-[10.5px] text-ink-soft">好感项后缀
          <input className={`${inp} mt-0.5`} value={fx.favorWord ?? "好感"} placeholder="留空 = 只写人名" onChange={(e) => commitFx({ favorWord: e.target.value })} />
        </label>
      </div>
      <NumRows title="属性" hint="主角能力" rows={Array.isArray(fx.attr) ? fx.attr : []} nameOf={(r) => String(r?.name ?? "")} setName={(r, name) => ({ ...r, name })} placeholder="属性名称（从属性池选或新建）" list={poolId} warn={newAttr} onChange={(attr) => commitFx({ attr })} />
      <datalist id={poolId}>{poolNames.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id={listId}>{npcs.map((n) => <option key={n.id} value={n.name} />)}</datalist>
      <NumRows title="好感" hint="目标角色对主角的好感变化" rows={Array.isArray(fx.favor) ? fx.favor : []} nameOf={(r) => String(r?.target ?? "")} setName={(r, target) => ({ ...r, target })} placeholder="目标角色（从角色库选或手填）" list={listId}
        warn={(t) => {
          const s = String(t ?? "").trim();
          return s && !npcs.some((n) => n.name === s || n.id === s) ? `角色库里没有「${s}」，开局时这一行不会生效` : null;
        }} onChange={(favor) => commitFx({ favor })} />
      <NumRows title="声望 / 词条" hint="口碑、名气、气运、声望……" rows={Array.isArray(fx.reputation) ? fx.reputation : []} nameOf={(r) => String(r?.name ?? "")} setName={(r, name) => ({ ...r, name })} placeholder="词条名称（从属性池选或新建）" list={poolId} warn={newAttr} onChange={(reputation) => commitFx({ reputation })} />
      {fx.mode === "free" && (
        <label className="block text-[11px] text-ink-soft">自由描述（卡片上原样显示，不自动拼接数值；上方数值仍在开局生效）
          <textarea rows={2} className={`${inp} mt-0.5`} value={fx.text ?? ""} placeholder="如：灵力尚浅，悟性奇高，师尊另眼相看" onChange={(e) => commitFx({ text: e.target.value })} />
        </label>
      )}
      <label className="block text-[11px] text-ink-soft">线路备注短句（显示在括号里，可空）
        <input className={`${inp} mt-0.5`} value={fx.note ?? ""} placeholder="如：专业底子厚，但还没名气" onChange={(e) => commitFx({ note: e.target.value })} />
      </label>
      <div className="rounded-lg border border-gold/30 bg-gold/5 px-2.5 py-1.5" aria-live="polite">
        <p className="text-[10px] font-semibold tracking-wider text-gold">实时预览 · 玩家在线路卡片上看到</p>
        {preview ? <RoutePerks className="mt-1 !px-0 !bg-transparent" label={label} text={preview} /> : <p className="mt-0.5 text-[12px] text-ink-soft">（填写上方数值后在这里预览）</p>}
      </div>
    </div>
  );
}

/* 路径的开局人际：每条路径对固定人物设不同的初始关系 / 好感 / 是否相识 */
function PathNpcsEditor({ value, npcs, onChange }: { value: PathNpc[]; npcs: { id: string; name: string }[]; onChange: (v: PathNpc[]) => void }) {
  const set = (i: number, p: Partial<PathNpc>) => onChange(value.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const unused = npcs.filter((n) => !value.some((v) => v.id === n.id));
  return (
    <div className="space-y-1 rounded-lg border border-line/70 bg-paper p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-soft"><b className="font-semibold text-ink">开局人际</b> · 选这条路径时与固定人物的初始关系（写进人物档案，AI 可读）</p>
        <button type="button" className={`${btn} shrink-0`} disabled={!unused.length} onClick={() => onChange([...value, { id: unused[0].id, relation: "", met: true }])}>＋ 人物</button>
      </div>
      {!npcs.length && <p className="text-[10.5px] text-ink-soft">本世界还没有固定人物，先在「固定人物」里添加。</p>}
      {value.map((n, i) => (
        <div key={`${n.id}-${i}`} className="flex flex-wrap items-center gap-1.5">
          <select className={`${inp} !w-28 shrink-0`} value={n.id} onChange={(e) => set(i, { id: e.target.value })}>
            {!npcs.some((x) => x.id === n.id) && <option value={n.id}>{n.id}（已失效）</option>}
            {npcs.filter((x) => x.id === n.id || !value.some((v) => v.id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <input className={`${inp} !w-auto min-w-[7rem] flex-1`} value={n.relation ?? ""} placeholder="关系（如：恩师 / 青梅竹马）" onChange={(e) => set(i, { relation: e.target.value || undefined })} />
          <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft">好感
            <input type="number" min={0} max={100} className={`${inp} !w-14`} value={n.rel ?? ""} placeholder="默认"
              onChange={(e) => set(i, { rel: e.target.value === "" ? undefined : Math.max(0, Math.min(100, num(e.target.value))) })} />
          </label>
          <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft">
            <input type="checkbox" checked={!!n.met} onChange={(e) => set(i, { met: e.target.checked || undefined })} />已相识
          </label>
          <button type="button" className={`${btn} shrink-0`} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="移除">×</button>
        </div>
      ))}
    </div>
  );
}
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
                <div className="mt-3 grid grid-cols-1 gap-2 border-t border-line/60 pt-2.5 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <label className="text-[11px] text-ink-soft">
                    未解锁角标文字
                    <input
                      className={`${inp} mt-1`}
                      value={p.lockTag ?? ""}
                      placeholder="未解锁"
                      onChange={(e) => savePathLock(p.id, { open: false, lockTag: e.target.value || undefined })}
                    />
                  </label>
                  <label className="text-[11px] text-ink-soft">
                    解锁条件 / 未解锁说明（展示在建角卡片下方）
                    <input
                      className={`${inp} mt-1`}
                      value={p.lockHint ?? ""}
                      placeholder="如：通关任意一周目结局后解锁"
                      onChange={(e) => savePathLock(p.id, { open: false, lockHint: e.target.value || undefined })}
                    />
                  </label>
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

/* 游戏内 · 线路开局状态：预设主角 / 开局地点 / 前置记忆 / 开局小事件（本地覆盖，开新局时生效） */
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
          <label className="block text-[11px] text-ink-soft">开局独有小事件（序章里必定发生）
            <textarea rows={2} className={`${inp} mt-1`} value={p.event ?? ""} placeholder="如：出门时撞见邻居搬家，箱子里掉出一张旧照片" onChange={(e) => save("event", e.target.value)} />
          </label>
          <EventPick value={p.eventId} events={liveEvents()} onChange={(v) => save("eventId", v ?? "")} />
        </div>
      )}
    </div>
  );
}
