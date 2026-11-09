import { useEffect, useState } from "react";
import {
  STAT_LABELS, STAT_ORDER, creationCopy, loadPathLocks, savePathLock, clearPathLocks,
  type CreationCopy, type CreationPath, type Option, type PathNpc,
} from "../game/data";
import { complete, isConfigured } from "../lib/ai";
import { loadConfig } from "../lib/store";
import IntInput from "./IntInput";
import { normRouteFx, routeFxText, type RouteFx, type RouteNum } from "../game/routeFx";
import RoutePerks from "./RoutePerks";
import { getWorld, getWorldSlot } from "../mods/registry";
import { valueSources } from "../game/valueSources";
import {
  defaultPathLockCond,
  formatPathLockHint,
  PATH_LOCK_COND_KINDS,
  sanitizePathAttrNames,
  sanitizePathLockConds,
  type PathDepPools,
  type PathLockCondKind,
} from "../lib/pathDeps";
import { platformNpcTagsPromptLine, normalizeNpcTags } from "../lib/npcTags";
import { improperPersonNameReason, sanitizeNpcFactionId } from "../lib/personName";
import type { CmpOp, FixedCond } from "../lib/types";
import { CMP_OPS } from "../lib/types";
import { IconCheck, IconChevronDown, IconChevronUp, IconClose, IconLock, IconSpark } from "../lib/icons";

const livePool = () => [...new Set(valueSources({ stats: getWorldSlot("stats"), attrs: getWorldSlot("customAttrs"), paths: creationCopy().paths }).map((s) => s.label))];
/* 绑定事件库里的固定事件（可选）：开局序章按该事件演绎 */
export function EventPick({ value, events, onChange }: { value?: string; events: { id: string; name: string }[]; onChange: (v: string | undefined) => void }) {
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

/**
 * 功能注释：可变/固定展示项只能从本作品属性里多选，禁止手填；存的是属性显示名。
 */
function AttrNamePick({ title, hint, value, options, onChange }: {
  title: string; hint: string; value: string[]; options: { id: string; label: string }[]; onChange: (v: string[]) => void;
}) {
  const cleaned = sanitizePathAttrNames(value, options);
  const taken = new Set(cleaned);
  const unused = options.filter((o) => !taken.has(o.label) && !taken.has(o.id));
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-ink-soft"><b className="font-semibold text-ink">{title}</b> · {hint}</p>
      <select
        className={inp}
        value=""
        aria-label={title}
        disabled={!unused.length}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) return;
          onChange(sanitizePathAttrNames([...cleaned, next], options));
          e.target.value = "";
        }}
      >
        <option value="">{options.length ? "＋ 选择属性…" : "请先在建角字段添加属性"}</option>
        {unused.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
      </select>
      {cleaned.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cleaned.map((name) => (
            <button
              key={name}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-ink/25 bg-ink/5 px-2 py-0.5 text-[10.5px] font-semibold text-ink"
              onClick={() => onChange(cleaned.filter((x) => x !== name))}
              aria-label={`移除 ${name}`}
            >
              {name}<IconClose size={11} />
            </button>
          ))}
        </div>
      )}
      {!options.length && <p className="text-[10.5px] text-gold">本作品还没有属性，请先在上方「建角字段」里添加。</p>}
      {!!options.length && !cleaned.length && <p className="text-[10.5px] text-ink-soft/80">（可选 · 从下拉选择本作品属性）</p>}
    </div>
  );
}

/* 模组编辑器 · 人物线路：建角第一步的路径卡片（creation.paths）+ 对应的开局加成（identities，id 一一对应）。
 * 可手动逐条配置，也可让 AI 按世界观一键生成整套路径。
 * 功能注释：不再提供开局弹窗/展示块开关——多路径开局自动弹窗（只露路径名+开局处境），单路径直接用。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const num = (v: unknown) => Math.round(Number(v) || 0);

export default function ModPathsEditor({ creation, identities, world, npcs = [], rooms = [], events = [], statsValue, attrsValue, onChange, onMergeNpcs }: {
  creation?: CreationCopy; identities?: Option[]; world: string;
  npcs?: { id: string; name: string }[]; // 可配开局人际 / 预设主角的固定人物
  rooms?: { id: string; name: string }[]; // 可选的开局地点
  events?: { id: string; name: string }[]; // 事件库（绑定开局事件）
  statsValue?: import("../game/data").StatsSlot; attrsValue?: import("../lib/types").AttrDef[]; // 全局属性池来源（正在编辑的模组）
  onChange: (p: { creation: CreationCopy; identities: Option[] }) => void;
  /** 功能注释：AI 生成线路时一并回写人物资料（姓名/年龄/性别/约 300 字小传） */
  onMergeNpcs?: (npcs: import("../worlds/star2005/content").PersonContent[]) => void;
}) {
  // 功能注释：编辑器只认传入的本作品人物/地点/事件；为空就保持空，禁止回退娱乐圈 LIVE_*
  const srcList = valueSources({ stats: statsValue, attrs: attrsValue, paths: creation?.paths });
  const pool = [...new Set(srcList.map((s) => s.label))];
  const peopleOpts = npcs.map((p) => ({ id: p.id, name: p.name }));
  // 功能注释：可变/固定只能挂建角字段里已有的属性（显示名）；解锁条件另用 depPools
  const attrOpts = (() => {
    const out: { id: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const a of attrsValue ?? []) {
      const label = String(a?.label || a?.id || "").trim();
      const id = String(a?.id || label).trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push({ id, label });
    }
    return out;
  })();
  // 功能注释：线路解锁共用依赖池；选项必须来自本作品配置
  const depPools: PathDepPools = {
    stats: STAT_ORDER.map((k) => ({ id: k, label: STAT_LABELS[k] || k })),
    metrics: srcList.filter((s) => s.kind === "metric").map((s) => ({ id: s.key, label: s.label })),
    people: peopleOpts.map((p) => ({ id: p.id, label: p.name })),
    rooms: rooms.map((r) => ({ id: r.id, label: r.name })),
    events: events.map((e) => ({ id: e.id, label: e.name || e.id })),
  };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cc = creation ?? {};
  const paths = Array.isArray(cc.paths) ? cc.paths : [];
  const ids = Array.isArray(identities) ? identities : [];
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
      // 功能注释：沿用生成世界写入的「禁止生成」（prompt.extraRules），补全线路时同样遵守
      const forbidBlock = String(getWorld().content.prompt?.extraRules ?? "").trim();
      const raw = await complete(cfg, [
        { role: "system", content: "你是女性向模拟游戏的剧情与数值策划。只输出 JSON，不要任何解释或代码块标记。" },
        { role: "user", content: `为下面的世界观设计「人物线路」，并一并生成相关人物完整资料。\n世界观：${world}\n${forbidBlock ? `${forbidBlock}\n以上禁止项不得出现在线路或人物资料中。\n` : ""}本世界已有的属性名（fixed / choose / fx.attr / fx.reputation 的 name 必须从这里选，禁止手填野名）：${attrOpts.map((a) => a.label).join("、") || pool.join("、") || "无"}\n${platformNpcTagsPromptLine()}\n输出格式：{"paths":[{"id":"英文id","name":"路径名","tag":"短标签","blurb":"卖点","about":"开局处境","fixed":["属性名"],"choose":["属性名"],"fx":{"attr":[{"name":"属性名","val":整数}],"favor":[{"target":"人物名","val":整数}],"reputation":[{"name":"词条","val":整数}],"note":"概括"},"hero":"人物id或空","room":"地点id或空","eventId":"事件id或空","memory":"前置记忆"}],"npcs":[{"id":"与hero或favor对应的英文id","name":"有姓有名如沈晚晴","role":"身份/称号","kind":"roam","home":"地点id","roam":[],"gender":"男|女|其他","age":整数,"bio":"约300字活人小传，贴合世界观","tags":["标签"],"relation":"与主角关系","metStart":true}]}\n要求：3~5 条路径；每条涉及的关键人物都必须出现在 npcs 里且 name/gender/age/bio 齐全；name 须有姓有名（禁止太皇太后/厨娘等纯身份），身份写到 role；kind 一律 "roam"；bio 约 300 字禁止空着；favor.target 用人物名；fixed/choose 只能填上方已有属性名。\n已有人物（可沿用 id）：${peopleOpts.map((n) => `${n.id}=${n.name}`).join("，") || "无"}\n地点：${rooms.map((r) => `${r.id}=${r.name}`).join("，") || "无"}\n事件：${events.map((e) => `${e.id}=${e.name}`).join("，") || "无"}` },
      ]);
      const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {
        paths?: (Partial<CreationPath> & { fx?: unknown })[];
        npcs?: {
          id?: string; name?: string; role?: string; kind?: string; home?: string; roam?: string[];
          gender?: string; age?: number; bio?: string; tags?: string[]; relation?: string; metStart?: boolean; wxStart?: boolean; factionId?: string;
        }[];
      };
      const list = (j.paths ?? []).filter((p) => p?.name);
      if (!list.length) throw new Error("AI 没有返回可用的路径，请重试。");
      // 功能注释：线路 AI 人物须有姓有名；kind 固定 roam；势力只留作品内仍存在的 id
      const liveFactionIds = new Set(
        (getWorldSlot("creation")?.startFactions ?? [])
          .map((f: { id?: string }) => String(f?.id ?? "").trim())
          .filter(Boolean),
      );
      const generatedPeople = (j.npcs ?? [])
        .filter((n) => n?.id && String(n.name ?? "").trim() && !improperPersonNameReason(n.name))
        .map((n) => ({
          id: String(n.id).toLowerCase().replace(/[^a-z0-9_-]+/g, "-"),
          name: String(n.name).trim(),
          role: String(n.role ?? "").trim(),
          kind: "roam" as const,
          home: (n.home && rooms.some((r) => r.id === n.home) ? n.home : rooms[0]?.id) || "",
          roam: Array.isArray(n.roam) ? n.roam.map(String) : [],
          bio: String(n.bio ?? "").trim(),
          gender: n.gender === "男" || n.gender === "女" || n.gender === "其他" ? n.gender : undefined,
          age: typeof n.age === "number" && Number.isFinite(n.age) ? Math.max(0, Math.trunc(n.age)) : undefined,
          tags: normalizeNpcTags(n.tags).length ? normalizeNpcTags(n.tags) : undefined,
          relation: typeof n.relation === "string" && n.relation.trim() ? n.relation.trim() : undefined,
          metStart: n.metStart || undefined,
          wxStart: n.wxStart || undefined,
          factionId: sanitizeNpcFactionId(n.factionId, liveFactionIds),
          requires: [] as never[],
        }));
      const peopleForFx = [...peopleOpts, ...generatedPeople.map((n) => ({ id: n.id, name: n.name }))];
      const np: CreationPath[] = list.map((p, i) => ({
        id: (p.id || `path${i}`).toLowerCase().replace(/[^a-z0-9_-]+/g, "-"), name: p.name!, tag: p.tag ?? "", blurb: p.blurb ?? "", open: true,
        about: p.about ?? "",
        // 功能注释：AI 给的 fixed/choose 也必须落在本作品属性上，野名丢掉
        fixed: sanitizePathAttrNames(p.fixed, attrOpts),
        choose: sanitizePathAttrNames(p.choose, attrOpts),
        ...(() => {
          const fx = normRouteFx(p.fx);
          if (!fx) return { perks: p.perks ?? "" };
          const known = new Set(pool);
          fx.attr = fx.attr?.filter((a) => known.has(a.name));
          fx.reputation = fx.reputation?.filter((a) => known.has(a.name));
          fx.favor = fx.favor?.filter((f) => peopleForFx.some((n) => n.name === f.target || n.id === f.target));
          return { fx, perks: routeFxText(fx) };
        })(),
        ...(p.hero && peopleForFx.some((n) => n.id === p.hero) && !list.slice(0, i).some((q) => q.hero === p.hero) ? { hero: p.hero } : {}),
        ...(p.room && rooms.some((r) => r.id === p.room) ? { room: p.room } : {}),
        ...(typeof p.memory === "string" && p.memory.trim() ? { memory: p.memory.trim() } : {}),
        ...(p.eventId && events.some((e) => e.id === p.eventId) ? { eventId: p.eventId } : {}),
      }));
      const ni: Option[] = np.map((p) => ({ id: p.id, name: p.name, tag: p.tag, desc: p.perks })); // 数值全在线路 fx 里，身份表只留名称
      // 功能注释：建角页标题和引导语不再由这里改写。AI 换路径，并回写人物资料。
      commit(np, ni);
      if (generatedPeople.length && onMergeNpcs) onMergeNpcs(generatedPeople);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "生成失败，请稍后再试。");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-jade/10 to-coral/10 px-3 py-2">
        <p className="text-[11.5px] leading-snug text-ink-soft">让 AI 按这个世界观生成人物线路，并一并生成相关人物资料（姓名 / 年龄 / 性别 / 简介）。多条路径开局会让玩家选；只有一条则直接用。</p>
        <button className={`${btn} shrink-0 inline-flex items-center gap-1 !border-transparent bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] !text-white`} disabled={busy} onClick={aiGen}>{busy ? "生成中…" : <><IconSpark size={14} /> AI 生成</>}</button>
      </div>
      {err && <p className="text-[11px] text-danger">{err}</p>}

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
              <div className="space-y-1.5 rounded-lg border border-dashed border-coral/40 bg-coral/[0.04] p-2">
                <label className="block text-[10.5px] text-ink-soft">
                  未解锁角标
                  <input
                    className={`${inp} mt-0.5 max-w-[10rem]`}
                    value={p.lockTag ?? ""}
                    placeholder="未解锁"
                    onChange={(e) => setPath(i, { lockTag: e.target.value || undefined })}
                  />
                </label>
                <PathLockCondsEditor
                  value={Array.isArray(p.lockConds) ? p.lockConds : []}
                  pools={depPools}
                  onChange={(lockConds) => {
                    const cleaned = sanitizePathLockConds(lockConds, depPools);
                    setPath(i, {
                      lockConds: cleaned.length ? cleaned : undefined,
                      lockHint: formatPathLockHint(cleaned, depPools) || undefined,
                    });
                  }}
                />
              </div>
            )}
            <textarea rows={2} className={inp} value={String(p.blurb ?? "")} placeholder="线路简介（卡片上显示，仅给玩家看）" onChange={(e) => setPath(i, { blurb: e.target.value })} />
            <textarea rows={3} className={inp} value={String(p.about ?? "")} placeholder="展开详情：开局处境（第二人称「你」，仅给玩家看）" onChange={(e) => setPath(i, { about: e.target.value })} />
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <AttrNamePick
                title="可变自由决定"
                hint="从本作品属性里选 · 不可手填"
                value={Array.isArray(p.choose) ? p.choose : []}
                options={attrOpts}
                onChange={(choose) => setPath(i, { choose })}
              />
              <AttrNamePick
                title="固定不可改"
                hint="从本作品属性里选 · 不可手填"
                value={Array.isArray(p.fixed) ? p.fixed : []}
                options={attrOpts}
                onChange={(fixed) => setPath(i, { fixed })}
              />
            </div>
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
              <label className="block text-[10.5px] text-ink-soft">专属前置记忆（写进主角档案 · 仅文案，AI 可读）
                <textarea rows={2} className={`${inp} mt-0.5`} value={p.memory ?? ""} placeholder="如：三年前在雨夜救过一只流浪猫，至今记得那家便利店" onChange={(e) => setPath(i, { memory: e.target.value || undefined })} />
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

/** 功能注释：开局数值行——名称只能从已有配置下拉选；没选中的行开局不生效 */
function DepNumRows<T extends { val: number }>({ title, hint, rows, nameOf, setName, options, emptyLabel, onChange }: {
  title: string; hint: string; rows: T[]; nameOf: (r: T) => string; setName: (r: T, v: string) => T;
  options: { id: string; label: string }[]; emptyLabel: string; onChange: (rows: T[]) => void;
}) {
  const move = (from: number, to: number) => { if (to < 0 || to >= rows.length || from === to) return; const n = rows.slice(); const [x] = n.splice(from, 1); n.splice(to, 0, x); onChange(n); };
  const set = (i: number, r: T) => onChange(rows.map((x, j) => (j === i ? r : x)));
  const taken = new Set(rows.map((r) => nameOf(r)).filter(Boolean));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-soft"><b className="font-semibold text-ink">{title}</b> · {hint}</p>
        <button type="button" className={`${btn} shrink-0`} disabled={!options.length} onClick={() => onChange([...rows, setName({ val: 0 } as T, "")])}>＋ 添加一行</button>
      </div>
      {!options.length && <p className="text-[10.5px] text-gold">本作品还没有可选{title}，请先在属性 / 人物里配置。</p>}
      {rows.map((r, i) => {
        const cur = String(nameOf(r) ?? "");
        const known = !cur || options.some((o) => o.id === cur || o.label === cur);
        return (
          <div key={i} className="flex items-center gap-1">
            <select
              className={`${inp} ${cur && known ? "" : "!border-danger/60"}`}
              value={options.some((o) => o.id === cur) ? cur : options.some((o) => o.label === cur) ? options.find((o) => o.label === cur)!.id : cur}
              aria-label={`${title}依赖`}
              onChange={(e) => set(i, setName(r, e.target.value))}
            >
              <option value="">{emptyLabel}</option>
              {cur && !known && <option value={cur}>{cur}（已失效 · 不生效）</option>}
              {options.filter((o) => o.id === cur || o.label === cur || !taken.has(o.id) && !taken.has(o.label)).map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <IntInput value={r.val} label={`${title}数值`} onChange={(val) => set(i, { ...r, val })} />
            <button type="button" className={`${btn} shrink-0 !px-1.5`} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="上移">↑</button>
            <button type="button" className={`${btn} shrink-0 !px-1.5`} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} aria-label="下移">↓</button>
            <button type="button" className={`${btn} shrink-0 !px-2 hover:!border-danger hover:!text-danger`} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="删除这一行">×</button>
          </div>
        );
      })}
      {!rows.length && <p className="text-[10.5px] text-ink-soft/80">（暂无，点「＋ 添加一行」并从下拉选择）</p>}
    </div>
  );
}

/** 功能注释：解锁条件编辑——从属性/人物/地点/事件选，填比较或勾选；禁止手打长文 */
export function PathLockCondsEditor({ value, pools, onChange }: {
  value: FixedCond[]; pools: PathDepPools; onChange: (v: FixedCond[]) => void;
}) {
  const set = (i: number, c: FixedCond) => onChange(value.map((x, j) => (j === i ? c : x)));
  const hint = formatPathLockHint(value, pools);
  const kindLabel: Record<PathLockCondKind, string> = {
    stat: "主角属性", metric: "指标/自定义属性", rel: "人物好感", location: "当前地点", event: "已触发事件",
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-ink-soft"><b className="font-semibold text-ink">解锁条件</b> · 从已有配置选择；未选中的不生效</p>
        <select
          className={`${inp} !w-auto max-w-[11rem]`}
          value=""
          aria-label="添加解锁条件"
          onChange={(e) => {
            const kind = e.target.value as PathLockCondKind;
            if (!kind) return;
            onChange([...value, defaultPathLockCond(kind, pools)]);
            e.target.value = "";
          }}
        >
          <option value="">＋ 添加条件…</option>
          {PATH_LOCK_COND_KINDS.map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}
        </select>
      </div>
      {value.map((c, i) => {
        if (!PATH_LOCK_COND_KINDS.includes(c.kind as PathLockCondKind)) return null;
        const kind = c.kind as PathLockCondKind;
        const opts = kind === "stat" ? pools.stats : kind === "metric" ? pools.metrics : kind === "rel" ? pools.people : kind === "location" ? pools.rooms : pools.events;
        const key = "key" in c ? c.key : "";
        return (
          <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-paper/60 px-2 py-1.5">
            <span className="text-[11px] font-semibold text-ink-soft">{kindLabel[kind]}</span>
            <select
              className={inp}
              value={key}
              onChange={(e) => {
                const nextKey = e.target.value;
                if (kind === "stat") set(i, { kind: "stat", key: nextKey, op: ("op" in c ? c.op : "gte") as CmpOp, value: "value" in c ? Number(c.value) || 0 : 0 });
                else if (kind === "metric") set(i, { kind: "metric", key: nextKey, op: ("op" in c ? c.op : "gte") as CmpOp, value: "value" in c ? Number(c.value) || 0 : 0 });
                else if (kind === "rel") set(i, { kind: "rel", key: nextKey, op: ("op" in c ? c.op : "gte") as CmpOp, value: "value" in c ? Number(c.value) || 0 : 0 });
                else if (kind === "location") set(i, { kind: "location", key: nextKey });
                else set(i, { kind: "event", key: nextKey });
              }}
            >
              <option value="">（请选择）</option>
              {key && !opts.some((o) => o.id === key) && <option value={key}>{key}（已失效）</option>}
              {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {(kind === "stat" || kind === "metric" || kind === "rel") && (
              <>
                <select
                  className={`${inp} !w-16`}
                  value={"op" in c ? c.op : "gte"}
                  onChange={(e) => {
                    if (kind === "stat") set(i, { kind: "stat", key, op: e.target.value as CmpOp, value: "value" in c ? Number(c.value) || 0 : 0 });
                    else if (kind === "metric") set(i, { kind: "metric", key, op: e.target.value as CmpOp, value: "value" in c ? Number(c.value) || 0 : 0 });
                    else set(i, { kind: "rel", key, op: e.target.value as CmpOp, value: "value" in c ? Number(c.value) || 0 : 0 });
                  }}
                >
                  {CMP_OPS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
                <input
                  type="number"
                  className={`${inp} !w-20`}
                  value={"value" in c ? c.value : 0}
                  onChange={(e) => {
                    const value = Number(e.target.value) || 0;
                    const op = ("op" in c ? c.op : "gte") as CmpOp;
                    if (kind === "stat") set(i, { kind: "stat", key, op, value });
                    else if (kind === "metric") set(i, { kind: "metric", key, op, value });
                    else set(i, { kind: "rel", key, op, value });
                  }}
                />
              </>
            )}
            <button type="button" className={`${btn} shrink-0`} onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="删除条件">×</button>
          </div>
        );
      })}
      {!value.length && <p className="text-[10.5px] text-ink-soft/80">（无条件 = 仅靠手动「已解锁 / 未解锁」开关）</p>}
      {hint ? <p className="text-[10.5px] text-coral/90">解锁提示：{hint}</p> : null}
    </div>
  );
}

/* 人物线路 · 开局数值：属性/好感/声望只从已有配置下拉选；未选中的开局不生效 */
export function RouteFxEditor({ label, onLabel, value, npcs, relationOf, onChange, pool }: {
  label?: string; onLabel: (v: string | undefined) => void;
  pool?: string[]; // 全局属性池显示名
  value?: RouteFx; npcs: { id: string; name: string }[]; relationOf: (target: string) => string;
  onChange: (fx: RouteFx | undefined, text: string) => void;
}) {
  const fx = value ?? {};
  const poolNames = pool ?? livePool();
  const attrOpts = poolNames.map((n) => ({ id: n, label: n }));
  const personOpts = npcs.map((n) => ({ id: n.id, label: n.name }));
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
  return (
    <div className="space-y-2 rounded-lg border border-line/70 bg-paper p-2">
      <p className="text-[11px] text-ink-soft"><b className="font-semibold text-ink">开局数值</b> · 从本作品属性 / 人物里选择后填数字；没选中的游戏里不生效</p>
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
      <DepNumRows title="属性" hint="主角能力 · 依赖属性字段" rows={Array.isArray(fx.attr) ? fx.attr : []} nameOf={(r) => String(r?.name ?? "")} setName={(r, name) => ({ ...r, name })} options={attrOpts} emptyLabel="选择属性…" onChange={(attr) => commitFx({ attr })} />
      <DepNumRows
        title="好感"
        hint="目标人物 · 依赖角色库"
        rows={Array.isArray(fx.favor) ? fx.favor : []}
        nameOf={(r) => {
          const t = String(r?.target ?? "");
          return npcs.find((n) => n.id === t || n.name === t)?.id || t;
        }}
        setName={(r, id) => ({ ...r, target: npcs.find((n) => n.id === id)?.name || id })}
        options={personOpts}
        emptyLabel="选择人物…"
        onChange={(favor) => commitFx({ favor })}
      />
      <DepNumRows title="声望 / 词条" hint="口碑名气等 · 依赖属性字段" rows={Array.isArray(fx.reputation) ? fx.reputation : []} nameOf={(r) => String(r?.name ?? "")} setName={(r, name) => ({ ...r, name })} options={attrOpts} emptyLabel="选择词条…" onChange={(reputation) => commitFx({ reputation })} />
      {fx.mode === "free" && (
        <label className="block text-[11px] text-ink-soft">自由描述（卡片上原样显示，不自动拼接数值；上方已选数值仍在开局生效）
          <textarea rows={2} className={`${inp} mt-0.5`} value={fx.text ?? ""} placeholder="如：灵力尚浅，悟性奇高，师尊另眼相看" onChange={(e) => commitFx({ text: e.target.value })} />
        </label>
      )}
      <label className="block text-[11px] text-ink-soft">线路备注短句（显示在括号里，可空 · 仅展示）
        <input className={`${inp} mt-0.5`} value={fx.note ?? ""} placeholder="如：专业底子厚，但还没名气" onChange={(e) => commitFx({ note: e.target.value })} />
      </label>
      <div className="rounded-lg border border-gold/30 bg-gold/5 px-2.5 py-1.5" aria-live="polite">
        <p className="text-[10px] font-semibold tracking-wider text-gold">实时预览 · 玩家在线路卡片上看到</p>
        {preview ? <RoutePerks className="mt-1 !px-0 !bg-transparent" label={label} text={preview} /> : <p className="mt-0.5 text-[12px] text-ink-soft">（选择上方依赖并填数值后在这里预览）</p>}
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
