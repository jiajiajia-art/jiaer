import { RAW_STAT_LABELS, type StatsSlot, RAW_ZODIACS, type Zodiac, RAW_BACKGROUNDS, RAW_DIRECTIONS, RAW_IDENTITIES, RAW_PARENT_JOBS, RAW_STYLES, type Option, optFx } from "../game/data";
import { asTrimmedString } from "../lib/asTrimmedString";

import type { AttrDef } from "../lib/types";
import { fxSummary } from "../game/optFx";
import { OptFxEditor } from "./ModCreationFieldsEditor";
import { ZodiacSign } from "../lib/zodiacIcons";

/* 模组编辑器 · 建角选项池：外形风格 / 出道身份 / 家庭背景 / 职业方向 / 星座 + 母校 / 父母职业。
 * 选项本身只是文字设定；开局加成由作者用通用加成（能力 / 自定义属性 / 好感…）自行配置，不配 = 无数值。 */
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";

/** 功能注释：母校 / 父母职业常被写成 {name} 对象，直接塞进输入框会变成 [object Object] */
function schoolText(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map((item) => asTrimmedString(item)).filter(Boolean).join("、");
  return asTrimmedString(raw);
}
function jobLines(raw: unknown): string {
  const list = Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw];
  return list.map((item) => asTrimmedString(item)).filter(Boolean).join("\n");
}
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const POOLS = [
  { k: "styles", l: "外形风格", raw: RAW_STYLES },
  { k: "identities", l: "出道身份", raw: RAW_IDENTITIES },
  { k: "backgrounds", l: "家庭背景", raw: RAW_BACKGROUNDS },
  { k: "directions", l: "职业方向", raw: RAW_DIRECTIONS },
] as const;

type K = (typeof POOLS)[number]["k"];
type V = Partial<Record<K, Option[]>> & { school?: string; parentJobs?: string[]; zodiacs?: Zodiac[] };
export default function ModPoolsEditor({ value, stats, attrs = [], npcs = [], onChange }: { value: V; stats?: StatsSlot; attrs?: AttrDef[]; npcs?: { id: string; name: string }[]; onChange: (p: V) => void }) {
  const statLabels: Record<string, string> = { ...RAW_STAT_LABELS, ...(stats?.labels ?? {}) };
  const names = { attr: (id: string) => attrs.find((a) => a.id === id)?.label, npc: (id: string) => npcs.find((n) => n.id === id)?.name };
  // 折叠的开局加成编辑：摘要一行，展开后用通用加成编辑器
  // others：同一池里其他已配加成的选项，可一键套用；desc：玩家在建角页看到的说明文字
  const fxBox = (fx: Option["fx"], set: (v: Option["fx"]) => void, others: { name: string; fx: NonNullable<Option["fx"]> }[] = [], desc?: string) => {
    const sum = fxSummary(fx, names);
    const preview = [typeof desc === "string" ? desc.trim() : "", ...sum].filter(Boolean).join(" · ");
    const quiet = sum.length === 0;
    return (
      <details className={quiet ? "" : "rounded-lg border border-jade/30 bg-jade/10 px-2 py-1"}>
        <summary className={quiet ? "w-fit cursor-pointer list-none text-[11px] font-semibold text-ink-soft hover:text-jade" : "flex cursor-pointer list-none items-center gap-2 text-[11px]"}>
          {quiet ? "＋ 开局加成" : (
            <>
              <span className="shrink-0 font-semibold text-jade">开局加成</span>
              <span className="min-w-0 flex-1 truncate text-jade">{sum.join(" · ")}</span>
              <span className="text-ink-soft">›</span>
            </>
          )}
        </summary>
        <div className={`space-y-1.5 ${quiet ? "mt-1.5 rounded-lg border border-line bg-paper-2 p-2" : "mt-1.5"}`}>
          <OptFxEditor value={fx} attrs={attrs} npcs={npcs} statLabels={statLabels} onChange={set} />
          <div className="flex flex-wrap items-center gap-1.5">
            {others.length > 0 && (
              <select className={`${inp} !w-auto`} value="" onChange={(e) => { const o = others[Number(e.target.value)]; if (o) set(structuredClone(o.fx)); }}>
                <option value="">套用其他选项的加成…</option>
                {others.map((o, i) => <option key={i} value={i}>{o.name || "未命名"}：{fxSummary(o.fx, names).join("，")}</option>)}
              </select>
            )}
            {sum.length > 0 && <button className={btn} onClick={() => set(undefined)}>清空加成</button>}
          </div>
          <p className="text-[10.5px] text-ink-soft">玩家看到：<span className="text-ink">{preview || "（无说明）"}</span></p>
        </div>
      </details>
    );
  };
  const zod = Array.isArray(value.zodiacs) ? value.zodiacs : [];
  const setZ = (i: number, p: Partial<Zodiac>) => onChange({ zodiacs: zod.map((z, j) => (j === i ? { ...z, ...p } : z)) });
  return (
    <div className="space-y-4">
      {POOLS.map(({ k, l, raw }) => {
        const list = Array.isArray(value[k]) ? value[k] : [];
        const commit = (n: Option[]) => onChange({ [k]: n.length ? n : undefined });
        const set = (i: number, p: Partial<Option>) => commit(list.map((o, j) => (j === i ? { ...o, ...p } : o)));
        const withFx = list.filter((o) => optFx(o)).length;
        return (
          <div key={k} className="space-y-1.5">
            <p className="border-l-2 border-gold/80 pl-2 text-[13px] font-bold text-ink">{l} <span className="font-normal text-ink-soft">· {list.length ? `${list.length} 项${withFx ? ` · ${withFx} 项有开局加成` : ""}` : "沿用默认（只有文字）"}</span></p>
            {!list.length && <button className={btn} onClick={() => commit(raw.map((o) => ({ ...o })))}>以默认选项为起点自定义</button>}
            {list.map((o, i) => (
              <div key={o.id} className="rounded-xl border border-line bg-paper px-2.5 py-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <input aria-label={`${l}名称`} className={`${inp} !w-auto min-w-0 flex-1 basis-0 font-medium placeholder:text-ink-soft`} value={String(o.name ?? "")} placeholder="名称" onChange={(e) => set(i, { name: e.target.value })} />
                  <input aria-label={`${l}标签`} className={`${inp} !w-24 shrink-0`} value={String(o.tag ?? "")} placeholder="标签" onChange={(e) => set(i, { tag: e.target.value })} />
                  <button className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[15px] leading-none text-ink-soft hover:bg-coral/10 hover:text-coral" onClick={() => commit(list.filter((_, j) => j !== i))} aria-label="删除">×</button>
                </div>
                <input aria-label={`${l}说明`} className={`${inp} mt-1.5 !border-transparent !bg-transparent px-1 text-ink-soft`} value={String(o.desc ?? "")} placeholder="玩家看到的一句话" onChange={(e) => set(i, { desc: e.target.value })} />
                <div className="mt-1">
                  {fxBox(optFx(o), (fx) => set(i, { fx, stats: undefined, money: undefined, fame: undefined, reputation: undefined, stress: undefined, looksBonus: undefined }),
                    list.flatMap((x, j) => { const f = optFx(x); return j !== i && f ? [{ name: x.name, fx: f }] : []; }), o.desc)}
                </div>
              </div>
            ))}
            {list.length > 0 && <button className={btn} onClick={() => commit([...list, { id: `o_${Date.now().toString(36).slice(-5)}`, name: "", desc: "", tag: "" }])}>＋ 添加{l}</button>}
          </div>
        );
      })}
      <div className="space-y-1.5">
        <p className="border-l-2 border-gold/80 pl-2 text-[13px] font-bold text-ink">星座 <span className="font-normal text-ink-soft">· 由出生日期推算 · {zod.length ? `${zod.length} 项` : "沿用默认（只有性格描述）"}</span></p>
        {!zod.length && <button className={btn} onClick={() => onChange({ zodiacs: RAW_ZODIACS.map((z) => ({ ...z })) })}>以默认星座为起点自定义</button>}
        {zod.map((z, i) => {
          const fb = RAW_ZODIACS.find((x) => x.id === z.id);
          const from = Array.isArray(z.from) ? z.from : fb?.from;
          const to = Array.isArray(z.to) ? z.to : fb?.to;
          return (
          <div key={z.id} className="rounded-xl border border-line bg-paper px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-ink"><ZodiacSign id={z.id} width={14} height={14} className="text-gold" />{z.name}</span>
              <span className="shrink-0 text-[10.5px] text-ink-soft">{from && to ? `${from.join("/")}–${to.join("/")}` : ""}</span>
            </div>
            <input className={`${inp} mt-1.5 !border-transparent !bg-transparent px-1 text-ink-soft`} value={String(z.bonus ?? "")} placeholder="性格描述（玩家可见）" onChange={(e) => setZ(i, { bonus: e.target.value })} />
            <div className="mt-1">
              {fxBox(optFx(z), (fx) => setZ(i, { fx, stats: undefined, money: undefined, fame: undefined, reputation: undefined, stress: undefined, looksBonus: undefined }),
                zod.flatMap((x, j) => { const f = optFx(x); return j !== i && f ? [{ name: x.name, fx: f }] : []; }), z.bonus)}
            </div>
          </div>
          );
        })}
        {zod.length > 0 && <button className={btn} onClick={() => onChange({ zodiacs: undefined })}>恢复默认星座</button>}
      </div>
      <label className="block text-[12px] font-bold text-ink">母校
        <input className={`${inp} mt-1 font-normal`} value={schoolText(value.school)} placeholder="留空 = 沿用默认" onChange={(e) => onChange({ school: e.target.value || undefined })} />
      </label>
      <label className="block text-[12px] font-bold text-ink">父母职业池 <span className="font-normal text-ink-soft">· 一行一个，建角时随机抽取</span>
        <textarea rows={4} className={`${inp} mt-1 font-normal`} value={jobLines(value.parentJobs)} placeholder={RAW_PARENT_JOBS.slice(0, 4).join("\n") + "\n……（留空 = 沿用默认）"}
          onChange={(e) => { const a = e.target.value.split("\n"); onChange({ parentJobs: a.some((x) => x.trim()) ? a : undefined }); }}
          onBlur={(e) => { const a = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean); onChange({ parentJobs: a.length ? a : undefined }); }} />
      </label>
    </div>
  );
}
